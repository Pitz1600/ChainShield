import React from 'react';
import { Link } from 'react-router-dom';

export const transactionDestination = (params = {}) =>
  `/dashboard/transactions?${new URLSearchParams({ tab: 'ledger', ...params })}`;

export default function DashboardLink({ to, className = '', children, ...props }) {
  return <Link to={to} className={`dashboard-data-link ${className || 'dashboard-data-block'}`} {...props}>{children}</Link>;
}
