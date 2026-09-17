import React from 'react';

export default function LiveThermostatsCard({ thermostats = [] }) {
  const list = thermostats;

  const onlineCount = list.filter(t => t.status !== 'offline').length;
  const totalCount = list.length;

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '0.75rem',
      padding: '1.5rem',
      boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%', // Κλειδί για να έχουν ακριβώς το ίδιο ύψος
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>
          Live thermostats
        </h3>
        <span style={{
          backgroundColor: '#dcfce7',
          color: '#166534',
          padding: '0.2rem 0.75rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '600'
        }}>
          {onlineCount}/{totalCount} online
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
              <th style={{ padding: '0.5rem 0.5rem', fontWeight: '500' }}>Device</th>
              <th style={{ padding: '0.5rem 0.5rem', fontWeight: '500' }}>Reading</th>
              <th style={{ padding: '0.5rem 0.5rem', fontWeight: '500' }}>Trend</th>
              <th style={{ padding: '0.5rem 0.5rem', fontWeight: '500', textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t, idx) => {
              const isHigh    = t.highTemp;
              const isOffline = t.status === 'offline';   // no sensor bound to this apartment
              const isStale   = t.status === 'stale';     // sensor exists but hasn't reported recently

              return (
                <tr key={t.id || idx} style={{
                  borderBottom: '1px solid #f1f5f9',
                  backgroundColor: isHigh ? '#fef2f2' : 'transparent',
                  opacity: (isOffline || isStale) ? 0.6 : 1,
                }}>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ fontWeight: '500', color: isHigh ? '#991b1b' : '#1e293b' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: isHigh ? '#b91c1c' : '#64748b' }}>
                      {t.subtitle}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500', color: isHigh ? '#dc2626' : (isOffline ? '#94a3b8' : '#1e293b') }}>
                    {t.reading}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', width: '70px' }}>
                    {isOffline ? null : isHigh ? (
                      <svg width="50" height="16" viewBox="0 0 50 16" fill="none">
                        <path d="M2 14L15 10L28 12L48 2" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="50" height="16" viewBox="0 0 50 16" fill="none">
                        <path d="M2 12L15 6L28 9L48 4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                    {isOffline ? (
                      <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>
                        NO SENSOR
                      </span>
                    ) : isStale ? (
                      <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>
                        STALE
                      </span>
                    ) : isHigh ? (
                      <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700' }}>
                        HIGH TEMP
                      </span>
                    ) : (
                      <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '600' }}>
                        online
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Link */}
      <div style={{ marginTop: 'auto', paddingTop: '1rem', textAlign: 'right' }}>
        <a href="#manage-valves" style={{ color: '#2563eb', fontSize: '0.875rem', textDecoration: 'none', fontWeight: '500' }}>
          Manage setpoints &amp; valves →
        </a>
      </div>
    </div>
  );
}