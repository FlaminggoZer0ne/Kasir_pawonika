const { put } = require('@vercel/blob');
const { setSettings } = require('../_db');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).end('Method Not Allowed');
    }
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const filename = req.headers['x-filename'] || `logo-${Date.now()}`;

    const chunks = [];
    for await (const c of req) chunks.push(c);
    const buffer = Buffer.concat(chunks);
    if (!buffer.length) return res.status(400).json({ error: 'empty body' });

    const { url } = await put(`pawonika/${filename}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });

    await setSettings({ logo_url: url });
    return res.status(200).json({ ok: true, url });
  } catch (e) {
    return res.status(500).send(e.message || 'Server Error');
  }
};
