require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const https = require('https');
const multer = require('multer');
const { db, initDb, nextInvoice } = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ensure data dir exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ensure upload dir exists (inside public for direct serving)
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safe = 'logo' + ext;
    cb(null, safe);
  }
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use('/', express.static(path.join(__dirname, '..', 'public')));

initDb();

// Products CRUD
app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY name ASC').all();
  res.json(rows);
});

app.post('/api/products', (req, res) => {
  const { name, price, unit, category } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
  const info = db.prepare('INSERT INTO products(name, price, unit, category) VALUES (?,?,?,?)').run(name, price, unit || '', category || '');
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.put('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, price, unit, category } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE products SET name = ?, price = ?, unit = ?, category = ? WHERE id = ?')
    .run(name ?? existing.name, price ?? existing.price, unit ?? existing.unit, category ?? existing.category, id);
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.json(row);
});

app.delete('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Settings
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

app.post('/api/settings', (req, res) => {
  const entries = Object.entries(req.body || {});
  const upsert = db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const tx = db.transaction((list) => {
    for (const [k, v] of list) upsert.run(k, String(v));
  });
  tx(entries);
  res.json({ ok: true });
});

// Upload logo -> returns public URL
app.post('/api/upload/logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const rel = `/uploads/${req.file.filename}`;
  // save to settings
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run('logo_url', rel);
  res.json({ url: rel });
});

// Orders
app.get('/api/orders', (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY datetime(created_at) DESC').all();
  res.json(rows);
});

app.post('/api/orders', (req, res) => {
  const { items, discount = 0, tax = 0, payment_method = 'CASH', paid_amount = 0, customer_name = '', note = '' } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' });

  const inv = nextInvoice();
  const created_at = new Date().toISOString();
  const subtotal = items.reduce((s, it) => s + (Number(it.price) * Number(it.qty)), 0);
  const total = Math.max(0, Math.round(subtotal - Number(discount) + Number(tax)));

  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO orders(invoice_no, customer_name, created_at, subtotal, discount, tax, total, payment_method, paid_amount, note)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(inv, customer_name, created_at, subtotal, discount, tax, total, payment_method, paid_amount, note);
    const orderId = info.lastInsertRowid;
    const stmt = db.prepare('INSERT INTO order_items(order_id, product_id, name, price, qty, subtotal) VALUES (?,?,?,?,?,?)');
    for (const it of items) {
      stmt.run(orderId, it.product_id || null, it.name, Number(it.price), Number(it.qty), Number(it.price) * Number(it.qty));
    }
    return orderId;
  });

  const orderId = tx();
  const saved = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const savedItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  res.status(201).json({ order: saved, items: savedItems });
});

app.get('/api/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'not found' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  res.json({ order, items });
});

// Update order basic fields and recalc totals from existing items
app.put('/api/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  const subtotal = items.reduce((s, it) => s + Number(it.subtotal || 0), 0);
  const discount = Number(req.body?.discount ?? existing.discount);
  const tax = Number(req.body?.tax ?? existing.tax);
  const total = Math.max(0, Math.round(subtotal - discount + tax));
  const payment_method = req.body?.payment_method ?? existing.payment_method;
  const paid_amount = Number(req.body?.paid_amount ?? existing.paid_amount);
  const customer_name = req.body?.customer_name ?? existing.customer_name;
  const note = req.body?.note ?? existing.note;
  db.prepare(`UPDATE orders SET customer_name=?, subtotal=?, discount=?, tax=?, total=?, payment_method=?, paid_amount=?, note=? WHERE id=?`)
    .run(customer_name, subtotal, discount, tax, total, payment_method, paid_amount, note, id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.json({ order, items });
});

// Delete order and its items
app.delete('/api/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'not found' });
  const tx = db.transaction((oid) => {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
  });
  tx(id);
  res.json({ ok: true });
});

// Backup export
app.get('/api/backup/export', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  const orders = db.prepare('SELECT * FROM orders').all();
  const order_items = db.prepare('SELECT * FROM order_items').all();
  const settings = db.prepare('SELECT * FROM settings').all();
  res.json({ exported_at: new Date().toISOString(), products, orders, order_items, settings });
});

// Optional push to webhook URL
app.post('/api/backup/push', (req, res) => {
  const webhook = process.env.BACKUP_WEBHOOK;
  if (!webhook) return res.status(400).json({ error: 'BACKUP_WEBHOOK not configured' });
  const data = {
    exported_at: new Date().toISOString(),
    products: db.prepare('SELECT * FROM products').all(),
    orders: db.prepare('SELECT * FROM orders').all(),
    order_items: db.prepare('SELECT * FROM order_items').all(),
    settings: db.prepare('SELECT * FROM settings').all(),
  };
  const u = new URL(webhook);
  const payload = JSON.stringify(data);
  const opts = {
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname + (u.search || ''),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  const requestFn = u.protocol === 'https:' ? https.request : require('http').request;
  const r = requestFn(opts, (resp) => {
    let body = '';
    resp.on('data', (d) => (body += d));
    resp.on('end', () => {
      res.json({ ok: true, status: resp.statusCode, response: body.slice(0, 1000) });
    });
  });
  r.on('error', (e) => res.status(500).json({ error: e.message }));
  r.write(payload);
  r.end();
});

app.listen(PORT, () => {
  console.log(`Kasir Pawon Ika running at http://localhost:${PORT}`);
});
