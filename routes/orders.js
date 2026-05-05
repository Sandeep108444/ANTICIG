/**
 * ANTICIG Orders Routes
 * GET  /api/orders             - user's orders
 * POST /api/orders             - place order
 * GET  /api/orders/:id         - order detail
 * PUT  /api/orders/:id/cancel  - cancel order
 * GET  /api/admin/orders       - admin: all orders
 * PUT  /api/admin/orders/:id   - admin: update status
 */

const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../db/database');

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `ACG-${ts}-${rand}`;
}

module.exports = function(router) {

  // ── Place Order ───────────────────────────────────────────────────
  router.post('/orders', requireAuth, (req, res) => {
    const { shippingAddress, paymentMethod = 'cod', items: reqItems } = req.body;

    if (!shippingAddress || !shippingAddress.street || !shippingAddress.city)
      return res.status(400).json({ success: false, message: 'Complete shipping address required' });

    // Get cart items (or use provided items for guest-like flow)
    const cart = db.findOne('carts', { userId: req.user.id });
    const items = (cart && cart.items.length > 0) ? cart.items : reqItems;
    if (!items || items.length === 0)
      return res.status(400).json({ success: false, message: 'Cart is empty' });

    // Validate stock & build order items
    const orderItems = [];
    for (const item of items) {
      const product = db.findById('products', item.productId);
      if (!product || !product.active)
        return res.status(400).json({ success: false, message: `Product ${item.name} is no longer available` });
      const available = product.stock[item.size] || 0;
      if (available < item.qty)
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name} (${item.size})` });
      orderItems.push({ ...item, currentPrice: product.price });
    }

    // Calculate totals
    const subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = subtotal >= 2999 ? 0 : 99;
    const total = subtotal + shipping;

    // Deduct stock
    for (const item of orderItems) {
      const product = db.findById('products', item.productId);
      const newStock = { ...product.stock, [item.size]: product.stock[item.size] - item.qty };
      const totalStock = Object.values(newStock).reduce((s, v) => s + v, 0);
      const tags = totalStock === 0
        ? [...product.tags.filter(t => t !== 'new'), 'sold-out']
        : product.tags.filter(t => t !== 'sold-out');
      db.update('products', item.productId, { stock: newStock, tags });
    }

    const order = db.insert('orders', {
      orderNumber: generateOrderNumber(),
      userId: req.user.id, userName: req.user.name, userEmail: req.user.email,
      items: orderItems, shippingAddress,
      paymentMethod, paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
      subtotal, shipping, total, status: 'confirmed',
      timeline: [{ status: 'confirmed', time: new Date().toISOString(), note: 'Order placed successfully' }]
    });

    // Clear cart
    if (cart) db.update('carts', cart.id, { items: [] });

    res.status(201).json({ success: true, message: 'Order placed successfully', order });
  });

  // ── My Orders ─────────────────────────────────────────────────────
  router.get('/orders', requireAuth, (req, res) => {
    const orders = db.findAll('orders', { userId: req.user.id })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, orders });
  });

  // ── Order Detail ──────────────────────────────────────────────────
  router.get('/orders/:id', requireAuth, (req, res) => {
    const order = db.findById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.userId !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Access denied' });
    res.json({ success: true, order });
  });

  // ── Cancel Order ──────────────────────────────────────────────────
  router.put('/orders/:id/cancel', requireAuth, (req, res) => {
    const order = db.findById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.userId !== req.user.id)
      return res.status(403).json({ success: false, message: 'Access denied' });
    if (['shipped', 'delivered', 'cancelled'].includes(order.status))
      return res.status(400).json({ success: false, message: `Cannot cancel a ${order.status} order` });

    // Restore stock
    for (const item of order.items) {
      const product = db.findById('products', item.productId);
      if (product) {
        const newStock = { ...product.stock, [item.size]: (product.stock[item.size] || 0) + item.qty };
        db.update('products', item.productId, { stock: newStock });
      }
    }

    const timeline = [...order.timeline, { status: 'cancelled', time: new Date().toISOString(), note: 'Cancelled by customer' }];
    const updated = db.update('orders', order.id, { status: 'cancelled', timeline });
    res.json({ success: true, message: 'Order cancelled', order: updated });
  });

  // ── Admin: All Orders ─────────────────────────────────────────────
  router.get('/admin/orders', requireAdmin, (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    let orders = db.findAll('orders', {}).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (status) orders = orders.filter(o => o.status === status);
    const total = orders.length;
    const items = orders.slice((page - 1) * limit, page * limit);
    res.json({ success: true, total, orders: items });
  });

  // ── Admin: Update Order Status ────────────────────────────────────
  router.put('/admin/orders/:id', requireAdmin, (req, res) => {
    const { status, note } = req.body;
    if (!ORDER_STATUSES.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    const order = db.findById('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const timeline = [...order.timeline, { status, time: new Date().toISOString(), note: note || `Status updated to ${status}` }];
    const updated = db.update('orders', order.id, { status, timeline });
    res.json({ success: true, message: 'Order updated', order: updated });
  });
};
