import React from 'react';
import '../css/statsCard.css';

const StatsCard = ({ title, value, icon: Icon, color = 'blue', trend }) => {
  return (
    <div className={`stats-card stats-card-${color}`}>
      <div className="stats-card-content">
        <div className="stats-info">
          <p className="stats-title">{title}</p>
          <h3 className="stats-value">{value}</h3>
          {trend && (
            <p className={`stats-trend ${trend.type}`}>
              {trend.type === 'up' ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <div className="stats-icon">
            <Icon />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
