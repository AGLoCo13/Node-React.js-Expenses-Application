import React from 'react';
import '../css/statsCard.css';

/**
 * StatsCard — reusable stat card component.
 *
 * Props:
 *  title       — card label (uppercase)
 *  subtitle    — small text appended to title (e.g. "· SEP 2026")
 *  value       — main large value (e.g. "€ 2.184,60" or "5 / 12")
 *  icon        — react-icon component
 *  color       — "orange" | "red" | "blue" | "green" | "purple"
 *  trend       — { type: "up"|"down", value: "12,4% vs Aug" }
 *  subvalue    — small text below value
 *  subvalueColor — "red" (default) | "neutral" | "warning"
 *  progressBar — { left: 0-100, rightLabel: "5 Pending (42%)", leftLabel: "7 Paid (58%)" }
 *  breakdown   — [{ label: "Heat", value: "€ 0" }, ...]
 *  gauge       — 0-100 number — shows a circular SVG gauge instead of icon
 *  gaugeWarning — threshold below which gauge turns orange (default 20)
 */

// ── Circular SVG Gauge ────────────────────────────────────────────────────────
const CircularGauge = ({ pct = 0, warning = 20 }) => {
  const r       = 22;                        // radius
  const circ    = 2 * Math.PI * r;           // circumference
  const filled  = ((100 - pct) / 100) * circ; // stroke-dashoffset trick
  const isLow   = pct <= warning;
  const color   = isLow ? '#f59e0b' : '#10b981';

  return (
    <div className="stats-gauge-wrap">
      <svg width="56" height="56" viewBox="0 0 56 56">
        {/* background track */}
        <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        {/* filled arc */}
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={filled}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {/* centre label */}
      <span className="stats-gauge-label" style={{ color }}>{pct}%</span>
    </div>
  );
};

const StatsCard = ({
  title,
  subtitle,
  value,
  icon: Icon,
  color = 'blue',
  trend,
  subvalue,
  subvalueColor = 'red',
  progressBar,
  breakdown,
  gauge,
  gaugeWarning = 20,
}) => {
  return (
    <div className={`stats-card stats-card-${color}`}>
      {/* ── Top row: info + icon/gauge ── */}
      <div className="stats-card-content">
        <div className="stats-info">
          <p className="stats-title">
            {title}
            {subtitle && <span className="stats-subtitle"> · {subtitle}</span>}
          </p>
          <h3 className="stats-value">{value}</h3>

          {trend && (
            <p className={`stats-trend ${trend.type}`}>
              {trend.type === 'up' ? '▲' : '▼'} {trend.value}
            </p>
          )}

          {subvalue && (
            <p className={`stats-subvalue stats-subvalue-${subvalueColor}`}>{subvalue}</p>
          )}
        </div>

        {/* gauge takes priority over icon when provided */}
        {gauge !== undefined ? (
          <CircularGauge pct={gauge} warning={gaugeWarning} />
        ) : Icon ? (
          <div className="stats-icon">
            <Icon />
          </div>
        ) : null}
      </div>

      {/* ── Progress bar ── */}
      {progressBar && (
        <div className="stats-progress-wrap">
          <div className="stats-progress-bar">
            <div
              className="stats-progress-left"
              style={{ width: `${progressBar.left}%` }}
            />
          </div>
          <div className="stats-progress-labels">
            {progressBar.leftLabel && (
              <span className="stats-progress-label-left">{progressBar.leftLabel}</span>
            )}
            {progressBar.rightLabel && (
              <span className="stats-progress-label-right">{progressBar.rightLabel}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Breakdown row ── */}
      {breakdown && breakdown.length > 0 && (
        <div className="stats-breakdown">
          {breakdown.map((item, idx) => (
            <span key={idx} className="stats-breakdown-item">
              <span className="stats-breakdown-label">{item.label}</span>
              <span className="stats-breakdown-value">{item.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatsCard;
