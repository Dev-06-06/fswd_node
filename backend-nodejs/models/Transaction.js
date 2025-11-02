const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    index: true,
  },
  date: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['BUY', 'SELL', 'DEPOSIT'],
    required: true,
  },
  instrument: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model('Transaction', TransactionSchema);
