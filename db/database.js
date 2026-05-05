/**
 * ANTICIG Database Layer
 * JSON-file based persistent storage (no external dependencies)
 * Acts like a real DB with tables, queries, and transactions
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'anticig.json');

// ─── Default seed data ───────────────────────────────────────────────
const DEFAULT_DB = {
  users: [
    {
      id: 'usr_admin_001',
      name: 'Admin User',
      email: 'admin@anticig.com',
      password: hashPassword('Admin@1234'),
      role: 'admin',
      phone: '9876543210',
      address: { street: '12 MG Road', city: 'Ludhiana', state: 'Punjab', pincode: '141001' },
      wishlist: [],
      createdAt: new Date().toISOString()
    }
  ],
  products: [
    {
      id: 'prd_001', name: 'Obsidian Oversized Tee', slug: 'obsidian-oversized-tee',
      category: 'tshirts', gender: 'unisex', price: 1299, comparePrice: null,
      description: 'Ultra-soft 240 GSM heavyweight cotton. Dropped shoulders, boxy fit. Screen-printed ANTICIG graphic on chest.',
      images: ['https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=500&q=80'],
      colors: ['#0a0a0a', '#3a3a3a', '#e8e4dc'],
      sizes: ['S','M','L','XL'],
      stock: { S: 12, M: 20, L: 18, XL: 8 },
      tags: ['new', 'bestseller'], rating: 4.8, reviews: 47,
      featured: true, active: true, createdAt: new Date().toISOString()
    },
    {
      id: 'prd_002', name: 'Charcoal Cargo Jacket', slug: 'charcoal-cargo-jacket',
      category: 'jackets', gender: 'men', price: 3999, comparePrice: 4999,
      description: 'Technical cargo jacket with 8 pockets. Water-resistant ripstop shell, YKK zippers throughout.',
      images: ['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500&q=80'],
      colors: ['#2c2c2c', '#4a3728'],
      sizes: ['M','L','XL','XXL'],
      stock: { M: 5, L: 7, XL: 4, XXL: 2 },
      tags: ['sale'], rating: 4.6, reviews: 31,
      featured: true, active: true, createdAt: new Date().toISOString()
    },
    {
      id: 'prd_003', name: 'Velvet Wide-Leg Pants', slug: 'velvet-wide-leg-pants',
      category: 'bottoms', gender: 'women', price: 2499, comparePrice: null,
      description: 'Crushed velvet wide-leg trousers with a high waist and side pockets. Fully lined for comfort.',
      images: ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500&q=80'],
      colors: ['#1a1a2e', '#2d1b1b', '#c9a96e'],
      sizes: ['XS','S','M','L'],
      stock: { XS: 6, S: 10, M: 8, L: 5 },
      tags: ['new'], rating: 4.9, reviews: 22,
      featured: true, active: true, createdAt: new Date().toISOString()
    },
    {
      id: 'prd_004', name: 'Raw Edge Hoodie', slug: 'raw-edge-hoodie',
      category: 'hoodies', gender: 'unisex', price: 2799, comparePrice: null,
      description: 'Premium French Terry hoodie with intentionally raw hem edges. Relaxed fit, kangaroo pocket.',
      images: ['https://images.unsplash.com/photo-1617922001439-4a2e6562f328?w=500&q=80'],
      colors: ['#1c1c1c'],
      sizes: ['S','M','L','XL'],
      stock: { S: 0, M: 0, L: 0, XL: 0 },
      tags: ['sold-out'], rating: 4.7, reviews: 58,
      featured: true, active: true, createdAt: new Date().toISOString()
    },
    {
      id: 'prd_005', name: 'Contrast Stitch Shirt', slug: 'contrast-stitch-shirt',
      category: 'shirts', gender: 'men', price: 1899, comparePrice: null,
      description: 'Oversized oxford shirt with contrasting gold stitching. 100% Egyptian cotton.',
      images: ['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500&q=80'],
      colors: ['#f5f3ef', '#0a0a0a'],
      sizes: ['S','M','L','XL'],
      stock: { S: 8, M: 14, L: 11, XL: 6 },
      tags: [], rating: 4.5, reviews: 19,
      featured: false, active: true, createdAt: new Date().toISOString()
    },
    {
      id: 'prd_006', name: 'Asymmetric Midi Dress', slug: 'asymmetric-midi-dress',
      category: 'dresses', gender: 'women', price: 3299, comparePrice: 3999,
      description: 'Structured asymmetric neckline midi dress. Side slit, invisible zipper, fully lined.',
      images: ['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500&q=80'],
      colors: ['#0a0a0a', '#1a1a2e'],
      sizes: ['XS','S','M','L'],
      stock: { XS: 3, S: 6, M: 9, L: 4 },
      tags: ['sale', 'new'], rating: 4.8, reviews: 14,
      featured: false, active: true, createdAt: new Date().toISOString()
    }
  ],
  orders: [],
  carts: [],
  reviews: [],
  newsletter: [],
  collections: [
    { id: 'col_001', name: 'Noir Essentials', slug: 'noir-essentials', description: 'The darkest basics.', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80', count: 42, tag: 'New Season', active: true },
    { id: 'col_002', name: 'Urban Drift', slug: 'urban-drift', description: 'Street meets structure.', image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80', count: 18, tag: 'Limited Edition', active: true },
    { id: 'col_003', name: 'Signature Core', slug: 'signature-core', description: 'Everyday essentials.', image: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=600&q=80', count: 64, tag: 'Bestsellers', active: true }
  ]
};

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'anticig_salt_2026').digest('hex');
}

// ─── DB Engine ───────────────────────────────────────────────────────
class Database {
  constructor() {
    this.data = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        this.data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      } else {
        this.data = JSON.parse(JSON.stringify(DEFAULT_DB));
        this.save();
      }
    } catch (e) {
      this.data = JSON.parse(JSON.stringify(DEFAULT_DB));
      this.save();
    }
  }

  save() {
    fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2));
  }

  // Generic CRUD
  findAll(table, filter = {}) {
    let rows = this.data[table] || [];
    Object.entries(filter).forEach(([k, v]) => {
      rows = rows.filter(r => r[k] === v);
    });
    return rows;
  }

  findOne(table, filter) {
    return this.findAll(table, filter)[0] || null;
  }

  findById(table, id) {
    return (this.data[table] || []).find(r => r.id === id) || null;
  }

  insert(table, record) {
    if (!record.id) record.id = `${table.slice(0,3)}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    if (!record.createdAt) record.createdAt = new Date().toISOString();
    this.data[table].push(record);
    this.save();
    return record;
  }

  update(table, id, updates) {
    const idx = this.data[table].findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.data[table][idx] = { ...this.data[table][idx], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    return this.data[table][idx];
  }

  delete(table, id) {
    const idx = this.data[table].findIndex(r => r.id === id);
    if (idx === -1) return false;
    this.data[table].splice(idx, 1);
    this.save();
    return true;
  }

  count(table, filter = {}) {
    return this.findAll(table, filter).length;
  }

  // Password helpers
  hashPassword(p) { return hashPassword(p); }
  verifyPassword(plain, hashed) { return hashPassword(plain) === hashed; }

  // Analytics helper
  stats() {
    const orders = this.data.orders;
    const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
    return {
      totalUsers: this.data.users.filter(u => u.role !== 'admin').length,
      totalProducts: this.data.products.filter(p => p.active).length,
      totalOrders: orders.length,
      revenue,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      newsletterSubscribers: this.data.newsletter.length
    };
  }
}

module.exports = new Database();
module.exports.hashPassword = hashPassword;
