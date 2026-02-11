const mongoose = require('mongoose');

const inflationRateSchema = new mongoose.Schema({
    month: {
        type: Date,
        required: true,
        unique: true,
        index: true
    },
    rate: {
        type: Number,
        required: true,
        min: -100,
        max: 1000
    },
    source: {
        type: String,
        required: true,
        enum: ['worldbank', 'manual', 'psa'],
        default: 'worldbank'
    },
    metadata: {
        apiResponse: mongoose.Schema.Types.Mixed,
        fetchedAt: Date
    }
}, {
    timestamps: true
});

// Get the most recent inflation rate
inflationRateSchema.statics.getCurrentRate = async function () {
    const latest = await this.findOne().sort({ month: -1 });
    return latest ? latest.rate : null;
};

// Get inflation rate for a specific month
inflationRateSchema.statics.getRateForMonth = async function (date) {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const rate = await this.findOne({ month: monthStart });
    return rate ? rate.rate : null;
};

module.exports = mongoose.model('InflationRate', inflationRateSchema);
