const mongoose = require('mongoose');

const HoldingSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    index: true, // Index for faster queries by username
  },
  symbol: {
    type: String,
    required: true,
  },
  instrument: {
    type: String,
  },
  quantity: {
    type: Number,
    required: true,
  },
  avg_cost: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['Equity', 'FD', 'Bonds'],
    required: true,
  },
});

// Compound index to ensure a user can only have one holding per symbol
HoldingSchema.index({ username: 1, symbol: 1 }, { unique: true });

module.exports = mongoose.model('Holding', HoldingSchema);
