/**
 * Combines multiple risk components into a 0-100 score.
 * Inputs expected as normalized contributions; weights can be tuned.
 */
function computeRiskScore(components) {
  const weights = {
    zScore: 35,
    rules: 30,
    highFreq: 15,
    behavior: 20,
    burst: 15,
    unusualTime: 10,
    graph: 25,
    propagated: 20
  };

  let score = 0;
  const reasons = [];

  if (components.zScore >= 3) {
    score += weights.zScore;
    reasons.push('Z-score > 3 (highly anomalous amount)');
  } else if (components.zScore >= 2) {
    score += weights.zScore * 0.6;
    reasons.push('Z-score between 2 and 3');
  }

  if (components.ruleRisk && components.ruleRisk > 0) {
    score += Math.min(weights.rules, components.ruleRisk);
    reasons.push('Rule-based risk triggered');
  }

  if (components.highFreq) {
    score += weights.highFreq;
    reasons.push('High transaction frequency');
  }

  if (components.burst) {
    score += weights.burst;
    reasons.push('Transaction burst detected');
  }

  if (components.behavior) {
    score += Math.min(weights.behavior, components.behavior);
    reasons.push('Behavioral anomaly detected');
  }

  if (components.unusualTime) {
    score += weights.unusualTime;
    reasons.push('Unusual transaction time');
  }

  if (components.graph) {
    score += Math.min(weights.graph, components.graph * 100);
    reasons.push('Graph/network risk');
  }

  if (components.propagated) {
    score += Math.min(weights.propagated, components.propagated * 100);
    reasons.push('Network-propagated risk');
  }

  return {
    riskScore: Math.min(100, Math.round(score)),
    reasons
  };
}

module.exports = { computeRiskScore };
