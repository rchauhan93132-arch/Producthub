const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Data helpers ───────────────────────────────────────────────────────────
const DATA = {
  products: path.join(__dirname, 'data/products.json'),
  orders:   path.join(__dirname, 'data/orders.json'),
  staff:    path.join(__dirname, 'data/staff.json'),
};

function read(file)       { return JSON.parse(fs.readFileSync(DATA[file], 'utf8')); }
function write(file, data){ fs.writeFileSync(DATA[file], JSON.stringify(data, null, 2)); }

// ── Auth ───────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = 'admin123';
const lockoutStore   = {};   // ip → { attempts, lockedUntil }

app.post('/api/auth/login', (req, res) => {
  const ip  = req.ip;
  const now = Date.now();

  if (!lockoutStore[ip]) lockoutStore[ip] = { attempts: 0, lockedUntil: 0 };
  const rec = lockoutStore[ip];

  if (rec.lockedUntil > now) {
    const remaining = Math.ceil((rec.lockedUntil - now) / 1000);
    return res.status(429).json({ success: false, message: `Locked. Try again in ${remaining}s.`, remaining });
  }

  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    rec.attempts   = 0;
    rec.lockedUntil = 0;
    return res.json({ success: true, token: 'mgr-' + uuidv4() });
  }

  rec.attempts++;
  if (rec.attempts >= 3) {
    rec.lockedUntil = now + 60_000;
    rec.attempts    = 0;
    return res.status(401).json({ success: false, message: 'Too many attempts! Locked for 60s.', locked: true });
  }

  res.status(401).json({ success: false, message: `Wrong password. Attempt ${rec.attempts}/3.` });
});

// ── Products ───────────────────────────────────────────────────────────────
app.get('/api/products', (_req, res) => {
  res.json(read('products'));
});

app.post('/api/products', (req, res) => {
  const { name, price, quantity } = req.body;
  if (!name || price == null || quantity == null)
    return res.status(400).json({ success: false, message: 'Missing fields.' });

  const products = read('products');
  const existing = Object.keys(products).map(k => parseInt(k.slice(1))).sort((a,b)=>b-a);
  const nextNum  = (existing[0] || 100) + 1;
  const id       = 'P' + nextNum;

  products[id] = { name: name.trim(), price: +price, quantity: +quantity };
  write('products', products);
  res.json({ success: true, id, product: products[id] });
});

app.put('/api/products/:id', (req, res) => {
  const products = read('products');
  const { id }   = req.params;
  if (!products[id]) return res.status(404).json({ success: false, message: 'Product not found.' });

  const { name, price, quantity } = req.body;
  if (name     != null) products[id].name     = name.trim();
  if (price    != null) products[id].price    = +price;
  if (quantity != null) products[id].quantity = +quantity;

  write('products', products);
  res.json({ success: true, product: products[id] });
});

app.delete('/api/products/:id', (req, res) => {
  const products = read('products');
  const { id }   = req.params;
  if (!products[id]) return res.status(404).json({ success: false, message: 'Product not found.' });

  const name = products[id].name;
  delete products[id];
  write('products', products);
  res.json({ success: true, message: `"${name}" deleted.` });
});

// ── Staff ──────────────────────────────────────────────────────────────────
app.get('/api/staff', (_req, res) => {
  res.json(read('staff'));
});

// ── Orders ────────────────────────────────────────────────────────────────
app.get('/api/orders', (_req, res) => {
  res.json(read('orders'));
});

app.post('/api/orders', (req, res) => {
  const { customer, staffId, items } = req.body;
  if (!customer || !staffId || !items?.length)
    return res.status(400).json({ success: false, message: 'Missing order data.' });

  const products = read('products');
  const staff    = read('staff');

  if (!staff[staffId])
    return res.status(400).json({ success: false, message: 'Invalid staff ID.' });

  // Validate stock
  for (const item of items) {
    const p = products[item.id];
    if (!p)              return res.status(400).json({ success: false, message: `Product ${item.id} not found.` });
    if (p.quantity < item.qty) return res.status(400).json({ success: false, message: `Insufficient stock for ${p.name}.` });
  }

  // Deduct stock & build line items
  const lineItems = items.map(item => {
    const p = products[item.id];
    p.quantity -= item.qty;
    return { id: item.id, name: p.name, qty: item.qty, price: p.price };
  });

  write('products', products);

  const total = lineItems.reduce((s, i) => s + i.qty * i.price, 0);
  const order = {
    id:       'ORD-' + uuidv4().slice(0, 8).toUpperCase(),
    customer,
    staffId,
    staffName: staff[staffId],
    items:    lineItems,
    total,
    date:     new Date().toISOString(),
  };

  const orders = read('orders');
  orders.push(order);
  write('orders', orders);

  res.json({ success: true, order });
});

// ── Stats (dashboard) ─────────────────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
  const products = read('products');
  const orders   = read('orders');
  const staff    = read('staff');

  const totalProducts   = Object.keys(products).length;
  const inventoryValue  = Object.values(products).reduce((s, p) => s + p.price * p.quantity, 0);
  const lowStock        = Object.values(products).filter(p => p.quantity <= 10).length;
  const totalOrders     = orders.length;
  const totalRevenue    = orders.reduce((s, o) => s + o.total, 0);
  const staffCount      = Object.keys(staff).length;

  res.json({ totalProducts, inventoryValue, lowStock, totalOrders, totalRevenue, staffCount });
});

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`✅  ProductHub running → http://localhost:${PORT}`));
