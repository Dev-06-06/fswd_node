const express = require('express');
const { KiteConnect } = require('kiteconnect');
const crypto = require('crypto-js');
const User = require('../models/User');
const Holding = require('../models/Holding');
const axios = require('axios');

const router = express.Router();

// --- Load Credentials from .env ---
const API_KEY = process.env.KITE_API_KEY;
const API_SECRET = process.env.KITE_API_SECRET;
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

const kc = new KiteConnect({
  api_key: API_KEY,
});

// ... (encryptToken, decryptToken, /connect, /callback all stay the same) ...
const encryptToken = (token) => {
  return crypto.AES.encrypt(token, ENCRYPTION_SECRET).toString();
};

const decryptToken = (encryptedToken) => {
  try {
    const bytes = crypto.AES.decrypt(encryptedToken, ENCRYPTION_SECRET);
    return bytes.toString(crypto.enc.Utf8);
  } catch (e) {
    console.error("Failed to decrypt token:", e);
    return null;
  }
};

router.get('/connect', (req, res) => {
  try {
    const loginUrl = kc.getLoginURL();
    res.json({ login_url: loginUrl });
  } catch (err) {
    console.error('Kite connect error:', err);
    res.status(500).json({ message: 'Error initiating Kite connection.' });
  }
});

router.post('/callback', async (req, res) => {
  const { request_token, username } = req.body;
  if (!request_token || !username) {
    return res.status(400).json({ message: 'Request token and username are required.' });
  }
  try {
    const session = await kc.generateSession(request_token, API_SECRET);
    const encryptedAccessToken = encryptToken(session.access_token);
    await User.updateOne(
      { username: username },
      { $set: { kite_access_token: encryptedAccessToken, kite_public_token: session.public_token } }
    );
    res.status(200).json({ message: 'Zerodha account connected successfully!', public_token: session.public_token });
  } catch (err) {
    console.error('Kite callback raw error:', err);
    res.status(500).json({ message: 'Failed to authenticate with Zerodha.' });
  }
});


// --- THIS IS THE FIXED ROUTE FOR THE TABLE ---
router.post('/get-live-prices', async (req, res) => {
    const { username, symbols } = req.body; // symbols might be ["NSE:RELIANCE", "RELIANCE.NS"]

    if (!username || !symbols || !Array.isArray(symbols)) {
        return res.status(400).json({ message: "Invalid request" });
    }

    try {
        const user = await User.findOne({ username });

        // --- Helper function to convert ANY symbol to Kite format ---
        const toKiteSymbol = (s) => {
          if (s.includes(':')) return s; // It's already "NSE:RELIANCE"
          if (s.includes('.')) { // It's "RELIANCE.NS" or "TCS.BO"
            const parts = s.split('.');
            const instrument = parts[0];
            const exchangeCode = parts[1];
            if (exchangeCode === 'NS') return `NSE:${instrument}`;
            if (exchangeCode === 'BO') return `BSE:${instrument}`;
          }
          return `NSE:${s}`; // Best guess
        };
        // --- End of helper ---

        if (!user || !user.kite_access_token) {
            // ... (Finnhub fallback logic) ...
            console.warn(`User ${username} not connected to Kite. Falling back to Finnhub.`);
            const finnhubSymbols = symbols.map(s => {
              // Convert "NSE:RELIANCE" back to "RELIANCE.NS"
              if (s.includes(':')) {
                const parts = s.split(':');
                if (parts[0] === 'NSE') return `${parts[1]}.NS`;
                if (parts[0] === 'BSE') return `${parts[1]}.BO`;
              }
              if (s.includes('.')) return s;
              return `${s}.NS`;
            });
            
            if (finnhubSymbols.length === 0) return res.status(200).json({});
            const pricePromises = finnhubSymbols.map(symbol => 
                axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`)
            );
            const responses = await Promise.all(pricePromises);
            const prices = {};
            responses.forEach((response, index) => {
                const originalSymbol = symbols[index]; // Use the original symbol as the key
                prices[originalSymbol] = response.data.c || 0; 
            });
            return res.status(200).json(prices);
        }

        // --- KITE-CONNECTED PATH (NOW FIXED) ---
        const access_token = decryptToken(user.kite_access_token);
        if (!access_token) throw new Error("Token decryption failed");

        kc.setAccessToken(access_token);
        
        // 1. Convert all symbols (even bad ones) to correct Kite format
        const kiteSymbols = symbols.map(toKiteSymbol); // ["NSE:RELIANCE", "NSE:TCS"]
        
        // 2. Call Kite with the *correct* symbols
        const kiteQuotes = await kc.getQuote(kiteSymbols);
        
        const prices = {};
        // 3. Map prices back to the *original* symbols from the database
        symbols.forEach((originalSymbol, index) => {
          const correspondingKiteSymbol = kiteSymbols[index];
          const quoteData = kiteQuotes[correspondingKiteSymbol];
          
          if (quoteData) {
            prices[originalSymbol] = quoteData.last_price || 0;
          } else {
            prices[originalSymbol] = 0; // Symbol was invalid
          }
        });

        // This now returns {"NSE:RELIANCE": 1234, "RELIANCE.NS": 1234}
        res.status(200).json(prices);

    } catch(err) {
        console.error("Kite price fetch error:", err.message);
        res.status(500).json({ message: "Error fetching live prices." });
    }
});
// --- END OF FIXED ROUTE ---


// ... (The rest of your file: /sync-holdings, /get-single-quote, /disconnect) ...
router.post('/sync-holdings', async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user ||!user.kite_access_token) {
      return res.status(401).json({ message: 'User not connected to Zerodha.' });
    }
    const access_token = decryptToken(user.kite_access_token);
    if (!access_token) throw new Error("Token decryption failed");
    kc.setAccessToken(access_token);
    const kiteHoldings = await kc.getHoldings();
    const holdingPromises = kiteHoldings.map(async (item) => {
      const symbol = `${item.exchange}:${item.tradingsymbol}`;
      const holdingDoc = {
        username: username,
        symbol: symbol,
        instrument: item.tradingsymbol,
        quantity: item.quantity,
        avg_cost: item.average_price,
        type: 'Equity',
      };
      return Holding.updateOne(
        { username: username, symbol: symbol },
        { $set: holdingDoc },
        { upsert: true }
      );
    });
    await Promise.all(holdingPromises);
    res.status(200).json({ message: 'Holdings synced successfully!' });
  } catch (err) {
    console.error('Kite sync error:', err);
    res.status(500).json({ message: 'Failed to sync holdings.' });
  }
});

router.get('/get-single-quote', async (req, res) => {
  const { symbol, username } = req.query; // symbol is "RELIANCE.NS" or "RELIANCE.BO"
  if (!symbol || !username) {
    return res.status(400).json({ message: 'Symbol and username are required.' });
  }
  try {
    const user = await User.findOne({ username });
    if (user && user.kite_access_token) {
      console.log(`User ${username} is connected to Kite. Fetching Kite quote.`);
      const access_token = decryptToken(user.kite_access_token);
      if (access_token) {
        kc.setAccessToken(access_token);
        const parts = symbol.split('.');
        const instrument = parts[0];
        const exchangeCode = parts[1];
        let exchange = '';
        if (exchangeCode === 'NS') {
          exchange = 'NSE';
        } else if (exchangeCode === 'BO') {
          exchange = 'BSE';
        } else {
          throw new Error(`Unknown exchange code from Finnhub: ${exchangeCode}`);
        }
        const finalSymbol = `${exchange}:${instrument}`;
        const kiteQuotes = await kc.getQuote([finalSymbol]);
        const quoteData = kiteQuotes[finalSymbol];
        if (!quoteData) {
          throw new Error(`Kite returned no data for symbol ${finalSymbol}`);
        }
        return res.status(200).json({ price: quoteData.last_price || 0 });
      }
    }
    console.warn(`User ${username} not connected to Kite. Fetching Finnhub quote.`);
    if (!FINNHUB_API_KEY) {
        return res.status(500).json({ message: 'Price service not configured.' });
    }
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const response = await axios.get(url);
    res.status(200).json({ price: response.data.c || 0 });
  } catch (err) {
    console.error('Single quote fetch error:', err.message);
    try {
        console.warn('Kite quote failed, falling back to Finnhub.');
        const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
        const response = await axios.get(url);
        res.status(200).json({ price: response.data.c || 0 });
    } catch (finnhubErr) {
        console.error('Finnhub fallback error:', finnhubErr.message);
        res.status(500).json({ message: 'Failed to fetch stock quote from all sources.' });
    }
  }
});

router.post('/disconnect', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username is required.' });
  }
  try {
    await User.updateOne(
      { username: username },
      { $unset: { kite_access_token: "", kite_public_token: "" } }
    );
    res.status(200).json({ message: 'Kite account disconnected successfully.' });
  } catch (err) {
    console.error('Kite disconnect error:', err);
    res.status(500).json({ message: 'Failed to disconnect account.' });
  }
});

module.exports = router;