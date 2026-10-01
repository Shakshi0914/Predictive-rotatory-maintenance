/**
 * Predictive Maintenance Dashboard for Rotary Machinery using IoT Data.
 * Core React App assembling authentication, live telemetry, ML inference, alerts, and settings.
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { OverviewView } from './components/OverviewView';
import { MachineDetailView } from './components/MachineDetailView';
import { AlertsView } from './components/AlertsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { CodeExplorerView } from './components/CodeExplorerView';

import { getCurrentSession, logoutUser } from './services/authService';
import { iotEngine } from './services/iotSimulation';
import { UserAccount, MachineId, TelemetryReading, AlertRecord, SystemThresholds } from './types';

export default function App() {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [selectedMachineId, setSelectedMachineId] = useState<MachineId>('pump-01');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // IoT Live State
  const [isRunning, setIsRunning] = useState<boolean>(iotEngine.getIsRunning());
  const [latestReadings, setLatestReadings] = useState<TelemetryReading[]>([]);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryReading[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [thresholds, setThresholds] = useState<SystemThresholds>(iotEngine.getThresholds());

  // Check existing session
  useEffect(() => {
    const session = getCurrentSession();
    if (session) {
      setUser(session);
    }
  }, []);

  // Sync theme with HTML class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Subscribe to IoT simulation updates
  useEffect(() => {
    const updateFromEngine = () => {
      setLatestReadings(iotEngine.getLatestReadings());
      setTelemetryHistory(iotEngine.getAllTelemetry());
      setAlerts(iotEngine.getAlerts());
      setThresholds(iotEngine.getThresholds());
      setIsRunning(iotEngine.getIsRunning());
    };

    // Initial pull
    updateFromEngine();

    // Subscribe to continuous updates
    const unsubscribe = iotEngine.subscribe(updateFromEngine);
    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (authenticatedUser: UserAccount) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
  };

  const handleToggleRunning = () => {
    iotEngine.toggleSimulation();
    setIsRunning(iotEngine.getIsRunning());
  };

  const handleToggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Login Screen (Shown before dashboard content if not logged in) */}
      {!user && <LoginModal onLoginSuccess={handleLoginSuccess} />}

      {/* Main Dashboard (Visible only after successful authentication) */}
      {user && (
        <div className="flex flex-col min-h-screen">
          <Navbar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            user={user}
            onLogout={handleLogout}
            isRunning={isRunning}
            onToggleRunning={handleToggleRunning}
            isDarkMode={isDarkMode}
            onToggleDarkMode={handleToggleDarkMode}
            alerts={alerts}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {currentTab === 'overview' && (
              <OverviewView
                latestReadings={latestReadings}
                onSelectMachine={id => {
                  setSelectedMachineId(id);
                  setCurrentTab('detail');
                }}
                onViewAlerts={() => setCurrentTab('alerts')}
                userRole={user.role}
              />
            )}

            {currentTab === 'detail' && (
              <MachineDetailView
                selectedMachineId={selectedMachineId}
                onSelectMachine={setSelectedMachineId}
                history={telemetryHistory}
                thresholds={thresholds}
              />
            )}

            {currentTab === 'alerts' && (
              <AlertsView alerts={alerts} user={user} />
            )}

            {currentTab === 'reports' && (
              <ReportsView telemetryData={telemetryHistory} />
            )}

            {currentTab === 'settings' && (
              <SettingsView user={user} />
            )}

            {currentTab === 'code' && (
              <CodeExplorerView />
            )}
          </main>

          {/* Footer Bar */}
          <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 mt-8 transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Rotary Machinery Predictive Maintenance Platform
                </span>
                <span>&bull;</span>
                <span>4 Assets Monitored (pump-01, motor-02, fan-03, compressor-04)</span>
              </div>
              <div className="flex items-center gap-4 font-mono text-[11px]">
                <span>HiveMQ TLS: Port 8883</span>
                <span>SQLite: WAL Mode</span>
                <span>Auth: 5-Attempt Lockout</span>
              </div>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
