# Predictive Maintenance Dashboard for Rotary Machinery using IoT Data

Enterprise-grade IoT pipeline for rotary equipment (pumps, induction motors, axial fans, screw compressors). Ingests high-frequency multi-axial vibration, temperature, kurtosis, and acoustic telemetry over MQTT (HiveMQ Cloud with TLS), applies real-time Machine Learning anomaly scoring and failure prediction, and delivers role-based alerts and interactive analytics.

---

## 1. System Architecture

```text
+-------------------------+
| Synthetic Data Generator|
|  (4 rotary machines)    |
+------------+------------+
             |
             | MQTT over TLS (Port 8883, QoS 1)
             v
+-------------------------+
|   HiveMQ Cloud Cluster  |
|  (plant1/+/telemetry)   |
+------------+------------+
             |
             v
+-------------------------+       +------------------------------+
|     Ingest Service      | <---> | Trained ML Models (joblib)   |
|   (auto-reconnecting)   |       | - IsolationForest (Anomaly)  |
+------------+------------+       | - RandomForest (0/1/2 Status)|
             |                    | - GradientBoosting (RUL Hrs) |
             v                    +------------------------------+
+-------------------------+
|     SQLite Database     |
|   (telemetry, alerts)   |
+------------+------------+
             |
             +------------------------------+
             |                              |
             v                              v
+-------------------------+    +---------------------------+
| Alert Engine & Dispatch |    | Interactive Web Dashboard |
| (30s Dedup, Webhook/    |    | (Overview, Machine Detail,|
|  Telegram/SMTP Alerts)  |    |  Alerts, Reports, Admin)  |
+-------------------------+    +---------------------------+
```

---

## 2. Tech Stack & Architectural Decisions

- **Python 3.10+**: Core backend, generator, and ingestion engine.
- **paho-mqtt (v2 API)**: Modern callback signature with TLS encryption support.
- **SQLite (sqlite3 with WAL mode)**: High-speed local database storing telemetry, incident logs, users, and thresholds.
- **scikit-learn & joblib**:
  - `RandomForestClassifier`: Multi-class classification (0=Normal, 1=Warning, 2=Critical).
  - `IsolationForest`: Unsupervised anomaly detection trained strictly on pristine normal operations.
  - `GradientBoostingRegressor`: Remaining Useful Life (RUL) estimation in operational hours.
- **Web Dashboard**: Modern Decoupled Web Application & Flask REST API (plus Streamlit + Plotly alternative script `app_streamlit.py`).
  * **Why Flask + Modern Web Frontend (over Streamlit)**:
    1. Streamlit re-executes the entire script on each user interaction, which makes background ingestion threads, session state, 5-second polling across multiple clients, and role-based access control clunky.
    2. Flask provides clean REST endpoints (`/api/telemetry`, `/api/alerts`, `/api/settings`) separating data ingestion from dashboard clients.
    3. Allows high-performance client-side rendering with SVG/Canvas charts and sub-second alert updates.

---

## 3. HiveMQ Cloud Setup Guide

1. Sign up for a free tier HiveMQ Cloud account at: [https://www.hivemq.com/cloud/](https://www.hivemq.com/cloud/).
2. Click **Create Cluster** (Free Tier gives up to 100 concurrent devices and 10 GB/month).
3. Under the **Access Management** tab:
   - Create a new MQTT User:
     - Username: `iot_telemetry_user`
     - Password: `YourStrongMqttPassword123!`
     - Permissions: Allow Publish & Subscribe on `plant1/#`.
4. Under the **Cluster Overview** tab, copy your Cluster URL (e.g., `xyz123456.s1.eu.hivemq.cloud`).
5. Open `.env` and fill in:
   ```env
   MQTT_BROKER_HOST=xyz123456.s1.eu.hivemq.cloud
   MQTT_BROKER_PORT=8883
   MQTT_USE_TLS=True
   MQTT_USERNAME=iot_telemetry_user
   MQTT_PASSWORD=YourStrongMqttPassword123!
   MQTT_TOPIC_PREFIX=plant1
   ```
*(Note: If you do not have HiveMQ Cloud ready right now, the system automatically falls back to the public broker `broker.hivemq.com:1883`.)*

---

## 4. Installation & Quickstart

### Step 1: Install Dependencies
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

### Step 2: Generate Offline Dataset & Train ML Models
```bash
# 1. Generate 6,000 labeled samples across the 4 machines
python generator.py --offline --samples 1500 --output data/rotary_machinery_training.csv

# 2. Train Random Forest, Isolation Forest, and RUL Regressor
python train_model.py
```
This saves serialized models into the `models/` directory:
- `models/random_forest_classifier.joblib`
- `models/isolation_forest.joblib`
- `models/rul_regressor.joblib`
- `models/scaler.joblib`

### Step 3: Run the Ingest Service (Terminal 1)
```bash
python ingest.py
```
*Listens to `plant1/+/telemetry`, evaluates ML models, stores records in `iot_machinery.db`, appends to CSV backup, and triggers alerts.*

### Step 4: Run the Real-Time Synthetic Generator (Terminal 2)
```bash
python generator.py --interval 2.0
```
*Simulates all 4 machines (`pump-01`, `motor-02`, `fan-03`, `compressor-04`) with rotational physics, load variations, random bearing wear, imbalance, and overheating.*

### Step 5: Run the Web Dashboard (Terminal 3)
```bash
# Option A: Modern Full-Stack Web App (Vite + React + Flask / Node)
npm run dev
# Then open http://localhost:3000

# Option B: Flask Standalone API Server
python app.py
# Serves http://localhost:5000

# Option C: Streamlit + Plotly Alternative
streamlit run app_streamlit.py --server.port 8501
```

---

## 5. Security & Authentication

- **Database**: User credentials stored in SQLite `users` table with **bcrypt** salted hashes.
- **Default Accounts**:
  - **Administrator**: `admin` / `AdminChangeMe123!` (Forces password change on initial login).
  - **Viewer**: `viewer` / `Viewer123!` (Read-only analytics access).
- **Brute-Force Protection**: Accounts are automatically locked for **5 minutes** after **5 consecutive failed attempts**.
- **Role-Based Access Control**:
  - `admin`: Can change vibration/temperature thresholds, acknowledge/resolve alerts, manage user accounts, and reset passwords.
  - `viewer`: Can view live telemetry, machine charts, and download reports.

---

## 6. Alert System Configuration

Alerts support rule-based physical limits and ML anomaly scores:
- **Vibration RMS**: Warning > 4.5 mm/s | Critical > 7.0 mm/s
- **Temperature**: Warning > 75.0 °C | Critical > 85.0 °C
- **Kurtosis**: Warning > 3.8 (impulsive bearing impacts)
- **ML Anomaly**: IsolationForest score < -0.15 or RandomForest status in (1, 2)
- **30-Second Deduplication**: Prevents alert floods by suppressing duplicate alert types per machine for 30 seconds.

Configure external channels in `.env`:
```env
# Webhook (Slack, Discord, PagerDuty)
WEBHOOK_URL="https://httpbin.org/post"

# Telegram Bot
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_CHAT_ID="your_chat_id"

# SMTP Email
SMTP_SERVER="smtp.gmail.com"
SMTP_PORT=587
SMTP_USERNAME="alert-notifications@yourplant.com"
SMTP_PASSWORD="your-app-password"
ALERT_EMAIL_RECIPIENT="maintenance-lead@yourplant.com"
```

---

## 7. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `paho.mqtt: Connection Refused` | Incorrect credentials or TLS disabled | Check cluster URL in `.env`, verify `MQTT_USE_TLS=True` and port is 8883. |
| `FileNotFoundError: models/...` | Models not yet trained | Run `python generator.py --offline` followed by `python train_model.py`. |
| `Account locked for 5 minutes` | 5 failed passwords entered | Wait 5 minutes for timer expiry or unlock user via admin console in SQLite. |
| `sqlite3.OperationalError: database is locked` | High concurrent file access | The database uses WAL mode (`PRAGMA journal_mode=WAL;`). Verify disk permissions. |
