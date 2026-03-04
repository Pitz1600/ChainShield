import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, CheckCircle, AlertOctagon, Download, ChevronLeft, ChevronRight, X } from 'lucide-react';
import api from '../../services/api';
import AlertCard from './AlertCard';
import '../../styles/Alerts.css';

function AlertsManagement({ embedded = false }) {
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
  const [viewMode, setViewMode] = useState('cards'); // cards | table

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      let endpoint = '/transactions/alerts?limit=5000';
      if (filter !== 'all') {
        endpoint += (endpoint.includes('?') ? '&' : '?') + `severity=${filter}`;
      }

      const response = await api.get(endpoint);
      const data = response.data;
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
    riskPatterns: transaction.fraudPatterns || [],
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

  const pagedAlerts = filteredAlerts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  useEffect(() => setTotalPages(Math.max(1, Math.ceil(filteredAlerts.length / itemsPerPage))), [filteredAlerts.length]);

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
      {!embedded && (
        <div className="page-hero alerts-hero">
          <span className="hero-tag">TRANSACTION ALERTS MANAGEMENT</span>
          <h2 className="hero-title">Monitor flagged transactions</h2>
          <p className="hero-subtitle">Search, filter, and investigate suspicious transactions flagged by the system.</p>
        </div>
      )}

      <div className="filters-bar">
        <div className="search-box">
          <span className="search-icon"><Search size={18} color="#64748b" /></span>
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
          <button className="export-btn" onClick={handleExportReport}><Download size={16} style={{ marginRight: '8px', display: 'inline' }} /> Export Report</button>
        </div>
      </div>

      {filteredAlerts.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}><CheckCircle size={48} color="#10b981" /></p>
          <h3 style={{ marginBottom: '0.5rem' }}>No alerts found</h3>
          <p>All transactions are within normal parameters</p>
        </div>
      ) : (
        <>
          <div className="alerts-toolbar">
            <div className="view-toggle">
              <button className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`} onClick={() => setViewMode('cards')} type="button">Cards</button>
              <button className={`view-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')} type="button">Table</button>
            </div>
          </div>

          {viewMode === 'cards' ? (
            <div className="alerts-grid">
              {pagedAlerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} onInvestigate={handleInvestigate} />
              ))}
            </div>
          ) : (
            <div className="alerts-table-wrapper">
              <table className="alerts-table">
                <thead>
                  <tr>
                    <th>Txn ID</th>
                    <th>Severity</th>
                    <th>Type</th>
                    <th>Agency</th>
                    <th>Amount</th>
                    <th>Risk</th>
                    <th>Age</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAlerts.map(alert => (
                    <tr key={alert.id} onClick={() => handleInvestigate(alert)} className="clickable-row">
                      <td className="font-mono">{alert.documentId}</td>
                      <td><span className={`sev-pill sev-${alert.severity}`}>{alert.severity.toUpperCase()}</span></td>
                      <td>{alert.type}</td>
                      <td>{alert.issuer}</td>
                      <td>₱{Number(alert.amount || 0).toLocaleString()}</td>
                      <td><span className={`risk-chip ${alert.riskScore >=80 ? 'risk-critical': alert.riskScore>=60?'risk-high':alert.riskScore>=40?'risk-medium':'risk-low'}`}>{alert.riskScore}</span></td>
                      <td>{alert.time}</td>
                      <td><button className="btn-outline" onClick={(e) => { e.stopPropagation(); handleInvestigate(alert); }}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-container">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} style={{ marginRight: '4px', display: 'inline' }} /> Previous
              </button>
              <div className="pagination-info">Page {currentPage} of {totalPages}</div>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next <ChevronRight size={16} style={{ marginLeft: '4px', display: 'inline' }} />
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
              <h2><Search size={24} style={{ marginRight: '8px', display: 'inline', color: '#3b82f6' }} /> Alert Investigation</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={24} /></button>
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
                          <span className="pattern-type"><AlertTriangle size={16} style={{ marginRight: '6px', color: '#f59e0b' }} /> {pattern.type}</span>
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
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default AlertsManagement;
