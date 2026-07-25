import React, { useState } from 'react';
import { FileText, CheckCircle, AlertTriangle, Clock, X, DollarSign, Users, Briefcase, FileSignature, Check, Ban, RefreshCw, MessageSquare } from 'lucide-react';
import { formatAddressLabel } from '../../utils/helpers';
import '../../styles/AuditorWorkspace.css';

export default function AuditorWorkspace({ tx, onClose, onAction, showToast }) {
  const [tab, setTab] = useState('general');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuditorAction = async (actionType) => {
    setLoading(true);
    try {
      if (actionType === 'Remarks') {
        if (!remarks.trim()) {
           showToast('Please enter a remark first.', 'error');
           return;
        }
        await onAction('Remarks', remarks);
        setRemarks('');
      } else {
        await onAction(actionType);
        // Automatically close after taking decision
        setTimeout(() => onClose(), 500);
      }
    } catch (e) {
      console.error(e);
      showToast('Action failed', 'error');
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'general', label: 'General Info', icon: <FileText size={16} /> },
    { id: 'budget', label: 'Budget Analysis', icon: <DollarSign size={16} /> },
    { id: 'expense', label: 'Expense Verification', icon: <FileSignature size={16} /> },
    { id: 'supplier', label: 'Supplier Verification', icon: <Briefcase size={16} /> },
    { id: 'beneficiary', label: 'Beneficiary Verification', icon: <Users size={16} /> },
    { id: 'timeline', label: 'Transaction Timeline', icon: <Clock size={16} /> },
    { id: 'ai', label: 'AI Analysis', icon: <AlertTriangle size={16} /> },
    { id: 'decision', label: 'Auditor Decision', icon: <CheckCircle size={16} /> }
  ];

  const budget = tx.budget || {};
  const requested = parseFloat(budget.requested || tx.amount || 0);
  const approved = parseFloat(budget.approved || 0);
  const remaining = parseFloat(budget.remaining || 0);
  const utilPct = approved > 0 ? ((requested / approved) * 100).toFixed(1) : 0;

  const items = tx.lineItems || tx.items || [];
  const itemsTotal = items.reduce((s, it) => s + (parseFloat(it.totalPrice || 0)), 0);
  
  const supplier = tx.supplier || {};
  
  const confidence = tx.confidence_score !== undefined ? tx.confidence_score : (tx.riskScore > 50 ? tx.riskScore : 100 - (tx.riskScore || 0));
  const recommendation = tx.recommendation || (tx.riskScore >= 71 ? "Manual review strongly recommended." : "Transaction appears normal.");
  const reasons = Array.isArray(tx.explanation) ? tx.explanation : (Array.isArray(tx.reasons) ? tx.reasons : []);

  return (
    <div className="aw-container">
      {/* HEADER */}
      <div className="aw-header">
        <div>
          <h2 className="aw-header-title">Auditor Workspace</h2>
          <div className="aw-header-subtitle">TX ID: {tx.transactionId || tx._id}</div>
        </div>
        <button onClick={onClose} className="aw-close-btn" aria-label="Close">
          <X size={20} />
        </button>
      </div>

      {/* AI DISCLAIMER - VISIBLE ON ALL TABS */}
      <div className="aw-disclaimer">
        <h4><AlertTriangle size={18} /> AI Decision Support Notice</h4>
        <p>
          AI-generated analysis is intended solely as a decision-support tool. Machine learning predictions are based on historical data and recognized patterns and may not always be accurate. <strong>AI can make mistakes.</strong> The assigned Barangay Auditor is responsible for reviewing all supporting documents, verifying the transaction, and making the final approval, rejection, or revision decision.
        </p>
      </div>

      {/* TABS HEADER */}
      <div className="aw-tabs">
        {tabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id)}
            className={`aw-tab-btn ${tab === t.id ? 'active' : ''}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="aw-content">
        
        {/* GENERAL INFO */}
        {tab === 'general' && (
          <div className="aw-card">
            <h3>General Information</h3>
            <div className="aw-grid">
              <div className="aw-data-item">
                <span className="aw-data-label">Transaction ID</span>
                <span className="aw-data-value mono">{tx.transactionId || tx._id}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Current Status</span>
                <span className="aw-data-value">{tx.verificationStatus || 'Pending'}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Project Name</span>
                <span className="aw-data-value">{tx.programName || '-'}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Project Category</span>
                <span className="aw-data-value">{tx.transactionType || '-'}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Date Created</span>
                <span className="aw-data-value">{new Date(tx.timestamp || tx.createdAt).toLocaleString()}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Created By</span>
                <span className="aw-data-value">{tx.createdBy || formatAddressLabel(tx.fromAddress) || '-'}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Department/Agency</span>
                <span className="aw-data-value">{tx.agency || '-'}</span>
              </div>
            </div>
          </div>
        )}

        {/* BUDGET ANALYSIS */}
        {tab === 'budget' && (
          <div className="aw-card">
            <h3>Budget Analysis</h3>
            <div className="aw-budget-grid">
              <div className="aw-budget-card">
                <div className="aw-data-label">Approved Budget</div>
                <div className="aw-budget-val">₱ {approved.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              </div>
              <div className={`aw-budget-card ${requested > approved ? 'warning' : 'highlight'}`}>
                <div className="aw-data-label">Requested Amount</div>
                <div className="aw-budget-val">₱ {requested.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              </div>
              <div className="aw-budget-card">
                <div className="aw-data-label">Remaining Budget</div>
                <div className="aw-budget-val">₱ {remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              </div>
            </div>
            <div>
              <span className="aw-data-label">Budget Utilization: {utilPct}% {utilPct > 100 && '(OVER BUDGET)'}</span>
              <div className="aw-progress-bar">
                <div 
                  className="aw-progress-fill" 
                  style={{ width: `${Math.min(utilPct, 100)}%`, background: utilPct > 100 ? '#ef4444' : '#10b981' }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* EXPENSE VERIFICATION */}
        {tab === 'expense' && (
          <div className="aw-card">
            <h3>
              <span>Expense Verification</span>
              <span style={{ fontSize: '0.9rem', color: itemsTotal > requested ? '#f87171' : '#34d399' }}>
                Total: ₱ {itemsTotal.toLocaleString(undefined, {minimumFractionDigits: 2})} 
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>(Declared: ₱ {requested.toLocaleString(undefined, {minimumFractionDigits: 2})})</span>
              </span>
            </h3>
            {items.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No itemized expenses found.</p>
            ) : (
              <table className="aw-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Qty</th>
                    <th>Unit Cost</th>
                    <th>Total Cost</th>
                    <th>Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isHighPrice = parseFloat(item.unitPrice || 0) > 50000;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>
                          {item.name}
                          {isHighPrice && <span style={{ marginLeft: 8, color: '#f87171', fontSize: '0.75rem', fontWeight: 'bold' }}>Unusual Price</span>}
                        </td>
                        <td>{item.quantity || 1}</td>
                        <td>₱ {parseFloat(item.unitPrice || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td className={isHighPrice ? 'price-high' : ''}>₱ {parseFloat(item.totalPrice || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td>{item.supplier || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* SUPPLIER */}
        {tab === 'supplier' && (
          <div className="aw-card">
            <h3>Supplier Verification</h3>
            <div className="aw-grid">
              <div className="aw-data-item">
                <span className="aw-data-label">Supplier Name</span>
                <span className="aw-data-value">{supplier.name || tx.supplier || '-'}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Total Historical Spending</span>
                <span className="aw-data-value">₱ {parseFloat(supplier.historicalSpending || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Number of Previous Projects</span>
                <span className="aw-data-value">{supplier.projectCount || 0}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Last Transaction Date</span>
                <span className="aw-data-value">{supplier.lastTxDate ? new Date(supplier.lastTxDate).toLocaleDateString() : '-'}</span>
              </div>
            </div>
            {supplier.isUnusual && (
              <div style={{ marginTop: 24, padding: 16, background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderLeft: '4px solid #ef4444', borderRadius: 8 }}>
                <strong>Warning:</strong> Unusual supplier activity detected (frequent transactions or highly anomalous pricing history).
              </div>
            )}
          </div>
        )}

        {/* BENEFICIARY */}
        {tab === 'beneficiary' && (
          <div className="aw-card">
            <h3>Beneficiary Verification</h3>
            <div className="aw-grid">
              <div className="aw-data-item">
                <span className="aw-data-label">Recipient Name</span>
                <span className="aw-data-value">{tx.beneficiary || formatAddressLabel(tx.toAddress) || '-'}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Organization</span>
                <span className="aw-data-value">{tx.beneficiaryOrg || '-'}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Beneficiary Group</span>
                <span className="aw-data-value">{tx.beneficiaryType || '-'}</span>
              </div>
              <div className="aw-data-item">
                <span className="aw-data-label">Project Location</span>
                <span className="aw-data-value">{tx.location || '-'}</span>
              </div>
            </div>
          </div>
        )}

        {/* TIMELINE */}
        {tab === 'timeline' && (
          <div className="aw-card">
            <h3>Transaction Timeline</h3>
            <div style={{ padding: '0 16px' }}>
              <div className="aw-timeline-item">
                <div className="aw-timeline-dot"></div>
                <div className="aw-timeline-date">{new Date(tx.createdAt || tx.timestamp).toLocaleString()}</div>
                <div className="aw-timeline-title">Transaction Created</div>
              </div>
              <div className="aw-timeline-item">
                <div className="aw-timeline-dot" style={{ background: '#8b5cf6', boxShadow: '0 0 0 4px rgba(139, 92, 246, 0.2)' }}></div>
                <div className="aw-timeline-date">Automated Pipeline</div>
                <div className="aw-timeline-title">AI Analysis Completed</div>
              </div>
              {tx.remarks && tx.remarks.map((rmk, i) => (
                <div key={i} className="aw-timeline-item">
                  <div className="aw-timeline-dot" style={{ background: '#f59e0b', boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.2)' }}></div>
                  <div className="aw-timeline-date">{new Date(rmk.timestamp).toLocaleString()}</div>
                  <div className="aw-timeline-title">Auditor Remark added</div>
                  <div className="aw-timeline-content">{rmk.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI ANALYSIS */}
        {tab === 'ai' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
              <div className="aw-ai-stat-card">
                <div className="aw-ai-stat-label">Risk Level</div>
                <div className={`aw-ai-stat-value ${tx.riskScore >= 71 ? 'aw-risk-high' : tx.riskScore >= 41 ? 'aw-risk-medium' : 'aw-risk-low'}`}>
                  {tx.riskLevel || 'LOW'}
                </div>
              </div>
              <div className="aw-ai-stat-card">
                <div className="aw-ai-stat-label">Confidence Score</div>
                <div className="aw-ai-stat-value aw-confidence">
                  {parseFloat(confidence).toFixed(1)}%
                </div>
              </div>
            </div>
            
            <div className="aw-card">
              <h3>Reasons for Prediction (Detected Anomalies)</h3>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#475569', lineHeight: 1.6 }}>
                {reasons.length > 0 ? reasons.map((r, i) => <li key={i} style={{ marginBottom: 12 }}>{r}</li>) : <li>No significant anomalies detected.</li>}
              </ul>
            </div>

            <div className="aw-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
              <h3 style={{ color: '#059669', marginBottom: 12 }}>AI Recommendation</h3>
              <p style={{ margin: 0, color: '#047857', fontSize: '1.1rem', fontWeight: 500 }}>{recommendation}</p>
            </div>
          </div>
        )}

        {/* AUDITOR DECISION */}
        {tab === 'decision' && (
          <div className="aw-card" style={{ borderColor: '#bae6fd', background: '#f0f9ff' }}>
            <h3 style={{ color: '#0284c7' }}>Auditor Decision</h3>
            <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: 24 }}>
              Please review all information carefully. As the Barangay Auditor, your decision overrides any AI recommendations.
            </p>
            
            <div style={{ marginBottom: 24 }}>
              <div className="aw-data-label" style={{ marginBottom: 12 }}>Auditor Remarks / Official Findings</div>
              <textarea 
                className="aw-remarks"
                rows={5} 
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Enter your findings, request for documents, or reasons for rejection here..."
              />
            </div>

            <div className="aw-decision-actions">
              <button disabled={loading} onClick={() => handleAuditorAction('Verified')} className="aw-action-btn approve">
                <Check size={20} /> Approve
              </button>
              <button disabled={loading} onClick={() => handleAuditorAction('Rejected')} className="aw-action-btn reject">
                <Ban size={20} /> Reject
              </button>
              <button disabled={loading} onClick={() => handleAuditorAction('Pending')} className="aw-action-btn revise">
                <RefreshCw size={20} /> Request Revision
              </button>
              <button disabled={loading} onClick={() => handleAuditorAction('Remarks')} className="aw-action-btn">
                <MessageSquare size={20} /> Add Official Remarks
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
