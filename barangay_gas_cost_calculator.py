#!/usr/bin/env python3
"""
CHAINSHIELD BARANGAY GAS COST CALCULATOR
Relates blockchain gas costs to Secure Barangay Management System transactions
Calculates realistic pricing for barangay operations
"""

import json
from datetime import datetime
from typing import Dict, List, Tuple

class BarangayGasCostCalculator:
    def __init__(self):
        # Current gas price (gwei) - can be updated dynamically
        self.current_gas_price = 25  # gwei
        self.eth_to_php = 150000  # Current ETH to PHP conversion rate
        
        # Barangay-specific transaction types and their characteristics
        self.barangay_transactions = {
            "resident_registration": {
                "name": "Resident Registration",
                "base_gas": 45000,
                "storage_multiplier": 1.2,
                "complexity": "medium",
                "frequency": "daily"
            },
            "welfare_disbursement": {
                "name": "Welfare Cash Disbursement",
                "base_gas": 52000,
                "storage_multiplier": 1.5,
                "complexity": "high",
                "frequency": "weekly"
            },
            "business_permit": {
                "name": "Business Permit Issuance",
                "base_gas": 48000,
                "storage_multiplier": 1.3,
                "complexity": "medium",
                "frequency": "monthly"
            },
            "certificate_request": {
                "name": "Certificate Request (Barangay Clearance, etc.)",
                "base_gas": 38000,
                "storage_multiplier": 1.1,
                "complexity": "low",
                "frequency": "daily"
            },
            "infrastructure_project": {
                "name": "Infrastructure Project Logging",
                "base_gas": 65000,
                "storage_multiplier": 1.8,
                "complexity": "high",
                "frequency": "quarterly"
            },
            "complaint_filing": {
                "name": "Complaint/Blight Report Filing",
                "base_gas": 42000,
                "storage_multiplier": 1.0,
                "complexity": "low",
                "frequency": "daily"
            },
            "meeting_minutes": {
                "name": "Barangay Meeting Minutes",
                "base_gas": 55000,
                "storage_multiplier": 1.4,
                "complexity": "medium",
                "frequency": "weekly"
            },
            "budget_allocation": {
                "name": "Budget Allocation Record",
                "base_gas": 70000,
                "storage_multiplier": 2.0,
                "complexity": "high",
                "frequency": "monthly"
            }
        }
        
        # Monthly transaction estimates for a typical barangay
        self.monthly_estimates = {
            "resident_registration": 50,
            "welfare_disbursement": 20,
            "business_permit": 15,
            "certificate_request": 100,
            "infrastructure_project": 2,
            "complaint_filing": 30,
            "meeting_minutes": 4,
            "budget_allocation": 1
        }

    def calculate_gas_cost(self, gas_units: int) -> Tuple[float, float, float]:
        """Calculate gas cost in ETH, USD, and PHP"""
        eth_cost = (gas_units * self.current_gas_price) / 1e9
        usd_cost = eth_cost * 3000  # ETH to USD rate
        php_cost = eth_cost * self.eth_to_php
        return eth_cost, usd_cost, php_cost

    def calculate_transaction_cost(self, transaction_type: str) -> Dict:
        """Calculate detailed cost for a specific transaction type"""
        if transaction_type not in self.barangay_transactions:
            raise ValueError(f"Unknown transaction type: {transaction_type}")
        
        tx_info = self.barangay_transactions[transaction_type]
        adjusted_gas = int(tx_info["base_gas"] * tx_info["storage_multiplier"])
        
        eth_cost, usd_cost, php_cost = self.calculate_gas_cost(adjusted_gas)
        
        return {
            "transaction_type": transaction_type,
            "name": tx_info["name"],
            "gas_units": adjusted_gas,
            "complexity": tx_info["complexity"],
            "frequency": tx_info["frequency"],
            "cost_eth": eth_cost,
            "cost_usd": usd_cost,
            "cost_php": php_cost,
            "gas_price_gwei": self.current_gas_price
        }

    def calculate_monthly_costs(self) -> Dict:
        """Calculate total monthly costs for all transaction types"""
        monthly_costs = {}
        total_gas = 0
        total_eth = 0
        total_usd = 0
        total_php = 0
        
        print("🏘️  BARANGAY MONTHLY TRANSACTION COST ANALYSIS")
        print("=" * 80)
        print(f"📅 Analysis Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"⛽ Gas Price: {self.current_gas_price} gwei")
        print(f"💱 ETH Rate: 1 ETH = ₱{self.eth_to_php:,}")
        print("=" * 80)
        
        for tx_type, estimate in self.monthly_estimates.items():
            single_tx = self.calculate_transaction_cost(tx_type)
            monthly_count = estimate
            
            monthly_gas = single_tx["gas_units"] * monthly_count
            monthly_eth = single_tx["cost_eth"] * monthly_count
            monthly_usd = single_tx["cost_usd"] * monthly_count
            monthly_php = single_tx["cost_php"] * monthly_count
            
            monthly_costs[tx_type] = {
                **single_tx,
                "monthly_count": monthly_count,
                "monthly_gas": monthly_gas,
                "monthly_eth": monthly_eth,
                "monthly_usd": monthly_usd,
                "monthly_php": monthly_php,
                "avg_cost_per_tx_php": monthly_php
            }
            
            total_gas += monthly_gas
            total_eth += monthly_eth
            total_usd += monthly_usd
            total_php += monthly_php
            
            # Print individual transaction analysis
            print(f"\n📋 {single_tx['name']}")
            print(f"   🔄 Monthly Volume: {monthly_count} transactions")
            print(f"   ⛽ Gas per Transaction: {single_tx['gas_units']:,} units")
            print(f"   💰 Cost per Transaction: ₱{single_tx['cost_php']:.2f}")
            print(f"   📊 Monthly Total: ₱{monthly_php:,.2f}")
            print(f"   📈 Complexity: {single_tx['complexity'].upper()}")
        
        # Summary
        print(f"\n" + "=" * 80)
        print(f"📊 MONTHLY SUMMARY")
        print("=" * 80)
        print(f"🔢 Total Transactions: {sum(self.monthly_estimates.values())}")
        print(f"⛽ Total Gas Consumption: {total_gas:,} units")
        print(f"💎 Total ETH Cost: {total_eth:.6f} ETH")
        print(f"💵 Total USD Cost: ${total_usd:,.2f}")
        print(f"🇵🇭 Total PHP Cost: ₱{total_php:,.2f}")
        print(f"📅 Average Daily Cost: ₱{total_php/30:,.2f}")
        
        return {
            "monthly_costs": monthly_costs,
            "totals": {
                "total_transactions": sum(self.monthly_estimates.values()),
                "total_gas": total_gas,
                "total_eth": total_eth,
                "total_usd": total_usd,
                "total_php": total_php,
                "daily_average_php": total_php / 30
            }
        }

    def simulate_gas_price_scenarios(self) -> None:
        """Simulate costs under different gas price scenarios"""
        scenarios = [
            (10, "Low (Off-peak)"),
            (25, "Normal"),
            (50, "High"),
            (100, "Very High (Network Congestion)")
        ]
        
        print(f"\n🎯 GAS PRICE SCENARIO ANALYSIS")
        print("=" * 80)
        
        # Use welfare_disbursement as example transaction
        base_tx = self.calculate_transaction_cost("welfare_disbursement")
        
        for gas_price, scenario_name in scenarios:
            old_gas_price = self.current_gas_price
            self.current_gas_price = gas_price
            
            scenario_tx = self.calculate_transaction_cost("welfare_disbursement")
            monthly_cost = scenario_tx["cost_php"] * self.monthly_estimates["welfare_disbursement"]
            
            print(f"\n⚡ {scenario_name} - {gas_price} gwei")
            print(f"   💰 Per Transaction: ₱{scenario_tx['cost_php']:.2f}")
            print(f"   📊 Monthly (20 tx): ₱{monthly_cost:,.2f}")
            print(f"   📈 vs Normal: {((scenario_tx['cost_php']/base_tx['cost_php'])-1)*100:+.1f}%")
            
            self.current_gas_price = old_gas_price

    def generate_pricing_recommendations(self) -> None:
        """Generate pricing recommendations for barangay services"""
        print(f"\n💡 PRICING RECOMMENDATIONS")
        print("=" * 80)
        
        recommendations = []
        
        for tx_type, tx_data in self.barangay_transactions.items():
            cost_info = self.calculate_transaction_cost(tx_type)
            
            # Add service fee (30% markup for sustainability)
            recommended_price = cost_info["cost_php"] * 1.3
            
            # Round to convenient amounts
            if recommended_price < 10:
                recommended_price = 10
            elif recommended_price < 50:
                recommended_price = round(recommended_price / 5) * 5
            else:
                recommended_price = round(recommended_price / 10) * 10
            
            recommendations.append({
                "service": tx_data["name"],
                "actual_cost": cost_info["cost_php"],
                "recommended_price": recommended_price,
                "profit_margin": ((recommended_price / cost_info["cost_php"]) - 1) * 100
            })
        
        print("📋 SERVICE PRICING TABLE:")
        print("-" * 80)
        for rec in recommendations:
            print(f"🏛️  {rec['service'][:40]:<40}")
            print(f"   💸 Actual Cost: ₱{rec['actual_cost']:.2f}")
            print(f"   💰 Recommended: ₱{rec['recommended_price']:.2f}")
            print(f"   📈 Margin: {rec['profit_margin']:.1f}%")
            print()

    def export_to_json(self, data: Dict, filename: str = "barangay_gas_analysis.json") -> None:
        """Export analysis results to JSON file"""
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        print(f"\n💾 Analysis exported to {filename}")

def main():
    """Main execution function"""
    print("🏘️  CHAINSHIELD BARANGAY GAS COST CALCULATOR")
    print("=" * 80)
    print("Analyzing blockchain costs for Secure Barangay Management System")
    print("=" * 80)
    
    calculator = BarangayGasCostCalculator()
    
    # Calculate monthly costs
    monthly_analysis = calculator.calculate_monthly_costs()
    
    # Simulate gas price scenarios
    calculator.simulate_gas_price_scenarios()
    
    # Generate pricing recommendations
    calculator.generate_pricing_recommendations()
    
    # Export results
    calculator.export_to_json(monthly_analysis)
    
    print(f"\n🎉 ANALYSIS COMPLETED!")
    print(f"📸 Results ready for documentation!")
    print(f"⏰ Completion: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
