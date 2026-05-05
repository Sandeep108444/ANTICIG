/**
 * ANTICIG Auth Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * GET  /api/auth/me
 * PUT  /api/auth/me
 * POST /api/auth/logout
 */

const { createToken, requireAuth } = require('../middleware/auth');
const db = require('../db/database');

module.exports = function(router) {

  // ── Register ──────────────────────────────────────────────────────
  router.post('/auth/register', (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    if (!/\S+@\S+\.\S+/.test(email))
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    if (db.findOne('users', { email: email.toLowerCase() }))
      return res.status(409).json({ success: false, message: 'Email already registered' });

    const user = db.insert('users', {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: db.hashPassword(password),
      role: 'customer',
      phone: phone || '',
      address: {},
      wishlist: []
    });

    const token = createToken({ userId: user.id, role: user.role });
    const { password: _, ...safe } = user;
    res.status(201).json({ success: true, message: 'Account created successfully', token, user: safe });
  });

  // ── Login ─────────────────────────────────────────────────────────
  router.post('/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = db.findOne('users', { email: email.toLowerCase().trim() });
    if (!user || !db.verifyPassword(password, user.password))
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = createToken({ userId: user.id, role: user.role });
    const { password: _, ...safe } = user;
    res.json({ success: true, message: 'Logged in successfully', token, user: safe });
  });

  // ── Get Profile ───────────────────────────────────────────────────
  router.get('/auth/me', requireAuth, (req, res) => {
    const { password: _, ...safe } = req.user;
    res.json({ success: true, user: safe });
  });

  // ── Update Profile ────────────────────────────────────────────────
  router.put('/auth/me', requireAuth, (req, res) => {
    const { name, phone, address } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (phone) updates.phone = phone;
    if (address) updates.address = address;

    const updated = db.update('users', req.user.id, updates);
    const { password: _, ...safe } = updated;
    res.json({ success: true, message: 'Profile updated', user: safe });
  });

  // ── Change Password ───────────────────────────────────────────────
  router.put('/auth/password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both passwords required' });
    if (!db.verifyPassword(currentPassword, req.user.password))
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });

    db.update('users', req.user.id, { password: db.hashPassword(newPassword) });
    res.json({ success: true, message: 'Password updated successfully' });
  });
};
