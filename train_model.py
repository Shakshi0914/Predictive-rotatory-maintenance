"""
Machine Learning Training Pipeline for Rotary Machinery Predictive Maintenance.
Trains:
1. Multi-class RandomForestClassifier for operational state (0=normal, 1=warning, 2=critical)
2. IsolationForest unsupervised anomaly detector (trained on strictly normal operational data)
3. GradientBoostingRegressor / RandomForestRegressor for Remaining Useful Life (RUL hours) estimation
Persists serialized model artifacts using joblib.
"""

from __future__ import annotations
import os
import json
import logging
from typing import Tuple, Dict, Any
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, IsolationForest, GradientBoostingRegressor
from sklearn.metrics import classification_report, confusion_matrix, r2_score, mean_absolute_error
from sklearn.preprocessing import StandardScaler
import joblib

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [TrainML] %(message)s")
logger = logging.getLogger("train_model")

MODEL_DIR = os.getenv("MODEL_DIR", "models")
CSV_PATH = os.getenv("CSV_TRAINING_DATASET_PATH", "data/rotary_machinery_training.csv")

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


def load_or_create_dataset(csv_path: str = CSV_PATH) -> pd.DataFrame:
    """Load existing dataset or invoke offline generator if missing."""
    if not os.path.exists(csv_path):
        logger.warning(f"Training dataset '{csv_path}' not found. Generating synthetic training data...")
        from generator import run_offline_generator
        run_offline_generator(samples_per_machine=1500, output_path=csv_path)

    df = pd.read_csv(csv_path)
    logger.info(f"Loaded dataset with {len(df)} samples across machines: {df['machine_id'].unique()}")

    # Synthesize Remaining Useful Life (RUL) target based on health and degradation trajectory
    # Health: 1.0 (approx 720 hours) down to 0.0 (0 hours)
    if "rul_hours" not in df.columns:
        # Approximate RUL hours = health * 720 + random noise
        df["rul_hours"] = np.clip(df["health"] * 720.0 + np.random.normal(0, 15, size=len(df)), 0.0, 750.0)

    return df


def train_models() -> Dict[str, Any]:
    """Train classification, anomaly detection, and regression models."""
    os.makedirs(MODEL_DIR, exist_ok=True)
    df = load_or_create_dataset()

    X = df[FEATURE_COLUMNS].values
    y_status = df["status"].values
    y_rul = df["rul_hours"].values

    # Train/Test Split
    X_train, X_test, y_train, y_test, rul_train, rul_test = train_test_split(
        X, y_status, y_rul, test_size=0.2, random_state=42, stratify=y_status
    )

    # 1. Feature Scaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.joblib"))
    logger.info("Saved feature scaler to 'models/scaler.joblib'")

    # 2. Multi-class RandomForest Classifier
    logger.info("Training Multi-Class RandomForest Classifier (0:Normal, 1:Warning, 2:Critical)...")
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=12,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)

    report = classification_report(
        y_test,
        y_pred,
        target_names=["0-Normal", "1-Warning", "2-Critical"],
        digits=4
    )
    print("\n=======================================================")
    print("      CLASSIFICATION REPORT: STATUS PREDICTOR          ")
    print("=======================================================")
    print(report)
    print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))

    clf_path = os.path.join(MODEL_DIR, "random_forest_classifier.joblib")
    joblib.dump(clf, clf_path)
    logger.info(f"Saved Random Forest Classifier to '{clf_path}'")

    # 3. IsolationForest Anomaly Detector (Trained ONLY on normal data)
    logger.info("Training IsolationForest on normal operational telemetry (status == 0)...")
    normal_mask = (y_status == 0)
    X_normal = X[normal_mask]

    iso_forest = IsolationForest(
        n_estimators=100,
        contamination=0.03,  # Expected outlier rate in pristine baseline
        random_state=42,
        n_jobs=-1
    )
    iso_forest.fit(X_normal)

    # Evaluate anomaly scores on test set
    anomaly_scores = iso_forest.decision_function(X_test)
    logger.info(f"IsolationForest Mean normal score: {anomaly_scores[y_test == 0].mean():.3f} vs abnormal score: {anomaly_scores[y_test > 0].mean():.3f}")

    iso_path = os.path.join(MODEL_DIR, "isolation_forest.joblib")
    joblib.dump(iso_forest, iso_path)
    logger.info(f"Saved Isolation Forest to '{iso_path}'")

    # 4. Remaining Useful Life (RUL) Regressor (Bonus)
    logger.info("Training RUL (Remaining Useful Life) Regressor...")
    rul_model = GradientBoostingRegressor(
        n_estimators=120,
        max_depth=5,
        learning_rate=0.08,
        random_state=42
    )
    rul_model.fit(X_train, rul_train)
    rul_pred = rul_model.predict(X_test)
    r2 = r2_score(rul_test, rul_pred)
    mae = mean_absolute_error(rul_test, rul_pred)
    print(f"\nRUL Regression Performance: R² = {r2:.4f}, MAE = {mae:.2f} hours")

    rul_path = os.path.join(MODEL_DIR, "rul_regressor.joblib")
    joblib.dump(rul_model, rul_path)
    logger.info(f"Saved RUL Regressor to '{rul_path}'")

    # Save Metadata
    importances = dict(zip(FEATURE_COLUMNS, [round(float(v), 4) for v in clf.feature_importances_]))
    metadata = {
        "features": FEATURE_COLUMNS,
        "classes": ["Normal", "Warning", "Critical"],
        "feature_importances": importances,
        "rul_r2": round(float(r2), 4),
        "rul_mae_hours": round(float(mae), 2),
        "dataset_rows": len(df)
    }
    with open(os.path.join(MODEL_DIR, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info("Model training pipeline finished successfully.")
    return metadata


if __name__ == "__main__":
    train_models()
