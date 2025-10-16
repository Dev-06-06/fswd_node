import os
import requests
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from flask_bcrypt import Bcrypt
from urllib.parse import quote_plus
import string # For the character set (A-Z, 0-9)
import random

# --- Initialization ---
load_dotenv()
app = Flask(__name__)
bcrypt = Bcrypt(app)
CORS(app)

# --- Configuration & Secrets ---
finnhub_api_key = os.getenv('FINNHUB_API_KEY')

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


# --- Authentication Endpoints ---

# In backend/app.py, replace the old register function

def generate_unique_username():
    """Generates a unique 6-character alphanumeric username."""
    while True:
        # Create a random string of 6 uppercase letters and digits
        username = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        # Check if it already exists in the database
        if not users_collection.find_one({'username': username}):
            return username

# In backend/app.py, replace the old register and login functions

@app.route('/auth/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    data = request.get_json()
    identifier = data.get('identifier')
    password = data.get('password')
    if not identifier or not password: return jsonify({'message': 'Identifier and password are required'}), 400
    is_email = '@' in identifier
    user_data = { 'email': identifier } if is_email else { 'phone_number': identifier }
    if users_collection.find_one(user_data): return jsonify({'message': 'An account with this identifier already exists'}), 409
    username = generate_unique_username()
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    user_data['username'] = username
    user_data['password'] = hashed_password
    users_collection.insert_one(user_data)
    return jsonify({'message': 'User registered successfully!', 'username': username}), 201

@app.route('/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS': return jsonify({'status': 'ok'}), 200
    data = request.get_json()
    identifier = data.get('identifier')
    password = data.get('password')
    if not identifier or not password: return jsonify({'message': 'Identifier and password are required'}), 400
    user = users_collection.find_one({'$or': [{'username': identifier}, {'email': identifier}, {'phone_number': identifier}]})
    
    if user and bcrypt.check_password_hash(user['password'], password):
        profile_pic_url = user.get('profile_pic_url', None)
        full_name = user.get('full_name', None) # <-- SEND FULL NAME
        return jsonify({
            'message': f'Login successful! Welcome {user["username"]}',
            'user': {
                'username': user['username'],
                'profile_pic_url': profile_pic_url,
                'full_name': full_name # <-- ADDED
            }
        }), 200
    else:
        return jsonify({'message': 'Invalid credentials or password'}), 401

# --- ACCOUNT ROUTES ---
# In backend/app.py, replace the old update_profile function

@app.route('/api/account/profile', methods=['PUT', 'OPTIONS']) # <-- 1. ADD 'OPTIONS'
def update_profile():
    # --- 2. ADD THIS BLOCK TO HANDLE THE PREFLIGHT REQUEST ---
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    data = request.get_json()
    username = data.get('username')
    full_name = data.get('full_name')

    if not username:
        return jsonify({'message': 'Username is required'}), 400
    
    # Update only the full name
    result = users_collection.update_one(
        {'username': username},
        {'$set': {'full_name': full_name}}
    )

    if result.matched_count == 0:
        return jsonify({'message': 'User not found'}), 404

    return jsonify({'message': 'Profile updated successfully'}), 200

# --- Dashboard Endpoint ---

# In backend/app.py, replace the old dashboard_summary function

@app.route('/dashboard/summary', methods=['GET'])
def dashboard_summary():
    username = request.args.get('username')
    if not username:
        return jsonify({'message': 'Username is required'}), 400

    # --- Step 1: Fetch REAL holdings from the database ---
    try:
        real_holdings_cursor = holdings_collection.find({'username': username})
        real_holdings = [h for h in real_holdings_cursor]
    except Exception as e:
        return jsonify({'message': f'Database query failed: {e}'}), 500

    # --- Step 2: Calculate metrics based on real data ---
    total_portfolio_value = 0
    total_investment_value = 0
    asset_allocation = {'Equity': 0, 'Bonds': 0, 'FD': 0}

    for holding in real_holdings:
        # Get live price (similar to the holdings page logic)
        if holding['type'] == 'Equity':
            try:
                url = f"https://finnhub.io/api/v1/quote?symbol={holding['symbol']}&token={finnhub_api_key}"
                response = requests.get(url); response.raise_for_status(); data = response.json(); current_price = data.get('c', 0)
            except requests.exceptions.RequestException:
                current_price = holding['avg_cost']
        else: # For FD, Bonds, etc. (using mock logic for now)
            current_price = holding['avg_cost'] * 1.07

        current_value = holding['quantity'] * current_price
        investment_value = holding['quantity'] * holding['avg_cost']

        total_portfolio_value += current_value
        total_investment_value += investment_value
        # Ensure the type exists in the dictionary before adding
        if holding['type'] in asset_allocation:
            asset_allocation[holding['type']] += current_value

    profit_loss = total_portfolio_value - total_investment_value

    # Note: Historical data is still mocked for now
    portfolio_history = [
        {'name': 'Start', 'value': total_investment_value},
        {'name': 'Now', 'value': total_portfolio_value}
    ]
    profit_loss_history = [
        {'name': 'Start', 'pnl': 0},
        {'name': 'Now', 'pnl': profit_loss}
    ]
    
    # Filter out empty asset categories before formatting
    filtered_asset_allocation = {k: v for k, v in asset_allocation.items() if v > 0}
    formatted_asset_allocation = [{'name': key, 'value': round(value, 2)} for key, value in filtered_asset_allocation.items()]

    # --- Step 3: Send the final JSON response ---
    summary_data = {
        'totalPortfolioValue': round(total_portfolio_value, 2),
        'totalProfitLoss': round(profit_loss, 2),
        'portfolioHistory': portfolio_history,
        'profitLossHistory': profit_loss_history,
        'assetAllocation': formatted_asset_allocation
    }
    
    return jsonify(summary_data), 200


# --- Holdings Endpoints ---

# In backend/app.py, replace the old add_holding function

@app.route('/api/holdings', methods=['POST', 'OPTIONS'])
def add_holding():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    data = request.get_json()
    username = data.get('username')
    symbol = data.get('symbol', '').upper()
    new_quantity = float(data.get('quantity', 0))
    purchase_price = float(data.get('purchase_price', 0))

    if not all([username, symbol, new_quantity > 0, purchase_price > 0]):
        return jsonify({'message': 'Missing or invalid data'}), 400

    # --- THIS IS THE NEW, SMARTER LOGIC ---

    # Step 1: Check if the user already owns this stock
    existing_holding = holdings_collection.find_one({'username': username, 'symbol': symbol})

    if existing_holding:
        # Step 2a: If it exists, UPDATE the holding
        current_quantity = float(existing_holding.get('quantity', 0))
        current_avg_cost = float(existing_holding.get('avg_cost', 0))

        # Calculate the new total value and new total quantity
        total_value_old = current_quantity * current_avg_cost
        total_value_new = new_quantity * purchase_price
        new_total_quantity = current_quantity + new_quantity
        
        # Calculate the new weighted average cost
        new_avg_cost = (total_value_old + total_value_new) / new_total_quantity

        # Update the document in the database
        holdings_collection.update_one(
            {'_id': existing_holding['_id']},
            {'$set': {'quantity': new_total_quantity, 'avg_cost': new_avg_cost}}
        )
    else:
        # Step 2b: If it doesn't exist, INSERT a new holding
        holding_doc = {
            'username': username,
            'symbol': symbol,
            'instrument': data.get('instrument', symbol),
            'quantity': new_quantity,
            'avg_cost': purchase_price,
            'type': 'Equity'
        }
        holdings_collection.insert_one(holding_doc)

    # Step 3: Always create a "BUY" transaction record
    transaction_doc = {
        'username': username,
        'date': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'type': 'BUY',
        'instrument': data.get('instrument', symbol),
        'quantity': new_quantity,
        'price': purchase_price
    }
    transactions_collection.insert_one(transaction_doc)

    return jsonify({'message': 'Holding updated successfully'}), 201
   # In backend/app.py, add this new route

# --- NEW P&L STATEMENT ENDPOINT ---
# In backend/app.py, make sure this function exists

# --- P&L STATEMENT ENDPOINT ---
@app.route('/api/reports/pnl', methods=['GET'])
def get_pnl_statement():
    username = request.args.get('username')
    if not username:
        return jsonify({'message': 'Username is required'}), 400

    try:
        # Fetch all transactions for the user, sorted chronologically
        transactions = list(transactions_collection.find({'username': username}).sort('date', 1))

        # Group transactions by stock symbol
        transactions_by_symbol = {}
        for tx in transactions:
            symbol = tx['instrument']
            if symbol not in transactions_by_symbol:
                transactions_by_symbol[symbol] = []
            transactions_by_symbol[symbol].append(tx)

        # FIFO Calculation Logic
        pnl_summary = []
        for symbol, tx_list in transactions_by_symbol.items():
            buy_queue = []
            total_cost_of_sold_shares = 0
            total_value_from_sales = 0

            for tx in tx_list:
                if tx['type'] == 'BUY':
                    buy_queue.append({'quantity': tx['quantity'], 'price': tx['price']})
                elif tx['type'] == 'SELL':
                    sell_quantity = tx['quantity']
                    sale_price = tx['price']
                    total_value_from_sales += sell_quantity * sale_price
                    
                    while sell_quantity > 0 and buy_queue:
                        oldest_buy = buy_queue[0]
                        if oldest_buy['quantity'] >= sell_quantity:
                            total_cost_of_sold_shares += sell_quantity * oldest_buy['price']
                            oldest_buy['quantity'] -= sell_quantity
                            if oldest_buy['quantity'] == 0:
                                buy_queue.pop(0)
                            sell_quantity = 0
                        else:
                            total_cost_of_sold_shares += oldest_buy['quantity'] * oldest_buy['price']
                            sell_quantity -= oldest_buy['quantity']
                            buy_queue.pop(0)

            if total_value_from_sales > 0:
                realized_pnl = total_value_from_sales - total_cost_of_sold_shares
                pnl_summary.append({
                    'instrument': symbol,
                    'total_sale_value': round(total_value_from_sales, 2),
                    'cost_basis': round(total_cost_of_sold_shares, 2),
                    'realized_pnl': round(realized_pnl, 2)
                })
        return jsonify(pnl_summary)

    except Exception as e:
        return jsonify({'message': f'Calculation failed: {e}'}), 500
@app.route('/api/holdings', methods=['GET'])
def get_holdings():
    username = request.args.get('username')
    if not username:
        return jsonify({'message': 'Username is required'}), 400

    try:
        user_holdings_cursor = holdings_collection.find({'username': username})
        real_holdings = [h for h in user_holdings_cursor]
        for h in real_holdings: h['_id'] = str(h['_id']) # Convert ObjectId
    except Exception as e:
        return jsonify({'message': f'Database query failed: {e}'}), 500

    enriched_holdings = []
    for holding in real_holdings:
        if holding['type'] == 'Equity':
            try:
                url = f"https://finnhub.io/api/v1/quote?symbol={holding['symbol']}&token={finnhub_api_key}"
                response = requests.get(url); response.raise_for_status(); data = response.json(); current_price = data.get('c', 0)
            except requests.exceptions.RequestException:
                current_price = holding['avg_cost']
        elif holding['type'] == 'FD':
            current_price = holding['avg_cost'] * 1.07
        else:
            current_price = holding['avg_cost']
        
        holding['current_price'] = round(current_price, 2)
        holding['total_value'] = round(holding['quantity'] * current_price, 2)
        holding['pnl'] = round((current_price - holding['avg_cost']) * holding['quantity'], 2)
        enriched_holdings.append(holding)
    return jsonify(enriched_holdings)


# --- Reports & Other Data Endpoints ---

@app.route('/api/fd-rates', methods=['GET'])
def get_fd_rates():
    mock_fd_rates = [
        {'bank_name': 'State Bank of India (SBI)', 'rate': '7.10%', 'tenor': '1 Year'},
        {'bank_name': 'HDFC Bank', 'rate': '7.25%', 'tenor': '1 Year'},
        {'bank_name': 'ICICI Bank', 'rate': '7.20%', 'tenor': '1 Year'}
    ]
    return jsonify(mock_fd_rates)

# In backend/app.py, replace the old get_transactions function

@app.route('/api/reports/transactions', methods=['GET'])
def get_transactions():
    username = request.args.get('username')
    if not username:
        return jsonify({'message': 'Username is required'}), 400

    try:
        # Query the database and sort by date descending (most recent first)
        transactions_cursor = transactions_collection.find({'username': username}).sort('date', -1)
        
        real_transactions = []
        for tx in transactions_cursor:
            tx.pop('_id', None) # Remove the non-serializable ObjectId
            real_transactions.append(tx)
            
        return jsonify(real_transactions)
        
    except Exception as e:
        return jsonify({'message': f'Database query failed: {e}'}), 500


# --- Account Management Endpoints ---
# --- NEW SELL HOLDING ENDPOINT ---
@app.route('/api/holdings/sell', methods=['POST', 'OPTIONS'])
def sell_holding():
    # --- THIS IS THE FIX ---
    # Handle the preflight 'OPTIONS' request
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    data = request.get_json()
    username = data.get('username')
    symbol = data.get('symbol')
    # ... rest of the function is unchanged ...
    sell_quantity = float(data.get('quantity', 0))
    sell_price = float(data.get('price', 0))
    if not all([username, symbol, sell_quantity > 0, sell_price > 0]):
        return jsonify({'message': 'Missing or invalid data'}), 400
    current_holding = holdings_collection.find_one({'username': username, 'symbol': symbol})
    if not current_holding:
        return jsonify({'message': 'Holding not found'}), 404
    current_quantity = float(current_holding.get('quantity', 0))
    if sell_quantity > current_quantity:
        return jsonify({'message': 'You cannot sell more stocks than you own'}), 400
    if sell_quantity == current_quantity:
        holdings_collection.delete_one({'_id': current_holding['_id']})
    else:
        new_quantity = current_quantity - sell_quantity
        holdings_collection.update_one({'_id': current_holding['_id']}, {'$set': {'quantity': new_quantity}})
    transaction_doc = {'username': username, 'date': datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 'type': 'SELL', 'instrument': current_holding.get('instrument', symbol), 'quantity': sell_quantity, 'price': sell_price}
    transactions_collection.insert_one(transaction_doc)
    return jsonify({'message': 'Sale recorded successfully'}), 200
# In backend/app.py, add this new route

# --- NEW REAL RETURN ENDPOINT ---
@app.route('/api/reports/real-returns', methods=['GET'])
def get_real_returns():
    username = request.args.get('username')
    if not username:
        return jsonify({'message': 'Username is required'}), 400

    INFLATION_RATE = 0.065 # Assumed annual inflation rate of 6.5%

    try:
        transactions = list(transactions_collection.find({'username': username}).sort('date', 1))

        transactions_by_symbol = {}
        for tx in transactions:
            transactions_by_symbol.setdefault(tx['instrument'], []).append(tx)

        real_return_summary = []
        for symbol, tx_list in transactions_by_symbol.items():
            buy_queue = []
            total_realized_pnl = 0
            total_inflation_adjustment = 0
            has_sales = False

            for tx in tx_list:
                tx_date = datetime.strptime(tx['date'], "%Y-%m-%d %H:%M:%S")
                if tx['type'] == 'BUY':
                    buy_queue.append({'quantity': tx['quantity'], 'price': tx['price'], 'date': tx_date})
                elif tx['type'] == 'SELL':
                    has_sales = True
                    sell_quantity = tx['quantity']
                    sale_price = tx['price']
                    
                    while sell_quantity > 0 and buy_queue:
                        oldest_buy = buy_queue[0]
                        buy_date = oldest_buy['date']
                        
                        qty_to_sell = min(sell_quantity, oldest_buy['quantity'])

                        # Calculate holding period in years
                        holding_period_days = (tx_date - buy_date).days
                        holding_period_years = holding_period_days / 365.25

                        # Calculate nominal profit for this portion
                        cost_basis = qty_to_sell * oldest_buy['price']
                        sale_value = qty_to_sell * sale_price
                        nominal_pnl = sale_value - cost_basis
                        
                        # Calculate the inflation-adjusted sale value
                        inflation_adjusted_sale_value = sale_value / ((1 + INFLATION_RATE) ** holding_period_years)
                        real_pnl = inflation_adjusted_sale_value - cost_basis
                        
                        # Accumulate totals
                        total_realized_pnl += nominal_pnl
                        total_inflation_adjustment += (nominal_pnl - real_pnl)
                        
                        # Update the queue
                        oldest_buy['quantity'] -= qty_to_sell
                        if oldest_buy['quantity'] <= 0.0001: # Use a small epsilon for float comparison
                            buy_queue.pop(0)
                        sell_quantity -= qty_to_sell
            
            if has_sales:
                real_return_summary.append({
                    'instrument': symbol,
                    'nominal_pnl': round(total_realized_pnl, 2),
                    'inflation_adjustment': round(total_inflation_adjustment, 2),
                    'real_pnl': round(total_realized_pnl - total_inflation_adjustment, 2)
                })

        return jsonify(real_return_summary)

    except Exception as e:
        return jsonify({'message': f'Real return calculation failed: {e}'}), 500
# In backend/app.py, add this new route

# --- NEW INVESTMENT CIBIL SCORE ENDPOINT ---
@app.route('/api/reports/cibil-score', methods=['GET'])
def get_cibil_score():
    username = request.args.get('username')
    if not username:
        return jsonify({'message': 'Username is required'}), 400

    try:
        # Fetch all necessary data for the user
        holdings = list(holdings_collection.find({'username': username}))
        transactions = list(transactions_collection.find({'username': username}).sort('date', 1))

        # --- SCORE CALCULATION ---
        base_score = 300
        diversification_score = 0
        profitability_score = 0
        discipline_score = 0

        # 1. Diversification Score (Max 200)
        num_unique_holdings = len(holdings)
        diversification_score = min(200, num_unique_holdings * 20) # 20 points per holding, maxes out at 10 holdings
        
        # 2. Profitability Score (Max 200) - Using our P&L logic
        # For simplicity, we'll re-calculate total realized P&L here
        # (In a larger app, this might be a shared utility function)
        buy_queue = {}
        total_realized_pnl = 0
        for tx in transactions:
            instrument = tx['instrument']
            if tx['type'] == 'BUY':
                buy_queue.setdefault(instrument, []).append({'quantity': tx['quantity'], 'price': tx['price']})
            elif tx['type'] == 'SELL':
                sell_quantity = tx['quantity']; sale_price = tx['price']
                cost_of_sold_shares = 0
                while sell_quantity > 0 and buy_queue.get(instrument):
                    oldest_buy = buy_queue[instrument][0]
                    qty_to_sell = min(sell_quantity, oldest_buy['quantity'])
                    cost_of_sold_shares += qty_to_sell * oldest_buy['price']
                    oldest_buy['quantity'] -= qty_to_sell
                    if oldest_buy['quantity'] == 0: buy_queue[instrument].pop(0)
                    sell_quantity -= qty_to_sell
                total_realized_pnl += (tx['quantity'] * sale_price) - cost_of_sold_shares
        
        if total_realized_pnl > 50000: profitability_score = 200
        elif total_realized_pnl > 10000: profitability_score = 150
        elif total_realized_pnl > 0: profitability_score = 100
        elif total_realized_pnl <= 0: profitability_score = 50

        # 3. Discipline Score (Max 200)
        if transactions:
            first_tx_date = datetime.strptime(transactions[0]['date'], "%Y-%m-%d %H:%M:%S")
            days_investing = (datetime.now() - first_tx_date).days
            discipline_score = min(200, int(days_investing / 3.65)) # ~200 points for 2 years of investing

        # Final Calculation
        total_score = base_score + diversification_score + profitability_score + discipline_score

        # Provide simple feedback
        feedback = {
            "Diversification": "Excellent" if diversification_score > 150 else "Good" if diversification_score > 80 else "Needs Improvement",
            "Profitability": "Excellent" if profitability_score > 150 else "Good" if profitability_score > 100 else "Average",
            "Discipline": "Excellent" if discipline_score > 150 else "Good" if discipline_score > 80 else "Just Starting"
        }

        return jsonify({
            'score': total_score,
            'breakdown': {
                'Base Score': base_score,
                'Diversification': diversification_score,
                'Profitability': profitability_score,
                'Discipline': discipline_score
            },
            'feedback': feedback
        })

    except Exception as e:
        return jsonify({'message': f'Score calculation failed: {e}'}), 500
@app.route('/api/account/delete', methods=['DELETE'])
def delete_account():
    data = request.get_json()
    username = data.get('username')
    if not username:
        return jsonify({'message': 'Username is required'}), 400
    result = users_collection.delete_one({'username': username})
    if result.deleted_count == 1:
        return jsonify({'message': 'Account deleted successfully'}), 200
    else:
        return jsonify({'message': 'User not found'}), 404


# --- Main Runner ---

if __name__ == '__main__':
    app.run(debug=True)
