const express = require('express');
const router = express.Router();

// --- Get Mock FD Rates ---
router.get('/fd-rates', (req, res) => {
  const mock_fd_rates = [
    { bank_name: 'State Bank of India (SBI)', rate: '7.10%', tenor: '1 Year' },
    { bank_name: 'HDFC Bank', rate: '7.25%', tenor: '1 Year' },
    { bank_name: 'ICICI Bank', rate: '7.20%', tenor: '1 Year' },
    { bank_name: 'Kotak Mahindra Bank', rate: '7.40%', tenor: '1 Year' },
    { bank_name: 'Axis Bank', rate: '7.20%', tenor: '1 Year' },
  ];
  res.status(200).json(mock_fd_rates);
});

module.exports = router;
