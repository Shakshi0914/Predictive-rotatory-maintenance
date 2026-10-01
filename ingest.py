"""
Ingest Service for Rotary Machinery IoT Telemetry.
Subscribes to MQTT topic `plant1/+/telemetry`.
Loads trained ML models (RandomForest, IsolationForest, RUL Regressor).
Scores incoming telemetry in real-time, persists into SQLite, appends to CSV backup,
evaluates rule and ML alert thresholds, and handles automatic broker reconnection.
"""

from __future__ import annotations
import os
import sys
import json
import time
import logging
from typing import Dict, Any, Optional
import pandas as pd
import numpy as np
import paho.mqtt.client as mqtt
import joblib

import database
import alerts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [Ingest] %(message)s"
)
logger = logging.getLogger("ingest")

CSV_BACKUP_PATH = os.getenv("CSV_BACKUP_PATH", "data/telemetry_backup.csv")
MODEL_DIR = os.getenv("MODEL_DIR", "models")
DB_PATH = os.getenv("SQLITE_DB_PATH", "iot_machinery.db")

FEATURE_COLUMNS = [
    "rpm",
    "vib_x",
    "vib_y",
    "vib_z",
    "vib_rms",
    "kurtosis",
    "temp_c",
    "current_a",
    "acoustic_db"
]


class IngestionEngine:
    """Core telemetry processing engine with ML inference and persistence."""

    def __init__(self, db_path: str = DB_PATH, csv_backup_path: str = CSV_BACKUP_PATH):
        self.db_path = db_path
        self.csv_backup_path = csv_backup_path
        self.clf = None
        self.iso_forest = None
        self.rul_model = None
        self.scaler = None

        # Ensure database tables exist
        database.init_db(self.db_path)
        os.makedirs(os.path.dirname(os.path.abspath(self.csv_backup_path)), exist_ok=True)
        self.load_models()

    def load_models(self) -> None:
        """Attempt to load trained ML models from disk; fallback to heuristics if not found."""
        try:
            clf_path = os.path.join(MODEL_DIR, "random_forest_classifier.joblib")
            iso_path = os.path.join(MODEL_DIR, "isolation_forest.joblib")
            rul_path = os.path.join(MODEL_DIR, "rul_regressor.joblib")
            scaler_path = os.path.join(MODEL_DIR, "scaler.joblib")

            if os.path.exists(clf_path):
                self.clf = joblib.load(clf_path)
                logger.info("Loaded RandomForestClassifier from disk.")
            if os.path.exists(iso_path):
                self.iso_forest = joblib.load(iso_path)
                logger.info("Loaded IsolationForest from disk.")
            if os.path.exists(rul_path):
                self.rul_model = joblib.load(rul_path)
                logger.info("Loaded RUL Regressor from disk.")
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
        except Exception as exc:
            logger.warning(f"Could not load ML models ({exc}). Will utilize heuristic fallback.")

    def score_telemetry(self, reading: Dict[str, Any]) -> Dict[str, Any]:
        """Compute ML anomaly score, predicted status, and RUL estimation."""
        try:
            features = np.array([[float(reading.get(c, 0.0)) for c in FEATURE_COLUMNS]])
            
            # Anomaly Score via IsolationForest (decision_function: negative is anomalous)
            if self.iso_forest is not None:
                anomaly_score = float(self.iso_forest.decision_function(features)[0])
            else:
                # Heuristic fallback based on RMS and Kurtosis
                rms = float(reading.get("vib_rms", 2.0))
                kurt = float(reading.get("kurtosis", 3.0))
                temp = float(reading.get("temp_c", 50.0))
                score = 0.35 - (max(0, rms - 4.0) * 0.15) - (max(0, kurt - 3.5) * 0.1) - (max(0, temp - 75.0) * 0.02)
                anomaly_score = round(score, 3)

            # Operational Status via RandomForest
            if self.clf is not None:
                ml_status = int(self.clf.predict(features)[0])
            else:
                # Heuristic
                rms = float(reading.get("vib_rms", 2.0))
                temp = float(reading.get("temp_c", 50.0))
                if rms > 7.0 or temp > 85.0:
                    ml_status = 2
                elif rms > 4.5 or temp > 75.0:
                    ml_status = 1
                else:
                    ml_status = 0

            # Remaining Useful Life (RUL)
            if self.rul_model is not None:
                rul_hours = float(np.clip(self.rul_model.predict(features)[0], 0.0, 750.0))
            else:
                health = float(reading.get("health", 1.0))
                rul_hours = round(health * 720.0, 1)

            reading["anomaly_score"] = round(anomaly_score, 4)
            reading["ml_status"] = ml_status
            reading["rul_hours"] = round(rul_hours, 1)
        except Exception as exc:
            logger.error(f"Error scoring telemetry: {exc}")
            reading["anomaly_score"] = 0.0
            reading["ml_status"] = int(reading.get("status", 0))
            reading["rul_hours"] = 500.0

        return reading

    def process_message(self, topic: str, payload_bytes: bytes) -> None:
        """Parse payload, enrich with ML scores, write to SQLite and CSV, and check alerts."""
        try:
            raw_payload = payload_bytes.decode("utf-8")
            data: Dict[str, Any] = json.loads(raw_payload)

            # Ensure machine_id is present (from payload or topic)
            if "machine_id" not in data:
                parts = topic.split("/")
                data["machine_id"] = parts[1] if len(parts) >= 2 else "unknown"

            # 1. Real-time ML scoring
            enriched_reading = self.score_telemetry(data)

            # 2. Persist to SQLite
            record_id = database.insert_telemetry_reading(enriched_reading, db_path=self.db_path)

            # 3. Append to CSV backup
            self.append_to_csv_backup(enriched_reading)

            # 4. Evaluate rule & ML alert thresholds
            alerts.evaluate_telemetry_for_alerts(enriched_reading)

            logger.info(
                f"Ingested [{enriched_reading['machine_id']}] (ID {record_id}) | "
                f"Status: {enriched_reading['status']} | ML: {enriched_reading['ml_status']} | "
                f"AnomScore: {enriched_reading['anomaly_score']:.3f} | RUL: {enriched_reading['rul_hours']}h"
            )
        except json.JSONDecodeError as err:
            logger.error(f"Invalid JSON payload on topic {topic}: {err}")
        except Exception as exc:
            logger.error(f"Error processing telemetry message: {exc}", exc_info=True)

    def append_to_csv_backup(self, reading: Dict[str, Any]) -> None:
        """Thread-safe CSV append with headers if file does not exist."""
        try:
            file_exists = os.path.exists(self.csv_backup_path)
            df = pd.DataFrame([reading])
            df.to_csv(self.csv_backup_path, mode="a", header=not file_exists, index=False)
        except Exception as exc:
            logger.warning(f"Could not append to CSV backup: {exc}")


def start_mqtt_ingest() -> None:
    """Initialize MQTT client with auto-reconnect, subscribe, and start ingestion loop."""
    broker_host = os.getenv("MQTT_BROKER_HOST", "broker.hivemq.com")
    broker_port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    username = os.getenv("MQTT_USERNAME", "")
    password = os.getenv("MQTT_PASSWORD", "")
    use_tls = os.getenv("MQTT_USE_TLS", "False").lower() in ("true", "1", "yes")
    topic_filter = f"{os.getenv('MQTT_TOPIC_PREFIX', 'plant1')}/+/telemetry"

    engine = IngestionEngine()

    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"iot_ingest_{int(time.time())}"
    )

    if username and password:
        client.username_pw_set(username, password)

    if use_tls or broker_port == 8883:
        client.tls_set()
        logger.info("TLS enabled for MQTT ingest connection.")

    # Configure auto-reconnect backoff
    client.reconnect_delay_set(min_delay=1, max_delay=60)

    def on_connect(cl: mqtt.Client, userdata: Any, flags: Any, rc: int, properties: Any = None):
        if rc == 0:
            logger.info(f"Connected to MQTT broker. Subscribing to: {topic_filter}")
            cl.subscribe(topic_filter, qos=1)
        else:
            logger.error(f"Failed to connect to MQTT broker. Return code: {rc}")

    def on_disconnect(cl: mqtt.Client, userdata: Any, disconnect_flags: Any, rc: int, properties: Any = None):
        logger.warning(f"MQTT Disconnected (rc={rc}). Automatic reconnection in progress...")

    def on_message(cl: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage):
        engine.process_message(msg.topic, msg.payload)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    logger.info(f"Connecting to MQTT broker at {broker_host}:{broker_port}...")
    try:
        client.connect(broker_host, broker_port, keepalive=60)
    except Exception as exc:
        logger.warning(f"Primary connection failed ({exc}). Retrying with fallback public broker...")
        fallback_host = os.getenv("MQTT_FALLBACK_HOST", "broker.hivemq.com")
        fallback_port = int(os.getenv("MQTT_FALLBACK_PORT", "1883"))
        client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"iot_ingest_fallback_{int(time.time())}"
        )
        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.on_message = on_message
        client.connect(fallback_host, fallback_port, keepalive=60)

    try:
        client.loop_forever()
    except KeyboardInterrupt:
        logger.info("Ingest service stopped by user.")
    finally:
        client.disconnect()


if __name__ == "__main__":
    start_mqtt_ingest()
