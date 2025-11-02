const User = require('../models/User');

const generateUniqueUsername = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  while (true) {
    let username = '';
    for (let i = 0; i < 6; i++) {
      username += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if it already exists in the database
    const existingUser = await User.findOne({ username });
    if (!existingUser) {
      return username;
    }
  }
};

module.exports = generateUniqueUsername;
