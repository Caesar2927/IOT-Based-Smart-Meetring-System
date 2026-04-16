import React, { useState, useEffect, useRef } from 'react';
import Gauge from './Gauge';

function HomeStats({ ws, onViewRoom }) {
  const [homeData, setHomeData] = useState({
    voltage: 0,
    current: 0,
    power: 0,
    pf: 0,
    energy: 0,
    cost: 0,
  });

  const [roomsStatus, setRoomsStatus] = useState({
    room1: 'OFFLINE',
    room2: 'OFFLINE',
  });

  const wsRef = useRef(ws);

  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'status') {
          setRoomsStatus((prev) => ({
            ...prev,
            [data.esp]: data.status,
          }));
        }

        if (data.type === 'data') {
          // Aggregate data from both rooms for home stats
          setHomeData((prev) => {
            let newData = { ...prev };

            // Simple aggregation - you can modify based on your actual data structure
            if (data.esp === 'room1' || data.esp === 'room2') {
              // Update with latest data
              newData = {
                voltage: data.voltage || prev.voltage,
                current: data.current || prev.current,
                power: (prev.power || 0) + (data.power || 0),
                pf: data.pf || prev.pf,
                energy: (prev.energy || 0) + (data.energy || 0),
                cost: (prev.cost || 0) + (data.cost || 0),
              };
            }

            return newData;
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket data:', error);
      }
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.addEventListener('message', handleMessage);

      return () => {
        if (wsRef.current) {
          wsRef.current.removeEventListener('message', handleMessage);
        }
      };
    }
  }, []);

  return (
    <div className="home-container">
      {/* Home Stats Card */}
      <div className="card">
        <h2>🏠 Home Stats</h2>

        <Gauge power={homeData.power} />

        <div className="value">
          <p>⚡ <b>Voltage:</b> {homeData.voltage.toFixed(1)} V</p>
          <p>🔌 <b>Current:</b> {homeData.current.toFixed(2)} A</p>
          <p>💡 <b>Power:</b> {homeData.power.toFixed(1)} W</p>
          <p>📊 <b>Power Factor:</b> {homeData.pf.toFixed(2)}</p>
          <p>🔋 <b>Energy:</b> {homeData.energy.toFixed(3)} kWh</p>
          <p>💰 <b>Cost:</b> ₹{homeData.cost.toFixed(2)}</p>
        </div>

        <div className="footer">Web Dashboard</div>
      </div>

      {/* Room Cards Below */}
      <div className="rooms-row">
        {/* Room 1 Card */}
        <div className="card">
          <h2>Room 1</h2>
          <p className={`status ${roomsStatus.room1 === 'ONLINE' ? 'online' : 'offline'}`}>
            {roomsStatus.room1}
          </p>
          <button className="btn-view" onClick={() => onViewRoom('room1')}>
            📊 View Details
          </button>
          <div className="footer">⏱ {new Date().toLocaleTimeString()}</div>
        </div>

        {/* Room 2 Card */}
        <div className="card">
          <h2>Room 2</h2>
          <p className={`status ${roomsStatus.room2 === 'ONLINE' ? 'online' : 'offline'}`}>
            {roomsStatus.room2}
          </p>
          <button className="btn-view" onClick={() => onViewRoom('room2')}>
            📊 View Details
          </button>
          <div className="footer">⏱ {new Date().toLocaleTimeString()}</div>
        </div>
      </div>
    </div>
  );
}

export default HomeStats;
