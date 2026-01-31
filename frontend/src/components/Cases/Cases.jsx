import React, { useState, useEffect } from 'react';
import { canAccessCases } from '../../utils/permissions';
import '../../styles/Cases.css';

function Cases({ user }) {
    // Permission check - only admins, analysts, and investigators can access
    if (!canAccessCases(user)) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                    <h2 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Access Denied</h2>
                    <p style={{ color: '#7f1d1d' }}>
                        Flagged Cases are only accessible to Administrators, Analysts, and Investigators.
                    </p>
                    <p style={{ color: '#991b1b', fontSize: '0.875rem', marginTop: '1rem' }}>
                        Your role: <strong>{user?.role || 'Unknown'}</strong>
                    </p>
                </div>
            </div>
        );
    }

    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchCases();
    }, []);

    const fetchCases = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/cases', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setCases(data.cases || []);
            } else if (response.status === 403) {
                setError('You do not have permission to view flagged cases');
            } else {
                setError('Failed to load cases');
            }
        } catch (err) {
            setError('Error loading cases: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading cases...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ color: '#dc2626' }}>{error}</div>
            </div>
        );
    }

    return (
        <div className="cases-container">
            <div className="cases-header">
                <h1>🔍 Flagged Cases</h1>
                <p>Review and manage flagged transactions requiring investigation</p>
            </div>

            {cases.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                    <h3 style={{ color: '#374151', marginBottom: '0.5rem' }}>No Flagged Cases</h3>
                    <p style={{ color: '#6b7280' }}>All transactions are within normal parameters</p>
                </div>
            ) : (
                <div className="cases-grid">
                    {cases.map((caseItem) => (
                        <div key={caseItem._id} className="case-card">
                            <div className="case-header">
                                <h3>{caseItem.title || 'Flagged Transaction'}</h3>
                                <span className={`case-status ${caseItem.status || 'open'}`}>
                                    {caseItem.status || 'Open'}
                                </span>
                            </div>
                            <div className="case-details">
                                <p><strong>Transaction ID:</strong> {caseItem.transactionId}</p>
                                <p><strong>Risk Score:</strong> <span className="risk-score">{caseItem.riskScore}</span></p>
                                <p><strong>Created:</strong> {new Date(caseItem.createdAt).toLocaleDateString()}</p>
                            </div>
                            {caseItem.description && (
                                <p className="case-description">{caseItem.description}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Cases;
