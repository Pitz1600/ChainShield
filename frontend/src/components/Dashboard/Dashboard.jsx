import api from '../../services/api';
import HeroCard from './HeroCard';
import StatsCard from './StatsCard';
import '../../styles/Dashboard.css';

function Dashboard({ user, onNavigate }) {
  const handleVerificationClick = async () => {
    try {
      await api.post('/auth/resend-otp');
      // Backend logs OTP to console as per requirement
    } catch (error) {
      console.error('Failed to resend OTP:', error);
    }
    onNavigate('email-verify', user);
  };

  if (!user.isVerified) {
    return (
      <div className="dashboard-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px', boxShadow: 'var(--shadow-md)', maxWidth: '500px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary-blue)', marginBottom: '0.5rem' }}>
            Verify Your Email
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong>, verify your email address to continue.<br />
            We sent a code to <strong style={{ color: 'var(--text-primary)' }}>{user.email}</strong>.
          </p>
          <button
            className="btn-primary"
            onClick={handleVerificationClick}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Go to Verification Page
          </button>
        </div>
      </div>
    );
  }

  const statsData = [
    { icon: '⚠️', label: 'Total Alerts', value: '1,247', subtitle: 'Document anomalies detected', color: '#ef4444' },
    { icon: '🔴', label: 'Critical Cases', value: '23', subtitle: 'Requires immediate action', color: '#f97316' },
    { icon: '📈', label: 'Under Review', value: '156', subtitle: 'Being investigated', color: '#eab308' },
    { icon: '✅', label: 'Resolved', value: '1,068', subtitle: 'Successfully closed', color: '#22c55e' },
  ];

  const recentAlerts = [
    { id: 1, severity: 'critical', type: 'Forged Birth Certificate', docType: 'PSA Document', score: 92, time: '2 minutes ago' },
    { id: 2, severity: 'high', type: 'Duplicate Driver License', docType: 'LTO Record', score: 78, time: '1 hour ago' },
    { id: 3, severity: 'medium', type: 'Modified Land Title', docType: 'Registry Document', score: 65, time: '3 hours ago' },
  ];

  return (
    <div className="dashboard-container">
      <HeroCard
        title={`Welcome back, ${user.username}!`}
        subtitle="Monitor document transactions, investigate fraud cases, and maintain the integrity of government records."
        stats={[
          { label: 'Active Alerts', value: '23' },
          { label: 'Open Cases', value: '8' }
        ]}
      />

      <div className="stats-grid">
        {statsData.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Recent Alerts</h3>
              <p className="card-subtitle">Latest document fraud alerts requiring attention</p>
            </div>
            <button className="btn-link">View All</button>
          </div>
          <div className="alerts-list">
            {recentAlerts.map(alert => (
              <div key={alert.id} className="alert-item">
                <div className="alert-info">
                  <span className={`severity-dot ${alert.severity}`}></span>
                  <div>
                    <div className="alert-type">{alert.type}</div>
                    <div className="alert-time">{alert.docType} • {alert.time}</div>
                  </div>
                </div>
                <div className="alert-meta">
                  <div className={`alert-score ${alert.severity}`}>{alert.score} Risk Score</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card">
          <h3 className="card-title">Risk Snapshot</h3>
          <p className="card-subtitle">Current fraud risk distribution</p>
          <div className="risk-bars">
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot critical"></span>
                <span>High Risk</span>
              </div>
              <div className="progress-bg"><div style={{ width: '15%' }} className="progress-fill critical"></div></div>
              <span className="risk-count">23</span>
            </div>
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot medium"></span>
                <span>Medium Risk</span>
              </div>
              <div className="progress-bg"><div style={{ width: '45%' }} className="progress-fill medium"></div></div>
              <span className="risk-count">156</span>
            </div>
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot low"></span>
                <span>Low Risk</span>
              </div>
              <div className="progress-bg"><div style={{ width: '30%' }} className="progress-fill low"></div></div>
              <span className="risk-count">89</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Dashboard;