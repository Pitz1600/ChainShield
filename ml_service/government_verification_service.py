"""
Government Verification Service
Verifies transactions against Philippine government databases
"""

import pandas as pd
from pathlib import Path
import logging
from typing import Dict, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GovernmentVerificationService:
    """Verify transactions against government databases"""
    
    def __init__(self, data_dir='datasets'):
        self.data_dir = Path(data_dir)
        
        # Load reference databases
        self.philgeps_prices = self._load_philgeps_prices()
        self.psa_demographics = self._load_psa_demographics()
        
        logger.info("Government Verification Service initialized")
    
    def _load_philgeps_prices(self) -> Optional[pd.DataFrame]:
        """Load PhilGEPS price database"""
        path = self.data_dir / 'philgeps_prices.csv'
        if path.exists():
            df = pd.read_csv(path)
            logger.info(f"Loaded {len(df)} PhilGEPS price records")
            return df
        else:
            logger.warning(f"PhilGEPS prices not found at {path}")
            return None
    
    def _load_psa_demographics(self) -> Optional[pd.DataFrame]:
        """Load PSA demographics database"""
        path = self.data_dir / 'psa_demographics.csv'
        if path.exists():
            df = pd.read_csv(path)
            logger.info(f"Loaded {len(df)} PSA demographic records")
            return df
        else:
            logger.warning(f"PSA demographics not found at {path}")
            return None
    
    def verify_procurement_price(self, transaction: Dict) -> Dict:
        """
        Verify procurement price against PhilGEPS database
        
        Returns:
            {
                'is_verified': bool,
                'market_price': float,
                'transaction_price': float,
                'price_difference_pct': float,
                'is_overpriced': bool,
                'explanation': str
            }
        """
        result = {
            'is_verified': False,
            'market_price': None,
            'transaction_price': transaction.get('amount', 0),
            'price_difference_pct': 0,
            'is_overpriced': False,
            'explanation': ''
        }
        
        if transaction.get('transactionType') != 'Procurement':
            result['explanation'] = 'Not a procurement transaction'
            return result
        
        if self.philgeps_prices is None:
            result['explanation'] = 'PhilGEPS price database not available'
            return result
        
        # Try to match item category
        item_category = transaction.get('itemCategory', 'Unknown')
        matching_prices = self.philgeps_prices[
            self.philgeps_prices['category'] == item_category
        ]
        
        if len(matching_prices) == 0:
            result['explanation'] = f'No price data available for category: {item_category}'
            return result
        
        # Get market price (use median for robustness)
        market_price = matching_prices['median_price'].iloc[0]
        transaction_price = float(transaction.get('amount', 0))
        
        # Calculate price difference
        price_diff_pct = ((transaction_price - market_price) / market_price) * 100
        
        result.update({
            'is_verified': True,
            'market_price': market_price,
            'price_difference_pct': price_diff_pct,
            'is_overpriced': price_diff_pct > 20,  # More than 20% above market
            'explanation': f'Market price: ₱{market_price:,.2f}, Transaction: ₱{transaction_price:,.2f} ({price_diff_pct:+.1f}%)'
        })
        
        return result
    
    def verify_beneficiary_count(self, transaction: Dict) -> Dict:
        """
        Verify beneficiary count against PSA population data
        
        Returns:
            {
                'is_verified': bool,
                'region_population': int,
                'region_households': int,
                'beneficiary_count': int,
                'beneficiary_to_household_ratio': float,
                'is_suspicious': bool,
                'explanation': str
            }
        """
        result = {
            'is_verified': False,
            'region_population': None,
            'region_households': None,
            'beneficiary_count': transaction.get('beneficiaryCount', 0),
            'beneficiary_to_household_ratio': 0,
            'is_suspicious': False,
            'explanation': ''
        }
        
        if transaction.get('transactionType') != 'Social Welfare':
            result['explanation'] = 'Not a social welfare transaction'
            return result
        
        if self.psa_demographics is None:
            result['explanation'] = 'PSA demographics database not available'
            return result
        
        # Try to match region
        region = transaction.get('region', '')
        if not region:
            result['explanation'] = 'No region specified in transaction'
            return result
        
        matching_region = self.psa_demographics[
            self.psa_demographics['region'] == region
        ]
        
        if len(matching_region) == 0:
            result['explanation'] = f'No demographic data available for region: {region}'
            return result
        
        # Get population data
        population = int(matching_region['population'].iloc[0])
        households = int(matching_region['households'].iloc[0])
        beneficiary_count = int(transaction.get('beneficiaryCount', 0))
        
        # Calculate ratio
        ratio = beneficiary_count / households if households > 0 else 0
        
        # Flag suspicious patterns
        is_suspicious = False
        explanations = []
        
        if beneficiary_count > population:
            is_suspicious = True
            explanations.append(f'Beneficiary count ({beneficiary_count:,}) exceeds total population ({population:,})')
        elif beneficiary_count > households:
            is_suspicious = True
            explanations.append(f'Beneficiary count ({beneficiary_count:,}) exceeds total households ({households:,})')
        elif ratio > 0.5:
            is_suspicious = True
            explanations.append(f'Beneficiaries represent {ratio*100:.1f}% of households (unusually high)')
        
        result.update({
            'is_verified': True,
            'region_population': population,
            'region_households': households,
            'beneficiary_to_household_ratio': ratio,
            'is_suspicious': is_suspicious,
            'explanation': '; '.join(explanations) if explanations else f'Beneficiary count appears reasonable for {region}'
        })
        
        return result
    
    def verify_transaction(self, transaction: Dict) -> Dict:
        """
        Comprehensive transaction verification
        
        Returns:
            {
                'procurement_verification': dict,
                'beneficiary_verification': dict,
                'overall_risk_score': int,
                'verification_flags': list
            }
        """
        result = {
            'procurement_verification': {},
            'beneficiary_verification': {},
            'overall_risk_score': 0,
            'verification_flags': []
        }
        
        # Verify procurement price
        if transaction.get('transactionType') == 'Procurement':
            proc_result = self.verify_procurement_price(transaction)
            result['procurement_verification'] = proc_result
            
            if proc_result.get('is_overpriced'):
                result['overall_risk_score'] += 30
                result['verification_flags'].append('Overpriced procurement')
        
        # Verify beneficiary count
        if transaction.get('transactionType') == 'Social Welfare':
            ben_result = self.verify_beneficiary_count(transaction)
            result['beneficiary_verification'] = ben_result
            
            if ben_result.get('is_suspicious'):
                result['overall_risk_score'] += 35
                result['verification_flags'].append('Suspicious beneficiary count')
        
        return result


if __name__ == '__main__':
    # Test verification service
    service = GovernmentVerificationService()
    
    # Test procurement verification
    test_procurement = {
        'transactionType': 'Procurement',
        'amount': 45000,
        'itemCategory': 'IT Equipment',
        'description': 'Desktop computers'
    }
    
    print("\n" + "="*60)
    print("Test: Procurement Price Verification")
    print("="*60)
    result1 = service.verify_procurement_price(test_procurement)
    print(f"Is Verified: {result1['is_verified']}")
    print(f"Is Overpriced: {result1['is_overpriced']}")
    print(f"Explanation: {result1['explanation']}")
    
    # Test beneficiary verification
    test_welfare = {
        'transactionType': 'Social Welfare',
        'beneficiaryCount': 5000,
        'region': 'NCR - National Capital Region',
        'amount': 15000000
    }
    
    print("\n" + "="*60)
    print("Test: Beneficiary Count Verification")
    print("="*60)
    result2 = service.verify_beneficiary_count(test_welfare)
    print(f"Is Verified: {result2['is_verified']}")
    print(f"Is Suspicious: {result2['is_suspicious']}")
    print(f"Explanation: {result2['explanation']}")
    
    print("\n" + "="*60)
    print("Government Verification Service Ready!")
    print("="*60)
