// Minimal, dependency-free reverse proxy to Padlet's official hosted MCP server.
// All MCP traffic (streamable HTTP + SSE) and OAuth discovery are passed through.
// Padlet performs OAuth 2.1 + PKCE itself; this proxy never sees or stores credentials.
const http = require('http');
const https = require('https');
const { URL } = require('url');

const UPSTREAM = new URL(process.env.PADLET_MCP_UPSTREAM || 'https://mcp.padlet.com');
const TOOLSETS = process.env.PADLET_TOOLSETS || 'core';
const PORT = parseInt(process.env.PORT || '3000', 10);

function publicOrigin(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${proto}://${host}`;
}

const server = http.createServer((req, res) => {
  const incoming = new URL(req.url, 'http://local');

  if (incoming.pathname === '/healthz' || incoming.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, upstream: UPSTREAM.origin }));
  }

  // Map /mcp (Manufact convention) and / to Padlet's root MCP endpoint.
  let path = incoming.pathname;
  if (path === '/mcp' || path === '/mcp/') path = '/';
  const target = new URL(path + incoming.search, UPSTREAM);
  if (path === '/' && !target.searchParams.has('toolsets')) target.searchParams.set('toolsets', TOOLSETS);

  const headers = { ...req.headers, host: UPSTREAM.host };
  delete headers['x-forwarded-host'];

  const isDiscovery = path.startsWith('/.well-known/oauth-protected-resource');
  if (isDiscovery) delete headers['accept-encoding'];

  const upstreamReq = https.request(target, { method: req.method, headers }, (up) => {
    const outHeaders = { ...up.headers };
    const origin = publicOrigin(req);

    // Point protected-resource metadata hints back at this proxy.
    if (outHeaders['www-authenticate']) {
      outHeaders['www-authenticate'] = String(outHeaders['www-authenticate']).split(UPSTREAM.origin).join(origin);
    }

    if (isDiscovery) {
      let body = '';
      up.setEncoding('utf8');
      up.on('data', (c) => (body += c));
      up.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.resource) json.resource = origin + (incoming.pathname.replace('/.well-known/oauth-protected-resource', '') || '/');
          body = JSON.stringify(json);
        } catch (_) { /* pass through unchanged */ }
        delete outHeaders['content-length'];
        delete outHeaders['content-encoding'];
        res.writeHead(up.statusCode || 502, outHeaders);
        res.end(body);
      });
      return;
    }

    res.writeHead(up.statusCode || 502, outHeaders);
    up.pipe(res);
  });

  upstreamReq.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'upstream_error', message: err.message }));
  });

  req.pipe(upstreamReq);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`padlet-mcp-proxy listening on :${PORT} -> ${UPSTREAM.origin} (toolsets=${TOOLSETS})`);
});
