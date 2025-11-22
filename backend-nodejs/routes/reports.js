const express = require('express');
const router = express.Router();
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');

// --- Helper: Parse date string safely ---
function parseDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

// --- Get Transaction History ---
router.get('/transactions', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }
  try {
    const transactions = await Transaction.find({ username }).sort({ date: -1 }).lean();
    res.status(200).json(transactions);
  } catch (err) {
    console.error(`Transactions Error: ${err.message}`);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- Get P&L Statement ---
router.get('/pnl', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    const transactions = await Transaction.find({ username }).sort({ date: 1 }).lean();
    const transactions_by_symbol = {};
    for (const tx of transactions) {
      if (!parseDate(tx.date)) continue;
      if (!transactions_by_symbol[tx.instrument]) transactions_by_symbol[tx.instrument] = [];
      transactions_by_symbol[tx.instrument].push(tx);
    }

    const pnl_summary = [];
    for (const symbol in transactions_by_symbol) {
      const buy_queue = [];
      let total_cost_of_sold_shares = 0;
      let total_value_from_sales = 0;
      for (const tx of transactions_by_symbol[symbol]) {
        if (tx.type === 'BUY') {
          buy_queue.push({ quantity: tx.quantity, price: tx.price });
        } else if (tx.type === 'SELL') {
          let sell_quantity = tx.quantity;
          let sale_price = tx.price;
          total_value_from_sales += sell_quantity * sale_price;
          while (sell_quantity > 0 && buy_queue.length > 0) {
            const oldest_buy = buy_queue[0];
            const qty_to_sell = Math.min(sell_quantity, oldest_buy.quantity);
            total_cost_of_sold_shares += qty_to_sell * oldest_buy.price;
            oldest_buy.quantity -= qty_to_sell;
            if (oldest_buy.quantity <= 0.0001) buy_queue.shift();
            sell_quantity -= qty_to_sell;
          }
        }
      }
      if (total_value_from_sales > 0) {
        const realized_pnl = total_value_from_sales - total_cost_of_sold_shares;
        pnl_summary.push({
          instrument: symbol,
          total_sale_value: Number(total_value_from_sales.toFixed(2)),
          cost_basis: Number(total_cost_of_sold_shares.toFixed(2)),
          realized_pnl: Number(realized_pnl.toFixed(2)),
        });
      }
    }
    res.status(200).json(pnl_summary);
  } catch (err) {
    console.error(`P&L Error: ${err.message}`);
    res.status(500).json({ message: 'P&L calculation failed' });
  }
});

// --- Get Real Return Statement ---
router.get('/real-returns', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }
  
  const INFLATION_RATE = 0.060; // 6.0%

  try {
    const transactions = await Transaction.find({ username }).sort({ date: 1 }).lean();
    const transactions_by_symbol = {};
    for (const tx of transactions) {
      if (!parseDate(tx.date)) continue;
      if (!transactions_by_symbol[tx.instrument]) transactions_by_symbol[tx.instrument] = [];
      transactions_by_symbol[tx.instrument].push(tx);
    }
    
    const real_return_summary = [];
    for (const symbol in transactions_by_symbol) {
      const buy_queue = [];
      let total_realized_pnl = 0;
      let total_inflation_adjustment = 0;
      let has_sales = false;
      for (const tx of transactions_by_symbol[symbol]) {
        const tx_date = parseDate(tx.date);
        if (!tx_date) continue;

        if (tx.type === 'BUY') {
          buy_queue.push({ quantity: tx.quantity, price: tx.price, date: tx_date });
        } else if (tx.type === 'SELL') {
          has_sales = true;
          let sell_quantity = tx.quantity;
          let sale_price = tx.price;
          while (sell_quantity > 0 && buy_queue.length > 0) {
            const oldest_buy = buy_queue[0];
            const buy_date = oldest_buy.date;
            const qty_to_sell = Math.min(sell_quantity, oldest_buy.quantity);
            
            const holding_period_days = (tx_date - buy_date) / (1000 * 60 * 60 * 24);
            const holding_period_years = Math.max(0, holding_period_days / 365.25);
            
            const cost_basis = qty_to_sell * oldest_buy.price;
            const sale_value = qty_to_sell * sale_price;
            const nominal_pnl = sale_value - cost_basis;
            
            const inflation_adjusted_sale_value = holding_period_years > 0 ? (sale_value / Math.pow(1 + INFLATION_RATE, holding_period_years)) : sale_value;
            const real_pnl = inflation_adjusted_sale_value - cost_basis;
            
            total_realized_pnl += nominal_pnl;
            total_inflation_adjustment += (nominal_pnl - real_pnl);
            
            oldest_buy.quantity -= qty_to_sell;
            if (oldest_buy.quantity <= 0.0001) buy_queue.shift();
            sell_quantity -= qty_to_sell;
          }
        }
      }
      if (has_sales) {
        real_return_summary.push({
          instrument: symbol,
          nominal_pnl: Number(total_realized_pnl.toFixed(2)),
          inflation_adjustment: Number(total_inflation_adjustment.toFixed(2)),
          real_pnl: Number((total_realized_pnl - total_inflation_adjustment).toFixed(2)),
        });
      }
    }
    res.status(200).json(real_return_summary);
  } catch (err) {
    console.error(`Real Return Error: ${err.message}`);
    res.status(500).json({ message: 'Real return calculation failed' });
  }
});

// --- Get Investment "CIBIL" Score ---
router.get('/cibil-score', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    const holdings = await Holding.find({ username }).lean();
    const transactions = await Transaction.find({ username }).sort({ date: 1 }).lean();

    const base_score = 300;
    let diversification_score = 0;
    let profitability_score = 0;
    let discipline_score = 0;
    let days_investing = 0;

    // 1. Diversification
    const num_unique_holdings = holdings.length;
    diversification_score = Math.min(200, num_unique_holdings * 20);
    
    // 2. Profitability (Re-using P&L logic)
    const buy_queue = {};
    let total_realized_pnl = 0;
    if (transactions.length > 0) {
      for (const tx of transactions) {
        if (!parseDate(tx.date)) continue;
        const instrument = tx.instrument;
        const tx_quantity = tx.quantity;
        const tx_price = tx.price;
        if (tx.type === 'BUY') {
          if (!buy_queue[instrument]) buy_queue[instrument] = [];
          buy_queue[instrument].push({ quantity: tx_quantity, price: tx_price });
        } else if (tx.type === 'SELL') {
          let sell_quantity = tx_quantity;
          let sale_price = tx.price;
          let cost_of_sold_shares = 0;
          while (sell_quantity > 0 && buy_queue[instrument] && buy_queue[instrument].length > 0) {
            const oldest_buy = buy_queue[instrument][0];
            const qty_to_sell = Math.min(sell_quantity, oldest_buy.quantity);
            cost_of_sold_shares += qty_to_sell * oldest_buy.price;
            oldest_buy.quantity -= qty_to_sell;
            if (oldest_buy.quantity <= 0.0001) buy_queue[instrument].shift();
            sell_quantity -= qty_to_sell;
          }
          total_realized_pnl += (tx_quantity * sale_price) - cost_of_sold_shares;
        }
      }
    }
    if (total_realized_pnl > 50000) profitability_score = 200;
    else if (total_realized_pnl > 10000) profitability_score = 150;
    else if (total_realized_pnl > 0) profitability_score = 100;
    else profitability_score = 50;

    // 3. Discipline
    let discipline_feedback = "No History Yet";
    const firstValidTransaction = transactions.find(tx => parseDate(tx.date));
    if (firstValidTransaction) {
      const first_tx_date = parseDate(firstValidTransaction.date);
      days_investing = (new Date() - first_tx_date) / (1000 * 60 * 60 * 24); // Days
      discipline_score = Math.min(200, Math.floor(days_investing / 3.65));
      if (days_investing > 730) discipline_feedback = "Veteran Investor!";
      else if (days_investing > 365) discipline_feedback = "Long-Term Focused";
      else if (days_investing > 180) discipline_feedback = "Getting Consistent";
      else if (days_investing > 30) discipline_feedback = "Building Habits";
      else if (days_investing >= 0) discipline_feedback = "Just Started!";
    }
    
    // Total score (out of 900)
    const total_score = Math.min(900, base_score + diversification_score + profitability_score + discipline_score);
    
    const feedback = {
      "Diversification": diversification_score > 150 ? "Excellent" : diversification_score > 80 ? "Good" : "Needs Improvement",
      "Profitability": profitability_score > 150 ? "Excellent" : profitability_score > 100 ? "Good" : "Average",
      "Discipline": discipline_feedback,
    };

    res.status(200).json({
      score: total_score,
      breakdown: {
        'Base Score': base_score,
        'Diversification': diversification_score,
        'Profitability': profitability_score,
        'Discipline': discipline_score,
      },
      feedback,
    });
  } catch (err) {
    console.error(`CIBIL Error: ${err.message}`);
    res.status(500).json({ message: 'Score calculation failed' });
  }
});

module.exports = router;