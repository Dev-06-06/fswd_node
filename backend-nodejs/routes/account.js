const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');

// --- Update Profile (Full Name) ---
router.put('/profile', async (req, res) => {
  const { username, full_name } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    const result = await User.updateOne(
      { username },
      { $set: { full_name } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- Delete Account ---
router.delete('/delete', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    // Delete all associated data
    await Holding.deleteMany({ username });
    await Transaction.deleteMany({ username });
    
    // Delete the user
    const result = await User.deleteOne({ username });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
