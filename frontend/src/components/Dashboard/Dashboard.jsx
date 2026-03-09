import React, { useState, useEffect } from 'react';
import { Mail, AlertTriangle, AlertCircle, TrendingUp, CheckCircle, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, ZAxis } from 'recharts';
import api from '../../services/api';
import csvRaw from '../../assets/randomized_1000_dataset.csv?raw';
import '../../styles/Dashboard.css';
import '../../styles/ColorfulIcons.css';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px', color: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <p style={{ fontWeight: 600, marginBottom: '8px', color: '#e2e8f0', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>{data.record_id}</p>
        <p style={{ margin: '4px 0', fontSize: '13px', color: '#94a3b8' }}><span style={{ color: '#cbd5e1' }}>Amount:</span> {data.amount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</p>
        <p style={{ margin: '4px 0', fontSize: '13px', color: '#94a3b8' }}>
          <span style={{ color: '#cbd5e1' }}>Z-Score:</span> <strong style={{ color: data.isAnomaly ? '#ef4444' : data.isWarning ? '#f59e0b' : '#3b82f6' }}>{data.zScore > 0 ? '+' : ''}{data.zScore}</strong>
        </p>
        <p style={{ margin: '4px 0', fontSize: '13px', color: '#94a3b8' }}><span style={{ color: '#cbd5e1' }}>Payee:</span> {data.payee_name}</p>
      </div>
    );
  }
  return null;
};

function Dashboard({ user, onNavigate }) { // Ensure onNavigate is destructured
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0
  });
  const [inflationRate, setInflationRate] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [datasetRecords, setDatasetRecords] = useState([]);
  const [datasetSummary, setDatasetSummary] = useState({
    totalCount: 0,
    totalVolume: 0,
    average: 0,
    highest: 0
  });
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
    parseDataset();
  }, []);

  const parseDataset = () => {
    try {
      const lines = csvRaw.trim().split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',');
        const records = [];

        // Parse ALL rows
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
              row[header.trim()] = values[index]?.trim() || '';
            });
            records.push(row);
          }
        }

        // Calculate Mean and Standard Deviation for Z-Score on ALL records
        let totalAmount = 0;
        let highestAmount = 0;
        const validRecords = [];

        records.forEach((rec, index) => {
          const amount = parseFloat(rec.debit_amount || rec.credit_amount || 0);
          totalAmount += amount;
          if (amount > highestAmount) highestAmount = amount;
          validRecords.push({ ...rec, amount, index: index + 1 });
        });

        const mean = totalAmount / validRecords.length;

        let sumSquaredDiffs = 0;
        validRecords.forEach(rec => {
          sumSquaredDiffs += Math.pow(rec.amount - mean, 2);
        });

        const standardDeviation = Math.sqrt(sumSquaredDiffs / validRecords.length);

        setDatasetSummary({
          totalCount: validRecords.length,
          totalVolume: totalAmount,
          average: mean,
          highest: highestAmount
        });

        // Let's take the first 100 records for the graph
        const graphRecords = validRecords.slice(0, 100).map(rec => {
          const zScore = standardDeviation === 0 ? 0 : (rec.amount - mean) / standardDeviation;
          return {
            ...rec,
            zScore: parseFloat(zScore.toFixed(2)),
            isAnomaly: Math.abs(zScore) >= 3,
            isWarning: Math.abs(zScore) >= 2 && Math.abs(zScore) < 3,
          };
        });

        setDatasetRecords(graphRecords);
      }
    } catch (error) {
      console.error('Error parsing dataset CSV:', error);
    }
  };

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
        <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Z-Score Distribution (Anomaly Detection)</h3>
              <p className="card-subtitle">Visualizing transaction amounts' deviations from the mean (μ)</p>
            </div>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px', marginTop: '1rem', color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6' }}>
            <strong>How our System Detects Unusual Spending:</strong> Think of the AI like a careful auditor finding the "normal" average spending for the barangay. It uses a helpful alert system called a <strong>Z-Score</strong> to measure how far away a transaction is from this normal average.
            <br /><br />
            Most transactions stay close to the normal average (between <strong>-2 and +2</strong> on the chart). If a transaction amount jumps too high or drops too low (beyond <strong>±2</strong>), the system flags it as a <span style={{ color: '#f59e0b', fontWeight: 600 }}>Warning</span> because it looks unusual. If the difference is extremely huge (beyond <strong>±3</strong>), the AI immediately flags it as a <span style={{ color: '#ef4444', fontWeight: 600 }}>Critical Alert</span> that needs to be checked right away.
          </div>
          <div style={{ width: '100%', height: 350, marginTop: '1.5rem', paddingBottom: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis type="number" dataKey="index" name="Record Index" stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={{ stroke: '#334155' }} label={{ value: 'Record Selection', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 12 }} />
                <YAxis type="number" dataKey="zScore" name="Z-Score" stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={{ stroke: '#334155' }} label={{ value: 'Z-Score', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }} />
                <ZAxis type="number" range={[60, 60]} />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#475569' }} />
                <ReferenceLine y={3} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '+3σ (Critical Risk)', fill: '#ef4444', position: 'top', fontSize: 11 }} />
                <ReferenceLine y={-3} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '-3σ (Critical Risk)', fill: '#ef4444', position: 'bottom', fontSize: 11 }} />
                <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.6} label={{ value: '+2σ (High Risk)', fill: '#f59e0b', position: 'top', fontSize: 11 }} />
                <ReferenceLine y={-2} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.6} label={{ value: '-2σ (High Risk)', fill: '#f59e0b', position: 'bottom', fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#94a3b8" opacity={0.8} />
                <Scatter name="Transactions" data={datasetRecords}>
                  {
                    datasetRecords.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isAnomaly ? '#ef4444' : entry.isWarning ? '#f59e0b' : '#3b82f6'} style={{ transition: 'all 0.3s ease' }} />
                    ))
                  }
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Barangay Pantal 2025 Summary</h3>
              <p className="card-subtitle">Comprehensive metrics across all {datasetSummary.totalCount.toLocaleString()} aggregated records</p>
            </div>
            <div className="card-actions">
              <span className="dataset-badge">Full Dataset Active</span>
            </div>
          </div>

          <div className="hero-stats-grid" style={{ marginTop: '1.5rem' }}>
            <div className="hero-stat-card" style={{ background: '#1e293b', border: '1px solid #334155' }}>
              <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><FileSpreadsheet size={24} /></div>
              <div className="stat-content">
                <div className="stat-value">{datasetSummary.totalCount.toLocaleString()}</div>
                <div className="stat-label">Total Records Processed</div>
              </div>
            </div>

            <div className="hero-stat-card" style={{ background: '#1e293b', border: '1px solid #334155' }}>
              <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><TrendingUp size={24} /></div>
              <div className="stat-content">
                <div className="stat-value">{datasetSummary.totalVolume.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</div>
                <div className="stat-label">Total Transaction Volume</div>
              </div>
            </div>

            <div className="hero-stat-card" style={{ background: '#1e293b', border: '1px solid #334155' }}>
              <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><CheckCircle size={24} /></div>
              <div className="stat-content">
                <div className="stat-value">{datasetSummary.average.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</div>
                <div className="stat-label">Average Transaction</div>
              </div>
            </div>

            <div className="hero-stat-card" style={{ background: '#1e293b', border: '1px solid #334155' }}>
              <div className="stat-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><AlertTriangle size={24} /></div>
              <div className="stat-content">
                <div className="stat-value">{datasetSummary.highest.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</div>
                <div className="stat-label">Highest Single Transaction</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
export default Dashboard;