import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpDown,
  Link2
} from 'lucide-react';
import api from '../../services/api';
import { formatAddressLabel } from '../../utils/helpers';
import '../../styles/Alerts.css';

function AlertsManagement({ embedded = false }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedAlert, setSelectedAlert] = useState(null);
  const [fullTx, setFullTx] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState('details');
  const [txLoading, setTxLoading] = useState(false);


  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 12;

  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sortBy, sortOrder]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      let endpoint = '/transactions/alerts?limit=5000';

      if (filter !== 'all') {
        endpoint += `&severity=${filter}`;
      }

      endpoint += `&sortBy=${sortBy}&sortOrder=${sortOrder}`;

      const response = await api.get(endpoint);
      setAlerts(response.data.alerts || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to load alerts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverity = (riskScore) => {
    if (riskScore >= 90) return 'critical';
    if (riskScore >= 71) return 'high';
    if (riskScore >= 41) return 'medium';
    return 'low';
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const riskColor = (score) => {
    if (score >= 90) return '#ef4444';
    if (score >= 71) return '#f97316';
    if (score >= 41) return '#f59e0b';
    return '#10b981';
  };

  const riskLabel = (score) => {
    if (score >= 90) return 'CRITICAL';
    if (score >= 71) return 'HIGH';
    if (score >= 41) return 'MEDIUM';
    return 'LOW';
  };

  const isMeaningfulValue = (value) => {
    if (value === null || value === undefined) return false;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return false;
    return !['n/a', 'na', '-', 'unknown', 'unknown agency', 'unknown program'].includes(normalized);
  };

  const formatAlert = (transaction) => ({
    id: transaction._id,
    severity: getSeverity(transaction.riskScore),
    type: transaction.fraudPatterns?.[0]?.type || 'Risk Detected',
    documentId: transaction.transactionId,
    documentType: transaction.transactionType,
    issuer: transaction.agency || null,
    riskScore: transaction.riskScore,
    status: transaction.verificationStatus || 'Open',
    time: getTimeAgo(transaction.timestamp),
    amount: transaction.amount,
    programName: transaction.programName,
    fromAddress: formatAddressLabel(transaction.fromAddress),
    toAddress: formatAddressLabel(transaction.toAddress),
    timestamp: transaction.timestamp,
    riskPatterns: [],
    reasons: transaction.reasons || [],
    riskLevel: transaction.riskLevel,
    beneficiaryType: transaction.beneficiaryType,
    mlUsed: transaction.mlUsed,
    mlScore: transaction.mlScore,
    blockchainTxId: transaction.blockchainTxId,
    blockNumber: transaction.blockNumber,
    description: transaction.description
  });

  const filteredAlerts = alerts
    .map(formatAlert)
    .filter((alert) => {
      const q = searchTerm.toLowerCase();
      return (
        alert.documentId?.toLowerCase().includes(q) ||
        alert.type?.toLowerCase().includes(q) ||
        alert.issuer?.toLowerCase().includes(q)
      );
    });

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredAlerts.length / itemsPerPage));
    setTotalPages(pages);
    if (currentPage > pages) setCurrentPage(pages);
  }, [filteredAlerts.length, currentPage]);

  const pagedAlerts = filteredAlerts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleInvestigate = async (alert) => {
    setSelectedAlert(alert);
    setModalTab('details');
    setShowModal(true);
    setFullTx(null);
    setTxLoading(true);

    try {
      const res = await api.get(`/transactions/${alert.id}`);
      setFullTx(res.data);
    } catch (err) {
      console.warn('Could not fetch full transaction detail:', err?.message || err);
    } finally {
      setTxLoading(false);
    }
  };


  const handleExportReport = () => {
    const headers = ['Transaction ID', 'Type', 'Agency', 'Amount', 'Risk Score', 'Severity', 'Timestamp', 'From Address', 'To Address'];
    const rows = filteredAlerts.map((alert) => [
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

    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

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

  const RiskGaugeSmall = ({ score = 0 }) => {
    const safeScore = Math.min(100, Math.max(0, Number(score) || 0));
    const color = riskColor(safeScore);
    return (
      <div className="risk-bar-wrap">
        <div className="risk-bar-score" style={{ color }}>
          {safeScore}
          <span className="risk-bar-score-max">/100</span>
        </div>
        <div className="risk-bar-level">{riskLabel(safeScore)}</div>
        <div className="risk-bar-track" aria-label={`Risk ${safeScore} of 100`}>
          <div className="risk-bar-segment low" />
          <div className="risk-bar-segment medium" />
          <div className="risk-bar-segment high" />
          <div className="risk-bar-segment critical" />
          <div className="risk-bar-indicator" style={{ left: `calc(${safeScore}% - 6px)`, background: color }} />
        </div>
      </div>
    );
  };

  const FormulaPanel = ({ score = 0, patterns = [], reasons = [] }) => {
    const mean = 50;
    const stddev = 25;
    const z = ((score - mean) / stddev).toFixed(2);
    const suspicious = Math.abs(parseFloat(z)) > 1.5;

    return (
      <div className="formula-card">
        <h4 className="formula-title">Anomaly Analysis</h4>
        <div className="formula-body">
          <div className="formula-row"><span className="formula-label">Formula</span><span className="formula-val formula-eq">Z = (X - μ) / σ</span></div>
          <div className="formula-row"><span className="formula-label">Risk Score (X)</span><span className="formula-val">{score}</span></div>
          <div className="formula-row"><span className="formula-label">Mean (mu)</span><span className="formula-val">{mean}</span></div>
          <div className="formula-row"><span className="formula-label">Std Dev (sigma)</span><span className="formula-val">{stddev}</span></div>
          <div className="formula-row">
            <span className="formula-label">Z-Score</span>
            <span className="formula-val formula-zscore" style={{ color: suspicious ? '#ef4444' : '#10b981' }}>
              {z} {suspicious ? 'Anomalous' : 'Normal'}
            </span>
          </div>
          <div className={`formula-verdict ${suspicious ? 'verdict-suspicious' : 'verdict-normal'}`}>
            {suspicious ? `Suspicious: Z=${z} exceeds +/-1.5` : `Normal: Z=${z} within +/-1.5`}
          </div>
          {reasons.length > 0 && (
            <div className="formula-patterns">
              <div className="formula-patterns-title">Reason Why</div>
              {reasons.map((r, idx) => (
                <div key={idx} className="formula-pattern-item">
                  <span className="pattern-desc">{r}</span>
                </div>
              ))}
            </div>
          )}
          {patterns.length > 0 && null}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="alerts-container">
        <div className="alerts-empty-state">
          <div className="alerts-spinner" />
          <p>Loading alerts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alerts-container">
        <div className="alerts-empty-state">
          <p className="alerts-error">{error}</p>
          <button onClick={fetchAlerts} className="btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  const tx = fullTx || selectedAlert;
  const txRisk = Number(tx?.riskScore || 0);

  return (
    <div className="alerts-container">
      {!embedded && (
        <div className="page-hero alerts-hero">
          <span className="hero-tag">TRANSACTION ALERTS MANAGEMENT</span>
          <h2 className="hero-title">Monitor flagged transactions</h2>
          <p className="hero-subtitle">Search, filter, and investigate suspicious transactions flagged by the system.</p>
        </div>
      )}

      <form className="alerts-filters" onSubmit={(e) => e.preventDefault()}>
        <div className="alerts-search-wrap">
          <Search size={18} className="alerts-search-icon" />
          <input
            type="text"
            placeholder="Search by transaction ID, agency, or risk type..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="alerts-search-input"
          />
        </div>

        <div className="alerts-controls-wrap">
          <div className="alerts-filter-chips">
            {['all', 'critical', 'high', 'medium'].map((value) => (
              <button
                key={value}
                type="button"
                className={`alerts-chip ${filter === value ? 'active' : ''}`}
                onClick={() => {
                  setFilter(value);
                  setCurrentPage(1);
                }}
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>

          <select className="alerts-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="timestamp">Sort: Date</option>
            <option value="riskScore">Sort: Risk Score</option>
          </select>

          <button
            type="button"
            className="alerts-sort-order-btn"
            onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
          >
            <ArrowUpDown size={15} />
          </button>

          <button type="button" className="alerts-export-btn" onClick={handleExportReport}>
            <Download size={16} /> Export Report
          </button>
        </div>
      </form>

      {filteredAlerts.length === 0 ? (
        <div className="alerts-empty-state">
          <CheckCircle size={40} color="#10b981" />
          <h3>No alerts found</h3>
          <p>All transactions are within normal parameters.</p>
        </div>
      ) : (
        <>
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
                {pagedAlerts.map((alert) => (
                  <tr key={alert.id} className="clickable-row" onClick={() => handleInvestigate(alert)}>
                    <td className="font-mono">{alert.documentId}</td>
                    <td><span className={`sev-pill sev-${alert.severity}`}>{alert.severity.toUpperCase()}</span></td>
                    <td>{alert.type}</td>
                    <td>{isMeaningfulValue(alert.issuer) ? alert.issuer : ''}</td>
                    <td>PHP {Number(alert.amount || 0).toLocaleString()}</td>
                    <td><span className={`risk-chip ${alert.riskScore >= 90 ? 'risk-critical' : alert.riskScore >= 71 ? 'risk-high' : alert.riskScore >= 41 ? 'risk-medium' : 'risk-low'}`}>{alert.riskScore}</span></td>
                    <td>{alert.time}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInvestigate(alert);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination-container">
              <button className="pagination-btn" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                <ChevronLeft size={16} /> Previous
              </button>
              <div className="pagination-info">Page {currentPage} of {totalPages}</div>
              <button className="pagination-btn" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {showModal && selectedAlert && (
        <div className="tx-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="tx-modal tx-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="tx-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0 }}>Transaction Details</h3>
                {txLoading && <div className="alerts-spinner small" />}
              </div>
              <button type="button" className="close-btn" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="risk-gauge-strip">
              <div className="risk-gauge-strip-gauge">
                <RiskGaugeSmall score={txRisk} />
              </div>
              <div className="risk-gauge-strip-info">
                <div className="risk-gauge-strip-title">Live Risk Meter</div>
                <div className="risk-gauge-strip-score" style={{ color: riskColor(txRisk) }}>
                  {txRisk}<span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>/100</span>
                </div>
                <div className="alerts-risk-legend">
                  <span><span className="legend-dot" style={{ background: '#10b981' }} /> Low (0-40)</span>
                  <span><span className="legend-dot" style={{ background: '#f59e0b' }} /> Medium (41-70)</span>
                  <span><span className="legend-dot" style={{ background: '#f97316' }} /> High (71-89)</span>
                  <span><span className="legend-dot" style={{ background: '#ef4444' }} /> Critical (90+)</span>
                </div>
                <div
                  className="risk-gauge-strip-level"
                  style={{
                    marginTop: 8,
                    background: txRisk >= 90 ? '#fee2e2' : txRisk >= 71 ? '#ffedd5' : txRisk >= 41 ? '#fef3c7' : '#d1fae5',
                    color: txRisk >= 90 ? '#991b1b' : txRisk >= 71 ? '#9a3412' : txRisk >= 41 ? '#92400e' : '#065f46'
                  }}
                >
                  {tx?.riskLevel || riskLabel(txRisk)}
                </div>
              </div>
            </div>

            <div className="modal-tabs">
              {[
                { key: 'details', label: 'Details' },
                { key: 'ai', label: 'AI Analysis' },
                { key: 'csv', label: 'Import Data' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`modal-tab-btn ${modalTab === tab.key ? 'active' : ''}`}
                  onClick={() => setModalTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="tx-modal-body tx-modal-body-wide">
              {modalTab === 'details' && (
                <div className="tx-grid">
                  <div className="tx-grid-row">
                    <div className="tx-grid-col">
                      <label>Transaction ID</label>
                      <div className="font-mono">{tx?.transactionId || tx?.documentId || tx?.id}</div>
                    </div>
                    <div className="tx-grid-col">
                      <label>Date and Time</label>
                      <div>{new Date(tx?.timestamp || tx?.createdAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="tx-grid-row">
                    <div className="tx-grid-col">
                      <label>Sender (From)</label>
                      <div className="addr-ellipsis" title={tx?.fromAddress || ''}>{formatAddressLabel(tx?.fromAddress) || 'N/A'}</div>
                    </div>
                    <div className="tx-grid-col">
                      <label>Receiver (To)</label>
                      <div className="addr-ellipsis" title={tx?.toAddress || ''}>{formatAddressLabel(tx?.toAddress) || 'N/A'}</div>
                    </div>
                  </div>

                  <div className="tx-grid-row">
                    <div className="tx-grid-col">
                      <label>Amount</label>
                      <div className="font-bold amount-text">PHP {Number(tx?.amount || 0).toLocaleString()}</div>
                    </div>
                    <div className="tx-grid-col">
                      <label>Transaction Type</label>
                      <div>{tx?.transactionType || tx?.documentType || 'N/A'}</div>
                    </div>
                  </div>

                  <div className="tx-grid-row">
                    {isMeaningfulValue(tx?.agency || tx?.issuer) && (
                      <div className="tx-grid-col">
                        <label>Agency</label>
                        <div>{tx?.agency || tx?.issuer}</div>
                      </div>
                    )}
                    <div className="tx-grid-col">
                      <label>Beneficiary Type</label>
                      <div>{tx?.beneficiaryType || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="tx-grid-row">
                    <div className="tx-grid-col">
                      <label>AI Combined</label>
                      <div>{tx?.mlUsed ? 'Yes' : 'No'}</div>
                    </div>
                    <div className="tx-grid-col">
                      <label>ML Score</label>
                      <div>{tx?.mlScore ?? '-'}</div>
                    </div>
                  </div>

                  <div className="tx-grid-row">
                    <div className="tx-grid-col">
                      <label>Blockchain Status</label>
                      <div className={tx?.blockchainTxId ? 'chain-pill recorded' : 'chain-pill not-recorded'}>
                        {tx?.blockchainTxId ? 'Recorded on Chain' : 'Not recorded'}
                      </div>
                    </div>
                    <div className="tx-grid-col">
                      <label>Block Number</label>
                      <div>{tx?.blockNumber ? `#${tx.blockNumber}` : '-'}</div>
                    </div>
                  </div>

                  {tx?.blockchainTxId && (
                    <div className="tx-grid-desc">
                      <label><Link2 size={12} style={{ display: 'inline', marginRight: 4 }} />Blockchain Tx Hash</label>
                      <div className="hash-box">{tx.blockchainTxId}</div>
                    </div>
                  )}

                  <div className="tx-grid-desc">
                    <label>Description</label>
                    <p>{tx?.description || tx?.type || 'N/A'}</p>
                  </div>
                </div>
              )}

              {modalTab === 'ai' && (
                <FormulaPanel score={txRisk} patterns={tx?.fraudPatterns || tx?.riskPatterns || []} reasons={tx?.reasons || []} />
              )}

              {modalTab === 'csv' && (
                <div>
                  <div className="csv-details-banner">
                    <div>
                      <div className="csv-banner-title">CSV Import Source</div>
                      <div className="csv-banner-sub">This transaction was imported from a CSV batch upload and processed through the AI pipeline.</div>
                    </div>
                  </div>

                  <div className="csv-fields-grid">
                    <div className="csv-field"><div className="csv-field-label">Transaction ID (Original)</div><div className="csv-field-value font-mono">{tx?.transactionId || tx?.documentId || '-'}</div></div>
                    <div className="csv-field"><div className="csv-field-label">Payer Name (From)</div><div className="csv-field-value">{formatAddressLabel(tx?.fromAddress) || '-'}</div></div>
                    <div className="csv-field"><div className="csv-field-label">Payee Name (To)</div><div className="csv-field-value">{formatAddressLabel(tx?.toAddress) || '-'}</div></div>
                    <div className="csv-field"><div className="csv-field-label">Amount</div><div className="csv-field-value">PHP {Number(tx?.amount || 0).toLocaleString()}</div></div>
                    <div className="csv-field"><div className="csv-field-label">Transaction Type</div><div className="csv-field-value">{tx?.transactionType || '-'}</div></div>
                    {isMeaningfulValue(tx?.agency) && (
                      <div className="csv-field"><div className="csv-field-label">Agency</div><div className="csv-field-value">{tx?.agency}</div></div>
                    )}
                    {isMeaningfulValue(tx?.programName) && (
                      <div className="csv-field"><div className="csv-field-label">Program Name</div><div className="csv-field-value">{tx?.programName}</div></div>
                    )}
                    <div className="csv-field"><div className="csv-field-label">Beneficiary Type</div><div className="csv-field-value">{tx?.beneficiaryType || '-'}</div></div>
                    <div className="csv-field"><div className="csv-field-label">Post Date</div><div className="csv-field-value">{new Date(tx?.timestamp || tx?.createdAt).toLocaleString()}</div></div>
                  </div>
                </div>
              )}
            </div>

            <div className="tx-modal-footer">
              <button type="button" className="btn-close" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AlertsManagement;
