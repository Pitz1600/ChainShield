"""
Ensemble ML Model for Enhanced Fraud Detection
Combines XGBoost, Random Forest, and Gradient Boosting
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from xgboost import XGBClassifier
from sklearn.preprocessing import StandardScaler
import joblib
import os

class EnsembleFraudDetector:
    def __init__(self):
        self.models = {}
        self.scaler = StandardScaler()
        self.is_trained = False
        
        # Initialize models
        self.models['xgboost'] = XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42
        )
        
        self.models['random_forest'] = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        
        self.models['gradient_boosting'] = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        
        # Model weights (can be tuned based on validation performance)
        self.weights = {
            'xgboost': 0.4,
            'random_forest': 0.3,
            'gradient_boosting': 0.3
        }
    
    def prepare_features(self, transaction):
        """Extract features from transaction"""
        features = []
        
        # Amount-based features
        features.append(float(transaction.get('amount', 0)))
        features.append(np.log1p(float(transaction.get('amount', 0))))  # Log amount
        
        # Transaction type encoding
        tx_types = ['Social Welfare', 'Procurement', 'Grant', 'Tax', 'Revenue', 'Other']
        tx_type = transaction.get('transactionType', 'Other')
        features.extend([1 if tx_type == t else 0 for t in tx_types])
        
        # Beneficiary type encoding
        ben_types = ['Individual', 'Household', 'Organization', 'Government Entity', 'Vendor', 'Contractor']
        ben_type = transaction.get('beneficiaryType', 'Individual')
        features.extend([1 if ben_type == b else 0 for b in ben_types])
        
        # Network features (if available)
        network = transaction.get('networkFeatures', {})
        features.append(network.get('degree', 0))
        features.append(network.get('inDegree', 0))
        features.append(network.get('outDegree', 0))
        features.append(network.get('clusteringCoefficient', 0))
        features.append(network.get('betweennessCentrality', 0))
        
        return np.array(features).reshape(1, -1)
    
    def train(self, X, y):
        """Train all models in the ensemble"""
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train each model
        for name, model in self.models.items():
            print(f"Training {name}...")
            model.fit(X_scaled, y)
        
        self.is_trained = True
        print("Ensemble training complete!")
    
    def predict_proba(self, transaction):
        """Get fraud probability using ensemble voting"""
        if not self.is_trained:
            # Use rule-based fallback if not trained
            return self._rule_based_prediction(transaction)
        
        # Prepare features
        X = self.prepare_features(transaction)
        X_scaled = self.scaler.transform(X)
        
        # Get predictions from each model
        predictions = {}
        for name, model in self.models.items():
            prob = model.predict_proba(X_scaled)[0]
            predictions[name] = prob[1] if len(prob) > 1 else prob[0]
        
        # Weighted ensemble voting
        ensemble_prob = sum(
            predictions[name] * self.weights[name]
            for name in self.models.keys()
        )
        
        return ensemble_prob
    
    def _rule_based_prediction(self, transaction):
        """Fallback rule-based prediction"""
        amount = float(transaction.get('amount', 0))
        tx_type = transaction.get('transactionType', '')
        
        # Simple rule-based scoring
        risk_score = 0.0
        
        # High amount transactions
        if amount > 1000000:
            risk_score += 0.3
        elif amount > 500000:
            risk_score += 0.2
        
        # Procurement has higher fraud risk
        if tx_type == 'Procurement':
            risk_score += 0.2
        
        # Network features
        network = transaction.get('networkFeatures', {})
        if network.get('degree', 0) > 10:
            risk_score += 0.2
        
        return min(risk_score, 1.0)
    
    def save_models(self, directory='models'):
        """Save trained models"""
        os.makedirs(directory, exist_ok=True)
        
        for name, model in self.models.items():
            joblib.dump(model, f'{directory}/{name}_model.pkl')
        
        joblib.dump(self.scaler, f'{directory}/scaler.pkl')
        print(f"Models saved to {directory}/")
    
    def load_models(self, directory='models'):
        """Load trained models"""
        try:
            for name in self.models.keys():
                self.models[name] = joblib.load(f'{directory}/{name}_model.pkl')
            
            self.scaler = joblib.load(f'{directory}/scaler.pkl')
            self.is_trained = True
            print(f"Models loaded from {directory}/")
            return True
        except Exception as e:
            print(f"Failed to load models: {e}")
            return False

# Global instance
ensemble_detector = EnsembleFraudDetector()
