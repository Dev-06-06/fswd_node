const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Allow app to accept JSON

// --- Database Connection ---
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => {
      console.error('Error connecting to MongoDB:', err.message);
      process.exit(1); // Exit process with failure
  });

// --- API ROUTES ---
// Import all route files
app.use('/auth', require('./routes/auth'));
app.use('/api/account', require('./routes/account'));
app.use('/api/holdings', require('./routes/holdings'));
app.use('/api/reports', require('./routes/reports'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/api/data', require('./routes/data')); // Corrected path from previous step
app.use('/api/search', require('./routes/search'));
// --- ADD THIS NEW ROUTE ---
app.use('/api/broker', require('./routes/broker'));
// --- END OF CHANGE ---

// --- Server Startup ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));