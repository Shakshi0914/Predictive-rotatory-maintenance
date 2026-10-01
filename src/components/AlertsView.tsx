import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Filter,
  Send,
  Check,
  ShieldAlert,
  Search,
  CheckCircle,
  ExternalLink,
  Info
} from 'lucide-react';
import { AlertRecord, AlertStatus, MachineId, UserAccount } from '../types';
import { MACHINES, iotEngine } from '../services/iotSimulation';

interface AlertsViewProps {
  alerts: AlertRecord[];
  user: UserAccount | null;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ alerts, user }) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [machineFilter, setMachineFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  // Filtered alerts
  const filteredAlerts = alerts.filter(alert => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (machineFilter !== 'all' && alert.machine_id !== machineFilter) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchMsg = alert.message.toLowerCase().includes(term);
      const matchMachine = alert.machine_id.toLowerCase().includes(term);
      const matchType = alert.alert_type.toLowerCase().includes(term);
      if (!matchMsg && !matchMachine && !matchType) return false;
    }
    return true;
  });

  const handleAcknowledge = (alertId: string) => {
    if (!isAdmin || !user) return;
    iotEngine.acknowledgeAlert(alertId, user.username);
  };

  const handleResolve = (alertId: string) => {
    if (!isAdmin || !user) return;
    iotEngine.resolveAlert(alertId, user.username);
  };

  const handleTestDispatch = () => {
    const notifs = iotEngine.getNotifications();
    setDispatchSuccessMsg(
      `Dispatched test alert payload to Webhook (${notifs.webhook_url}) and queued plant on-call notification.`
    );
    setTimeout(() => {
      setDispatchSuccessMsg(null);
    }, 4500);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Live Incident & Anomaly Triage Center
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Rule-based thresholds & ML anomaly scores with automated 30s per-asset deduplication
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestDispatch}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Simulate Webhook Dispatch</span>
            </button>
          </div>
        </div>

        {/* Dispatch Confirmation Toast */}
        {dispatchSuccessMsg && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{dispatchSuccessMsg}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value="all">All Incident Statuses</option>
              <option value="new">New (Unacknowledged)</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {/* Machine Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Rotary Machine</label>
            <select
              value={machineFilter}
              onChange={e => setMachineFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value="all">All Fleet Assets</option>
              {MACHINES.map(m => (
                <option key={m.id} value={m.id}>
                  {m.id} ({m.name})
                </option>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Severity</label>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warning Only</option>
            </select>
          </div>

          {/* Search Term */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Filter message or type..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Role Notice for Viewer */}
      {!isAdmin && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            <strong>Read-Only Viewer Account:</strong> You can inspect all telemetry incidents, but only accounts with <strong>Admin</strong> privileges can acknowledge or resolve alarms.
          </span>
        </div>
      )}

      {/* Alerts Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Machine</th>
                <th className="py-3 px-4">Trigger / Source</th>
                <th className="py-3 px-4">Incident Message</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                    <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">
                      No matching alerts recorded
                    </p>
                    <p className="text-xs text-slate-400">All machine sensor metrics are operating within thresholds.</p>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map(alert => {
                  const isCrit = alert.severity === 'critical';
                  const isNew = alert.status === 'new';

                  return (
                    <tr
                      key={alert.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        isNew && isCrit ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      {/* Severity */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isCrit ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <AlertOctagon className="w-3 h-3 text-rose-600" />
                            Critical
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Warning
                          </span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </td>

                      {/* Machine */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white">
                        {alert.machine_id}
                      </td>

                      {/* Trigger Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {alert.alert_type}
                        </span>
                      </td>

                      {/* Message */}
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">
                        {alert.message}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {alert.status === 'new' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            New
                          </span>
                        )}
                        {alert.status === 'acknowledged' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            <Clock className="w-3 h-3" />
                            Acked ({alert.acknowledged_by || 'Admin'})
                          </span>
                        )}
                        {alert.status === 'resolved' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Resolved
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        {alert.status === 'new' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={!isAdmin}
                            title={!isAdmin ? 'Admin role required to acknowledge' : 'Acknowledge alert'}
                            className="px-2.5 py-1 text-[11px] font-bold rounded bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            disabled={!isAdmin}
                            title={!isAdmin ? 'Admin role required to resolve' : 'Mark as resolved'}
                            className="px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
