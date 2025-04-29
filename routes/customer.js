// // const express = require('express');
// // const router = express.Router();
// // const pool = require('../db');

// // router.get('/menu', async (req, res) => {
// //   try {
// //     const result = await pool.query(`
// //       SELECT * from menu_items
// //     `);
// //     res.json(result.rows);
// //   } catch (error) {
// //     console.error('Menu fetch error:', error);
// //     res.status(500).json({ error: 'Internal server error' });
// //   }
// // });

// // router.post('/order', async (req, res) => {
// //   const { table_number, items, notes, token } = req.body;
// //   console.log('Received order request:', { table_number, token, items, notes });

// //   try {
// //     // Validate inputs
// //     if (!table_number || !items || !Array.isArray(items) || !token) {
// //       return res.status(400).json({ error: 'Missing required fields: table_number, items, token' });
// //     }

// //     // Validate table and token
// //     const table = await pool.query(
// //       'SELECT id, qr_token FROM tables WHERE table_number = $1',
// //       [table_number]
// //     );
// //     if (!table.rows.length) {
// //       return res.status(404).json({ error: 'Table not found' });
// //     }
// //     const { id: tableId, qr_token: storedToken } = table.rows[0];
// //     const updatedItems = items.map(item => ({
// //       ...item,
// //       uniqueId: `${item.id}-${Date.now()}-${Math.random()}`
// //     }));
// //     if (storedToken !== token) {
// //       return res.status(403).json({ error: 'Invalid or expired QR code' });
// //     }

// //     // Meat price adjustments
// //     const meatPriceAdjustments = {
// //       Chicken: 20,
// //       Pork: 40,
// //       Beef: 60,
// //       Seafood: 60
// //     };

// //     // Validate items and meat options
// //     for (const item of items) {
// //       if (!item.id || !item.name || !item.basePrice || !item.price || !Number.isInteger(item.count)) {
// //         return res.status(400).json({ error: `Invalid item format for id: ${item.id}` });
// //       }
// //       const itemQuery = await pool.query(
// //         'SELECT id, name, price FROM menu_items WHERE id = $1',
// //         [item.id]
// //       );
// //       if (!itemQuery.rows.length) {
// //         return res.status(404).json({ error: `Item not found: ${item.id}` });
// //       }
// //       const dbItem = itemQuery.rows[0];
// //       if (item.name !== dbItem.name) {
// //         console.log(`Name mismatch for id: ${item.id}`, { sent: item.name, expected: dbItem.name });
// //         return res.status(400).json({
// //           error: `Name mismatch for id: ${item.id}`,
// //           sent: item.name,
// //           expected: dbItem.name
// //         });
// //       }
// //       if (Math.abs(parseFloat(item.basePrice) - parseFloat(dbItem.price)) > 0.01) {
// //         console.log(`Price mismatch for id: ${item.id}`, { sent: item.basePrice, expected: dbItem.price });
// //         return res.status(400).json({
// //           error: `Price mismatch for id: ${item.id}`,
// //           sent: item.basePrice,
// //           expected: dbItem.price
// //         });
// //       }
// //       if (item.options && item.options.length > 0) {
// //         if (item.options.length > 1) {
// //           return res.status(400).json({ error: `Only one meat option allowed for item ${item.id}` });
// //         }
// //         const meatQuery = await pool.query(
// //           'SELECT mo.name FROM meat_options mo JOIN menu_item_meat_options mimo ON mo.id = mimo.meat_option_id WHERE mimo.menu_item_id = $1 AND mo.name = $2',
// //           [item.id, item.options[0]]
// //         );
// //         if (!meatQuery.rows.length) {
// //           return res.status(400).json({ error: `Invalid meat option for item ${item.id}: ${item.options[0]}` });
// //         }
// //         const expectedPrice = parseFloat(item.basePrice) + (meatPriceAdjustments[item.options[0]] || 0);
// //         if (Math.abs(parseFloat(item.price) - expectedPrice) > 0.01) {
// //           console.log(`Adjusted price mismatch for id: ${item.id}`, { sent: item.price, expected: expectedPrice });
// //           return res.status(400).json({
// //             error: `Invalid adjusted price for item ${item.id} with meat ${item.options[0]}`,
// //             sent: item.price,
// //             expected: expectedPrice.toFixed(2)
// //           });
// //         }
// //       } else if (Math.abs(parseFloat(item.price) - parseFloat(item.basePrice)) > 0.01) {
// //         console.log(`Price mismatch for id: ${item.id} without meat`, { sent: item.price, expected: item.basePrice });
// //         return res.status(400).json({
// //           error: `Invalid price for item ${item.id} without meat`,
// //           sent: item.price,
// //           expected: item.basePrice
// //         });
// //       }
// //     }

// //     // Insert order
// //     const result = await pool.query(
// //       'INSERT INTO orders (table_id, items, notes) VALUES ($1, $2, $3) RETURNING *',
// //       [tableId, JSON.stringify(items), notes || '']
// //     );
// //     console.log('Order inserted:', result.rows[0]);
// //     res.status(201).json(result.rows[0]);
// //   } catch (error) {
// //     console.error('Order error:', error);
// //     res.status(500).json({ error: 'Internal server error' });
// //   }
// // });

// // module.exports = router;



// const express = require('express');
// const router = express.Router();
// const pool = require('../db');

// router.get('/menu', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM menu_items');
//     res.json(result.rows);
//   } catch (error) {
//     console.error('Error fetching menu:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// router.post('/order', async (req, res) => {
//   const { table_number, token, items, notes } = req.body;
//   try {
//     const table = await pool.query('SELECT id FROM tables WHERE table_number = $1 AND qr_token = $2', [table_number, token]);
//     if (!table.rows.length) return res.status(401).json({ error: 'Invalid table or token' });

//     const tableId = table.rows[0].id;
//     const updatedItems = items.map(item => ({
//       ...item,
//       uniqueId: `${item.id}-${Date.now()}-${Math.random()}`
//     }));
//         // Meat price adjustments
//     const meatPriceAdjustments = {
//       Chicken: 20,
//       Pork: 40,
//       Beef: 60,
//       Seafood: 60
//     };

//     // Validate items and meat options
//     for (const item of items) {
//       if (!item.id || !item.name || !item.basePrice || !item.price || !Number.isInteger(item.count)) {
//         return res.status(400).json({ error: `Invalid item format for id: ${item.id}` });
//       }
//       const itemQuery = await pool.query(
//         'SELECT id, name, price FROM menu_items WHERE id = $1',
//         [item.id]
//       );
//       if (!itemQuery.rows.length) {
//         return res.status(404).json({ error: `Item not found: ${item.id}` });
//       }
//       const dbItem = itemQuery.rows[0];
//       if (item.name !== dbItem.name) {
//         console.log(`Name mismatch for id: ${item.id}`, { sent: item.name, expected: dbItem.name });
//         return res.status(400).json({
//           error: `Name mismatch for id: ${item.id}`,
//           sent: item.name,
//           expected: dbItem.name
//         });
//       }
//       if (Math.abs(parseFloat(item.basePrice) - parseFloat(dbItem.price)) > 0.01) {
//         console.log(`Price mismatch for id: ${item.id}`, { sent: item.basePrice, expected: dbItem.price });
//         return res.status(400).json({
//           error: `Price mismatch for id: ${item.id}`,
//           sent: item.basePrice,
//           expected: dbItem.price
//         });
//       }
//       if (item.options && item.options.length > 0) {
//         if (item.options.length > 1) {
//           return res.status(400).json({ error: `Only one meat option allowed for item ${item.id}` });
//         }
//         const meatQuery = await pool.query(
//           'SELECT mo.name FROM meat_options mo JOIN menu_item_meat_options mimo ON mo.id = mimo.meat_option_id WHERE mimo.menu_item_id = $1 AND mo.name = $2',
//           [item.id, item.options[0]]
//         );
//         if (!meatQuery.rows.length) {
//           return res.status(400).json({ error: `Invalid meat option for item ${item.id}: ${item.options[0]}` });
//         }
//         const expectedPrice = parseFloat(item.basePrice) + (meatPriceAdjustments[item.options[0]] || 0);
//         if (Math.abs(parseFloat(item.price) - expectedPrice) > 0.01) {
//           console.log(`Adjusted price mismatch for id: ${item.id}`, { sent: item.price, expected: expectedPrice });
//           return res.status(400).json({
//             error: `Invalid adjusted price for item ${item.id} with meat ${item.options[0]}`,
//             sent: item.price,
//             expected: expectedPrice.toFixed(2)
//           });
//         }
//       } else if (Math.abs(parseFloat(item.price) - parseFloat(item.basePrice)) > 0.01) {
//         console.log(`Price mismatch for id: ${item.id} without meat`, { sent: item.price, expected: item.basePrice });
//         return res.status(400).json({
//           error: `Invalid price for item ${item.id} without meat`,
//           sent: item.price,
//           expected: item.basePrice
//         });
//       }
//     }

//     const result = await pool.query(
//       'INSERT INTO orders (table_id, items, notes, status) VALUES ($1, $2, $3, $4) RETURNING *',
//       [tableId, JSON.stringify(updatedItems), notes || '', 'New']
//     );
//     res.json(result.rows[0]);
//   } catch (error) {
//     console.error('Error placing order:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/menu', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT mi.*, 
             COALESCE(
               (SELECT ARRAY_AGG(mo.name) 
                FROM meat_options mo 
                JOIN menu_item_meat_options mimo ON mo.id = mimo.meat_option_id 
                WHERE mimo.menu_item_id = mi.id), 
               ARRAY[]::text[]
             ) AS options
      FROM menu_items mi
    `);
    console.log('Menu fetched:', result.rows.map(item => ({
      id: item.id,
      name: item.name,
      options: item.options
    })));
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/order', async (req, res) => {
  const { table_number, token, items, notes } = req.body;
  try {
    console.log('Received order:', { table_number, token, items, notes });
    const table = await pool.query('SELECT id FROM tables WHERE table_number = $1 AND qr_token = $2', [table_number, token]);
    if (!table.rows.length) {
      console.error('Invalid table or token:', table_number, token);
      return res.status(401).json({ error: 'Invalid table or token' });
    }

    const tableId = table.rows[0].id;
    const updatedItems = items.map(item => ({
      ...item,
      uniqueId: item.uniqueId || `${item.id}-${Date.now()}-${Math.random()}`
    }));

    // Meat price adjustments
    const meatPriceAdjustments = {
      Chicken: 20,
      Pork: 40,
      Beef: 60,
      Seafood: 60
    };

    // Validate items and meat options
    for (const item of items) {
      if (!item.id || !item.name || !item.basePrice || !item.price || !Number.isInteger(item.count)) {
        return res.status(400).json({ error: `Invalid item format for id: ${item.id}` });
      }
      const itemQuery = await pool.query(
        'SELECT id, name, price FROM menu_items WHERE id = $1',
        [item.id]
      );
      if (!itemQuery.rows.length) {
        return res.status(404).json({ error: `Item not found: ${item.id}` });
      }
      const dbItem = itemQuery.rows[0];
      if (item.name !== dbItem.name) {
        console.log(`Name mismatch for id: ${item.id}`, { sent: item.name, expected: dbItem.name });
        return res.status(400).json({
          error: `Name mismatch for id: ${item.id}`,
          sent: item.name,
          expected: dbItem.name
        });
      }
      if (Math.abs(parseFloat(item.basePrice) - parseFloat(dbItem.price)) > 0.01) {
        console.log(`Price mismatch for id: ${item.id}`, { sent: item.basePrice, expected: dbItem.price });
        return res.status(400).json({
          error: `Price mismatch for id: ${item.id}`,
          sent: item.basePrice,
          expected: dbItem.price
        });
      }
      if (item.options && item.options.length > 0) {
        if (item.options.length > 1) {
          return res.status(400).json({ error: `Only one meat option allowed for item ${item.id}` });
        }
        const meatQuery = await pool.query(
          'SELECT mo.name FROM meat_options mo JOIN menu_item_meat_options mimo ON mo.id = mimo.meat_option_id WHERE mimo.menu_item_id = $1 AND mo.name = $2',
          [item.id, item.options[0]]
        );
        if (!meatQuery.rows.length) {
          return res.status(400).json({ error: `Invalid meat option for item ${item.id}: ${item.options[0]}` });
        }
        const expectedPrice = parseFloat(item.basePrice) + (meatPriceAdjustments[item.options[0]] || 0);
        if (Math.abs(parseFloat(item.price) - expectedPrice) > 0.01) {
          console.log(`Adjusted price mismatch for id: ${item.id}`, { sent: item.price, expected: expectedPrice });
          return res.status(400).json({
            error: `Invalid adjusted price for item ${item.id} with meat ${item.options[0]}`,
            sent: item.price,
            expected: expectedPrice.toFixed(2)
          });
        }
      } else if (Math.abs(parseFloat(item.price) - parseFloat(item.basePrice)) > 0.01) {
        console.log(`Price mismatch for id: ${item.id} without meat`, { sent: item.price, expected: item.basePrice });
        return res.status(400).json({
          error: `Invalid price for item ${item.id} without meat`,
          sent: item.price,
          expected: item.basePrice
        });
      }
    }

    const result = await pool.query(
      'INSERT INTO orders (table_id, items, notes, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [tableId, JSON.stringify(updatedItems), notes || '', 'New']
    );
    console.log('Order inserted:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;