const axios = require('axios');
const InflationRate = require('../models/InflationRate');

class InflationService {
    constructor() {
        this.cache = {
            currentRate: null,
            lastFetched: null,
            cacheDuration: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
        };
    }

    /**
     * Fetch inflation data from World Bank API
     * Endpoint: https://api.worldbank.org/v2/country/PHL/indicator/FP.CPI.TOTL.ZG
     * Returns annual inflation rate for Philippines
     */
    async fetchFromWorldBank() {
        try {
            const currentYear = new Date().getFullYear();
            const url = `https://api.worldbank.org/v2/country/PHL/indicator/FP.CPI.TOTL.ZG?format=json&date=${currentYear - 2}:${currentYear}`;

            const response = await axios.get(url, { timeout: 10000 });

            if (!response.data || !response.data[1] || response.data[1].length === 0) {
                throw new Error('No inflation data returned from World Bank API');
            }

            // World Bank returns data in descending order by year
            const latestData = response.data[1][0];

            return {
                rate: parseFloat(latestData.value),
                year: parseInt(latestData.date),
                source: 'worldbank',
                metadata: latestData
            };
        } catch (error) {
            console.error('Error fetching from World Bank API:', error.message);
            throw error;
        }
    }

    /**
     * Get current inflation rate (with caching)
     */
    async getCurrentRate() {
        const now = Date.now();

        // Check cache first
        if (this.cache.currentRate && this.cache.lastFetched &&
            (now - this.cache.lastFetched) < this.cache.cacheDuration) {
            console.log(`📊 Inflation rate served from cache: ${this.cache.currentRate}%`);
            return this.cache.currentRate;
        }

        // Try to get from database
        const dbRate = await InflationRate.getCurrentRate();
        if (dbRate !== null) {
            const latestRecord = await InflationRate.findOne().sort({ month: -1 });
            const recordAge = now - new Date(latestRecord.month).getTime();

            // If database record is less than 30 days old, use it
            if (recordAge < this.cache.cacheDuration) {
                this.cache.currentRate = dbRate;
                this.cache.lastFetched = now;
                console.log(`📊 Inflation rate served from database: ${dbRate}% (${latestRecord.source})`);
                return dbRate;
            }
        }

        // Fetch fresh data from API
        try {
            const data = await this.fetchFromWorldBank();

            // Store in database
            const monthDate = new Date(data.year, 0, 1); // January 1st of the year
            await InflationRate.findOneAndUpdate(
                { month: monthDate },
                {
                    month: monthDate,
                    rate: data.rate,
                    source: data.source,
                    metadata: {
                        apiResponse: data.metadata,
                        fetchedAt: new Date()
                    }
                },
                { upsert: true, new: true }
            );

            // Update cache
            this.cache.currentRate = data.rate;
            this.cache.lastFetched = now;

            console.log(`✅ Inflation rate updated from World Bank: ${data.rate}% (${data.year})`);
            console.log(`📅 Last fetched: ${new Date().toISOString()}`);
            console.log(`⏰ Cache valid until: ${new Date(now + this.cache.cacheDuration).toISOString()}`);

            return data.rate;
        } catch (error) {
            console.error('❌ Failed to fetch inflation rate:', error.message);

            // Return cached or database value as fallback
            if (this.cache.currentRate) {
                console.log(`⚠️  Using cached fallback: ${this.cache.currentRate}%`);
                return this.cache.currentRate;
            }
            if (dbRate !== null) {
                console.log(`⚠️  Using database fallback: ${dbRate}%`);
                return dbRate;
            }

            // Default fallback rate (Philippine average)
            console.warn('⚠️  Using default fallback inflation rate: 3.5%');
            return 3.5;
        }
    }

    /**
     * Get inflation rate for a specific date
     */
    async getRateForDate(date) {
        const rate = await InflationRate.getRateForMonth(date);
        if (rate !== null) return rate;

        // Fallback to current rate if historical data not available
        return await this.getCurrentRate();
    }

    /**
     * Calculate inflation-adjusted amount
     */
    adjustForInflation(amount, inflationRate) {
        return amount / (1 + inflationRate / 100);
    }

    /**
     * Manually set inflation rate (admin override)
     */
    async setManualRate(rate, month = new Date()) {
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);

        const record = await InflationRate.findOneAndUpdate(
            { month: monthStart },
            {
                month: monthStart,
                rate: parseFloat(rate),
                source: 'manual',
                metadata: {
                    fetchedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        // Clear cache to force refresh
        this.cache.currentRate = null;
        this.cache.lastFetched = null;

        return record;
    }

    /**
     * Get historical inflation rates
     */
    async getHistoricalRates(limit = 12) {
        return await InflationRate.find()
            .sort({ month: -1 })
            .limit(limit);
    }

    /**
     * Get cache status for admin monitoring
     */
    getCacheStatus() {
        const now = Date.now();
        const cacheAge = this.cache.lastFetched ? now - this.cache.lastFetched : null;
        const cacheValid = cacheAge && cacheAge < this.cache.cacheDuration;
        const expiresAt = this.cache.lastFetched ?
            new Date(this.cache.lastFetched + this.cache.cacheDuration) : null;

        return {
            cached: this.cache.currentRate !== null,
            currentRate: this.cache.currentRate,
            lastFetched: this.cache.lastFetched ? new Date(this.cache.lastFetched) : null,
            cacheAge: cacheAge ? Math.floor(cacheAge / 1000 / 60) : null, // minutes
            cacheValid,
            expiresAt,
            cacheDuration: Math.floor(this.cache.cacheDuration / 1000 / 60 / 60 / 24) // days
        };
    }

    /**
     * Get detailed inflation status for admin dashboard
     */
    async getAdminStatus() {
        const cacheStatus = this.getCacheStatus();
        const latestRecord = await InflationRate.findOne().sort({ month: -1 });
        const recordCount = await InflationRate.countDocuments();

        return {
            cache: cacheStatus,
            database: {
                latestRate: latestRecord ? latestRecord.rate : null,
                latestMonth: latestRecord ? latestRecord.month : null,
                source: latestRecord ? latestRecord.source : null,
                recordCount,
                lastUpdated: latestRecord ? latestRecord.metadata?.fetchedAt : null
            }
        };
    }
}

module.exports = new InflationService();
