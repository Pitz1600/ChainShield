import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, TrendingUp, CheckCircle, ChevronLeft, ChevronRight, Link2, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import '../../styles/Dashboard.css';
import '../../styles/ColorfulIcons.css';

const buildSparklinePath = (points, width = 320, height = 120, pad = 12) => {
  if (!points || points.length === 0) return '';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;

  return points
    .map((v, i) => {
      const x = pad + i * step;
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
};

function Dashboard({ user, onNavigate }) {
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0 });
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const alertsPerPage = 4;

  // Real-time suspicious alerts
  const [rtAlerts, setRtAlerts] = useState([]);
  const [rtLoading, setRtLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const intervalRef = useRef(null);

  if (!user) {
    return (
      <div className="dashboard-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: 50, height: 50, border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading user data...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchDashboardData();
    fetchRTAlerts();
    intervalRef.current = setInterval(fetchRTAlerts, 30000);
    return () => clearInterval(intervalRef.current);
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
      setStats({ total: data.count || formattedAlerts.length, critical, high, medium });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchRTAlerts = async () => {
    try {
      const res = await api.get('/transactions/alerts?limit=10');
      setRtAlerts(res.data.alerts || []);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error('RT alerts error:', e);
    } finally {
      setRtLoading(false);
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
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const indexOfLastAlert = currentPage * alertsPerPage;
  const indexOfFirstAlert = indexOfLastAlert - alertsPerPage;
  const currentAlerts = recentAlerts.slice(indexOfFirstAlert, indexOfLastAlert);
  const totalPages = Math.ceil(recentAlerts.length / alertsPerPage);
  const lowCount = Math.max(0, stats.total - stats.critical - stats.high - stats.medium);
  const trendPoints = recentAlerts.slice(0, 10).reverse().map((a) => Number(a.score || 0));
  const sparkPath = buildSparklinePath(
    trendPoints.length ? trendPoints : [20, 35, 28, 44, 39, 52, 47],
    320,
    120,
    12
  );
  const avgRisk = recentAlerts.length
    ? Math.round(recentAlerts.reduce((sum, a) => sum + Number(a.score || 0), 0) / recentAlerts.length)
    : 0;
  const highSeverityRatio = stats.total > 0 ? Math.round(((stats.critical + stats.high) / stats.total) * 100) : 0;
  const riskRingStyle = {
    background: `conic-gradient(
      #ef4444 0 ${(stats.critical / Math.max(1, stats.total)) * 100}%,
      #f59e0b ${(stats.critical / Math.max(1, stats.total)) * 100}% ${((stats.critical + stats.high) / Math.max(1, stats.total)) * 100}%,
      #10b981 ${((stats.critical + stats.high) / Math.max(1, stats.total)) * 100}% ${((stats.critical + stats.high + stats.medium) / Math.max(1, stats.total)) * 100}%,
      #93c5fd ${((stats.critical + stats.high + stats.medium) / Math.max(1, stats.total)) * 100}% 100%
    )`
  };
  const topAgencies = Object.entries(
    rtAlerts.reduce((acc, a) => {
      const key = a.agency || 'Unknown Agency';
      if (!acc[key]) acc[key] = { count: 0, score: 0 };
      acc[key].count += 1;
      acc[key].score += Number(a.riskScore || 0);
      return acc;
    }, {})
  )
    .map(([agency, v]) => ({
      agency,
      count: v.count,
      avgRisk: Math.round(v.score / Math.max(1, v.count))
    }))
    .sort((a, b) => b.avgRisk - a.avgRisk || b.count - a.count)
    .slice(0, 4);

  const alertAge = rtAlerts.reduce((acc, a) => {
    const mins = Math.floor((Date.now() - new Date(a.timestamp).getTime()) / 60000);
    if (mins < 60) acc.recent += 1;
    else if (mins < 24 * 60) acc.today += 1;
    else acc.older += 1;
    return acc;
  }, { recent: 0, today: 0, older: 0 });
  const ageTotal = Math.max(1, alertAge.recent + alertAge.today + alertAge.older);

  const queueStats = rtAlerts.reduce((acc, a) => {
    const s = String(a.verificationStatus || 'Pending').toLowerCase();
    if (s.includes('verified')) acc.verified += 1;
    else if (s.includes('flagged')) acc.flagged += 1;
    else if (s.includes('reject') || s.includes('denied')) acc.rejected += 1;
    else acc.pending += 1;
    return acc;
  }, { pending: 0, verified: 0, flagged: 0, rejected: 0 });

  return (
    <div className="dashboard-container">
      {/* Hero Banner */}
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
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="dashboard-cards">
        {/* Recent Alerts (existing) */}
        <div className="dashboard-card primary-panel recent-alerts-card">
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
                    <span className={`severity-dot ${alert.severity}`} />
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
          {totalPages > 1 && (
            <div className="dashboard-pagination">
              <button className="pagination-btn-small" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-text-small">{currentPage} / {totalPages}</span>
              <button className="pagination-btn-small" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="dashboard-card primary-panel trend-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Risk Trend</h3>
              <p className="card-subtitle">Last 10 alerts score movement</p>
            </div>
          </div>
          <div className="sparkline-wrap">
            <svg viewBox="0 0 320 120" className="sparkline-svg" preserveAspectRatio="none" aria-label="Risk trend chart">
              <defs>
                <linearGradient id="sparkStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <path d={sparkPath} fill="none" stroke="url(#sparkStroke)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="trend-metrics">
            <div className="trend-metric">
              <span className="trend-label">Average Risk</span>
              <strong>{avgRisk}</strong>
            </div>
            <div className="trend-metric">
              <span className="trend-label">High/Critical Mix</span>
              <strong>{highSeverityRatio}%</strong>
            </div>
          </div>
        </div>

        {/* Risk Snapshot */}
        <div className="dashboard-card primary-panel">
          <h3 className="card-title">Risk Snapshot</h3>
          <p className="card-subtitle">Current risk distribution</p>
          <div className="risk-ring-row">
            <div className="risk-ring" style={riskRingStyle}>
              <div className="risk-ring-center">
                <div className="risk-ring-value">{stats.total}</div>
                <div className="risk-ring-label">Alerts</div>
              </div>
            </div>
            <div className="risk-ring-legend">
              <div><span className="risk-dot critical" /> Critical: {stats.critical}</div>
              <div><span className="risk-dot medium" /> High: {stats.high}</div>
              <div><span className="risk-dot low" /> Medium: {stats.medium}</div>
              <div><span className="risk-dot low2" /> Low: {lowCount}</div>
            </div>
          </div>
          <div className="risk-bars">
            <div className="risk-bar-item">
              <div className="risk-bar-label"><span className="risk-dot critical" /><span>Critical</span></div>
              <div className="progress-bg"><div style={{ width: `${stats.total > 0 ? (stats.critical / stats.total * 100) : 0}%` }} className="progress-fill critical" /></div>
              <span className="risk-count">{stats.critical}</span>
            </div>
            <div className="risk-bar-item">
              <div className="risk-bar-label"><span className="risk-dot medium" /><span>High Risk</span></div>
              <div className="progress-bg"><div style={{ width: `${stats.total > 0 ? (stats.high / stats.total * 100) : 0}%` }} className="progress-fill medium" /></div>
              <span className="risk-count">{stats.high}</span>
            </div>
            <div className="risk-bar-item">
              <div className="risk-bar-label"><span className="risk-dot low" /><span>Medium Risk</span></div>
              <div className="progress-bg"><div style={{ width: `${stats.total > 0 ? (stats.medium / stats.total * 100) : 0}%` }} className="progress-fill low" /></div>
              <span className="risk-count">{stats.medium}</span>
            </div>
          </div>
        </div>

        <div className="dashboard-bottom-grid">
          <div className="dashboard-card">
            <h3 className="card-title">Top Agencies at Risk</h3>
            <p className="card-subtitle">Highest average risk from live alerts</p>
            <div className="mini-list">
              {topAgencies.length === 0 ? (
                <div className="mini-empty">No agency data available</div>
              ) : (
                topAgencies.map((item) => (
                  <div key={item.agency} className="mini-row">
                    <div className="mini-row-main">
                      <strong>{item.agency}</strong>
                      <span>{item.count} alert{item.count === 1 ? '' : 's'}</span>
                    </div>
                    <span className={`mini-pill ${item.avgRisk >= 80 ? 'critical' : item.avgRisk >= 60 ? 'high' : 'medium'}`}>
                      {item.avgRisk}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-card">
            <h3 className="card-title">Alert Age Distribution</h3>
            <p className="card-subtitle">How fresh suspicious alerts are</p>
            <div className="stack-bars">
              <div className="stack-item">
                <span>Under 1 hour</span>
                <div className="stack-track"><div className="stack-fill recent" style={{ width: `${(alertAge.recent / ageTotal) * 100}%` }} /></div>
                <strong>{alertAge.recent}</strong>
              </div>
              <div className="stack-item">
                <span>Today</span>
                <div className="stack-track"><div className="stack-fill today" style={{ width: `${(alertAge.today / ageTotal) * 100}%` }} /></div>
                <strong>{alertAge.today}</strong>
              </div>
              <div className="stack-item">
                <span>Older</span>
                <div className="stack-track"><div className="stack-fill older" style={{ width: `${(alertAge.older / ageTotal) * 100}%` }} /></div>
                <strong>{alertAge.older}</strong>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <h3 className="card-title">Verification Queue</h3>
            <p className="card-subtitle">Current status split of suspicious alerts</p>
            <div className="queue-grid">
              <div className="queue-stat pending"><span>Pending</span><strong>{queueStats.pending}</strong></div>
              <div className="queue-stat verified"><span>Verified</span><strong>{queueStats.verified}</strong></div>
              <div className="queue-stat flagged"><span>Flagged</span><strong>{queueStats.flagged}</strong></div>
              <div className="queue-stat rejected"><span>Rejected</span><strong>{queueStats.rejected}</strong></div>
            </div>
          </div>
        </div>

        {/* ─── Real-Time Suspicious Alerts Panel ─── */}
        <div className="dashboard-card rt-alerts-card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="rt-dot" /> Real-Time Suspicious Transaction Alerts
              </h3>
              <p className="card-subtitle">
                Auto-refreshes every 30 seconds
                {lastRefreshed && ` | Last updated ${getTimeAgo(lastRefreshed)}`}
              </p>
            </div>
            <button className="rt-refresh-btn" onClick={fetchRTAlerts} title="Refresh now">
              <RefreshCw size={15} />
            </button>
          </div>

          {rtLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto' }} />
            </div>
          ) : rtAlerts.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
              <CheckCircle size={32} color="#10b981" style={{ marginBottom: 8 }} />
              <p>No suspicious transactions detected</p>
            </div>
          ) : (
            <div className="rt-alerts-scroll">
              {rtAlerts.map(alert => {
                const isHigh = alert.riskScore >= 80;
                const hasTxHash = !!alert.blockchainTxId;
                return (
                  <div key={alert._id} className={`rt-alert-row ${isHigh ? 'rt-high' : ''}`}>
                    <div className="rt-alert-id font-mono">{alert.transactionId || alert._id?.toString().slice(-8)}</div>
                    <div className="rt-alert-amount">PHP {Number(alert.amount || 0).toLocaleString()}</div>
                    <div className={`rt-alert-risk risk-chip ${alert.riskScore >= 80 ? 'risk-critical' : alert.riskScore >= 60 ? 'risk-high' : 'risk-medium'}`}>
                      {alert.riskScore} Risk
                    </div>
                    <div className="rt-alert-time">{getTimeAgo(alert.timestamp)}</div>
                    <div>
                      <span className={`rt-alert-status ${(alert.verificationStatus || '').toLowerCase()}`}>
                        {alert.verificationStatus || 'Pending'}
                      </span>
                    </div>
                    {hasTxHash ? (
                      <div className="rt-chain-badge" title={alert.blockchainTxId}>
                        <Link2 size={12} style={{ display: 'inline', marginRight: 3 }} />
                        {alert.blockchainTxId.slice(0, 10)}...
                      </div>
                    ) : (
                      <div className="rt-chain-none">Not on chain</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
