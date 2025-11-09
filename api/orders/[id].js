const { sql, ensureSchema } = require('../_db');

module.exports = async function handler(req, res) {
  try {
    await ensureSchema();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const idStr = url.pathname.split('/').pop();
    const id = Number(idStr);
    if (!id) return res.status(400).json({ error: 'invalid id' });

    if (req.method === 'GET') {
      const order = (await sql`SELECT * FROM orders WHERE id=${id}`).rows[0];
      if (!order) return res.status(404).json({ error: 'not found' });
      const items = (await sql`SELECT * FROM order_items WHERE order_id=${id}`).rows;
      return res.status(200).json({ order, items });
    }

    if (req.method === 'PUT') {
      const body = await readJson(req);
      const existing = (await sql`SELECT * FROM orders WHERE id=${id}`).rows[0];
      if (!existing) return res.status(404).json({ error: 'not found' });
      const items = (await sql`SELECT subtotal FROM order_items WHERE order_id=${id}`).rows;
      const subtotal = items.reduce((s,r)=> s + Number(r.subtotal||0), 0);
      const discount = Number(body?.discount ?? existing.discount);
      const tax = Number(body?.tax ?? existing.tax);
      const total = Math.max(0, Math.round(subtotal - discount + tax));
      const payment_method = body?.payment_method ?? existing.payment_method;
      const paid_amount = Number(body?.paid_amount ?? existing.paid_amount);
      const customer_name = body?.customer_name ?? existing.customer_name;
      const note = body?.note ?? existing.note;
      const updated = (await sql`
        UPDATE orders SET customer_name=${customer_name}, subtotal=${subtotal}, discount=${discount},
          tax=${tax}, total=${total}, payment_method=${payment_method}, paid_amount=${paid_amount}, note=${note}
        WHERE id=${id} RETURNING *
      `).rows[0];
      return res.status(200).json({ order: updated, items: (await sql`SELECT * FROM order_items WHERE order_id=${id}`).rows });
    }

    if (req.method === 'DELETE') {
      await sql.begin(async (tx) => {
        await tx`DELETE FROM order_items WHERE order_id=${id}`;
        await tx`DELETE FROM orders WHERE id=${id}`;
      });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,PUT,DELETE');
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
