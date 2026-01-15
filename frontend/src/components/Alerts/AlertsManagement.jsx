import React, { useState, useEffect } from 'react';
import AlertCard from './AlertCard';
import '../../styles/Alerts.css';

function AlertsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      let url = 'http://localhost:5000/api/transactions/alerts';
      if (filter !== 'all') {
        url += `?severity=${filter}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to load alerts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverity = (riskScore) => {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const formatAlert = (transaction) => ({
    id: transaction._id,
    severity: getSeverity(transaction.riskScore),
    type: transaction.fraudPatterns?.[0]?.type || 'Risk Detected',
    documentId: transaction.transactionId,
    documentType: transaction.transactionType,
    issuer: transaction.agency || 'Unknown',
    riskScore: transaction.riskScore,
    status: 'open',
    time: getTimeAgo(transaction.timestamp),
    amount: transaction.amount,
    programName: transaction.programName,
    fromAddress: transaction.fromAddress,
    toAddress: transaction.toAddress,
    timestamp: transaction.timestamp,
    fraudPatterns: transaction.fraudPatterns || [],
    riskLevel: transaction.riskLevel
  });

  const filteredAlerts = alerts
    .map(formatAlert)
    .filter(alert => {
      const matchesSearch =
        alert.documentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.issuer?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

  const handleInvestigate = (alert) => {
    setSelectedAlert(alert);
    setShowModal(true);
  };

  const handleExportReport = () => {
    // Create CSV content
    const headers = ['Transaction ID', 'Type', 'Agency', 'Amount', 'Risk Score', 'Severity', 'Timestamp', 'From Address', 'To Address'];
    const rows = filteredAlerts.map(alert => [
      alert.documentId,
      alert.type,
      alert.issuer,
      alert.amount || 'N/A',
      alert.riskScore,
      alert.severity,
      new Date(alert.timestamp).toLocaleString(),
      alert.fromAddress || 'N/A',
      alert.toAddress || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `alerts_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="alerts-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
            <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading alerts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alerts-container">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
          <button onClick={fetchAlerts} className="btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-container">
      <div className="page-hero alerts-hero">
        <span className="hero-tag">TRANSACTION ALERTS MANAGEMENT</span>
        <h2 className="hero-title">Monitor flagged transactions</h2>
        <p className="hero-subtitle">Search, filter, and investigate suspicious transactions flagged by the system.</p>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by transaction ID, agency, or risk type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-buttons">
          {['all', 'critical', 'high', 'medium'].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button className="export-btn" onClick={handleExportReport}>📥 Export Report</button>
        </div>
      </div>

      {filteredAlerts.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</p>
          <h3 style={{ marginBottom: '0.5rem' }}>No alerts found</h3>
          <p>All transactions are within normal parameters</p>
        </div>
      ) : (
        <>
          <div className="alerts-grid">
            {filteredAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} onInvestigate={handleInvestigate} />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-container">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>

              <div className="pagination-info">
                <span className="page-numbers">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`page-number ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </span>
                <span className="page-text">
                  Page {currentPage} of {totalPages}
                </span>
              </div>

              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Investigation Modal */}
      {showModal && selectedAlert && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔍 Alert Investigation</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="investigation-section">
                <h3>Transaction Details</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Transaction ID:</span>
                    <span className="detail-value">{selectedAlert.documentId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{selectedAlert.documentType}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Agency:</span>
                    <span className="detail-value">{selectedAlert.issuer}</span>
                  </div>
                  {selectedAlert.programName && (
                    <div className="detail-item">
                      <span className="detail-label">Program:</span>
                      <span className="detail-value">{selectedAlert.programName}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Amount:</span>
                    <span className="detail-value">₱{selectedAlert.amount?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Timestamp:</span>
                    <span className="detail-value">{new Date(selectedAlert.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="investigation-section">
                <h3>Risk Assessment</h3>
                <div className="risk-assessment">
                  <div className="risk-score-large">
                    <div className="score-circle" style={{ borderColor: selectedAlert.severity === 'critical' ? '#ef4444' : selectedAlert.severity === 'high' ? '#f97316' : '#eab308' }}>
                      <span className="score-number">{selectedAlert.riskScore}</span>
                      <span className="score-label">Risk Score</span>
                    </div>
                    <div className="risk-level">
                      <span className={`level-badge ${selectedAlert.severity}`}>{selectedAlert.riskLevel}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedAlert.fraudPatterns && selectedAlert.fraudPatterns.length > 0 && (
                <div className="investigation-section">
                  <h3>Detected Patterns</h3>
                  <div className="patterns-list">
                    {selectedAlert.fraudPatterns.map((pattern, idx) => (
                      <div key={idx} className="pattern-item">
                        <div className="pattern-header">
                          <span className="pattern-type">⚠️ {pattern.type}</span>
                          <span className={`pattern-severity ${pattern.severity}`}>{pattern.severity}</span>
                        </div>
                        {pattern.description && (
                          <p className="pattern-description">{pattern.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="investigation-section">
                <h3>Blockchain Details</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">From Address:</span>
                    <span className="detail-value mono">{selectedAlert.fromAddress || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">To Address:</span>
                    <span className="detail-value mono">{selectedAlert.toAddress || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Close</button>
              <button className="btn-primary">Mark as Reviewed</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #1e293b;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #64748b;
          padding: 0.5rem;
        }

        .modal-close:hover {
          color: #1e293b;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .investigation-section {
          margin-bottom: 2rem;
        }

        .investigation-section h3 {
          font-size: 1.125rem;
          color: #1e293b;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #e2e8f0;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .detail-label {
          font-size: 0.875rem;
          color: #64748b;
          font-weight: 500;
        }

        .detail-value {
          font-size: 1rem;
          color: #1e293b;
        }

        .detail-value.mono {
          font-family: monospace;
          font-size: 0.875rem;
          word-break: break-all;
        }

        .risk-assessment {
          display: flex;
          justify-content: center;
          padding: 1rem;
        }

        .risk-score-large {
          text-align: center;
        }

        .score-circle {
          width: 150px;
          height: 150px;
          border: 8px solid;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
        }

        .score-number {
          font-size: 3rem;
          font-weight: bold;
          color: #1e293b;
        }

        .score-label {
          font-size: 0.875rem;
          color: #64748b;
        }

        .level-badge {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .level-badge.critical {
          background: #fef2f2;
          color: #991b1b;
        }

        .level-badge.high {
          background: #fff7ed;
          color: #9a3412;
        }

        .level-badge.medium {
          background: #fefce8;
          color: #854d0e;
        }

        .patterns-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .pattern-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1rem;
        }

        .pattern-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .pattern-type {
          font-weight: 600;
          color: #1e293b;
        }

        .pattern-severity {
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .pattern-severity.high {
          background: #fff7ed;
          color: #9a3412;
        }

        .pattern-severity.medium {
          background: #fefce8;
          color: #854d0e;
        }

        .pattern-description {
          color: #64748b;
          font-size: 0.875rem;
          margin: 0;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 1px solid #e2e8f0;
        }

        .btn-primary, .btn-secondary {
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }

        .btn-secondary:hover {
          background: #e2e8f0;
        }
      `}</style>
    </div>
  );
}

export default AlertsManagement;