import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Bell,
  Users,
  ShieldCheck,
  Save,
  Lock,
  Unlock,
  UserPlus,
  Send,
  AlertOctagon,
  CheckCircle,
  KeyRound,
  Mail,
  MessageSquare
} from 'lucide-react';
import { SystemThresholds, NotificationSettings, UserAccount, UserRole } from '../types';
import { iotEngine } from '../services/iotSimulation';
import { initializeUsers, unlockUserAccount, createNewUser } from '../services/authService';

interface SettingsViewProps {
  user: UserAccount | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ user }) => {
  const isAdmin = user?.role === 'admin';

  const [thresholds, setThresholds] = useState<SystemThresholds>(iotEngine.getThresholds());
  const [notifications, setNotifications] = useState<NotificationSettings>(iotEngine.getNotifications());
  const [usersList, setUsersList] = useState<UserAccount[]>([]);

  // Add User Form
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('viewer');
  const [newPassword, setNewPassword] = useState('');
  const [userError, setUserError] = useState<string | null>(null);

  // Success Feedback
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const list = await initializeUsers();
    setUsersList([...list]);
  };

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    iotEngine.updateThresholds(thresholds);
    setSaveSuccess('System vibration and temperature thresholds updated successfully.');
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    iotEngine.updateNotifications(notifications);
    setSaveSuccess('Alert channels and notification parameters saved.');
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  const handleUnlock = async (username: string) => {
    if (!isAdmin) return;
    await unlockUserAccount(username);
    await loadUsers();
    setSaveSuccess(`Account '${username}' unlocked successfully.`);
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setUserError(null);

    if (newPassword.length < 8) {
      setUserError('Password must be at least 8 characters long.');
      return;
    }

    try {
      await createNewUser(newUsername, newRole, newPassword);
      setNewUsername('');
      setNewPassword('');
      await loadUsers();
      setSaveSuccess(`User account '${newUsername}' created successfully.`);
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (err: any) {
      setUserError(err.message || 'Could not create user.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              System Settings & Asset Administration
            </h2>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
            <span>Role: {user?.role.toUpperCase()}</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure rule-based vibration & temperature limits, alert dispatch channels, and user permissions
        </p>

        {saveSuccess && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {!isAdmin && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Administrative Access Required:</strong> You are signed in as a Viewer. System threshold parameters and user administration are view-only.
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Thresholds Configuration */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-4 h-4 text-cyan-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Rule-Based Operational Thresholds
            </h3>
          </div>

          <form onSubmit={handleSaveThresholds} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Vib RMS Warning (mm/s)
                </label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!isAdmin}
                  value={thresholds.thresh_vib_rms_warning}
                  onChange={e =>
                    setThresholds({ ...thresholds, thresh_vib_rms_warning: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Vib RMS Critical (mm/s)
                </label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!isAdmin}
                  value={thresholds.thresh_vib_rms_critical}
                  onChange={e =>
                    setThresholds({ ...thresholds, thresh_vib_rms_critical: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Temp Warning (°C)
                </label>
                <input
                  type="number"
                  step="1"
                  disabled={!isAdmin}
                  value={thresholds.thresh_temp_warning}
                  onChange={e =>
                    setThresholds({ ...thresholds, thresh_temp_warning: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Temp Critical (°C)
                </label>
                <input
                  type="number"
                  step="1"
                  disabled={!isAdmin}
                  value={thresholds.thresh_temp_critical}
                  onChange={e =>
                    setThresholds({ ...thresholds, thresh_temp_critical: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Kurtosis Wear Limit
                </label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!isAdmin}
                  value={thresholds.thresh_kurtosis_warning}
                  onChange={e =>
                    setThresholds({ ...thresholds, thresh_kurtosis_warning: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  IsolationForest Outlier Limit
                </label>
                <input
                  type="number"
                  step="0.05"
                  disabled={!isAdmin}
                  value={thresholds.thresh_anomaly_score}
                  onChange={e =>
                    setThresholds({ ...thresholds, thresh_anomaly_score: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Alert Deduplication Suppression Window (Seconds)
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={thresholds.alert_dedup_seconds}
                onChange={e =>
                  setThresholds({ ...thresholds, alert_dedup_seconds: parseInt(e.target.value) || 30 })
                }
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50"
              />
            </div>

            {isAdmin && (
              <button
                type="submit"
                className="w-full py-2 px-4 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Rule Thresholds</span>
              </button>
            )}
          </form>
        </div>

        {/* Section 2: Alert Channels & Webhook */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Notification Channels (.env sync)
            </h3>
          </div>

          <form onSubmit={handleSaveNotifications} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Generic Webhook Dispatch URL (Slack / Teams / PagerDuty)
              </label>
              <input
                type="url"
                disabled={!isAdmin}
                value={notifications.webhook_url}
                onChange={e => setNotifications({ ...notifications, webhook_url: e.target.value })}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Telegram Bot Token
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={notifications.telegram_bot_token}
                  onChange={e => setNotifications({ ...notifications, telegram_bot_token: e.target.value })}
                  placeholder="123456:ABC-DEF1234..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Telegram Chat ID
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={notifications.telegram_chat_id}
                  onChange={e => setNotifications({ ...notifications, telegram_chat_id: e.target.value })}
                  placeholder="-1001928374"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  SMTP Host & Port
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={notifications.smtp_server}
                    onChange={e => setNotifications({ ...notifications, smtp_server: e.target.value })}
                    className="w-2/3 text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50 font-mono"
                  />
                  <input
                    type="number"
                    disabled={!isAdmin}
                    value={notifications.smtp_port}
                    onChange={e => setNotifications({ ...notifications, smtp_port: parseInt(e.target.value) || 587 })}
                    className="w-1/3 text-xs px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Alert Email Recipient
                </label>
                <input
                  type="email"
                  disabled={!isAdmin}
                  value={notifications.alert_email_recipient}
                  onChange={e => setNotifications({ ...notifications, alert_email_recipient: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none disabled:opacity-50"
                />
              </div>
            </div>

            {isAdmin && (
              <button
                type="submit"
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Notification Endpoints</span>
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Section 3: User Management Table & Create User */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              User Access & Lockout Management
            </h3>
          </div>
          <span className="text-xs text-slate-400">SQLite users table authentication</span>
        </div>

        {/* Existing Users Table */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Failed Attempts</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Force Password Change</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {usersList.map(u => {
                const isLocked = u.lockedUntil && u.lockedUntil > Date.now();
                return (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {u.username}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'admin'
                            ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {u.failedAttempts} / 5
                    </td>
                    <td className="py-2.5 px-3">
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          <Lock className="w-3 h-3" />
                          Locked (5-min penalty)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {u.mustChangePassword ? 'Yes (Pending)' : 'No'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {isLocked && isAdmin && (
                        <button
                          onClick={() => handleUnlock(u.username)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded cursor-pointer shadow-xs"
                        >
                          Unlock Account
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add User Form (Admin Only) */}
        {isAdmin && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-cyan-600" />
              <span>Provision New System User</span>
            </h4>

            {userError && (
              <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                {userError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="e.g. jsmith_tech"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Access Role
                </label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as UserRole)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none"
                >
                  <option value="viewer">Viewer (Read-Only)</option>
                  <option value="admin">Administrator (Full RBAC)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none"
                />
              </div>

              <button
                type="submit"
                className="py-2 px-4 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Create Account
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
