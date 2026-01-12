"""
Quick setup script to generate initial Philippine fraud detection datasets
"""

import pandas as pd
from pathlib import Path
from datetime import datetime

# Create datasets directory
data_dir = Path('datasets')
data_dir.mkdir(exist_ok=True)

print("Generating Philippine fraud detection datasets...")

# 1. COA Fraud Cases
coa_cases = [
    {
        'source': 'COA',
        'case_id': 'COA-FAR-2023-001',
        'year': 2023,
        'agency': 'Department of Public Works and Highways',
        'fraud_type': 'Ghost Projects',
        'amount': 15000000,
        'description': 'Flood control projects in unapproved sites',
        'transaction_type': 'Procurement',
        'is_fraudulent': True,
        'indicators': "['Construction in unapproved sites', 'Use of substandard materials', 'Overpayments detected']"
    },
    {
        'source': 'COA',
        'case_id': 'COA-FAR-2023-002',
        'year': 2023,
        'agency': 'Local Government Unit - Bulacan',
        'fraud_type': 'Overpricing',
        'amount': 8500000,
        'description': 'Procurement of office supplies at inflated prices',
        'transaction_type': 'Procurement',
        'is_fraudulent': True,
        'indicators': "['Prices 40% above market rate', 'Repeated contractor', 'No competitive bidding']"
    }
]

df_coa = pd.DataFrame(coa_cases)
df_coa.to_csv(data_dir / 'coa_fraud_cases.csv', index=False)
print(f"✓ Created coa_fraud_cases.csv ({len(coa_cases)} records)")

# 2. Ombudsman Cases
ombudsman_cases = [
    {
        'source': 'Ombudsman',
        'case_id': 'OMB-2023-0456',
        'year': 2023,
        'agency': 'Department of Social Welfare and Development',
        'fraud_type': 'Welfare Fraud',
        'amount': 5000000,
        'description': 'Ghost beneficiaries in 4Ps program',
        'transaction_type': 'Social Welfare',
        'is_fraudulent': True,
        'indicators': "['Non-existent beneficiaries', 'Duplicate IDs', 'Impossible family sizes']"
    },
    {
        'source': 'Ombudsman',
        'case_id': 'OMB-2022-1234',
        'year': 2022,
        'agency': 'Local Government Unit',
        'fraud_type': 'Kickback Scheme',
        'amount': 12000000,
        'description': 'Circular transactions between contractor and officials',
        'transaction_type': 'Procurement',
        'is_fraudulent': True,
        'indicators': "['Circular fund movement', 'Shell company involvement', 'Repeated contractor wins']"
    }
]

df_ombudsman = pd.DataFrame(ombudsman_cases)
df_ombudsman.to_csv(data_dir / 'ombudsman_cases.csv', index=False)
print(f"✓ Created ombudsman_cases.csv ({len(ombudsman_cases)} records)")

# 3. PhilGEPS Prices
philgeps_prices = [
    {
        'category': 'Office Supplies',
        'item': 'Bond Paper A4 (500 sheets)',
        'unit': 'ream',
        'average_price': 180,
        'median_price': 175,
        'min_price': 150,
        'max_price': 220,
        'sample_size': 1250,
        'last_updated': datetime.now().isoformat()
    },
    {
        'category': 'Construction Materials',
        'item': 'Cement (40kg bag)',
        'unit': 'bag',
        'average_price': 285,
        'median_price': 280,
        'min_price': 260,
        'max_price': 320,
        'sample_size': 850,
        'last_updated': datetime.now().isoformat()
    },
    {
        'category': 'IT Equipment',
        'item': 'Desktop Computer (Standard Specs)',
        'unit': 'unit',
        'average_price': 35000,
        'median_price': 33000,
        'min_price': 28000,
        'max_price': 45000,
        'sample_size': 420,
        'last_updated': datetime.now().isoformat()
    },
    {
        'category': 'Vehicles',
        'item': 'Pickup Truck (4x4)',
        'unit': 'unit',
        'average_price': 1200000,
        'median_price': 1150000,
        'min_price': 950000,
        'max_price': 1500000,
        'sample_size': 180,
        'last_updated': datetime.now().isoformat()
    }
]

df_philgeps = pd.DataFrame(philgeps_prices)
df_philgeps.to_csv(data_dir / 'philgeps_prices.csv', index=False)
print(f"✓ Created philgeps_prices.csv ({len(philgeps_prices)} records)")

# 4. PSA Demographics
psa_demographics = [
    {
        'region': 'NCR - National Capital Region',
        'region_code': '13',
        'population': 13484462,
        'households': 3145000,
        'year': 2020,
        'source': 'PSA Census'
    },
    {
        'region': 'Region III - Central Luzon',
        'region_code': '03',
        'population': 12422172,
        'households': 2850000,
        'year': 2020,
        'source': 'PSA Census'
    },
    {
        'region': 'Region IV-A - CALABARZON',
        'region_code': '04',
        'population': 16195042,
        'households': 3720000,
        'year': 2020,
        'source': 'PSA Census'
    },
    {
        'region': 'Region VII - Central Visayas',
        'region_code': '07',
        'population': 8081988,
        'households': 1850000,
        'year': 2020,
        'source': 'PSA Census'
    }
]

df_psa = pd.DataFrame(psa_demographics)
df_psa.to_csv(data_dir / 'psa_demographics.csv', index=False)
print(f"✓ Created psa_demographics.csv ({len(psa_demographics)} records)")

# 5. Historical Scandals
historical_scandals = [
    {
        'scandal_name': 'PDAF Scam (Pork Barrel)',
        'year': 2013,
        'total_amount': 10000000000,
        'fraud_type': 'Ghost Projects',
        'description': 'Lawmakers diverted PDAF to fake NGOs',
        'transaction_type': 'Grant',
        'is_fraudulent': True,
        'indicators': "['Fake NGOs', 'Ghost projects', 'Kickbacks to officials', 'Falsified documents']"
    },
    {
        'scandal_name': 'Fertilizer Fund Scam',
        'year': 2004,
        'total_amount': 728000000,
        'fraud_type': 'Procurement Fraud',
        'description': 'Overpriced fertilizer procurement',
        'transaction_type': 'Procurement',
        'is_fraudulent': True,
        'indicators': "['Overpricing', 'Ghost deliveries', 'Fake beneficiaries']"
    }
]

df_scandals = pd.DataFrame(historical_scandals)
df_scandals.to_csv(data_dir / 'historical_scandals.csv', index=False)
print(f"✓ Created historical_scandals.csv ({len(historical_scandals)} records)")

print("\n" + "="*60)
print("Dataset Generation Complete!")
print("="*60)
print(f"Location: {data_dir.absolute()}")
print(f"\nFiles created:")
print(f"  - coa_fraud_cases.csv")
print(f"  - ombudsman_cases.csv")
print(f"  - philgeps_prices.csv")
print(f"  - psa_demographics.csv")
print(f"  - historical_scandals.csv")
print(f"\nNext step: Run data_processing_pipeline.py to create training dataset")
