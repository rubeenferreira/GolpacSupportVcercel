import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { DeviceList } from './components/DeviceList';
import { AIAnalyst } from './components/AIAnalyst';
import { AuthPage } from './components/AuthPage';
import { Device, ViewState } from './types';
import { MOCK_DEVICES } from './constants';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation of fetching data from Vercel backend
  useEffect(() => {
    // Only fetch data if the user is authenticated
    if (!isAuthenticated) return;

    const fetchDevices = async () => {
      // In a real app, this would be: await fetch('/api/devices');
      // Here we simulate network delay
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      setDevices(MOCK_DEVICES);
      setLoading(false);
    };

    fetchDevices();
  }, [isAuthenticated]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setDevices([]);
  };

  // If not authenticated, show the Portal Page
  if (!isAuthenticated) {
    return <AuthPage onLogin={handleLogin} />;
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 animate-in fade-in duration-700">
           <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
           <p className="animate-pulse font-medium">Synchronizing Fleet Data...</p>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard devices={devices} />;
      case 'devices':
        return <DeviceList devices={devices} />;
      case 'ai-insights':
        return <AIAnalyst devices={devices} />;
      default:
        return <div className="p-10 text-center">Settings view placeholder</div>;
    }
  };

  return (
    <Layout currentView={currentView} onChangeView={setCurrentView}>
      <div className="h-full flex flex-col">
        <div className="mb-6 animate-in slide-in-from-top-4 duration-500">
           <h1 className="text-2xl font-bold text-slate-800">
             {currentView === 'dashboard' && 'Dashboard Overview'}
             {currentView === 'devices' && 'Device Management'}
             {currentView === 'ai-insights' && 'AI Fleet Analyst'}
           </h1>
           <p className="text-slate-500">
             {currentView === 'dashboard' && 'Real-time metrics for your application deployments.'}
             {currentView === 'devices' && 'View and manage all computers with the Golpac app installed.'}
             {currentView === 'ai-insights' && 'Leverage Gemini models to analyze fleet health and generate reports.'}
           </p>
        </div>
        <div className="flex-1 min-h-0">
            {renderContent()}
        </div>
      </div>
    </Layout>
  );
};

export default App;