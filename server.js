const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ================= HOME PAGE =================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ================= DATA FILES =================
const DATA = {
  products: path.join(__dirname, 'products.json'),
  orders: path.join(__dirname, 'orders.json'),
  staff: path.join(__dirname, 'staff.json'),
};

// ================= HELPERS =================
function read(file) {
  if (!fs.existsSync(DATA[file])) {
    fs.writeFileSync(DATA[file], JSON.stringify([]));
  }

  return JSON.parse(fs.readFileSync(DATA[file], 'utf8'));
}

function write(file, data) {
  fs.writeFileSync(DATA[file], JSON.stringify(data, null, 2));
}

// ================= ADMIN =================
const ADMIN_PASSWORD = 'raj123';

// ================= LOGIN API =================
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

// ================= PRODUCTS =================

// GET PRODUCTS
app.get('/api/products', (req, res) => {
  res.json(read('products'));
});

// ADD PRODUCT
app.post('/api/products', (req, res) => {
  try {
    const products = read('products');

    const newProduct = {
      id: uuidv4(),
      name: req.body.name,
      price: Number(req.body.price),
      quantity: Number(req.body.quantity),
    };

    products.push(newProduct);

    write('products', products);

    res.json({
      success: true,
      product: newProduct,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Failed to add product',
    });
  }
});

// UPDATE PRODUCT
app.put('/api/products/:id', (req, res) => {
  try {
    const products = read('products');
    const index = products.findIndex(p => p.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    products[index] = {
      ...products[index],
      name: req.body.name,
      price: Number(req.body.price),
      quantity: Number(req.body.quantity),
    };

    write('products', products);

    res.json({
      success: true,
      product: products[index],
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Failed to update product',
    });
  }
});

// DELETE PRODUCT
app.delete('/api/products/:id', (req, res) => {
  try {
    let products = read('products');

    products = products.filter(p => p.id !== req.params.id);

    write('products', products);

    res.json({
      success: true,
      message: 'Product deleted',
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
    });
  }
});

// ================= ORDERS =================

// GET ORDERS
app.get('/api/orders', (req, res) => {
  res.json(read('orders'));
});

// CREATE ORDER
app.post('/api/orders', (req, res) => {
  try {
    const { customer, staffId, items } = req.body;

    if (!customer || !staffId || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing order data',
      });
    }

    const products = read('products');
    const orders = read('orders');
    const staff = read('staff');

    let total = 0;
    const orderItems = [];

    for (const item of items) {

      const product = products.find(p => p.id === item.id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      if (product.quantity < item.qty) {
        return res.status(400).json({
          success: false,
          message: `${product.name} out of stock`,
        });
      }

      product.quantity -= item.qty;

      orderItems.push({
        id: product.id,
        name: product.name,
        price: product.price,
        qty: item.qty,
      });

      total += product.price * item.qty;
    }

    write('products', products);

    let staffName = staff[staffId];

    // if staff stored as array
    if (!staffName && Array.isArray(staff)) {
      const found = staff.find(s => s.id === staffId);
      if (found) {
        staffName = found.name;
      }
    }

    const order = {
      id: 'ORD-' + Date.now(),
      customer,
      staffId,
      staffName: staffName || 'Unknown',
      items: orderItems,
      total,
      date: new Date().toISOString(),
    };

    orders.push(order);

    write('orders', orders);

    res.json({
      success: true,
      order,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Checkout failed',
    });
  }
});

// ================= STAFF =================

// GET STAFF
app.get('/api/staff', (req, res) => {
  res.json(read('staff'));
});

// ================= STATS =================
app.get('/api/stats', (req, res) => {
  try {
    const products = read('products');
    const orders = read('orders');
    const staff = read('staff');

    const totalProducts = products.length;

    const inventoryValue = products.reduce(
      (sum, p) => sum + (p.price * p.quantity),
      0
    );

    const lowStock = products.filter(p => p.quantity <= 10).length;

    const totalOrders = orders.length;

    const totalRevenue = orders.reduce(
      (sum, o) => sum + o.total,
      0
    );

    const staffCount = Array.isArray(staff)
      ? staff.length
      : Object.keys(staff).length;

    res.json({
      totalProducts,
      inventoryValue,
      lowStock,
      totalOrders,
      totalRevenue,
      staffCount,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Failed to load stats',
    });
  }
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`✅ ProductHub running on port ${PORT}`);
});
