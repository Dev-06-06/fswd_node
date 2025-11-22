const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateUniqueUsername = require('../utils/generateUniqueUsername');

// --- Register User ---
router.post('/register', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ message: 'Identifier and password are required' });
  }

  try {
    const is_email = identifier.includes('@');
    const user_data = is_email ? { email: identifier } : { phone_number: identifier };

    if (await User.findOne(user_data)) {
      return res.status(409).json({ message: 'An account with this identifier already exists' });
    }

    const username = await generateUniqueUsername();
    const salt = await bcrypt.genSalt(10);
    const hashed_password = await bcrypt.hash(password, salt);

    const newUser = new User({
      ...user_data,
      username,
      password: hashed_password,
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully!', username });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- Login User (UPDATED) ---
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ message: 'Identifier and password are required' });
  }

  try {
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier },
        { phone_number: identifier },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials or password' });
    }

    // --- THIS IS THE CHANGE ---
    // We now send the kite_public_token (which is safe)
    // so the frontend knows if the user is connected.
    res.status(200).json({
      message: `Login successful! Welcome ${user.username}`,
      user: {
        username: user.username,
        profile_pic_url: user.profile_pic_url,
        full_name: user.full_name,
        kite_public_token: user.kite_public_token // Send this to the frontend
      },
    });
    // --- END OF CHANGE ---

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;