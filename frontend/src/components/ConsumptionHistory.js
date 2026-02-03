import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaFire, FaCalendarAlt, FaDoorOpen } from 'react-icons/fa';
import 'bootstrap/dist/css/bootstrap.min.css';

function ConsumptionHistory({ apartmentId, refresh }) {
  const [consumptions, setConsumptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  useEffect(() => {
    const fetchConsumptions = async () => {
      try {
        const response = await axios.get(`/api/consumptions/${apartmentId}`);
        setConsumptions(response.data);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    fetchConsumptions();
  }, [apartmentId, refresh]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="spinner-border text-primary spinner-border-sm" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>Loading history...</p>
      </div>
    );
  }

  if (consumptions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
        <FaFire style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.3 }} />
        <p style={{ marginBottom: '0', fontSize: '0.95rem' }}>No consumption data available for this apartment.</p>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-hover" style={{ marginBottom: 0 }}>
        <thead style={{ backgroundColor: '#f8fafc' }}>
          <tr>
            <th>
              <FaDoorOpen style={{ marginRight: '0.5rem', color: '#f59e0b' }} />
              Apartment
            </th>
            <th>
              <FaCalendarAlt style={{ marginRight: '0.5rem', color: '#8b5cf6' }} />
              Month
            </th>
            <th>Year</th>
            <th>
              <FaFire style={{ marginRight: '0.5rem', color: '#ef4444' }} />
              Consumption (hours)
            </th>
          </tr>
        </thead>
        <tbody>
          {consumptions.map((consumption) => (
            <tr key={consumption._id}>
              <td style={{ fontWeight: '500' }}>
                {consumption.apartment.name}
              </td>
              <td>
                {months.find(month => month.value === consumption.month)?.label || 'N/A'}
              </td>
              <td>{consumption.year}</td>
              <td>
                <span style={{ 
                  backgroundColor: '#fee2e2', 
                  color: '#ef4444',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontWeight: '600',
                  fontSize: '0.875rem'
                }}>
                  {consumption.consumption} hrs
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ConsumptionHistory;
