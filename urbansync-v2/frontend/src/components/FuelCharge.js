import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaHome, FaBuilding, FaFire, FaFileInvoiceDollar, FaCalculator, FaMoneyBillWave, FaHistory, FaCalendarAlt, FaDoorOpen, FaCheck, FaClock } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import ConsumptionHistory from './ConsumptionHistory';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';

function FuelCharge() {
  const [formData, setFormData] = useState({
    apartment: '',
    month: '',
    year: '',
    consumption: '',
  });
  const [apartments, setApartments] = useState([]);
  const [building, setBuilding] = useState(null);
  const [refreshHistory, setRefreshHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const currentYear = new Date().getFullYear();
  const futureYears = 10;
  const years = Array.from({ length: futureYears }, (_, i) => currentYear + i);

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

        const apartmentsResponse = await axios.get(`/api/apartments/building/${fetchedBuilding._id}`);
        setApartments(apartmentsResponse.data);
      }
      setLoading(false);
    } catch (error) {
      console.error(error);
      toast.error('Error loading apartments');
      setLoading(false);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await axios.post('/api/consumption', formData);
      toast.success('Fuel consumption saved successfully!');
      
      // Reset form
      setFormData({
        apartment: formData.apartment, // Keep apartment selected
        month: '',
        year: '',
        consumption: '',
      });
      
      // Force a refresh on the ConsumptionHistory component
      setRefreshHistory(prev => !prev);
    } catch (error) {
      console.error('Error saving fuel charge:', error);
      toast.error('Error saving fuel consumption');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Administrator"
      userRole="Building Administrator"
      dashboardTitle="Fuel Charge"
    >
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaFire style={{ color: '#ef4444' }} />
          Gas Consumption for Apartment
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Record monthly gas consumption for apartments
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
          {/* Form Card */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '0.75rem', 
            padding: '2rem', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            maxWidth: '800px',
            marginBottom: '2rem'
          }}>
            <form onSubmit={handleSubmit}>
              <div className="row">
                {/* Apartment Selection */}
                <div className="col-12 form-group">
                  <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaDoorOpen style={{ color: '#f59e0b' }} />
                    Apartment:
                  </label>
                  <select
                    id="apartment"
                    name="apartment"
                    className="form-control"
                    value={formData.apartment}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select an apartment</option>
                    {apartments.map((apartment) => (
                      <option key={apartment._id} value={apartment._id}>
                        {apartment.name} - Floor {apartment.floor}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month */}
                <div className="col-md-6 form-group">
                  <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaCalendarAlt style={{ color: '#8b5cf6' }} />
                    Month:
                  </label>
                  <select
                    id="month"
                    name="month"
                    className="form-control"
                    value={formData.month}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a month</option>
                    {months.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div className="col-md-6 form-group">
                  <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaCalendarAlt style={{ color: '#8b5cf6' }} />
                    Year:
                  </label>
                  <select
                    id="year"
                    name="year"
                    className="form-control"
                    value={formData.year}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a year</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gas Consumption */}
                <div className="col-12 form-group">
                  <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaFire style={{ color: '#ef4444' }} />
                    Gas Consumption (hours):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    id="consumption"
                    name="consumption"
                    className="form-control"
                    placeholder="Enter consumption hours"
                    value={formData.consumption}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    minWidth: '180px',
                    justifyContent: 'center'
                  }}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <FaCheck /> Save Consumption
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Consumption History */}
          {formData.apartment && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FaClock style={{ color: '#3b82f6' }} />
                Consumption History
              </h3>
              <ConsumptionHistory apartmentId={formData.apartment} refresh={refreshHistory} />
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

export default FuelCharge;
