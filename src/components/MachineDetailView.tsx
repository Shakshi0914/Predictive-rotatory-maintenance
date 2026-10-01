import React, { useState } from 'react';
import {
  Cpu,
  Activity,
  Thermometer,
  Zap,
  Volume2,
  TrendingDown,
  RotateCw,
  Sliders,
  Wrench,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { TelemetryReading, MachineId, SystemThresholds } from '../types';
import { MACHINES, iotEngine } from '../services/iotSimulation';

interface MachineDetailViewProps {
  selectedMachineId: MachineId;
  onSelectMachine: (id: MachineId) => void;
  history: TelemetryReading[];
  thresholds: SystemThresholds;
}

// Lightweight Interactive High-Resolution SVG Time-Series Chart Component
const SimpleSvgLineChart: React.FC<{
  title: string;
  data: { x: string; y: number }[];
  yLabel: string;
  color: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  minY?: number;
  maxY?: number;
}> = ({ title, data, yLabel, color, warningThreshold, criticalThreshold, minY, maxY }) => {
  if (!data || data.length < 2) {
    return (
      <div className="h-56 flex items-center justify-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
        Accumulating real-time telemetry buffer...
      </div>
    );
  }

  const values = data.map(d => d.y);
  let effectiveMinY = minY !== undefined ? minY : Math.min(...values);
  let effectiveMaxY = maxY !== undefined ? maxY : Math.max(...values);

  if (warningThreshold !== undefined) {
    effectiveMaxY = Math.max(effectiveMaxY, warningThreshold * 1.15);
  }
  if (criticalThreshold !== undefined) {
    effectiveMaxY = Math.max(effectiveMaxY, criticalThreshold * 1.15);
  }

  // Padding
  const range = effectiveMaxY - effectiveMinY || 1;
  const paddingY = range * 0.1;
  const y0 = Math.max(0, effectiveMinY - paddingY);
  const y1 = effectiveMaxY + paddingY;

  const width = 600;
  const height = 200;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const getX = (index: number) => padLeft + (index / (data.length - 1)) * chartWidth;
  const getY = (val: number) => padTop + chartHeight - ((val - y0) / (y1 - y0)) * chartHeight;

  // Path generator
  const points = data.map((d, i) => `${getX(i)},${getY(d.y)}`).join(' ');
  const areaPath = `M ${getX(0)},${getY(y0)} L ${points} L ${getX(data.length - 1)},${getY(y0)} Z`;

  const warnY = warningThreshold !== undefined ? getY(warningThreshold) : null;
  const critY = criticalThreshold !== undefined ? getY(criticalThreshold) : null;

  const latestVal = data[data.length - 1]?.y;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{title}</span>
          <span className="text-[10px] text-slate-400 font-mono">({yLabel})</span>
        </div>
        <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
          Latest: <span style={{ color }}>{latestVal}</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
        <defs>
          <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
          const val = y0 + frac * (y1 - y0);
          const y = getY(val);
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800"
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-slate-400 font-mono"
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Warning Threshold Line */}
        {warnY !== null && warnY >= padTop && warnY <= padTop + chartHeight && (
          <g>
            <line
              x1={padLeft}
              y1={warnY}
              x2={width - padRight}
              y2={warnY}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={width - padRight - 4}
              y={warnY - 3}
              textAnchor="end"
              className="text-[9px] fill-amber-500 font-bold"
            >
              WARN ({warningThreshold})
            </text>
          </g>
        )}

        {/* Critical Threshold Line */}
        {critY !== null && critY >= padTop && critY <= padTop + chartHeight && (
          <g>
            <line
              x1={padLeft}
              y1={critY}
              x2={width - padRight}
              y2={critY}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={width - padRight - 4}
              y={critY - 3}
              textAnchor="end"
              className="text-[9px] fill-rose-500 font-bold"
            >
              CRIT ({criticalThreshold})
            </text>
          </g>
        )}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#grad-${title})`} />

        {/* Main line */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />

        {/* Latest point pulse */}
        {data.length > 0 && (
          <circle
            cx={getX(data.length - 1)}
            cy={getY(latestVal)}
            r="4"
            fill={color}
            stroke="#ffffff"
            strokeWidth="2"
          />
        )}
      </svg>
    </div>
  );
};

export const MachineDetailView: React.FC<MachineDetailViewProps> = ({
  selectedMachineId,
  onSelectMachine,
  history,
  thresholds
}) => {
  const currentMachine = MACHINES.find(m => m.id === selectedMachineId) || MACHINES[0];
  const machineHistory = history.filter(r => r.machine_id === selectedMachineId);
  const latest = machineHistory[machineHistory.length - 1] || null;

  // Chart series data preparation
  const vibRmsData = machineHistory.map(r => ({ x: r.timestamp, y: r.vib_rms }));
  const tempData = machineHistory.map(r => ({ x: r.timestamp, y: r.temp_c }));
  const currentData = machineHistory.map(r => ({ x: r.timestamp, y: r.current_a }));
  const acousticData = machineHistory.map(r => ({ x: r.timestamp, y: r.acoustic_db }));
  const kurtosisData = machineHistory.map(r => ({ x: r.timestamp, y: r.kurtosis }));
  const anomalyScoreData = machineHistory.map(r => ({ x: r.timestamp, y: r.anomaly_score }));
  const healthData = machineHistory.map(r => ({ x: r.timestamp, y: Number((r.health * 100).toFixed(1)) }));

  return (
    <div className="space-y-6">
      {/* Top Selector & Machine Overview Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Cpu className="w-7 h-7" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-cyan-600 dark:text-cyan-400">
                  {currentMachine.id}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                  {currentMachine.location}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {currentMachine.name}
              </h2>
              <p className="text-xs text-slate-500">{currentMachine.type}</p>
            </div>
          </div>

          {/* Machine Switcher Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Asset Switcher:</span>
            {MACHINES.map(m => (
              <button
                key={m.id}
                onClick={() => onSelectMachine(m.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  m.id === selectedMachineId
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-800 dark:border-cyan-600 dark:bg-cyan-950 dark:text-cyan-200'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                {m.id}
              </button>
            ))}
          </div>
        </div>

        {/* Live Status Summary Header Strip */}
        {latest && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Speed (RPM)</span>
              <div className="text-base font-bold text-slate-900 dark:text-white">{latest.rpm}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Vib RMS (mm/s)</span>
              <div
                className={`text-base font-bold ${
                  latest.vib_rms >= thresholds.thresh_vib_rms_critical
                    ? 'text-rose-600'
                    : latest.vib_rms >= thresholds.thresh_vib_rms_warning
                    ? 'text-amber-500'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {latest.vib_rms}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Housing Temp (°C)</span>
              <div
                className={`text-base font-bold ${
                  latest.temp_c >= thresholds.thresh_temp_critical
                    ? 'text-rose-600'
                    : latest.temp_c >= thresholds.thresh_temp_warning
                    ? 'text-amber-500'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {latest.temp_c}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Kurtosis (Impulsive)</span>
              <div className="text-base font-bold text-slate-900 dark:text-white">{latest.kurtosis}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">IsolationForest Score</span>
              <div className="text-base font-mono font-bold text-cyan-600 dark:text-cyan-400">
                {latest.anomaly_score.toFixed(3)}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Est. Remaining Life</span>
              <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                {latest.rul_hours} hrs
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tri-Axial Breakdown Banner */}
      {latest && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                Tri-Axial Velocity Vectors
              </h4>
              <p className="text-xs text-slate-300">
                Radial (X), Tangential (Y), and Axial (Z) bearing load components
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 font-mono text-sm">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Vib X</span>
              <span className="font-bold text-cyan-400">{latest.vib_x} mm/s</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Vib Y</span>
              <span className="font-bold text-indigo-300">{latest.vib_y} mm/s</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Vib Z</span>
              <span className="font-bold text-purple-300">{latest.vib_z} mm/s</span>
            </div>
          </div>
        </div>
      )}

      {/* Time-Series Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Vibration RMS Velocity with Warning & Critical Lines */}
        <SimpleSvgLineChart
          title={`${currentMachine.name} - Vibration RMS Velocity`}
          data={vibRmsData}
          yLabel="mm/s"
          color="#6366f1"
          warningThreshold={thresholds.thresh_vib_rms_warning}
          criticalThreshold={thresholds.thresh_vib_rms_critical}
          minY={0}
        />

        {/* Chart 2: Temperature with Critical & Warning Lines */}
        <SimpleSvgLineChart
          title={`${currentMachine.name} - Bearing Housing Temperature`}
          data={tempData}
          yLabel="°C"
          color="#f43f5e"
          warningThreshold={thresholds.thresh_temp_warning}
          criticalThreshold={thresholds.thresh_temp_critical}
          minY={20}
        />

        {/* Chart 3: Kurtosis Impulsive Wear Spike */}
        <SimpleSvgLineChart
          title={`${currentMachine.name} - Vibration Kurtosis (Impact Indicator)`}
          data={kurtosisData}
          yLabel="Kurtosis"
          color="#06b6d4"
          warningThreshold={thresholds.thresh_kurtosis_warning}
          minY={2.0}
        />

        {/* Chart 4: IsolationForest Anomaly Score */}
        <SimpleSvgLineChart
          title={`${currentMachine.name} - ML Anomaly Score (Isolation Forest)`}
          data={anomalyScoreData}
          yLabel="Decision Score"
          color="#10b981"
          warningThreshold={thresholds.thresh_anomaly_score}
          minY={-0.6}
          maxY={0.5}
        />

        {/* Chart 5: Motor Current */}
        <SimpleSvgLineChart
          title={`${currentMachine.name} - Operating Current`}
          data={currentData}
          yLabel="Amperes (A)"
          color="#f59e0b"
          minY={0}
        />

        {/* Chart 6: Health Index Trajectory */}
        <SimpleSvgLineChart
          title={`${currentMachine.name} - Degradation Health Index`}
          data={healthData}
          yLabel="Health %"
          color="#8b5cf6"
          minY={0}
          maxY={100}
        />
      </div>
    </div>
  );
};
