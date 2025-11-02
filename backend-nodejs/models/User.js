const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values, but only one of each email
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
  },
  profile_pic_url: {
    type: String,
  },
});

module.exports = mongoose.model('User', UserSchema);
