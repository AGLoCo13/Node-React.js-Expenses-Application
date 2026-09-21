import React from 'react';

/**
 * ExpenseMixChart
 * Donut chart showing expense breakdown for the current month.
 *
 * Props:
 *   heating    — number (€)
 *   elevator   — number (€)
 *   general    — number (€)
 *   reserve    — string | number | null  (building reserve fund)
 *   monthLabel — string (e.g. "SEP 2026")
 */

const COLORS = {
  Heating:  '#f59e0b',
  General:  '#3b82f6',
  Elevator: '#10b981',
};

const fmt = (n) =>
  `€ ${Number(n).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Build SVG arc path for a donut slice
function describeArc(cx, cy, r, startAngle, endAngle) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export default function ExpenseMixChart({ heating = 0, elevator = 0, general = 0, reserve = null, monthLabel = '' }) {
  const total = heating + elevator + general;

  const slices = [
    { label: 'Heating',  value: heating,  color: COLORS.Heating  },
    { label: 'General',  value: general,  color: COLORS.General  },
    { label: 'Elevator', value: elevator, color: COLORS.Elevator },
  ].filter(s => s.value > 0);

  // SVG donut
  const cx = 70; const cy = 70; const R = 52; const thickness = 18;
  const innerR = R - thickness;

  let currentAngle = -90; // start from top

  const arcs = slices.map(s => {
    const pct   = total > 0 ? s.value / total : 0;
    const sweep = pct * 360;
    const start = currentAngle;
    const end   = currentAngle + sweep - 0.5; // small gap between slices
    currentAngle += sweep;
    return { ...s, pct: Math.round(pct * 100), start, end, sweep };
  });

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius:    '0.75rem',
      padding:         '1.25rem 1.5rem',
      boxShadow:       '0 1px 3px 0 rgba(0,0,0,0.1)',
      borderLeft:      '4px solid #8b5cf6',
      display:         'flex',
      flexDirection:   'column',
      justifyContent:  'space-between',
      height:          '100%',           
      boxSizing:       'border-box'      
    }}>
      {/* Title */}
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '600',
        color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Expense mix · {monthLabel}
      </p>

      {/* Chart + Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, flexWrap: 'wrap' }}>

        {/* Donut SVG — responsive: scales with container */}
        <svg viewBox="0 0 140 140" style={{ flexShrink: 0, width: 'clamp(90px, 20vw, 140px)', height: 'auto' }}>
          {total === 0 ? (
            // Empty ring
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
          ) : (
            arcs.map((arc, i) => (
              arc.sweep > 0.5 && (
                <path
                  key={i}
                  d={describeArc(cx, cy, R, arc.start, arc.end)}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                />
              )
            ))
          )}
          {/* Centre text */}
          <text x={cx} y={cy - 8} textAnchor="middle"
            fill="#94a3b8" fontSize="9" fontWeight="600" letterSpacing="0.5">
            TOTAL
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle"
            fill="#1e293b" fontSize="11" fontWeight="700">
            {total > 0 ? fmt(total) : '€ 0,00'}
          </text>
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
          {slices.map((s, i) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  backgroundColor: s.color, flexShrink: 0,
                }} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', fontWeight: '500' }}>
                    {s.label} ({pct} %)
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                    {fmt(s.value)}
                  </p>
                </div>
              </div>
            );
          })}
          {slices.length === 0 && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>No expenses this month</p>
          )}
        </div>
      </div>

      {/* Reserve fund footer — always shown, € 0,00 when no reserve data */}
      <div style={{
        marginTop:    '0.75rem',
        borderTop:    '1px solid #f1f5f9',
        paddingTop:   '0.75rem',
        display:      'flex',
        justifyContent: 'space-between',
        alignItems:   'center',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', fontWeight: '600' }}>
            Reserve fund balance
          </p>
          <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
            Law 3741 compliant
          </p>
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>
          {reserve !== null && reserve !== undefined ? fmt(Number(reserve)) : '€ 0,00'}
        </span>
      </div>
    </div>
  );
}
