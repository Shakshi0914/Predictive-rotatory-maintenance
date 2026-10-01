import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  AlertOctagon,
  Wrench,
  Flame,
  RotateCw,
  Gauge,
  Thermometer,
  Zap,
  Volume2,
  ChevronRight,
  TrendingDown,
  Cpu
} from 'lucide-react';
import { TelemetryReading, MachineConfig, MachineId, OperationalStatus } from '../types';
import { MACHINES, iotEngine } from '../services/iotSimulation';

interface OverviewViewProps {
  latestReadings: TelemetryReading[];
  onSelectMachine: (id: MachineId) => void;
  onViewAlerts: () => void;
  userRole: string;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  latestReadings,
  onSelectMachine,
  onViewAlerts,
  userRole
}) => {
  // Aggregate Fleet KPIs
  const totalAssets = MACHINES.length;
  const normalCount = latestReadings.filter(r => r.status === 0).length;
  const warningCount = latestReadings.filter(r => r.status === 1).length;
  const criticalCount = latestReadings.filter(r => r.status === 2).length;

  const avgHealth =
    latestReadings.length > 0
      ? latestReadings.reduce((acc, r) => acc + r.health, 0) / latestReadings.length
      : 1.0;

  const handleInjectFault = (machineId: MachineId, fault: 'bearing_wear' | 'imbalance' | 'overheating') => {
    iotEngine.injectFailure(machineId, fault);
  };

  const handleReset = (machineId: MachineId) => {
    iotEngine.performMaintenance(machineId);
  };

  const getStatusBadge = (status: OperationalStatus) => {
    switch (status) {
      case 0:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle className="w-3.5 h-3.5" />
            Normal
          </span>
        );
      case 1:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-bounce">
            <AlertOctagon className="w-3.5 h-3.5" />
            Critical
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Fleet KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Fleet Health Score */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Fleet Health Index
            </span>
            <Activity className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {(avgHealth * 100).toFixed(1)}%
            </span>
            <span className="text-xs font-medium text-slate-500">Fleet Average</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                avgHealth > 0.8
                  ? 'bg-emerald-500'
                  : avgHealth > 0.6
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${avgHealth * 100}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Asset Status Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Asset State Breakdown
            </span>
            <Gauge className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-3 flex items-center justify-between text-center">
            <div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{normalCount}</div>
              <div className="text-[11px] font-medium text-slate-500">Normal</div>
            </div>
            <div className="border-x border-slate-200 dark:border-slate-800 px-4">
              <div className="text-2xl font-bold text-amber-500">{warningCount}</div>
              <div className="text-[11px] font-medium text-slate-500">Warning</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-500">{criticalCount}</div>
              <div className="text-[11px] font-medium text-slate-500">Critical</div>
            </div>
          </div>
        </div>

        {/* KPI 3: Ingestion Stream QoS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              MQTT Broker Link
            </span>
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>TLS 8883</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">
              HiveMQ Cloud &bull; QoS 1
            </div>
            <p className="text-xs text-slate-500 mt-1">Topic: plant1/+/telemetry</p>
          </div>
        </div>

        {/* KPI 4: ML Prediction Health */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ML Diagnostics
            </span>
            <Cpu className="w-5 h-5 text-cyan-600" />
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-slate-900 dark:text-white">
              IsolationForest + RF
            </div>
            <p className="text-xs text-slate-500 mt-1">RUL Regression & Anomaly Scoring Active</p>
          </div>
        </div>
      </div>

      {/* 4 Machine Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Rotary Fleet Telemetry Cards</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live physical sensor streams, real-time ML anomaly detection, and degradation injection
            </p>
          </div>
          <button
            onClick={onViewAlerts}
            className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View Alerts Log</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MACHINES.map(machine => {
            const reading = latestReadings.find(r => r.machine_id === machine.id) || {
              machine_id: machine.id,
              rpm: machine.base_rpm,
              vib_x: 1.0,
              vib_y: 1.0,
              vib_z: 0.8,
              vib_rms: machine.base_vib_rms,
              kurtosis: machine.base_kurtosis,
              temp_c: machine.base_temp,
              current_a: machine.base_current,
              acoustic_db: machine.base_acoustic,
              health: 0.95,
              status: 0,
              anomaly_score: 0.28,
              ml_status: 0,
              rul_hours: 640.0,
              timestamp: new Date().toISOString()
            };

            const isWarning = reading.status === 1;
            const isCritical = reading.status === 2;

            return (
              <div
                key={machine.id}
                className={`relative bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${
                  isCritical
                    ? 'border-rose-400 dark:border-rose-700/80 ring-2 ring-rose-500/20'
                    : isWarning
                    ? 'border-amber-400 dark:border-amber-700/80 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-cyan-700 dark:text-cyan-400">
                        {machine.id}
                      </span>
                      {getStatusBadge(reading.status)}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {machine.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{machine.type}</p>
                  </div>

                  {/* Health Gauge */}
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-500">Asset Health</span>
                    <div
                      className={`text-xl font-black ${
                        reading.health > 0.75
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : reading.health > 0.45
                          ? 'text-amber-500'
                          : 'text-rose-500'
                      }`}
                    >
                      {(reading.health * 100).toFixed(0)}%
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      RUL: ~{reading.rul_hours} hrs
                    </span>
                  </div>
                </div>

                {/* Primary Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 my-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  {/* RPM */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <RotateCw className="w-3 h-3 text-cyan-500" />
                      Speed
                    </span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {reading.rpm} <span className="text-[10px] font-normal text-slate-400">RPM</span>
                    </div>
                  </div>

                  {/* Vib RMS */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <Activity className="w-3 h-3 text-indigo-500" />
                      Vib RMS
                    </span>
                    <div
                      className={`text-sm font-bold mt-0.5 ${
                        reading.vib_rms >= 7.0
                          ? 'text-rose-600 dark:text-rose-400'
                          : reading.vib_rms >= 4.5
                          ? 'text-amber-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {reading.vib_rms}{' '}
                      <span className="text-[10px] font-normal text-slate-400">mm/s</span>
                    </div>
                  </div>

                  {/* Temperature */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-rose-500" />
                      Temp
                    </span>
                    <div
                      className={`text-sm font-bold mt-0.5 ${
                        reading.temp_c >= 85
                          ? 'text-rose-600 dark:text-rose-400'
                          : reading.temp_c >= 75
                          ? 'text-amber-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {reading.temp_c} <span className="text-[10px] font-normal text-slate-400">°C</span>
                    </div>
                  </div>

                  {/* Kurtosis */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                      Kurtosis
                    </span>
                    <div
                      className={`text-sm font-bold mt-0.5 ${
                        reading.kurtosis >= 3.8 ? 'text-amber-500' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {reading.kurtosis}
                    </div>
                  </div>

                  {/* Current */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      Current
                    </span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {reading.current_a} <span className="text-[10px] font-normal text-slate-400">A</span>
                    </div>
                  </div>

                  {/* Acoustic dB */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-teal-500" />
                      Acoustic
                    </span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {reading.acoustic_db} <span className="text-[10px] font-normal text-slate-400">dB</span>
                    </div>
                  </div>
                </div>

                {/* ML Anomaly Score Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                      <Cpu className="w-3.5 h-3.5 text-cyan-600" />
                      IsolationForest Score:
                      <strong className="text-slate-800 dark:text-slate-200 font-mono ml-1">
                        {reading.anomaly_score.toFixed(3)}
                      </strong>
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        reading.anomaly_score < -0.15 ? 'text-rose-500' : 'text-emerald-600'
                      }`}
                    >
                      {reading.anomaly_score < -0.15 ? 'ANOMALOUS' : 'NORMAL IN-SPEC'}
                    </span>
                  </div>
                </div>

                {/* Degradation Episode Controls */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    <span className="font-semibold">Simulate Degradation Episodes:</span>
                    <button
                      onClick={() => onSelectMachine(machine.id)}
                      className="text-cyan-600 dark:text-cyan-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <span>Charts</span> &rarr;
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => handleInjectFault(machine.id, 'bearing_wear')}
                      className="px-2 py-1 text-[10px] font-semibold rounded bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 cursor-pointer transition-colors"
                      title="Inject high-frequency bearing wear (kurtosis spike & axial vibration)"
                    >
                      + Bearing Wear
                    </button>

                    <button
                      onClick={() => handleInjectFault(machine.id, 'imbalance')}
                      className="px-2 py-1 text-[10px] font-semibold rounded bg-purple-50 text-purple-800 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 cursor-pointer transition-colors"
                      title="Inject 1X rotational unbalance (X/Y radial vibration)"
                    >
                      + Imbalance
                    </button>

                    <button
                      onClick={() => handleInjectFault(machine.id, 'overheating')}
                      className="px-2 py-1 text-[10px] font-semibold rounded bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 cursor-pointer transition-colors"
                      title="Inject thermal dissipation failure (>85°C)"
                    >
                      + Overheating
                    </button>

                    <button
                      onClick={() => handleReset(machine.id)}
                      className="ml-auto px-2 py-1 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 cursor-pointer transition-colors flex items-center gap-1"
                      title="Reset machine health to 100% and baseline vibration"
                    >
                      <Wrench className="w-3 h-3" />
                      Reset Overhaul
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
