"""
ChainShield ML Service - Enhanced (FIXED)
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
def predict():
    try:
        data = request.json or {}

        features = extract_features(data)

        ensemble = get_ensemble_detector()
        network_features = data.get('networkFeatures', {})
        ensemble_prob = ensemble.predict_proba(data, network_features)
        risk_score = int(ensemble_prob * 100)

        anomaly_score = anomaly_model.decision_function([features])[0]
        is_anomaly = anomaly_score < -0.1

        if is_anomaly and risk_score < 70:
            risk_score = min(risk_score + 15, 100)

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

        return jsonify({
            "transaction_id": data.get("transactionId", data.get("txHash", "UNKNOWN")),
            "transaction_type": data.get("transactionType", "Other"),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "isFraudulent": bool(risk_score >= 60),
            "fraudType": fraud_type,
            "explanation": explanations,
            "shapValues": dict(zip(feature_names, [float(v) for v in shap_values.tolist()])),
            "anomalyScore": float(anomaly_score),
            "isAnomaly": bool(is_anomaly)
        })

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[ERROR] Prediction failed: {e}")
        print(f"[ERROR] Traceback: {error_details}")
        print(f"[ERROR] Request data keys: {list(data.keys()) if data else 'None'}")
        return jsonify({
            "error": str(e),
            "risk_score": 0,
            "risk_level": "LOW",
            "isFraudulent": False
        }), 500

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
    reasons = []
    top = np.argsort(np.abs(shap_values))[-3:][::-1]

    for idx in top:
        if abs(shap_values[idx]) > 0.05:
            reasons.append(f"High impact: {names[idx]}")

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