import React, { useState, useEffect } from 'react';
import './App.css';
import HomeStats from './components/HomeStats';
import RoomStats from './components/RoomStats';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // Connect to WebSocket
    const websocket = new WebSocket('ws://10.156.8.8:8080');

    websocket.onopen = () => {
      console.log('✅ WebSocket Connected');
      setWs(websocket);
    };

    websocket.onerror = (error) => {
      console.error('❌ WebSocket Error:', error);
    };

    websocket.onclose = () => {
      console.log('⚠️ WebSocket Disconnected');
    };

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, []);

  const handleViewRoom = (room) => {
    setSelectedRoom(room);
    setCurrentView('room');
  };

  const handleBackHome = () => {
    setCurrentView('home');
    setSelectedRoom(null);
  };

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <header>
        <h1>⚡ Smart Energy Dashboard</h1>
        <button className="toggle-btn" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>

      <main>
        {currentView === 'home' ? (
          <HomeStats 
            ws={ws} 
            onViewRoom={handleViewRoom}
          />
        ) : (
          <RoomStats 
            ws={ws} 
            room={selectedRoom}
            onBack={handleBackHome}
          />
        )}
      </main>
    </div>
  );
}

export default App;
