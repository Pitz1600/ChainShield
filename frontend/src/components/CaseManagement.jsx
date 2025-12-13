import React, { useState, useEffect } from 'react';
import CaseDetail from './CaseDetail';
import '../styles/CaseManagement.css';

function CaseManagement() {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    const mockCases = [
      {
        id: '1',
        caseNumber: 'CASE-1701234567890',
        title: 'Large Scale Procurement Fraud Investigation',
        status: 'investigating',
        priority: 'critical',
        alertCount: 5,
        createdAt: new Date().toISOString(),
        assignedTo: { username: 'Agent Smith' }
      },
      {
        id: '2',
        caseNumber: 'CASE-1701234567891',
        title: 'Tax Evasion Network Analysis',
        status: 'open',
        priority: 'high',
        alertCount: 3,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        assignedTo: { username: 'Agent Johnson' }
      }
    ];
    setCases(mockCases);
  };

  const filteredCases = filter === 'all' 
    ? cases 
    : cases.filter(c => c.status === filter);

  if (selectedCase) {
    return <CaseDetail case={selectedCase} onClose={() => setSelectedCase(null)} />;
  }

  return (
    <div className="case-management">
      <div className="case-filters">
        <div className="filter-group">
          {['all', 'open', 'investigating', 'closed'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`filter-btn ${filter === status ? 'active' : ''}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn-new-case">
          <span className="btn-icon">➕</span>
          <span>New Case</span>
        </button>
      </div>

      <div className="cases-grid">
        {filteredCases.map(caseItem => (
          <div
            key={caseItem.id}
            onClick={() => setSelectedCase(caseItem)}
            className="case-card"
          >
            <div className="case-header">
              <div className="case-title-wrapper">
                <span className="case-icon">📁</span>
                <div className="case-title-group">
                  <p className="case-number">{caseItem.caseNumber}</p>
                  <h3 className="case-title">{caseItem.title}</h3>
                </div>
              </div>
              <span className={`priority-badge ${caseItem.priority}`}>
                {caseItem.priority.toUpperCase()}
              </span>
            </div>

            <div className="case-meta">
              <span className={`status-tag ${caseItem.status}`}>
                {caseItem.status.toUpperCase()}
              </span>
              <span className="case-alerts">{caseItem.alertCount} alerts</span>
              <span className="case-date">
                {new Date(caseItem.createdAt).toLocaleDateString()}
              </span>
            </div>

            {caseItem.assignedTo && (
              <div className="case-assigned">
                <span>Assigned to:</span>
                <span className="assigned-name">{caseItem.assignedTo.username}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CaseManagement;