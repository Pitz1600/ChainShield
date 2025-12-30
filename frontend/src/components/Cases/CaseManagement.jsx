import React from 'react';
import CaseCard from './CaseCard';
import '../../styles/Cases.css';

function CaseManagement() {
  const cases = [
    { id: '1', number: 'CASE-2024-001234', title: 'Large Scale Birth Certificate Forgery Ring', status: 'investigating', priority: 'critical', documents: 45, date: '10/27/2025', agency: 'PSA' },
    { id: '2', number: 'CASE-2024-001235', title: 'Land Title Fraud Network Investigation', status: 'open', priority: 'high', documents: 23, date: '10/26/2025', agency: 'Registry of Deeds' }
  ];

  return (
    <div className="cases-container">
      <div className="page-hero cases-hero">
        <span className="hero-tag">FRAUD CASES MANAGEMENT</span>
        <h2 className="hero-title">Organize investigations</h2>
        <p className="hero-subtitle">Track cases, manage evidence, and coordinate document fraud investigations.</p>
        <button className="btn-primary" style={{marginTop: '1rem'}}>+ Create New Case</button>
      </div>

      <div className="cases-grid">
        {cases.map(caseItem => (
          <CaseCard key={caseItem.id} caseData={caseItem} />
        ))}
      </div>
    </div>
  );
}

export default CaseManagement;