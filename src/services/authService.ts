/**
 * Authentication service enforcing 5-attempt/5-minute lockout and first-login password changes.
 */

import { UserAccount, UserRole } from '../types';

const STORAGE_KEY_USERS = 'iot_pdm_users_v1';
const STORAGE_KEY_SESSION = 'iot_pdm_session_v1';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

// Simple synchronous hashing helper for browser storage
async function hashPassword(plain: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(plain + "_salt_iot_machinery_2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Seed default users if empty
export async function initializeUsers(): Promise<UserAccount[]> {
  const stored = localStorage.getItem(STORAGE_KEY_USERS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }

  const adminHash = await hashPassword("AdminChangeMe123!");
  const viewerHash = await hashPassword("Viewer123!");

  const initialUsers: UserAccount[] = [
    {
      id: 'usr_admin_01',
      username: 'admin',
      role: 'admin',
      passwordHash: adminHash,
      failedAttempts: 0,
      lockedUntil: null,
      mustChangePassword: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_viewer_01',
      username: 'viewer',
      role: 'viewer',
      passwordHash: viewerHash,
      failedAttempts: 0,
      lockedUntil: null,
      mustChangePassword: false,
      createdAt: new Date().toISOString()
    }
  ];

  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(initialUsers));
  return initialUsers;
}

export async function loginUser(
  username: string,
  plainPassword: string
): Promise<{ success: boolean; message: string; user?: UserAccount; remainingLockoutSeconds?: number }> {
  const users = await initializeUsers();
  const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

  if (!user) {
    return { success: false, message: 'Invalid username or password.' };
  }

  const now = Date.now();

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > now) {
    const remSec = Math.ceil((user.lockedUntil - now) / 1000);
    return {
      success: false,
      message: `Account is locked for 5 minutes due to ${MAX_FAILED_ATTEMPTS} failed attempts.`,
      remainingLockoutSeconds: remSec
    };
  }

  const enteredHash = await hashPassword(plainPassword);

  if (enteredHash === user.passwordHash) {
    // Reset failed attempts
    user.failedAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date().toISOString();
    saveUsers(users);

    // Save session
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(user));

    return {
      success: true,
      message: 'Authentication successful.',
      user
    };
  } else {
    // Failed attempt
    user.failedAttempts += 1;
    let lockoutSec = 0;

    if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = now + LOCKOUT_MS;
      lockoutSec = 300;
    }

    saveUsers(users);

    if (user.lockedUntil) {
      return {
        success: false,
        message: `Account locked for 5 minutes due to ${MAX_FAILED_ATTEMPTS} consecutive failed attempts.`,
        remainingLockoutSeconds: lockoutSec
      };
    }

    const remainingTries = MAX_FAILED_ATTEMPTS - user.failedAttempts;
    return {
      success: false,
      message: `Incorrect password. ${remainingTries} attempt(s) remaining before 5-minute lockout.`
    };
  }
}

export function getCurrentSession(): UserAccount | null {
  const raw = localStorage.getItem(STORAGE_KEY_SESSION);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function logoutUser(): void {
  localStorage.removeItem(STORAGE_KEY_SESSION);
}

export async function changeUserPassword(username: string, newPlain: string): Promise<boolean> {
  const users = await initializeUsers();
  const user = users.find(u => u.username === username);
  if (!user) return false;

  user.passwordHash = await hashPassword(newPlain);
  user.mustChangePassword = false;
  user.failedAttempts = 0;
  user.lockedUntil = null;
  saveUsers(users);

  // Update session
  const current = getCurrentSession();
  if (current && current.username === username) {
    current.mustChangePassword = false;
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(current));
  }

  return true;
}

export async function createNewUser(username: string, role: UserRole, initialPass: string): Promise<UserAccount> {
  const users = await initializeUsers();
  const existing = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (existing) {
    throw new Error(`Username '${username}' already exists.`);
  }

  const hash = await hashPassword(initialPass);
  const newUser: UserAccount = {
    id: `usr_${Date.now()}`,
    username: username.trim(),
    role,
    passwordHash: hash,
    failedAttempts: 0,
    lockedUntil: null,
    mustChangePassword: true,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);
  return newUser;
}

export async function unlockUserAccount(username: string): Promise<void> {
  const users = await initializeUsers();
  const user = users.find(u => u.username === username);
  if (user) {
    user.failedAttempts = 0;
    user.lockedUntil = null;
    saveUsers(users);
  }
}

function saveUsers(users: UserAccount[]): void {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
}
