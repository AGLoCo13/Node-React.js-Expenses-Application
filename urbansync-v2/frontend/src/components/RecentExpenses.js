import React from 'react';
import { FaPlus, FaPaperclip, FaEye, FaEdit } from 'react-icons/fa';

const fmt = (n) => 
  `€ ${Number(n).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RecentExpensesTable({ expenses = [], curMonth, curYear }) {
  return (
    <div style={{ marginBottom: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1, // Γεμίζει όλο το διαθέσιμο ύψος
            boxSizing: 'border-box'
        }}>
            
        {/* Header Πλαισίου */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e293b', margin: '0 0 0.25rem 0' }}>
              Recent expenses
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
              {expenses.length} transactions logged
            </p>
          </div>
          <button style={{
            backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.375rem',
            padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '500', display: 'flex',
            alignItems: 'center', gap: '0.4rem', cursor: 'pointer'
          }}>
            <FaPlus /> Charge expense
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>Date</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>Type</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>Description</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: '500', textAlign: 'center' }}>Receipt</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: '500', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: '500', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
                    No expenses logged yet.
                  </td>
                </tr>
              ) : (
                expenses.map((exp, idx) => {
                  const typeColors = exp.type_expenses === 'Heating' ? { bg: '#fef3c7', text: '#d97706' }
                    : exp.type_expenses === 'Elevator' ? { bg: '#dbeafe', text: '#2563eb' }
                    : { bg: '#f1f5f9', text: '#475569' }; 

                  const displayDate = exp.date ? new Date(exp.date).toLocaleDateString('el-GR')
                    : `01/${String(exp.month || curMonth).padStart(2, '0')}/${exp.year || curYear}`;

                  return (
                    <tr key={exp._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#64748b' }}>{displayDate}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{
                          backgroundColor: typeColors.bg, color: typeColors.text,
                          padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '500'
                        }}>
                          {exp.type_expenses || 'General'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#1e293b' }}>
                        {exp.description || 'Έξοδο κοινοχρήστων'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#94a3b8' }}>
                        {exp.receiptUrl || exp.hasReceipt ? <FaPaperclip style={{ color: '#3b82f6', cursor: 'pointer' }}/> : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '600', color: '#1e293b' }}>
                        {fmt(exp.total || 0)}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', color: '#94a3b8' }}>
                          <FaEye style={{ cursor: 'pointer' }} title="View" />
                          <FaEdit style={{ cursor: 'pointer' }} title="Edit" />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer (Link) */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', textAlign: 'right' }}>
          <a href="/building-administrator/view-expenses" style={{ color: '#2563eb', fontSize: '0.875rem', textDecoration: 'none', fontWeight: '500' }}>
            Full expenses audit log →
          </a>
        </div>
      </div>
    </div>
  );
}