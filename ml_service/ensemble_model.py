"""
Ensemble ML Model for Enhanced Fraud Detection
Combines XGBoost, Random Forest, and Gradient Boosting
Integrated with Philippine-specific fraud patterns
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from xgboost import XGBClassifier
from sklearn.preprocessing import StandardScaler
import joblib
import os
from pathlib import Path

# Import Philippine fraud detection modules
try:
    from ph_fraud_patterns import PhilippineFraudPatterns
    from government_verification_service import GovernmentVerificationService
    PH_MODULES_AVAILABLE = True
except ImportError:
    PH_MODULES_AVAILABLE = False
    print("Warning: Philippine fraud detection modules not available")

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
        
        # Initialize Philippine fraud detection modules
        if PH_MODULES_AVAILABLE:
            data_dir = Path('datasets')
            philgeps_path = data_dir / 'philgeps_prices.csv' if data_dir.exists() else None
            psa_path = data_dir / 'psa_demographics.csv' if data_dir.exists() else None
            
            self.ph_fraud_detector = PhilippineFraudPatterns(
                philgeps_prices_path=philgeps_path,
                psa_demographics_path=psa_path
            )
            self.gov_verification = GovernmentVerificationService(data_dir='datasets')
            print("Philippine fraud detection modules initialized")
        else:
            self.ph_fraud_detector = None
            self.gov_verification = None
    
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
    
    def predict_proba(self, transaction, network_features=None):
        """Get fraud probability using ensemble voting + Philippine patterns"""
        if not self.is_trained:
            # Use rule-based fallback if not trained
            return self._rule_based_prediction(transaction, network_features)
        
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
        
        # Enhance with Philippine fraud patterns
        if self.ph_fraud_detector:
            ph_analysis = self.ph_fraud_detector.analyze_transaction(
                transaction,
                network_features=network_features or transaction.get('networkFeatures', {})
            )
            
            # Combine ML prediction with pattern detection
            # If patterns detected, increase risk score
            if ph_analysis['risk_score'] > 0:
                pattern_boost = ph_analysis['risk_score'] / 100 * 0.3  # Up to 30% boost
                ensemble_prob = min(ensemble_prob + pattern_boost, 1.0)
        
        return ensemble_prob
    
    def _rule_based_prediction(self, transaction, network_features=None):
        """Fallback rule-based prediction with Philippine patterns"""
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
        network = network_features or transaction.get('networkFeatures', {})
        if network.get('degree', 0) > 10:
            risk_score += 0.2
        
        # Use Philippine fraud patterns if available
        if self.ph_fraud_detector:
            ph_analysis = self.ph_fraud_detector.analyze_transaction(
                transaction,
                network_features=network
            )
            
            # Add pattern-based risk
            pattern_risk = ph_analysis['risk_score'] / 100
            risk_score = min(risk_score + pattern_risk, 1.0)
        
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
