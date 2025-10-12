import os
import requests # <-- Import the requests library
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from flask_bcrypt import Bcrypt
from urllib.parse import quote_plus

# Load environment variables
load_dotenv()

# Initialize Flask, Bcrypt, CORS
app = Flask(__name__)
bcrypt = Bcrypt(app)
CORS(app)

# --- Get API Key from environment ---
finnhub_api_key = os.getenv('FINNHUB_API_KEY') # <-- Load the API key

# --- Database Connection ---
mongo_user = quote_plus(os.getenv('MONGO_USER'))
mongo_password = quote_plus(os.getenv('MONGO_PASSWORD'))
mongo_cluster_url = os.getenv('MONGO_CLUSTER_URL')
mongo_uri = f"mongodb+srv://{mongo_user}:{mongo_password}@{mongo_cluster_url}"

client = MongoClient(mongo_uri)
db = client.get_database('portfolio_db')
users_collection = db.get_collection('users')

# --- Authentication Endpoints (Register & Login) ---
# ... (The /auth/register and /auth/login routes remain exactly the same) ...
@app.route('/auth/register', methods=['POST'])
def register():
    # (code is unchanged)
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if users_collection.find_one({'username': username}):
        return jsonify({'message': 'Username already exists'}), 409
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    users_collection.insert_one({'username': username, 'password': hashed_password})
    return jsonify({'message': 'User registered successfully'}), 201

# In backend/app.py

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = users_collection.find_one({'username': username})

    if user and bcrypt.check_password_hash(user['password'], password):
        # Get the profile pic url from the DB; it will be None if not set
        profile_pic_url = user.get('profile_pic_url', None)
        
        # Send back the username and pic url in a 'user' object
        return jsonify({
            'message': f'Login successful! Welcome {user["username"]}',
            'user': {'username': user['username'], 'profile_pic_url': profile_pic_url}
        }), 200
    else:
        return jsonify({'message': 'Invalid username or password'}), 401
# --- Dashboard Endpoint ---
# ... (The /dashboard/summary route remains exactly the same) ...
@app.route('/dashboard/summary', methods=['GET'])
def dashboard_summary():
    # (code is unchanged)
    mock_holdings = [{'type': 'Equity', 'symbol': 'AAPL', 'quantity': 10, 'purchase_price': 150}, {'type': 'Equity', 'symbol': 'GOOGL', 'quantity': 5, 'purchase_price': 2800}, {'type': 'Bonds', 'symbol': 'US-TREASURY', 'quantity': 20, 'purchase_price': 98}, {'type': 'FD', 'symbol': 'HDFC-FD', 'quantity': 50000, 'purchase_price': 1}]
    mock_current_prices = {'AAPL': 175, 'GOOGL': 2950, 'US-TREASURY': 99, 'HDFC-FD': 1.05}
    total_portfolio_value = 0
    total_investment_value = 0
    asset_allocation = {'Equity': 0, 'Bonds': 0, 'FD': 0}
    for holding in mock_holdings:
        current_price = mock_current_prices[holding['symbol']]
        current_value = holding['quantity'] * current_price
        investment_value = holding['quantity'] * holding['purchase_price']
        total_portfolio_value += current_value
        total_investment_value += investment_value
        asset_allocation[holding['type']] += current_value
    profit_loss = total_portfolio_value - total_investment_value
    portfolio_history = [{'name': '6M Ago', 'value': 75000}, {'name': '3M Ago', 'value': 78000}, {'name': '1M Ago', 'value': 85000}, {'name': '1W Ago', 'value': 82000}, {'name': 'Today', 'value': total_portfolio_value}]
    profit_loss_history = [{'name': '6M Ago', 'pnl': -500}, {'name': '3M Ago', 'pnl': 1200}, {'name': '1M Ago', 'pnl': 800}, {'name': '1W Ago', 'pnl': 2500}, {'name': 'Today', 'pnl': profit_loss}]
    formatted_asset_allocation = [{'name': key, 'value': round(value, 2)} for key, value in asset_allocation.items()]
    summary_data = {'totalPortfolioValue': round(total_portfolio_value, 2), 'totalProfitLoss': round(profit_loss, 2), 'portfolioHistory': portfolio_history, 'profitLossHistory': profit_loss_history, 'assetAllocation': formatted_asset_allocation}
    return jsonify(summary_data), 200

# --- NEW HOLDINGS ENDPOINT ---
@app.route('/api/holdings', methods=['GET'])
def get_holdings():
    # Again, we use mock data. Later, this will come from a user-specific DB query.
    mock_holdings = [
        {'instrument': 'Reliance Industries', 'symbol': 'RELIANCE.NS', 'quantity': 50, 'avg_cost': 2300.50, 'type': 'Equity'},
        {'instrument': 'Tata Consultancy', 'symbol': 'TCS.NS', 'quantity': 100, 'avg_cost': 3200.00, 'type': 'Equity'},
        {'instrument': 'Apple Inc.', 'symbol': 'AAPL', 'quantity': 20, 'avg_cost': 145.70, 'type': 'Equity'},
        {'instrument': 'SBI Fixed Deposit', 'symbol': 'SBI-FD', 'quantity': 200000, 'avg_cost': 1, 'type': 'FD'},
    ]

    enriched_holdings = []
    for holding in mock_holdings:
        if holding['type'] == 'Equity':
            try:
                # Make the real API call to Finnhub
                url = f"https://finnhub.io/api/v1/quote?symbol={holding['symbol']}&token={finnhub_api_key}"
                response = requests.get(url)
                response.raise_for_status() # Raise an exception for bad status codes
                data = response.json()
                current_price = data.get('c', 0) # 'c' is the key for current price
            except requests.exceptions.RequestException as e:
                print(f"API call failed for {holding['symbol']}: {e}")
                current_price = holding['avg_cost'] # Fallback to purchase price on error
        elif holding['type'] == 'FD':
            # For FDs, we'll just mock a 7% annual interest for now
            current_price = holding['avg_cost'] * 1.07
        else:
            current_price = holding['avg_cost']

        # Perform calculations
        holding['current_price'] = round(current_price, 2)
        holding['total_value'] = round(holding['quantity'] * current_price, 2)
        holding['pnl'] = round((current_price - holding['avg_cost']) * holding['quantity'], 2)
        enriched_holdings.append(holding)

    return jsonify(enriched_holdings)

@app.route('/api/fd-rates', methods=['GET'])
def get_fd_rates():
    # In a real application, this data would be scraped and stored in the DB daily.
    # For now, we'll use mock data.
    mock_fd_rates = [
        {'bank_name': 'State Bank of India (SBI)', 'rate': '7.10%', 'tenor': '1 Year'},
        {'bank_name': 'HDFC Bank', 'rate': '7.25%', 'tenor': '1 Year'},
        {'bank_name': 'ICICI Bank', 'rate': '7.20%', 'tenor': '1 Year'},
        {'bank_name': 'Kotak Mahindra Bank', 'rate': '7.40%', 'tenor': '1 Year'},
        {'bank_name': 'Axis Bank', 'rate': '7.20%', 'tenor': '1 Year'},
    ]
    return jsonify(mock_fd_rates)
# --- NEW TRANSACTIONS ENDPOINT ---
# In backend/app.py

@app.route('/api/reports/transactions', methods=['GET'])
def get_transactions():
    # Updated mock data to include timestamps
    mock_transactions = [
        {'date': '2025-09-15 14:30:15', 'type': 'BUY', 'instrument': 'Reliance Industries', 'quantity': 50, 'price': 2300.50},
        {'date': '2025-08-22 10:05:45', 'type': 'BUY', 'instrument': 'Tata Consultancy', 'quantity': 100, 'price': 3200.00},
        {'date': '2025-07-01 11:15:00', 'type': 'BUY', 'instrument': 'Apple Inc.', 'quantity': 20, 'price': 145.70},
        {'date': '2025-06-10 09:30:00', 'type': 'DEPOSIT', 'instrument': 'SBI Fixed Deposit', 'quantity': 1, 'price': 200000.00},
        {'date': '2025-05-20 15:10:20', 'type': 'SELL', 'instrument': 'Infosys Ltd', 'quantity': 30, 'price': 1500.00},
    ]
    return jsonify(mock_transactions)
# In backend/app.py, add this new route

# --- NEW DELETE ACCOUNT ENDPOINT ---
@app.route('/api/account/delete', methods=['DELETE'])
def delete_account():
    # In a real app, we would get the user from a secure session token (JWT).
    # For now, we'll get the username from the request body for demonstration.
    data = request.get_json()
    username = data.get('username')

    if not username:
        return jsonify({'message': 'Username is required'}), 400

    result = users_collection.delete_one({'username': username})

    if result.deleted_count == 1:
        return jsonify({'message': 'Account deleted successfully'}), 200
    else:
        return jsonify({'message': 'User not found'}), 404
# In backend/app.py, replace the old update_profile function with this one

@app.route('/api/account/profile', methods=['PUT'])
def update_profile():
    data = request.get_json()
    username = data.get('username')
    profile_pic_url = data.get('profile_pic_url')

    if not username or not profile_pic_url:
        return jsonify({'message': 'Username and profile picture URL are required'}), 400

    # Find the user and update only the profile picture URL
    result = users_collection.update_one(
        {'username': username},
        {'$set': {'profile_pic_url': profile_pic_url}}
    )

    if result.matched_count == 0:
        return jsonify({'message': 'User not found'}), 404

    return jsonify({'message': 'Profile picture updated successfully'}), 200
# --- Main Run ---
if __name__ == '__main__':
    app.run(debug=True)