import React, { useMemo } from 'react';
import { FaTruck } from 'react-icons/fa';

const LOW_PCT   = 20;
const CLEAR_PCT = 30;

function buildChartData(allCons) {
  const today = new Date();
  const hoursByMonth = {};
  allCons.forEach(c => {
    const key = `${c.year}-${String(c.month).padStart(2, '0')}`;
    hoursByMonth[key] = (hoursByMonth[key] || 0) + (c.consumption || 0);
  });
  const peakHours = Math.max(...Object.values(hoursByMonth), 1);

  const points = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const m   = d.getMonth() + 1;
    const y   = d.getFullYear();
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const frac = d.getDate() / daysInMonth;
    const burned = (hoursByMonth[key] || 0) * frac;
    const remaining = Math.max(0, peakHours - burned);
    const levelPct = Math.round((remaining / peakHours) * 100);
    points.push({ label: i === 0 ? 'Today' : `${d.getDate()}/${m}`, pct: levelPct });
  }
  return points;
}

function buildPath(points, W, H, padTop, padBot) {
  if (points.length < 2) return { line: '', area: '' };
  const usableH = H - padTop - padBot;
  const stepX   = W / (points.length - 1);
  const coords  = points.map((p, i) => ({
    x: i * stepX,
    y: padTop + usableH * (1 - p.pct / 100),
  }));
  const lineD = coords.map((c, i) =>
    `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${coords[coords.length-1].x.toFixed(1)},${H} L0,${H} Z`;
  return { line: lineD, area: areaD };
}

export default function FuelTankChart({ allCons = [], pct = 100, daysLeft = null }) {
  const points = useMemo(() => buildChartData(allCons), [allCons]);
  const W = 600; const H = 140; const PAD_TOP = 10; const PAD_BOT = 10;
  const { line, area } = buildPath(points, W, H, PAD_TOP, PAD_BOT);
  const usableH = H - PAD_TOP - PAD_BOT;
  const yLow   = PAD_TOP + usableH * (1 - LOW_PCT   / 100);
  const yClear = PAD_TOP + usableH * (1 - CLEAR_PCT / 100);
  const isLow  = pct <= LOW_PCT;
  const clr    = isLow ? '#f59e0b' : '#10b981';

  return (
    <div style={{
      backgroundColor:'white', borderRadius:'0.75rem',
      padding:'1.25rem 1.5rem',
      boxShadow:'0 1px 3px 0 rgba(0,0,0,0.1)',
      borderLeft:`4px solid ${clr}`,
    }}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.25rem'}}>
        <div>
          <p style={{margin:0,fontSize:'0.85rem',fontWeight:'600',color:'#64748b',textTransform:'uppercase',letterSpacing:'0.5px'}}>
            Fuel tank — last 30 days
          </p>
          <p style={{margin:'0.15rem 0 0',fontSize:'0.75rem',color:'#94a3b8'}}>
            {daysLeft !== null ? `≈ ${daysLeft} days left · Low Fuel threshold 20 %` : 'Low Fuel threshold 20 %'}
          </p>
        </div>
        <span style={{padding:'0.2rem 0.6rem',borderRadius:'0.375rem',
          background:isLow?'#fef3c7':'#d1fae5',color:clr,fontWeight:'700',fontSize:'0.8rem'}}>
          {pct} %
        </span>
      </div>

      {/* SVG Chart */}
      <div style={{width:'100%',overflow:'hidden',margin:'0.75rem 0'}}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          style={{width:'100%',height:'130px',display:'block'}}>
          <defs>
            <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f59e0b" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05"/>
            </linearGradient>
          </defs>
          {area && <path d={area} fill="url(#fuelGrad)"/>}
          {line && <path d={line} fill="none" stroke="#f59e0b" strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round"/>}
          {/* Low Fuel 20% */}
          <line x1="0" y1={yLow} x2={W} y2={yLow}
            stroke="#ef4444" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.7"/>
          <text x={W-4} y={yLow-4} textAnchor="end"
            fill="#ef4444" fontSize="11" fontWeight="600" opacity="0.9">Low Fuel 20%</text>
          {/* Clear 30% */}
          <line x1="0" y1={yClear} x2={W} y2={yClear}
            stroke="#10b981" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.7"/>
          <text x={W-4} y={yClear-4} textAnchor="end"
            fill="#10b981" fontSize="11" fontWeight="600" opacity="0.9">clear 30%</text>
          {/* Dot on last point */}
          {points.length > 0 && (
            <circle
              cx={W}
              cy={PAD_TOP + usableH * (1 - points[points.length-1].pct / 100)}
              r="5" fill="#f59e0b" stroke="white" strokeWidth="2"/>
          )}
        </svg>
      </div>

      {/* Footer */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
        borderTop:'1px solid #f1f5f9',paddingTop:'0.75rem'}}>
        <span style={{display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.8rem',color:'#10b981'}}>
          <span style={{width:'8px',height:'8px',borderRadius:'50%',
            backgroundColor:'#10b981',display:'inline-block'}}/>
          Building Fuel Tank · online
        </span>
        <span style={{fontSize:'0.75rem',color:'#94a3b8'}}>30-day telemetry</span>
      </div>

      {/* Order Fuel button */}
      <button
        style={{width:'100%',marginTop:'0.75rem',padding:'0.6rem',borderRadius:'0.5rem',
          border:'1px solid #e2e8f0',background:'white',cursor:'pointer',
          fontSize:'0.85rem',fontWeight:'500',color:'#475569',
          display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem'}}
        onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
        onMouseLeave={e => e.currentTarget.style.background='white'}
      >
        <FaTruck /> Order fuel
      </button>
    </div>
  );
}
