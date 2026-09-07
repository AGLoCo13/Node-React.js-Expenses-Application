import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaBuilding, FaFire, FaFileInvoiceDollar, FaCalculator, FaMoneyBillWave, FaHistory } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import StatsCard from './StatsCard';
import AlarmsNotificationsCard from './AlarmsNotificationsCard';

// ── helpers ───────────────────────────────────────────────────────────────────
const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const fmt = (n) =>
  `€ ${Number(n).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function BuildingAdministratorDashboard() {
  const [userData,     setUserData]     = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [expenseStats, setExpenseStats] = useState({
    totalHeating: 0, totalElevator: 0, totalGeneral: 0, prevTotal: 0,
  });
  const [paymentStats, setPaymentStats] = useState({
    paid: 0, pending: 0, outstandingAmt: 0,
  });
  const [fuelStats, setFuelStats] = useState({
    pct:      0,    // 0-100 — % καυσίμου που απομένει
    daysLeft: null, // εκτιμώμενες μέρες που απομένουν
    isLow:    false,
  });

  // ── date helpers ──────────────────────────────────────────────────────────
  const now      = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();
  const curLabel = `${MONTH_ABBR[curMonth - 1]} ${curYear}`;

  const prevDate  = new Date(curYear, curMonth - 2, 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear  = prevDate.getFullYear();
  const prevLabel = MONTH_ABBR[prevMonth - 1];

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const token   = window.localStorage.getItem('token');
        const headers = { Authorization: token };

        // 1. Profile
        const profileRes = await axios.get('/api/profile', { headers });
        const profile    = profileRes.data;
        setUserData(profile);
        const profileId  = profile.profileId;

        // 2. Expenses
        const expensesRes = await axios.get(`/api/expenses/${profileId}`, { headers });
        const allExpenses = expensesRes.data || [];

        const curExp  = allExpenses.filter(e => e.month === curMonth && e.year === curYear);
        const prevExp = allExpenses.filter(e => e.month === prevMonth && e.year === prevYear);

        const sumType = (arr, t) =>
          arr.filter(e => e.type_expenses === t).reduce((s, e) => s + (e.total || 0), 0);

        setExpenseStats({
          totalHeating:  sumType(curExp, 'Heating'),
          totalElevator: sumType(curExp, 'Elevator'),
          totalGeneral:  sumType(curExp, 'General'),
          prevTotal:     prevExp.reduce((s, e) => s + (e.total || 0), 0),
        });

        // 3. Building → Apartments → Payments
        try {
          const buildingRes = await axios.get(`/api/buildings/${profileId}`, { headers });
          const aptsRes     = await axios.get(`/api/apartments/building/${buildingRes.data._id}`, { headers });
          const apartments  = Array.isArray(aptsRes.data) ? aptsRes.data : [];

          const paymentsByApt = await Promise.all(
            apartments.map(apt =>
              axios.get(`/api/payments/${apt._id}`, { headers }).catch(() => ({ data: [] }))
            )
          );

          const allPay = paymentsByApt
            .flatMap(r => (Array.isArray(r.data) ? r.data : []))
            .filter(p => p.month === curMonth && p.year === curYear);

          const paid    = allPay.filter(p =>  p.payment_made).length;
          const pending = allPay.filter(p => !p.payment_made).length;
          const outstandingAmt = allPay
            .filter(p => !p.payment_made)
            .reduce((s, p) => s + (p.total_heating || 0) + (p.total_elevator || 0) + (p.total_general || 0), 0);

          setPaymentStats({ paid, pending, outstandingAmt });

          // 4. Consumptions — όλα τα ιστορικά δεδομένα για fuel tank υπολογισμό
          const consumptionsByApt = await Promise.all(
            apartments.map(apt =>
              axios.get(`/api/consumptions/${apt._id}`, { headers }).catch(() => ({ data: [] }))
            )
          );

          // Flat list όλων των consumption εγγραφών
          const allCons = consumptionsByApt.flatMap(r =>
            Array.isArray(r.data) ? r.data : []
          );

          // Ώρες τρέχοντος μήνα (όλα τα apartments)
          const curMonthHours = allCons
            .filter(c => c.month === curMonth && c.year === curYear)
            .reduce((s, c) => s + (c.consumption || 0), 0);

          // Μέγιστες ώρες που έχουν καταγραφεί σε οποιοδήποτε μήνα (historical peak)
          // → αυτό αντιπροσωπεύει την "πλήρη δεξαμενή" σε ώρες
          const hoursByMonth = {};
          allCons.forEach(c => {
            const key = `${c.year}-${c.month}`;
            hoursByMonth[key] = (hoursByMonth[key] || 0) + (c.consumption || 0);
          });
          const monthlyTotals = Object.values(hoursByMonth);
          const peakHours = monthlyTotals.length > 0
            ? Math.max(...monthlyTotals)
            : 0;

          // % που απομένει = (peak - curMonth) / peak × 100
          // Αν δεν υπάρχουν ιστορικά δεδομένα → 100% (άγνωστο, θεωρούμε γεμάτο)
          let pct = 100;
          if (peakHours > 0) {
            const remaining = Math.max(0, peakHours - curMonthHours);
            pct = Math.round((remaining / peakHours) * 100);
          }

          // Μέση ημερήσια κατανάλωση (από ιστορικό — h/day)
          // Παίρνουμε τους τελευταίους 3 μήνες με δεδομένα
          const sortedMonths = Object.keys(hoursByMonth).sort().slice(-3);
          const avgMonthlyHours = sortedMonths.length > 0
            ? sortedMonths.reduce((s, k) => s + hoursByMonth[k], 0) / sortedMonths.length
            : 0;
          const avgDailyHours = avgMonthlyHours / 30;

          // Days left = ώρες που απομένουν ÷ μέση ημερήσια κατανάλωση
          const remainingHours = peakHours > 0
            ? Math.max(0, peakHours - curMonthHours)
            : 0;
          const daysLeft = avgDailyHours > 0
            ? Math.round(remainingHours / avgDailyHours)
            : null;

          const LOW_FUEL_THRESHOLD = 20;
          setFuelStats({
            pct,
            daysLeft,
            isLow: pct <= LOW_FUEL_THRESHOLD,
          });

        } catch (payErr) {
          console.error('Error fetching payments/consumptions:', payErr);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── derived values ────────────────────────────────────────────────────────
  const totalCur  = expenseStats.totalHeating + expenseStats.totalElevator + expenseStats.totalGeneral;
  const totalPrev = expenseStats.prevTotal;
  const trendPct  = totalPrev > 0
    ? (((totalCur - totalPrev) / totalPrev) * 100).toFixed(1)
    : null;
  const trendType  = trendPct !== null ? (parseFloat(trendPct) >= 0 ? 'up' : 'down') : 'up';
  const trendLabel = trendPct !== null ? `${Math.abs(trendPct)}% vs ${prevLabel}` : `— vs ${prevLabel}`;

  const totalPayments = paymentStats.paid + paymentStats.pending;
  const paidPct       = totalPayments > 0 ? Math.round((paymentStats.paid    / totalPayments) * 100) : 0;
  const pendingPct    = totalPayments > 0 ? Math.round((paymentStats.pending / totalPayments) * 100) : 0;

  const navItems = [
    { label: 'Dashboard',         path: '/building-administrator',                    icon: FaHome },
    { label: 'View Building',      path: '/building-administrator/view-building',      icon: FaBuilding },
    { label: 'Fuel Charge',        path: '/building-administrator/fuel-charge',        icon: FaFire },
    { label: 'Expenses Charge',    path: '/building-administrator/expenses-charge',    icon: FaFileInvoiceDollar },
    { label: 'View Expenses',      path: '/building-administrator/view-expenses',      icon: FaHistory },
    { label: 'Calculate Expenses', path: '/building-administrator/calculate-expenses', icon: FaCalculator },
    { label: 'View Payments',      path: '/building-administrator/view-payments',      icon: FaMoneyBillWave },
  ];

  return (
    <DashboardLayout
      navItems={navItems}
      userName={userData?.name || "Administrator"}
      userRole="Building Administrator"
      dashboardTitle="Building Administrator"
    >
      <div className="welcome-section" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
          Welcome, {userData?.name || "Building Administrator"}!
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Manage your building's expenses, track payments, and calculate monthly charges.
        </p>
      </div>

      <div className="stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
      }}>
        {/* ── Total Expenses ── */}
        <StatsCard
          title="Total Expenses"
          subtitle={curLabel}
          value={loading ? '—' : fmt(totalCur)}
          icon={FaFileInvoiceDollar}
          color="orange"
          trend={{ type: trendType, value: trendLabel }}
          breakdown={[
            { label: 'Heat', value: loading ? '—' : fmt(expenseStats.totalHeating) },
            { label: 'Elev', value: loading ? '—' : fmt(expenseStats.totalElevator) },
            { label: 'Gen',  value: loading ? '—' : fmt(expenseStats.totalGeneral) },
          ]}
        />

        {/* ── Pending Payments ── */}
        <StatsCard
          title="Pending Payments"
          value={loading ? '—' : `${paymentStats.paid} / ${totalPayments}`}
          icon={FaMoneyBillWave}
          color="red"
          subvalue={loading ? '' : `${fmt(paymentStats.outstandingAmt)} outstanding`}
          progressBar={{
            left:       paidPct,
            leftLabel:  `${paymentStats.paid} Paid (${paidPct}%)`,
            rightLabel: `${paymentStats.pending} Pending (${pendingPct}%)`,
          }}
        />

        {/* ── This Month ── */}
        <StatsCard
          title="This Month"
          subtitle={curLabel}
          value={loading ? '—' : fmt(totalCur)}
          icon={FaCalculator}
          color="blue"
          trend={{ type: trendType, value: trendLabel }}
          breakdown={[
            { label: 'Heat', value: loading ? '—' : fmt(expenseStats.totalHeating) },
            { label: 'Elev', value: loading ? '—' : fmt(expenseStats.totalElevator) },
            { label: 'Gen',  value: loading ? '—' : fmt(expenseStats.totalGeneral) },
          ]}
        />

        {/* ── Fuel Tank ── */}
        <StatsCard
          title="Fuel Tank"
          value={loading ? '—' : `${fuelStats.pct} %`}
          color={fuelStats.isLow ? 'orange' : 'green'}
          gauge={loading ? 100 : fuelStats.pct}
          gaugeWarning={20}
          subvalue={
            loading ? '' :
            fuelStats.daysLeft !== null
              ? `≈ ${fuelStats.daysLeft} days left · Low Fuel at 20 %`
              : 'Low Fuel at 20 %'
          }
          subvalueColor={fuelStats.isLow ? 'warning' : 'neutral'}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <AlarmsNotificationsCard />
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
            href="/building-administrator/expenses-charge" 
            className="btn btn-primary" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaFileInvoiceDollar style={{ marginRight: '0.5rem' }} />
            Charge Expenses
          </a>
          <a 
            href="/building-administrator/calculate-expenses" 
            className="btn btn-success" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaCalculator style={{ marginRight: '0.5rem' }} />
            Calculate Expenses
          </a>
          <a 
            href="/building-administrator/view-payments" 
            className="btn btn-warning" 
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

export default BuildingAdministratorDashboard;
