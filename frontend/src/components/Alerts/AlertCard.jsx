import React from 'react';

function AlertCard({ alert }) {
  const severityColors = {
    critical: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
    high: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
    medium: { bg: '#fefce8', border: '#fef08a', text: '#854d0e' }
  };

  const colors = severityColors[alert.severity];

  return (
    <div className="alert-card">
      <div className="alert-card-header">
        <div className="alert-badges">
          <span className="severity-badge" style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
            {alert.severity.toUpperCase()}
          </span>
          <span className="status-badge">{alert.status.replace('_', ' ').toUpperCase()}</span>
        </div>
        <div className="alert-score-box">
          <div className="score-label">Risk Score</div>
          <div className="score-value" style={{ color: colors.text }}>{alert.riskScore}</div>
        </div>
      </div>
      <h4 className="alert-type">{alert.type}</h4>
      <div className="alert-hash">{alert.documentId}</div>
      <div className="alert-meta-info">
        <div className="meta-row">
          <span className="meta-label">Document Type:</span>
          <span className="meta-value">{alert.documentType}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">Issuing Agency:</span>
          <span className="meta-value">{alert.issuer}</span>
        </div>
      </div>
      <button className="investigate-btn">👁️ Investigate</button>
    </div>
  );
}

export default AlertCard;