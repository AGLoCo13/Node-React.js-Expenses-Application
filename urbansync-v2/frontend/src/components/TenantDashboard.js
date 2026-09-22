import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaInfoCircle, FaMoneyBillWave, FaThermometerHalf } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import StatsCard from './StatsCard';

function TenantDashboard() {
  const [userData, setUserData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buildingInfo, setBuildingInfo] = useState(null);
  const [apartmentTemp, setApartmentTemp] = useState(null);
  const [apartmentId, setApartmentId] = useState(null);

  const navItems = [
    { label: 'Dashboard', path: '/tenant-dashboard', icon: FaHome },
    { label: 'View Information', path: '/tenant-dashboard/view-page', icon: FaInfoCircle },
    { label: 'View Payments', path: '/tenant-dashboard/view-payments', icon: FaMoneyBillWave }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = window.localStorage.getItem('token');
        
        // Fetch user profile
        const profileResponse = await axios.get('/api/profile', {
          headers: { Authorization: `${token}` }
        });
        setUserData(profileResponse.data);

        // Fetch apartment
        const apartmentResponse = await axios.get(`/api/apartment/${profileResponse.data.profileId}`, {
          headers: { Authorization: `${token}` }
        });

        // Keep the apartment id for the live telemetry poll below. The endpoint may
        // answer with a bare document or a single-element array, so normalise here.
        const aptDoc = Array.isArray(apartmentResponse.data)
          ? apartmentResponse.data[0]
          : apartmentResponse.data;
        setApartmentId(aptDoc?._id || null);

        // Fetch Building Info from apartment data
        try {
          const aptData = Array.isArray(apartmentResponse.data)
            ? apartmentResponse.data[0]
            : apartmentResponse.data;

          // building field may be a populated object or a bare ObjectId string
          const buildingId = aptData?.building?._id || aptData?.building;

          if (buildingId) {
            const [allBuildingsRes, aptsRes] = await Promise.all([
              axios.get('/api/buildings', { headers: { Authorization: `${token}` } }),
              axios.get(`/api/apartments/building/${buildingId}`, { headers: { Authorization: `${token}` } }),
            ]);

            const building = (allBuildingsRes.data || []).find(
              b => b._id === buildingId || b._id?.toString() === buildingId?.toString()
            );

            setBuildingInfo({
              address:    building?.address || 'Unknown address',
              apartments: Array.isArray(aptsRes.data) ? aptsRes.data.length : (building?.apartments || '-'),
              floors:     building?.floors || '-',
            });
          }
        } catch (err) {
          console.error('Could not fetch building info for tenant:', err);
        }

        // Fetch payments
        const paymentsResponse = await axios.get(`/api/payments/${apartmentResponse.data._id}`);
        setPayments(paymentsResponse.data);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Live apartment temperature. The backend proxies ThingsBoard at
  // GET /api/apartments/:id/telemetry/temperature and answers either
  // { available: true, value, ts } or { available: false } when the apartment
  // has no thermostat device or the reading is missing. Polled on the same 7s
  // cadence the rest of the dashboard uses, so the card tracks the sensor live.
  useEffect(() => {
    if (!apartmentId) return undefined;
    let cancelled = false;

    const fetchTemperature = async () => {
      try {
        const token = window.localStorage.getItem('token');
        const { data } = await axios.get(
          `/api/apartments/${apartmentId}/telemetry/temperature`,
          { headers: { Authorization: `${token}` } }
        );
        if (cancelled) return;
        setApartmentTemp(
          data && data.available && data.value !== undefined && data.value !== null
            ? Number(data.value).toFixed(1)
            : null
        );
      } catch (err) {
        // Telemetry is a best-effort extra: never break the dashboard over it.
        if (!cancelled) setApartmentTemp(null);
      }
    };

    fetchTemperature();
    const timer = setInterval(fetchTemperature, 7000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [apartmentId]);

  // Calculate stats
  const calculateStats = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    let pendingBalance = 0;
    let paidThisMonth = 0;
    let pendingCount = 0;

    payments.forEach(payment => {
      const total = payment.total_heating + payment.total_elevator + payment.total_general;
      
      if (!payment.payment_made) {
        pendingBalance += total;
        pendingCount++;
      } else if (payment.month === currentMonth && payment.year === currentYear) {
        paidThisMonth += total;
      }
    });

    return { pendingBalance, paidThisMonth, pendingCount };
  };

  const stats = calculateStats();

  return (
    <DashboardLayout
      navItems={navItems}
      userName={userData?.name || "Tenant"}
      userRole="Tenant"
      dashboardTitle="Tenant Dashboard"
      buildingInfo={buildingInfo}
    >
      <div className="welcome-section" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
          Welcome, {userData?.name || "Tenant"}!
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          View your apartment information and track your payments here.
        </p>
      </div>

      <div className="stats-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <StatsCard
          title="Current Balance"
          value={loading ? "..." : `€ ${stats.pendingBalance.toFixed(2)}`}
          icon={FaMoneyBillWave}
          color="blue"
        />
        <StatsCard
          title="Paid This Month"
          value={loading ? "..." : `€ ${stats.paidThisMonth.toFixed(2)}`}
          icon={FaMoneyBillWave}
          color="green"
        />
        <StatsCard
          title="Pending Payments"
          value={loading ? "..." : stats.pendingCount.toString()}
          icon={FaMoneyBillWave}
          color="orange"
        />

        <StatsCard
          title="Apartment Temperature"
          value={loading ? "..." : apartmentTemp ? `${apartmentTemp} °C` : "N/A"} 
          icon={FaThermometerHalf}
          color="red"
        />
      </div>

      <div className="quick-actions" style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <a 
            href="/tenant-dashboard/view-page" 
            className="btn btn-primary" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaInfoCircle style={{ marginRight: '0.5rem' }} />
            View Information
          </a>
          <a 
            href="/tenant-dashboard/view-payments" 
            className="btn btn-success" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaMoneyBillWave style={{ marginRight: '0.5rem' }} />
            View Payments
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default TenantDashboard;

