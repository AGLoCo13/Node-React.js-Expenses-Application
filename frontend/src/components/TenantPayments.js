import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaUser, FaDoorOpen, FaMoneyBillWave, FaFire, FaArrowUp, FaBriefcase, FaEuroSign, FaCheckCircle, FaClock } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

function TenantPayments() {
  const [apartmentData, setApartmentData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [tenantPayments, setTenantPayments] = useState(null);
  const [loading, setLoading] = useState(true);

  const navItems = [
    { label: 'Dashboard', path: '/tenant-dashboard', icon: FaHome },
    { label: 'View Profile', path: '/tenant-dashboard/view-page', icon: FaUser },
    { label: 'My Payments', path: '/tenant-dashboard/view-payments', icon: FaDoorOpen }
  ];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    fetchUserApartmentPaymentsData();
  }, []);

  const fetchUserApartmentPaymentsData = async () => {
    try {
      const token = window.localStorage.getItem('token');
      const response = await axios.get('/api/profile', {
        headers: { Authorization: `${token}` },
      });
      setUserData(response.data);

      const apartmentResponse = await axios.get(`/api/apartment/${response.data.profileId}`, {
        headers: { Authorization: `${token}` },
      });
      setApartmentData(apartmentResponse.data);

      const paymentResponse = await axios.get(`/api/payments/${apartmentResponse.data._id}`);
      setTenantPayments(paymentResponse.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Error loading payment data');
      setLoading(false);
    }
  };

  const getTotalCosts = (payments) => {
    let totalHeating = 0;
    let totalElevator = 0;
    let totalGeneral = 0;

    payments.forEach(payment => {
      totalHeating += payment.total_heating;
      totalElevator += payment.total_elevator;
      totalGeneral += payment.total_general;
    });

    return {
      totalHeating,
      totalElevator,
      totalGeneral,
      grandTotal: totalHeating + totalElevator + totalGeneral
    };
  };

  const totals = tenantPayments && tenantPayments.length > 0 ? getTotalCosts(tenantPayments) : null;

  return (
    <DashboardLayout
      navItems={navItems}
      userName={userData?.name || "Tenant"}
      userRole="Tenant"
      dashboardTitle="My Payments"
    >
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaMoneyBillWave style={{ color: '#10b981' }} />
          Your Payments
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          View your payment history and apartment expenses
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
          {totals && (
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
                      Total Heating
                    </p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                      € {totals.totalHeating.toFixed(2)}
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
                    <FaArrowUp />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                      Total Elevator
                    </p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                      € {totals.totalElevator.toFixed(2)}
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
                    <FaBriefcase />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                      Total General
                    </p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                      € {totals.totalGeneral.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

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
                      Grand Total
                    </p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                      € {totals.grandTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payments Table */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem' }}>
              Payment History ({tenantPayments ? tenantPayments.length : 0})
            </h3>

            {tenantPayments && tenantPayments.length > 0 ? (
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
                    </tr>
                  </thead>
                  <tbody>
                    {tenantPayments.map(payment => (
                      <tr key={payment._id}>
                        <td>
                          <FaDoorOpen style={{ marginRight: '0.5rem', color: '#f59e0b' }} />
                          <strong>{apartmentData?.name}</strong>
                        </td>
                        <td>
                          {months[payment.month - 1]} {payment.year}
                        </td>
                        <td>€ {payment.total_heating.toFixed(2)}</td>
                        <td>€ {payment.total_elevator.toFixed(2)}</td>
                        <td>€ {payment.total_general.toFixed(2)}</td>
                        <td style={{ fontWeight: '600', color: '#1e293b' }}>
                          € {(payment.total_heating + payment.total_elevator + payment.total_general).toFixed(2)}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <FaMoneyBillWave style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }} />
                <h3 style={{ marginBottom: '0.5rem' }}>No Payments Found</h3>
                <p>You don't have any payments yet</p>
              </div>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

export default TenantPayments;
