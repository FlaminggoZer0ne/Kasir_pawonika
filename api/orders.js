const { sql, nextInvoice } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const body = await readJson(req);
      const { items, discount = 0, tax = 0, payment_method = 'CASH', paid_amount = 0, customer_name = '', note = '' } = body || {};
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' });
      const inv = await nextInvoice();
      const created_at = new Date();
      const subtotal = items.reduce((s, it) => s + (Number(it.price) * Number(it.qty)), 0);
      const total = Math.max(0, Math.round(subtotal - Number(discount) + Number(tax)));
      const result = await sql.begin(async (tx) => {
        const ord = (await tx`
          INSERT INTO orders(invoice_no, customer_name, created_at, subtotal, discount, tax, total, payment_method, paid_amount, note)
          VALUES (${inv}, ${customer_name}, ${created_at}, ${subtotal}, ${discount}, ${tax}, ${total}, ${payment_method}, ${paid_amount}, ${note})
          RETURNING *
        `).rows[0];
        for (const it of items) {
          await tx`
            INSERT INTO order_items(order_id, product_id, name, price, qty, subtotal)
            VALUES (${ord.id}, ${it.product_id || null}, ${it.name}, ${Number(it.price)}, ${Number(it.qty)}, ${Number(it.price) * Number(it.qty)})`;
        }
        return ord;
      });
      const orderItems = (await sql`SELECT * FROM order_items WHERE order_id=${result.id}`).rows;
      return res.status(201).json({ order: result, items: orderItems });
    }
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).end('Method Not Allowed');
  } catch (e) {
    return res.status(500).send(e.message || 'Server Error');
  }
};

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}
