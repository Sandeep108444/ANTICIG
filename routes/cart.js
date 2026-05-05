/**
 * ANTICIG Cart Routes
 * GET    /api/cart           - get cart
 * POST   /api/cart           - add item
 * PUT    /api/cart/:itemId   - update quantity
 * DELETE /api/cart/:itemId   - remove item
 * DELETE /api/cart           - clear cart
 */

const { requireAuth } = require('../middleware/auth');
const db = require('../db/database');

function getOrCreateCart(userId) {
  let cart = db.findOne('carts', { userId });
  if (!cart) cart = db.insert('carts', { userId, items: [] });
  return cart;
}

function calcCart(cart) {
  const items = cart.items || [];
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal >= 2999 ? 0 : 99;
  const total = subtotal + shipping;
  return { ...cart, subtotal, shipping, total, itemCount: items.reduce((s, i) => s + i.qty, 0) };
}

module.exports = function(router) {

  // ── Get Cart ──────────────────────────────────────────────────────
  router.get('/cart', requireAuth, (req, res) => {
    const cart = getOrCreateCart(req.user.id);
    res.json({ success: true, cart: calcCart(cart) });
  });

  // ── Add to Cart ───────────────────────────────────────────────────
  router.post('/cart', requireAuth, (req, res) => {
    const { productId, size, color, qty = 1 } = req.body;
    if (!productId || !size)
      return res.status(400).json({ success: false, message: 'Product ID and size required' });

    const product = db.findById('products', productId);
    if (!product || !product.active)
      return res.status(404).json({ success: false, message: 'Product not found' });

    const stockQty = product.stock[size] || 0;
    if (stockQty === 0)
      return res.status(400).json({ success: false, message: 'This size is out of stock' });

    const cart = getOrCreateCart(req.user.id);
    const itemKey = `${productId}_${size}_${color || 'default'}`;
    const existing = cart.items.find(i => i.key === itemKey);

    if (existing) {
      const newQty = existing.qty + parseInt(qty);
      if (newQty > stockQty) return res.status(400).json({ success: false, message: `Only ${stockQty} available` });
      existing.qty = newQty;
    } else {
      cart.items.push({
        key: itemKey, productId, name: product.name,
        image: product.images[0] || '', size, color: color || null,
        price: product.price, comparePrice: product.comparePrice,
        qty: parseInt(qty)
      });
    }

    db.update('carts', cart.id, { items: cart.items });
    res.json({ success: true, message: 'Added to cart', cart: calcCart(cart) });
  });

  // ── Update Cart Item ──────────────────────────────────────────────
  router.put('/cart/:itemKey', requireAuth, (req, res) => {
    const { qty } = req.body;
    if (!qty || qty < 1)
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });

    const cart = getOrCreateCart(req.user.id);
    const item = cart.items.find(i => i.key === req.params.itemKey);
    if (!item) return res.status(404).json({ success: false, message: 'Item not in cart' });

    const product = db.findById('products', item.productId);
    const stockQty = product?.stock[item.size] || 0;
    if (parseInt(qty) > stockQty)
      return res.status(400).json({ success: false, message: `Only ${stockQty} available` });

    item.qty = parseInt(qty);
    db.update('carts', cart.id, { items: cart.items });
    res.json({ success: true, message: 'Cart updated', cart: calcCart(cart) });
  });

  // ── Remove Cart Item ──────────────────────────────────────────────
  router.delete('/cart/:itemKey', requireAuth, (req, res) => {
    const cart = getOrCreateCart(req.user.id);
    cart.items = cart.items.filter(i => i.key !== req.params.itemKey);
    db.update('carts', cart.id, { items: cart.items });
    res.json({ success: true, message: 'Item removed', cart: calcCart(cart) });
  });

  // ── Clear Cart ────────────────────────────────────────────────────
  router.delete('/cart', requireAuth, (req, res) => {
    const cart = getOrCreateCart(req.user.id);
    db.update('carts', cart.id, { items: [] });
    res.json({ success: true, message: 'Cart cleared', cart: calcCart({ ...cart, items: [] }) });
  });
};
