"""
Data Processing Pipeline for Philippine Fraud Detection
Processes collected data and creates labeled training datasets
"""

import pandas as pd
import numpy as np
from pathlib import Path
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FraudDataProcessor:
    """Process and label fraud data for ML training"""
    
    def __init__(self, data_dir='datasets'):
        self.data_dir = Path(data_dir)
        self.output_dir = self.data_dir
        self.output_dir.mkdir(exist_ok=True)
    
    def load_all_data(self):
        """Load all collected data sources"""
        logger.info("Loading collected data...")
        
        data = {}
        
        # Load COA fraud cases
        coa_path = self.data_dir / 'coa_fraud_cases.csv'
        if coa_path.exists():
            data['coa'] = pd.read_csv(coa_path)
            logger.info(f"Loaded {len(data['coa'])} COA cases")
        
        # Load Ombudsman cases
        ombudsman_path = self.data_dir / 'ombudsman_cases.csv'
        if ombudsman_path.exists():
            data['ombudsman'] = pd.read_csv(ombudsman_path)
            logger.info(f"Loaded {len(data['ombudsman'])} Ombudsman cases")
        
        # Load PhilGEPS prices
        philgeps_path = self.data_dir / 'philgeps_prices.csv'
        if philgeps_path.exists():
            data['philgeps'] = pd.read_csv(philgeps_path)
            logger.info(f"Loaded {len(data['philgeps'])} PhilGEPS price records")
        
        # Load PSA demographics
        psa_path = self.data_dir / 'psa_demographics.csv'
        if psa_path.exists():
            data['psa'] = pd.read_csv(psa_path)
            logger.info(f"Loaded {len(data['psa'])} PSA demographic records")
        
        # Load historical scandals
        scandals_path = self.data_dir / 'historical_scandals.csv'
        if scandals_path.exists():
            data['scandals'] = pd.read_csv(scandals_path)
            logger.info(f"Loaded {len(data['scandals'])} historical scandal records")
        
        return data
    
    def create_training_dataset(self):
        """
        Create labeled training dataset from fraud cases
        """
        logger.info("Creating training dataset...")
        
        data = self.load_all_data()
        
        # Combine fraud cases from all sources
        fraud_cases = []
        
        # Process COA cases
        if 'coa' in data:
            for _, row in data['coa'].iterrows():
                fraud_cases.append(self._create_training_record(row, 'COA'))
        
        # Process Ombudsman cases
        if 'ombudsman' in data:
            for _, row in data['ombudsman'].iterrows():
                fraud_cases.append(self._create_training_record(row, 'Ombudsman'))
        
        # Generate synthetic legitimate transactions for balance
        legitimate_cases = self._generate_legitimate_transactions(len(fraud_cases))
        
        # Combine all cases
        all_cases = fraud_cases + legitimate_cases
        
        # Create DataFrame
        df = pd.DataFrame(all_cases)
        
        # Shuffle dataset
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)
        
        # Save training dataset
        output_path = self.output_dir / 'training_dataset_v1.csv'
        df.to_csv(output_path, index=False)
        
        logger.info(f"Created training dataset with {len(df)} records")
        logger.info(f"  - Fraudulent: {df['is_fraudulent'].sum()}")
        logger.info(f"  - Legitimate: {(~df['is_fraudulent']).sum()}")
        logger.info(f"Saved to: {output_path}")
        
        return df
    
    def _create_training_record(self, row, source):
        """
        Convert fraud case to training record with features
        """
        # Extract indicators as features
        indicators = row.get('indicators', '[]')
        if isinstance(indicators, str):
            try:
                indicators = eval(indicators)
            except:
                indicators = []
        
        # Create feature record
        record = {
            'source': source,
            'case_id': row.get('case_id', 'UNKNOWN'),
            'amount': row.get('amount', 0),
            'transaction_type': row.get('transaction_type', 'Other'),
            'agency': row.get('agency', 'Unknown'),
            'fraud_type': row.get('fraud_type', 'Other'),
            'is_fraudulent': row.get('is_fraudulent', True),
            
            # Feature flags based on indicators
            'has_overpricing': any('overpric' in str(i).lower() or 'inflated' in str(i).lower() for i in indicators),
            'has_ghost_entity': any('ghost' in str(i).lower() or 'fake' in str(i).lower() or 'non-existent' in str(i).lower() for i in indicators),
            'has_circular_pattern': any('circular' in str(i).lower() for i in indicators),
            'has_shell_company': any('shell' in str(i).lower() for i in indicators),
            'has_duplicate': any('duplicate' in str(i).lower() for i in indicators),
            'has_kickback': any('kickback' in str(i).lower() for i in indicators),
            
            # Amount-based features
            'amount_normalized': min(row.get('amount', 0) / 1000000, 10.0),  # Normalize by 1M
            'is_high_value': row.get('amount', 0) > 500000,
            'is_very_high_value': row.get('amount', 0) > 5000000,
            
            # Transaction type features
            'is_procurement': row.get('transaction_type') == 'Procurement',
            'is_welfare': row.get('transaction_type') == 'Social Welfare',
            'is_grant': row.get('transaction_type') == 'Grant',
            
            # Description for reference
            'description': row.get('description', ''),
            'year': row.get('year', datetime.now().year)
        }
        
        return record
    
    def _generate_legitimate_transactions(self, count):
        """
        Generate synthetic legitimate transactions for balanced training
        """
        logger.info(f"Generating {count} synthetic legitimate transactions...")
        
        legitimate = []
        
        transaction_types = ['Social Welfare', 'Procurement', 'Grant', 'Tax', 'Revenue']
        agencies = [
            'Department of Education',
            'Department of Health',
            'Department of Agriculture',
            'Department of Transportation',
            'Local Government Unit'
        ]
        
        np.random.seed(42)
        
        for i in range(count):
            tx_type = np.random.choice(transaction_types)
            
            # Generate reasonable amounts based on transaction type
            if tx_type == 'Social Welfare':
                amount = np.random.uniform(5000, 50000)
            elif tx_type == 'Procurement':
                amount = np.random.uniform(50000, 500000)
            elif tx_type == 'Grant':
                amount = np.random.uniform(100000, 1000000)
            else:
                amount = np.random.uniform(10000, 200000)
            
            record = {
                'source': 'Synthetic',
                'case_id': f'SYN-LEGIT-{i:04d}',
                'amount': amount,
                'transaction_type': tx_type,
                'agency': np.random.choice(agencies),
                'fraud_type': 'None',
                'is_fraudulent': False,
                
                # All fraud indicators are False
                'has_overpricing': False,
                'has_ghost_entity': False,
                'has_circular_pattern': False,
                'has_shell_company': False,
                'has_duplicate': False,
                'has_kickback': False,
                
                # Amount features
                'amount_normalized': min(amount / 1000000, 10.0),
                'is_high_value': amount > 500000,
                'is_very_high_value': amount > 5000000,
                
                # Transaction type features
                'is_procurement': tx_type == 'Procurement',
                'is_welfare': tx_type == 'Social Welfare',
                'is_grant': tx_type == 'Grant',
                
                'description': 'Legitimate transaction',
                'year': np.random.choice([2021, 2022, 2023])
            }
            
            legitimate.append(record)
        
        return legitimate
    
    def analyze_dataset(self, df=None):
        """
        Analyze the training dataset
        """
        if df is None:
            dataset_path = self.output_dir / 'training_dataset_v1.csv'
            if not dataset_path.exists():
                logger.error("Training dataset not found. Run create_training_dataset() first.")
                return
            df = pd.read_csv(dataset_path)
        
        logger.info("\n" + "="*60)
        logger.info("TRAINING DATASET ANALYSIS")
        logger.info("="*60)
        
        logger.info(f"\nTotal Records: {len(df)}")
        logger.info(f"Fraudulent: {df['is_fraudulent'].sum()} ({df['is_fraudulent'].sum()/len(df)*100:.1f}%)")
        logger.info(f"Legitimate: {(~df['is_fraudulent']).sum()} ({(~df['is_fraudulent']).sum()/len(df)*100:.1f}%)")
        
        logger.info("\nFraud Types Distribution:")
        fraud_df = df[df['is_fraudulent']]
        if len(fraud_df) > 0:
            print(fraud_df['fraud_type'].value_counts())
        
        logger.info("\nTransaction Types Distribution:")
        print(df['transaction_type'].value_counts())
        
        logger.info("\nAmount Statistics:")
        logger.info(f"Mean: ₱{df['amount'].mean():,.2f}")
        logger.info(f"Median: ₱{df['amount'].median():,.2f}")
        logger.info(f"Max: ₱{df['amount'].max():,.2f}")
        
        logger.info("\nFraud Indicators:")
        indicators = [
            'has_overpricing',
            'has_ghost_entity',
            'has_circular_pattern',
            'has_shell_company',
            'has_duplicate',
            'has_kickback'
        ]
        for indicator in indicators:
            if indicator in df.columns:
                count = df[indicator].sum()
                logger.info(f"  {indicator}: {count} ({count/len(df)*100:.1f}%)")
        
        logger.info("="*60 + "\n")


if __name__ == '__main__':
    # Run data processing pipeline
    processor = FraudDataProcessor()
    
    # Create training dataset
    df = processor.create_training_dataset()
    
    # Analyze dataset
    processor.analyze_dataset(df)
    
    print("\n" + "="*60)
    print("Data Processing Complete!")
    print("="*60)
    print(f"Training dataset ready: {processor.output_dir / 'training_dataset_v1.csv'}")
    print("\nNext steps:")
    print("1. Review training dataset")
    print("2. Train enhanced ML model with ph_fraud_patterns.py")
    print("3. Validate model accuracy with historical cases")
