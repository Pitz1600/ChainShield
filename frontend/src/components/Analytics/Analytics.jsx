import React, { useState, useEffect, useCallback } from 'react';
import { Lock, BarChart, AlertTriangle, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { isOfficial } from '../../utils/permissions';
import '../../styles/Analytics.css';

function Analytics({ user }) {
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

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const [summary, setSummary] = useState({
    totalTransactions: 0,
    flaggedTotal: 0,
    critical: 0,
    high: 0,
    medium: 0
  });
  const [tableAlerts, setTableAlerts] = useState([]);
  const [tableTotalPages, setTableTotalPages] = useState(1);
  const [tableTotalCount, setTableTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const itemsPerPage = 10;

  const fetchAnalyticsData = useCallback(async (options = {}) => {
    const { silent = false } = options;

    if (silent) setIsRefreshing(true);
    else setIsLoading(true);

    setError('');

    try {
      const tableParams = { page: currentPage, limit: itemsPerPage };
      if (severityFilter !== 'all') tableParams.severity = severityFilter;

      const [totalTxRes, flaggedRes, criticalRes, highRes, mediumRes, tableRes] = await Promise.all([
        api.get('/transactions', { params: { page: 1, limit: 1, includeStaged: true } }),
        api.get('/transactions/alerts', { params: { page: 1, limit: 1 } }),
        api.get('/transactions/alerts', { params: { page: 1, limit: 1, severity: 'critical' } }),
        api.get('/transactions/alerts', { params: { page: 1, limit: 1, severity: 'high' } }),
        api.get('/transactions/alerts', { params: { page: 1, limit: 1, severity: 'medium' } }),
        api.get('/transactions/alerts', { params: tableParams })
      ]);

      const totalTransactionsRaw = toNumber(totalTxRes?.data?.totalCount, 0);
      const flaggedTotal = toNumber(flaggedRes?.data?.count, 0);
      const totalTransactions = totalTransactionsRaw > 0 ? totalTransactionsRaw : flaggedTotal;
      const critical = toNumber(criticalRes?.data?.count, 0);
      const high = toNumber(highRes?.data?.count, 0);
      const medium = toNumber(mediumRes?.data?.count, 0);
      setSummary({ totalTransactions, flaggedTotal, critical, high, medium });

      const tableData = tableRes?.data || {};
      const alerts = Array.isArray(tableData.alerts) ? tableData.alerts : [];
      const count = toNumber(tableData.count, alerts.length);
      const pages = Math.max(1, toNumber(tableData.totalPages, Math.ceil(count / itemsPerPage) || 1));

      setTableAlerts(alerts);
      setTableTotalCount(count);
      setTableTotalPages(pages);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(err?.response?.data?.error || 'Failed to fetch analytics data. Please try again.');
      setSummary({ totalTransactions: 0, flaggedTotal: 0, critical: 0, high: 0, medium: 0 });
      setTableAlerts([]);
      setTableTotalPages(1);
      setTableTotalCount(0);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, severityFilter]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const highOrCritical = summary.high + summary.critical;
  const flaggedRate = summary.totalTransactions > 0
    ? ((summary.flaggedTotal / summary.totalTransactions) * 100).toFixed(1)
    : null;
  const criticalShare = summary.flaggedTotal > 0
    ? ((summary.critical / summary.flaggedTotal) * 100).toFixed(1)
    : null;
  const highCriticalShare = summary.flaggedTotal > 0
    ? ((highOrCritical / summary.flaggedTotal) * 100).toFixed(1)
    : null;

  return (
    <div className="analytics-container">
      <div className="analytics-hero">
        <div className="hero-content">
          <span className="hero-tag">ANALYTICS DASHBOARD</span>
          <h2 className="hero-title">Insights across your operations</h2>
          <p className="hero-subtitle">Metrics are computed directly from transaction and alert records in your backend.</p>
        </div>

        <div className="hero-stats-grid">
          <div className="hero-stat-card">
            <div className="stat-icon"><BarChart size={24} color="#3b82f6" /></div>
            <div className="stat-content">
              <div className="stat-value">{summary.totalTransactions}</div>
              <div className="stat-label">Total Transactions</div>
            </div>
          </div>

          <div className="hero-stat-card">
            <div className="stat-icon"><AlertTriangle size={24} color="#f59e0b" /></div>
            <div className="stat-content">
              <div className="stat-value">{summary.flaggedTotal}</div>
              <div className="stat-label">Flagged Alerts</div>
            </div>
          </div>

          <div className="hero-stat-card">
            <div className="stat-icon"><TrendingUp size={24} color="#f97316" /></div>
            <div className="stat-content">
              <div className="stat-value">{highOrCritical}</div>
              <div className="stat-label">High + Critical</div>
            </div>
          </div>

          <div className="hero-stat-card">
            <div className="stat-icon"><AlertCircle size={24} color="#ef4444" /></div>
            <div className="stat-content">
              <div className="stat-value">{summary.critical}</div>
              <div className="stat-label">Critical Alerts</div>
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-toolbar">
        <div className="analytics-toolbar-left">
          <label htmlFor="severity-filter" className="toolbar-label">Table Filter</label>
          <select
            id="severity-filter"
            className="toolbar-select"
            value={severityFilter}
            onChange={(e) => {
              setCurrentPage(1);
              setSeverityFilter(e.target.value);
            }}
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </div>
        <div className="analytics-toolbar-right">
          <button
            className="toolbar-refresh-btn"
            onClick={() => fetchAnalyticsData({ silent: true })}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <span className="toolbar-updated">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Not updated yet'}
          </span>
        </div>
      </div>

      {error && (
        <div className="analytics-error-banner">
          <span>{error}</span>
          <button onClick={() => fetchAnalyticsData()} className="toolbar-refresh-btn">
            Retry
          </button>
        </div>
      )}

      <div className="analytics-cards">
        <div className="analytics-card">
          <h3 className="card-title">Risk Distribution</h3>
          <p className="card-subtitle">Breakdown by severity level (real alert counts)</p>
          <div className="distribution-chart">
            <div className="distribution-item">
              <div className="distribution-header">
                <span className="distribution-label">
                  <span className="distribution-dot critical"></span>
                  Critical
                </span>
                <span className="distribution-value">{summary.critical}</span>
              </div>
              <div className="distribution-bar">
                <div
                  className="distribution-fill critical"
                  style={{ width: `${summary.flaggedTotal > 0 ? (summary.critical / summary.flaggedTotal * 100) : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="distribution-item">
              <div className="distribution-header">
                <span className="distribution-label">
                  <span className="distribution-dot high"></span>
                  High Risk
                </span>
                <span className="distribution-value">{summary.high}</span>
              </div>
              <div className="distribution-bar">
                <div
                  className="distribution-fill high"
                  style={{ width: `${summary.flaggedTotal > 0 ? (summary.high / summary.flaggedTotal * 100) : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="distribution-item">
              <div className="distribution-header">
                <span className="distribution-label">
                  <span className="distribution-dot medium"></span>
                  Medium Risk
                </span>
                <span className="distribution-value">{summary.medium}</span>
              </div>
              <div className="distribution-bar">
                <div
                  className="distribution-fill medium"
                  style={{ width: `${summary.flaggedTotal > 0 ? (summary.medium / summary.flaggedTotal * 100) : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h3 className="card-title">Alert Ratios</h3>
          <p className="card-subtitle">Derived from live transaction and alert totals</p>
          <div className="performance-metrics">
            <div className="metric-item">
              <div className="metric-label">Flagged Rate (Alerts / Transactions)</div>
              <div className="metric-value">{flaggedRate === null ? '—' : `${flaggedRate}%`}</div>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: `${flaggedRate === null ? 0 : Math.min(100, Number(flaggedRate))}%`, background: '#f59e0b' }}></div>
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Critical Share of Alerts</div>
              <div className="metric-value">{criticalShare === null ? '—' : `${criticalShare}%`}</div>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: `${criticalShare === null ? 0 : Math.min(100, Number(criticalShare))}%`, background: '#ef4444' }}></div>
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">High + Critical Share</div>
              <div className="metric-value">{highCriticalShare === null ? '—' : `${highCriticalShare}%`}</div>
              <div className="metric-bar">
                <div className="metric-fill" style={{ width: `${highCriticalShare === null ? 0 : Math.min(100, Number(highCriticalShare))}%`, background: '#6366f1' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-transactions">
        <div className="analytics-card">
          <h3 className="card-title">Recent Flagged Transactions</h3>
          <p className="card-subtitle">Showing {tableTotalCount} record(s){severityFilter !== 'all' ? ` for ${severityFilter}` : ''}</p>

          {isLoading ? (
            <div className="analytics-loading-state">Loading analytics data...</div>
          ) : tableAlerts.length === 0 ? (
            <div className="analytics-empty-state">No alerts found for the selected filter.</div>
          ) : (
            <>
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
                    {tableAlerts.map((alert, idx) => (
                      <tr key={alert._id || idx}>
                        <td className="text-ellipsis">{alert.transactionId || '-'}</td>
                        <td className="text-ellipsis">{alert.transactionType || '-'}</td>
                        <td className="text-ellipsis">{alert.agency || '-'}</td>
                        <td>
                          <span className={`risk-badge ${Number(alert.riskScore) >= 90 ? 'critical' : Number(alert.riskScore) >= 71 ? 'high' : Number(alert.riskScore) >= 41 ? 'medium' : 'low'}`}>
                            {Number(alert.riskScore) || 0}
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

              {tableTotalPages > 1 && (
                <div className="analytics-pagination">
                  <button
                    className="pagination-btn-small"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="pagination-text-small">
                    Page {currentPage} of {tableTotalPages}
                  </span>
                  <button
                    className="pagination-btn-small"
                    onClick={() => setCurrentPage((prev) => Math.min(tableTotalPages, prev + 1))}
                    disabled={currentPage === tableTotalPages}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Analytics;
