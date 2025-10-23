import os
import requests
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from flask_bcrypt import Bcrypt
from urllib.parse import quote_plus
from werkzeug.utils import secure_filename
import string
import random

# Load environment variables
load_dotenv()

# Initialize Flask, Bcrypt, CORS
app = Flask(__name__)
bcrypt = Bcrypt(app)
CORS(app)

# --- Configuration ---
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
finnhub_api_key = os.getenv('FINNHUB_API_KEY') # Corrected variable name

# --- Database Connection ---
mongo_user = quote_plus(os.getenv('MONGO_USER'))
mongo_password = quote_plus(os.getenv('MONGO_PASSWORD'))
mongo_cluster_url = os.getenv('MONGO_CLUSTER_URL')
mongo_uri = f"mongodb+srv://{mongo_user}:{mongo_password}@{mongo_cluster_url}"

client = MongoClient(mongo_uri)
db = client.get_database('portfolio_db')
users_collection = db.get_collection('users')
holdings_collection = db.get_collection('holdings')
transactions_collection = db.get_collection('transactions')

# --- Helper Functions ---
def generate_unique_username():
    """Generates a unique 6-character alphanumeric username."""
    while True:
        username = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not users_collection.find_one({'username': username}):
            return username

# --- AUTHENTICATION ROUTES ---
@app.route('/auth/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    data = request.get_json()
    identifier = data.get('identifier'); password = data.get('password')
    if not identifier or not password: return jsonify({'message': 'Identifier and password are required'}), 400
    is_email = '@' in identifier
    user_data = {'email': identifier} if is_email else {'phone_number': identifier}
    if users_collection.find_one(user_data): return jsonify({'message': 'An account with this identifier already exists'}), 409
    username = generate_unique_username()
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    user_data['username'] = username; user_data['password'] = hashed_password
    users_collection.insert_one(user_data)
    return jsonify({'message': 'User registered successfully!', 'username': username}), 201

@app.route('/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    data = request.get_json()
    identifier = data.get('identifier'); password = data.get('password')
    if not identifier or not password: return jsonify({'message': 'Identifier and password are required'}), 400
    user = users_collection.find_one({'$or': [{'username': identifier}, {'email': identifier}, {'phone_number': identifier}]})
    if user and bcrypt.check_password_hash(user['password'], password):
        profile_pic_url = user.get('profile_pic_url', None)
        full_name = user.get('full_name', None)
        return jsonify({'message': f'Login successful! Welcome {user["username"]}', 'user': {'username': user['username'], 'profile_pic_url': profile_pic_url, 'full_name': full_name}}), 200
    else: return jsonify({'message': 'Invalid credentials or password'}), 401

# --- DASHBOARD ROUTE (STABLE VERSION - UNIFIED LOGIC) ---
@app.route('/dashboard/summary', methods=['GET'])
def dashboard_summary():
    username = request.args.get('username')
    if not username: return jsonify({'message': 'Username is required'}), 400

    try:
        # --- 1. UNREALIZED P&L AND ASSET ALLOCATION (from current holdings) ---
        real_holdings = list(holdings_collection.find({'username': username}))
        total_portfolio_value = 0
        total_investment_value = 0
        asset_allocation = {'Equity': 0, 'Bonds': 0, 'FD': 0}

        for holding in real_holdings:
            current_price = 0
            if holding['type'] == 'Equity':
                try:
                    # Check if symbol exists before making API call
                    if 'symbol' in holding and holding['symbol']:
                         url = f"https://finnhub.io/api/v1/quote?symbol={holding['symbol']}&token={finnhub_api_key}"
                         response = requests.get(url); response.raise_for_status(); data = response.json(); current_price = data.get('c', 0)
                    else:
                         current_price = holding.get('avg_cost', 0) # Fallback if symbol is missing
                except requests.exceptions.RequestException as e:
                    print(f"Finnhub API error for {holding.get('symbol', 'N/A')}: {e}")
                    current_price = holding.get('avg_cost', 0) # Use avg_cost as fallback on error
                # Ensure current_price is a number
                if not isinstance(current_price, (int, float)):
                    current_price = holding.get('avg_cost', 0)

            elif holding['type'] == 'FD':
                 # Use avg_cost (which is 1) and quantity (which is principal) for FD value
                 current_price = 1.07 # Mock 7% interest for value calculation, not stored
                 current_value = holding.get('quantity', 0) * current_price
                 investment_value = holding.get('quantity', 0) * holding.get('avg_cost', 1)
            else: # For Bonds or other types, use avg_cost for now
                 current_price = holding.get('avg_cost', 0)
                 current_value = holding.get('quantity', 0) * current_price
                 investment_value = holding.get('quantity', 0) * holding.get('avg_cost', 0)

            # Recalculate current_value and investment_value if not FD
            if holding['type'] != 'FD':
                current_value = holding.get('quantity', 0) * current_price
                investment_value = holding.get('quantity', 0) * holding.get('avg_cost', 0)

            total_portfolio_value += current_value
            total_investment_value += investment_value
            if holding['type'] in asset_allocation: asset_allocation[holding['type']] += current_value

        unrealized_pnl = total_portfolio_value - total_investment_value

        # --- 2. REALIZED P&L (from transaction history) ---
        transactions = list(transactions_collection.find({'username': username}).sort('date', 1))
        buy_queue = {}
        total_realized_pnl = 0
        if transactions:
            for tx in transactions:
                instrument = tx['instrument']
                # Ensure quantity and price are numbers
                tx_quantity = float(tx.get('quantity', 0))
                tx_price = float(tx.get('price', 0))

                if tx['type'] == 'BUY':
                    buy_queue.setdefault(instrument, []).append({'quantity': tx_quantity, 'price': tx_price})
                elif tx['type'] == 'SELL':
                    sell_quantity = tx_quantity; sale_price = tx_price
                    cost_of_sold_shares = 0
                    while sell_quantity > 0 and buy_queue.get(instrument):
                        oldest_buy = buy_queue[instrument][0]
                        # Ensure buy queue values are numbers
                        oldest_buy_qty = float(oldest_buy.get('quantity', 0))
                        oldest_buy_price = float(oldest_buy.get('price', 0))

                        qty_to_sell = min(sell_quantity, oldest_buy_qty)
                        cost_of_sold_shares += qty_to_sell * oldest_buy_price
                        oldest_buy['quantity'] = oldest_buy_qty - qty_to_sell # Update remaining qty
                        if oldest_buy['quantity'] <= 0.0001: buy_queue[instrument].pop(0)
                        sell_quantity -= qty_to_sell
                    total_realized_pnl += (tx_quantity * sale_price) - cost_of_sold_shares

        # --- 3. COMBINE AND FORMAT FINAL RESPONSE ---
        total_net_pnl = unrealized_pnl + total_realized_pnl

        # Simplified history for the graphs
        portfolio_history = [{'name': 'Start', 'value': total_investment_value}, {'name': 'Now', 'value': total_portfolio_value}]
        profit_loss_history = [{'name': 'Start', 'pnl': 0}, {'name': 'Now', 'pnl': total_net_pnl}]

        filtered_asset_allocation = {k: v for k, v in asset_allocation.items() if v > 0}
        formatted_asset_allocation = [{'name': key, 'value': round(value, 2)} for key, value in filtered_asset_allocation.items()]

        return jsonify({
            'totalPortfolioValue': round(total_portfolio_value, 2),
            'totalProfitLoss': round(total_net_pnl, 2),
            'unrealizedPnl': round(unrealized_pnl, 2),
            'realizedPnl': round(total_realized_pnl, 2),
            'portfolioHistory': portfolio_history,
            'profitLossHistory': profit_loss_history,
            'assetAllocation': formatted_asset_allocation
        })
    except Exception as e:
        # Print detailed error to backend console for debugging
        import traceback
        print(f"!!! DASHBOARD CRASH !!!: {e}")
        traceback.print_exc()
        return jsonify({'message': f'Dashboard calculation failed: An internal error occurred.'}), 500


# --- HOLDINGS ROUTES ---
@app.route('/api/holdings', methods=['POST', 'OPTIONS'])
def add_holding():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    data = request.get_json()
    username = data.get('username'); symbol = data.get('symbol', '').upper()
    try:
        new_quantity = float(data.get('quantity', 0)); purchase_price = float(data.get('purchase_price', 0))
    except (ValueError, TypeError):
         return jsonify({'message': 'Invalid quantity or price'}), 400
    if not all([username, symbol, new_quantity > 0, purchase_price >= 0]): return jsonify({'message': 'Missing or invalid data'}), 400
    existing_holding = holdings_collection.find_one({'username': username, 'symbol': symbol})
    if existing_holding:
        current_quantity = float(existing_holding.get('quantity', 0)); current_avg_cost = float(existing_holding.get('avg_cost', 0))
        total_value_old = current_quantity * current_avg_cost; total_value_new = new_quantity * purchase_price
        new_total_quantity = current_quantity + new_quantity
        # Avoid division by zero if new_total_quantity is 0 (shouldn't happen with BUY)
        new_avg_cost = (total_value_old + total_value_new) / new_total_quantity if new_total_quantity else 0
        holdings_collection.update_one({'_id': existing_holding['_id']}, {'$set': {'quantity': new_total_quantity, 'avg_cost': new_avg_cost}})
    else:
        holding_doc = {'username': username, 'symbol': symbol, 'instrument': data.get('instrument', symbol), 'quantity': new_quantity, 'avg_cost': purchase_price, 'type': 'Equity'}
        holdings_collection.insert_one(holding_doc)
    transaction_doc = {'username': username, 'date': datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 'type': 'BUY', 'instrument': data.get('instrument', symbol), 'quantity': new_quantity, 'price': purchase_price}
    transactions_collection.insert_one(transaction_doc)
    return jsonify({'message': 'Holding updated successfully'}), 201

@app.route('/api/holdings/sell', methods=['POST', 'OPTIONS'])
def sell_holding():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    data = request.get_json()
    username = data.get('username'); symbol = data.get('symbol')
    try:
        sell_quantity = float(data.get('quantity', 0)); sell_price = float(data.get('price', 0))
    except (ValueError, TypeError):
        return jsonify({'message': 'Invalid quantity or price'}), 400
    if not all([username, symbol, sell_quantity > 0, sell_price >= 0]): return jsonify({'message': 'Missing or invalid data'}), 400
    current_holding = holdings_collection.find_one({'username': username, 'symbol': symbol})
    if not current_holding: return jsonify({'message': 'Holding not found'}), 404
    current_quantity = float(current_holding.get('quantity', 0))
    if sell_quantity > current_quantity: return jsonify({'message': 'You cannot sell more stocks than you own'}), 400
    # Use a small tolerance for floating point comparisons
    if abs(sell_quantity - current_quantity) < 0.0001:
        holdings_collection.delete_one({'_id': current_holding['_id']})
    else:
        new_quantity = current_quantity - sell_quantity
        holdings_collection.update_one({'_id': current_holding['_id']}, {'$set': {'quantity': new_quantity}})
    transaction_doc = {'username': username, 'date': datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 'type': 'SELL', 'instrument': current_holding.get('instrument', symbol), 'quantity': sell_quantity, 'price': sell_price}
    transactions_collection.insert_one(transaction_doc)
    return jsonify({'message': 'Sale recorded successfully'}), 200

@app.route('/api/holdings/add-fd', methods=['POST', 'OPTIONS'])
def add_fd():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    data = request.get_json()
    username = data.get('username'); instrument = data.get('instrument')
    try:
        quantity = float(data.get('quantity', 0)) # Principal amount
    except (ValueError, TypeError):
        return jsonify({'message': 'Invalid investment amount'}), 400
    if not all([username, instrument, quantity > 0]): return jsonify({'message': 'Missing data'}), 400
    holding_doc = {'username': username, 'symbol': instrument.replace(" ", "-").upper(), 'instrument': instrument, 'quantity': quantity, 'avg_cost': 1, 'type': 'FD'}
    holdings_collection.insert_one(holding_doc)
    transaction_doc = {'username': username, 'date': datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 'type': 'DEPOSIT', 'instrument': instrument, 'quantity': 1, 'price': quantity}
    transactions_collection.insert_one(transaction_doc)
    return jsonify({'message': 'FD investment recorded successfully'}), 201

@app.route('/api/holdings', methods=['GET'])
def get_holdings():
    username = request.args.get('username')
    if not username: return jsonify({'message': 'Username is required'}), 400
    try:
        user_holdings_cursor = holdings_collection.find({'username': username})
        real_holdings = [h for h in user_holdings_cursor]
        for h in real_holdings: h.pop('_id', None) # Remove ObjectId before sending
    except Exception as e: return jsonify({'message': f'Database query failed: {e}'}), 500
    enriched_holdings = []
    for holding in real_holdings:
        current_price = 0
        holding_qty = float(holding.get('quantity', 0))
        holding_avg_cost = float(holding.get('avg_cost', 0))
        if holding['type'] == 'Equity':
            try:
                if 'symbol' in holding and holding['symbol']:
                     url = f"https://finnhub.io/api/v1/quote?symbol={holding['symbol']}&token={finnhub_api_key}"
                     response = requests.get(url); response.raise_for_status(); data = response.json(); current_price = data.get('c', 0)
                else: current_price = holding_avg_cost
            except requests.exceptions.RequestException: current_price = holding_avg_cost
            if not isinstance(current_price, (int, float)): current_price = holding_avg_cost
        elif holding['type'] == 'FD':
             # For display, show principal + mock interest in value, but use principal for P/L base
             current_price_display_factor = 1.07 # Used only for display value
             current_value = holding_qty * current_price_display_factor
             investment_value = holding_qty * 1 # Cost basis is principal
             holding['current_price'] = round(current_price_display_factor, 2) # Show interest factor
             holding['total_value'] = round(current_value, 2)
             holding['pnl'] = round(current_value - investment_value, 2)
             enriched_holdings.append(holding)
             continue # Skip common calculation for FD
        else: current_price = holding_avg_cost # Fallback for other types

        holding['current_price'] = round(current_price, 2)
        holding['total_value'] = round(holding_qty * current_price, 2)
        holding['pnl'] = round((current_price - holding_avg_cost) * holding_qty, 2)
        enriched_holdings.append(holding)
    return jsonify(enriched_holdings)

# --- REPORTS & OTHER DATA ROUTES ---
@app.route('/api/fd-rates', methods=['GET'])
def get_fd_rates():
    mock_fd_rates = [
        {'bank_name': 'State Bank of India (SBI)', 'rate': '7.10%', 'tenor': '1 Year'},
        {'bank_name': 'HDFC Bank', 'rate': '7.25%', 'tenor': '1 Year'},
        {'bank_name': 'ICICI Bank', 'rate': '7.20%', 'tenor': '1 Year'},
        {'bank_name': 'Kotak Mahindra Bank', 'rate': '7.40%', 'tenor': '1 Year'},
        {'bank_name': 'Axis Bank', 'rate': '7.20%', 'tenor': '1 Year'},
    ]
    return jsonify(mock_fd_rates)

@app.route('/api/reports/transactions', methods=['GET'])
def get_transactions():
    username = request.args.get('username')
    if not username: return jsonify({'message': 'Username is required'}), 400
    try:
        transactions_cursor = transactions_collection.find({'username': username}).sort('date', -1)
        real_transactions = []
        for tx in transactions_cursor:
            tx.pop('_id', None)
            real_transactions.append(tx)
        return jsonify(real_transactions)
    except Exception as e: return jsonify({'message': f'Database query failed: {e}'}), 500

@app.route('/api/reports/pnl', methods=['GET'])
def get_pnl_statement():
    username = request.args.get('username')
    if not username: return jsonify({'message': 'Username is required'}), 400
    try:
        transactions = list(transactions_collection.find({'username': username}).sort('date', 1))
        transactions_by_symbol = {}
        for tx in transactions: transactions_by_symbol.setdefault(tx['instrument'], []).append(tx)
        pnl_summary = []
        for symbol, tx_list in transactions_by_symbol.items():
            buy_queue = []; total_cost_of_sold_shares = 0; total_value_from_sales = 0
            for tx in tx_list:
                tx_quantity = float(tx.get('quantity', 0))
                tx_price = float(tx.get('price', 0))
                if tx['type'] == 'BUY':
                    buy_queue.append({'quantity': tx_quantity, 'price': tx_price})
                elif tx['type'] == 'SELL':
                    sell_quantity = tx_quantity; sale_price = tx_price
                    total_value_from_sales += sell_quantity * sale_price
                    while sell_quantity > 0 and buy_queue:
                        oldest_buy = buy_queue[0]
                        oldest_buy_qty = float(oldest_buy.get('quantity', 0))
                        oldest_buy_price = float(oldest_buy.get('price', 0))
                        qty_to_sell = min(sell_quantity, oldest_buy_qty)
                        total_cost_of_sold_shares += qty_to_sell * oldest_buy_price
                        oldest_buy['quantity'] = oldest_buy_qty - qty_to_sell
                        if oldest_buy['quantity'] <= 0.0001: buy_queue.pop(0)
                        sell_quantity -= qty_to_sell
            if total_value_from_sales > 0:
                realized_pnl = total_value_from_sales - total_cost_of_sold_shares
                pnl_summary.append({'instrument': symbol, 'total_sale_value': round(total_value_from_sales, 2), 'cost_basis': round(total_cost_of_sold_shares, 2), 'realized_pnl': round(realized_pnl, 2)})
        return jsonify(pnl_summary)
    except Exception as e: return jsonify({'message': f'Calculation failed: {e}'}), 500

@app.route('/api/reports/real-returns', methods=['GET'])
def get_real_returns():
    username = request.args.get('username')
    if not username: return jsonify({'message': 'Username is required'}), 400
    INFLATION_RATE = 0.060
    try:
        transactions = list(transactions_collection.find({'username': username}).sort('date', 1))
        transactions_by_symbol = {}
        for tx in transactions: transactions_by_symbol.setdefault(tx['instrument'], []).append(tx)
        real_return_summary = []
        for symbol, tx_list in transactions_by_symbol.items():
            buy_queue = []; total_realized_pnl = 0; total_inflation_adjustment = 0; has_sales = False
            for tx in tx_list:
                tx_date = datetime.strptime(tx['date'], "%Y-%m-%d %H:%M:%S")
                tx_quantity = float(tx.get('quantity', 0))
                tx_price = float(tx.get('price', 0))
                if tx['type'] == 'BUY':
                    buy_queue.append({'quantity': tx_quantity, 'price': tx_price, 'date': tx_date})
                elif tx['type'] == 'SELL':
                    has_sales = True; sell_quantity = tx_quantity; sale_price = tx_price
                    while sell_quantity > 0 and buy_queue:
                        oldest_buy = buy_queue[0]; buy_date = oldest_buy['date']
                        oldest_buy_qty = float(oldest_buy.get('quantity', 0))
                        oldest_buy_price = float(oldest_buy.get('price', 0))
                        qty_to_sell = min(sell_quantity, oldest_buy_qty)
                        holding_period_days = (tx_date - buy_date).days; holding_period_years = max(0, holding_period_days / 365.25) # Ensure non-negative years
                        cost_basis = qty_to_sell * oldest_buy_price; sale_value = qty_to_sell * sale_price
                        nominal_pnl = sale_value - cost_basis
                        inflation_adjusted_sale_value = sale_value / ((1 + INFLATION_RATE) ** holding_period_years) if holding_period_years > 0 else sale_value
                        real_pnl = inflation_adjusted_sale_value - cost_basis
                        total_realized_pnl += nominal_pnl; total_inflation_adjustment += (nominal_pnl - real_pnl)
                        oldest_buy['quantity'] = oldest_buy_qty - qty_to_sell
                        if oldest_buy['quantity'] <= 0.0001: buy_queue.pop(0)
                        sell_quantity -= qty_to_sell
            if has_sales:
                real_return_summary.append({'instrument': symbol, 'nominal_pnl': round(total_realized_pnl, 2), 'inflation_adjustment': round(total_inflation_adjustment, 2), 'real_pnl': round(total_realized_pnl - total_inflation_adjustment, 2)})
        return jsonify(real_return_summary)
    except Exception as e: return jsonify({'message': f'Real return calculation failed: {e}'}), 500

# In backend/app.py, replace the get_cibil_score function

@app.route('/api/reports/cibil-score', methods=['GET'])
def get_cibil_score():
    username = request.args.get('username')
    if not username: return jsonify({'message': 'Username is required'}), 400
    try:
        holdings = list(holdings_collection.find({'username': username}))
        transactions = list(transactions_collection.find({'username': username}).sort('date', 1))
        
        base_score = 300; diversification_score = 0; profitability_score = 0; discipline_score = 0
        days_investing = 0 # Initialize days_investing

        # 1. Diversification Score (Max 200)
        num_unique_holdings = len(holdings)
        diversification_score = min(200, num_unique_holdings * 20)
        
        # 2. Profitability Score (Max 200)
        buy_queue = {}; total_realized_pnl = 0
        if transactions: # Check if transactions exist before calculating PnL
            for tx in transactions:
                instrument = tx['instrument']
                tx_quantity = float(tx.get('quantity', 0)); tx_price = float(tx.get('price', 0))
                if tx['type'] == 'BUY': buy_queue.setdefault(instrument, []).append({'quantity': tx_quantity, 'price': tx_price})
                elif tx['type'] == 'SELL':
                    sell_quantity = tx_quantity; sale_price = tx_price; cost_of_sold_shares = 0
                    while sell_quantity > 0 and buy_queue.get(instrument):
                        oldest_buy = buy_queue[instrument][0]
                        oldest_buy_qty = float(oldest_buy.get('quantity', 0)); oldest_buy_price = float(oldest_buy.get('price', 0))
                        qty_to_sell = min(sell_quantity, oldest_buy_qty)
                        cost_of_sold_shares += qty_to_sell * oldest_buy_price
                        oldest_buy['quantity'] = oldest_buy_qty - qty_to_sell
                        if oldest_buy['quantity'] <= 0.0001: buy_queue[instrument].pop(0)
                        sell_quantity -= qty_to_sell
                    total_realized_pnl += (tx_quantity * sale_price) - cost_of_sold_shares
        
        if total_realized_pnl > 50000: profitability_score = 200
        elif total_realized_pnl > 10000: profitability_score = 150
        elif total_realized_pnl > 0: profitability_score = 100
        elif total_realized_pnl <= 0: profitability_score = 50

        # 3. Discipline Score & Feedback (Max 200)
        discipline_feedback = "No History Yet" # Default label
        if transactions:
            first_tx_date = datetime.strptime(transactions[0]['date'], "%Y-%m-%d %H:%M:%S")
            days_investing = (datetime.now() - first_tx_date).days
            discipline_score = min(200, int(days_investing / 3.65)) # Score calculation remains

            # --- NEW USER-FRIENDLY LABELS ---
            if days_investing > 730: # Over 2 years
                discipline_feedback = "Veteran Investor!"
            elif days_investing > 365: # Over 1 year
                discipline_feedback = "Long-Term Focused"
            elif days_investing > 180: # Over 6 months
                discipline_feedback = "Getting Consistent"
            elif days_investing > 30: # Over 1 month
                discipline_feedback = "Building Habits"
            elif days_investing >= 0: # 0 to 30 days
                discipline_feedback = "Just Started!"
        
        total_score = base_score + diversification_score + profitability_score + discipline_score

        # --- UPDATED FEEDBACK DICTIONARY ---
        feedback = {
            "Diversification": "Excellent" if diversification_score > 150 else "Good" if diversification_score > 80 else "Needs Improvement",
            "Profitability": "Excellent" if profitability_score > 150 else "Good" if profitability_score > 100 else "Average",
            "Discipline": discipline_feedback # Use the new label
        }

        return jsonify({
            'score': total_score,
            'breakdown': {
                'Base Score': base_score,
                'Diversification': diversification_score,
                'Profitability': profitability_score,
                'Discipline': discipline_score # Keep the score for the breakdown
            },
            'feedback': feedback # Send the user-friendly labels
        })
    except Exception as e:
        import traceback; print(f"!!! CIBIL CRASH !!!: {e}"); traceback.print_exc()
        return jsonify({'message': f'Score calculation failed: {e}'}), 500
# --- ACCOUNT MANAGEMENT ROUTES ---
@app.route('/api/account/profile', methods=['PUT', 'OPTIONS'])
def update_profile():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    data = request.get_json()
    username = data.get('username'); full_name = data.get('full_name')
    if not username: return jsonify({'message': 'Username is required'}), 400
    result = users_collection.update_one({'username': username}, {'$set': {'full_name': full_name}})
    if result.matched_count == 0: return jsonify({'message': 'User not found'}), 404
    return jsonify({'message': 'Profile updated successfully'}), 200

@app.route('/api/account/delete', methods=['DELETE', 'OPTIONS']) # Added OPTIONS
def delete_account():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200 # Handle OPTIONS
    data = request.get_json()
    username = data.get('username')
    if not username: return jsonify({'message': 'Username is required'}), 400
    
    # Also delete user's holdings and transactions (optional but good practice)
    holdings_collection.delete_many({'username': username})
    transactions_collection.delete_many({'username': username})
    
    # Delete the user
    result = users_collection.delete_one({'username': username})
    
    if result.deleted_count == 1: return jsonify({'message': 'Account deleted successfully'}), 200
    else: return jsonify({'message': 'User not found'}), 404
    
# --- UPLOAD ROUTE ---
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --- MAIN RUNNER ---
if __name__ == '__main__':
    app.run(debug=True)

