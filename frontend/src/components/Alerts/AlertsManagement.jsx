import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpDown,
  Link2,
  MessageSquare
} from 'lucide-react';
import api from '../../services/api';
import { formatAddressLabel } from '../../utils/helpers';
import '../../styles/Alerts.css';
import useLockBodyScroll from '../../utils/useLockBodyScroll';

function AlertsManagement({ embedded = false, user = null }) {
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
  const [tabRemarkInput, setTabRemarkInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);


  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 12;

  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  useLockBodyScroll(showModal);

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

  const getMlReasons = (tx) => {
    const reasons = Array.isArray(tx?.reasons) ? tx.reasons : [];
    return reasons.filter((reason) => /ml|ai summary|hybrid/i.test(String(reason)));
  };

  const classifyReason = (reason) => {
    const raw = String(reason || '').trim();
    const lower = raw.toLowerCase();
    if (lower.startsWith('ai summary:') || lower.startsWith('summary:')) {
      return { label: 'Summary', text: raw.replace(/^ai summary:\s*/i, '').replace(/^summary:\s*/i, '') };
    }
    if (lower.includes('ml') || lower.includes('hybrid')) {
      return { label: 'ML', text: raw.replace(/^ml\s*/i, '').replace(/^ml\s*hybrid\s*/i, '') };
    }
    return { label: 'Signal', text: raw };
  };
  const shouldShowInBulletin = (reason) => {
    const lower = String(reason || '').trim().toLowerCase();
    if (lower.startsWith('ai summary:') || lower.startsWith('summary:')) return false;
    if (lower.startsWith('ml hybrid assessment')) return false;
    return true;
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

  const FormulaPanel = ({ score = 0, patterns = [], reasons = [], mlReasons = [] }) => {
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
          {mlReasons.length > 0 && (
            <div className="formula-patterns">
              <div className="formula-patterns-title">ML Score Reason</div>
              <ul className="reason-list">
                {mlReasons.map((reason, idx) => {
                  const classified = classifyReason(reason);
                  const { label, text } = classified;
                  return (
                    <li key={`ml-${idx}`} className="reason-item">
                      <span className={`reason-tag reason-tag-${label.toLowerCase()}`}>{label}</span>
                      <span className="pattern-desc">{text}</span>
                    </li>
                  );
                })}
              </ul>
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
  const canSeeBreakdown = ['administrator', 'auditor', 'barangay_official'].includes(user?.role);

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
                { key: 'csv', label: 'Import Data' },
                ...(canSeeBreakdown ? [{ key: 'breakdown', label: 'Breakdown' }] : []),
                ...(canSeeBreakdown ? [{ key: 'remarks', label: `Auditor Remarks${tx?.remarks?.length ? ` (${tx.remarks.length})` : ''}` }] : [])
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
                <FormulaPanel
                  score={txRisk}
                  patterns={tx?.fraudPatterns || tx?.riskPatterns || []}
                  reasons={tx?.reasons || []}
                  mlReasons={getMlReasons(tx)}
                />
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

              {/* BREAKDOWN TAB — admin / barangay_official / auditor only */}
              {modalTab === 'breakdown' && canSeeBreakdown && (() => {
                const amount = Number(tx?.amount ?? 0);
                const net    = amount;
                const sectionLabel = {
                  fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: 8, marginTop: 4,
                };
                const rowStyle = {
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', padding: '10px 14px',
                  borderBottom: '0.5px solid #e2e8f0',
                };
                const rowLabel = { fontSize: '0.83rem', color: '#1e293b', fontWeight: 500 };
                const rowSub   = { fontSize: '0.73rem', color: '#94a3b8', marginTop: 2 };
                const rowVal   = { fontSize: '0.85rem', color: '#1e293b', textAlign: 'right', maxWidth: 240 };
                const riskBg   = txRisk >= 90 ? '#fee2e2' : txRisk >= 71 ? '#ffedd5' : txRisk >= 41 ? '#fef3c7' : '#dcfce7';

                const getStatusBadge = (status) => {
                  const map = {
                    Verified:   { color: '#10b981', bg: '#d1fae5' },
                    Flagged:    { color: '#f97316', bg: '#ffedd5' },
                    Pending:    { color: '#f59e0b', bg: '#fef3c7' },
                    Rejected:   { color: '#ef4444', bg: '#fee2e2' },
                    Suspicious: { color: '#ea580c', bg: '#ffedd5' },
                  };
                  const cfg = map[status] || map.Pending;
                  return (
                    <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: '0.75rem',
                      fontWeight: 600, background: cfg.bg, color: cfg.color }}>{status || 'Pending'}</span>
                  );
                };

                const bulletReasons = Array.isArray(tx?.reasons)
                  ? tx.reasons.filter(r => {
                      const l = String(r || '').trim().toLowerCase();
                      return !l.startsWith('ai summary:') && !l.startsWith('summary:') && !l.startsWith('ml hybrid assessment');
                    })
                  : [];

                return (
                  <div>
                    {/* Risk strip */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      background: riskBg, borderRadius: 8, marginBottom: '1rem' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: riskColor(txRisk), flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', color: '#475569' }}>AI Risk Assessment</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, marginLeft: 'auto', color: riskColor(txRisk) }}>
                        Score: {txRisk} — {riskLabel(txRisk)}
                      </span>
                    </div>

                    {/* Flag reasons */}
                    {bulletReasons.length > 0 && (
                      <div style={{ padding: '8px 12px', background: '#fef9c3', border: '0.5px solid #fde047',
                        borderRadius: 8, marginBottom: '1rem', fontSize: '0.8rem', color: '#854d0e', lineHeight: 1.6 }}>
                        <span style={{ fontWeight: 600 }}>⚠ Flagged: </span>
                        {bulletReasons.join(' · ')}
                      </div>
                    )}

                    {/* Transaction identity */}
                    <div style={sectionLabel}>Transaction identity</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '1rem' }}>
                      {[
                        { label: 'Transaction ID', value: tx?.transactionId || tx?.documentId || tx?.id, mono: true },
                        { label: 'Date', value: new Date(tx?.timestamp || tx?.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) },
                        { label: 'Agency / Office', value: tx?.agency || tx?.issuer || '—' },
                        { label: 'Program / Budget', value: tx?.programName || '—' },
                      ].map(({ label, value, mono }) => (
                        <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Classification */}
                    <div style={sectionLabel}>Classification</div>
                    <div style={{ marginBottom: '1rem', border: '0.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={rowStyle}>
                        <div style={rowLabel}>Transaction Type</div>
                        <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600, background: '#eff6ff', color: '#1e40af' }}>
                          {tx?.transactionType || tx?.documentType || 'Other'}
                        </span>
                      </div>
                      <div style={rowStyle}>
                        <div style={rowLabel}>Beneficiary Type</div>
                        <div style={rowVal}>{tx?.beneficiaryType || '—'}</div>
                      </div>
                      <div style={{ ...rowStyle, borderBottom: 'none' }}>
                        <div style={rowLabel}>Verification Status</div>
                        <div style={rowVal}>{getStatusBadge(tx?.verificationStatus || tx?.status)}</div>
                      </div>
                    </div>

                    {/* Parties */}
                    <div style={sectionLabel}>Parties involved</div>
                    <div style={{ marginBottom: '1rem', border: '0.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={rowStyle}>
                        <div>
                          <div style={rowLabel}>Payer</div>
                          <div style={rowSub}>Disbursing office</div>
                        </div>
                        <div style={{ ...rowVal, fontWeight: 400, color: '#475569' }}>
                          {formatAddressLabel(tx?.fromAddress) || tx?.agency || '—'}
                        </div>
                      </div>
                      <div style={{ ...rowStyle, borderBottom: 'none' }}>
                        <div>
                          <div style={rowLabel}>Payee</div>
                          <div style={rowSub}>Recipient / supplier</div>
                        </div>
                        <div style={{ ...rowVal, fontWeight: 400, color: '#475569' }}>
                          {formatAddressLabel(tx?.toAddress) || '—'}
                        </div>
                      </div>
                    </div>

                    {/* Amount breakdown */}
                    <div style={sectionLabel}>Amount breakdown</div>
                    <div style={{ marginBottom: '1rem', border: '0.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={rowStyle}>
                        <div>
                          <div style={rowLabel}>Transaction Amount</div>
                          <div style={rowSub}>As recorded in CSV</div>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                          ₱ {amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>Net Transaction Amount</span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e40af' }}>
                          ₱ {net.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Line Items */}
                    {Array.isArray(tx?.lineItems) && tx.lineItems.length > 0 && (() => {
                      const itemTotal = tx.lineItems.reduce((s, it) => s + (it.totalPrice || 0), 0);
                      return (
                        <>
                          <div style={sectionLabel}>
                            Itemized Line Items
                            <span style={{ marginLeft: 8, background: '#eff6ff', color: '#1e40af', borderRadius: 4, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0 }}>
                              {tx.lineItems.length} item{tx.lineItems.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div style={{ marginBottom: '1rem', border: '0.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 70px 80px 90px 1.5fr', background: '#f1f5f9', borderBottom: '0.5px solid #e2e8f0', padding: '6px 12px' }}>
                              {['Item', 'Unit', 'Qty', 'Unit Price', 'Total', 'Supplier'].map(h => (
                                <div key={h} style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                              ))}
                            </div>
                            {tx.lineItems.map((item, i) => (
                              <div key={i} style={{
                                display: 'grid', gridTemplateColumns: '2fr 60px 70px 80px 90px 1.5fr',
                                padding: '8px 12px', alignItems: 'center',
                                borderBottom: i < tx.lineItems.length - 1 ? '0.5px solid #f1f5f9' : 'none',
                                background: i % 2 === 0 ? '#fff' : '#fafafa'
                              }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#1e293b', paddingRight: 8 }}>{item.name}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.unit || '—'}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.quantity != null ? item.quantity.toLocaleString() : '—'}</div>
                                <div style={{ fontSize: '0.8rem', color: '#475569' }}>{item.unitPrice != null ? `₱${item.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{item.totalPrice != null ? `₱${item.totalPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.supplier || '—'}</div>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderTop: '0.5px solid #e2e8f0' }}>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Items subtotal</span>
                              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e40af' }}>₱{itemTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* Description */}
                    <div style={sectionLabel}>Description</div>
                    <div style={{ padding: '10px 14px', border: '0.5px solid #e2e8f0', borderRadius: 8,
                      fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.7, marginBottom: '1rem' }}>
                      {tx?.description || tx?.type || '—'}
                    </div>

                    {/* Blockchain */}
                    {tx?.blockchainTxId && (
                      <>
                        <div style={sectionLabel}>Blockchain record</div>
                        <div style={{ border: '0.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                          <div style={rowStyle}>
                            <div style={rowLabel}>Block Number</div>
                            <div style={{ ...rowVal, fontFamily: 'monospace' }}>#{tx.blockNumber || '—'}</div>
                          </div>
                          <div style={{ ...rowStyle, borderBottom: 'none' }}>
                            <div>
                              <div style={rowLabel}>On-chain Tx Hash</div>
                              <div style={rowSub}>Immutable audit record</div>
                            </div>
                            <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#166534', wordBreak: 'break-all', maxWidth: 200, textAlign: 'right' }}>
                              {tx.blockchainTxId}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* REMARKS TAB */}
              {modalTab === 'remarks' && canSeeBreakdown && (
                <div>
                  <div className="csv-details-banner" style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', marginBottom: '1.25rem' }}>
                    <div>
                      <div className="csv-banner-title" style={{ color: '#d97706' }}>Auditor Remarks &amp; Official Notes</div>
                      <div className="csv-banner-sub" style={{ color: '#b45309' }}>Internal findings and remarks recorded by auditors for this flagged transaction.</div>
                    </div>
                  </div>

                  {/* Add Remark Form — ONLY FOR AUDITOR ROLE */}
                  {user?.role === 'auditor' && (
                    <div style={{ marginBottom: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MessageSquare size={15} color="#3b82f6" /> Add Auditor Finding / Remark
                      </div>
                      <textarea
                        rows={3}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
                          fontSize: '0.88rem', fontFamily: 'inherit', resize: 'vertical', background: '#fff', color: '#1e293b'
                        }}
                        placeholder="Type official audit finding, document request, or verification remark..."
                        value={tabRemarkInput}
                        onChange={e => setTabRemarkInput(e.target.value)}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                        <button
                          type="button"
                          disabled={actionLoading || !tabRemarkInput.trim()}
                          onClick={async () => {
                            const targetId = tx?._id || tx?.id;
                            if (!tabRemarkInput.trim() || !targetId) return;
                            setActionLoading(true);
                            try {
                              const res = await api.post(`/transactions/${targetId}/remarks`, { remark: tabRemarkInput.trim() });
                              const updated = { ...(fullTx || tx), ...res.data.transaction };
                              setFullTx(updated);
                              setAlerts(prev => prev.map(a => (a._id === targetId || a.id === targetId) ? { ...a, ...updated } : a));
                              setTabRemarkInput('');
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          style={{
                            padding: '8px 18px', background: tabRemarkInput.trim() ? '#2563eb' : '#94a3b8',
                            color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem',
                            cursor: tabRemarkInput.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'all 0.2s'
                          }}
                        >
                          <MessageSquare size={14} /> Post Remark
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Remarks List or System Summary */}
                  {(!Array.isArray(tx?.remarks) || tx.remarks.length === 0) ? (
                    <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                        Automated System Audit Log
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem', color: '#334155' }}>
                        <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', marginBottom: 2 }}>Verification Status</span>
                          <strong style={{ color: tx?.verificationStatus === 'Verified' ? '#10b981' : '#f59e0b' }}>{tx?.verificationStatus || tx?.status || 'Pending'}</strong>
                          {tx?.verifiedBy && <span style={{ fontSize: '0.75rem', color: '#64748b' }}> by {tx.verifiedBy}</span>}
                        </div>
                        <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', marginBottom: 2 }}>AI Risk Score</span>
                          <strong>{txRisk}/100 ({riskLabel(txRisk)})</strong>
                        </div>
                      </div>
                      <p style={{ marginTop: 12, marginBottom: 0, color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center' }}>
                        No manual auditor remarks posted yet. Use the form above to record an official finding.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Recorded Official Remarks ({tx.remarks.length})
                      </div>
                      {tx.remarks.map((rmk, idx) => (
                        <div key={idx} style={{
                          padding: '14px 16px', border: '1px solid #fcd34d',
                          borderRadius: 8, fontSize: '0.9rem', background: '#fffbeb',
                          color: '#92400e', lineHeight: 1.6
                        }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 6, color: '#d97706', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{rmk.author || 'Auditor'}</span>
                            <span>{new Date(rmk.timestamp).toLocaleString()}</span>
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', color: '#78350f' }}>{rmk.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
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
