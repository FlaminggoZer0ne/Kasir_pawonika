const { migrate } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).end('Method Not Allowed');
    }
    await migrate();
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).send(e.message || 'Server Error');
  }
};
