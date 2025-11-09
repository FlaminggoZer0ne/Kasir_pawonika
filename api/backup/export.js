const { sql } = require('../../api/_db');

module.exports = async function handler(req, res) {
  try {
    const products = (await sql`SELECT * FROM products`).rows;
    const orders = (await sql`SELECT * FROM orders`).rows;
    const order_items = (await sql`SELECT * FROM order_items`).rows;
    const settings = (await sql`SELECT * FROM settings`).rows;
    res.status(200).json({ exported_at: new Date().toISOString(), products, orders, order_items, settings });
  } catch (e) {
    res.status(500).send(e.message || 'Server Error');
  }
};
