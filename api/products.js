const { sql, ensureSchema } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    await ensureSchema();
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM products ORDER BY name ASC`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const body = await readJson(req);
      const { name, price, unit = '', category = '' } = body || {};
      if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
      const { rows } = await sql`
        INSERT INTO products(name, price, unit, category)
        VALUES (${name}, ${Number(price)}, ${unit}, ${category})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    }
    if (req.method === 'PUT') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = Number(url.searchParams.get('id'));
      const body = await readJson(req);
      if (!id) return res.status(400).json({ error: 'id required' });
      const existing = (await sql`SELECT * FROM products WHERE id=${id}`).rows[0];
      if (!existing) return res.status(404).json({ error: 'not found' });
      const name = body?.name ?? existing.name;
      const price = body?.price ?? existing.price;
      const unit = body?.unit ?? existing.unit;
      const category = body?.category ?? existing.category;
      const { rows } = await sql`
        UPDATE products SET name=${name}, price=${Number(price)}, unit=${unit}, category=${category} WHERE id=${id}
        RETURNING *`;
      return res.status(200).json(rows[0]);
    }
    if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = Number(url.searchParams.get('id'));
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`DELETE FROM products WHERE id=${id}`;
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET,POST,PUT,DELETE');
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
