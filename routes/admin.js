const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const supabase = require('../supabase'); // Import Supabase client

// File upload setup
const storage = multer.diskStorage({
  destination: './Uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Images only (jpeg, jpg, png)'));
  },
});

// Serve static files (optional, for local testing)
router.use('/Uploads', express.static(path.join(__dirname, '../Uploads')));

// Get all orders
router.get('/orders', async (req, res) => {
  try {
    console.log('GET /api/admin/orders called');
    const result = await pool.query(`
      SELECT o.id, o.items, o.notes, o.status, o.created_at, t.table_number
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE o.status != 'Cancelled'
      AND DATE(o.created_at) = CURRENT_DATE
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order history
router.get('/orderhistory', async (req, res) => {
  try {
    console.log('GET /api/admin/orderhistory called');
    const result = await pool.query(`
      SELECT o.id, o.items, o.notes, o.status, o.created_at, t.table_number
      FROM orderhistory o
      JOIN tables t ON o.table_id = t.id
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching order history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all tables
router.get('/tables', async (req, res) => {
  try {
    console.log('GET /api/admin/tables called');
    const result = await pool.query('SELECT id, table_number FROM tables');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a table
router.post('/tables', async (req, res) => {
  const { table_number } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tables (table_number, qr_token) VALUES ($1, gen_random_uuid()) RETURNING *',
      [table_number]
    );
    console.log(`Created table: ${table_number}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a table
router.put('/tables/:id', async (req, res) => {
  const { id } = req.params;
  const { table_number } = req.body;
  try {
    const result = await pool.query(
      'UPDATE tables SET table_number = $1 WHERE id = $2 RETURNING *',
      [table_number, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    console.log(`Updated table ${id} to ${table_number}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating table:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a table
router.delete('/tables/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM tables WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    console.log(`Deleted table ${id}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate QR code
router.get('/qr/:tableNumber', async (req, res) => {
  const { tableNumber } = req.params;
  try {
    const tableResult = await pool.query(
      'SELECT * FROM tables WHERE table_number = $1',
      [tableNumber]
    );
    let qr_token;
    if (tableResult.rows.length === 0) {
      const newTable = await pool.query(
        'INSERT INTO tables (table_number, qr_token) VALUES ($1, gen_random_uuid()) RETURNING *',
        [tableNumber]
      );
      qr_token = newTable.rows[0].qr_token;
    } else {
      qr_token = tableResult.rows[0].qr_token;
    }
    const qrUrl = `https://shalpal.netlify.app/?table=${tableNumber}&token=${qr_token}`;
    const qrCodeImage = await QRCode.toDataURL(qrUrl);
    console.log(`Generated QR code for table ${tableNumber}: ${qrUrl}`);
    res.json({ qrCodeImage });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.put('/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, staff_name, payment_method } = req.body;
  console.log(`PUT /api/admin/orders/${id}/status called with status: ${status}`);
  if (!['New', 'In Process', 'Paid', 'Cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });

    // If status is Paid, insert into orderhistory
    if (status === 'Paid') {
      const order = result.rows[0];
      await pool.query(
        `INSERT INTO orderhistory (table_id, items, notes, status, created_at, order_type, staff_name, payment_method, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          order.table_id,
          order.items,
          order.notes,
          status,
          order.created_at,
          order.order_type,
          staff_name || null,
          payment_method || null,
        ]
      );
      console.log(`Inserted order ${id} into orderhistory`);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get completed orders (grouped by table and completion event)
router.get('/completed-orders', async (req, res) => {
  try {
    console.log('GET /api/admin/completed-orders called');
    const result = await pool.query(`
      SELECT 
        oh.table_id,
        t.table_number,
        oh.order_type,
        oh.staff_name,
        oh.payment_method,
        oh.completed_at,
        jsonb_agg(oh.items) as items,
        SUM(
          (SELECT SUM(CAST((item->>'price') AS FLOAT) * CAST((item->>'count') AS INTEGER))
           FROM jsonb_array_elements(oh.items) as item)
        ) as total_amount
      FROM orderhistory oh
      JOIN tables t ON oh.table_id = t.id
      WHERE oh.status = 'Paid'
      GROUP BY oh.table_id, t.table_number, oh.order_type, oh.staff_name, oh.payment_method, oh.completed_at
      ORDER BY oh.completed_at DESC
    `);
    res.json(result.rows.map(row => ({
      ...row,
      items: row.items.reduce((acc, items) => [...acc, ...items], []), // Flatten items
      total_amount: parseFloat(row.total_amount).toFixed(2),
    })));
  } catch (error) {
    console.error('Error fetching completed orders:', error);
    res.status(500).json({ error: error.message });
  }
});


// Cancel order
router.delete('/orders/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`DELETE /api/admin/orders/${id} called`);
  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      ['Cancelled', id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update order items
router.put('/orders/:id', async (req, res) => {
  const { id } = req.params;
  const { items } = req.body;
  console.log(`PUT /api/admin/orders/${id} called with items:`, items);
  try {
    const result = await pool.query(
      'UPDATE orders SET items = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(items), id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all meat options
router.get('/meat-options', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM meat_options');
    console.log('Fetched meat options:', result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching meat options:', error);
    res.status(500).json({ error: error.message });
  }
});

// Menu items CRUD
router.get('/menu-items', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT mi.*, ARRAY_AGG(mo.name) as meat_options
      FROM menu_items mi
      LEFT JOIN menu_item_meat_options mimo ON mi.id = mimo.menu_item_id
      LEFT JOIN meat_options mo ON mimo.meat_option_id = mo.id
      GROUP BY mi.id
    `);
    console.log('Fetched menu items:', result.rows);
    res.json(result.rows.map(item => ({
      ...item,
      meat_options: item.meat_options.filter(opt => opt !== null) // Remove nulls from ARRAY_AGG
    })));
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/menu-items', upload.single('imageFile'), async (req, res) => {
  const { name, price, description, category, meats, imageUrl } = req.body;
  let image = '';

  try {
    // Handle image: prioritize file upload, then URL
    if (req.file) {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const { data, error } = await supabase.storage
        .from('menu-images')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      // Get public URL
      image = `${process.env.SUPABASE_URL}/storage/v1/object/public/menu-images/${fileName}`;
    } else if (imageUrl) {
      // Use provided URL
      image = imageUrl;
    }

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    // Insert into menu_items
    const itemResult = await pool.query(
      'INSERT INTO menu_items (name, price, description, category, image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, price, description || '', category || '', image]
    );
    const itemId = itemResult.rows[0].id;

    // Handle meat options
    if (meats) {
      const meatNames = JSON.parse(meats);
      for (const meat of meatNames) {
        const meatResult = await pool.query('SELECT id FROM meat_options WHERE name = $1', [meat]);
        if (meatResult.rows.length) {
          await pool.query(
            'INSERT INTO menu_item_meat_options (menu_item_id, meat_option_id) VALUES ($1, $2)',
            [itemId, meatResult.rows[0].id]
          );
        }
      }
    }

    // Fetch the complete item with meat options
    const finalResult = await pool.query(`
      SELECT mi.*, ARRAY_AGG(mo.name) as meat_options
      FROM menu_items mi
      LEFT JOIN menu_item_meat_options mimo ON mi.id = mimo.menu_item_id
      LEFT JOIN meat_options mo ON mimo.meat_option_id = mo.id
      WHERE mi.id = $1
      GROUP BY mi.id
    `, [itemId]);

    console.log(`Created menu item: ${name}`);
    res.status(201).json({
      ...finalResult.rows[0],
      meat_options: finalResult.rows[0].meat_options.filter(opt => opt !== null)
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/menu-items/:id', upload.single('imageFile'), async (req, res) => {
  const { id } = req.params;
  const { name, price, description, category, meats, imageUrl } = req.body;
  let image = '';

  try {
    // Handle image: prioritize file upload, then URL, then existing image
    if (req.file) {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const { data, error } = await supabase.storage
        .from('menu-images')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (error) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      // Get public URL
      image = `${process.env.SUPABASE_URL}/storage/v1/object/public/menu-images/${fileName}`;
    } else if (imageUrl) {
      // Use provided URL
      image = imageUrl;
    } else {
      // Keep existing image
      const existingItem = await pool.query('SELECT image FROM menu_items WHERE id = $1', [id]);
      image = existingItem.rows[0]?.image || '';
    }

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    // Update menu_items
    const itemResult = await pool.query(
      'UPDATE menu_items SET name = $1, price = $2, description = $3, category = $4, image = $5 WHERE id = $6 RETURNING *',
      [name, price, description || '', category || '', image, id]
    );
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Update meat options
    await pool.query('DELETE FROM menu_item_meat_options WHERE menu_item_id = $1', [id]);
    if (meats) {
      const meatNames = JSON.parse(meats);
      for (const meat of meatNames) {
        const meatResult = await pool.query('SELECT id FROM meat_options WHERE name = $1', [meat]);
        if (meatResult.rows.length) {
          await pool.query(
            'INSERT INTO menu_item_meat_options (menu_item_id, meat_option_id) VALUES ($1, $2)',
            [id, meatResult.rows[0].id]
          );
        }
      }
    }

    // Fetch the complete item with meat options
    const finalResult = await pool.query(`
      SELECT mi.*, ARRAY_AGG(mo.name) as meat_options
      FROM menu_items mi
      LEFT JOIN menu_item_meat_options mimo ON mi.id = mimo.menu_item_id
      LEFT JOIN meat_options mo ON mimo.meat_option_id = mo.id
      WHERE mi.id = $1
      GROUP BY mi.id
    `, [id]);

    console.log(`Updated menu item ${id}`);
    res.json({
      ...finalResult.rows[0],
      meat_options: finalResult.rows[0].meat_options.filter(opt => opt !== null)
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/menu-items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Delete from menu_item_meat_options
    await pool.query('DELETE FROM menu_item_meat_options WHERE menu_item_id = $1', [id]);

    // Delete from menu_items
    const result = await pool.query(
      'DELETE FROM menu_items WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    console.log(`Deleted menu item ${id}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sales/income', async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    const query = `
      SELECT COALESCE(SUM(CAST((item->>'price') AS FLOAT) * CAST((item->>'count') AS INTEGER)), 0) as total_income
      FROM orders o, jsonb_array_elements(o.items) as item
      WHERE o.status = 'Paid'
      AND o.created_at BETWEEN $1 AND $2
    `;
    const result = await pool.query(query, [start_date, end_date]);
    console.log('Fetched total income:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching income:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sales/popular-items', async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    const query = `
      SELECT item->>'name' as item_name, SUM(CAST((item->>'count') AS INTEGER)) as total_ordered
      FROM orders o, jsonb_array_elements(o.items) as item
      WHERE o.status = 'Paid'
      AND o.created_at BETWEEN $1 AND $2
      GROUP BY item->>'name'
      ORDER BY total_ordered DESC
      LIMIT 10
    `;
    const result = await pool.query(query, [start_date, end_date]);
    console.log('Fetched popular items:', result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching popular items:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sales/order-types', async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    const query = `
      SELECT COALESCE(o.order_type, 'Dine-in') as order_type, COUNT(*) as order_count
      FROM orders o
      WHERE o.status = 'Paid'
      AND o.created_at BETWEEN $1 AND $2
      GROUP BY o.order_type
    `;
    const result = await pool.query(query, [start_date, end_date]);
    console.log('Fetched order types:', result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching popular meats:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sales/popular-meats', async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    const query = `
      SELECT option as meat_name, COUNT(*) as total_ordered
      FROM orders o, jsonb_array_elements(o.items) as item, jsonb_array_elements_text(item->'options') as option
      WHERE o.status = 'Paid'
      AND o.created_at BETWEEN $1 AND $2
      GROUP BY option
      ORDER BY total_ordered DESC
    `;
    const result = await pool.query(query, [start_date, end_date]);
    console.log('Fetched popular meats:', result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching popular meats:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sales/trends', async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    const query = `
      SELECT DATE(o.created_at) as sale_date, 
             COALESCE(SUM(CAST((item->>'price') AS FLOAT) * CAST((item->>'count') AS INTEGER)), 0) as daily_income
      FROM orders o, jsonb_array_elements(o.items) as item
      WHERE o.status = 'Paid'
      AND o.created_at BETWEEN $1 AND $2
      GROUP BY DATE(o.created_at)
      ORDER BY sale_date
    `;
    const result = await pool.query(query, [start_date, end_date]);
    console.log('Fetched sales trends:', result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sales trends:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders', async (req, res) => {
  const { table_id, items, notes } = req.body;
  if (!table_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Table ID and items are required' });
  }
  try {
    // Validate table_id and get table_number
    const tableResult = await pool.query('SELECT id, table_number FROM tables WHERE id = $1', [table_id]);
    if (tableResult.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    const tableNumber = tableResult.rows[0].table_number;

    // Determine order_type based on table_number
    let order_type;
    if (tableNumber.toLowerCase() === 'take-away') {
      order_type = 'Take-away';
    } else if (tableNumber.toLowerCase() === 'delivery') {
      order_type = 'Delivery';
    } else {
      order_type = 'Dine-in';
    }

    // Validate items and meat options
    for (const item of items) {
      const menuItem = await pool.query('SELECT id, name, price FROM menu_items WHERE id = $1', [item.id]);
      if (menuItem.rows.length === 0) {
        return res.status(404).json({ error: `Menu item with ID ${item.id} not found` });
      }
      if (!item.count || item.count < 1) {
        return res.status(400).json({ error: `Invalid quantity for item ${item.id}` });
      }
      if (item.options && item.options.length > 0) {
        for (const option of item.options) {
          const meatOption = await pool.query(`
            SELECT mo.name
            FROM meat_options mo
            JOIN menu_item_meat_options mimo ON mo.id = mimo.meat_option_id
            WHERE mo.name = $1 AND mimo.menu_item_id = $2
          `, [option, item.id]);
          if (meatOption.rows.length === 0) {
            return res.status(400).json({ error: `Invalid meat option '${option}' for item ${item.id}` });
          }
        }
      }
    }

    // Create order
    const result = await pool.query(
      `INSERT INTO orders (table_id, items, notes, status, order_type, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [table_id, JSON.stringify(items), notes || '', 'In Process', order_type]
    );

    console.log(`Created order for table ${tableNumber} with order_type ${order_type}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;