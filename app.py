"""
Flask Application & REST API Server for Rotary Machinery Predictive Maintenance.
Serves dashboard endpoints, session-based authentication, alert management,
and real-time machine telemetry analytics.

Why Flask + Modern Web Frontend (over Streamlit):
1. Clean RESTful architectural decoupling between ingestion workers and frontend views.
2. Lightweight, efficient 5-second polling without re-executing full Python scripts on each interaction.
3. Fine-grained RBAC (Role-Based Access Control) for Admins vs Viewers.
4. Production readiness with standard WSGI/ASGI servers (Gunicorn/Uvicorn).
"""

from __future__ import annotations
import os
import io
import csv
import logging
from functools import wraps
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from flask import Flask, request, jsonify, session, send_file, render_template_string
from flask_cors import CORS
import database
import alerts

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [FlaskAPI] %(message)s")
logger = logging.getLogger("app")

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "predictive-maintenance-secret-key-98214")
CORS(app, supports_credentials=True)

# Ensure database is primed
database.init_db()


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return jsonify({"error": "Unauthorized. Please log in."}), 401
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return jsonify({"error": "Unauthorized. Please log in."}), 401
        if session["user"].get("role") != "admin":
            return jsonify({"error": "Forbidden. Admin privileges required."}), 403
        return f(*args, **kwargs)
    return decorated_function


# -------------------------------------------------------------
# Authentication Endpoints
# -------------------------------------------------------------

@app.route("/api/auth/login", methods=["POST"])
def api_login():
    """Authenticate with username & password. Enforces 5-attempt/5-minute lockout."""
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    success, message, user_info = database.authenticate_user(username, password)
    if not success:
        return jsonify({"error": message}), 401

    session["user"] = user_info
    return jsonify({
        "message": message,
        "user": user_info,
        "must_change_password": user_info["must_change_password"]
    })


@app.route("/api/auth/logout", methods=["POST"])
def api_logout():
    session.pop("user", None)
    return jsonify({"message": "Logged out successfully."})


@app.route("/api/auth/me", methods=["GET"])
def api_me():
    if "user" in session:
        return jsonify({"authenticated": True, "user": session["user"]})
    return jsonify({"authenticated": False}), 200


@app.route("/api/auth/change-password", methods=["POST"])
@login_required
def api_change_password():
    data = request.get_json() or {}
    new_password = data.get("new_password", "")
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long."}), 400

    username = session["user"]["username"]
    updated = database.update_user_password(username, new_password)
    if updated:
        session["user"]["must_change_password"] = False
        return jsonify({"message": "Password updated successfully."})
    return jsonify({"error": "Could not update password."}), 500


# -------------------------------------------------------------
# Telemetry & Fleet Endpoints
# -------------------------------------------------------------

@app.route("/api/telemetry/latest", methods=["GET"])
@login_required
def api_telemetry_latest():
    """Get the latest reading for each of the 4 rotary machines."""
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*
        FROM telemetry t
        INNER JOIN (
            SELECT machine_id, MAX(id) as max_id
            FROM telemetry
            GROUP BY machine_id
        ) latest ON t.id = latest.max_id;
    """)
    rows = cursor.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/telemetry/history", methods=["GET"])
@login_required
def api_telemetry_history():
    """Get time-series history for a selected machine (limit to last N points)."""
    machine_id = request.args.get("machine_id", "pump-01")
    limit = int(request.args.get("limit", 60))

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM telemetry
        WHERE machine_id = ?
        ORDER BY id DESC
        LIMIT ?;
    """, (machine_id, limit))
    rows = cursor.fetchall()
    conn.close()

    # Return chronological order (oldest to newest)
    result = [dict(r) for r in reversed(rows)]
    return jsonify(result)


# -------------------------------------------------------------
# Alerts Endpoints
# -------------------------------------------------------------

@app.route("/api/alerts", methods=["GET"])
@login_required
def api_get_alerts():
    """Query alerts with optional status and machine filter."""
    status_filter = request.args.get("status")
    machine_filter = request.args.get("machine_id")

    query = "SELECT * FROM alerts WHERE 1=1"
    params = []

    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)
    if machine_filter:
        query += " AND machine_id = ?"
        params.append(machine_filter)

    query += " ORDER BY id DESC LIMIT 100;"

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows])


@app.route("/api/alerts/<int:alert_id>/acknowledge", methods=["POST"])
@admin_required
def api_acknowledge_alert(alert_id: int):
    """Admin only: acknowledge an active alert."""
    username = session["user"]["username"]
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE alerts
        SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = ?
        WHERE id = ?;
    """, (username, datetime.now(timezone.utc).isoformat(), alert_id))
    conn.commit()
    conn.close()
    return jsonify({"message": f"Alert {alert_id} acknowledged by {username}."})


@app.route("/api/alerts/<int:alert_id>/resolve", methods=["POST"])
@admin_required
def api_resolve_alert(alert_id: int):
    """Admin only: mark alert as resolved."""
    username = session["user"]["username"]
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE alerts
        SET status = 'resolved', resolved_by = ?, resolved_at = ?
        WHERE id = ?;
    """, (username, datetime.now(timezone.utc).isoformat(), alert_id))
    conn.commit()
    conn.close()
    return jsonify({"message": f"Alert {alert_id} marked as resolved."})


# -------------------------------------------------------------
# Data Reports & CSV Download
# -------------------------------------------------------------

@app.route("/api/reports/download-csv", methods=["GET"])
@login_required
def api_download_csv():
    """Export filtered telemetry data to CSV file."""
    machine_id = request.args.get("machine_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    query = "SELECT * FROM telemetry WHERE 1=1"
    params = []
    if machine_id:
        query += " AND machine_id = ?"
        params.append(machine_id)
    if start_date:
        query += " AND timestamp >= ?"
        params.append(start_date)
    if end_date:
        query += " AND timestamp <= ?"
        params.append(end_date)

    query += " ORDER BY id DESC LIMIT 5000;"

    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return jsonify({"error": "No records found for specified criteria"}), 404

    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(rows[0].keys())  # write header
    for r in rows:
        cw.writerow(list(r))

    output = io.BytesIO()
    output.write(si.getvalue().encode("utf-8"))
    output.seek(0)

    filename = f"telemetry_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return send_file(output, mimetype="text/csv", as_attachment=True, download_name=filename)


# -------------------------------------------------------------
# Settings & User Management (Admin Only)
# -------------------------------------------------------------

@app.route("/api/settings/thresholds", methods=["GET"])
@login_required
def api_get_thresholds():
    return jsonify(database.get_system_thresholds())


@app.route("/api/settings/thresholds", methods=["POST"])
@admin_required
def api_update_thresholds():
    data = request.get_json() or {}
    for key, val in data.items():
        try:
            database.update_system_threshold(key, float(val))
        except ValueError:
            pass
    return jsonify({"message": "Thresholds updated successfully."})


@app.route("/api/admin/users", methods=["GET"])
@admin_required
def api_list_users():
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, failed_attempts, locked_until, must_change_password, created_at, last_login FROM users;")
    rows = cursor.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    logger.info(f"Starting Flask Predictive Maintenance API server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
