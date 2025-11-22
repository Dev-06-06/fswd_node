const express = require('express');
const router = express.Router();
const axios = require('axios');
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');

// --- REMOVE FINNHUB KEY ---
// const finnhub_api_key = process.env.FINNHUB_API_KEY; // This line is no longer needed

// Helper: Parse date string safely
function parseDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

// --- Get Dashboard Summary (NOW USES KITE PRICE API) ---
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

    // Get symbols for price fetch
    const equitySymbols = real_holdings
        .filter(h => h.type === 'Equity' && h.symbol)
        .map(h => h.symbol);

    let livePrices = {};
    if (equitySymbols.length > 0) {
        try {
            // --- THIS IS THE CHANGE ---
            // Call our broker route to get prices
            const priceResponse = await axios.post(`http://127.0.0.1:${process.env.PORT || 5000}/api/broker/get-live-prices`, {
                username: username,
                symbols: equitySymbols
            });
            livePrices = priceResponse.data;
            // --- END OF CHANGE ---
        } catch (priceError) {
            console.error("Error in get-live-prices call:", priceError.message);
            // On failure, livePrices will be empty, and we'll use avg_cost
        }
    }

    // Process holdings
    for (const holding of real_holdings) {
      const holding_qty = holding.quantity;
      const holding_avg_cost = holding.avg_cost;

      if (holding.type === 'Equity') {
        const current_price = livePrices[holding.symbol] || holding_avg_cost;
        const current_value = holding_qty * current_price;
        const investment_value = holding_qty * holding_avg_cost;
        
        total_portfolio_value += current_value;
        total_investment_value += investment_value;
        if (asset_allocation.hasOwnProperty(holding.type)) {
            asset_allocation[holding.type] += current_value;
        }
      } else if (holding.type === 'FD') {
        const current_value = holding_qty * 1.07; // Mock 7%
        const investment_value = holding_qty * 1;
        
        total_portfolio_value += current_value;
        total_investment_value += investment_value;
        if (asset_allocation.hasOwnProperty(holding.type)) {
            asset_allocation[holding.type] += current_value;
        }
      }
    }
    const unrealized_pnl = total_portfolio_value - total_investment_value;

    // 2. Realized P&L
    const transactions = await Transaction.find({ username }).sort({ date: 1 }).lean();
    const buy_queue = {};
    let total_realized_pnl = 0;
    if (transactions.length > 0) {
      for (const tx of transactions) {
        if (!parseDate(tx.date)) continue; // Robustness check
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