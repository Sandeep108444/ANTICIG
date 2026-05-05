/**
 * ANTICIG Products Routes
 * GET  /api/products            - list with filter/sort/search/pagination
 * GET  /api/products/:id        - single product
 * GET  /api/products/slug/:slug - by slug
 * POST /api/products            - admin create
 * PUT  /api/products/:id        - admin update
 * DEL  /api/products/:id        - admin soft-delete
 * GET  /api/products/:id/reviews
 * POST /api/products/:id/reviews
 */

const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../db/database');

module.exports = function(router) {

  // ── List Products ─────────────────────────────────────────────────
  router.get('/products', (req, res) => {
    const { category, gender, tag, search, sort = 'createdAt', page = 1, limit = 12, featured } = req.query;
    let products = db.findAll('products', { active: true });

    if (category) products = products.filter(p => p.category === category);
    if (gender && gender !== 'all') products = products.filter(p => p.gender === gender || p.gender === 'unisex');
    if (tag) products = products.filter(p => p.tags.includes(tag));
    if (featured === 'true') products = products.filter(p => p.featured);
    if (search) {
      const q = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Sort
    products.sort((a, b) => {
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'rating') return b.rating - a.rating;
      if (sort === 'reviews') return b.reviews - a.reviews;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const total = products.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const items = products.slice(start, start + parseInt(limit));

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      products: items
    });
  });

  // ── Single Product ────────────────────────────────────────────────
  router.get('/products/:id', (req, res) => {
    const product = db.findById('products', req.params.id);
    if (!product || !product.active)
      return res.status(404).json({ success: false, message: 'Product not found' });

    const reviews = db.findAll('reviews', { productId: product.id });
    res.json({ success: true, product: { ...product, reviewList: reviews } });
  });

  // ── Product by Slug ───────────────────────────────────────────────
  router.get('/products/slug/:slug', (req, res) => {
    const product = db.findOne('products', { slug: req.params.slug, active: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  });

  // ── Admin: Create Product ─────────────────────────────────────────
  router.post('/products', requireAdmin, (req, res) => {
    const { name, price, category, gender, description, sizes, colors, stock, tags, comparePrice } = req.body;
    if (!name || !price || !category)
      return res.status(400).json({ success: false, message: 'Name, price and category required' });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const product = db.insert('products', {
      name, slug, category, gender: gender || 'unisex',
      price: parseFloat(price), comparePrice: comparePrice ? parseFloat(comparePrice) : null,
      description: description || '',
      images: req.body.images || [],
      colors: colors || [],
      sizes: sizes || [],
      stock: stock || {},
      tags: tags || [],
      rating: 0, reviews: 0, featured: false, active: true
    });
    res.status(201).json({ success: true, message: 'Product created', product });
  });

  // ── Admin: Update Product ─────────────────────────────────────────
  router.put('/products/:id', requireAdmin, (req, res) => {
    const product = db.findById('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const updated = db.update('products', req.params.id, req.body);
    res.json({ success: true, message: 'Product updated', product: updated });
  });

  // ── Admin: Delete Product ─────────────────────────────────────────
  router.delete('/products/:id', requireAdmin, (req, res) => {
    const product = db.findById('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    db.update('products', req.params.id, { active: false });
    res.json({ success: true, message: 'Product removed' });
  });

  // ── Reviews: Get ──────────────────────────────────────────────────
  router.get('/products/:id/reviews', (req, res) => {
    const reviews = db.findAll('reviews', { productId: req.params.id });
    res.json({ success: true, reviews });
  });

  // ── Reviews: Post ─────────────────────────────────────────────────
  router.post('/products/:id/reviews', requireAuth, (req, res) => {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ success: false, message: 'Rating must be 1–5' });
    if (!comment || comment.trim().length < 10)
      return res.status(400).json({ success: false, message: 'Comment must be at least 10 characters' });

    const product = db.findById('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Check if already reviewed
    const existing = db.findOne('reviews', { productId: product.id, userId: req.user.id });
    if (existing) return res.status(409).json({ success: false, message: 'You already reviewed this product' });

    const review = db.insert('reviews', {
      productId: product.id, userId: req.user.id,
      userName: req.user.name, rating: parseInt(rating), comment: comment.trim()
    });

    // Recalculate product rating
    const allReviews = db.findAll('reviews', { productId: product.id });
    const avgRating = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
    db.update('products', product.id, { rating: Math.round(avgRating * 10) / 10, reviews: allReviews.length });

    res.status(201).json({ success: true, message: 'Review submitted', review });
  });
};
