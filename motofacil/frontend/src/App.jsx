import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(!!localStorage.getItem('motofacil_admin_token'));
  }, []);

  function handleLogout() {
    localStorage.removeItem('motofacil_admin_token');
    setAuthenticated(false);
  }

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}
