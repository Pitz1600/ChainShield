const axios = require('axios');

/**
 * Economic Data Service
 * Fetches Philippine economic indicators for fraud detection context
 */

class EconomicDataService {
    constructor() {
        // Philippine inflation rate (updated monthly from PSA)
        // In production, this would fetch from PSA API
        this.inflationRate = 0.08; // 8% current inflation

        // Program baselines (in PHP)
        this.programBaselines = {
            '4Ps': 9000,
            'SAP': 5000,
            'TUPAD': 8000,
            'AICS': 3000,
            'Medical Supplies': 1000000,
            'Infrastructure': 5000000
        };

        // Seasonal multipliers (month-based)
        this.seasonalMultipliers = {
            1: 1.0,   // January
            2: 1.0,   // February
            3: 1.0,   // March
            4: 1.1,   // April (summer programs)
            5: 1.1,   // May
            6: 1.0,   // June
            7: 1.0,   // July
            8: 1.0,   // August
            9: 1.0,   // September
            10: 1.2,  // October (year-end prep)
            11: 1.3,  // November (year-end rush)
            12: 1.5   // December (year-end spending)
        };
    }

    /**
     * Get current inflation rate
     */
    getInflationRate() {
        return this.inflationRate;
    }

    /**
     * Calculate inflation-adjusted expected range
     */
    getExpectedRange(amount, programName, date = new Date()) {
        const baseline = this.programBaselines[programName] || amount;
        const month = date.getMonth() + 1;
        const seasonalMultiplier = this.seasonalMultipliers[month] || 1.0;

        // Adjust for inflation
        const inflationAdjusted = baseline * (1 + this.inflationRate);

        // Adjust for seasonality
        const seasonalAdjusted = inflationAdjusted * seasonalMultiplier;

        // Calculate acceptable range (±20% variance)
        const minExpected = seasonalAdjusted * 0.8;
        const maxExpected = seasonalAdjusted * 1.2;

        return {
            baseline,
            inflationAdjusted,
            seasonalAdjusted,
            minExpected,
            maxExpected,
            inflationRate: this.inflationRate,
            seasonalMultiplier
        };
    }

    /**
     * Check if amount is anomalous given economic context
     */
    isAnomalous(amount, programName, date = new Date()) {
        const range = this.getExpectedRange(amount, programName, date);

        const isLow = amount < range.minExpected;
        const isHigh = amount > range.maxExpected;

        return {
            isAnomalous: isLow || isHigh,
            isLow,
            isHigh,
            deviation: amount - range.seasonalAdjusted,
            deviationPercent: ((amount - range.seasonalAdjusted) / range.seasonalAdjusted) * 100,
            ...range
        };
    }

    /**
     * Get economic context for fraud analysis
     */
    getEconomicContext(transaction) {
        const { amount, programName, timestamp } = transaction;
        const date = timestamp ? new Date(timestamp) : new Date();

        return this.isAnomalous(amount, programName, date);
    }

    /**
     * Update inflation rate (called monthly)
     * In production, this would fetch from PSA API
     */
    async updateInflationRate() {
        try {
            // TODO: Integrate with PSA OpenSTAT API
            // const response = await axios.get('https://openstat.psa.gov.ph/api/inflation');
            // this.inflationRate = response.data.rate;

            console.log(`Inflation rate: ${this.inflationRate * 100}%`);
            return this.inflationRate;
        } catch (error) {
            console.error('Failed to update inflation rate:', error.message);
            return this.inflationRate;
        }
    }
}

module.exports = new EconomicDataService();
