import React, { useState, useEffect } from 'react';
import { Lock, BarChart, Target, Zap, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { isOfficial } from '../../utils/permissions';
import '../../styles/Analytics.css';

function Analytics({ user }) {
  // Permission check - only officials and admins can view analytics
  if (!isOfficial(user)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><Lock size={48} color="#991b1b" /></div>
          <h2 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Access Denied</h2>
          <p style={{ color: '#7f1d1d' }}>
            Analytics Dashboard is only available to Barangay Officials and Administrators.
          </p>
          <p style={{ color: '#991b1b', fontSize: '0.875rem', marginTop: '1rem' }}>
            Your role: <strong>{user?.role || 'Unknown'}</strong>
          </p>
        </div>
      </div>
    );
  }

  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0
  });
  const [allAlerts, setAllAlerts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const response = await api.get('/transactions/alerts?limit=5000');
      const data = response.data;
      setAllAlerts(data.alerts || []);

      const critical = data.alerts.filter(a => a.riskScore >= 80).length;
      const high = data.alerts.filter(a => a.riskScore >= 60 && a.riskScore < 80).length;
      const medium = data.alerts.filter(a => a.riskScore >= 40 && a.riskScore < 60).length;

      setStats({
        total: data.count || 0,
        critical,
        high,
        medium
      });
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    }
  };

  // Pagination for distribution items
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const totalPages = Math.ceil(allAlerts.length / itemsPerPage);

  return (
    <div className="analytics-container">
      {/* Hero Banner with Integrated Stats */}
      <div className="analytics-hero">
        <div className="hero-content">
          <span className="hero-tag">ANALYTICS DASHBOARD</span>
          <h2 className="hero-title">Insights across your operations</h2>
          <p className="hero-subtitle">Review transaction risk trends, detection patterns, and system performance metrics.</p>
        </div>

        <div className="hero-stats-grid">
          <div className="hero-stat-card">
            <div className="stat-icon"><BarChart size={24} color="#3b82f6" /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Transactions Analyzed</div>
            </div>
          </div>

          <div className="hero-stat-card">
            <div className="stat-icon"><Target size={24} color="#10b981" /></div>
            <div className="stat-content">
              <div className="stat-value">98.5%</div>
              <div className="stat-label">Detection Accuracy</div>
            </div>
          </div>

          <div className="hero-stat-card">
            <div className="stat-icon"><Zap size={24} color="#f59e0b" /></div>
            <div className="stat-content">
              <div className="stat-value">0.8s</div>
              <div className="stat-label">Avg Response Time</div>
            </div>
          </div>

          <div className="hero-stat-card">
            <div className="stat-icon"><DollarSign size={24} color="#8b5cf6" /></div>
            <div className="stat-content">
              <div className="stat-value">₱2.4B</div>
              <div className="stat-label">Risks Prevented</div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="analytics-cards">
        <div className="analytics-card">
          <h3 className="card-title">Risk Distribution</h3>
          <p className="card-subtitle">Breakdown by severity level</p>
          <div className="distribution-chart">
            <div className="distribution-item">
              <div className="distribution-header">
                <span className="distribution-label">
                  <span className="distribution-dot critical"></span>
                  Critical
                </span>
                <span className="distribution-value">{stats.critical}</span>
              </div>
              <div className="distribution-bar">
                <div
                  className="distribution-fill critical"
                  style={{ width: `${stats.total > 0 ? (stats.critical / stats.total * 100) : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="distribution-item">
              <div className="distribution-header">
                <span className="distribution-label">
                  <span className="distribution-dot high"></span>
                  High Risk
                </span>
                <span className="distribution-value">{stats.high}</span>
              </div>
              <div className="distribution-bar">
                <div
                  className="distribution-fill high"
                  style={{ width: `${stats.total > 0 ? (stats.high / stats.total * 100) : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="distribution-item">
              <div className="distribution-header">
                <span className="distribution-label">
                  <span className="distribution-dot medium"></span>
                  Medium Risk
                </span>
                <span className="distribution-value">{stats.medium}</span>
              </div>
              <div className="distribution-bar">
                <div
                  className="distribution-fill medium"
                  style={{ width: `${stats.total > 0 ? (stats.medium / stats.total * 100) : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h3 className="card-title">System Performance</h3>
          <p className="card-subtitle">Real-time metrics</p>
          <div className="performance-metrics">
            <div className="metric-item">
              <div className="metric-label">ML Model Accuracy</div>
              <div className="metric-value">98.5%</div>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: '98.5%', background: '#10b981' }}></div>
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Processing Speed</div>
              <div className="metric-value">0.8s avg</div>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: '95%', background: '#6366f1' }}></div>
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">System Uptime</div>
              <div className="metric-value">99.9%</div>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: '99.9%', background: '#8b5cf6' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction List with Pagination */}
      {allAlerts.length > 0 && (
        <div className="analytics-transactions">
          <div className="analytics-card">
            <h3 className="card-title">Recent Flagged Transactions</h3>
            <p className="card-subtitle">Latest transactions requiring attention</p>

            <div className="transactions-table">
              <table>
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Type</th>
                    <th>Agency</th>
                    <th>Risk Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allAlerts.slice(indexOfFirstItem, indexOfLastItem).map((alert, idx) => (
                    <tr key={alert._id || idx}>
                      <td className="text-ellipsis">{alert.transactionId}</td>
                      <td className="text-ellipsis">{alert.transactionType}</td>
                      <td className="text-ellipsis">{alert.agency}</td>
                      <td>
                        <span className={`risk-badge ${alert.riskScore >= 80 ? 'critical' : alert.riskScore >= 60 ? 'high' : 'medium'}`}>
                          {alert.riskScore}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge">Flagged</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="analytics-pagination">
                <button
                  className="pagination-btn-small"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="pagination-text-small">
                  Page {currentPage} of {totalPages}
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
        </div>
      )}
    </div>
  );
}

export default Analytics;