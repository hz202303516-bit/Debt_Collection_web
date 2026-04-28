from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime, timedelta
import math

app = Flask(__name__)
CORS(app)

# Simple in-memory storage for predictions
prediction_history = []

def calculate_risk_score(loan_data):
    """Calculate risk score based on loan data"""
    risk_score = 0
    reasons = []
    
    # Days overdue factor
    days_overdue = loan_data.get('days_overdue', 0)
    if days_overdue > 0:
        risk_score += min(days_overdue * 2, 60)
        reasons.append(f"{days_overdue} days overdue")
    
    if days_overdue > 30:
        risk_score += 20
        reasons.append("More than 30 days overdue")
    
    if days_overdue > 90:
        risk_score += 20
        reasons.append("Severely delinquent (90+ days)")
    
    # Payment history factor
    payment_count = loan_data.get('payment_count', 0)
    total_paid = loan_data.get('total_paid', 0)
    loan_amount = loan_data.get('loan_amount', 1)
    
    if payment_count == 0:
        risk_score += 25
        reasons.append("No payments made")
    elif payment_count < 3:
        risk_score += 10
        reasons.append("Few payments made")
    
    # Payment ratio
    if loan_amount > 0:
        payment_ratio = total_paid / loan_amount
        if payment_ratio < 0.1:
            risk_score += 15
            reasons.append("Very low payment ratio")
        elif payment_ratio < 0.3:
            risk_score += 5
            reasons.append("Low payment ratio")
    
    # Balance ratio
    balance = loan_data.get('balance', loan_amount)
    if loan_amount > 0:
        balance_ratio = balance / loan_amount
        if balance_ratio > 0.9:
            risk_score += 20
            reasons.append("Almost full balance remaining")
        elif balance_ratio > 0.7:
            risk_score += 10
            reasons.append("High balance remaining")
    
    # Interest rate factor
    interest_rate = loan_data.get('interest_rate', 0)
    if interest_rate > 15:
        risk_score += 10
        reasons.append("High interest rate")
    
    return min(risk_score, 100), reasons

@app.route('/predict', methods=['POST'])
def predict_default():
    """Predict loan default probability"""
    try:
        data = request.json
        
        # Calculate risk score
        risk_score, reasons = calculate_risk_score(data)
        
        # Determine risk level
        if risk_score < 30:
            risk_level = 'LOW'
            recommendation = 'Continue normal monitoring schedule'
            color = 'green'
        elif risk_score < 60:
            risk_level = 'MEDIUM'
            recommendation = 'Increase monitoring frequency, send payment reminders'
            color = 'orange'
        else:
            risk_level = 'HIGH'
            recommendation = 'Immediate collection action required, consider restructuring'
            color = 'red'
        
        prediction = {
            'loan_id': data.get('loan_id'),
            'borrower_name': data.get('borrower_name', 'Unknown'),
            'risk_score': risk_score,
            'risk_level': risk_level,
            'recommendation': recommendation,
            'color': color,
            'factors': reasons,
            'prediction_date': datetime.now().isoformat(),
            'confidence': 'High' if len(reasons) >= 3 else 'Medium'
        }
        
        # Store prediction
        prediction_history.append(prediction)
        
        return jsonify(prediction)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/credit-score', methods=['POST'])
def credit_score():
    """Calculate credit score for personalized loan offers"""
    try:
        data = request.json
        
        # Calculate credit score (0-100)
        score = 50  # Base score
        
        # Factor 1: Payment history
        if data.get('total_payments', 0) > 10:
            score += 15
        elif data.get('total_payments', 0) > 5:
            score += 10
        
        # Factor 2: On-time payments
        if data.get('late_payments', 0) == 0:
            score += 20
        elif data.get('late_payments', 0) < 3:
            score += 10
        
        # Factor 3: Loan-to-income ratio (simplified)
        loan_amount = data.get('loan_amount', 0)
        monthly_income = data.get('monthly_income', loan_amount)
        if monthly_income > 0:
            ratio = loan_amount / monthly_income
            if ratio < 0.3:
                score += 15
            elif ratio < 0.5:
                score += 5
        
        # Factor 4: Previous loans paid
        if data.get('loans_paid', 0) > data.get('loans_defaulted', 0):
            score += 15
        
        # Factor 5: Current employment
        if data.get('employed', False):
            score += 10
        
        score = min(score, 100)
        
        # Determine loan offers
        if score >= 80:
            offers = {
                'max_amount': 50000,
                'interest_rate': 5.0,
                'max_term_months': 12,
                'tier': 'Platinum'
            }
        elif score >= 65:
            offers = {
                'max_amount': 30000,
                'interest_rate': 8.0,
                'max_term_months': 9,
                'tier': 'Gold'
            }
        elif score >= 50:
            offers = {
                'max_amount': 15000,
                'interest_rate': 12.0,
                'max_term_months': 6,
                'tier': 'Silver'
            }
        else:
            offers = {
                'max_amount': 5000,
                'interest_rate': 18.0,
                'max_term_months': 3,
                'tier': 'Bronze'
            }
        
        return jsonify({
            'credit_score': score,
            'offers': offers
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/optimize-route', methods=['POST'])
def optimize_route():
    """Optimize collection routes"""
    try:
        data = request.json
        collectors = data.get('collectors', [])
        borrowers = data.get('borrowers', [])
        
        assignments = []
        
        for borrower in borrowers:
            best_collector = None
            min_distance = float('inf')
            
            for collector in collectors:
                if borrower.get('latitude') and collector.get('latitude'):
                    distance = calculate_distance(
                        collector['latitude'], collector['longitude'],
                        borrower['latitude'], borrower['longitude']
                    )
                    
                    if distance < min_distance:
                        min_distance = distance
                        best_collector = {
                            **collector,
                            'distance_km': round(distance, 2)
                        }
            
            if best_collector:
                assignments.append({
                    'borrower': borrower,
                    'assigned_collector': best_collector,
                    'distance_km': best_collector['distance_km']
                })
        
        # Sort by distance
        assignments.sort(key=lambda x: x['distance_km'])
        
        return jsonify({
            'optimized_assignments': assignments,
            'total_borrowers': len(borrowers),
            'assigned_count': len(assignments)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/dashboard-stats', methods=['GET'])
def dashboard_stats():
    """Get ML dashboard statistics"""
    try:
        # Get recent predictions
        recent_predictions = prediction_history[-10:] if prediction_history else []
        
        # Calculate stats
        high_risk = len([p for p in recent_predictions if p['risk_level'] == 'HIGH'])
        medium_risk = len([p for p in recent_predictions if p['risk_level'] == 'MEDIUM'])
        low_risk = len([p for p in recent_predictions if p['risk_level'] == 'LOW'])
        
        return jsonify({
            'total_predictions': len(prediction_history),
            'recent_predictions': recent_predictions,
            'stats': {
                'high_risk': high_risk,
                'medium_risk': medium_risk,
                'low_risk': low_risk,
                'high_risk_percentage': round(high_risk / max(len(recent_predictions), 1) * 100, 1)
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two GPS coordinates in km"""
    R = 6371  # Earth's radius in km
    
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

if __name__ == '__main__':
    print("🤖 ML Service starting on port 5001...")
    app.run(host='0.0.0.0', port=5001, debug=True)