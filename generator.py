"""
Synthetic IoT Telemetry Generator for Rotary Machinery.
Simulates realistic industrial operations for pump-01, motor-02, fan-03, and compressor-04.
Features:
- Physics-based sensor model (RPM, Tri-axial vibration, RMS, Kurtosis, Temp, Current, Acoustic dB, Health)
- Duty-cycle load cycles & Gaussian noise
- Degradation episodes: Bearing wear, Mechanical imbalance, Overheating
- Automatic maintenance reset upon threshold depletion
- Dual execution mode: Real-time MQTT stream (HiveMQ Cloud / Fallback broker) OR Offline CSV dataset generator
- paho-mqtt v2 Callback API with TLS
"""

from __future__ import annotations
import os
import sys
import json
import time
import math
import random
import argparse
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
import paho.mqtt.client as mqtt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [Generator] %(message)s"
)
logger = logging.getLogger("generator")

# Machine Profiles
MACHINES_CONFIG = {
    "pump-01": {
        "name": "Centrifugal Slurry Pump",
        "base_rpm": 1750.0,
        "rpm_fluct": 15.0,
        "base_temp": 52.0,
        "base_current": 14.5,
        "base_vib_rms": 1.8,
        "base_kurtosis": 2.95,
        "base_acoustic": 68.0,
        "deg_rate": 0.003
    },
    "motor-02": {
        "name": "Induction Drive Motor",
        "base_rpm": 3550.0,
        "rpm_fluct": 10.0,
        "base_temp": 60.0,
        "base_current": 28.0,
        "base_vib_rms": 2.1,
        "base_kurtosis": 3.02,
        "base_acoustic": 72.0,
        "deg_rate": 0.0025
    },
    "fan-03": {
        "name": "Cooling Tower Axial Fan",
        "base_rpm": 1180.0,
        "rpm_fluct": 20.0,
        "base_temp": 42.0,
        "base_current": 9.2,
        "base_vib_rms": 1.4,
        "base_kurtosis": 2.90,
        "base_acoustic": 65.0,
        "deg_rate": 0.0035
    },
    "compressor-04": {
        "name": "Rotary Screw Compressor",
        "base_rpm": 2900.0,
        "rpm_fluct": 25.0,
        "base_temp": 68.0,
        "base_current": 32.5,
        "base_vib_rms": 2.5,
        "base_kurtosis": 3.05,
        "base_acoustic": 78.0,
        "deg_rate": 0.004
    }
}


@dataclass
class MachineState:
    machine_id: str
    health: float = 1.0  # 1.0 (new) to 0.0 (failed)
    status: int = 0       # 0=normal, 1=warning, 2=critical
    episode: Optional[str] = None  # None, "bearing_wear", "imbalance", "overheating"
    episode_progress: float = 0.0  # 0.0 to 1.0
    cycles_in_episode: int = 0
    total_cycles: int = 0
    cumulative_hours: float = 0.0


class RotaryMachinerySimulator:
    """Simulates physical rotational dynamics, thermal balance, and degradation phenomena."""

    def __init__(self, machine_id: str, config: Dict[str, Any]):
        self.machine_id = machine_id
        self.cfg = config
        self.state = MachineState(machine_id=machine_id)

    def trigger_episode(self, episode_type: str) -> None:
        """Manually or probabilistically inject a failure mode."""
        self.state.episode = episode_type
        self.state.episode_progress = 0.0
        self.state.cycles_in_episode = 0
        logger.warning(f"[{self.machine_id}] Initiated degradation episode: {episode_type}")

    def reset_maintenance(self) -> None:
        """Simulate physical maintenance overhaul and sensor baseline restoration."""
        self.state.health = round(random.uniform(0.96, 1.0), 3)
        self.state.status = 0
        self.state.episode = None
        self.state.episode_progress = 0.0
        self.state.cycles_in_episode = 0
        logger.info(f"[{self.machine_id}] Maintenance reset completed. Health restored to {self.state.health:.2f}")

    def step(self, dt_seconds: float = 1.0) -> Dict[str, Any]:
        """Advance simulation by dt_seconds and calculate realistic sensor outputs."""
        self.state.total_cycles += 1
        self.state.cumulative_hours += dt_seconds / 3600.0

        # Periodic duty-cycle load variation (sinusoidal day/shift oscillation + slight noise)
        shift_phase = (self.state.total_cycles % 360) / 360.0 * 2.0 * math.pi
        load_factor = 0.85 + 0.15 * math.sin(shift_phase) + random.gauss(0, 0.02)
        load_factor = max(0.6, min(1.3, load_factor))

        # Random degradation trigger if operating normally
        if self.state.episode is None:
            # 1.5% chance per cycle to begin an episode if health has natural wear
            if random.random() < 0.015:
                chosen_episode = random.choice(["bearing_wear", "imbalance", "overheating"])
                self.trigger_episode(chosen_episode)
            else:
                # Gradual background wear
                self.state.health = max(0.05, self.state.health - (self.cfg["deg_rate"] * 0.05))

        # Progress active episode
        vib_boost_x = 0.0
        vib_boost_y = 0.0
        vib_boost_z = 0.0
        temp_boost = 0.0
        kurtosis_boost = 0.0
        acoustic_boost = 0.0

        if self.state.episode:
            self.state.cycles_in_episode += 1
            # Advance progress non-linearly
            prog = min(1.0, self.state.cycles_in_episode * 0.04)
            self.state.episode_progress = prog
            self.state.health = max(0.05, 1.0 - (0.95 * (prog ** 1.3)))

            if self.state.episode == "bearing_wear":
                # High-frequency impacting spikes kurtosis and axial vibration (Z)
                kurtosis_boost = 4.2 * (prog ** 1.5)
                vib_boost_z = 5.5 * (prog ** 1.8)
                vib_boost_x = 2.0 * prog
                vib_boost_y = 2.2 * prog
                temp_boost = 18.0 * (prog ** 1.2)
                acoustic_boost = 16.0 * prog

            elif self.state.episode == "imbalance":
                # 1X rotational vibration surges in radial axes (X and Y), normal kurtosis
                vib_boost_x = 6.2 * (prog ** 1.4)
                vib_boost_y = 5.8 * (prog ** 1.4)
                vib_boost_z = 1.2 * prog
                kurtosis_boost = 0.4 * prog
                temp_boost = 12.0 * prog
                acoustic_boost = 10.0 * prog

            elif self.state.episode == "overheating":
                # Thermal runaway, thermal expansion rubs casing
                temp_boost = 35.0 * (prog ** 1.2)
                vib_boost_x = 4.0 * (prog ** 1.6)
                vib_boost_y = 4.0 * (prog ** 1.6)
                vib_boost_z = 3.5 * (prog ** 1.6)
                kurtosis_boost = 1.1 * prog
                acoustic_boost = 14.0 * prog

            # If progress reaches 1.0 or health <= 0.08, trigger maintenance overhaul
            if prog >= 1.0 or self.state.health <= 0.08:
                self.reset_maintenance()

        # Calculate primary sensor readings
        rpm = self.cfg["base_rpm"] * math.sqrt(load_factor) + random.gauss(0, self.cfg["rpm_fluct"])
        
        # Tri-axial vibration components (mm/s)
        base_rms = self.cfg["base_vib_rms"] * load_factor
        vib_x = abs(random.gauss(base_rms * 0.7 + vib_boost_x, 0.25))
        vib_y = abs(random.gauss(base_rms * 0.65 + vib_boost_y, 0.25))
        vib_z = abs(random.gauss(base_rms * 0.5 + vib_boost_z, 0.20))
        
        # Vibration RMS root-sum-square
        vib_rms = round(math.sqrt((vib_x**2 + vib_y**2 + vib_z**2) / 3.0) + (base_rms * 0.3), 3)

        # Kurtosis: Gaussian distribution has kurtosis ~ 3.0; impacting generates impulsive tails
        kurtosis = round(self.cfg["base_kurtosis"] + kurtosis_boost + random.gauss(0, 0.12), 2)
        kurtosis = max(2.2, kurtosis)

        # Temperature (°C)
        temp_c = round(self.cfg["base_temp"] + (load_factor - 1.0) * 8.0 + temp_boost + random.gauss(0, 0.6), 2)

        # Current (Amperes)
        current_a = round(self.cfg["base_current"] * load_factor + (vib_rms * 0.4) + random.gauss(0, 0.3), 2)

        # Acoustic Emission (dB)
        acoustic_db = round(self.cfg["base_acoustic"] + (load_factor - 1.0) * 4.0 + acoustic_boost + random.gauss(0, 0.8), 1)

        # Determine true physical status label:
        # 0 = Normal, 1 = Warning, 2 = Critical
        if vib_rms > 7.0 or temp_c > 85.0 or self.state.health < 0.25:
            status = 2  # Critical
        elif vib_rms > 4.5 or temp_c > 75.0 or kurtosis > 3.8 or self.state.health < 0.65:
            status = 1  # Warning
        else:
            status = 0  # Normal

        self.state.status = status

        reading = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "machine_id": self.machine_id,
            "rpm": round(rpm, 1),
            "vib_x": round(vib_x, 3),
            "vib_y": round(vib_y, 3),
            "vib_z": round(vib_z, 3),
            "vib_rms": vib_rms,
            "kurtosis": kurtosis,
            "temp_c": temp_c,
            "current_a": current_a,
            "acoustic_db": acoustic_db,
            "health": round(self.state.health, 3),
            "status": status,
            "failure_mode": self.state.episode or "normal"
        }
        return reading


def run_offline_generator(samples_per_machine: int = 1500, output_path: str = "data/rotary_machinery_training.csv") -> None:
    """Generate a labeled offline CSV dataset for model training."""
    import pandas as pd
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    logger.info(f"Generating offline dataset with {samples_per_machine} samples per machine...")

    all_readings: List[Dict[str, Any]] = []

    for m_id, cfg in MACHINES_CONFIG.items():
        sim = RotaryMachinerySimulator(m_id, cfg)
        for i in range(samples_per_machine):
            # Occasionally inject realistic failure modes to ensure balanced training classes
            if i % 250 == 0:
                sim.trigger_episode(random.choice(["bearing_wear", "imbalance", "overheating"]))
            reading = sim.step(dt_seconds=5.0)
            all_readings.append(reading)

    df = pd.DataFrame(all_readings)
    df.to.csv(output_path, index=False)
    logger.info(f"Offline dataset saved to '{output_path}'. Total rows: {len(df)}")
    print(df["status"].value_counts())


def create_mqtt_client() -> mqtt.Client:
    """Create paho-mqtt v2 client configured for HiveMQ Cloud or Fallback."""
    broker_host = os.getenv("MQTT_BROKER_HOST", "broker.hivemq.com")
    broker_port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    username = os.getenv("MQTT_USERNAME", "")
    password = os.getenv("MQTT_PASSWORD", "")
    use_tls = os.getenv("MQTT_USE_TLS", "False").lower() in ("true", "1", "yes")

    client_id = f"iot_generator_{random.randint(1000, 9999)}"
    # paho-mqtt v2 Callback API
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=client_id
    )

    if username and password:
        client.username_pw_set(username, password)

    if use_tls or broker_port == 8883:
        client.tls_set()
        logger.info("TLS enabled for MQTT client.")

    def on_connect(cl: mqtt.Client, userdata: Any, flags: Any, rc: int, properties: Any = None):
        if rc == 0:
            logger.info(f"Connected to MQTT Broker at {broker_host}:{broker_port}")
        else:
            logger.error(f"MQTT Connection failed with code {rc}")

    client.on_connect = on_connect
    return client


def run_realtime_generator(interval_sec: float = 2.0) -> None:
    """Stream continuous telemetry to HiveMQ / MQTT Broker."""
    broker_host = os.getenv("MQTT_BROKER_HOST", "broker.hivemq.com")
    broker_port = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    topic_prefix = os.getenv("MQTT_TOPIC_PREFIX", "plant1")

    client = create_mqtt_client()
    try:
        logger.info(f"Connecting to MQTT broker {broker_host}:{broker_port}...")
        client.connect(broker_host, broker_port, keepalive=60)
        client.loop_start()
    except Exception as exc:
        logger.warning(f"Could not connect to {broker_host}:{broker_port} ({exc}). Falling back to public broker...")
        fallback_host = os.getenv("MQTT_FALLBACK_HOST", "broker.hivemq.com")
        fallback_port = int(os.getenv("MQTT_FALLBACK_PORT", "1883"))
        client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"iot_generator_fallback_{random.randint(1000, 9999)}"
        )
        client.connect(fallback_host, fallback_port, keepalive=60)
        client.loop_start()

    simulators = {m_id: RotaryMachinerySimulator(m_id, cfg) for m_id, cfg in MACHINES_CONFIG.items()}
    logger.info(f"Starting real-time generator loop for 4 machines (publishing every {interval_sec}s)...")

    try:
        while True:
            for machine_id, sim in simulators.items():
                payload_dict = sim.step(dt_seconds=interval_sec)
                topic = f"{topic_prefix}/{machine_id}/telemetry"
                payload_json = json.dumps(payload_dict)

                result = client.publish(topic, payload=payload_json, qos=1)
                status_str = ["NORMAL", "WARNING", "CRITICAL"][payload_dict["status"]]
                logger.info(
                    f"[{machine_id}] {status_str} | RPM={payload_dict['rpm']} | RMS={payload_dict['vib_rms']} mm/s | "
                    f"Temp={payload_dict['temp_c']}°C | Kurtosis={payload_dict['kurtosis']} | Health={payload_dict['health']}"
                )
            time.sleep(interval_sec)
    except KeyboardInterrupt:
        logger.info("Generator stopped by user.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rotary Machinery Synthetic IoT Data Generator")
    parser.add_argument("--offline", action="store_true", help="Generate offline CSV training dataset instead of streaming MQTT")
    parser.add_argument("--samples", type=int, default=1500, help="Samples per machine for offline dataset (default: 1500)")
    parser.add_argument("--output", type=str, default="data/rotary_machinery_training.csv", help="CSV output path")
    parser.add_argument("--interval", type=float, default=2.0, help="Interval between telemetry bursts in seconds (default: 2.0)")
    args = parser.parse_args()

    if args.offline:
        run_offline_generator(samples_per_machine=args.samples, output_path=args.output)
    else:
        run_realtime_generator(interval_sec=args.interval)
