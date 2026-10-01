import React from 'react';
import {
  Activity,
  AlertTriangle,
  Play,
  Pause,
  Sun,
  Moon,
  LogOut,
  Shield,
  User,
  Sliders,
  FileSpreadsheet,
  Cpu,
  Code
} from 'lucide-react';
import { UserAccount, AlertRecord } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: UserAccount | null;
  onLogout: () => void;
  isRunning: boolean;
  onToggleRunning: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  alerts: AlertRecord[];
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  user,
  onLogout,
  isRunning,
  onToggleRunning,
  isDarkMode,
  onToggleDarkMode,
  alerts
}) => {
  const newAlertsCount = alerts.filter(a => a.status === 'new').length;
  const criticalAlertsCount = alerts.filter(a => a.status === 'new' && a.severity === 'critical').length;

  const navItems = [
    { id: 'overview', label: 'Fleet Overview', icon: Activity },
    { id: 'detail', label: 'Machine Detail', icon: Cpu },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: AlertTriangle,
      badge: newAlertsCount > 0 ? newAlertsCount : undefined,
      badgeCritical: criticalAlertsCount > 0
    },
    { id: 'reports', label: 'Data & Reports', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: Sliders, adminOnly: true },
    { id: 'code', label: 'Python Suite', icon: Code }
  ];

  return (
    <header className="sticky top-0 z-30 border-b backdrop-blur-md transition-colors bg-white/90 border-slate-200 dark:bg-slate-900/90 dark:border-slate-800">
      {/* Alert Ticker / Banner if critical alerts exist */}
      {criticalAlertsCount > 0 && (
        <div className="bg-rose-600 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>
              <strong>CRITICAL MACHINERY ALERT:</strong> {criticalAlertsCount} unacknowledged critical alert(s) detected across rotary fleet!
            </span>
          </div>
          <button
            onClick={() => setCurrentTab('alerts')}
            className="underline font-bold hover:text-rose-100 transition-colors cursor-pointer"
          >
            Review Alerts Now &rarr;
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  Rotary Machinery PdM
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                  IoT + ML
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Predictive Maintenance System &bull; HiveMQ MQTT &bull; SQLite
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-100 text-cyan-700 dark:bg-slate-800 dark:text-cyan-400'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full text-white ${
                        item.badgeCritical ? 'bg-rose-600 animate-ping-slow' : 'bg-amber-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Stream Status Toggle */}
            <button
              onClick={onToggleRunning}
              title={isRunning ? 'Pause Ingestion Stream' : 'Resume Ingestion Stream'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                isRunning
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {isRunning ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <Pause className="w-3.5 h-3.5 ml-1" />
                  <span className="hidden sm:inline">Stream Live</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Paused</span>
                </>
              )}
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Toggle color theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Session Info & Logout */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="hidden lg:block text-right">
                  <div className="flex items-center gap-1 justify-end text-xs font-semibold text-slate-900 dark:text-white">
                    {user.role === 'admin' ? (
                      <Shield className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    ) : (
                      <User className="w-3 h-3 text-slate-400" />
                    )}
                    <span>{user.username}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    {user.role}
                  </span>
                </div>

                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-200 dark:border-slate-800">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex flex-col items-center p-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
