// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const { Pool } = require('pg');
// const helmet = require('helmet');
// const app = express();
// const authRoutes = require('./routes/authRoutes');
// const adminRoutes = require('./routes/admin');
// const customerRoutes = require('./routes/customer');
// const path = require('path');

// app.use(cors());
// app.use(helmet());
// app.use(express.json());
// const pool = new Pool({
//     connectionString: process.env.DATABASE_URL,
//   });
//   pool.connect((err) => {
//     if (err) {
//       console.error('Database connection error:', err.stack);
//     } else {
//       console.log('Connected to PostgreSQL database');
//     }
//   });
  
// app.use('/api/auth', authRoutes); 
// app.use('/api/admin', adminRoutes);
// app.use('/api/customer', customerRoutes);
// app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });


require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/admin');
const customerRoutes = require('./routes/customer');
const path = require('path');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development; adjust for production
    methods: ['GET', 'POST'],
  },
  path: '/socket.io',
});

// Socket.IO event handling
io.on('connection', (socket) => {
  console.log('Socket.IO client connected:', socket.id);

  socket.on('customer-call', (data) => {
    console.log('Received customer-call:', data);
    io.emit('customer-call', data); // Broadcast to all connected clients
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO client disconnected:', socket.id);
  });
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Database connection
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});