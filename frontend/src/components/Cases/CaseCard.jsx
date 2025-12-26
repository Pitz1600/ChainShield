import React from 'react';

function CaseCard({ caseData }) {
  const priorityColors = {
    critical: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
    high: { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' }
  };

  const colors = priorityColors[caseData.priority];

  return (
    <div className="case-card">
      <div className="case-card-header">
        <span className="case-number">{caseData.number}</span>
        <span className="priority-badge" style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
          {caseData.priority.toUpperCase()}
        </span>
      </div>
      <h4 className="case-title">{caseData.title}</h4>
      <div className="case-meta">
        <span>📄 {caseData.documents} documents</span>
        <span>🏢 {caseData.agency}</span>
        <span>📅 {caseData.date}</span>
      </div>
      <div className="case-status">
        <span className="status-dot"></span>
        <span>{caseData.status}</span>
      </div>
    </div>
  );
}

export default CaseCard;