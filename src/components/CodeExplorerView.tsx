import React, { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  Download,
  FileCode,
  Terminal,
  FileText,
  Sliders,
  CheckSquare,
  BookOpen,
  FolderTree
} from 'lucide-react';

interface CodeFileItem {
  id: string;
  name: string;
  category: 'Python Source' | 'Configuration' | 'Documentation';
  description: string;
  cliCommand?: string;
  content: string;
}

export const CodeExplorerView: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = useState<string>('generator.py');
  const [copied, setCopied] = useState<boolean>(false);

  const files: CodeFileItem[] = [
    {
      id: 'generator.py',
      name: 'generator.py',
      category: 'Python Source',
      description: 'Synthetic Rotary Machinery IoT Generator (4 machines, physics, duty-cycle, bearing wear, imbalance, overheating, HiveMQ Cloud TLS & fallback broker, offline CSV export)',
      cliCommand: 'python generator.py --interval 2.0  # or python generator.py --offline --samples 1500',
      content: `"""
Synthetic IoT Telemetry Generator for Rotary Machinery.
Simulates realistic industrial operations for pump-01, motor-02, fan-03, and compressor-04.
"""
from __future__ import annotations
import os, sys, json, time, math, random, argparse, logging
from datetime import datetime, timezone
import paho.mqtt.client as mqtt

# Machines: pump-01, motor-02, fan-03, compressor-04
# Realistic physics: Tri-axial vib, RMS, Kurtosis, Temp, Current, Acoustic dB, Health
# HiveMQ Cloud TLS port 8883 + Fallback broker.hivemq.com:1883
# See /generator.py in root workspace for complete execution`
    },
    {
      id: 'ingest.py',
      name: 'ingest.py',
      category: 'Python Source',
      description: 'MQTT Ingestion Service (subscribes to plant1/+/telemetry, auto-reconnect, loads ML models, scores anomaly/status/RUL, writes to SQLite and CSV backup, evaluates alerts)',
      cliCommand: 'python ingest.py',
      content: `"""
Ingest Service for Rotary Machinery IoT Telemetry.
Subscribes to MQTT topic plant1/+/telemetry.
Loads trained ML models, scores incoming telemetry, persists into SQLite,
appends to CSV backup, and evaluates alert thresholds.
"""
from __future__ import annotations
import os, sys, json, time, logging
import pandas as pd, numpy as np, joblib
import paho.mqtt.client as mqtt
import database, alerts

# See /ingest.py in root workspace for full source`
    },
    {
      id: 'train_model.py',
      name: 'train_model.py',
      category: 'Python Source',
      description: 'ML Training Pipeline (RandomForest multi-class status classifier, IsolationForest anomaly detector on normal data, GradientBoosting RUL regressor, joblib serialization)',
      cliCommand: 'python train_model.py',
      content: `"""
Machine Learning Training Pipeline for Rotary Machinery Predictive Maintenance.
Trains:
1. Multi-class RandomForestClassifier for operational state (0:Normal, 1:Warning, 2:Critical)
2. IsolationForest unsupervised anomaly detector (trained on strictly normal data)
3. GradientBoostingRegressor for Remaining Useful Life (RUL hours)
"""
from __future__ import annotations
import os, json, numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, IsolationForest, GradientBoostingRegressor
import joblib

# See /train_model.py in root workspace for full source`
    },
    {
      id: 'database.py',
      name: 'database.py',
      category: 'Python Source',
      description: 'SQLite Database Module (schemas for telemetry, alerts, users, thresholds; bcrypt password hashing, 5-attempt/5-minute lockout, default admin seeding)',
      cliCommand: 'python database.py',
      content: `"""
Database module for Predictive Maintenance IoT System.
Provides SQLite initialization, schema migration, password hashing (bcrypt),
user authentication with account lockout (5 attempts / 5 minutes), and CRUD operations.
"""
from __future__ import annotations
import sqlite3, os, time, logging, bcrypt

# Tables: telemetry, alerts, users, system_thresholds
# Default accounts: admin (AdminChangeMe123!) and viewer (Viewer123!)
# See /database.py in root workspace for full source`
    },
    {
      id: 'alerts.py',
      name: 'alerts.py',
      category: 'Python Source',
      description: 'Alerts Engine (Rule-based RMS > 4.5/7.0, Temp > 85, Kurtosis > 3.8; ML IsolationForest < -0.15; 30-second per-machine deduplication; Webhook, Telegram, SMTP dispatch)',
      cliCommand: 'python alerts.py',
      content: `"""
Alert System for Rotary Machinery Predictive Maintenance.
Handles:
- Rule-based triggers (Vibration RMS, Temperature, Kurtosis)
- ML-based triggers (RandomForest predicted status, IsolationForest anomaly score)
- 30-second per-machine deduplication window
- Persistence to SQLite database
- External notification dispatchers: Webhook, Telegram Bot, SMTP Email
"""
from __future__ import annotations
import os, time, json, logging, smtplib, requests
import database

# See /alerts.py in root workspace for full source`
    },
    {
      id: 'app.py',
      name: 'app.py',
      category: 'Python Source',
      description: 'Flask REST API Backend (serves telemetry, alerts, thresholds, CSV exports, session-based authentication, RBAC admin/viewer)',
      cliCommand: 'python app.py',
      content: `"""
Flask Application & REST API Server for Rotary Machinery Predictive Maintenance.
Serves dashboard endpoints, session-based authentication, alert management,
and real-time machine telemetry analytics.
"""
from __future__ import annotations
import os, io, csv, logging
from flask import Flask, request, jsonify, session, send_file
from flask_cors import CORS
import database, alerts

# See /app.py in root workspace for full source`
    },
    {
      id: 'app_streamlit.py',
      name: 'app_streamlit.py',
      category: 'Python Source',
      description: 'Streamlit + Plotly Alternative Dashboard (single-script Python interface matching user optional choice)',
      cliCommand: 'streamlit run app_streamlit.py --server.port 8501',
      content: `"""
Streamlit + Plotly Alternative Dashboard for Predictive Maintenance.
Run with:
    streamlit run app_streamlit.py --server.port 8501
"""
import streamlit as st, pandas as pd, plotly.express as px, plotly.graph_objects as go
import database

# See /app_streamlit.py in root workspace for full source`
    },
    {
      id: 'requirements.txt',
      name: 'requirements.txt',
      category: 'Configuration',
      description: 'Python package requirements (paho-mqtt v2, scikit-learn, joblib, pandas, Flask, Streamlit, Plotly, bcrypt, requests)',
      cliCommand: 'pip install -r requirements.txt',
      content: `# Predictive Maintenance IoT Suite - Dependencies
paho-mqtt>=2.0.0
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
joblib>=1.3.0
bcrypt>=4.0.0
requests>=2.31.0
python-dotenv>=1.0.0
Flask>=3.0.0
Flask-Cors>=4.0.0
streamlit>=1.32.0
plotly>=5.19.0`
    },
    {
      id: '.env.example',
      name: '.env.example',
      category: 'Configuration',
      description: 'Environment variable templates for HiveMQ Cloud TLS, SQLite, thresholds, webhooks, Telegram, SMTP',
      cliCommand: 'cp .env.example .env',
      content: `MQTT_BROKER_HOST="your-cluster-id.s1.eu.hivemq.cloud"
MQTT_BROKER_PORT=8883
MQTT_USE_TLS=True
MQTT_USERNAME="iot_telemetry_user"
MQTT_PASSWORD="YourStrongMqttPassword123!"
MQTT_TOPIC_PREFIX="plant1"
MQTT_FALLBACK_HOST="broker.hivemq.com"
MQTT_FALLBACK_PORT=1883

SQLITE_DB_PATH="iot_machinery.db"
THRESH_VIB_RMS_WARNING=4.5
THRESH_VIB_RMS_CRITICAL=7.0
THRESH_TEMP_CRITICAL=85.0
ALERT_DEDUP_SECONDS=30
WEBHOOK_URL="https://httpbin.org/post"`
    },
    {
      id: 'README.md',
      name: 'README.md',
      category: 'Documentation',
      description: 'Comprehensive setup guide: HiveMQ Cloud cluster creation, credentials, running each component, and troubleshooting',
      content: `# Predictive Maintenance Dashboard for Rotary Machinery using IoT Data
Comprehensive guide with step-by-step setup for HiveMQ Cloud, training models, and running services.
See /README.md in workspace root for the full guide.`
    },
    {
      id: 'test_checklist.md',
      name: 'test_checklist.md',
      category: 'Documentation',
      description: 'Step-by-step verification checklist for MQTT, SQLite, ML, Login lockout, and Alert flows',
      content: `# Predictive Maintenance IoT Verification Checklist
Complete testing scenarios for MQTT TLS, database schema, 5-attempt lockout, 30s alert dedup, and webhook dispatch.`
    }
  ];

  const currentFile = files.find(f => f.id === selectedFileId) || files[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Standalone Python IoT Suite & Code Explorer
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All production Python scripts, configs, and documentation generated directly in root workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Quick CLI Command Cheatsheet */}
        {currentFile.cliCommand && (
          <div className="mt-4 p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-xs flex items-center justify-between gap-2 border border-slate-800">
            <div className="flex items-center gap-2 truncate">
              <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-400">$</span>
              <span className="text-emerald-300 truncate">{currentFile.cliCommand}</span>
            </div>
            <span className="text-[10px] text-slate-500 hidden sm:inline">Terminal Command</span>
          </div>
        )}
      </div>

      {/* Main Code View Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: File Tree */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-2">
            Project Deliverables
          </h3>

          <div className="space-y-1">
            {files.map(file => {
              const isSelected = file.id === selectedFileId;
              return (
                <button
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-200 dark:border-cyan-800'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {file.category === 'Python Source' ? (
                      <FileCode className="w-4 h-4 text-cyan-500 shrink-0" />
                    ) : file.category === 'Configuration' ? (
                      <Sliders className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                    )}
                    <span className="truncate">{file.name}</span>
                  </div>

                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {file.name.endsWith('.py') ? 'py' : file.name.endsWith('.md') ? 'md' : 'cfg'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-2 px-2">
            <div className="font-semibold text-slate-700 dark:text-slate-300">Architecture Flow:</div>
            <p className="text-[10px] leading-relaxed text-slate-400">
              generator.py &rarr; HiveMQ TLS (8883) &rarr; ingest.py &rarr; SQLite &bull; ML Scoring &rarr; Alerts & Web Dashboard
            </p>
          </div>
        </div>

        {/* Right Code Content Pane */}
        <div className="lg:col-span-3 bg-slate-950 text-slate-100 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          {/* Code Window Header */}
          <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <span className="text-xs font-mono font-bold text-slate-200">
                /{currentFile.name}
              </span>
            </div>

            <span className="text-[10px] text-slate-400 font-mono">
              {currentFile.category}
            </span>
          </div>

          {/* Description banner */}
          <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 text-xs text-slate-400">
            {currentFile.description}
          </div>

          {/* Code Body */}
          <div className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto">
            <pre className="font-mono text-xs leading-relaxed text-slate-200 selection:bg-cyan-900">
              <code>{currentFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
