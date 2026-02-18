"""
ChainShield ML Service - Enhanced (FIXED)
Philippine Government Fraud Detection using Ensemble ML + Economic Data
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import xgboost as xgb
import shap
import joblib
import os
from pathlib import Path
from datetime import datetime

# =========================
# PATH SETUP (CRITICAL)
# =========================

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
DATASETS_DIR = BASE_DIR / "datasets"

MODELS_DIR.mkdir(exist_ok=True)
DATASETS_DIR.mkdir(exist_ok=True)

# =========================
# FLASK APP
# =========================

app = Flask(__name__)
CORS(app)

# =========================
# SECURITY FIX (V3): Internal API Authentication
# Validates shared secret header on all prediction endpoints.
# Set ML_API_SECRET in .env and pass it from the backend service.
# =========================

ML_API_SECRET = os.environ.get('ML_API_SECRET')

def require_internal_auth(f):
    """Decorator to validate internal shared-secret header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if ML_API_SECRET:  # Only enforce if secret is configured
            token = request.headers.get('X-Internal-Secret')
            if not token or token != ML_API_SECRET:
                return jsonify({'error': 'Unauthorized - invalid internal secret'}), 401
        return f(*args, **kwargs)
    return decorated

# =========================
# MODEL PATHS
# =========================

FRAUD_MODEL_PATH = MODELS_DIR / "fraud_classifier.pkl"
ANOMALY_MODEL_PATH = MODELS_DIR / "anomaly_detector.pkl"

fraud_model = None
anomaly_model = None
explainer = None
ensemble_detector = None  # lazy-loaded

# =========================
# LAZY LOAD ENSEMBLE MODEL
# =========================

def get_ensemble_detector():
    global ensemble_detector
    if ensemble_detector is None:
        from ensemble_model import ensemble_detector as detector
        ensemble_detector = detector
    return ensemble_detector

# =========================
# MODEL INITIALIZATION
# =========================

def initialize_models():
    global fraud_model, anomaly_model, explainer

    try:
        # Fraud classifier
        if FRAUD_MODEL_PATH.exists():
            fraud_model = joblib.load(FRAUD_MODEL_PATH)
            print("Loaded fraud classifier")
        else:
            fraud_model = create_prototype_model()
            joblib.dump(fraud_model, FRAUD_MODEL_PATH)
            print("Created fraud classifier")

        # Anomaly detector
        if ANOMALY_MODEL_PATH.exists():
            anomaly_model = joblib.load(ANOMALY_MODEL_PATH)
            print("Loaded anomaly detector")
        else:
            anomaly_model = IsolationForest(contamination=0.1, random_state=42)
            anomaly_model.fit(np.random.rand(100, 6))
            joblib.dump(anomaly_model, ANOMALY_MODEL_PATH)
            print("Created anomaly detector")

        explainer = shap.TreeExplainer(fraud_model)
        print("Models initialized successfully")

    except Exception as e:
        print(f"[WARN] Model init failed, using fallback: {e}")
        fraud_model = create_prototype_model()
        anomaly_model = IsolationForest(contamination=0.1, random_state=42)
        anomaly_model.fit(np.random.rand(100, 6))
        explainer = shap.TreeExplainer(fraud_model)

# =========================
# PROTOTYPE MODEL
# =========================

def create_prototype_model():
    np.random.seed(42)
    X = np.random.rand(1000, 6)
    y = (X[:, 0] * 0.3 + X[:, 2] * 0.4 + X[:, 4] * 0.3 > 0.6).astype(int)

    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    model.fit(X, y)
    return model

# =========================
# HEALTH CHECK
# =========================

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "models_loaded": fraud_model is not None and anomaly_model is not None,
        "datasets_present": [str(f) for f in DATASETS_DIR.iterdir()]
    })

# =========================
# PREDICTION ENDPOINT
# =========================

@app.route("/predict", methods=["POST"])
@require_internal_auth  # SECURITY FIX (V3): Requires X-Internal-Secret header
def predict():
    try:
        data = request.json or {}

        tx_id = data.get("transactionId", data.get("txHash", "UNKNOWN"))
        tx_type = data.get("transactionType", "Other")
        amount = float(data.get("amount") or 0)

        print(f"\n{'='*60}")
        print(f"🤖 AI PREDICTION REQUEST RECEIVED")
        print(f"{'='*60}")
        print(f"  📋 Transaction: {tx_id}")
        print(f"  💰 Amount:      ₱{amount:,.2f}")
        print(f"  📁 Type:        {tx_type}")

        features = extract_features(data)
        print(f"  🔢 Features:    {[round(f, 4) for f in features]}")

        # --- Ensemble Model Prediction ---
        ensemble = get_ensemble_detector()
        network_features = data.get('networkFeatures', {})
        ensemble_prob = ensemble.predict_proba(data, network_features)
        risk_score = int(ensemble_prob * 100)
        print(f"  📊 Ensemble:    probability={ensemble_prob:.4f} → score={risk_score}")

        # --- Anomaly Detection (Isolation Forest) ---
        anomaly_score = anomaly_model.decision_function([features])[0]
        is_anomaly = anomaly_score < -0.1
        print(f"  🔍 Anomaly:     score={anomaly_score:.4f}, is_anomaly={'⚠️  YES' if is_anomaly else '✅ NO'}")

        if is_anomaly and risk_score < 70:
            old_score = risk_score
            risk_score = min(risk_score + 15, 100)
            print(f"  📈 Boosted:     {old_score} → {risk_score} (anomaly detected)")

        # --- SHAP Explainability ---
        shap_values = explainer.shap_values([features])[0]
        feature_names = [
            "amount_normalized",
            "frequency",
            "time_diff",
            "address_degree",
            "convergence_score",
            "circular_pattern"
        ]

        explanations = generate_explanations(
            shap_values, feature_names, features, data
        )

        fraud_type = classify_fraud_type(features, explanations, data)
        risk_level = get_risk_level(risk_score)

        # --- SHAP Top Features ---
        shap_dict = dict(zip(feature_names, [float(v) for v in shap_values.tolist()]))
        sorted_shap = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)
        print(f"  🧠 SHAP Top-3:")
        for fname, fval in sorted_shap[:3]:
            direction = "↑ risk" if fval > 0 else "↓ risk"
            print(f"       • {fname}: {fval:+.4f} ({direction})")

        # --- Final Prediction Summary ---
        level_emoji = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}.get(risk_level, "⚪")
        print(f"\n  {'─'*50}")
        print(f"  {level_emoji} PREDICTION RESULT:")
        print(f"     Risk Score:  {risk_score}/100")
        print(f"     Risk Level:  {risk_level}")
        print(f"     Fraud Type:  {fraud_type}")
        print(f"     Fraudulent:  {'🚨 YES' if risk_score >= 60 else '✅ NO'}")
        print(f"     Reasons:     {'; '.join(explanations)}")
        print(f"{'='*60}\n", flush=True)

        return jsonify({
            "transaction_id": tx_id,
            "transaction_type": tx_type,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "isFraudulent": bool(risk_score >= 60),
            "fraudType": fraud_type,
            "explanation": explanations,
            "shapValues": shap_dict,
            "anomalyScore": float(anomaly_score),
            "isAnomaly": bool(is_anomaly)
        })

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"\n{'='*60}")
        print(f"❌ AI PREDICTION FAILED")
        print(f"{'='*60}")
        print(f"  Error:    {e}")
        print(f"  Details:  {error_details}")
        print(f"  Data:     {list(data.keys()) if data else 'None'}")
        print(f"{'='*60}\n", flush=True)
        return jsonify({
            "error": str(e),
            "risk_score": 0,
            "risk_level": "LOW",
            "isFraudulent": False
        }), 500

@app.route("/train", methods=["POST"])
@require_internal_auth
def train():
    try:
        from ensemble_model import ensemble_detector as detector
        from data_processing_pipeline import load_and_preprocess_training_data
        
        # 1. Load data
        print("📥 Loading training data...")
        X, y = load_and_preprocess_training_data()
        
        # 2. Train model
        print("🚀 Retraining ensemble model...")
        detector.train(X, y)
        
        # 3. Save new model
        detector.save_models(MODELS_DIR)
        
        # 4. Reload global instances
        global fraud_model, anomaly_model, explainer
        initialize_models()
        
        return jsonify({
            "success": True,
            "message": "Model updated and reloaded successfully",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        print(f"❌ Training failed: {e}")
        return jsonify({"error": f"Training failed: {str(e)}"}), 500

# =========================
# FEATURE EXTRACTION
# =========================

def extract_features(data):
    amount = float(data.get("amount") or 0)
    frequency = float(data.get("frequency") or 0)
    time_diff = float(data.get("time_diff") or 86400)
    address_degree = float(data.get("address_degree") or 0)
    convergence_score = float(data.get("convergence_score") or 0)
    circular_pattern = float(data.get("circular_pattern") or 0)

    return [
        min(amount / 1_000_000, 1.0),
        min(frequency / 100, 1.0),
        max(0, 1 - (time_diff / 86400)),
        min(address_degree / 1000, 1.0),
        min(convergence_score, 1.0),
        min(circular_pattern, 1.0),
    ]

# =========================
# EXPLANATIONS
# =========================

def generate_explanations(shap_values, names, features, data):
    # Map raw feature names to human-readable descriptions
    feature_descriptions = {
        "amount_normalized": "Unusually high transaction amount",
        "frequency": "High transaction frequency detected",
        "time_diff": "Rapid sequential transactions",
        "address_degree": "Suspicious network connections",
        "convergence_score": "Multiple sources converging to single recipient",
        "circular_pattern": "Circular transaction pattern detected"
    }

    reasons = []
    top = np.argsort(np.abs(shap_values))[-3:][::-1]

    for idx in top:
        if abs(shap_values[idx]) > 0.05:
            feature_name = names[idx] if idx < len(names) else f"feature_{idx}"
            human_desc = feature_descriptions.get(feature_name, f"Anomalous pattern: {feature_name}")
            # Add severity context based on SHAP value magnitude
            severity = "High" if abs(shap_values[idx]) > 0.2 else "Moderate"
            reasons.append(f"{human_desc} ({severity} impact)")

    if not reasons:
        reasons.append("Transaction appears normal")

    return reasons

# =========================
# FRAUD TYPE
# =========================

def classify_fraud_type(features, explanations, data):
    text = " ".join(explanations).lower()
    amount = float(data.get("amount", 0))

    if "convergence" in text:
        return "Welfare Fraud"
    if "circular" in text:
        return "Money Laundering"
    if amount > 100000:
        return "Procurement Fraud"
    return "Other"

# =========================
# RISK LEVEL
# =========================

def get_risk_level(score):
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"

# =========================
# MAIN
# =========================

if __name__ == "__main__":
    print("Initializing ChainShield ML Service...")
    initialize_models()
    print("Starting Flask server on port 5001...")
    app.run(host="0.0.0.0", port=5001, debug=True)