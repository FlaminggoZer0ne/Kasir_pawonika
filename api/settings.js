const { getSettings, setSettings } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const s = await getSettings();
      return res.status(200).json(s);
    }
    if (req.method === 'POST') {
      const body = await readJson(req);
      await setSettings(body || {});
      return res.status(200).json({ ok: true });
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
