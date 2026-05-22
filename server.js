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

    if (file === 'products' || file === 'staff') {
      fs.writeFileSync(DATA[file], JSON.stringify({}));
    } else {
      fs.writeFileSync(DATA[file], JSON.stringify([]));
    }
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

    const id = 'P' + Date.now();

    products[id] = {
      name: req.body.name,
      price: Number(req.body.price),
      quantity: Number(req.body.quantity),
    };

    write('products', products);

    res.json({
      success: true,
      id,
      product: products[id],
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
    const id = req.params.id;

    if (!products[id]) {

      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });

    }

    products[id] = {
      name: req.body.name,
      price: Number(req.body.price),
      quantity: Number(req.body.quantity),
    };

    write('products', products);

    res.json({
      success: true,
      product: products[id],
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

    const products = read('products');
    const id = req.params.id;

    if (!products[id]) {

      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });

    }

    delete products[id];

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

      const product = products[item.id];

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

      // Reduce stock
      product.quantity -= item.qty;

      orderItems.push({
        id: item.id,
        name: product.name,
        price: product.price,
        qty: item.qty,
      });

      total += product.price * item.qty;

    }

    // Save updated products
    write('products', products);

    const order = {
      id: 'ORD-' + Date.now(),
      customer,
      staffId,
      staffName: staff[staffId] || 'Unknown',
      items: orderItems,
      total,
      date: new Date().toISOString(),
    };

    // Save order
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

    const totalProducts = Object.keys(products).length;

    let inventoryValue = 0;
    let lowStock = 0;

    Object.values(products).forEach(product => {

      inventoryValue += product.price * product.quantity;

      if (product.quantity <= 10) {
        lowStock++;
      }

    });

    const totalOrders = orders.length;

    let totalRevenue = 0;

    orders.forEach(order => {
      totalRevenue += order.total;
    });

    const staffCount = Object.keys(staff).length;

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
