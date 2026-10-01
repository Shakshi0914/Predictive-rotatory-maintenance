/**
 * Data structures for Predictive Maintenance IoT Dashboard.
 */

export type MachineId = 'pump-01' | 'motor-02' | 'fan-03' | 'compressor-04';

export type OperationalStatus = 0 | 1 | 2; // 0: Normal, 1: Warning, 2: Critical
export type AlertSeverity = 'warning' | 'critical' | 'info';
export type AlertStatus = 'new' | 'acknowledged' | 'resolved';
export type UserRole = 'admin' | 'viewer';

export interface TelemetryReading {
  id?: number;
  timestamp: string;
  machine_id: MachineId;
  rpm: number;
  vib_x: number;
  vib_y: number;
  vib_z: number;
  vib_rms: number;
  kurtosis: number;
  temp_c: number;
  current_a: number;
  acoustic_db: number;
  health: number; // 0.0 to 1.0
  status: OperationalStatus;
  anomaly_score: number; // IsolationForest: negative = outlier
  ml_status: OperationalStatus; // RandomForest predicted status
  rul_hours: number; // Remaining Useful Life
  failure_mode?: string;
}

export interface MachineConfig {
  id: MachineId;
  name: string;
  type: string;
  location: string;
  base_rpm: number;
  base_temp: number;
  base_vib_rms: number;
  base_kurtosis: number;
  base_current: number;
  base_acoustic: number;
  deg_rate: number;
}

export interface AlertRecord {
  id: string;
  timestamp: string;
  machine_id: MachineId;
  severity: AlertSeverity;
  alert_type: string;
  message: string;
  status: AlertStatus;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  reading_snapshot: Partial<TelemetryReading>;
}

export interface UserAccount {
  id: string;
  username: string;
  role: UserRole;
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: number | null; // epoch timestamp in ms
  mustChangePassword: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface SystemThresholds {
  thresh_vib_rms_warning: number;
  thresh_vib_rms_critical: number;
  thresh_temp_warning: number;
  thresh_temp_critical: number;
  thresh_kurtosis_warning: number;
  thresh_anomaly_score: number;
  alert_dedup_seconds: number;
}

export interface NotificationSettings {
  webhook_url: string;
  webhook_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_enabled: boolean;
  smtp_server: string;
  smtp_port: number;
  smtp_username: string;
  alert_email_recipient: string;
  email_enabled: boolean;
}
