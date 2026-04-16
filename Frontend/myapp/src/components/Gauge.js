import React from 'react';

function Gauge({ power }) {
  const deg = Math.min((power / 5000) * 360, 360); // Assuming max 5000W
  const color = power > 500 ? '#ef4444' : '#22c55e';

  return (
    <div
      className="gauge"
      style={{
        background: `conic-gradient(${color} ${deg}deg, #1e293b ${deg}deg)`,
      }}
    >
      {power.toFixed(0)} W
    </div>
  );
}

export default Gauge;
