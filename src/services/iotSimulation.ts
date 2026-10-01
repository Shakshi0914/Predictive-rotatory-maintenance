/**
 * IoT Simulation Service for Rotary Machinery Predictive Maintenance.
 * Replicates generator.py physics, ingest.py ML inference, and alerts.py 30s deduplication.
 */

import {
  MachineId,
  MachineConfig,
  TelemetryReading,
  AlertRecord,
  SystemThresholds,
  OperationalStatus,
  NotificationSettings
} from '../types';

export const MACHINES: MachineConfig[] = [
  {
    id: 'pump-01',
    name: 'Slurry Feed Pump',
    type: 'Centrifugal Slurry Pump',
    location: 'Building A - Pumping Station 1',
    base_rpm: 1750,
    base_temp: 52,
    base_vib_rms: 1.8,
    base_kurtosis: 2.95,
    base_current: 14.5,
    base_acoustic: 68,
    deg_rate: 0.003
  },
  {
    id: 'motor-02',
    name: 'Induction Drive Motor',
    type: '3-Phase AC Induction Motor',
    location: 'Building A - Motor Control Center',
    base_rpm: 3550,
    base_temp: 60,
    base_vib_rms: 2.1,
    base_kurtosis: 3.02,
    base_current: 28.0,
    base_acoustic: 72,
    deg_rate: 0.0025
  },
  {
    id: 'fan-03',
    name: 'Cooling Tower Axial Fan',
    type: 'Induced Draft Cooling Fan',
    location: 'Cooling Tower Deck #2',
    base_rpm: 1180,
    base_temp: 42,
    base_vib_rms: 1.4,
    base_kurtosis: 2.90,
    base_current: 9.2,
    base_acoustic: 65,
    deg_rate: 0.0035
  },
  {
    id: 'compressor-04',
    name: 'Rotary Screw Compressor',
    type: 'Twin-Screw Gas Compressor',
    location: 'Utility Building - Compressor Bay 4',
    base_rpm: 2900,
    base_temp: 68,
    base_vib_rms: 2.5,
    base_kurtosis: 3.05,
    base_current: 32.5,
    base_acoustic: 78,
    deg_rate: 0.004
  }
];

export const DEFAULT_THRESHOLDS: SystemThresholds = {
  thresh_vib_rms_warning: 4.5,
  thresh_vib_rms_critical: 7.0,
  thresh_temp_warning: 75.0,
  thresh_temp_critical: 85.0,
  thresh_kurtosis_warning: 3.8,
  thresh_anomaly_score: -0.15,
  alert_dedup_seconds: 30
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  webhook_url: 'https://httpbin.org/post',
  webhook_enabled: true,
  telegram_bot_token: '',
  telegram_chat_id: '',
  telegram_enabled: false,
  smtp_server: 'smtp.gmail.com',
  smtp_port: 587,
  smtp_username: 'alerts@plant-maintenance.internal',
  alert_email_recipient: 'oncall-engineer@plant-maintenance.internal',
  email_enabled: false
};

interface InternalMachineState {
  health: number;
  status: OperationalStatus;
  episode: 'bearing_wear' | 'imbalance' | 'overheating' | null;
  episodeProgress: number; // 0.0 to 1.0
  cycles: number;
  totalHours: number;
}

class IoTSimulationEngine {
  private machineStates: Map<MachineId, InternalMachineState> = new Map();
  private telemetryHistory: TelemetryReading[] = [];
  private alerts: AlertRecord[] = [];
  private thresholds: SystemThresholds = { ...DEFAULT_THRESHOLDS };
  private notifications: NotificationSettings = { ...DEFAULT_NOTIFICATIONS };
  private lastAlertTimestamps: Map<string, number> = new Map();
  private listeners: Set<() => void> = new Set();
  private timerId: any = null;
  private isRunning: boolean = true;
  private updateIntervalMs: number = 2000;

  constructor() {
    this.initMachineStates();
    this.loadState();
    this.seedInitialHistory();
    this.startSimulation();
  }

  private initMachineStates() {
    for (const m of MACHINES) {
      this.machineStates.set(m.id, {
        health: m.id === 'pump-01' ? 0.94 : m.id === 'motor-02' ? 0.88 : m.id === 'fan-03' ? 0.98 : 0.72,
        status: m.id === 'compressor-04' ? 1 : 0,
        episode: m.id === 'compressor-04' ? 'bearing_wear' : null,
        episodeProgress: m.id === 'compressor-04' ? 0.35 : 0.0,
        cycles: 42,
        totalHours: 124.5
      });
    }
  }

  private loadState() {
    try {
      const storedThresh = localStorage.getItem('iot_pdm_thresholds');
      if (storedThresh) this.thresholds = JSON.parse(storedThresh);

      const storedNotif = localStorage.getItem('iot_pdm_notifications');
      if (storedNotif) this.notifications = JSON.parse(storedNotif);

      const storedAlerts = localStorage.getItem('iot_pdm_alerts');
      if (storedAlerts) this.alerts = JSON.parse(storedAlerts);
    } catch {
      // Use defaults
    }
  }

  private saveState() {
    try {
      localStorage.setItem('iot_pdm_thresholds', JSON.stringify(this.thresholds));
      localStorage.setItem('iot_pdm_notifications', JSON.stringify(this.notifications));
      localStorage.setItem('iot_pdm_alerts', JSON.stringify(this.alerts.slice(0, 200)));
    } catch {
      // ignore
    }
  }

  private seedInitialHistory() {
    if (this.telemetryHistory.length > 0) return;

    // Generate 40 past ticks (spaced 10 seconds apart)
    const now = Date.now();
    for (let i = 40; i >= 1; i--) {
      const pastTime = new Date(now - i * 10000).toISOString();
      for (const machine of MACHINES) {
        const reading = this.generateSample(machine, pastTime, false);
        this.telemetryHistory.push(reading);
      }
    }
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  public startSimulation() {
    if (this.timerId) clearInterval(this.timerId);
    this.isRunning = true;
    this.timerId = setInterval(() => {
      this.step();
    }, this.updateIntervalMs);
  }

  public pauseSimulation() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    this.notify();
  }

  public toggleSimulation() {
    if (this.isRunning) {
      this.pauseSimulation();
    } else {
      this.startSimulation();
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public setUpdateInterval(ms: number) {
    this.updateIntervalMs = ms;
    if (this.isRunning) {
      this.startSimulation();
    }
  }

  // Trigger manual degradation injection
  public injectFailure(machineId: MachineId, episodeType: 'bearing_wear' | 'imbalance' | 'overheating') {
    const state = this.machineStates.get(machineId);
    if (!state) return;
    state.episode = episodeType;
    state.episodeProgress = 0.05;
    this.step();
  }

  // Reset machine maintenance
  public performMaintenance(machineId: MachineId) {
    const state = this.machineStates.get(machineId);
    if (!state) return;
    state.health = 0.98;
    state.status = 0;
    state.episode = null;
    state.episodeProgress = 0;
    this.step();
  }

  private step() {
    const nowIso = new Date().toISOString();
    for (const machine of MACHINES) {
      const reading = this.generateSample(machine, nowIso, true);
      this.telemetryHistory.push(reading);

      // Keep maximum 800 data points in memory
      if (this.telemetryHistory.length > 800) {
        this.telemetryHistory.shift();
      }

      // Check alerts
      this.evaluateAlerts(reading);
    }

    this.saveState();
    this.notify();
  }

  private generateSample(machine: MachineConfig, timestamp: string, advanceState: boolean): TelemetryReading {
    const state = this.machineStates.get(machine.id)!;

    if (advanceState) {
      state.cycles += 1;
      state.totalHours += 0.01;

      // Progress degradation if active
      if (state.episode) {
        state.episodeProgress = Math.min(1.0, state.episodeProgress + 0.025);
        state.health = Math.max(0.06, 1.0 - Math.pow(state.episodeProgress, 1.25) * 0.94);

        if (state.episodeProgress >= 1.0) {
          // Automatic emergency shutdown & maintenance reset
          state.health = 0.98;
          state.status = 0;
          state.episode = null;
          state.episodeProgress = 0;
        }
      } else {
        // Slow natural wear
        state.health = Math.max(0.2, state.health - machine.deg_rate * 0.01);
      }
    }

    // Dynamic load factor (sinusoidal shift + random walk)
    const loadFactor = 0.88 + 0.14 * Math.sin(state.cycles * 0.08) + (Math.random() - 0.5) * 0.04;

    let vibBoostX = 0;
    let vibBoostY = 0;
    let vibBoostZ = 0;
    let tempBoost = 0;
    let kurtosisBoost = 0;
    let acousticBoost = 0;

    if (state.episode === 'bearing_wear') {
      kurtosisBoost = 4.0 * Math.pow(state.episodeProgress, 1.4);
      vibBoostZ = 5.2 * Math.pow(state.episodeProgress, 1.6);
      vibBoostX = 1.8 * state.episodeProgress;
      vibBoostY = 1.9 * state.episodeProgress;
      tempBoost = 19.0 * Math.pow(state.episodeProgress, 1.2);
      acousticBoost = 15.0 * state.episodeProgress;
    } else if (state.episode === 'imbalance') {
      vibBoostX = 5.8 * Math.pow(state.episodeProgress, 1.3);
      vibBoostY = 5.4 * Math.pow(state.episodeProgress, 1.3);
      vibBoostZ = 1.0 * state.episodeProgress;
      kurtosisBoost = 0.3 * state.episodeProgress;
      tempBoost = 11.0 * state.episodeProgress;
      acousticBoost = 9.0 * state.episodeProgress;
    } else if (state.episode === 'overheating') {
      tempBoost = 34.0 * Math.pow(state.episodeProgress, 1.2);
      vibBoostX = 3.8 * Math.pow(state.episodeProgress, 1.5);
      vibBoostY = 3.8 * Math.pow(state.episodeProgress, 1.5);
      vibBoostZ = 3.2 * Math.pow(state.episodeProgress, 1.5);
      kurtosisBoost = 1.0 * state.episodeProgress;
      acousticBoost = 14.0 * state.episodeProgress;
    }

    // RPM
    const rpm = machine.base_rpm * Math.sqrt(loadFactor) + (Math.random() - 0.5) * 12;

    // Vibration components
    const baseRms = machine.base_vib_rms * loadFactor;
    const vib_x = Math.max(0.1, baseRms * 0.72 + vibBoostX + (Math.random() - 0.5) * 0.3);
    const vib_y = Math.max(0.1, baseRms * 0.68 + vibBoostY + (Math.random() - 0.5) * 0.3);
    const vib_z = Math.max(0.1, baseRms * 0.55 + vibBoostZ + (Math.random() - 0.5) * 0.25);

    // RMS
    const vib_rms = Number((Math.sqrt((vib_x ** 2 + vib_y ** 2 + vib_z ** 2) / 3.0) + baseRms * 0.25).toFixed(2));

    // Kurtosis
    const kurtosis = Number((machine.base_kurtosis + kurtosisBoost + (Math.random() - 0.5) * 0.15).toFixed(2));

    // Temp °C
    const temp_c = Number((machine.base_temp + (loadFactor - 1.0) * 7.5 + tempBoost + (Math.random() - 0.5) * 1.0).toFixed(1));

    // Current A
    const current_a = Number((machine.base_current * loadFactor + vib_rms * 0.35 + (Math.random() - 0.5) * 0.4).toFixed(1));

    // Acoustic dB
    const acoustic_db = Number((machine.base_acoustic + (loadFactor - 1.0) * 4.0 + acousticBoost + (Math.random() - 0.5) * 0.8).toFixed(1));

    // Status classification: 0=Normal, 1=Warning, 2=Critical
    let status: OperationalStatus = 0;
    if (vib_rms >= this.thresholds.thresh_vib_rms_critical || temp_c >= this.thresholds.thresh_temp_critical || state.health < 0.28) {
      status = 2;
    } else if (vib_rms >= this.thresholds.thresh_vib_rms_warning || temp_c >= this.thresholds.thresh_temp_warning || kurtosis >= this.thresholds.thresh_kurtosis_warning || state.health < 0.68) {
      status = 1;
    }
    state.status = status;

    // ML Inference calculation
    // IsolationForest anomaly score (decision_function: negative is outlier)
    let anomalyScore = 0.32 - Math.max(0, vib_rms - 3.8) * 0.14 - Math.max(0, kurtosis - 3.4) * 0.1 - Math.max(0, temp_c - 70) * 0.015;
    anomalyScore = Number(anomalyScore.toFixed(3));

    // RandomForest Status classification prediction
    const ml_status: OperationalStatus = status;

    // RUL calculation (Remaining Useful Life in hours)
    const rul_hours = Number(Math.max(1.0, Math.min(720.0, state.health * 680 + (Math.random() - 0.5) * 10)).toFixed(1));

    return {
      timestamp,
      machine_id: machine.id,
      rpm: Math.round(rpm),
      vib_x: Number(vib_x.toFixed(2)),
      vib_y: Number(vib_y.toFixed(2)),
      vib_z: Number(vib_z.toFixed(2)),
      vib_rms,
      kurtosis,
      temp_c,
      current_a,
      acoustic_db,
      health: Number(state.health.toFixed(3)),
      status,
      anomaly_score: anomalyScore,
      ml_status,
      rul_hours,
      failure_mode: state.episode || 'Normal'
    };
  }

  private evaluateAlerts(reading: TelemetryReading) {
    const now = Date.now();
    const dedupWindowMs = this.thresholds.alert_dedup_seconds * 1000;
    const machineId = reading.machine_id;

    const checkDedup = (typeKey: string): boolean => {
      const fullKey = `${machineId}:${typeKey}`;
      const last = this.lastAlertTimestamps.get(fullKey) || 0;
      if (now - last < dedupWindowMs) {
        return false;
      }
      this.lastAlertTimestamps.set(fullKey, now);
      return true;
    };

    // 1. Critical Vibration RMS
    if (reading.vib_rms >= this.thresholds.thresh_vib_rms_critical && checkDedup('vib_crit')) {
      this.addAlert({
        id: `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: reading.timestamp,
        machine_id: machineId,
        severity: 'critical',
        alert_type: 'rule_vib_crit',
        message: `Critical vibration RMS limit breached: ${reading.vib_rms} mm/s (limit: ${this.thresholds.thresh_vib_rms_critical} mm/s)`,
        status: 'new',
        reading_snapshot: reading
      });
    }
    // 2. Warning Vibration RMS
    else if (reading.vib_rms >= this.thresholds.thresh_vib_rms_warning && checkDedup('vib_warn')) {
      this.addAlert({
        id: `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: reading.timestamp,
        machine_id: machineId,
        severity: 'warning',
        alert_type: 'rule_vib_warn',
        message: `Vibration RMS warning threshold exceeded: ${reading.vib_rms} mm/s (limit: ${this.thresholds.thresh_vib_rms_warning} mm/s)`,
        status: 'new',
        reading_snapshot: reading
      });
    }

    // 3. Critical Temperature
    if (reading.temp_c >= this.thresholds.thresh_temp_critical && checkDedup('temp_crit')) {
      this.addAlert({
        id: `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: reading.timestamp,
        machine_id: machineId,
        severity: 'critical',
        alert_type: 'rule_temp_crit',
        message: `Bearing thermal runaway: ${reading.temp_c} °C exceeds critical limit ${this.thresholds.thresh_temp_critical} °C`,
        status: 'new',
        reading_snapshot: reading
      });
    }

    // 4. Kurtosis Bearing Wear Indicator
    if (reading.kurtosis >= this.thresholds.thresh_kurtosis_warning && reading.vib_rms < this.thresholds.thresh_vib_rms_critical && checkDedup('kurt_warn')) {
      this.addAlert({
        id: `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: reading.timestamp,
        machine_id: machineId,
        severity: 'warning',
        alert_type: 'rule_kurtosis',
        message: `High Kurtosis (${reading.kurtosis} > ${this.thresholds.thresh_kurtosis_warning}) detected: impulsive cyclic bearing wear indicated`,
        status: 'new',
        reading_snapshot: reading
      });
    }

    // 5. ML Anomaly Score Alert (Isolation Forest)
    if (reading.anomaly_score <= this.thresholds.thresh_anomaly_score && checkDedup('ml_anom')) {
      this.addAlert({
        id: `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: reading.timestamp,
        machine_id: machineId,
        severity: reading.anomaly_score < this.thresholds.thresh_anomaly_score - 0.15 ? 'critical' : 'warning',
        alert_type: 'ml_isolation_anomaly',
        message: `Isolation Forest flagged sensor anomaly (score: ${reading.anomaly_score})`,
        status: 'new',
        reading_snapshot: reading
      });
    }
  }

  private addAlert(alert: AlertRecord) {
    this.alerts.unshift(alert);
    if (this.alerts.length > 200) {
      this.alerts.pop();
    }
    this.saveState();
  }

  // Public Query APIs
  public getLatestReadings(): TelemetryReading[] {
    const latestMap = new Map<MachineId, TelemetryReading>();
    for (let i = this.telemetryHistory.length - 1; i >= 0; i--) {
      const r = this.telemetryHistory[i];
      if (!latestMap.has(r.machine_id)) {
        latestMap.set(r.machine_id, r);
      }
      if (latestMap.size === MACHINES.length) break;
    }
    return MACHINES.map(m => latestMap.get(m.id)! || this.generateSample(m, new Date().toISOString(), false));
  }

  public getHistoryForMachine(machineId: MachineId, limit: number = 60): TelemetryReading[] {
    return this.telemetryHistory
      .filter(r => r.machine_id === machineId)
      .slice(-limit);
  }

  public getAllTelemetry(): TelemetryReading[] {
    return [...this.telemetryHistory];
  }

  public getAlerts(): AlertRecord[] {
    return [...this.alerts];
  }

  public acknowledgeAlert(alertId: string, username: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && alert.status === 'new') {
      alert.status = 'acknowledged';
      alert.acknowledged_by = username;
      alert.acknowledged_at = new Date().toISOString();
      this.saveState();
      this.notify();
    }
  }

  public resolveAlert(alertId: string, username: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && alert.status !== 'resolved') {
      alert.status = 'resolved';
      alert.resolved_by = username;
      alert.resolved_at = new Date().toISOString();
      this.saveState();
      this.notify();
    }
  }

  public getThresholds(): SystemThresholds {
    return { ...this.thresholds };
  }

  public updateThresholds(newThresh: Partial<SystemThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresh };
    this.saveState();
    this.notify();
  }

  public getNotifications(): NotificationSettings {
    return { ...this.notifications };
  }

  public updateNotifications(newNotif: Partial<NotificationSettings>): void {
    this.notifications = { ...this.notifications, ...newNotif };
    this.saveState();
    this.notify();
  }
}

// Singleton Instance
export const iotEngine = new IoTSimulationEngine();
