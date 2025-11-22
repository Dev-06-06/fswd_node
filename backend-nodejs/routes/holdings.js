const express = require('express');
const router = express.Router();
const axios = require('axios'); // Keep axios for our internal call
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');

// --- REMOVE FINNHUB KEY ---
// const finnhub_api_key = process.env.FINNHUB_API_KEY; // This is no longer the primary source

// Helper function to format date as "YYYY-MM-DD HH:MM:SS"
function strftime(date) {
  const pad = (num) => (num < 10 ? '0' + num : num);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// --- Get All Holdings (NOW USES KITE PRICE API) ---
router.get('/', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    const real_holdings = await Holding.find({ username }).lean(); // .lean() gives plain JS objects

    if (!real_holdings || real_holdings.length === 0) {
        return res.status(200).json([]); // Return empty array if no holdings
    }

    // Get symbols for price fetch
    const equitySymbols = real_holdings
        .filter(h => h.type === 'Equity' && h.symbol)
        .map(h => h.symbol); // e.g., ["NSE:RELIANCE", "NSE:TCS"]

    let livePrices = {};
    if (equitySymbols.length > 0) {
        try {
            // --- THIS IS THE CHANGE ---
            // Call our new internal broker route to get prices
            const priceResponse = await axios.post(`http://127.0.0.1:${process.env.PORT || 5000}/api/broker/get-live-prices`, {
                username: username,
                symbols: equitySymbols
            });
            livePrices = priceResponse.data;
            // --- END OF CHANGE ---
        } catch (priceError) {
            console.error("Error in get-live-prices call:", priceError.message);
            // On failure, livePrices will be empty, and we'll use avg_cost as fallback
        }
    }
    // --- END OF CHANGE ---

    // Map prices back to holdings
    const enriched_holdings = real_holdings.map((holding) => {
      const holding_qty = holding.quantity;
      const holding_avg_cost = holding.avg_cost;

      if (holding.type === 'Equity') {
        // Use live price if available, otherwise fallback to avg cost
        const current_price = livePrices[holding.symbol] || holding_avg_cost;
        return {
          ...holding,
          current_price: Number(current_price.toFixed(2)),
          total_value: Number((holding_qty * current_price).toFixed(2)),
          pnl: Number(((current_price - holding_avg_cost) * holding_qty).toFixed(2)),
        };
      } else if (holding.type === 'FD') {
        const current_price_display_factor = 1.07;
        const current_value = holding_qty * current_price_display_factor;
        const investment_value = holding_qty * 1;
        return {
          ...holding,
          current_price: Number(current_price_display_factor.toFixed(2)),
          total_value: Number(current_value.toFixed(2)),
          pnl: Number((current_value - investment_value).toFixed(2)),
        };
      }
      return { ...holding }; // Return other types as-is
    });

    res.status(200).json(enriched_holdings);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- Add a Stock Holding (NOW USES KITE SYMBOL FORMAT) ---
router.post('/', async (req, res) => {
  const { username, symbol, quantity, purchase_price } = req.body;
  const new_quantity = parseFloat(quantity);
  const new_purchase_price = parseFloat(purchase_price);

  // --- THIS IS THE CHANGE ---
  // Standardize symbol to Kite format (e.g., "RELIANCE.NS" -> "NSE:RELIANCE")
  // We'll assume NSE for simplicity if no exchange is given
  let instrumentName = symbol.toUpperCase().replace(".NS", "");
  let kiteSymbol = symbol.toUpperCase();
  if (!kiteSymbol.includes(':')) {
      kiteSymbol = `NSE:${instrumentName}`;
  } else {
      instrumentName = kiteSymbol.split(':')[1];
  }
  // --- END OF CHANGE ---

  if (!username || !kiteSymbol || !(new_quantity > 0) || !(new_purchase_price >= 0)) {
    return res.status(400).json({ message: 'Missing or invalid data' });
  }

  try {
    const existing_holding = await Holding.findOne({ username, symbol: kiteSymbol });

    if (existing_holding) {
      // Update existing
      const current_quantity = existing_holding.quantity;
      const current_avg_cost = existing_holding.avg_cost;
      const total_value_old = current_quantity * current_avg_cost;
      const total_value_new = new_quantity * new_purchase_price;
      const new_total_quantity = current_quantity + new_quantity;
      const new_avg_cost = (total_value_old + total_value_new) / new_total_quantity;

      await Holding.updateOne(
        { _id: existing_holding._id },
        { $set: { quantity: new_total_quantity, avg_cost: new_avg_cost } }
      );
    } else {
      // Insert new
      const holding_doc = new Holding({
        username,
        symbol: kiteSymbol, // Save Kite symbol
        instrument: instrumentName, // Save clean instrument name
        quantity: new_quantity,
        avg_cost: new_purchase_price,
        type: 'Equity',
      });
      await holding_doc.save();
    }

    // Create transaction record
    const transaction_doc = new Transaction({
      username,
      date: strftime(new Date()),
      type: 'BUY',
      instrument: instrumentName, // Save clean instrument name
      quantity: new_quantity,
      price: new_purchase_price,
    });
    await transaction_doc.save();

    res.status(201).json({ message: 'Holding updated successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- Sell a Stock Holding (NOW USES KITE SYMBOL FORMAT) ---
router.post('/sell', async (req, res) => {
  const { username, symbol, quantity, price } = req.body; // symbol is "NSE:RELIANCE"
  const sell_quantity = parseFloat(quantity);
  const sell_price = parseFloat(price);

  if (!username || !symbol || !(sell_quantity > 0) || !(sell_price >= 0)) {
    return res.status(400).json({ message: 'Missing or invalid data' });
  }

  try {
    // Symbol is already in "NSE:RELIANCE" format from the frontend modal
    const current_holding = await Holding.findOne({ username, symbol });
    if (!current_holding) {
      return res.status(404).json({ message: 'Holding not found' });
    }

    const current_quantity = current_holding.quantity;
    if (sell_quantity > current_quantity) {
      return res.status(400).json({ message: 'You cannot sell more stocks than you own' });
    }

    if (Math.abs(sell_quantity - current_quantity) < 0.0001) {
      await Holding.deleteOne({ _id: current_holding._id });
    } else {
      const new_quantity = current_quantity - sell_quantity;
      await Holding.updateOne({ _id: current_holding._id }, { $set: { quantity: new_quantity } });
    }

    const transaction_doc = new Transaction({
      username,
      date: strftime(new Date()),
      type: 'SELL',
      instrument: current_holding.instrument, // Use the clean name
      quantity: sell_quantity,
      price: sell_price,
    });
    await transaction_doc.save();

    res.status(200).json({ message: 'Sale recorded successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- Add an FD Holding ---
router.post('/add-fd', async (req, res) => {
  const { username, instrument, quantity } = req.body;
  const principal_amount = parseFloat(quantity);

  if (!username || !instrument || !(principal_amount > 0)) {
    return res.status(400).json({ message: 'Missing data' });
  }

  try {
    const holding_doc = new Holding({
      username,
      symbol: instrument.replace(' ', '-').toUpperCase(),
      instrument,
      quantity: principal_amount,
      avg_cost: 1,
      type: 'FD',
    });
    await holding_doc.save();

    const transaction_doc = new Transaction({
      username,
      date: strftime(new Date()),
      type: 'DEPOSIT',
      instrument,
      quantity: 1,
      price: principal_amount,
    });
    await transaction_doc.save();

    res.status(201).json({ message: 'FD investment recorded successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;