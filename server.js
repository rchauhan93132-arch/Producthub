const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Data paths
const DATA = {
  products: path.join(__dirname, 'products.json'),
  orders: path.join(__dirname, 'orders.json'),
  staff: path.join(__dirname, 'staff.json'),
};

// Read helper
function read(file) {
  return JSON.parse(fs.readFileSync(DATA[file], 'utf8'));
}

// Write helper
function write(file, data) {
  fs.writeFileSync(DATA[file], JSON.stringify(data, null, 2));
}

// Admin password
const ADMIN_PASSWORD = 'raj123';

// Login API
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    return res.json({
      success: true,
      token: uuidv4(),
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid password',
  });
});

// Products API
app.get('/api/products', (req, res) => {
  res.json(read('products'));
});

// Orders API
app.get('/api/orders', (req, res) => {
  res.json(read('orders'));
});

// Staff API
app.get('/api/staff', (req, res) => {
  res.json(read('staff'));
});

// Add Product
app.post('/api/products', (req, res) => {
  const products = read('products');

  const newProduct = {
    id: uuidv4(),
    ...req.body,
  };

  products.push(newProduct);
  write('products', products);

  res.json(newProduct);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
