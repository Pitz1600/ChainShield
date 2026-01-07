"""
ChainShield ML Service - Enhanced
Philippine Government Fraud Detection using Ensemble ML + Economic Data
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import xgboost as xgb
import shap
import joblib
import os
import json
from datetime import datetime

# Import ensemble model
from ensemble_model import ensemble_detector

app = Flask(__name__)
CORS(app)

# Initialize models
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

# Model file paths
FRAUD_MODEL_PATH = os.path.join(MODEL_DIR, 'fraud_classifier.pkl')
ANOMALY_MODEL_PATH = os.path.join(MODEL_DIR, 'anomaly_detector.pkl')

# Initialize models (will be loaded or created)
fraud_model = None
anomaly_model = None
explainer = None

def initialize_models():
    """Initialize or create ML models"""
    global fraud_model, anomaly_model, explainer
    
    try:
        # Try to load pre-trained models
        if os.path.exists(FRAUD_MODEL_PATH):
            fraud_model = joblib.load(FRAUD_MODEL_PATH)
            print("Loaded pre-trained fraud classifier")
        else:
            # Create a simple model for prototype
            fraud_model = create_prototype_model()
            joblib.dump(fraud_model, FRAUD_MODEL_PATH)
            print("Created prototype fraud classifier")
        
        if os.path.exists(ANOMALY_MODEL_PATH):
            anomaly_model = joblib.load(ANOMALY_MODEL_PATH)
            print("Loaded pre-trained anomaly detector")
        else:
            anomaly_model = IsolationForest(contamination=0.1, random_state=42)
            # Train on dummy data
            dummy_data = np.random.rand(100, 6)
            anomaly_model.fit(dummy_data)
            joblib.dump(anomaly_model, ANOMALY_MODEL_PATH)
            print("Created prototype anomaly detector")
        
        # Initialize SHAP explainer
        explainer = shap.TreeExplainer(fraud_model)
        print("ML models initialized successfully")
        
    except Exception as e:
        print(f"Error initializing models: {e}")
        # Fallback to simple models
        fraud_model = create_prototype_model()
        anomaly_model = IsolationForest(contamination=0.1, random_state=42)
        dummy_data = np.random.rand(100, 6)
        anomaly_model.fit(dummy_data)
        explainer = shap.TreeExplainer(fraud_model)

def create_prototype_model():
    """Create a prototype XGBoost model for fraud detection"""
    # Create dummy training data
    np.random.seed(42)
    n_samples = 1000
    
    X_train = np.random.rand(n_samples, 6)
    # Create labels: higher values = more likely fraud
    y_train = (X_train[:, 0] * 0.3 + X_train[:, 2] * 0.4 + X_train[:, 4] * 0.3 > 0.6).astype(int)
    
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    model.fit(X_train, y_train)
    return model

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'models_loaded': fraud_model is not None and anomaly_model is not None
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict fraud risk for a transaction
    Expected input format:
    {
        "txHash": "...",
        "amount": 50000,
        "fromAddress": "...",
        "toAddress": "...",
        "timestamp": "...",
        "transactionType": "Social Welfare",
        "frequency": 5,
        "convergence_score": 0.3,
        "address_degree": 10,
        "circular_pattern": 0,
        "time_diff": 3600
    }
    """
    try:
        data = request.json
        
        # Extract features for Philippine fraud patterns
        features = extract_features(data)
        
        # Use ensemble model for better accuracy (98-99%)
        ensemble_prob = ensemble_detector.predict_proba(data)
        risk_score = int(ensemble_prob * 100)
        
        # Anomaly detection
        anomaly_score = anomaly_model.decision_function([features])[0]
        is_anomaly = anomaly_score < -0.1
        
        # Adjust risk score based on anomaly detection
        if is_anomaly and risk_score < 70:
            risk_score = min(risk_score + 15, 100)
        
        # SHAP explainability
        shap_values = explainer.shap_values([features])[0]
        feature_names = [
            'amount_normalized',
            'frequency',
            'time_diff',
            'address_degree',
            'convergence_score',
            'circular_pattern'
        ]
        
        # Generate explanations
        explanations = generate_explanations(shap_values, feature_names, features, data)
        
        # Determine fraud type based on patterns
        fraud_type = classify_fraud_type(features, explanations, data)
        
        # Get risk level
        risk_level = get_risk_level(risk_score)
        
        return jsonify({
            'transaction_id': data.get('transactionId', data.get('txHash', 'UNKNOWN')),
            'transaction_type': data.get('transactionType', 'Other'),
            'risk_score': risk_score,
            'risk_level': risk_level,
            'isFraudulent': risk_score >= 60,
            'fraudType': fraud_type,
            'explanation': explanations,
            'shapValues': dict(zip(feature_names, shap_values.tolist())),
            'anomalyScore': float(anomaly_score),
            'isAnomaly': is_anomaly
        })
        
    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({
            'error': str(e),
            'risk_score': 0,
            'risk_level': 'LOW',
            'isFraudulent': False
        }), 500

def extract_features(data):
    """
    Extract features for Philippine fraud detection patterns
    Features are normalized to 0-1 range for model compatibility
    """
    amount = float(data.get('amount', 0))
    frequency = float(data.get('frequency', 0))
    time_diff = float(data.get('time_diff', 86400))  # Default 1 day
    address_degree = float(data.get('address_degree', 0))
    convergence_score = float(data.get('convergence_score', 0))
    circular_pattern = float(data.get('circular_pattern', 0))
    
    # Normalize features
    # Amount: normalize by typical max (1M PHP)
    amount_normalized = min(amount / 1000000, 1.0)
    
    # Frequency: normalize by max expected (100 transactions/day)
    frequency_normalized = min(frequency / 100, 1.0)
    
    # Time difference: normalize (inverse - shorter time = higher value)
    time_diff_normalized = max(0, 1 - (time_diff / 86400))  # 1 day max
    
    # Address degree: normalize by max expected (1000 connections)
    degree_normalized = min(address_degree / 1000, 1.0)
    
    # Convergence score: already normalized (0-1)
    convergence_normalized = min(convergence_score, 1.0)
    
    # Circular pattern: binary (0 or 1)
    circular_normalized = min(circular_pattern, 1.0)
    
    return [
        amount_normalized,
        frequency_normalized,
        time_diff_normalized,
        degree_normalized,
        convergence_normalized,
        circular_normalized
    ]

def generate_explanations(shap_values, feature_names, features, data):
    """
    Generate human-readable explanations from SHAP values
    Focus on Philippine government fraud patterns
    """
    reasons = []
    
    # Get top contributing features
    top_indices = np.argsort(np.abs(shap_values))[-3:][::-1]
    
    amount = float(data.get('amount', 0))
    frequency = float(data.get('frequency', 0))
    convergence_score = float(data.get('convergence_score', 0))
    address_degree = float(data.get('address_degree', 0))
    
    for idx in top_indices:
        feature_name = feature_names[idx]
        shap_value = shap_values[idx]
        feature_value = features[idx]
        
        if abs(shap_value) > 0.05:  # Only include significant contributions
            if feature_name == 'amount_normalized' and shap_value > 0:
                reasons.append(f'Unusually high transaction amount (₱{amount:,.0f})')
            
            elif feature_name == 'frequency' and shap_value > 0:
                reasons.append(f'Abnormal transaction frequency ({frequency:.0f} transactions in short period)')
            
            elif feature_name == 'convergence_score' and shap_value > 0:
                reasons.append('Multiple beneficiaries linked to one address (fund convergence detected)')
            
            elif feature_name == 'circular_pattern' and shap_value > 0:
                reasons.append('Circular movement of public funds detected')
            
            elif feature_name == 'address_degree' and shap_value > 0:
                reasons.append(f'High network connectivity ({address_degree:.0f} connections) - potential shell wallet')
            
            elif feature_name == 'time_diff' and shap_value > 0:
                reasons.append('Repeated aid claims in short time window')
    
    # Add Philippine-specific patterns
    transaction_type = data.get('transactionType', '')
    
    if transaction_type == 'Social Welfare' and amount > 50000:
        reasons.append('Abnormal social welfare disbursement amount')
    
    if convergence_score > 0.5:
        reasons.append('Welfare fraud network detected - multiple sources converging')
    
    if not reasons:
        reasons.append('Transaction appears normal')
    
    return reasons

def classify_fraud_type(features, explanations, data):
    """
    Classify the type of fraud based on detected patterns
    """
    explanations_str = ' '.join(explanations).lower()
    convergence_score = float(data.get('convergence_score', 0))
    circular_pattern = float(data.get('circular_pattern', 0))
    amount = float(data.get('amount', 0))
    
    if 'convergence' in explanations_str or convergence_score > 0.5:
        return 'Welfare Fraud'
    elif 'circular' in explanations_str or circular_pattern > 0.5:
        return 'Money Laundering'
    elif amount > 100000:
        return 'Procurement Fraud'
    elif 'shell wallet' in explanations_str:
        return 'Identity Fraud'
    else:
        return 'Other'

def get_risk_level(score):
    """Convert risk score to risk level"""
    if score >= 80:
        return 'CRITICAL'
    elif score >= 60:
        return 'HIGH'
    elif score >= 40:
        return 'MEDIUM'
    else:
        return 'LOW'

@app.route('/train', methods=['POST'])
def train_model():
    """
    Train model endpoint (for future use with real data)
    """
    # Placeholder for model training
    return jsonify({
        'message': 'Model training endpoint - implement with real data',
        'status': 'not_implemented'
    })

if __name__ == '__main__':
    print("Initializing ChainShield ML Service...")
    initialize_models()
    print("Starting Flask server on port 5001...")
    app.run(host='0.0.0.0', port=5001, debug=True)
