import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  Database,
  Search,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { TelemetryReading, MachineId } from '../types';
import { MACHINES, iotEngine } from '../services/iotSimulation';

interface ReportsViewProps {
  telemetryData: TelemetryReading[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ telemetryData }) => {
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Filter telemetry records
  const filteredRecords = telemetryData.filter(r => {
    if (selectedMachine !== 'all' && r.machine_id !== selectedMachine) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!r.machine_id.toLowerCase().includes(q) && !r.timestamp.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const displayedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // CSV Download function
  const downloadCsv = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(field => JSON.stringify(row[field] ?? '')).join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportLiveTelemetry = () => {
    setIsExporting(true);
    setTimeout(() => {
      downloadCsv(filteredRecords, `rotary_telemetry_export_${new Date().toISOString().slice(0, 19)}.csv`);
      setIsExporting(false);
    }, 400);
  };

  const handleGenerateTrainingDataset = () => {
    setIsExporting(true);
    setTimeout(() => {
      // Synthesize 500 rows with labels for offline training
      const trainingRows: any[] = [];
      const now = Date.now();
      for (let i = 0; i < 600; i++) {
        const m = MACHINES[i % MACHINES.length];
        const isAnomaly = i % 5 === 0;
        const isCritical = i % 15 === 0;
        const status = isCritical ? 2 : isAnomaly ? 1 : 0;
        const load = 0.85 + Math.random() * 0.3;
        const vib_rms = Number((m.base_vib_rms * load + (isCritical ? 5.5 : isAnomaly ? 3.0 : 0)).toFixed(2));
        const temp_c = Number((m.base_temp + (isCritical ? 32 : isAnomaly ? 18 : 0) + (Math.random() - 0.5) * 2).toFixed(1));
        const kurtosis = Number((m.base_kurtosis + (isAnomaly ? 2.2 : 0) + (Math.random() - 0.5) * 0.2).toFixed(2));
        const health = Number((1.0 - (status === 2 ? 0.8 : status === 1 ? 0.45 : 0.05)).toFixed(2));
        const rul_hours = Number((health * 720).toFixed(1));

        trainingRows.push({
          timestamp: new Date(now - i * 60000).toISOString(),
          machine_id: m.id,
          rpm: Math.round(m.base_rpm * Math.sqrt(load)),
          vib_x: Number((vib_rms * 0.7).toFixed(2)),
          vib_y: Number((vib_rms * 0.65).toFixed(2)),
          vib_z: Number((vib_rms * 0.5).toFixed(2)),
          vib_rms,
          kurtosis,
          temp_c,
          current_a: Number((m.base_current * load).toFixed(1)),
          acoustic_db: Number((m.base_acoustic + (status > 0 ? 12 : 0)).toFixed(1)),
          health,
          status,
          rul_hours
        });
      }
      downloadCsv(trainingRows, `rotary_machinery_training_dataset.csv`);
      setIsExporting(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-cyan-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Historical Telemetry & Dataset Reports
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Query SQLite-compatible time-series records and export labeled CSV datasets for scikit-learn models
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportLiveTelemetry}
              disabled={isExporting}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Telemetry CSV</span>
            </button>

            <button
              onClick={handleGenerateTrainingDataset}
              disabled={isExporting}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Export Labeled ML Training CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Filter by Asset</label>
            <select
              value={selectedMachine}
              onChange={e => {
                setSelectedMachine(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value="all">All Assets (Fleet Wide)</option>
              {MACHINES.map(m => (
                <option key={m.id} value={m.id}>
                  {m.id} - {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search timestamp or machine..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Rows per Page</label>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value={15}>15 records</option>
              <option value={30}>30 records</option>
              <option value={50}>50 records</option>
              <option value={100}>100 records</option>
            </select>
          </div>
        </div>
      </div>

      {/* Telemetry Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-sans text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Asset</th>
                <th className="py-2.5 px-3">Speed (RPM)</th>
                <th className="py-2.5 px-3">RMS (mm/s)</th>
                <th className="py-2.5 px-3">Kurtosis</th>
                <th className="py-2.5 px-3">Temp (°C)</th>
                <th className="py-2.5 px-3">Current (A)</th>
                <th className="py-2.5 px-3">Acoustic (dB)</th>
                <th className="py-2.5 px-3">Health</th>
                <th className="py-2.5 px-3">ML Anom Score</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-sans">
                    No telemetry records found.
                  </td>
                </tr>
              ) : (
                displayedRecords.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {r.machine_id}
                    </td>
                    <td className="py-2 px-3 text-slate-800 dark:text-slate-200">{r.rpm}</td>
                    <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-400">{r.vib_rms}</td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{r.kurtosis}</td>
                    <td className="py-2 px-3 text-rose-600 dark:text-rose-400">{r.temp_c}</td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{r.current_a}</td>
                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{r.acoustic_db}</td>
                    <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                      {(r.health * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-3 text-cyan-600 dark:text-cyan-400">{r.anomaly_score}</td>
                    <td className="py-2 px-3 whitespace-nowrap font-sans font-bold">
                      {r.status === 0 ? (
                        <span className="text-emerald-600">Normal</span>
                      ) : r.status === 1 ? (
                        <span className="text-amber-500">Warning</span>
                      ) : (
                        <span className="text-rose-600">Critical</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} records
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono font-bold text-slate-800 dark:text-slate-200">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
