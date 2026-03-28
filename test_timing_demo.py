#!/usr/bin/env python3
"""
TIMING DEMO SCRIPT - ChainShield AI Fraud Detection
This script demonstrates the timing functionality added to the ML service.
Run this to generate screenshot-worthy output showing AI prediction timing.
"""

import requests
import json
import time
import random
from datetime import datetime

# Configuration
ML_SERVICE_URL = "http://localhost:5001/predict"
API_SECRET = "your-secret-key-here"  # Set this to match your ML_API_SECRET

def generate_test_transaction():
    """Generate realistic test transaction data"""
    transaction_types = ["Welfare", "Procurement", "Infrastructure", "Healthcare", "Education"]
    
    return {
        "transactionId": f"TXN_{int(time.time())}_{random.randint(1000, 9999)}",
        "transactionType": random.choice(transaction_types),
        "amount": round(random.uniform(1000, 500000), 2),
        "frequency": random.randint(1, 50),
        "time_diff": random.randint(60, 86400),
        "address_degree": random.randint(1, 500),
        "convergence_score": round(random.uniform(0, 1), 4),
        "circular_pattern": round(random.uniform(0, 1), 4),
        "networkFeatures": {
            "source_addresses": [f"0x{''.join(random.choices('0123456789abcdef', k=40))}" for _ in range(3)],
            "destination_address": f"0x{''.join(random.choices('0123456789abcdef', k=40))}",
            "intermediate_nodes": random.randint(0, 10)
        }
    }

def test_ai_prediction_timing():
    """Test AI prediction with timing measurement"""
    
    print("=" * 80)
    print("🚀 CHAINSHIELD AI FRAUD DETECTION TIMING DEMO")
    print("=" * 80)
    print(f"📅 Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔗 ML Service: {ML_SERVICE_URL}")
    print("=" * 80)
    
    # Test multiple transactions
    test_cases = [
        {"name": "Low Risk Transaction", "amount_range": (1000, 10000)},
        {"name": "Medium Risk Transaction", "amount_range": (50000, 100000)},
        {"name": "High Risk Transaction", "amount_range": (200000, 500000)},
        {"name": "Suspicious Pattern", "amount_range": (100000, 300000)}
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 TEST CASE {i}: {test_case['name']}")
        print("-" * 60)
        
        # Generate test transaction
        transaction = generate_test_transaction()
        transaction["amount"] = round(random.uniform(*test_case["amount_range"]), 2)
        
        print(f"🔍 Transaction Details:")
        print(f"   ID: {transaction['transactionId']}")
        print(f"   Type: {transaction['transactionType']}")
        print(f"   Amount: ₱{transaction['amount']:,.2f}")
        print(f"   Frequency: {transaction['frequency']} transactions")
        print(f"   Network Degree: {transaction['address_degree']} connections")
        
        # Measure API call timing
        api_start = time.time()
        
        try:
            headers = {
                "Content-Type": "application/json",
                "X-Internal-Secret": API_SECRET
            }
            
            response = requests.post(
                ML_SERVICE_URL,
                json=transaction,
                headers=headers,
                timeout=30
            )
            
            api_end = time.time()
            api_time = api_end - api_start
            
            if response.status_code == 200:
                result = response.json()
                
                print(f"\n✅ PREDICTION RESULTS:")
                print(f"   Risk Score: {result['risk_score']}/100")
                print(f"   Risk Level: {result['risk_level']}")
                print(f"   Fraudulent: {'🚨 YES' if result['isFraudulent'] else '✅ NO'}")
                print(f"   Fraud Type: {result['fraudType']}")
                print(f"   Anomaly Detected: {'⚠️ YES' if result['isAnomaly'] else '✅ NO'}")
                
                if 'explanation' in result:
                    print(f"   Reasons: {'; '.join(result['explanation'][:2])}")
                
                print(f"\n⏱️ TIMING RESULTS:")
                print(f"   API Response Time: {api_time:.4f} seconds")
                print(f"   AI Prediction Time: {result.get('prediction_time', 'N/A')} seconds")
                
                results.append({
                    "test_case": test_case["name"],
                    "api_time": api_time,
                    "risk_score": result["risk_score"],
                    "risk_level": result["risk_level"],
                    "fraudulent": result["isFraudulent"]
                })
                
            else:
                print(f"❌ API Error: {response.status_code}")
                print(f"   Response: {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Connection Error: {e}")
            print("   Make sure the ML service is running on port 5001")
        
        print("\n" + "=" * 60)
        time.sleep(1)  # Brief pause between tests
    
    # Summary statistics
    if results:
        print(f"\n📊 PERFORMANCE SUMMARY")
        print("=" * 80)
        
        total_tests = len(results)
        avg_api_time = sum(r["api_time"] for r in results) / total_tests
        max_api_time = max(r["api_time"] for r in results)
        min_api_time = min(r["api_time"] for r in results)
        
        print(f"Total Tests: {total_tests}")
        print(f"Average API Response Time: {avg_api_time:.4f} seconds")
        print(f"Fastest Response: {min_api_time:.4f} seconds")
        print(f"Slowest Response: {max_api_time:.4f} seconds")
        
        print(f"\n🎯 RISK ANALYSIS:")
        high_risk = sum(1 for r in results if r["risk_score"] >= 60)
        print(f"High Risk Transactions: {high_risk}/{total_tests}")
        print(f"Fraudulent Predictions: {sum(1 for r in results if r['fraudulent'])}/{total_tests}")
        
        print(f"\n📈 PERFORMANCE BREAKDOWN:")
        for result in results:
            status = "🚨" if result["fraudulent"] else "✅"
            print(f"   {status} {result['test_case']}: {result['api_time']:.4f}s (Risk: {result['risk_score']})")

def main():
    """Main execution function"""
    print("🔧 CHAINSHIELD AI TIMING DEMO")
    print("This script tests the AI fraud detection timing functionality")
    print("Make sure your ML service is running on localhost:5001")
    print("\nPress Ctrl+C to exit, or wait for the demo to complete...")
    
    try:
        time.sleep(2)  # Give user time to read
        test_ai_prediction_timing()
        
        print(f"\n🎉 DEMO COMPLETED!")
        print(f"📸 This output is ready for screenshot!")
        print(f"⏰ Demo completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
    except KeyboardInterrupt:
        print(f"\n\n⏹️ Demo interrupted by user")
    except Exception as e:
        print(f"\n❌ Demo failed with error: {e}")

if __name__ == "__main__":
    main()
