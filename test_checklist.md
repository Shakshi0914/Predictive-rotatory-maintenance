# Predictive Maintenance IoT Verification Checklist

Use this structured test checklist to verify each pipeline stage in the Predictive Maintenance system:

---

## 1. MQTT Connectivity & Telemetry Flow
- [ ] **HiveMQ Cloud TLS Test**:
  - Set `MQTT_BROKER_HOST`, `MQTT_USERNAME`, `MQTT_PASSWORD` in `.env`.
  - Run `python generator.py --interval 2.0`.
  - Verify terminal output shows: `Connected to MQTT Broker at ...:8883` and `TLS enabled`.
- [ ] **Public Fallback Test**:
  - Leave username/password blank to trigger the fallback to `broker.hivemq.com:1883`.
  - Confirm messages publish to `plant1/<machine_id>/telemetry`.
- [ ] **Payload Integrity**:
  - Inspect JSON payload; verify all 13 keys are present: `timestamp`, `machine_id`, `rpm`, `vib_x`, `vib_y`, `vib_z`, `vib_rms`, `kurtosis`, `temp_c`, `current_a`, `acoustic_db`, `health`, `status`.

---

## 2. SQLite Database & Storage
- [ ] **Automatic Schema Initialization**:
  - Run `python ingest.py`. Verify `iot_machinery.db` is generated with tables: `telemetry`, `alerts`, `users`, `system_thresholds`.
- [ ] **WAL Mode & Concurrent Reads**:
  - Confirm `PRAGMA journal_mode=WAL;` is set.
- [ ] **Data Persistence**:
  - Query SQLite: `SELECT COUNT(*) FROM telemetry;`. Confirm count increments with each generator message.
- [ ] **CSV Backup Verification**:
  - Check `data/telemetry_backup.csv` to ensure rows are appended continuously.

---

## 3. Machine Learning Inference
- [ ] **Offline Training Set Generation**:
  - Run `python generator.py --offline --samples 1000`.
  - Verify `data/rotary_machinery_training.csv` is populated with normal, warning, and critical labels.
- [ ] **Model Training & Artifacts**:
  - Run `python train_model.py`.
  - Verify classification report is printed with >95% F1-score across all 3 classes.
  - Verify artifacts saved in `models/`: `random_forest_classifier.joblib`, `isolation_forest.joblib`, `rul_regressor.joblib`, `scaler.joblib`, `metadata.json`.
- [ ] **Real-time Ingestion Inference**:
  - Verify `ingest.py` scores each incoming message: `anomaly_score` (negative = outlier), `ml_status` (0, 1, or 2), and `rul_hours` (>0).

---

## 4. Authentication, Security & Lockout
- [ ] **Default Admin Seeding**:
  - Verify initial run creates `admin` with `must_change_password = 1`.
  - Verify initial run creates read-only user `viewer`.
- [ ] **Force Password Change**:
  - Log in as `admin` with default password `AdminChangeMe123!`.
  - Confirm system blocks dashboard access until password update prompt is completed.
- [ ] **5-Attempt / 5-Minute Account Lockout**:
  - Attempt login with username `viewer` and invalid password 5 consecutive times.
  - On the 5th failure, confirm error: `"Account locked for 5 minutes due to 5 consecutive failed attempts."`
  - Attempt login with correct password during the 5-minute lockout; confirm access is rejected with remaining time.
- [ ] **Role-Based Access Control (RBAC)**:
  - Log in as `viewer`: verify Settings tab and "Acknowledge Alert" buttons are restricted or read-only.
  - Log in as `admin`: verify full privileges to adjust thresholds, acknowledge alerts, and manage users.

---

## 5. Alert Triggering & Deduplication
- [ ] **Rule-Based Triggers**:
  - Verify alerts trigger when `vib_rms > 4.5` (warning) or `vib_rms > 7.0` (critical).
  - Verify alerts trigger when `temp_c > 85.0` (critical) or `kurtosis > 3.8`.
- [ ] **ML-Based Triggers**:
  - Verify alerts fire when `anomaly_score < -0.15` or `ml_status in (1, 2)`.
- [ ] **30-Second Deduplication**:
  - Stream persistent critical readings for `pump-01`.
  - Confirm alerts table records at most ONE alert of the same type per 30 seconds for `pump-01`.
- [ ] **External Notifications**:
  - Configure `WEBHOOK_URL="https://httpbin.org/post"` in `.env`.
  - Trigger an alert and confirm HTTP 200 payload received.
- [ ] **UI Notification Banner**:
  - Check dashboard top bar: verify red pulsing alert banner and badge count for unacknowledged alerts.
