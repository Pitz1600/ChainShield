const Transaction = require('../models/Transaction');

/**
 * Lightweight behavioral profiling per account.
 * Computes rolling averages for amount, time-of-day, beneficiary diversity, and daily frequency.
 */
async function buildProfile(address) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [agg] = await Transaction.aggregate([
    { $match: { fromAddress: address, timestamp: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: null,
        avgAmount: { $avg: '$amount' },
        stdAmount: { $stdDevPop: '$amount' },
        count: { $sum: 1 },
        hours: { $push: { $hour: '$timestamp' } },
        beneficiaries: { $addToSet: '$toAddress' }
      }
    }
  ]);

  const defaultProfile = {
    avgAmount: 50000,
    stdAmount: 20000,
    count: 0,
    typicalHour: 12,
    beneficiaryCount: 3
  };

  if (!agg) {
    return defaultProfile;
  }

  const hourCounts = {};
  (agg.hours || []).forEach((h) => {
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  });
  const typicalHour = Object.keys(hourCounts).reduce(
    (best, h) => (best === null || hourCounts[h] > hourCounts[best] ? h : best),
    null
  );

  return {
    avgAmount: agg.avgAmount || defaultProfile.avgAmount,
    stdAmount: agg.stdAmount || defaultProfile.stdAmount,
    count: agg.count || defaultProfile.count,
    typicalHour: typicalHour !== null ? Number(typicalHour) : defaultProfile.typicalHour,
    beneficiaryCount: (agg.beneficiaries || []).length || defaultProfile.beneficiaryCount
  };
}

function behaviorDeviation(transaction, profile) {
  let risk = 0;
  const reasons = [];

  if (profile.avgAmount > 0 && transaction.amount > 5 * profile.avgAmount) {
    risk += 30;
    reasons.push('Amount >5× user average');
  }

  if (profile.stdAmount > 0) {
    const z = (transaction.amount - profile.avgAmount) / (profile.stdAmount || 1);
    if (z > 3) {
      risk += 25;
      reasons.push('Amount 3σ above personal norm');
    }
  }

  if (profile.typicalHour !== null) {
    const txHour = new Date(transaction.timestamp || Date.now()).getHours();
    const hourDiff = Math.abs(txHour - profile.typicalHour);
    if (hourDiff >= 6) {
      risk += 10;
      reasons.push('Unusual transaction time for user');
    }
  }

  if (profile.count > 0) {
    const dailyFreq = profile.count / 30;
    if (dailyFreq >= 5) {
      risk += 10;
      reasons.push('High historical daily frequency');
    }
  }

  return { risk, reasons };
}

module.exports = {
  buildProfile,
  behaviorDeviation
};
