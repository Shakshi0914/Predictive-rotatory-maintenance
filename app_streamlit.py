"""
Streamlit + Plotly Alternative Dashboard for Predictive Maintenance.
Run with:
    streamlit run app_streamlit.py --server.port 8501
"""

from __future__ import annotations
import os
import time
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import database

st.set_page_config(
    page_title="Rotary Machinery Predictive Maintenance",
    page_icon="⚙️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize DB
database.init_db()

# Session State for Authentication
if "authenticated" not in st.session_state:
    st.session_state["authenticated"] = False
    st.session_state["user"] = None


def render_login():
    st.title("⚙️ Rotary Machinery Predictive Maintenance")
    st.markdown("### Industrial IoT Ingestion & Machine Learning Diagnostics")
    st.markdown("---")

    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.subheader("System Authentication")
        username = st.text_input("Username", key="login_user")
        password = st.text_input("Password", type="password", key="login_pwd")

        if st.button("Sign In", type="primary", use_container_width=True):
            success, msg, user = database.authenticate_user(username, password)
            if success:
                st.session_state["authenticated"] = True
                st.session_state["user"] = user
                st.success(msg)
                st.rerun()
            else:
                st.error(msg)

        st.info("Default Credentials:\n- Admin: `admin` / `AdminChangeMe123!`\n- Viewer: `viewer` / `Viewer123!`")


def render_dashboard():
    user = st.session_state["user"]
    st.sidebar.title("⚙️ Predictive Maintenance")
    st.sidebar.markdown(f"**Logged in as:** `{user['username']}` ({user['role'].upper()})")

    if st.sidebar.button("Logout", use_container_width=True):
        st.session_state["authenticated"] = False
        st.session_state["user"] = None
        st.rerun()

    page = st.sidebar.radio(
        "Navigation",
        ["1. Fleet Overview", "2. Machine Detail", "3. Active Alerts", "4. Data & Reports", "5. System Settings"]
    )

    conn = database.get_db_connection()

    if page == "1. Fleet Overview":
        st.header("🏭 Plant Fleet Health Summary")
        latest_df = pd.read_sql_query("""
            SELECT t.* FROM telemetry t
            INNER JOIN (
                SELECT machine_id, MAX(id) as max_id FROM telemetry GROUP BY machine_id
            ) latest ON t.id = latest.max_id;
        """, conn)

        if latest_df.empty:
            st.warning("No telemetry recorded yet. Start generator.py and ingest.py to begin receiving stream.")
        else:
            cols = st.columns(4)
            for idx, (_, row) in enumerate(latest_df.iterrows()):
                status_color = "🟢 Normal" if row["status"] == 0 else ("🟡 Warning" if row["status"] == 1 else "🔴 Critical")
                with cols[idx % 4]:
                    st.metric(label=f"{row['machine_id']} ({status_color})", value=f"{row['health']*100:.1f}% Health", delta=f"{row['vib_rms']} mm/s RMS")
                    st.write(f"**RPM:** {row['rpm']:.0f} | **Temp:** {row['temp_c']} °C")
                    st.write(f"**Anomaly Score:** `{row['anomaly_score']:.3f}`")
                    st.write(f"**Est. RUL:** `{row['rul_hours']:.1f} hrs`")

    elif page == "2. Machine Detail":
        st.header("📈 Machine High-Resolution Time Series")
        machine = st.selectbox("Select Machine", ["pump-01", "motor-02", "fan-03", "compressor-04"])
        history_df = pd.read_sql_query(
            "SELECT * FROM telemetry WHERE machine_id = ? ORDER BY id DESC LIMIT 100;",
            conn, params=(machine,)
        )
        if not history_df.empty:
            history_df = history_df.iloc[::-1]  # Chronological order

            # Plot Vibration RMS with Thresholds
            fig_vib = go.Figure()
            fig_vib.add_trace(go.Scatter(x=history_df["timestamp"], y=history_df["vib_rms"], mode="lines+markers", name="Vibration RMS (mm/s)"))
            fig_vib.add_hline(y=4.5, line_dash="dash", line_color="orange", annotation_text="Warning (4.5)")
            fig_vib.add_hline(y=7.0, line_dash="dash", line_color="red", annotation_text="Critical (7.0)")
            fig_vib.update_layout(title=f"{machine} - Vibration RMS Velocity", xaxis_title="Timestamp", yaxis_title="mm/s")
            st.plotly_chart(fig_vib, use_container_width=True)

            # Plot Temperature & Kurtosis
            fig_temp = px.line(history_df, x="timestamp", y=["temp_c", "kurtosis"], title=f"{machine} - Temperature & Impulsive Kurtosis")
            st.plotly_chart(fig_temp, use_container_width=True)

    elif page == "3. Active Alerts":
        st.header("🚨 Machinery Alerts Triage")
        alerts_df = pd.read_sql_query("SELECT * FROM alerts ORDER BY id DESC LIMIT 50;", conn)
        st.dataframe(alerts_df, use_container_width=True)

    elif page == "4. Data & Reports":
        st.header("📊 Telemetry Export")
        all_data = pd.read_sql_query("SELECT * FROM telemetry ORDER BY id DESC LIMIT 500;", conn)
        st.dataframe(all_data, use_container_width=True)
        csv_bytes = all_data.to_csv(index=False).encode("utf-8")
        st.download_button("Download Telemetry CSV", csv_bytes, "telemetry_export.csv", "text/csv")

    elif page == "5. System Settings":
        st.header("⚙️ Thresholds & User Control")
        if user["role"] != "admin":
            st.error("Admin privileges required to configure system settings.")
        else:
            st.write("Configured System Thresholds:")
            thresh_df = pd.read_sql_query("SELECT * FROM system_thresholds;", conn)
            st.table(thresh_df)

    conn.close()


def main():
    if not st.session_state["authenticated"]:
        render_login()
    else:
        render_dashboard()


if __name__ == "__main__":
    main()
