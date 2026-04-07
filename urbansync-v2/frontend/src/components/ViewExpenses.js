import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaBuilding, FaFire, FaFileInvoiceDollar, FaCalculator, FaMoneyBillWave, FaHistory, FaTrash, FaCalendarAlt, FaEuroSign, FaFileAlt, FaDownload } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import ConfirmModal from './ConfirmModal';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

function ViewExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [stats, setStats] = useState({ total: 0, heating: 0, elevator: 0, other: 0 });

  const navItems = [
    { label: 'Dashboard', path: '/building-administrator', icon: FaHome },
    { label: 'View Building', path: '/building-administrator/view-building', icon: FaBuilding },
    { label: 'Fuel Charge', path: '/building-administrator/fuel-charge', icon: FaFire },
    { label: 'Expenses Charge', path: '/building-administrator/expenses-charge', icon: FaFileInvoiceDollar },
    { label: 'View Expenses', path: '/building-administrator/view-expenses', icon: FaHistory },
    { label: 'Calculate Expenses', path: '/building-administrator/calculate-expenses', icon: FaCalculator },
    { label: 'View Payments', path: '/building-administrator/view-payments', icon: FaMoneyBillWave }
  ];

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  useEffect(() => {
    fetchExpenses();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [expenses]);

  const fetchExpenses = async () => {
    try {
      const token = window.localStorage.getItem('token');
      const response = await axios.get('/api/profile', {
        headers: { Authorization: token },
      });

      if (response.data.userId) {
        const expensesResponse = await axios.get(
          `/api/expenses/${response.data.userId}`
        );
        const fetchedExpenses = expensesResponse.data;
        setExpenses(fetchedExpenses || []);
      }
      setLoading(false);
    } catch (error) {
      console.log(error);
      toast.error('Error fetching expenses');
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const total = expenses.reduce((sum, exp) => sum + exp.total, 0);
    const heating = expenses.filter(e => e.type_expenses === 'Heating').reduce((sum, exp) => sum + exp.total, 0);
    const elevator = expenses.filter(e => e.type_expenses === 'Elevator').reduce((sum, exp) => sum + exp.total, 0);
    const other = expenses.filter(e => e.type_expenses !== 'Heating' && e.type_expenses !== 'Elevator').reduce((sum, exp) => sum + exp.total, 0);
    setStats({ total, heating, elevator, other });
  };

  const handleDeleteClick = (expense) => {
    setSelectedExpense(expense);
    setShowConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;

    try {
      const token = window.localStorage.getItem('token');
      const response = await axios.delete(`/api/expenses/${selectedExpense._id}`, {
        headers: { Authorization: token },
      });

      if (response.status === 200) {
        const updatedExpenses = expenses.filter(expense => expense._id !== selectedExpense._id);
        setExpenses(updatedExpenses);
        toast.success('Expense deleted successfully');
      } else {
        toast.error('Failed to delete expense');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Error deleting expense');
    }

    setShowConfirmModal(false);
    setSelectedExpense(null);
  };

  const handleViewReceipt = async (expense) => {
    try {
      const token = window.localStorage.getItem('token');
      const response = await axios.get(`/api/expenses/${expense._id}/receipt`, {
        headers: { Authorization: token }
      });

      if (response.data.url) {
        // Open receipt in new tab
        window.open(response.data.url, '_blank');
      }
    } catch (error) {
      console.error('Error fetching receipt:', error);
      if (error.response?.status === 404) {
        toast.error('No receipt found for this expense');
      } else {
        toast.error('Error loading receipt');
      }
    }
  };

  const getExpenseTypeIcon = (type) => {
    switch (type) {
      case 'Heating':
        return <FaFire style={{ color: '#ef4444', marginRight: '0.5rem' }} />;
      case 'Elevator':
        return <FaMoneyBillWave style={{ color: '#3b82f6', marginRight: '0.5rem' }} />;
      default:
        return <FaFileInvoiceDollar style={{ color: '#10b981', marginRight: '0.5rem' }} />;
    }
  };

  const getExpenseTypeBadge = (type) => {
    const colors = {
      'Heating': 'badge-danger',
      'Elevator': 'badge-primary',
      'default': 'badge-success'
    };
    return colors[type] || colors['default'];
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Administrator"
      userRole="Building Administrator"
      dashboardTitle="View Expenses"
    >
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaHistory style={{ color: '#8b5cf6' }} />
          View Expenses
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Monitor all building expenses and financial records
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              padding: '1.5rem', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              borderLeft: '4px solid #8b5cf6'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  background: '#ede9fe', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8b5cf6',
                  fontSize: '1.75rem'
                }}>
                  <FaEuroSign />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    Total Expenses
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                    € {stats.total.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              padding: '1.5rem', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              borderLeft: '4px solid #ef4444'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  background: '#fee2e2', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  fontSize: '1.75rem'
                }}>
                  <FaFire />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    Heating
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                    € {stats.heating.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              padding: '1.5rem', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              borderLeft: '4px solid #3b82f6'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  background: '#dbeafe', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3b82f6',
                  fontSize: '1.75rem'
                }}>
                  <FaMoneyBillWave />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    Elevator
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                    € {stats.elevator.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              padding: '1.5rem', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              borderLeft: '4px solid #10b981'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  background: '#d1fae5', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  fontSize: '1.75rem'
                }}>
                  <FaFileInvoiceDollar />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    Other
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                    € {stats.other.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Expenses Table */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem' }}>
              Expenses List ({expenses.length})
            </h3>

            {expenses.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Month</th>
                      <th>Year</th>
                      <th>Receipt</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense._id}>
                        <td>
                          {getExpenseTypeIcon(expense.type_expenses)}
                          <span className={`badge ${getExpenseTypeBadge(expense.type_expenses)}`}>
                            {expense.type_expenses}
                          </span>
                        </td>
                        <td style={{ fontWeight: '600', color: '#1e293b' }}>
                          € {expense.total.toFixed(2)}
                        </td>
                        <td>
                          <FaCalendarAlt style={{ marginRight: '0.5rem', color: '#64748b', fontSize: '0.875rem' }} />
                          {new Date(expense.date_created).toLocaleDateString()}
                        </td>
                        <td>{months.find(month => month.value === expense.month)?.label}</td>
                        <td>{expense.year}</td>
                        <td>
                          {expense.document ? (
                            <button 
                              className="btn btn-sm btn-info" 
                              onClick={() => handleViewReceipt(expense)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                              <FaFileAlt /> View
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No receipt</span>
                          )}
                        </td>
                        <td>
                          <button 
                            className="btn btn-sm btn-danger" 
                            onClick={() => handleDeleteClick(expense)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <FaTrash /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <FaFileInvoiceDollar style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }} />
                <h3 style={{ marginBottom: '0.5rem' }}>No Expenses Found</h3>
                <p>Add expenses to see them here</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        show={showConfirmModal}
        title="Delete Expense"
        message={`Are you sure you want to delete this ${selectedExpense?.type_expenses} expense of € ${selectedExpense?.total.toFixed(2)}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowConfirmModal(false);
          setSelectedExpense(null);
        }}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </DashboardLayout>
  );
}

export default ViewExpenses;
