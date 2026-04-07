import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { FaHome, FaBuilding, FaFire, FaFileInvoiceDollar, FaCalculator, FaMoneyBillWave, FaHistory, FaDoorOpen, FaArrowUp, FaBriefcase, FaCheck } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import ConfirmModal from './ConfirmModal';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

function CalculateExpenses() {
  const [data, setData] = useState({
    apartments: [],
    consumptions: [],
    building: {},
    expenses: [],
    total: {
      heating: 0.0,
      elevator: 0.0,
      general: 0.0,
    },
  });
  const [apartmentExpenses, setApartmentExpenses] = useState({});
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [totals, setTotals] = useState({ heating: 0, elevator: 0, general: 0 });

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
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = window.localStorage.getItem('token');
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const profileResponse = await axios.get('/api/profile', {
        headers: { Authorization: token },
      });

      if (profileResponse.data.profileId || profileResponse.data.userId) {
        const buildingId = profileResponse.data.profileId;
        const userId = profileResponse.data.userId;

        const [buildingResponse, expensesResponse] = await Promise.all([
          axios.get(`/api/buildings/${buildingId}`),
          axios.get(`/api/expenses/${userId}`),
        ]);

        const fetchedBuilding = buildingResponse.data;

        const apartmentsResponse = await axios.get(`/api/apartments/building/${fetchedBuilding._id}`);
        const apartmentsData = Array.isArray(apartmentsResponse.data) ? apartmentsResponse.data : [];

        const allConsumptionsResponses = await Promise.all(
          apartmentsData.map((apartment) =>
            axios.get(`/api/consumptions/${apartment._id}`).catch(() => ({ data: [] }))
          )
        );

        const allConsumptions = allConsumptionsResponses.flatMap(response => response.data);

        const thisMonthExpenses = expensesResponse.data.filter(expenses => {
          return expenses.month === month && expenses.year === year;
        });

        const newState = {
          apartments: apartmentsData,
          building: buildingResponse.data,
          expenses: thisMonthExpenses,
          consumptions: allConsumptions,
        };

        setData(newState);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading expense data');
      setLoading(false);
    }
  };

  // Calculate expenses using Presidential Decree 1985 formulas
  useMemo(() => {
    const totalHeating = data.expenses.filter(e => e.type_expenses === 'Heating').reduce((acc, curr) => acc + curr.total, 0);
    const totalElevator = data.expenses.filter(e => e.type_expenses === 'Elevator').reduce((acc, curr) => acc + curr.total, 0);
    const totalGeneral = data.expenses.filter(e => e.type_expenses === 'General').reduce((acc, curr) => acc + curr.total, 0);

    setTotals({ heating: totalHeating, elevator: totalElevator, general: totalGeneral });

    const calculatedApartmentExpenses = {};

    // **ΘΕΡΜΑΝΣΗ - Presidential Decree 1985**
    // Formula: [(ei × Wi) / Σ(ei × Wi)] × 70% × P + [(fi × ei) / Σ(fi × ei)] × 30% × P
    
    // Calculate sum of ei × Wi for all apartments (variable part)
    const sumEiWi = data.apartments.reduce((sum, apt) => {
      const Wi = data.consumptions.find(c => c.apartment._id === apt._id)?.consumption || 0;
      const ei = apt.ei || 0;
      return sum + (ei * Wi);
    }, 0);

    // Calculate sum of fi × ei for all apartments (fixed part)
    const sumFiEi = data.apartments.reduce((sum, apt) => {
      const fi = apt.fi || 0;
      const ei = apt.ei || 0;
      return sum + (fi * ei);
    }, 0);

    // Calculate heating for each apartment
    data.apartments.forEach(apartment => {
      const Wi = data.consumptions.find(c => c.apartment._id === apartment._id)?.consumption || 0;
      const ei = apartment.ei || 0;
      const fi = apartment.fi || 0;

      // 70% variable (based on consumption)
      const variablePart = sumEiWi > 0 ? ((ei * Wi) / sumEiWi) * 0.70 * totalHeating : 0;
      
      // 30% fixed (based on position and volume)
      const fixedPart = sumFiEi > 0 ? ((fi * ei) / sumFiEi) * 0.30 * totalHeating : 0;

      const heatingCost = variablePart + fixedPart;

      // **ΑΣΑΝΣΕΡ - Proportional to floor number**
      // Calculate sum of floors (only for apartments above ground)
      const totalFloors = data.apartments
        .filter(apt => apt.floor > 0)
        .reduce((sum, apt) => sum + apt.floor, 0);

      const elevatorShare = apartment.floor > 0 && totalFloors > 0
        ? (apartment.floor / totalFloors) * totalElevator 
        : 0;

      // **ΓΕΝΙΚΑ ΕΞΟΔΑ - Based on square meters**
      const totalSquareMeters = data.apartments.reduce((sum, apt) => sum + (apt.square_meters || 0), 0);
      const generalShare = totalSquareMeters > 0 
        ? ((apartment.square_meters || 0) / totalSquareMeters) * totalGeneral 
        : 0;

      calculatedApartmentExpenses[apartment._id] = {
        heating: heatingCost,
        elevator: elevatorShare,
        general: generalShare,
      };
    });

    setApartmentExpenses(calculatedApartmentExpenses);
  }, [data]);

  const handleCreatePaymentClick = (apartment) => {
    setSelectedApartment(apartment);
    setShowConfirmModal(true);
  };

  const handleCreatePayment = async () => {
    if (!selectedApartment) return;

    const token = window.localStorage.getItem('token');
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    try {
      const existingPaymentsResponse = await axios.get(`/api/payments/${selectedApartment._id}`, {
        headers: { Authorization: token },
      });

      const existingPaymentForCurrentMonth = existingPaymentsResponse.data.find(
        payment => payment.month === month && payment.year === year
      );

      if (existingPaymentForCurrentMonth) {
        await axios.delete(`/api/payments/${existingPaymentForCurrentMonth._id}`, {
          headers: { Authorization: token },
        });
      }
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        console.error('Error checking for existing payments', error);
        toast.error('Error checking existing payments');
        return;
      }
    }

    try {
      const paymentData = {
        apartment: selectedApartment._id,
        month: month,
        year: year,
        total_heating: apartmentExpenses[selectedApartment._id]?.heating || 0,
        total_elevator: apartmentExpenses[selectedApartment._id]?.elevator || 0,
        total_general: apartmentExpenses[selectedApartment._id]?.general || 0,
        payment_made: false,
      };

      const response = await axios.post('/api/payments', paymentData, {
        headers: { Authorization: token },
      });

      if (response.status === 200) {
        toast.success(`Payment created for ${selectedApartment.name}`);
      } else {
        toast.error('Failed to create payment');
      }
    } catch (error) {
      console.error('Error creating payment', error);
      toast.error('Error creating payment');
    }

    setShowConfirmModal(false);
    setSelectedApartment(null);
  };

  const getTotalForApartment = (apartmentId) => {
    const expenses = apartmentExpenses[apartmentId];
    if (!expenses) return 0;
    return expenses.heating + expenses.elevator + expenses.general;
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Administrator"
      userRole="Building Administrator"
      dashboardTitle="Calculate Expenses"
    >
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaCalculator style={{ color: '#2563eb' }} />
          Calculate Expenses
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Calculate and distribute expenses across all apartments (Presidential Decree 1985)
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
          {/* Totals Stats */}
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
                    € {totals.heating.toFixed(2)}
                  </p>
                  <small className="text-muted">70% variable + 30% fixed</small>
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
                    € {totals.elevator.toFixed(2)}
                  </p>
                  <small className="text-muted">Proportional to floor number</small>
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
                    € {totals.general.toFixed(2)}
                  </p>
                  <small className="text-muted">By square meters</small>
                </div>
              </div>
            </div>
          </div>

          {/* Apartments Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '1.5rem'
          }}>
            {data.apartments.map((apartment) => (
              <div key={apartment._id} style={{ 
                backgroundColor: 'white', 
                borderRadius: '0.75rem', 
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                overflow: 'hidden',
                transition: 'all 0.3s ease'
              }}>
                {/* Card Header */}
                <div style={{ 
                  background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                  padding: '1rem 1.5rem',
                  color: 'white'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FaDoorOpen style={{ fontSize: '1.5rem' }} />
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {apartment.name}
                      </h3>
                      <p style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0' }}>
                        Floor {apartment.floor} • {apartment.square_meters}m² • ei: {apartment.ei} • fi: {apartment.fi}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaFire style={{ color: '#ef4444' }} />
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Heating (70%+30%)</span>
                      </div>
                      <span style={{ fontWeight: '600', color: '#1e293b' }}>
                        € {apartmentExpenses[apartment._id]?.heating.toFixed(2) || '0.00'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaArrowUp style={{ color: '#3b82f6' }} />
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Elevator</span>
                      </div>
                      <span style={{ fontWeight: '600', color: '#1e293b' }}>
                        € {apartmentExpenses[apartment._id]?.elevator.toFixed(2) || '0.00'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaBriefcase style={{ color: '#10b981' }} />
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>General</span>
                      </div>
                      <span style={{ fontWeight: '600', color: '#1e293b' }}>
                        € {apartmentExpenses[apartment._id]?.general.toFixed(2) || '0.00'}
                      </span>
                    </div>

                    <div style={{ 
                      borderTop: '2px solid #e2e8f0', 
                      paddingTop: '1rem', 
                      marginTop: '0.5rem',
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '1rem' }}>Total</span>
                      <span style={{ fontWeight: '700', color: '#2563eb', fontSize: '1.25rem' }}>
                        € {getTotalForApartment(apartment._id).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button 
                    className="btn btn-success"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => handleCreatePaymentClick(apartment)}
                  >
                    <FaCheck /> Create Payment
                  </button>
                </div>
              </div>
            ))}
          </div>

          {data.apartments.length === 0 && (
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              padding: '3rem', 
              textAlign: 'center',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
            }}>
              <FaDoorOpen style={{ fontSize: '4rem', color: '#e2e8f0', marginBottom: '1rem' }} />
              <h3 style={{ color: '#64748b', marginBottom: '0.5rem' }}>No Apartments Found</h3>
              <p style={{ color: '#94a3b8' }}>Add apartments to calculate expenses</p>
            </div>
          )}
        </>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        show={showConfirmModal}
        title="Create Payment"
        message={`Are you sure you want to create payment for ${selectedApartment?.name}? Total amount: € ${selectedApartment ? getTotalForApartment(selectedApartment._id).toFixed(2) : '0.00'}`}
        onConfirm={handleCreatePayment}
        onCancel={() => {
          setShowConfirmModal(false);
          setSelectedApartment(null);
        }}
        confirmText="Create Payment"
        cancelText="Cancel"
        type="success"
      />
    </DashboardLayout>
  );
}

export default CalculateExpenses;
