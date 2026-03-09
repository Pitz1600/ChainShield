import React from 'react';
import { Eye } from 'lucide-react';

function AlertCard({ alert, onInvestigate }) {
  const severityClass = `sev-${alert.severity}`;
  const riskClass = alert.riskScore >= 80 ? 'risk-critical' : alert.riskScore >= 60 ? 'risk-high' : alert.riskScore >= 40 ? 'risk-medium' : 'risk-low';

  return (
    <div className="alert-card">
      <div className="alert-card-top">
        <div className="alert-card-badges">
          <span className={`sev-pill ${severityClass}`}>{alert.severity.toUpperCase()}</span>
          <span className="alert-open-pill">OPEN</span>
        </div>
        <div className="alert-card-score-box">
          <div className="alert-card-score-label">Risk Score</div>
          <div className="alert-card-score-value">{alert.riskScore}</div>
        </div>
      </div>

      <h4 className="alert-card-title">{alert.type}</h4>
      <div className="alert-card-id">{alert.documentId}</div>

      <div className="alert-card-meta">
        <div><span>Transaction Type:</span><strong>{alert.documentType || 'N/A'}</strong></div>
        <div><span>Agency:</span><strong>{alert.issuer || 'N/A'}</strong></div>
        <div><span>Amount:</span><strong>PHP {Number(alert.amount || 0).toLocaleString()}</strong></div>
        <div><span>Risk:</span><strong className={`risk-chip ${riskClass}`}>{alert.riskScore}</strong></div>
      </div>

      <button type="button" className="alert-investigate-btn" onClick={() => onInvestigate(alert)}>
        <Eye size={16} /> Investigate
      </button>
    </div>
  );
}

export default AlertCard;
