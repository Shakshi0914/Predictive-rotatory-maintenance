"""
Database module for Predictive Maintenance IoT System.
Provides SQLite initialization, schema migration, password hashing (bcrypt),
user authentication with account lockout (5 attempts / 5 minutes), and CRUD operations.
"""

from __future__ import annotations
import sqlite3
import os
import time
import logging
import hmac
import hashlib
import secrets
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timezone

try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    bcrypt = None  # type: ignore
    HAS_BCRYPT = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("Database")

DEFAULT_DB_PATH = os.getenv("SQLITE_DB_PATH", "iot_machinery.db")
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 300  # 5 minutes


def get_db_connection(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Return a configured sqlite3 connection with dict-like row access."""
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")  # Better concurrent performance
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db(db_path: str = DEFAULT_DB_PATH) -> None:
    """
    Initialize SQLite database schema and seed default admin user.
    Creates tables: telemetry, alerts, users, system_thresholds.
    """
    logger.info("Initializing database schema at: %s", db_path)
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    # 1. Telemetry Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            machine_id TEXT NOT NULL,
            rpm REAL NOT NULL,
            vib_x REAL NOT NULL,
            vib_y REAL NOT NULL,
            vib_z REAL NOT NULL,
            vib_rms REAL NOT NULL,
            kurtosis REAL NOT NULL,
            temp_c REAL NOT NULL,
            current_a REAL NOT NULL,
            acoustic_db REAL NOT NULL,
            health REAL NOT NULL,
            status INTEGER NOT NULL,
            anomaly_score REAL DEFAULT 0.0,
            ml_status INTEGER DEFAULT 0,
            rul_hours REAL DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time ON telemetry(machine_id, timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_status ON telemetry(status);")

    # 2. Alerts Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            machine_id TEXT NOT NULL,
            severity TEXT NOT NULL,       -- 'warning', 'critical'
            alert_type TEXT NOT NULL,     -- 'rule_vib', 'rule_temp', 'ml_anomaly', 'ml_status'
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'new', -- 'new', 'acknowledged', 'resolved'
            acknowledged_by TEXT,
            acknowledged_at TEXT,
            resolved_by TEXT,
            resolved_at TEXT,
            reading_snapshot TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_machine_status ON alerts(machine_id, status);")

    # 3. Users Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer', -- 'admin', 'viewer'
            failed_attempts INTEGER DEFAULT 0,
            locked_until REAL DEFAULT 0,
            must_change_password INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TEXT
        );
    """)

    # 4. Configurable Thresholds Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_thresholds (
            key TEXT PRIMARY KEY,
            value REAL NOT NULL,
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Seed Default Thresholds
    default_thresholds = [
        ("thresh_vib_rms_warning", 4.5, "Vibration RMS Warning limit in mm/s"),
        ("thresh_vib_rms_critical", 7.0, "Vibration RMS Critical limit in mm/s"),
        ("thresh_temp_warning", 75.0, "Temperature Warning limit in Celsius"),
        ("thresh_temp_critical", 85.0, "Temperature Critical limit in Celsius"),
        ("thresh_kurtosis_warning", 3.8, "Vibration Kurtosis spike indicator"),
        ("thresh_anomaly_score", -0.15, "Isolation Forest decision threshold"),
    ]
    for key, val, desc in default_thresholds:
        cursor.execute("""
            INSERT OR IGNORE INTO system_thresholds (key, value, description)
            VALUES (?, ?, ?);
        """, (key, val, desc))

    conn.commit()

    # Seed Default Admin & Viewer users
    seed_default_users(cursor)
    conn.commit()
    conn.close()
    logger.info("Database initialized successfully.")


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt if available, or pbkdf2_hmac as standard library fallback."""
    if HAS_BCRYPT and bcrypt is not None:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    else:
        salt = secrets.token_hex(16)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return f"pbkdf2:sha256:100000${salt}${key.hex()}"


def check_password(password: str, hashed_password: str) -> bool:
    """Verify plaintext password against bcrypt hash or pbkdf2 hash."""
    if hashed_password.startswith("pbkdf2:"):
        try:
            _, algo, iters, salt, key = hashed_password.split("$")
            new_key = hashlib.pbkdf2_hmac(algo.split(":")[-1], password.encode("utf-8"), salt.encode("utf-8"), int(iters))
            return hmac.compare_digest(new_key.hex(), key)
        except Exception:
            return False
    elif HAS_BCRYPT and bcrypt is not None:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    else:
        # Cannot verify bcrypt hash without bcrypt library
        return False


def seed_default_users(cursor: sqlite3.Cursor) -> None:
    """Seed initial admin and viewer if users table is empty."""
    cursor.execute("SELECT COUNT(*) as cnt FROM users;")
    count = cursor.fetchone()["cnt"]
    if count == 0:
        logger.info("Seeding default admin and viewer accounts...")
        # Admin: forces password change on first login
        admin_pass = os.getenv("DEFAULT_ADMIN_PASSWORD", "AdminChangeMe123!")
        admin_hash = hash_password(admin_pass)
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, must_change_password)
            VALUES (?, ?, 'admin', 1);
        """, ("admin", admin_hash))

        # Viewer: read-only demo user
        viewer_hash = hash_password("Viewer123!")
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, must_change_password)
            VALUES (?, ?, 'viewer', 0);
        """, ("viewer", viewer_hash))
        logger.info("Seeded user 'admin' (must change password) and 'viewer'")


def authenticate_user(username: str, password: str, db_path: str = DEFAULT_DB_PATH) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Authenticate user with credential checking and 5-attempt/5-minute lockout policy.
    Returns (success, message, user_dict)
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?;", (username,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return False, "Invalid username or password.", None

    user = dict(row)
    now = time.time()

    # Check if locked out
    if user["locked_until"] and user["locked_until"] > now:
        remaining_secs = int(user["locked_until"] - now)
        remaining_mins = (remaining_secs // 60) + 1
        conn.close()
        return False, f"Account locked due to {MAX_FAILED_ATTEMPTS} failed attempts. Try again in {remaining_mins} minute(s).", None

    # Check password match
    if check_password(password, user["password_hash"]):
        # Reset failed attempts and update last_login
        cursor.execute("""
            UPDATE users
            SET failed_attempts = 0, locked_until = 0, last_login = ?
            WHERE id = ?;
        """, (datetime.now(timezone.utc).isoformat(), user["id"]))
        conn.commit()
        conn.close()

        # Sanitize sensitive fields before returning
        user_info = {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "must_change_password": bool(user["must_change_password"])
        }
        return True, "Authentication successful.", user_info
    else:
        new_failed = user["failed_attempts"] + 1
        locked_until = 0.0
        msg = f"Invalid password. Attempt {new_failed} of {MAX_FAILED_ATTEMPTS}."

        if new_failed >= MAX_FAILED_ATTEMPTS:
            locked_until = now + LOCKOUT_DURATION_SECONDS
            msg = f"Account locked for 5 minutes due to {MAX_FAILED_ATTEMPTS} consecutive failed attempts."

        cursor.execute("""
            UPDATE users
            SET failed_attempts = ?, locked_until = ?
            WHERE id = ?;
        """, (new_failed, locked_until, user["id"]))
        conn.commit()
        conn.close()
        return False, msg, None


def update_user_password(username: str, new_password: str, db_path: str = DEFAULT_DB_PATH) -> bool:
    """Update a user's password and clear must_change_password flag."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    new_hash = hash_password(new_password)
    cursor.execute("""
        UPDATE users
        SET password_hash = ?, must_change_password = 0, failed_attempts = 0, locked_until = 0
        WHERE username = ?;
    """, (new_hash, username))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def insert_telemetry_reading(reading: Dict[str, Any], db_path: str = DEFAULT_DB_PATH) -> int:
    """Insert a single machine telemetry record into SQLite."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO telemetry (
            timestamp, machine_id, rpm, vib_x, vib_y, vib_z, vib_rms,
            kurtosis, temp_c, current_a, acoustic_db, health, status,
            anomaly_score, ml_status, rul_hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        reading.get("timestamp"),
        reading.get("machine_id"),
        float(reading.get("rpm", 0.0)),
        float(reading.get("vib_x", 0.0)),
        float(reading.get("vib_y", 0.0)),
        float(reading.get("vib_z", 0.0)),
        float(reading.get("vib_rms", 0.0)),
        float(reading.get("kurtosis", 3.0)),
        float(reading.get("temp_c", 0.0)),
        float(reading.get("current_a", 0.0)),
        float(reading.get("acoustic_db", 0.0)),
        float(reading.get("health", 1.0)),
        int(reading.get("status", 0)),
        float(reading.get("anomaly_score", 0.0)),
        int(reading.get("ml_status", 0)),
        float(reading.get("rul_hours", 0.0))
    ))
    record_id = cursor.lastrowid or 0
    conn.commit()
    conn.close()
    return record_id


def insert_alert(alert: Dict[str, Any], db_path: str = DEFAULT_DB_PATH) -> int:
    """Store an alert incident into SQLite."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO alerts (
            timestamp, machine_id, severity, alert_type, message, status, reading_snapshot
        ) VALUES (?, ?, ?, ?, ?, 'new', ?);
    """, (
        alert.get("timestamp"),
        alert.get("machine_id"),
        alert.get("severity", "warning"),
        alert.get("alert_type", "rule_based"),
        alert.get("message", "Telemetry threshold violated"),
        str(alert.get("reading_snapshot", ""))
    ))
    alert_id = cursor.lastrowid or 0
    conn.commit()
    conn.close()
    return alert_id


def get_system_thresholds(db_path: str = DEFAULT_DB_PATH) -> Dict[str, float]:
    """Retrieve all current system thresholds from SQLite."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_thresholds;")
    rows = cursor.fetchall()
    conn.close()
    return {r["key"]: float(r["value"]) for r in rows}


def update_system_threshold(key: str, value: float, db_path: str = DEFAULT_DB_PATH) -> bool:
    """Update a threshold configuration."""
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO system_thresholds (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;
    """, (key, value))
    conn.commit()
    conn.close()
    return True


if __name__ == "__main__":
    init_db()
    print("Database initialization check complete.")
