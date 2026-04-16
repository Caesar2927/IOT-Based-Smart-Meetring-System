import React, { useState, useEffect, useRef } from 'react';
import Gauge from './Gauge';

function RoomStats({ ws, room, onBack }) {
  const [roomData, setRoomData] = useState({
    voltage: 0,
    current: 0,
    power: 0,
    pf: 0,
    energy: 0,
    cost: 0,
    load: 'Detecting...',
  });

  const [status, setStatus] = useState('OFFLINE');
  const [loads, setLoads] = useState({
    load1: false,
    load2: false,
  });

  const wsRef = useRef(ws);

  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  // Room configuration
  const roomConfig = {
    room1: {
      title: 'Room 1',
      loads: [
        { id: 'load1', on: 'LED ON', off: 'LED OFF' },
        { id: 'load2', on: 'Charger ON', off: 'Charger OFF' },
      ],
    },
    room2: {
      title: 'Room 2',
      loads: [
        { id: 'load1', on: 'Laptop ON', off: 'Laptop OFF' },
        { id: 'load2', on: 'Fan ON', off: 'Fan OFF' },
      ],
    },
  };

  const config = roomConfig[room];

  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'status' && data.esp === room) {
          setStatus(data.status);
        }

        if (data.type === 'data' && data.esp === room) {
          setRoomData({
            voltage: data.voltage || 0,
            current: data.current || 0,
            power: data.power || 0,
            pf: data.pf || 0,
            energy: data.energy || 0,
            cost: data.cost || 0,
            load: data.load || 'Detecting...',
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
  }, [room]);

  const handleControl = (loadId, state) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket not connected!');
      alert('❌ Server not connected! Check console.');
      return;
    }

    const msg = {
      type: 'control',
      esp: room,
      [loadId]: state,
    };

    console.log('📤 Sending:', JSON.stringify(msg));
    wsRef.current.send(JSON.stringify(msg));

    // Update local state
    setLoads((prev) => ({
      ...prev,
      [loadId]: state,
    }));
  };

  return (
    <div className="room-stats-wrapper">
      <button className="btn-back back-button" onClick={onBack}>
        ← Back to Home
      </button>

      <div className="room-container">
        <div className={`card ${roomData.power > 500 ? 'warning' : ''}`}>
          <h2>🏠 {config.title}</h2>
          <p className={`status ${status === 'ONLINE' ? 'online' : 'offline'}`}>
            {status}
          </p>

          <Gauge power={roomData.power} />

          <div className="value">
            <p>⚡ <b>Voltage:</b> {roomData.voltage.toFixed(1)} V</p>
            <p>🔌 <b>Current:</b> {roomData.current.toFixed(2)} A</p>
            <p>💡 <b>Power:</b> {roomData.power.toFixed(1)} W</p>
            <p>📊 <b>Power Factor:</b> {roomData.pf.toFixed(2)}</p>
            <p>🔋 <b>Energy:</b> {roomData.energy.toFixed(3)} kWh</p>
            <p>💰 <b>Cost:</b> ₹{roomData.cost.toFixed(2)}</p>
            <p>🧠 <b>Load:</b> {roomData.load}</p>
          </div>

          {/* Switches */}
          <div className="controls">
            {config.loads.map((load) => (
              <div key={load.id} style={{ display: 'contents' }}>
                <button
                  className="btn-on"
                  onClick={() => handleControl(load.id, true)}
                  disabled={status === 'OFFLINE'}
                >
                  {load.on}
                </button>
                <button
                  className="btn-off"
                  onClick={() => handleControl(load.id, false)}
                  disabled={status === 'OFFLINE'}
                >
                  {load.off}
                </button>
              </div>
            ))}
          </div>

          <div className="footer">⏱ {new Date().toLocaleTimeString()}</div>
        </div>
      </div>
    </div>
  );
}

export default RoomStats;
