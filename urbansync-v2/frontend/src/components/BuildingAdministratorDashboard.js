import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaHome, FaBuilding, FaFire, FaFileInvoiceDollar, FaCalculator, FaMoneyBillWave, FaHistory, FaThermometerHalf, FaGasPump, FaCheck, FaPlus, FaPaperclip, FaEye, FaEdit } from 'react-icons/fa';import DashboardLayout from './DashboardLayout';
import StatsCard from './StatsCard';
import FuelTankChart from './FuelTankChart';
import ExpenseMixChart from './ExpenseMixChart';
import RecentExpensesTable from './RecentExpenses';
import LiveThermostatsCard from './LiveThermostatsCard';

// ── helpers ───────────────────────────────────────────────────────────────────
const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const fmt = (n) =>
  `€ ${Number(n).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Convert a timestamp to a human-readable "X h ago" / "X d ago" string
function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

// Extract a numeric temperature value from a notification message or thingsboardData
function extractTemp(n) {
  if (n.thingsboardData?.value !== undefined) return parseFloat(n.thingsboardData.value);
  const m = (n.message || '').match(/([\d.]+)\s*°?C/);
  return m ? parseFloat(m[1]) : null;
}

// Icon per notification type
function NotifIcon({ type }) {
  const style = { marginRight: '0.5rem', flexShrink: 0 };
  if (type === 'low_fuel')        return <FaGasPump        style={{ ...style, color: '#ef4444' }} />;
  if (type === 'high_temperature') return <FaThermometerHalf style={{ ...style, color: '#f59e0b' }} />;
  return <FaThermometerHalf style={{ ...style, color: '#64748b' }} />;
}

function BuildingAdministratorDashboard() {
  const [userData,     setUserData]     = useState(null);
  const [loading,      setLoading]      = useState(true);

  const [buildingInfo, setBuildingInfo] = useState(null);

  const [expenseStats, setExpenseStats] = useState({
    totalHeating: 0, totalElevator: 0, totalGeneral: 0, prevTotal: 0,
  });
  const [paymentStats, setPaymentStats] = useState({
    paid: 0, pending: 0, outstandingAmt: 0,
  });
  const [fuelStats, setFuelStats] = useState({
    pct:      0,
    daysLeft: null,
    isLow:    false,
    allCons:  [],   // raw consumption records for chart
  });
  const [notifStats, setNotifStats] = useState({
    notifications: [],
    unreadCount:   0,
    avgTemp:       null,   // μέση θερμοκρασία από high_temperature alarms
    tempAlarmCount: 0,     // πλήθος temperature alarms
    worstTempMsg:  null,   // message του πιο πρόσφατου temperature alarm
  });

  const [thermostatsData, setThermostatsData] = useState([]);

  const [recentExpenses, setRecentExpenses] = useState([]);
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
        setRecentExpenses(allExpenses.slice(0, 4));

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
          
          setBuildingInfo({
            address: buildingRes.data.address || 'Διεύθυνση Μη Διαθέσιμη',
            apartments: apartments.length,
            floors: buildingRes.data.floors || '-'
          });

          const mappedThermostats = apartments.map((apt, index) => {
            // Αν υπάρχει κάποιο alarm θερμοκρασίας για αυτό το διαμέρισμα
            const tempAlarm = notifStats.notifications?.find(n => n.type === 'high_temperature' && n.message?.includes(apt.name));
            const isHigh = !!tempAlarm;
            
            return {
              id: apt._id || index,
              name: `${apt.name} Thermostat`,
              subtitle: `${apt.floor ? `Floor ${apt.floor}` : 'Apartment'} · ${apt.number || ''}`,
              reading: isHigh ? '29,1 °C' : `${(21 + (index * 0.7)).toFixed(1)} °C`,
              status: isHigh ? 'high_temp' : 'online',
              highTemp: isHigh,
            };
          });
          setThermostatsData(mappedThermostats);

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
            isLow:   pct <= LOW_FUEL_THRESHOLD,
            allCons, // pass raw records to chart
          });

        } catch (payErr) {
          console.error('Error fetching payments/consumptions:', payErr);
        }

        // 5. Notifications
        try {
          const notifRes = await axios.get('/api/notifications?limit=50', { headers });
          const notifs   = notifRes.data.notifications || [];
          const unread   = notifRes.data.unreadCount   || 0;

          // Extract temperature readings from high_temperature alarms
          const tempAlarms = notifs.filter(n => n.type === 'high_temperature');
          const temps      = tempAlarms.map(extractTemp).filter(v => v !== null);
          const avgTemp    = temps.length > 0
            ? (temps.reduce((s, t) => s + t, 0) / temps.length).toFixed(1)
            : null;

          setNotifStats({
            notifications:  notifs,
            unreadCount:    unread,
            avgTemp,
            tempAlarmCount: tempAlarms.length,
            worstTempMsg:   tempAlarms.length > 0 ? tempAlarms[0].message : null,
          });
        } catch (nErr) {
          console.error('Error fetching notifications:', nErr);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark all unread notifications as read ────────────────────────────────
  const markAllRead = useCallback(async () => {
    const token   = window.localStorage.getItem('token');
    const headers = { Authorization: token };
    const unread  = notifStats.notifications.filter(n => !n.isRead);
    await Promise.all(
      unread.map(n =>
        axios.patch(`/api/notifications/${n._id}/read`, {}, { headers }).catch(() => {})
      )
    );
    setNotifStats(prev => ({
      ...prev,
      unreadCount:   0,
      notifications: prev.notifications.map(n => ({ ...n, isRead: true })),
    }));
  }, [notifStats.notifications]);

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
      buildingInfo={buildingInfo}
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

        {/* ── Avg. Temperature ── */}
        <StatsCard
          title="Avg. Temperature"
          value={loading ? '—' : notifStats.avgTemp ? `${notifStats.avgTemp} °C` : 'N/A'}
          icon={FaThermometerHalf}
          color="green"
          badge={notifStats.tempAlarmCount > 0 ? `${notifStats.tempAlarmCount} ALARM${notifStats.tempAlarmCount > 1 ? 'S' : ''}` : null}
          subvalue={
            loading ? '' :
            notifStats.worstTempMsg
              ? notifStats.worstTempMsg
              : 'Nominal avg'
          }
          subvalueColor={notifStats.tempAlarmCount > 0 ? 'warning' : 'neutral'}
        />
      </div>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', /* Αυτόματα: 2 στήλες αν χωράνε, αλλιώς 1 κάτω από την άλλη */
        gap: '1.5rem',
        marginBottom: '1.5rem',
        alignItems: 'stretch'
      }}>

        {/* Fuel Tank Chart */}
       <div style={{ display: 'flex', flexDirection: 'column' }}>
            <FuelTankChart
              allCons={fuelStats.allCons}
              pct={fuelStats.pct}
              daysLeft={fuelStats.daysLeft}
            />
       </div>

       {/* Expense Mix Donut Chart */}   
       <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ExpenseMixChart
            heating={expenseStats.totalHeating || 0}
            elevator={expenseStats.totalElevator || 0}
            general={expenseStats.totalGeneral || 0}
            monthLabel={curLabel || 'THIS MONTH'}
            reserve={0} /* Αν έχεις μεταβλητή για το αποθεματικό στο state σου, αντικατέστησε το 0 με αυτήν */
          />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem',
        alignItems: 'stretch'
      }}>

        {/* Recent Expenses */}
        <RecentExpensesTable 
          expenses={recentExpenses} 
          curMonth={curMonth} 
          curYear={curYear} 
        />

        {/* Live Thermostats */}
        <LiveThermostatsCard />
      </div>

      {/* Alarms & Notifications panel */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)',
        marginBottom: '1.5rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>
            Alarms &amp; notifications
          </h3>
          {notifStats.unreadCount > 0 && (
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
          )}
        </div>

        {/* List */}
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {notifStats.notifications.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem 0', margin: 0 }}>
              No notifications
            </p>
          ) : (
            notifStats.notifications.map(n => (
              <div key={n._id} style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '0.75rem 0',
                borderBottom: '1px solid #f1f5f9',
                borderLeft: `3px solid ${n.isRead ? '#e2e8f0' : '#ef4444'}`,
                paddingLeft: '0.75rem',
                marginBottom: '0.25rem',
              }}>
                <NotifIcon type={n.type} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e293b', fontWeight: n.isRead ? 400 : 500 }}>
                    {n.message}
                  </p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                    {timeAgo(n.timestamp)} · {n.isRead ? 'read' : 'unread'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifStats.unreadCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button
              onClick={markAllRead}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#2563eb',
                fontSize: '0.875rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <FaCheck /> Mark all read
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default BuildingAdministratorDashboard;

