import React, { useState } from 'react';
import { useSocket } from './hooks/useSocket';
import CustomerView from './components/CustomerView';
import CourierView from './components/CourierView';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('customer');
  const { socket, connected } = useSocket();

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <i className="fas fa-pizza-slice"></i>
            Food Delivery Tracker
          </div>
          
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${currentView === 'customer' ? 'active' : ''}`}
              onClick={() => setCurrentView('customer')}
            >
              <i className="fas fa-user"></i>
              Customer View
            </button>
            <button 
              className={`toggle-btn ${currentView === 'courier' ? 'active' : ''}`}
              onClick={() => setCurrentView('courier')}
            >
              <i className="fas fa-motorcycle"></i>
              Courier View
            </button>
          </div>

          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            <div className="connection-indicator"></div>
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </header>

      <main className="main-content">
        {currentView === 'customer' ? (
          <CustomerView socket={socket} connected={connected} />
        ) : (
          <CourierView socket={socket} connected={connected} />
        )}
      </main>
    </div>
  );
}

export default App;