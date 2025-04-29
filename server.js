require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const adminRoutes = require('./routes/admin');
const customerRoutes = require('./routes/customer');
const path = require('path');

app.use(cors());
app.use(express.json());
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  pool.connect((err) => {
    if (err) {
      console.error('Database connection error:', err.stack);
    } else {
      console.log('Connected to PostgreSQL database');
    }
  });
  
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});