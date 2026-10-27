import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { expendituresAPI } from '../../services/api';
import TopBar from './TopBar';
import PageErrorBoundary from './PageErrorBoundary';
import '../../styles/MainLayout.css';

// Lazy load components for better performance and Firefox compatibility
const AnnualBudget = lazy(() => import('../AnnualBudget/AnnualBudget'));
const ApprovedBudgets = lazy(() => import('../Expenditures/ApprovedBudgets'));
const BudgetProposalsPage = lazy(() => import('../BudgetProposals/BudgetProposalsPage'));
const Dashboard = lazy(() => import('../Dashboard/Dashboard'));
const OfficialDashboard = lazy(() => import('../Dashboard/OfficialDashboard'));
const TransactionsPage = lazy(() => import('../Transactions/TransactionsPage'));
const Analytics = lazy(() => import('../Insights/Insights'));
const IntegrityChecker = lazy(() => import('../IntegrityChecker/IntegrityChecker'));
const AdminPanel = lazy(() => import('../Admin/AdminPanel'));
const DocumentVerification = lazy(() => import('../DocumentVerification/DocumentVerification'));
const SubmitComplaint = lazy(() => import('../Complaints/SubmitComplaint'));
const Profile = lazy(() => import('../Profile/Profile'));

function MainLayout({ user, onLogout, onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [budgetSubmission, setBudgetSubmission] = useState(false);
  useEffect(() => { let active = true; expendituresAPI.access().then(r => { if (active) setBudgetSubmission(r.data.canSubmit); }).catch(() => {}); return () => { active = false; }; }, [user?._id]);

  const pathToView = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, '');
    if (path === '/dashboard' || path === '') return 'dashboard';
    if (path.startsWith('/dashboard/')) {
      if (path === '/dashboard/approved-budgets' || path.startsWith('/dashboard/approved-budgets/')) return 'approved_budgets';
      if (path === '/dashboard/budget-proposals' || path.startsWith('/dashboard/budget-proposals/')) return 'budget_proposals';
      const segment = path.replace('/dashboard/', '');
      switch (segment) {
        case 'annual-budget': return 'annual_budget';
        case 'reports': return 'approved_budgets';
        case 'transactions': return 'transactions';
        case 'analytics': return 'analytics';
        case 'integrity-checker': return 'integrity_checker';
        case 'admin': return 'admin';
        case 'profile': return 'profile';
        default: return 'dashboard';
      }
    }
    return 'dashboard';
  }, [location.pathname]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleViewChange = (view) => {
    const viewToPath = {
      dashboard: '/dashboard',
      transactions: '/dashboard/transactions',
      annual_budget: '/dashboard/annual-budget',
      budget_proposals: '/dashboard/budget-proposals',
      approved_budgets: '/dashboard/approved-budgets',
      analytics: '/dashboard/analytics',
      integrity_checker: '/dashboard/integrity-checker',
      admin: '/dashboard/admin',
      profile: '/dashboard/profile'
    };
    navigate(viewToPath[view] || '/dashboard');
    setIsMobileMenuOpen(false); // Close mobile menu when navigating
  };

  return (
    <div className="app-layout">
      <Sidebar
        user={user}
        activeView={pathToView}
        setActiveView={handleViewChange}
        onLogout={onLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        toggleMobileMenu={toggleMobileMenu}
      />
      <div className="main-content">
        <TopBar
          user={user}
          toggleMobileMenu={toggleMobileMenu}
        />
        <div className="content-area">
          <PageErrorBoundary key={pathToView}>
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading...</p>
              </div>
            </div>
          }>
            {pathToView === 'dashboard' && (
              user?.role === 'barangay_official'
                  ? <OfficialDashboard user={user} onNavigate={handleViewChange} />
                  : <Dashboard user={user} onNavigate={onNavigate} />
            )}
            {pathToView === 'annual_budget' && <AnnualBudget user={user} />}
            {pathToView === 'approved_budgets' && <ApprovedBudgets user={user} />}
            {pathToView === 'budget_proposals' && <BudgetProposalsPage user={user} />}
            {pathToView === 'transactions' && (budgetSubmission ? <ApprovedBudgets user={user} /> : <TransactionsPage user={user} />)}
            {pathToView === 'analytics' && <Analytics user={user} />}
            {pathToView === 'integrity_checker' && (budgetSubmission ? <ApprovedBudgets user={user} /> : <IntegrityChecker user={user} />)}
            {pathToView === 'admin' && <AdminPanel user={user} />}
            {pathToView === 'profile' && <Profile user={user} />}
          </Suspense>
          </PageErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
