"""
Alert System for Rotary Machinery Predictive Maintenance.
Handles:
- Rule-based triggers (Vibration RMS, Temperature, Kurtosis)
- ML-based triggers (RandomForest predicted status, IsolationForest anomaly score)
- 30-second per-machine deduplication window
- Persistence to SQLite database
- External notification dispatchers: Webhook, Telegram Bot, SMTP Email
"""

from __future__ import annotations
import os
import time
import json
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import requests
import database

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [Alerts] %(message)s")
logger = logging.getLogger("alerts")

DEDUP_WINDOW_SECONDS = float(os.getenv("ALERT_DEDUP_SECONDS", 30))

# Cache of last alert timestamps: (machine_id, alert_type) -> float (timestamp)
_LAST_ALERT_TIMESTAMPS: Dict[str, float] = {}


class NotificationDispatcher:
    """Dispatches alerts to external channels: Webhook, Telegram, and SMTP."""

    @staticmethod
    def send_webhook(alert_data: Dict[str, Any]) -> bool:
        url = os.getenv("WEBHOOK_URL")
        if not url:
            return False
        try:
            resp = requests.post(url, json=alert_data, timeout=4.0)
            if resp.status_code in (200, 201, 204):
                logger.info(f"Webhook dispatched successfully to {url}")
                return True
            else:
                logger.warning(f"Webhook failed with status {resp.status_code}")
                return False
        except Exception as exc:
            logger.error(f"Error dispatching webhook: {exc}")
            return False

    @staticmethod
    def send_telegram(message_text: str) -> bool:
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        chat_id = os.getenv("TELEGRAM_CHAT_ID")
        if not bot_token or not chat_id:
            return False
        try:
            tg_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {"chat_id": chat_id, "text": message_text, "parse_mode": "Markdown"}
            resp = requests.post(tg_url, json=payload, timeout=4.0)
            return resp.status_code == 200
        except Exception as exc:
            logger.error(f"Error sending Telegram alert: {exc}")
            return False

    @staticmethod
    def send_email(subject: str, html_body: str) -> bool:
        smtp_server = os.getenv("SMTP_SERVER")
        smtp_port = int(os.getenv("SMTP_PORT", 587))
        username = os.getenv("SMTP_USERNAME")
        password = os.getenv("SMTP_PASSWORD")
        recipient = os.getenv("ALERT_EMAIL_RECIPIENT")

        if not all([smtp_server, username, password, recipient]):
            return False

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = username
            msg["To"] = recipient
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(smtp_server, smtp_port, timeout=5.0) as server:
                server.starttls()
                server.login(username, password)
                server.sendmail(username, [recipient], msg.as_string())
            logger.info(f"Alert email sent to {recipient}")
            return True
        except Exception as exc:
            logger.error(f"Error sending alert email: {exc}")
            return False


def is_deduplicated(machine_id: str, alert_type: str) -> bool:
    """Check if an alert of the same type for this machine occurred within the 30s window."""
    key = f"{machine_id}:{alert_type}"
    now = time.time()
    last_time = _LAST_ALERT_TIMESTAMPS.get(key, 0.0)
    if (now - last_time) < DEDUP_WINDOW_SECONDS:
        return True
    _LAST_ALERT_TIMESTAMPS[key] = now
    return False


def evaluate_telemetry_for_alerts(reading: Dict[str, Any], thresholds: Optional[Dict[str, float]] = None) -> List[Dict[str, Any]]:
    """
    Evaluates machine telemetry against rule-based and ML anomaly thresholds.
    Applies 30-second deduplication, persists to database, and triggers notification dispatches.
    """
    if thresholds is None:
        try:
            thresholds = database.get_system_thresholds()
        except Exception:
            thresholds = {}

    v_rms_warn = thresholds.get("thresh_vib_rms_warning", 4.5)
    v_rms_crit = thresholds.get("thresh_vib_rms_critical", 7.0)
    t_crit = thresholds.get("thresh_temp_critical", 85.0)
    t_warn = thresholds.get("thresh_temp_warning", 75.0)
    k_warn = thresholds.get("thresh_kurtosis_warning", 3.8)
    ml_anom_thresh = thresholds.get("thresh_anomaly_score", -0.15)

    machine_id = reading.get("machine_id", "unknown")
    vib_rms = float(reading.get("vib_rms", 0.0))
    temp_c = float(reading.get("temp_c", 0.0))
    kurtosis = float(reading.get("kurtosis", 3.0))
    ml_status = int(reading.get("ml_status", 0))
    anomaly_score = float(reading.get("anomaly_score", 0.0))

    generated_alerts: List[Dict[str, Any]] = []

    # 1. Rule: Vibration RMS Critical
    if vib_rms >= v_rms_crit:
        if not is_deduplicated(machine_id, "rule_vib_crit"):
            alert = {
                "timestamp": reading.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "machine_id": machine_id,
                "severity": "critical",
                "alert_type": "rule_vib_crit",
                "message": f"Critical vibration RMS limit breached: {vib_rms:.2f} mm/s (threshold: {v_rms_crit:.1f} mm/s)",
                "reading_snapshot": json.dumps(reading)
            }
            generated_alerts.append(alert)

    # 2. Rule: Vibration RMS Warning
    elif vib_rms >= v_rms_warn:
        if not is_deduplicated(machine_id, "rule_vib_warn"):
            alert = {
                "timestamp": reading.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "machine_id": machine_id,
                "severity": "warning",
                "alert_type": "rule_vib_warn",
                "message": f"Elevated vibration RMS warning: {vib_rms:.2f} mm/s (threshold: {v_rms_warn:.1f} mm/s)",
                "reading_snapshot": json.dumps(reading)
            }
            generated_alerts.append(alert)

    # 3. Rule: Temperature Critical
    if temp_c >= t_crit:
        if not is_deduplicated(machine_id, "rule_temp_crit"):
            alert = {
                "timestamp": reading.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "machine_id": machine_id,
                "severity": "critical",
                "alert_type": "rule_temp_crit",
                "message": f"Thermal runaway: Bearing housing temperature {temp_c:.1f}°C exceeds critical limit {t_crit:.1f}°C",
                "reading_snapshot": json.dumps(reading)
            }
            generated_alerts.append(alert)

    # 4. Rule: Kurtosis Impulsive Wear
    if kurtosis >= k_warn and vib_rms < v_rms_crit:
        if not is_deduplicated(machine_id, "rule_kurtosis"):
            alert = {
                "timestamp": reading.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "machine_id": machine_id,
                "severity": "warning",
                "alert_type": "rule_kurtosis",
                "message": f"High Kurtosis ({kurtosis:.2f} > {k_warn:.1f}) detected: early cyclic bearing surface defect indicated",
                "reading_snapshot": json.dumps(reading)
            }
            generated_alerts.append(alert)

    # 5. ML-Based Anomaly Score Alert (Isolation Forest)
    if anomaly_score <= ml_anom_thresh:
        if not is_deduplicated(machine_id, "ml_isolation_anomaly"):
            alert = {
                "timestamp": reading.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "machine_id": machine_id,
                "severity": "critical" if anomaly_score < (ml_anom_thresh - 0.15) else "warning",
                "alert_type": "ml_isolation_anomaly",
                "message": f"ML Anomaly Detector flagged sensor vector deviation (score: {anomaly_score:.3f})",
                "reading_snapshot": json.dumps(reading)
            }
            generated_alerts.append(alert)

    # 6. ML-Based Classifier Status (Random Forest)
    if ml_status == 2 and not is_deduplicated(machine_id, "ml_rf_crit"):
        alert = {
            "timestamp": reading.get("timestamp", datetime.now(timezone.utc).isoformat()),
            "machine_id": machine_id,
            "severity": "critical",
            "alert_type": "ml_rf_crit",
            "message": f"RandomForest ML model predicted CRITICAL machine state for {machine_id}",
            "reading_snapshot": json.dumps(reading)
        }
        generated_alerts.append(alert)
    elif ml_status == 1 and not is_deduplicated(machine_id, "ml_rf_warn"):
        alert = {
            "timestamp": reading.get("timestamp", datetime.now(timezone.utc).isoformat()),
            "machine_id": machine_id,
            "severity": "warning",
            "alert_type": "ml_rf_warn",
            "message": f"RandomForest ML model predicted impending degradation WARNING for {machine_id}",
            "reading_snapshot": json.dumps(reading)
        }
        generated_alerts.append(alert)

    # Save to SQLite and dispatch notifications
    for alert in generated_alerts:
        try:
            alert_id = database.insert_alert(alert)
            alert["id"] = alert_id
            logger.warning(f"ALERT CREATED [ID {alert_id}] ({alert['severity'].upper()}) {alert['machine_id']}: {alert['message']}")

            # Dispatch externally
            NotificationDispatcher.send_webhook(alert)
            tg_msg = f"🚨 *[{alert['severity'].upper()}] {alert['machine_id']}*\n{alert['message']}\nTime: {alert['timestamp']}"
            NotificationDispatcher.send_telegram(tg_msg)
            email_body = f"<h2>Rotary Machinery Alert: {alert['machine_id']}</h2><p><b>Severity:</b> {alert['severity'].upper()}</p><p><b>Message:</b> {alert['message']}</p><p><b>Time:</b> {alert['timestamp']}</p>"
            NotificationDispatcher.send_email(f"[{alert['severity'].upper()}] Machinery Alert: {alert['machine_id']}", email_body)
        except Exception as exc:
            logger.error(f"Error persisting/dispatching alert: {exc}")

    return generated_alerts
