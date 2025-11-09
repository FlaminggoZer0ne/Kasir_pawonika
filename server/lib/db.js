const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', '..', 'data', 'pawonika.db');
// Ensure the data directory exists before opening the database
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      unit TEXT DEFAULT '',
      category TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,
      customer_name TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      tax INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      paid_amount INTEGER NOT NULL DEFAULT 0,
      note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      subtotal INTEGER NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_items_order_id ON order_items(order_id);
  `);

  // Default settings
  const existing = db.prepare('SELECT COUNT(1) as c FROM settings').get();
  if (existing.c === 0) {
    const insert = db.prepare('INSERT INTO settings(key, value) VALUES (?, ?)');
    insert.run('store_name', 'Pawon Ika');
    insert.run('store_address', '');
    insert.run('store_phone', '');
    insert.run('invoice_prefix', 'INV');
    insert.run('invoice_counter', '1');
    insert.run('paper_width', '58');
  }
}

function nextInvoice() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('invoice_counter');
  const prefixRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('invoice_prefix');
  const n = Number(row?.value || '1');
  const prefix = prefixRow?.value || 'INV';
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const num = String(n).padStart(4,'0');
  const inv = `${prefix}-${ymd}-${num}`;
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('invoice_counter', String(n + 1));
  return inv;
}

module.exports = { db, initDb, nextInvoice };
