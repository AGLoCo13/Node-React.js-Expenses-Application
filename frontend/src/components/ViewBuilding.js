import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaBuilding, FaFire, FaFileInvoiceDollar, FaCalculator, FaMoneyBillWave, FaHistory, FaLayerGroup, FaDoorOpen, FaPiggyBank, FaRulerCombined, FaUser } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

function ViewBuilding() {
  const [building, setBuilding] = useState(null);
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const navItems = [
    { label: 'Dashboard', path: '/building-administrator', icon: FaHome },
    { label: 'View Building', path: '/building-administrator/view-building', icon: FaBuilding },
    { label: 'Fuel Charge', path: '/building-administrator/fuel-charge', icon: FaFire },
    { label: 'Expenses Charge', path: '/building-administrator/expenses-charge', icon: FaFileInvoiceDollar },
    { label: 'View Expenses', path: '/building-administrator/view-expenses', icon: FaHistory },
    { label: 'Calculate Expenses', path: '/building-administrator/calculate-expenses', icon: FaCalculator },
    { label: 'View Payments', path: '/building-administrator/view-payments', icon: FaMoneyBillWave }
  ];

  useEffect(() => {
    fetchBuildingAndApartments();
  }, []);

  const fetchBuildingAndApartments = async () => {
    try {
      const token = window.localStorage.getItem('token');
      const response = await axios.get('/api/profile', {
        headers: { Authorization: token },
      });

      if (response.data.profileId) {
        const buildingResponse = await axios.get(
          `/api/buildings/${response.data.profileId}`
        );
        const fetchedBuilding = buildingResponse.data;
        setBuilding(fetchedBuilding);

        // Try to fetch apartments - handle if endpoint doesn't exist
        try {
          const apartmentsResponse = await axios.get(
            `/api/apartments/building/${fetchedBuilding._id}`
          );
          // Backend returns array directly, not nested in object
          setApartments(Array.isArray(apartmentsResponse.data) ? apartmentsResponse.data : []);
        } catch (aptError) {
          console.log('Could not fetch apartments:', aptError);
          setApartments([]);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error(error);
      toast.error('Error fetching building data');
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Administrator"
      userRole="Building Administrator"
      dashboardTitle="View Building"
    >
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaBuilding style={{ color: '#10b981' }} />
          Your Building
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          View your building information and apartment details
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      ) : building ? (
        <>
          {/* Building Stats Grid */}
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
              borderLeft: '4px solid #2563eb'
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
                  color: '#2563eb',
                  fontSize: '1.75rem'
                }}>
                  <FaBuilding />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    Address
                  </p>
                  <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '0' }}>
                    {building.address}
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
                  <FaLayerGroup />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    Floors
                  </p>
                  <p style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                    {building.floors}
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
                  <FaDoorOpen />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    Apartments
                  </p>
                  <p style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0' }}>
                    {building.apartments}
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
                  <FaPiggyBank />
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    Reserve
                  </p>
                  <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '0' }}>
                    € {building.reserve}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Apartments Section */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FaDoorOpen style={{ color: '#f59e0b' }} />
              Apartments ({apartments.length})
            </h3>
            
            {apartments.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead style={{ backgroundColor: '#f8fafc' }}>
                    <tr>
                      <th>Name</th>
                      <th>Floor</th>
                      <th>Square Meters</th>
                      <th>Tenant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apartments.map((apartment) => (
                      <tr key={apartment._id}>
                        <td style={{ fontWeight: '500' }}>
                          <FaDoorOpen style={{ marginRight: '0.5rem', color: '#f59e0b' }} />
                          {apartment.name}
                        </td>
                        <td>
                          <span className="badge badge-info">
                            Floor {apartment.floor}
                          </span>
                        </td>
                        <td>
                          <FaRulerCombined style={{ marginRight: '0.5rem', color: '#64748b' }} />
                          {apartment.square_meters} m²
                        </td>
                        <td>
                          <FaUser style={{ marginRight: '0.5rem', color: '#64748b' }} />
                          {apartment.tenant?.user?.name || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <FaDoorOpen style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
                <p>No apartments found in this building</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '0.75rem', 
          padding: '3rem', 
          textAlign: 'center',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }}>
          <FaBuilding style={{ fontSize: '4rem', color: '#e2e8f0', marginBottom: '1rem' }} />
          <h3 style={{ color: '#64748b', marginBottom: '0.5rem' }}>No Building Assigned</h3>
          <p style={{ color: '#94a3b8' }}>Please contact your administrator</p>
        </div>
      )}
    </DashboardLayout>
  );
}

export default ViewBuilding;
