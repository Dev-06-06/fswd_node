const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Ensure you're importing the User model
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');

// --- POST /api/account/update ---
// (This is the route that AccountPage and App.js call)
router.post('/update', async (req, res) => {
  // --- REMOVED profile_pic_url ---
  const { username, full_name } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Username is required.' });
  }

  try {
    const fieldsToUpdate = {};
    if (full_name !== undefined) {
      fieldsToUpdate.full_name = full_name;
    }
    
    // --- REMOVED profile_pic_url from update logic ---

    const updatedUser = await User.findOneAndUpdate(
      { username: username },
      { $set: fieldsToUpdate },
      { new: true } // This returns the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ 
      message: 'Account updated successfully.',
      user: {
        username: updatedUser.username,
        full_name: updatedUser.full_name,
        // No longer returning profile_pic_url
      }
    });

  } catch (err) {
    console.error('Error updating account:', err);
    res.status(500).json({ message: 'Server error while updating account.' });
  }
});


// --- DELETE /api/account/delete ---
router.delete('/delete', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Username is required to delete.' });
  }

  try {
    // 1. Delete the user
    const deletedUser = await User.findOneAndDelete({ username: username });
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // 2. Delete all associated holdings
    await Holding.deleteMany({ username: username });

    // 3. Delete all associated transactions
    await Transaction.deleteMany({ username: username });

    res.status(200).json({ message: 'User and all associated data deleted successfully.' });

  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(5.00).json({ message: 'Server error while deleting account.' });
  }
});


module.exports = router;