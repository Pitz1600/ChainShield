"""
Philippine-Specific Fraud Pattern Detection
Implements detection algorithms for common fraud schemes in PH government
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PhilippineFraudPatterns:
    """Detect Philippine-specific government fraud patterns"""
    
    def __init__(self, philgeps_prices_path=None, psa_demographics_path=None):
        """
        Initialize with reference data
        
        Args:
            philgeps_prices_path: Path to PhilGEPS price database CSV
            psa_demographics_path: Path to PSA demographics CSV
        """
        self.philgeps_prices = None
        self.psa_demographics = None
        
        # Load reference data if provided
        if philgeps_prices_path:
            self.philgeps_prices = pd.read_csv(philgeps_prices_path)
            logger.info(f"Loaded {len(self.philgeps_prices)} PhilGEPS price records")
        
        if psa_demographics_path:
            self.psa_demographics = pd.read_csv(psa_demographics_path)
            logger.info(f"Loaded {len(self.psa_demographics)} PSA demographic records")
    
    def detect_overpricing(self, transaction: Dict) -> Tuple[bool, float, str]:
        """
        Detect overpricing in procurement transactions
        
        Returns:
            (is_overpriced, overpricing_percentage, explanation)
        """
        if transaction.get('transactionType') != 'Procurement':
            return False, 0.0, ''
        
        amount = float(transaction.get('amount', 0))
        item_category = transaction.get('itemCategory', 'Unknown')
        
        # If we have PhilGEPS price data, compare
        if self.philgeps_prices is not None:
            matching_prices = self.philgeps_prices[
                self.philgeps_prices['category'] == item_category
            ]
            
            if len(matching_prices) > 0:
                avg_price = matching_prices['average_price'].iloc[0]
                overpricing_pct = ((amount - avg_price) / avg_price) * 100
                
                if overpricing_pct > 20:  # More than 20% above market rate
                    explanation = f"Price ₱{amount:,.0f} is {overpricing_pct:.1f}% above market average of ₱{avg_price:,.0f}"
                    return True, overpricing_pct, explanation
        
        # Fallback: Use heuristic thresholds for common items
        overpricing_thresholds = {
            'Office Supplies': 200,  # Per ream of paper
            'IT Equipment': 40000,   # Per desktop computer
            'Construction Materials': 300,  # Per bag of cement
            'Vehicles': 1300000      # Per pickup truck
        }
        
        if item_category in overpricing_thresholds:
            threshold = overpricing_thresholds[item_category]
            if amount > threshold * 1.3:  # 30% above threshold
                overpricing_pct = ((amount - threshold) / threshold) * 100
                explanation = f"Procurement price significantly above typical range for {item_category}"
                return True, overpricing_pct, explanation
        
        return False, 0.0, ''
    
    def detect_ghost_beneficiaries(self, transaction: Dict) -> Tuple[bool, str]:
        """
        Detect ghost beneficiaries in welfare programs
        
        Returns:
            (has_ghost_beneficiaries, explanation)
        """
        if transaction.get('transactionType') != 'Social Welfare':
            return False, ''
        
        beneficiary_count = transaction.get('beneficiaryCount', 0)
        region = transaction.get('region', '')
        
        # Check for impossible beneficiary counts
        if self.psa_demographics is not None and region:
            matching_region = self.psa_demographics[
                self.psa_demographics['region'] == region
            ]
            
            if len(matching_region) > 0:
                population = matching_region['population'].iloc[0]
                households = matching_region['households'].iloc[0]
                
                # Flag if beneficiaries exceed 50% of households (unrealistic for most programs)
                if beneficiary_count > households * 0.5:
                    explanation = f"Beneficiary count ({beneficiary_count:,}) exceeds 50% of households in {region} ({households:,})"
                    return True, explanation
                
                # Flag if beneficiaries exceed population (impossible)
                if beneficiary_count > population:
                    explanation = f"Beneficiary count ({beneficiary_count:,}) exceeds total population of {region} ({population:,})"
                    return True, explanation
        
        # Heuristic checks
        amount = float(transaction.get('amount', 0))
        
        # Check for suspiciously round numbers in large amounts
        if beneficiary_count > 1000 and beneficiary_count % 1000 == 0:
            explanation = f"Suspiciously round beneficiary count: {beneficiary_count:,}"
            return True, explanation
        
        # Check for unrealistic per-beneficiary amounts
        if beneficiary_count > 0:
            per_beneficiary = amount / beneficiary_count
            
            # Typical 4Ps (Pantawid Pamilya) is ₱1,400-₱3,000 per month
            if per_beneficiary < 100 or per_beneficiary > 50000:
                explanation = f"Unrealistic per-beneficiary amount: ₱{per_beneficiary:,.0f}"
                return True, explanation
        
        return False, ''
    
    def detect_transaction_splitting(self, transactions: List[Dict]) -> Tuple[bool, str]:
        """
        Detect transaction splitting to avoid audit thresholds
        
        Common PH audit thresholds:
        - ₱50,000: Requires additional documentation
        - ₱1,000,000: Requires COA approval
        
        Returns:
            (has_splitting, explanation)
        """
        if len(transactions) < 2:
            return False, ''
        
        # Group by agency and time window (same day)
        df = pd.DataFrame(transactions)
        
        if 'timestamp' not in df.columns or 'agency' not in df.columns:
            return False, ''
        
        df['date'] = pd.to_datetime(df['timestamp']).dt.date
        
        # Check for multiple transactions just below thresholds
        thresholds = [50000, 1000000]
        
        for threshold in thresholds:
            # Find transactions within 10% below threshold
            near_threshold = df[
                (df['amount'] >= threshold * 0.9) & 
                (df['amount'] < threshold)
            ]
            
            # Group by agency and date
            grouped = near_threshold.groupby(['agency', 'date']).agg({
                'amount': ['count', 'sum']
            })
            
            # Flag if multiple transactions from same agency on same day
            suspicious = grouped[grouped[('amount', 'count')] >= 2]
            
            if len(suspicious) > 0:
                for (agency, date), row in suspicious.iterrows():
                    count = int(row[('amount', 'count')])
                    total = row[('amount', 'sum')]
                    
                    explanation = f"Detected {count} transactions from {agency} on {date} totaling ₱{total:,.0f}, each just below ₱{threshold:,} threshold"
                    return True, explanation
        
        return False, ''
    
    def detect_circular_transactions(self, transaction: Dict, network_features: Dict) -> Tuple[bool, str]:
        """
        Detect circular movement of funds (kickback schemes)
        
        Returns:
            (has_circular_pattern, explanation)
        """
        # Check network features for circular patterns
        if network_features.get('hasCircularPath', False):
            path_length = network_features.get('circularPathLength', 0)
            explanation = f"Circular fund movement detected: money returns to source in {path_length} hops"
            return True, explanation
        
        # Check for high clustering coefficient (tight network)
        clustering = network_features.get('clusteringCoefficient', 0)
        if clustering > 0.7:
            explanation = f"High network clustering ({clustering:.2f}) suggests tight-knit transaction group (potential collusion)"
            return True, explanation
        
        # Check for unusual bidirectional flows
        in_degree = network_features.get('inDegree', 0)
        out_degree = network_features.get('outDegree', 0)
        
        if in_degree > 0 and out_degree > 0 and abs(in_degree - out_degree) < 2:
            explanation = f"Balanced in/out transactions ({in_degree}/{out_degree}) suggests circular flow"
            return True, explanation
        
        return False, ''
    
    def detect_pdaf_pattern(self, transaction: Dict) -> Tuple[bool, str]:
        """
        Detect patterns similar to PDAF (Pork Barrel) scam
        
        Characteristics:
        - Grant or procurement type
        - High amounts
        - To NGOs or contractors
        - Possible ghost projects
        """
        tx_type = transaction.get('transactionType', '')
        amount = float(transaction.get('amount', 0))
        beneficiary_type = transaction.get('beneficiaryType', '')
        
        risk_factors = []
        
        # High-value grants to organizations
        if tx_type == 'Grant' and amount > 1000000:
            risk_factors.append('High-value grant')
        
        # To NGO or contractor
        if beneficiary_type in ['Organization', 'Contractor']:
            risk_factors.append(f'Beneficiary is {beneficiary_type}')
        
        # Check for ghost project indicators
        description = transaction.get('description', '').lower()
        ghost_keywords = ['livelihood', 'training', 'seminar', 'capacity building']
        
        if any(keyword in description for keyword in ghost_keywords):
            risk_factors.append('Project type commonly used in PDAF scam')
        
        # Rapid disbursement
        if transaction.get('daysToDisburse', 999) < 7:
            risk_factors.append('Unusually rapid disbursement')
        
        if len(risk_factors) >= 2:
            explanation = "PDAF-like pattern detected: " + "; ".join(risk_factors)
            return True, explanation
        
        return False, ''
    
    def detect_procurement_collusion(self, transactions: List[Dict]) -> Tuple[bool, str]:
        """
        Detect procurement collusion (repeated contractor wins)
        
        Returns:
            (has_collusion, explanation)
        """
        if len(transactions) < 3:
            return False, ''
        
        df = pd.DataFrame(transactions)
        
        # Filter procurement transactions
        procurement = df[df['transactionType'] == 'Procurement']
        
        if len(procurement) < 3:
            return False, ''
        
        # Check for repeated contractor-agency pairs
        if 'toAddress' in procurement.columns and 'agency' in procurement.columns:
            contractor_agency_pairs = procurement.groupby(['toAddress', 'agency']).size()
            
            # Flag if same contractor wins multiple times from same agency
            repeated = contractor_agency_pairs[contractor_agency_pairs >= 3]
            
            if len(repeated) > 0:
                for (contractor, agency), count in repeated.items():
                    total_amount = procurement[
                        (procurement['toAddress'] == contractor) & 
                        (procurement['agency'] == agency)
                    ]['amount'].sum()
                    
                    explanation = f"Contractor {contractor[:10]}... won {count} procurements from {agency}, totaling ₱{total_amount:,.0f} (possible collusion)"
                    return True, explanation
        
        return False, ''
    
    def analyze_transaction(self, transaction: Dict, network_features: Dict = None, 
                          transaction_history: List[Dict] = None) -> Dict:
        """
        Comprehensive fraud pattern analysis for a transaction
        
        Returns:
            Dictionary with all detected patterns and risk scores
        """
        if network_features is None:
            network_features = {}
        if transaction_history is None:
            transaction_history = []
        
        results = {
            'patterns_detected': [],
            'risk_score': 0,
            'explanations': [],
            'fraud_indicators': {}
        }
        
        # Check overpricing
        is_overpriced, overprice_pct, overprice_exp = self.detect_overpricing(transaction)
        if is_overpriced:
            results['patterns_detected'].append('Overpricing')
            results['explanations'].append(overprice_exp)
            results['fraud_indicators']['overpricing_percentage'] = overprice_pct
            results['risk_score'] += 25
        
        # Check ghost beneficiaries
        has_ghost, ghost_exp = self.detect_ghost_beneficiaries(transaction)
        if has_ghost:
            results['patterns_detected'].append('Ghost Beneficiaries')
            results['explanations'].append(ghost_exp)
            results['risk_score'] += 30
        
        # Check circular transactions
        has_circular, circular_exp = self.detect_circular_transactions(transaction, network_features)
        if has_circular:
            results['patterns_detected'].append('Circular Transactions')
            results['explanations'].append(circular_exp)
            results['risk_score'] += 35
        
        # Check PDAF pattern
        has_pdaf, pdaf_exp = self.detect_pdaf_pattern(transaction)
        if has_pdaf:
            results['patterns_detected'].append('PDAF-like Pattern')
            results['explanations'].append(pdaf_exp)
            results['risk_score'] += 20
        
        # Check transaction splitting (requires history)
        if transaction_history:
            has_splitting, split_exp = self.detect_transaction_splitting(transaction_history + [transaction])
            if has_splitting:
                results['patterns_detected'].append('Transaction Splitting')
                results['explanations'].append(split_exp)
                results['risk_score'] += 25
        
        # Check procurement collusion (requires history)
        if transaction_history:
            has_collusion, collusion_exp = self.detect_procurement_collusion(transaction_history + [transaction])
            if has_collusion:
                results['patterns_detected'].append('Procurement Collusion')
                results['explanations'].append(collusion_exp)
                results['risk_score'] += 30
        
        # Cap risk score at 100
        results['risk_score'] = min(results['risk_score'], 100)
        
        return results


if __name__ == '__main__':
    # Test fraud pattern detection
    detector = PhilippineFraudPatterns()
    
    # Test case 1: Overpricing
    test_tx1 = {
        'transactionType': 'Procurement',
        'amount': 60000,
        'itemCategory': 'IT Equipment',
        'description': 'Desktop computers'
    }
    
    result1 = detector.analyze_transaction(test_tx1)
    print("\n" + "="*60)
    print("Test Case 1: Overpricing Detection")
    print("="*60)
    print(f"Patterns: {result1['patterns_detected']}")
    print(f"Risk Score: {result1['risk_score']}")
    print(f"Explanations: {result1['explanations']}")
    
    # Test case 2: Ghost beneficiaries
    test_tx2 = {
        'transactionType': 'Social Welfare',
        'amount': 5000000,
        'beneficiaryCount': 10000,
        'region': 'NCR - National Capital Region'
    }
    
    result2 = detector.analyze_transaction(test_tx2)
    print("\n" + "="*60)
    print("Test Case 2: Ghost Beneficiaries Detection")
    print("="*60)
    print(f"Patterns: {result2['patterns_detected']}")
    print(f"Risk Score: {result2['risk_score']}")
    print(f"Explanations: {result2['explanations']}")
    
    print("\n" + "="*60)
    print("Philippine Fraud Pattern Detection Ready!")
    print("="*60)
