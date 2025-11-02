const express = require('express');
const router = express.Router();
const axios = require('axios');
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');

const finnhub_api_key = process.env.FINNHUB_API_KEY;

// --- Get Dashboard Summary (Stable Version) ---
router.get('/summary', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ message: 'Username is required' });
  }

  try {
    // 1. Unrealized P&L
    const real_holdings = await Holding.find({ username }).lean();
    let total_portfolio_value = 0;
    let total_investment_value = 0;
    const asset_allocation = { Equity: 0, Bonds: 0, FD: 0 };

    const holdingPromises = real_holdings.map(async (holding) => {
      let current_price = holding.avg_cost;
      const holding_qty = holding.quantity;
      const holding_avg_cost = holding.avg_cost;

      if (holding.type === 'Equity' && holding.symbol) {
        try {
          const url = `https://finnhub.io/api/v1/quote?symbol=${holding.symbol}&token=${finnhub_api_key}`;
          const response = await axios.get(url);
          current_price = response.data.c || holding_avg_cost;
        } catch (e) {
          console.error(`Finnhub API error for ${holding.symbol}: ${e.message}`);
          current_price = holding_avg_cost;
        }
      } else if (holding.type === 'FD') {
        const current_value = holding_qty * 1.07; // Mock 7%
        const investment_value = holding_qty * 1;
        return { current_value, investment_value, type: holding.type };
      }
      
      const current_value = holding_qty * current_price;
      const investment_value = holding_qty * holding_avg_cost;
      return { current_value, investment_value, type: holding.type };
    });

    const holdingResults = await Promise.all(holdingPromises);
    for (const result of holdingResults) {
        total_portfolio_value += result.current_value;
        total_investment_value += result.investment_value;
        if (asset_allocation.hasOwnProperty(result.type)) {
            asset_allocation[result.type] += result.current_value;
        }
    }
    const unrealized_pnl = total_portfolio_value - total_investment_value;

    // 2. Realized P&L
    const transactions = await Transaction.find({ username }).sort({ date: 1 }).lean();
    const buy_queue = {};
    let total_realized_pnl = 0;
    
    // --- ROBUSTNESS CHECK ---
    // This logic will now safely skip transactions with invalid dates
    if (transactions.length > 0) {
      for (const tx of transactions) {
        // --- THIS IS THE FIX ---
        // Skip if date is invalid
        if (!tx.date || typeof tx.date !== 'string') continue; 
        
        const instrument = tx.instrument;
        const tx_quantity = tx.quantity;
        const tx_price = tx.price;
        if (tx.type === 'BUY') {
          if (!buy_queue[instrument]) buy_queue[instrument] = [];
          buy_queue[instrument].push({ quantity: tx_quantity, price: tx_price });
        } else if (tx.type === 'SELL') {
          let sell_quantity = tx_quantity;
          let sale_price = tx_price;
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
    // --- END OF FIX ---

    // 3. Combine and Format
    const total_net_pnl = unrealized_pnl + total_realized_pnl;
    const portfolio_history = [{ name: 'Start', value: total_investment_value }, { name: 'Now', value: total_portfolio_value }];
    const profit_loss_history = [{ name: 'Start', pnl: 0 }, { name: 'Now', pnl: total_net_pnl }];
    const filtered_asset_allocation = Object.entries(asset_allocation).filter(([key, value]) => value > 0);
    const formatted_asset_allocation = filtered_asset_allocation.map(([key, value]) => ({ name: key, value: Number(value.toFixed(2)) }));

    res.status(200).json({
      totalPortfolioValue: Number(total_portfolio_value.toFixed(2)),
      totalProfitLoss: Number(total_net_pnl.toFixed(2)),
      unrealizedPnl: Number(unrealized_pnl.toFixed(2)),
      realizedPnl: Number(total_realized_pnl.toFixed(2)),
      portfolioHistory: portfolio_history,
      profitLossHistory: profit_loss_history,
      assetAllocation: formatted_asset_allocation,
    });
  } catch (err) {
    console.error(`Dashboard Error: ${err.message}`);
    res.status(500).json({ message: 'Dashboard calculation failed: An internal error occurred.' });
  }
});

module.exports = router;

