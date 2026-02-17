import React, { useState, useEffect } from 'react';
import { Mail, AlertTriangle, AlertCircle, TrendingUp, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [inflationRate, setInflationRate] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const alertsPerPage = 5;

  // Add user existence check
  if (!user) {
    return (
      <div className="dashboard-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: '50px', height: '50px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
          <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading user data...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchDashboardData();
    fetchInflationRate();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/transactions/alerts?limit=20');
      const data = response.data;

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
        total: data.count || formattedAlerts.length,
        critical,
        high,
        medium
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchInflationRate = async () => {
    try {
      const response = await api.get('/analytics/inflation/current');
      setInflationRate(response.data.data.rate);
    } catch (error) {
      console.error('Error fetching inflation rate:', error);
      // Set default if API fails
      setInflationRate(3.5);
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
          <p className="hero-subtitle">Monitor barangay financial transactions, detect anomaly patterns, and maintain transparent audit trails using AI and blockchain technology.</p>
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

          {/* Inflation Rate Card */}
          {inflationRate !== null && (
            <div className="hero-stat-card inflation" style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              gridColumn: 'span 2'
            }}>
              <div className="stat-icon"><TrendingUp size={24} /></div>
              <div className="stat-content">
                <div className="stat-value">{inflationRate.toFixed(1)}%</div>
                <div className="stat-label">PH Inflation Rate</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Recent Alerts</h3>
              <p className="card-subtitle">Latest risk alerts from barangay transactions</p>
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
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-text-small">
                {currentPage} / {totalPages}
              </span>
              <button
                className="pagination-btn-small"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
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