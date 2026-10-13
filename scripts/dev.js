import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import api from '../api/index.js';
const root = resolve('public'), port = Number(process.env.PORT || 8793);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname.startsWith('/api/')) {
      const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: req, duplex: 'half' }) });
      const response = await api.fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`ALTUM preview: http://localhost:${port}`));
