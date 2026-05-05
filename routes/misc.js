/**
 * ANTICIG Misc Routes
 * Wishlist, Newsletter, Collections, Admin Stats
 */

const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../db/database');

module.exports = function(router) {

  // ─── WISHLIST ─────────────────────────────────────────────────────
  router.get('/wishlist', requireAuth, (req, res) => {
    const ids = req.user.wishlist || [];
    const products = ids.map(id => db.findById('products', id)).filter(Boolean);
    res.json({ success: true, wishlist: products });
  });

  router.post('/wishlist/:productId', requireAuth, (req, res) => {
    const product = db.findById('products', req.params.productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const wishlist = req.user.wishlist || [];
    if (wishlist.includes(product.id))
      return res.status(409).json({ success: false, message: 'Already in wishlist' });

    db.update('users', req.user.id, { wishlist: [...wishlist, product.id] });
    res.json({ success: true, message: 'Added to wishlist' });
  });

  router.delete('/wishlist/:productId', requireAuth, (req, res) => {
    const wishlist = (req.user.wishlist || []).filter(id => id !== req.params.productId);
    db.update('users', req.user.id, { wishlist });
    res.json({ success: true, message: 'Removed from wishlist' });
  });

  // ─── NEWSLETTER ───────────────────────────────────────────────────
  router.post('/newsletter', (req, res) => {
    const { email } = req.body;
    if (!email || !/\S+@\S+\.\S+/.test(email))
      return res.status(400).json({ success: false, message: 'Valid email required' });

    if (db.findOne('newsletter', { email: email.toLowerCase() }))
      return res.status(409).json({ success: false, message: 'Already subscribed!' });

    db.insert('newsletter', { email: email.toLowerCase() });
    res.json({ success: true, message: 'Subscribed successfully! Check your email for 10% off.' });
  });

  router.delete('/newsletter', (req, res) => {
    const { email } = req.body;
    const entry = db.findOne('newsletter', { email: email?.toLowerCase() });
    if (!entry) return res.status(404).json({ success: false, message: 'Email not found' });
    db.delete('newsletter', entry.id);
    res.json({ success: true, message: 'Unsubscribed successfully' });
  });

  // ─── COLLECTIONS ──────────────────────────────────────────────────
  router.get('/collections', (req, res) => {
    const collections = db.findAll('collections', { active: true });
    res.json({ success: true, collections });
  });

  router.get('/collections/:slug', (req, res) => {
    const col = db.findOne('collections', { slug: req.params.slug, active: true });
    if (!col) return res.status(404).json({ success: false, message: 'Collection not found' });
    // Get products in this collection (simple: by category tag matching name)
    const products = db.findAll('products', { active: true })
      .filter(p => p.tags.includes(col.slug) || p.category.includes(col.slug.split('-')[0]));
    res.json({ success: true, collection: col, products });
  });

  // ─── ADMIN STATS ──────────────────────────────────────────────────
  router.get('/admin/stats', requireAdmin, (req, res) => {
    res.json({ success: true, stats: db.stats() });
  });

  router.get('/admin/users', requireAdmin, (req, res) => {
    const users = db.findAll('users', {}).map(u => { const { password: _, ...s } = u; return s; });
    res.json({ success: true, total: users.length, users });
  });

  router.get('/admin/newsletter', requireAdmin, (req, res) => {
    const subs = db.findAll('newsletter', {});
    res.json({ success: true, total: subs.length, subscribers: subs });
  });

  // ─── SEARCH ───────────────────────────────────────────────────────
  router.get('/search', (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2)
      return res.status(400).json({ success: false, message: 'Query must be at least 2 characters' });

    const query = q.toLowerCase();
    const products = db.findAll('products', { active: true }).filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.tags.some(t => t.includes(query))
    ).slice(0, 10);

    res.json({ success: true, query: q, results: products, total: products.length });
  });

  // ─── HEALTH ───────────────────────────────────────────────────────
  router.get('/health', (req, res) => {
    res.json({ success: true, status: 'online', brand: 'ANTICIG', version: '1.0.0', time: new Date().toISOString() });
  });
};
