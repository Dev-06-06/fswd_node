const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
  },
  phone_number: {
    type: String,
    unique: true,
    sparse: true,
  },
  password: {
    type: String,
    required: true,
  },
  full_name: {
    type: String,
    default: '',
  },
  
  // --- REMOVED profile_pic_url field ---

  kite_access_token: {
    type: String,
    default: null,
  },
  kite_public_token: {
    type: String,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', UserSchema);