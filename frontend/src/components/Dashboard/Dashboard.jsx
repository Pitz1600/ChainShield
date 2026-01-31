import React, { useState, useEffect } from 'react';
import { Mail, AlertTriangle, AlertCircle, TrendingUp, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import '../../styles/Dashboard.css';
import '../../styles/ColorfulIcons.css';

function Dashboard({ user, onNavigate }) { // Ensure onNavigate is destructured
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0
  });
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const alertsPerPage = 5;

  // Add handleVerificationClick logic
  const handleVerificationClick = async () => {
    try {
      await api.post('/auth/resend-otp');
      // Backend logs OTP to console as per requirement
    } catch (error) {
      console.error('Failed to resend OTP:', error);
    }
    onNavigate('email-verify', user);
  };

  // Add unverified user barrier
  if (!user?.isVerified) {
    return (
      <div className="dashboard-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px', boxShadow: 'var(--shadow-md)', maxWidth: '500px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><Mail size={48} color="#3b82f6" /></div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-blue)', marginBottom: '0.5rem' }}>
            Verify Your Email
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong>, verify your email address to continue.<br />
            We sent a code to <strong style={{ color: 'var(--text-primary)' }}>{user.email}</strong>.
          </p>
          <button
            className="btn-primary" // Assuming btn-primary exists or inline styles needed
            onClick={handleVerificationClick}
            style={{
              width: '100%',
              justifyContent: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Go to Verification Page
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch('http://localhost:5000/api/transactions/alerts?limit=20', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const formattedAlerts = data.alerts.map(alert => ({
          id: alert._id,
          severity: getSeverity(alert.riskScore),
          type: alert.fraudPatterns?.[0]?.type || 'Risk Detected',
          transactionType: alert.transactionType,
          agency: alert.agency,
          score: alert.riskScore,
          time: getTimeAgo(alert.timestamp)
        }));
        setRecentAlerts(formattedAlerts);

        const critical = data.alerts.filter(a => a.riskScore >= 80).length;
        const high = data.alerts.filter(a => a.riskScore >= 60 && a.riskScore < 80).length;
        const medium = data.alerts.filter(a => a.riskScore >= 40 && a.riskScore < 60).length;

        setStats({
          total: data.count || 0,
          critical,
          high,
          medium
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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

  // Pagination logic
  const indexOfLastAlert = currentPage * alertsPerPage;
  const indexOfFirstAlert = indexOfLastAlert - alertsPerPage;
  const currentAlerts = recentAlerts.slice(indexOfFirstAlert, indexOfLastAlert);
  const totalPages = Math.ceil(recentAlerts.length / alertsPerPage);

  return (
    <div className="dashboard-container">
      {/* Hero Banner with Integrated Stats */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <span className="hero-tag">INTEGRITY MONITORING WORKSPACE</span>
          <h2 className="hero-title">Welcome back, {user.username}!</h2>
          <p className="hero-subtitle">Monitor Philippine government financial transactions, detect anomaly patterns, and maintain transparent audit trails using AI and blockchain technology.</p>
        </div>

        <div className="hero-stats-grid">
          <div className="hero-stat-card total">
            <div className="stat-icon"><AlertTriangle size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Alerts</div>
            </div>
          </div>

          <div className="hero-stat-card critical">
            <div className="stat-icon"><AlertCircle size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.critical}</div>
              <div className="stat-label">Critical</div>
            </div>
          </div>

          <div className="hero-stat-card high">
            <div className="stat-icon"><TrendingUp size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.high}</div>
              <div className="stat-label">High Risk</div>
            </div>
          </div>

          <div className="hero-stat-card medium">
            <div className="stat-icon"><CheckCircle size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.medium}</div>
              <div className="stat-label">Medium Risk</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Recent Alerts</h3>
              <p className="card-subtitle">Latest risk alerts from government transactions</p>
            </div>
          </div>
          <div className="alerts-list">
            {currentAlerts.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                <p>No recent alerts</p>
              </div>
            ) : (
              currentAlerts.map(alert => (
                <div key={alert.id} className="alert-item">
                  <div className="alert-info">
                    <span className={`severity-dot ${alert.severity}`}></span>
                    <div className="alert-text-content">
                      <div className="alert-type">{alert.type}</div>
                      <div className="alert-time">{alert.transactionType} • {alert.agency} • {alert.time}</div>
                    </div>
                  </div>
                  <div className="alert-meta">
                    <div className={`alert-score ${alert.severity}`}>{alert.score} Risk Score</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination for Recent Alerts */}
          {totalPages > 1 && (
            <div className="dashboard-pagination">
              <button
                className="pagination-btn-small"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                ←
              </button>
              <span className="pagination-text-small">
                {currentPage} / {totalPages}
              </span>
              <button
                className="pagination-btn-small"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                →
              </button>
            </div>
          )}
        </div>

        <div className="dashboard-card">
          <h3 className="card-title">Risk Snapshot</h3>
          <p className="card-subtitle">Current risk distribution</p>
          <div className="risk-bars">
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot critical"></span>
                <span>Critical</span>
              </div>
              <div className="progress-bg"><div style={{ width: `${stats.total > 0 ? (stats.critical / stats.total * 100) : 0}%` }} className="progress-fill critical"></div></div>
              <span className="risk-count">{stats.critical}</span>
            </div>
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot medium"></span>
                <span>High Risk</span>
              </div>
              <div className="progress-bg"><div style={{ width: `${stats.total > 0 ? (stats.high / stats.total * 100) : 0}%` }} className="progress-fill medium"></div></div>
              <span className="risk-count">{stats.high}</span>
            </div>
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot low"></span>
                <span>Medium Risk</span>
              </div>
              <div className="progress-bg"><div style={{ width: `${stats.total > 0 ? (stats.medium / stats.total * 100) : 0}%` }} className="progress-fill low"></div></div>
              <span className="risk-count">{stats.medium}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Dashboard;