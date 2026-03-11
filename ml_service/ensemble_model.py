"""
Ensemble ML Model for Enhanced Fraud Detection
Combines XGBoost, Random Forest, and Gradient Boosting
Integrated with Philippine-specific fraud patterns
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from xgboost import XGBClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
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
        self.calibrated_models = {}
        self.feature_names = []
        self.feature_importances_ = {}
        self.training_metrics_ = {}
        self.isolation_forest = IsolationForest(
            n_estimators=100,
            contamination=0.02,
            random_state=42
        )
        self.unsup_min_ = None
        self.unsup_max_ = None
        
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
    
    def _safe_float(self, value, default=0.0):
        try:
            v = float(value)
            if np.isnan(v) or np.isinf(v):
                return default
            return v
        except Exception:
            return default

    def _clip(self, value, min_val=0.0, max_val=1.0):
        return max(min_val, min(max_val, value))

    def _normalize(self, value, divisor, min_val=0.0, max_val=1.0):
        if divisor <= 0:
            return self._clip(value, min_val, max_val)
        return self._clip(value / divisor, min_val, max_val)

    def _extract_time_features(self, transaction):
        ts = transaction.get('timestamp')
        if ts is None:
            return 0.0, 0.0
        try:
            ts = pd.to_datetime(ts)
        except Exception:
            return 0.0, 0.0
        time_of_day = self._normalize(ts.hour, 23.0)
        day_of_week = self._normalize(ts.dayofweek, 6.0)
        return time_of_day, day_of_week

    def prepare_features(self, transaction, batch_stats=None):
        """Extract and normalize features from transaction"""
        features = []

        amount = self._safe_float(transaction.get('amount', 0))
        z_score = transaction.get('z_score')
        if z_score is None and batch_stats:
            mean = batch_stats.get('mean', 0.0)
            std = batch_stats.get('std', 0.0) or 0.0
            z_score = (amount - mean) / std if std else 0.0
        z_score = self._safe_float(z_score, 0.0)
        
        # Amount-based features
        features.append(amount)
        features.append(np.log1p(max(amount, 0)))  # Log amount
        
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
        features.append(self._safe_float(network.get('degree', 0)))
        features.append(self._safe_float(network.get('inDegree', 0)))
        features.append(self._safe_float(network.get('outDegree', 0)))
        features.append(self._safe_float(network.get('clusteringCoefficient', 0)))
        features.append(self._safe_float(network.get('betweennessCentrality', 0)))

        # Additional behavioral features
        transaction_velocity = self._safe_float(transaction.get('transaction_velocity', 0))
        receiver_frequency = self._safe_float(transaction.get('receiver_frequency', 0))
        amount_ratio = self._safe_float(transaction.get('amount_ratio', 0))
        historical_sender_risk = self._safe_float(transaction.get('historical_sender_risk', 0))
        transaction_sequence_index = self._safe_float(transaction.get('transaction_sequence_index', 0))

        time_of_day, day_of_week = self._extract_time_features(transaction)

        # Normalization
        features.append(self._normalize(z_score + 5.0, 10.0))  # map [-5,5] -> [0,1]
        features.append(self._normalize(transaction_velocity, 20.0))
        features.append(self._normalize(receiver_frequency, 10.0))
        features.append(self._normalize(amount_ratio, 10.0))
        features.append(time_of_day)
        features.append(day_of_week)
        features.append(self._clip(historical_sender_risk, 0.0, 1.0))
        features.append(self._normalize(transaction_sequence_index, 1000.0))

        self.feature_names = (
            ['amount', 'log_amount'] +
            [f'tx_type_{t}' for t in tx_types] +
            [f'ben_type_{b}' for b in ben_types] +
            ['degree', 'in_degree', 'out_degree', 'clustering', 'betweenness'] +
            [
                'z_score',
                'transaction_velocity',
                'receiver_frequency',
                'amount_ratio',
                'time_of_day',
                'day_of_week',
                'historical_sender_risk',
                'transaction_sequence_index'
            ]
        )

        return np.array(features).reshape(1, -1)
    
    def train(self, X, y):
        """Train all models in the ensemble with calibration and evaluation"""
        X = np.nan_to_num(X)
        y = np.asarray(y)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        self.calibrated_models = {}
        self.feature_importances_ = {}

        for name, model in self.models.items():
            print(f"Training {name}...")
            base_model = model
            calibrated = CalibratedClassifierCV(base_model, method='sigmoid', cv=3)
            calibrated.fit(X_train_scaled, y_train)
            self.calibrated_models[name] = calibrated

            if hasattr(base_model, 'feature_importances_'):
                self.feature_importances_[name] = base_model.feature_importances_.tolist()

        # Train unsupervised anomaly detector
        try:
            self.isolation_forest.fit(X_train_scaled)
            scores = self.isolation_forest.decision_function(X_train_scaled)
            self.unsup_min_ = float(np.min(scores))
            self.unsup_max_ = float(np.max(scores))
        except Exception:
            self.unsup_min_ = None
            self.unsup_max_ = None

        self.is_trained = True

        # Evaluate ensemble on holdout set
        ensemble_probs = self._ensemble_predict_proba(X_test_scaled)
        preds = (ensemble_probs >= 0.5).astype(int)
        self.training_metrics_ = {
            'accuracy': accuracy_score(y_test, preds),
            'precision': precision_score(y_test, preds, zero_division=0),
            'recall': recall_score(y_test, preds, zero_division=0),
            'f1': f1_score(y_test, preds, zero_division=0),
            'roc_auc': roc_auc_score(y_test, ensemble_probs)
        }

        print("Ensemble training complete!")
        print("Metrics:", self.training_metrics_)

        # Cross-validation (ensemble)
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = []
        for train_idx, test_idx in skf.split(X, y):
            X_tr = self.scaler.fit_transform(X[train_idx])
            X_te = self.scaler.transform(X[test_idx])
            y_tr = y[train_idx]
            y_te = y[test_idx]
            fold_models = {}
            for name, model in self.models.items():
                calibrated = CalibratedClassifierCV(model, method='sigmoid', cv=3)
                calibrated.fit(X_tr, y_tr)
                fold_models[name] = calibrated
            probs = self._ensemble_predict_proba(X_te, fold_models)
            cv_scores.append(roc_auc_score(y_te, probs))
        if cv_scores:
            self.training_metrics_['cv_roc_auc'] = float(np.mean(cv_scores))
    
    def _ensemble_predict_proba(self, X_scaled, models=None):
        models = models or self.calibrated_models or self.models
        if X_scaled is None:
            return 0.0
        X_scaled = np.asarray(X_scaled)
        multi = X_scaled.ndim > 1 and X_scaled.shape[0] > 1
        predictions = {}
        for name, model in models.items():
            probs = model.predict_proba(X_scaled)
            col = probs[:, 1] if probs.shape[1] > 1 else probs[:, 0]
            predictions[name] = col
        ensemble_prob = sum(
            predictions[name] * self.weights[name]
            for name in predictions.keys()
        )
        ensemble_prob = np.clip(ensemble_prob, 0.0, 1.0)
        return ensemble_prob if multi else float(ensemble_prob[0])

    def predict_proba(self, transaction, network_features=None, batch_stats=None):
        """Get fraud probability using ensemble + Z-score + Philippine patterns"""
        # Prepare features
        X = self.prepare_features(transaction, batch_stats=batch_stats)
        X_scaled = self.scaler.transform(X) if self.is_trained else X

        ensemble_prob = self._ensemble_predict_proba(X_scaled) if self.is_trained else self._rule_based_prediction(transaction, network_features)

        # Z-score risk
        amount = self._safe_float(transaction.get('amount', 0))
        z_score = transaction.get('z_score')
        if z_score is None and batch_stats:
            mean = batch_stats.get('mean', 0.0)
            std = batch_stats.get('std', 0.0) or 0.0
            z_score = (amount - mean) / std if std else 0.0
        z_score = self._safe_float(z_score, 0.0)
        z_risk = min(abs(z_score) * 30.0, 100.0) / 100.0

        # Unsupervised anomaly risk
        unsupervised_risk = 0.0
        if self.is_trained and self.isolation_forest is not None:
            try:
                score = float(self.isolation_forest.decision_function(X_scaled)[0])
                if self.unsup_min_ is not None and self.unsup_max_ is not None and self.unsup_max_ > self.unsup_min_:
                    norm = (score - self.unsup_min_) / (self.unsup_max_ - self.unsup_min_)
                    unsupervised_risk = float(1.0 - np.clip(norm, 0.0, 1.0))
            except Exception:
                unsupervised_risk = 0.0

        # Philippine pattern risk
        pattern_risk = 0.0
        if self.ph_fraud_detector:
            ph_analysis = self.ph_fraud_detector.analyze_transaction(
                transaction,
                network_features=network_features or transaction.get('networkFeatures', {})
            )
            pattern_risk = min(self._safe_float(ph_analysis.get('risk_score', 0.0)) / 100.0, 1.0)

        final_prob = (ensemble_prob * 0.5) + (z_risk * 0.2) + (unsupervised_risk * 0.2) + (pattern_risk * 0.1)
        final_prob = float(np.clip(final_prob, 0.0, 1.0))

        triggered_signals = []
        if ensemble_prob >= 0.5:
            triggered_signals.append('ensemble_ml')
        if z_risk >= 0.4:
            triggered_signals.append('z_score')
        if unsupervised_risk >= 0.5:
            triggered_signals.append('unsupervised')
        if pattern_risk > 0:
            triggered_signals.append('ph_pattern')

        return {
            'z_score': float(z_score),
            'z_risk': float(z_risk),
            'ensemble_probability': float(ensemble_prob),
            'unsupervised_risk': float(unsupervised_risk),
            'pattern_risk': float(pattern_risk),
            'final_probability': final_prob,
            'risk_level': self.get_risk_level(final_prob),
            'triggered_signals': triggered_signals
        }
    
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

    def predict_batch(self, transactions):
        """Batch prediction with Z-score stats and feature extraction"""
        txs = transactions or []
        amounts = np.array([self._safe_float(t.get('amount', 0)) for t in txs])
        mean = float(np.mean(amounts)) if len(amounts) else 0.0
        std = float(np.std(amounts)) if len(amounts) else 0.0
        batch_stats = {'mean': mean, 'std': std}

        # Precompute sender averages and receiver counts within batch
        sender_amounts = {}
        sender_counts = {}
        receiver_counts = {}
        for t in txs:
            sender = t.get('fromAddress')
            receiver = t.get('toAddress')
            amt = self._safe_float(t.get('amount', 0))
            if sender:
                sender_amounts[sender] = sender_amounts.get(sender, 0.0) + amt
                sender_counts[sender] = sender_counts.get(sender, 0) + 1
            if sender and receiver:
                key = f"{sender}::{receiver}"
                receiver_counts[key] = receiver_counts.get(key, 0) + 1

        results = []
        for idx, t in enumerate(txs):
            sender = t.get('fromAddress')
            receiver = t.get('toAddress')
            avg_amount = sender_amounts.get(sender, 0.0) / max(sender_counts.get(sender, 1), 1)
            amount_ratio = self._safe_float(t.get('amount', 0)) / avg_amount if avg_amount else 0.0
            receiver_freq = receiver_counts.get(f"{sender}::{receiver}", 0)

            enriched = dict(t)
            enriched['z_score'] = (self._safe_float(t.get('amount', 0)) - mean) / std if std else 0.0
            enriched['transaction_velocity'] = self._safe_float(t.get('transaction_velocity', 0))
            enriched['receiver_frequency'] = receiver_freq
            enriched['amount_ratio'] = amount_ratio
            enriched['historical_sender_risk'] = self._safe_float(t.get('historical_sender_risk', 0))
            enriched['transaction_sequence_index'] = idx

            result = self.predict_proba(enriched, batch_stats=batch_stats)
            results.append(result)

        return results

    def get_risk_level(self, probability):
        if probability >= 0.71:
            return 'HIGH'
        if probability >= 0.41:
            return 'MEDIUM'
        return 'LOW'
    
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
