const { sql } = require('../_db');

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const idStr = url.pathname.split('/').pop();
    const id = Number(idStr);
    if (!id) return res.status(400).json({ error: 'invalid id' });

    if (req.method === 'GET') {
      const row = (await sql`SELECT * FROM products WHERE id=${id}`).rows[0];
      if (!row) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(row);
    }

    if (req.method === 'PUT') {
      const body = await readJson(req);
      const existing = (await sql`SELECT * FROM products WHERE id=${id}`).rows[0];
      if (!existing) return res.status(404).json({ error: 'not found' });
      const name = body?.name ?? existing.name;
      const price = body?.price ?? existing.price;
      const unit = body?.unit ?? existing.unit;
      const category = body?.category ?? existing.category;
      const updated = (await sql`
        UPDATE products SET name=${name}, price=${Number(price)}, unit=${unit}, category=${category}
        WHERE id=${id}
        RETURNING *
      `).rows[0];
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM products WHERE id=${id}`;
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
