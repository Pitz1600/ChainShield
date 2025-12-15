import React from 'react';
import CaseCard from './CaseCard';
import '../../styles/Cases.css';

function CaseManagement() {
  const cases = [
    {
      id: '1',
      number: 'CASE-1701234567890',
      title: 'Large Scale Procurement Fraud Investigation',
      status: 'investigating',
      priority: 'critical',
      alerts: 5,
      date: '10/27/2025'
    },
    {
      id: '2',
      number: 'CASE-1701234567891',
      title: 'Tax Evasion Network Analysis',
      status: 'open',
      priority: 'high',
      alerts: 3,
      date: '10/26/2025'
    }
  ];

  return (
    <div className="cases-container">
      <div className="page-hero cases-hero">
        <span className="hero-tag">CASE MANAGEMENT</span>
        <h2 className="hero-title">Organize investigations</h2>
        <p className="hero-subtitle">Track cases, manage evidence, and coordinate fraud investigations.</p>
        <button className="hero-cta">+ New Case</button>
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