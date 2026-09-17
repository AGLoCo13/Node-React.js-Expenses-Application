import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaBuilding, FaFire, FaFileInvoiceDollar, FaCalculator, FaMoneyBillWave, FaHistory, FaThermometerHalf, FaPlus, FaPaperclip, FaEye, FaEdit } from 'react-icons/fa';import DashboardLayout from './DashboardLayout';
import StatsCard from './StatsCard';
import FuelTankChart from './FuelTankChart';
import ExpenseMixChart from './ExpenseMixChart';
import RecentExpensesTable from './RecentExpenses';
import LiveThermostatsCard from './LiveThermostatsCard';
import AlarmsNotificationsCard from './AlarmsNotificationsCard';

// ── helpers ───────────────────────────────────────────────────────────────────
const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const fmt = (n) =>
  `€ ${Number(n).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Live telemetry: how often we poll fuel + thermostats (B4 DoD wants 5-10s).
const TELEMETRY_POLL_MS = 7000;
// A reading older than this is shown as "stale" rather than trusted as current.
const STALE_AFTER_MS = 3 * 60 * 1000; // 3 minutes
// Same thresholds as the A5 ThingsBoard alarm rules, so the card's own
// coloring agrees with the alarms that actually fire.
const HIGH_TEMP_THRESHOLD = 28;
const LOW_FUEL_THRESHOLD  = 20;

// Extract a numeric temperature value from a notification message or thingsboardData
function extractTemp(n) {
  if (n.thingsboardData?.value !== undefined) return parseFloat(n.thingsboardData.value);
  const m = (n.message || '').match(/([\d.]+)\s*°?C/);
  return m ? parseFloat(m[1]) : null;
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
    pct:       0,
    daysLeft:  null,
    isLow:     false,
    allCons:   [],   // raw consumption records for the 30-day trend chart
    available: true, // becomes false once we get a real {available:false} from telemetry
    stale:     false,
  });

  // Apartments of this building — fetched once in fetchAll, then reused by the
  // separate telemetry-polling effect below to hit /telemetry/temperature per apartment.
  const [apartments, setApartments] = useState([]);
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
            _id: buildingRes.data._id,
            address: buildingRes.data.address || 'Διεύθυνση Μη Διαθέσιμη',
            apartments: apartments.length,
            floors: buildingRes.data.floors || '-'
          });

          // Real per-apartment thermostat readings come from a dedicated polling
          // effect below (GET /api/apartments/:id/telemetry/temperature) once this
          // apartments list is in state — no more synthetic placeholder values here.
          setApartments(apartments);

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

          // Note: pct/isLow here are the *historical trend* estimate from
          // consumption records, used only until the first live telemetry
          // poll (below) lands and overwrites them with the real reading.
          setFuelStats(prev => ({
            ...prev,
            pct,
            daysLeft,
            isLow:   pct <= LOW_FUEL_THRESHOLD,
            allCons, // pass raw records to the 30-day trend chart
          }));

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

  // ── Live telemetry: fuel tank + per-apartment thermostats (A7/B4) ─────────
  // Runs on its own short interval, independent of the heavier one-time
  // fetchAll above (expenses/payments/consumptions don't need to be re-polled
  // every few seconds, but sensor readings do). Waits until buildingInfo/
  // apartments are known, then polls every TELEMETRY_POLL_MS.
  //
  // Toasting on CRITICAL is intentionally NOT duplicated here: the backend's
  // A5/A6 alarm pipeline (ThingsBoard rule chain -> RabbitMQ -> Alarm
  // Ingestion Service -> Notification) already raises the canonical
  // low-fuel/high-temp alarm using these exact thresholds, and
  // <AlarmsNotificationsCard/> below already toasts on it. Checking the
  // threshold a second time here, client-side, would just risk a second,
  // slightly-out-of-sync toast for the same event.
  useEffect(() => {
    if (!buildingInfo?._id) return;
    const token   = window.localStorage.getItem('token');
    const headers = { Authorization: token };
    let cancelled = false;

    const pollTelemetry = async () => {
      // Fuel tank (one sensor per building)
      let fuelAvailable = false; // used below for the sidebar device count
      try {
        const res = await axios.get(
          `/api/buildings/${buildingInfo._id}/telemetry/fuel`,
          { headers }
        );
        const { available, value, ts } = res.data;
        fuelAvailable = !!available;
        if (cancelled) return;
        const stale = !!available && (Date.now() - ts) > STALE_AFTER_MS;
        setFuelStats(prev => ({
          ...prev,
          pct:       available ? value : prev.pct,
          isLow:     available ? value <= LOW_FUEL_THRESHOLD : prev.isLow,
          available,
          stale,
        }));
      } catch (err) {
        console.error('[telemetry] fuel poll failed:', err.message);
      }

      // Thermostats (one sensor per apartment, may be missing for some)
      if (apartments.length > 0) {
        const results = await Promise.all(
          apartments.map(apt =>
            axios
              .get(`/api/apartments/${apt._id}/telemetry/temperature`, { headers })
              .then(r => ({ apt, ...r.data }))
              .catch(() => ({ apt, available: false }))
          )
        );
        if (cancelled) return;

        const mapped = results.map(({ apt, available, value, ts }) => {
          const stale  = !!available && (Date.now() - ts) > STALE_AFTER_MS;
          const isHigh = !!available && !stale && value > HIGH_TEMP_THRESHOLD;
          return {
            id:       apt._id,
            name:     `${apt.name} Thermostat`,
            subtitle: `${apt.floor ? `Floor ${apt.floor}` : 'Apartment'} · ${apt.number || ''}`,
            reading:  !available ? 'no sensor' : `${Number(value).toFixed(1)} °C`,
            // Raw numeric reading, kept alongside the formatted string above,
            // so the "Avg. Temperature" stat card below can compute a real
            // live average across online sensors instead of relying on
            // historical high_temperature alarm data (which is empty unless
            // an alarm has actually fired).
            rawValue: available ? Number(value) : null,
            status:   !available ? 'offline' : stale ? 'stale' : isHigh ? 'high_temp' : 'online',
            highTemp: isHigh,
          };
        });
        setThermostatsData(mapped);

        // Bonus: feed the sidebar's already-existing (previously unused)
        // devicesOnline/devicesTotal display with real numbers.
        const onlineDevices = results.filter(r => r.available).length +
          (fuelAvailable ? 1 : 0);
        setBuildingInfo(prev => prev && ({
          ...prev,
          devicesOnline: onlineDevices,
          devicesTotal:  apartments.length + 1, // + the building fuel sensor
        }));
      }
    };

    pollTelemetry();
    const id = setInterval(pollTelemetry, TELEMETRY_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingInfo?._id, apartments]);

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

  // Live average across whatever thermostats are currently online/stale —
  // this is what the "Avg. Temperature" card should show. It replaces the
  // old notifStats.avgTemp (derived only from past high_temperature alarms,
  // which stays null on a quiet building even though sensors are reporting
  // fine right now).
  const liveTemps  = thermostatsData
    .filter(t => t.status !== 'offline' && t.rawValue !== null)
    .map(t => t.rawValue);
  const avgLiveTemp = liveTemps.length > 0
    ? (liveTemps.reduce((s, v) => s + v, 0) / liveTemps.length).toFixed(1)
    : null;

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
          value={loading ? '—' : avgLiveTemp !== null ? `${avgLiveTemp} °C` : 'N/A'}
          icon={FaThermometerHalf}
          color="green"
          badge={notifStats.tempAlarmCount > 0 ? `${notifStats.tempAlarmCount} ALARM${notifStats.tempAlarmCount > 1 ? 'S' : ''}` : null}
          subvalue={
            loading ? '' :
            notifStats.worstTempMsg
              ? notifStats.worstTempMsg
              : avgLiveTemp !== null
                ? 'Nominal avg'
                : 'No thermostats online'
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
              available={fuelStats.available}
              stale={fuelStats.stale}
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
        <LiveThermostatsCard thermostats={thermostatsData} />
      </div>

      {/* Alarms & Notifications — real B5 API + polling + toast-on-critical (B4) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <AlarmsNotificationsCard />
      </div>
    </DashboardLayout>
  );
}

export default BuildingAdministratorDashboard;

