import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaHome, FaBuilding, FaFire, FaFileInvoiceDollar, FaCalculator, FaMoneyBillWave, FaHistory, FaTrash, FaCheck, FaDoorOpen, FaEuroSign, FaCheckCircle, FaClock } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import ConfirmModal from './ConfirmModal';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

function ViewPayment() {
  const [payments, setPayments] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [building, setBuilding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [actionType, setActionType] = useState(''); // 'delete' or 'markPaid'
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, thisMonth: 0 });

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
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [payments]);

  const fetchData = async () => {
    const token = window.localStorage.getItem('token');

    if (!token) {
      console.error('No token found in local storage.');
      toast.error('Authentication required');
      setLoading(false);
      return;
    }

    try {
      const profileResponse = await axios.get(`/api/profile`, {
        headers: { Authorization: token },
      });

      const buildingId = profileResponse.data.profileId;

      const buildingResponse = await axios.get(`/api/buildings/${buildingId}`, {
        headers: { Authorization: token },
      });
      const fetchedBuilding = buildingResponse.data;
      setBuilding(fetchedBuilding);

      const apartmentsResponse = await axios.get(`/aps/Apartments/${fetchedBuilding._id}`, {
        headers: { Authorization: token },
      });
      setApartments(apartmentsResponse.data);

      const allPaymentsPromises = apartmentsResponse.data.map((apartment) =>
        axios.get(`/api/payments/${apartment._id}`, {
          headers: { Authorization: token },
        }).catch(error => {
          console.error(`Error fetching payments for apartment ${apartment._id}:`, error);
          return { data: [] };
        })
      );

      const allPaymentsResponses = await Promise.all(allPaymentsPromises);
      const allPayments = allPaymentsResponses.flatMap(response => response.data);

      setPayments(allPayments);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading payments');
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const total = payments.reduce((sum, p) => sum + p.total_heating + p.total_elevator + p.total_general, 0);
    const paid = payments.filter(p => p.payment_made).reduce((sum, p) => sum + p.total_heating + p.total_elevator + p.total_general, 0);
    const pending = payments.filter(p => !p.payment_made).reduce((sum, p) => sum + p.total_heating + p.total_elevator + p.total_general, 0);
    const thisMonth = payments.filter(p => p.month === currentMonth && p.year === currentYear).reduce((sum, p) => sum + p.total_heating + p.total_elevator + p.total_general, 0);

    setStats({ total, paid, pending, thisMonth });
  };

  const handleActionClick = (payment, action) => {
    setSelectedPayment(payment);
    setActionType(action);
    setShowConfirmModal(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedPayment) return;

    if (actionType === 'delete') {
      await deletePayment(selectedPayment._id);
    } else if (actionType === 'markPaid') {
      await markAsCompleted(selectedPayment._id);
    }

    setShowConfirmModal(false);
    setSelectedPayment(null);
    setActionType('');
  };

  const deletePayment = async (paymentId) => {
    try {
      const token = window.localStorage.getItem('token');
      const response = await axios.delete(`/api/payments/${paymentId}`, {
        headers: { Authorization: token },
      });

      if (response.status === 200) {
        const updatedPayments = payments.filter(payment => payment._id !== paymentId);
        setPayments(updatedPayments);
        toast.success('Payment deleted successfully');
      } else {
        toast.error('Failed to delete payment');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Error deleting payment');
    }
  };

  const markAsCompleted = async (paymentId) => {
    const token = window.localStorage.getItem('token');
    try {
      const response = await axios.put(`/api/payments/${paymentId}`, {}, {
        headers: { Authorization: token }
      });

      setPayments(prevPayments =>
        prevPayments.map(p =>
          p._id === paymentId ? { ...p, payment_made: true } : p
        )
      );
      toast.success('Payment marked as completed');
    } catch (error) {
      console.error('Failed to mark payment as Completed:', error);
      toast.error('Error marking payment as completed');
    }
  };

  const getTotalForPayment = (payment) => {
    return payment.total_heating + payment.total_elevator + payment.total_general;
  };

  const getApartmentName = (apartmentId) => {
    return apartments.find(apt => apt._id === apartmentId)?.name || 'Unknown';
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Administrator"
      userRole="Building Administrator"
      dashboardTitle="View Payments"
    >
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaMoneyBillWave style={{ color: '#10b981' }} />
          View Payments
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Track and manage apartment payments
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
                    Total Payments
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
                  <FaCheckCircle />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    Paid
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                    € {stats.paid.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              padding: '1.5rem', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              borderLeft: '4px solid #f59e0b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  background: '#fef3c7', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f59e0b',
                  fontSize: '1.75rem'
                }}>
                  <FaClock />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    Pending
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                    € {stats.pending.toFixed(2)}
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
                    This Month
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                    € {stats.thisMonth.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payments Table */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem' }}>
              Payments List ({payments.length})
            </h3>

            {payments.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th>Apartment</th>
                      <th>Period</th>
                      <th>Heating</th>
                      <th>Elevator</th>
                      <th>General</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(payment => {
                      const apartmentName = getApartmentName(payment.apartment);

                      return (
                        <tr key={payment._id}>
                          <td>
                            <FaDoorOpen style={{ marginRight: '0.5rem', color: '#f59e0b' }} />
                            <strong>{apartmentName}</strong>
                          </td>
                          <td>
                            {months[payment.month - 1]} {payment.year}
                          </td>
                          <td>€ {payment.total_heating.toFixed(2)}</td>
                          <td>€ {payment.total_elevator.toFixed(2)}</td>
                          <td>€ {payment.total_general.toFixed(2)}</td>
                          <td style={{ fontWeight: '600', color: '#1e293b' }}>
                            € {getTotalForPayment(payment).toFixed(2)}
                          </td>
                          <td>
                            {payment.payment_made ? (
                              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>
                                <FaCheckCircle /> Paid
                              </span>
                            ) : (
                              <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>
                                <FaClock /> Pending
                              </span>
                            )}
                          </td>
                          <td>
                            {payment.payment_made ? (
                              <button
                                onClick={() => handleActionClick(payment, 'delete')}
                                className="btn btn-sm btn-danger"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                              >
                                <FaTrash /> Delete
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActionClick(payment, 'markPaid')}
                                className="btn btn-sm btn-success"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                              >
                                <FaCheck /> Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <FaMoneyBillWave style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }} />
                <h3 style={{ marginBottom: '0.5rem' }}>No Payments Found</h3>
                <p>Create payments from Calculate Expenses page</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        show={showConfirmModal}
        title={actionType === 'delete' ? 'Delete Payment' : 'Mark Payment as Paid'}
        message={
          actionType === 'delete'
            ? `Are you sure you want to delete payment for ${selectedPayment ? getApartmentName(selectedPayment.apartment) : ''}? This action cannot be undone.`
            : `Confirm that tenant has paid € ${selectedPayment ? getTotalForPayment(selectedPayment).toFixed(2) : '0.00'} for ${selectedPayment ? getApartmentName(selectedPayment.apartment) : ''}?`
        }
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setShowConfirmModal(false);
          setSelectedPayment(null);
          setActionType('');
        }}
        confirmText={actionType === 'delete' ? 'Delete' : 'Mark as Paid'}
        cancelText="Cancel"
        type={actionType === 'delete' ? 'danger' : 'success'}
      />
    </DashboardLayout>
  );
}

export default ViewPayment;
