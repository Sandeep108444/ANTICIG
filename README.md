# ANTICIG Backend API

Full REST API for the ANTICIG clothing website. **Zero external dependencies** — runs on Node.js built-ins only.

## Quick Start

```bash
cd anticig-backend
node server.js
```

Server starts at **http://localhost:3000**

---

## Default Admin Credentials

| Field    | Value              |
|----------|--------------------|
| Email    | admin@anticig.com  |
| Password | Admin@1234         |
| Role     | admin              |

---

## API Reference

### Base URL
```
http://localhost:3000/api
```

### Authentication
All protected routes require:
```
Authorization: Bearer <token>
```

---

## Auth Endpoints

### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Priya Mehta",
  "email": "priya@email.com",
  "password": "mypassword"
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "priya@email.com",
  "password": "mypassword"
}
```
Returns: `{ token, user }`

### Get Profile
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Update Profile
```http
PUT /api/auth/me
Authorization: Bearer <token>

{
  "name": "Priya Sharma",
  "phone": "9876543210",
  "address": {
    "street": "12 MG Road",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }
}
```

### Change Password
```http
PUT /api/auth/password
Authorization: Bearer <token>

{
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}
```

---

## Products Endpoints

### List Products
```http
GET /api/products?category=jackets&gender=men&tag=new&sort=price_asc&page=1&limit=12&featured=true
```

**Query params:**
| Param    | Values                                           |
|----------|--------------------------------------------------|
| category | tshirts, jackets, hoodies, bottoms, shirts, dresses |
| gender   | men, women, unisex, all                          |
| tag      | new, sale, sold-out, bestseller                  |
| sort     | createdAt, price_asc, price_desc, rating, reviews |
| featured | true                                             |
| search   | any string                                       |
| page     | number (default 1)                               |
| limit    | number (default 12)                              |

### Get Single Product
```http
GET /api/products/:id
GET /api/products/slug/:slug
```

### Search
```http
GET /api/search?q=jacket
```

### Get Reviews
```http
GET /api/products/:id/reviews
```

### Post Review (auth required)
```http
POST /api/products/:id/reviews
Authorization: Bearer <token>

{
  "rating": 5,
  "comment": "Absolutely love this jacket! Great quality."
}
```

### Create Product (admin only)
```http
POST /api/products
Authorization: Bearer <admin-token>

{
  "name": "Structured Blazer",
  "price": 5999,
  "comparePrice": 7499,
  "category": "jackets",
  "gender": "women",
  "description": "Tailored blazer with peak lapels.",
  "sizes": ["XS", "S", "M", "L"],
  "colors": ["#0a0a0a", "#f5f3ef"],
  "stock": { "XS": 5, "S": 8, "M": 10, "L": 6 },
  "tags": ["new"],
  "images": ["https://..."]
}
```

### Update / Delete Product (admin only)
```http
PUT    /api/products/:id   { ...fields }
DELETE /api/products/:id
```

---

## Cart Endpoints (auth required)

### Get Cart
```http
GET /api/cart
Authorization: Bearer <token>
```
Returns cart with `subtotal`, `shipping` (free over ₹2999), `total`, `itemCount`

### Add to Cart
```http
POST /api/cart
Authorization: Bearer <token>

{
  "productId": "prd_001",
  "size": "M",
  "color": "#0a0a0a",
  "qty": 2
}
```

### Update Item Quantity
```http
PUT /api/cart/:itemKey
Authorization: Bearer <token>

{ "qty": 3 }
```
*itemKey format: `productId_size_color` e.g. `prd_001_M_default`*

### Remove Item
```http
DELETE /api/cart/:itemKey
Authorization: Bearer <token>
```

### Clear Cart
```http
DELETE /api/cart
Authorization: Bearer <token>
```

---

## Orders Endpoints

### Place Order
```http
POST /api/orders
Authorization: Bearer <token>

{
  "shippingAddress": {
    "street": "12 MG Road",
    "city": "Ludhiana",
    "state": "Punjab",
    "pincode": "141001"
  },
  "paymentMethod": "cod"
}
```
*Uses current cart items. Automatically deducts stock.*

### My Orders
```http
GET /api/orders
Authorization: Bearer <token>
```

### Order Detail
```http
GET /api/orders/:id
Authorization: Bearer <token>
```

### Cancel Order
```http
PUT /api/orders/:id/cancel
Authorization: Bearer <token>
```
*Cannot cancel shipped/delivered orders. Restores stock.*

### Admin: All Orders
```http
GET /api/admin/orders?status=pending&page=1
Authorization: Bearer <admin-token>
```

### Admin: Update Order Status
```http
PUT /api/admin/orders/:id
Authorization: Bearer <admin-token>

{
  "status": "shipped",
  "note": "Dispatched via BlueDart, tracking: BD123456"
}
```
Valid statuses: `pending` → `confirmed` → `processing` → `shipped` → `delivered` | `cancelled`

---

## Wishlist Endpoints (auth required)

```http
GET    /api/wishlist
POST   /api/wishlist/:productId
DELETE /api/wishlist/:productId
```

---

## Other Endpoints

### Newsletter
```http
POST   /api/newsletter   { "email": "you@email.com" }
DELETE /api/newsletter   { "email": "you@email.com" }
```

### Collections
```http
GET /api/collections
GET /api/collections/:slug
```

### Admin Dashboard
```http
GET /api/admin/stats        → { totalUsers, totalOrders, revenue, pendingOrders, ... }
GET /api/admin/users        → all users (no passwords)
GET /api/admin/newsletter   → subscribers list
```

### Health Check
```http
GET /api/health
```

---

## Data Storage

All data is stored in `anticig-backend/anticig.json` (auto-created on first run). This is a structured JSON database with tables: `users`, `products`, `orders`, `carts`, `reviews`, `newsletter`, `collections`.

---

## Architecture

```
anticig-backend/
├── server.js          ← HTTP server + router (pure Node.js)
├── db/
│   └── database.js    ← JSON database engine (CRUD, persistence)
├── middleware/
│   └── auth.js        ← JWT (HS256) using Node crypto
├── routes/
│   ├── auth.js        ← Register, login, profile
│   ├── products.js    ← Products + reviews CRUD
│   ├── cart.js        ← Cart management
│   ├── orders.js      ← Order lifecycle
│   └── misc.js        ← Wishlist, newsletter, collections, admin
└── anticig.json       ← Auto-generated database file
```

---

## Security Notes

- Passwords are SHA-256 hashed with a salt
- JWTs expire in 24 hours
- Admin routes are role-protected
- Stock is validated before cart add and order placement
- CORS is enabled for frontend development

---

*ANTICIG Backend — Made in Ludhiana, Punjab 🇮🇳*
# ANTICIG

ANTICIG is a clothing website with frontend and backend deployed on Render.

## Live Website

https://anticig.onrender.com

## API Health Check

https://anticig.onrender.com/api/health

## Admin Login

Email: admin@anticig.com  
Password: Admin@1234
