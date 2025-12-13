import React, { useState } from 'react';
import '../styles/AlertDetail.css';
import { alertsAPI } from '../services/api';

function AlertDetail({ alert, onClose, onUpdate }) {
  const [status, setStatus] = useState(alert.status);
  const [updating, setUpdating] = useState(false);

  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true);
    try {
      await alertsAPI.update(alert.id, { status: newStatus });
      setStatus(newStatus);
      onUpdate(alert.id, { status: newStatus });
    } catch (error) {
      console.error('Failed to update alert:', error);
    } finally {
      setUpdating(false);
    }
  };

  const generateReport = () => {
    const report = `
CHAINSHIELD FRAUD ALERT REPORT
================================
Alert ID: ${alert.id}
Transaction Hash: ${alert.txHash}
Timestamp: ${new Date(alert.timestamp).toLocaleString()}

RISK ASSESSMENT
---------------
Risk Score: ${alert.riskScore}/100
Severity: ${alert.severity.toUpperCase()}
Fraud Type: ${alert.type}

TRANSACTION DETAILS
-------------------
From: ${alert.fromAddress}
To: ${alert.toAddress}
Amount: ${alert.amount}

DETECTION REASONS
-----------------
${alert.reason}

FEATURE ANALYSIS
----------------
${Object.entries(alert.features || {}).map(([key, value]) => 
  `${key}: ${(value * 100).toFixed(2)}%`
).join('\n')}

STATUS: ${status.toUpperCase()}
Generated: ${new Date().toLocaleString()}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alert-${alert.id}-report.txt`;
    link.click();
  };

  return (
    <div className="alert-detail-overlay">
      <div className="alert-detail-modal">
        <div className="modal-header">
          <div className="header-content">
            <h2 className="modal-title">Alert Investigation</h2>
            <p className="modal-subtitle">Detailed fraud analysis and investigation tools</p>
          </div>
          <button onClick={onClose} className="close-btn">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <h3 className="detail-label">TRANSACTION HASH</h3>
              <p className="detail-value hash">{alert.txHash}</p>
            </div>
            <div className="detail-item">
              <h3 className="detail-label">TIMESTAMP</h3>
              <p className="detail-value">{new Date(alert.timestamp).toLocaleString()}</p>
            </div>
          </div>

          <div className="risk-assessment">
            <h3 className="section-title">RISK ASSESSMENT</h3>
            <div className="risk-content">
              <div className="risk-score-display">
                <p className="risk-score">{alert.riskScore}</p>
                <p className="risk-label">Risk Score</p>
              </div>
              <div className="risk-details">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${alert.riskScore}%` }}
                  ></div>
                </div>
                <div className="risk-meta">
                  <div className="meta-item">
                    <p className="meta-label">Severity</p>
                    <p className="meta-value">{alert.severity.toUpperCase()}</p>
                  </div>
                  <div className="meta-item">
                    <p className="meta-label">Type</p>
                    <p className="meta-value">{alert.type}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="transaction-details">
            <h3 className="section-title">TRANSACTION DETAILS</h3>
            <div className="details-list">
              <div className="detail-row">
                <span className="row-icon">▶</span>
                <span className="row-label">From:</span>
                <span className="row-value">{alert.fromAddress}</span>
              </div>
              <div className="detail-row">
                <span className="row-icon">▶</span>
                <span className="row-label">To:</span>
                <span className="row-value">{alert.toAddress}</span>
              </div>
              <div className="detail-row">
                <span className="row-icon">▶</span>
                <span className="row-label">Amount:</span>
                <span className="row-value amount">{alert.amount}</span>
              </div>
            </div>
          </div>

          <div className="detection-reasons">
            <h3 className="section-title">DETECTION REASONS</h3>
            <p className="reasons-text">{alert.reason}</p>
          </div>

          {alert.features && (
            <div className="feature-analysis">
              <h3 className="section-title">FEATURE ANALYSIS (SHAP VALUES)</h3>
              <div className="features-list">
                {Object.entries(alert.features).map(([feature, value]) => (
                  <div key={feature} className="feature-item">
                    <div className="feature-header">
                      <span className="feature-name">{feature}</span>
                      <span className="feature-value">
                        {(value * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="feature-bar">
                      <div 
                        className="feature-fill"
                        style={{ width: `${value * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="status-update">
            <h3 className="section-title">UPDATE STATUS</h3>
            <div className="status-buttons">
              {['open', 'under_review', 'closed', 'false_positive'].map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusUpdate(s)}
                  disabled={updating || status === s}
                  className={`status-btn ${status === s ? 'active' : ''}`}
                >
                  {s.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={generateReport} className="btn-report">
            <span className="btn-icon">📥</span>
            <span>Generate Report</span>
          </button>
          <button onClick={onClose} className="btn-close-footer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertDetail;