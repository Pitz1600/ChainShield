import React, { useState } from 'react';
import { Shield, Search } from 'lucide-react';

function SecurityLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');

  // Static sample data
  const logsData = [
    {
      id: 1,
      userId: '123456789',
      role: 'Brgy Official Kagawad',
      action: 'Login',
      result: 'Denied',
      dateTime: '1/16/2026 11:55:03'
    },
    {
      id: 2,
      userId: '987654321',
      role: 'Admin',
      action: 'Login',
      result: 'Success',
      dateTime: '1/16/2026 11:57:48'
    },
    {
      id: 3,
      userId: '456789123',
      role: 'Officer',
      action: 'View Reports',
      result: 'Success',
      dateTime: '1/16/2026 12:01:15'
    },
    {
      id: 4,
      userId: '789123456',
      role: 'Admin',
      action: 'User Management',
      result: 'Success',
      dateTime: '1/16/2026 12:05:32'
    },
    {
      id: 5,
      userId: '321654987',
      role: 'Brgy Official',
      action: 'Login',
      result: 'Success',
      dateTime: '1/16/2026 12:10:44'
    },
    {
      id: 6,
      userId: '654987321',
      role: 'Officer',
      action: 'Export Data',
      result: 'Denied',
      dateTime: '1/16/2026 12:15:21'
    }
  ];

  const handleFilterChange = (filterValue) => {
    setFilterType(filterValue);
  };

  const getResultColor = (result) => {
    return result === 'Success' ? '#10b981' : '#ef4444';
  };

  const getResultBgColor = (result) => {
    return result === 'Success' ? '#ecfdf5' : '#fef2f2';
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header with title and buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <Shield size={28} color="#667eea" />
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: 0 }}>Security Logs</h2>
      </div>

      {/* Search and Filter Section */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: '1', minWidth: '250px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.5rem 1rem' }}>
          <Search size={18} color="#9ca3af" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              marginLeft: '0.75rem',
              flex: 1,
              fontSize: '0.875rem',
              fontFamily: 'inherit'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['All', 'System logs', 'Audit logs'].map((filter) => (
            <button
              key={filter}
              onClick={() => handleFilterChange(filter)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: filterType === filter ? '#667eea' : '#f3f4f6',
                color: filterType === filter ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '0.875rem',
                transition: 'all 0.2s'
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Table Section */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>ID</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>User ID</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Role</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Action</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Result</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {logsData.map((log, index) => (
                <tr key={log.id} style={{ borderBottom: index < logsData.length - 1 ? '1px solid #e5e7eb' : 'none', backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                  <td style={{ padding: '1rem', color: '#111827' }}>{log.id}</td>
                  <td style={{ padding: '1rem', color: '#6b7280' }}>{log.userId}</td>
                  <td style={{ padding: '1rem', color: '#374151' }}>{log.role}</td>
                  <td style={{ padding: '1rem', color: '#374151' }}>{log.action}</td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: getResultBgColor(log.result),
                        color: getResultColor(log.result),
                        borderRadius: '0.375rem',
                        fontWeight: '500',
                        fontSize: '0.8125rem'
                      }}
                    >
                      {log.result}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#6b7280' }}>{log.dateTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SecurityLogs;
