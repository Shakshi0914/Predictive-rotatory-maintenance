import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  Shield,
  AlertOctagon,
  KeyRound,
  CheckCircle,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { loginUser, changeUserPassword } from '../services/authService';
import { UserAccount } from '../types';

interface LoginModalProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('AdminChangeMe123!');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Force Password Change Step
  const [forceChangeMode, setForceChangeMode] = useState(false);
  const [pendingUser, setPendingUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          setErrorMsg(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) return;

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const result = await loginUser(username, password);

      if (result.success && result.user) {
        if (result.user.mustChangePassword) {
          setPendingUser(result.user);
          setForceChangeMode(true);
        } else {
          onLoginSuccess(result.user);
        }
      } else {
        setErrorMsg(result.message);
        if (result.remainingLockoutSeconds) {
          setLockoutRemaining(result.remainingLockoutSeconds);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (newPassword === 'AdminChangeMe123!') {
      setErrorMsg('Please choose a new password different from the initial default.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await changeUserPassword(pendingUser.username, newPassword);
      if (ok) {
        setPasswordChangeSuccess(true);
        setTimeout(() => {
          onLoginSuccess({
            ...pendingUser,
            mustChangePassword: false
          });
        }, 1200);
      } else {
        setErrorMsg('Failed to update password.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Password update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillCredentials = (user: 'admin' | 'viewer') => {
    setErrorMsg(null);
    if (user === 'admin') {
      setUsername('admin');
      setPassword('AdminChangeMe123!');
    } else {
      setUsername('viewer');
      setPassword('Viewer123!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Predictive Maintenance Hub</h2>
              <p className="text-xs text-slate-300">Rotary Equipment Telemetry & Machine Learning</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-cyan-300 font-mono bg-cyan-950/50 px-3 py-1.5 rounded-lg border border-cyan-800/40">
            <Lock className="w-3.5 h-3.5" />
            <span>SQLite Auth &bull; 5-Attempt Lockout &bull; Role-Based Access</span>
          </div>
        </div>

        {/* Force Password Change Form */}
        {forceChangeMode ? (
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <strong>First-Time Login Security Requirement:</strong>
                <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                  Initial administrator password must be updated before gaining operational dashboard access.
                </p>
              </div>
            </div>

            {passwordChangeSuccess ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-center text-emerald-800 dark:text-emerald-300 space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto animate-bounce" />
                <p className="text-sm font-bold">Password Successfully Updated!</p>
                <p className="text-xs text-slate-500">Redirecting to Live Fleet Overview...</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {errorMsg && (
                  <div className="p-2.5 rounded-lg text-xs bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Secure Password (min 8 chars)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new administrator password"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-cyan-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating Password...' : 'Save New Password & Launch Hub'}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Standard Login Form */
          <div className="p-6 space-y-4">
            {/* Lockout Warning Banner */}
            {lockoutRemaining > 0 && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-rose-900 dark:text-rose-200">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  <span>Account Locked (Anti-Brute Force)</span>
                </div>
                <p className="text-[11px]">
                  5 consecutive failed logins detected. System access paused for:{' '}
                  <span className="font-mono font-bold text-sm text-rose-700 dark:text-rose-300">
                    {Math.floor(lockoutRemaining / 60)}:{(lockoutRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </p>
              </div>
            )}

            {errorMsg && lockoutRemaining === 0 && (
              <div className="p-2.5 rounded-lg text-xs bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    disabled={lockoutRemaining > 0 || isSubmitting}
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={lockoutRemaining > 0 || isSubmitting}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={lockoutRemaining > 0 || isSubmitting}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-cyan-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Sign In to System</span>
                )}
              </button>
            </form>

            {/* Quick Demo Pre-fill helpers */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-2">
                <Sparkles className="w-3 h-3 text-cyan-500" />
                Quick-Select Test Accounts:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillCredentials('admin')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-left hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors bg-slate-50 dark:bg-slate-800/60 cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>Admin User</span>
                    <span className="text-[9px] px-1 bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 rounded font-mono">
                      Full RBAC
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">admin / AdminChangeMe123!</div>
                </button>

                <button
                  type="button"
                  onClick={() => fillCredentials('viewer')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-left hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors bg-slate-50 dark:bg-slate-800/60 cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                    <span>Viewer User</span>
                    <span className="text-[9px] px-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-mono">
                      Read-Only
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">viewer / Viewer123!</div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
