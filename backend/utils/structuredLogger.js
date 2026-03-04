function logBatchSummary(summary) {
  const payload = {
    batch_id: summary.batchId,
    transactions_analyzed: summary.total,
    flagged_transactions: summary.flagged,
    processing_time_ms: summary.durationMs,
    stats: summary.stats
  };
  console.log(JSON.stringify(payload, null, 2));
}

module.exports = { logBatchSummary };
