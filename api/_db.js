// Ensure @vercel/postgres can find a connection string on Vercel
// Primary: POSTGRES_URL. Fallbacks: DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING
if (!process.env.POSTGRES_URL) {
  const fallback = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL_NO_SSL;
  if (fallback) process.env.POSTGRES_URL = fallback;
}
const { sql } = require('@vercel/postgres');

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      unit TEXT DEFAULT '',
      category TEXT DEFAULT ''
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      invoice_no TEXT NOT NULL UNIQUE,
      customer_name TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      tax INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      paid_amount INTEGER NOT NULL DEFAULT 0,
      note TEXT DEFAULT ''
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      subtotal INTEGER NOT NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `;
}

async function ensureSchema() {
  try {
    await sql`SELECT 1 FROM products LIMIT 1`;
    await sql`SELECT 1 FROM orders LIMIT 1`;
    await sql`SELECT 1 FROM order_items LIMIT 1`;
    await sql`SELECT 1 FROM settings LIMIT 1`;
  } catch (e) {
    // if products table missing, run full migrate
    if (String(e.message || e).includes('does not exist')) {
      await migrate();
    } else {
      throw e;
    }
  }
}

async function getSettings() {
  const { rows } = await sql`SELECT key, value FROM settings`;
  const obj = {}; rows.forEach(r => obj[r.key] = r.value); return obj;
}

async function setSettings(map) {
  const entries = Object.entries(map || {});
  for (const [k, v] of entries) {
    await sql`INSERT INTO settings(key, value) VALUES(${k}, ${String(v)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
}

async function nextInvoice() {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const prefix = (await sql`SELECT value FROM settings WHERE key='invoice_prefix'`).rows[0]?.value || 'INV';
  // simple sequence via settings invoice_counter
  const cntRow = (await sql`SELECT value FROM settings WHERE key='invoice_counter'`).rows[0];
  let n = Number(cntRow?.value || '1');
  const inv = `${prefix}-${ymd}-${String(n).padStart(4,'0')}`;
  n += 1;
  await sql`INSERT INTO settings(key, value) VALUES('invoice_counter', ${String(n)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return inv;
}

module.exports = { sql, migrate, ensureSchema, getSettings, setSettings, nextInvoice };
