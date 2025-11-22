const express = require('express');
const router = express.Router();
const axios = require('axios');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

/**
 * @route   GET /api/search
 * @desc    Search for stock symbols using Finnhub
 * @query   q - The search query (e.g., "reliance")
 */
router.get('/', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ message: 'Search query (q) is required.' });
  }

  if (!FINNHUB_API_KEY) {
    console.error('FINNHUB_API_KEY is not set.');
    return res.status(500).json({ message: 'Search service is not configured.' });
  }

  try {
    const url = `https://finnhub.io/api/v1/search?q=${q}&token=${FINNHUB_API_KEY}`;
    const response = await axios.get(url);

    // Finnhub returns a list of results. We only want Indian (NS) stocks.
    const filteredResults = response.data.result.filter(item => 
      item.symbol.includes('.NS')
    );

    res.status(200).json(filteredResults);
  } catch (err) {
    console.error('Finnhub search error:', err.message);
    res.status(500).json({ message: 'Failed to search for stocks.' });
  }
});

// --- THIS ROUTE IS NOW GONE ---
// We moved this logic to broker.js to make it "smart"

module.exports = router;