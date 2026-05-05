/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║              ANTICIG Backend Server — v1.0.0                    ║
 * ║        Full REST API for the ANTICIG Clothing Website           ║
 * ║                  Port: 3000  |  No external deps                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Run: node server.js
 *
 * API Endpoints:
 *   POST   /api/auth/register
 *   POST   /api/auth/login
 *   GET    /api/auth/me
 *   PUT    /api/auth/me
 *   PUT    /api/auth/password
 *
 *   GET    /api/products
 *   GET    /api/products/:id
 *   POST   /api/products         (admin)
 *   PUT    /api/products/:id     (admin)
 *   DELETE /api/products/:id     (admin)
 *   GET    /api/products/:id/reviews
 *   POST   /api/products/:id/reviews
 *
 *   GET    /api/cart
 *   POST   /api/cart
 *   PUT    /api/cart/:itemKey
 *   DELETE /api/cart/:itemKey
 *   DELETE /api/cart
 *
 *   POST   /api/orders
 *   GET    /api/orders
 *   GET    /api/orders/:id
 *   PUT    /api/orders/:id/cancel
 *   GET    /api/admin/orders     (admin)
 *   PUT    /api/admin/orders/:id (admin)
 *
 *   GET    /api/wishlist
 *   POST   /api/wishlist/:productId
 *   DELETE /api/wishlist/:productId
 *   POST   /api/newsletter
 *   DELETE /api/newsletter
 *   GET    /api/collections
 *   GET    /api/search?q=
 *   GET    /api/admin/stats      (admin)
 *   GET    /api/admin/users      (admin)
 *   GET    /api/health
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// ─── Minimal Router ──────────────────────────────────────────────────
class Router {
  constructor() { this.routes = []; }

  add(method, pattern, ...handlers) {
    this.routes.push({ method: method.toUpperCase(), pattern, handlers });
  }

  get(p, ...h) { this.add('GET', p, ...h); }
  post(p, ...h) { this.add('POST', p, ...h); }
  put(p, ...h) { this.add('PUT', p, ...h); }
  delete(p, ...h) { this.add('DELETE', p, ...h); }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method && route.method !== 'ALL') continue;
      const paramNames = [];
      const regexStr = route.pattern.replace(/:([^/]+)/g, (_, name) => {
        paramNames.push(name); return '([^/]+)';
      });
      const match = pathname.match(new RegExp(`^${regexStr}$`));
      if (match) {
        const params = {};
        paramNames.forEach((n, i) => params[n] = decodeURIComponent(match[i + 1]));
        return { handlers: route.handlers, params };
      }
    }
    return null;
  }
}

// ─── Request/Response Helpers ─────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) reject(new Error('Payload too large')); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  const json = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json)
  });
  res.end(json);
}

// ─── CORS Middleware ──────────────────────────────────────────────────
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true; }
  return false;
}

// ─── Build Router ─────────────────────────────────────────────────────
const router = new Router();

// Mount routes
require('./routes/auth')(router);
require('./routes/products')(router);
require('./routes/cart')(router);
require('./routes/orders')(router);
require('./routes/misc')(router);

// ─── HTTP Server ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  if (cors(req, res)) return;

  // Serve static frontend
  const parsed = url.parse(req.url, true);
  let pathname = parsed.pathname;

  // API routing
  if (pathname.startsWith('/api')) {
    const apiPath = pathname.replace('/api', '') || '/';
    const matched = router.match(req.method, apiPath);

    if (!matched) {
      return send(res, 404, { success: false, message: `Route ${req.method} ${pathname} not found` });
    }

    // Build req object
    req.query = parsed.query;
    req.params = matched.params;
    req.body = await parseBody(req);
    req.headers = req.headers;

    // Build res helpers
    res.status = (code) => { res._statusCode = code; return res; };
    res.json = (data) => send(res, res._statusCode || 200, data);
    res._statusCode = 200;

    // Run handler chain (middleware + handler)
    let idx = 0;
    const next = (err) => {
      if (err) return send(res, 500, { success: false, message: err.message || 'Server error' });
      if (idx >= matched.handlers.length) return;
      const handler = matched.handlers[idx++];
      try { handler(req, res, next); }
      catch (e) { send(res, 500, { success: false, message: e.message }); }
    };
    next();
    return;
  }

  // Serve HTML pages
  const staticPages = {
    '/': ['/mnt/user-data/outputs/anticig-website.html', path.join(__dirname, '..', 'anticig-website.html')],
    '/index.html': ['/mnt/user-data/outputs/anticig-website.html'],
    '/admin': [path.join(__dirname, 'admin.html')],
    '/admin.html': [path.join(__dirname, 'admin.html')],
    '/checkout': [path.join(__dirname, 'checkout.html')],
    '/checkout.html': [path.join(__dirname, 'checkout.html')],
  };

  if (staticPages[pathname]) {
    try {
      let html = null;
      for (const loc of staticPages[pathname]) {
        if (fs.existsSync(loc)) { html = fs.readFileSync(loc, 'utf8'); break; }
      }
      if (html) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); }
      else { res.writeHead(404); res.end('Page not found'); }
    } catch { res.writeHead(500); res.end('Error'); }
    return;
  }

  send(res, 404, { success: false, message: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║           ANTICIG Backend Server v1.0            ║
║         http://localhost:${PORT}                   ║
╠══════════════════════════════════════════════════╣
║  API Base: http://localhost:${PORT}/api            ║
║  Health:   http://localhost:${PORT}/api/health     ║
║  Frontend: http://localhost:${PORT}/               ║
╚══════════════════════════════════════════════════╝

Default Admin:
  Email:    admin@anticig.com
  Password: Admin@1234
`);
});

module.exports = server;
