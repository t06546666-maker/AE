const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5505;
const ROOT_DIR = path.resolve(__dirname, '..');
const MERCHANT_FILE = path.join(ROOT_DIR, 'ae-merchant.html');
const CUSTOMER_FILE = path.join(ROOT_DIR, 'ae-customer.html');
const PITSTOP_FILE = path.join(ROOT_DIR, 'pitstop_client_showcase.html');
const NOTIFICATIONS_FILE = path.join(ROOT_DIR, 'ae_notifications_showcase.html');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  // Merchant UI (Primary route)
  if (pathname === '/' || pathname === '/merchant' || pathname === '/ae-merchant' || pathname === '/ae-merchant.html') {
    fs.readFile(MERCHANT_FILE, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Error reading AE Merchant HTML: ' + err.message);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Customer UI
  if (pathname === '/customer' || pathname === '/ae-customer' || pathname === '/ae-customer.html') {
    fs.readFile(CUSTOMER_FILE, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Error reading AE Customer HTML: ' + err.message);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Pitstop Showcase
  if (pathname === '/pitstop' || pathname === '/pitstop.html') {
    fs.readFile(PITSTOP_FILE, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Error reading Pitstop HTML: ' + err.message);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Notifications Showcase
  if (pathname === '/notifications' || pathname === '/notifications.html' || pathname === '/ae-notifications') {
    fs.readFile(NOTIFICATIONS_FILE, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Error reading Notifications HTML: ' + err.message);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Strip leading slashes to prevent resolving to drive root on Windows
  const relPath = pathname.replace(/^\/+/, '');
  const filePath = path.join(ROOT_DIR, relPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Read error: ' + err.message);
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  } else {
    // Default fallback to AE Merchant UI
    fs.readFile(MERCHANT_FILE, (err, data) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AE UI Server (Merchant & Customer) is LIVE at http://localhost:${PORT}/`);
});
