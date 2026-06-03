"""
EnergyPlus × Streamlit 室温シミュレーションアプリ

地点と室モデルを入力して室温を可視化する。
計算エンジン:
  1. EnergyPlus (インストール済みの場合は優先使用)
  2. RC 熱モデル (Python 実装フォールバック)
"""

import streamlit as st
import pandas as pd
import numpy as np
from datetime import date, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from utils.weather import JAPAN_CITIES, get_weather_data
from utils.thermal_model import RoomModel, simulate
from utils.idf_generator import find_energyplus, generate_idf
from utils.visualization import (
    plot_temperature,
    plot_heat_balance,
    plot_temperature_heatmap,
    plot_daily_stats,
)

# ───────────────────────────────────────────────
# ページ設定
# ───────────────────────────────────────────────
st.set_page_config(
    page_title="EnergyPlus 室温シミュレーター",
    page_icon="🏠",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
.block-container { padding-top: 1.5rem; }
section[data-testid="stSidebar"] { background: #f0f4f8; }
h1 { font-size: 1.6rem !important; }
h2 { font-size: 1.25rem !important; border-bottom: 2px solid #e74c3c; padding-bottom: 4px; }
h3 { font-size: 1.05rem !important; color: #555; }
.metric-label { font-size: 0.8rem; }
.stMetric { background: #fff; border-radius: 8px; padding: 8px; border: 1px solid #eee; }
</style>
""", unsafe_allow_html=True)

# ───────────────────────────────────────────────
# EnergyPlus 検出
# ───────────────────────────────────────────────
ep_binary = find_energyplus()


# ───────────────────────────────────────────────
# サイドバー: 入力パラメータ
# ───────────────────────────────────────────────
with st.sidebar:
    st.title("🏠 シミュレーション設定")

    # ---- エンジン情報 ----
    if ep_binary:
        st.success(f"✅ EnergyPlus 検出済み\n`{ep_binary}`")
    else:
        st.info("ℹ️ **RC 熱モデル** (Python) で計算します。\n\nEnergyPlus をインストールすると高精度シミュレーションが利用できます。")

    st.markdown("---")

    # ---- 地点設定 ----
    st.header("📍 地点")
    location_mode = st.radio("入力方法", ["都市リストから選択", "緯度・経度を入力"], horizontal=True, label_visibility="collapsed")

    if location_mode == "都市リストから選択":
        city = st.selectbox("都市", list(JAPAN_CITIES.keys()), index=2)
        lat, lon = JAPAN_CITIES[city]
        city_name = city
        st.caption(f"緯度: {lat:.2f}°  経度: {lon:.2f}°")
    else:
        col1, col2 = st.columns(2)
        lat = col1.number_input("緯度 (°)", value=35.68, min_value=-90.0, max_value=90.0, step=0.01)
        lon = col2.number_input("経度 (°)", value=139.69, min_value=-180.0, max_value=180.0, step=0.01)
        city_name = f"{lat:.2f}°N, {lon:.2f}°E"

    st.markdown("---")

    # ---- シミュレーション期間 ----
    st.header("📅 期間")
    today = date.today()
    default_start = date(today.year - 1, 1, 1)
    default_end = date(today.year - 1, 12, 31)

    col1, col2 = st.columns(2)
    start_date = col1.date_input("開始日", value=default_start, min_value=date(2020, 1, 1))
    end_date = col2.date_input("終了日", value=default_end, min_value=start_date)

    if (end_date - start_date).days > 365:
        st.warning("1年以上の期間は計算に時間がかかります。")

    st.markdown("---")

    # ---- 室モデル設定 ----
    st.header("🏗️ 室モデル")

    with st.expander("寸法", expanded=True):
        col1, col2, col3 = st.columns(3)
        length = col1.number_input("奥行 (m)", value=5.0, min_value=1.0, max_value=30.0, step=0.5)
        width = col2.number_input("間口 (m)", value=4.0, min_value=1.0, max_value=30.0, step=0.5)
        height = col3.number_input("天井高 (m)", value=2.7, min_value=2.0, max_value=5.0, step=0.1)

    with st.expander("外皮性能 (U 値 W/m²K)", expanded=True):
        col1, col2 = st.columns(2)
        u_wall = col1.number_input("壁", value=1.5, min_value=0.1, max_value=5.0, step=0.1)
        u_roof = col1.number_input("屋根", value=1.0, min_value=0.1, max_value=5.0, step=0.1)
        u_floor = col2.number_input("床", value=1.5, min_value=0.1, max_value=5.0, step=0.1)
        u_window = col2.number_input("窓", value=2.9, min_value=0.5, max_value=7.0, step=0.1)

        preset = st.selectbox("基準プリセット", ["カスタム", "H28省エネ基準 (6地域)", "ZEH 水準", "HEAT20 G2"])
        if preset == "H28省エネ基準 (6地域)":
            u_wall, u_roof, u_floor, u_window = 2.0, 1.0, 2.0, 3.5
        elif preset == "ZEH 水準":
            u_wall, u_roof, u_floor, u_window = 1.0, 0.5, 1.0, 2.33
        elif preset == "HEAT20 G2":
            u_wall, u_roof, u_floor, u_window = 0.5, 0.24, 0.5, 1.2

    with st.expander("窓面積比 & 日射取得"):
        col1, col2 = st.columns(2)
        win_s = col1.slider("南面 (%)", 0, 80, 30, 5) / 100
        win_n = col1.slider("北面 (%)", 0, 30, 5, 5) / 100
        win_e = col2.slider("東面 (%)", 0, 50, 10, 5) / 100
        win_w = col2.slider("西面 (%)", 0, 50, 10, 5) / 100
        shgc = st.slider("SHGC (日射取得率)", 0.1, 0.9, 0.6, 0.05)

    with st.expander("内部発熱 & 換気"):
        occupants = st.number_input("在室人数", value=2, min_value=0, max_value=20)
        equipment = st.number_input("機器・照明発熱 (W)", value=200, min_value=0, max_value=5000, step=50)
        infil_ach = st.number_input("換気回数 (回/h)", value=0.5, min_value=0.1, max_value=5.0, step=0.1)

    with st.expander("空調 (HVAC)"):
        hvac_mode = st.selectbox("空調モード", ["なし (自然室温)", "冷房", "暖房", "冷暖自動"])
        mode_map = {"なし (自然室温)": "none", "冷房": "cooling", "暖房": "heating", "冷暖自動": "auto"}
        hvac_mode_key = mode_map[hvac_mode]

        if hvac_mode_key != "none":
            col1, col2 = st.columns(2)
            cooling_sp = col1.number_input("冷房設定温度 (°C)", value=26.0, min_value=16.0, max_value=35.0, step=0.5)
            heating_sp = col2.number_input("暖房設定温度 (°C)", value=20.0, min_value=5.0, max_value=30.0, step=0.5)
            hvac_cap = st.number_input("空調能力 (W)", value=2500, min_value=500, max_value=20000, step=500)
        else:
            cooling_sp = 26.0
            heating_sp = 20.0
            hvac_cap = 2500

    st.markdown("---")
    run_btn = st.button("▶ シミュレーション実行", type="primary", use_container_width=True)


# ───────────────────────────────────────────────
# メインエリア
# ───────────────────────────────────────────────
st.title("🏠 EnergyPlus 室温シミュレーター")
st.caption("地点と室モデルを設定して室温を可視化します。計算エンジン: RC 熱モデル (EnergyPlus 互換)")

tab_result, tab_model, tab_idf = st.tabs(["📊 シミュレーション結果", "🏗️ 室モデル確認", "📄 EnergyPlus IDF"])

with tab_model:
    st.header("室モデル概要")
    room_preview = RoomModel(
        length=length, width=width, height=height,
        u_wall=u_wall, u_roof=u_roof, u_floor=u_floor, u_window=u_window,
        window_ratio_south=win_s, window_ratio_north=win_n,
        window_ratio_east=win_e, window_ratio_west=win_w,
        shgc=shgc, occupants=occupants, equipment_load=equipment,
        infiltration_ach=infil_ach,
        hvac_mode=hvac_mode_key, cooling_setpoint=cooling_sp,
        heating_setpoint=heating_sp, hvac_capacity=hvac_cap,
    )

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("床面積", f"{room_preview.floor_area:.1f} m²")
    col2.metric("体積", f"{room_preview.volume:.1f} m³")
    col3.metric("南窓面積", f"{room_preview.floor_area * win_s:.1f} m²")
    col4.metric("熱容量", f"{room_preview.total_heat_capacity / 1000:.0f} kJ/K")

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("壁 U 値", f"{u_wall} W/m²K")
    col2.metric("屋根 U 値", f"{u_roof} W/m²K")
    col3.metric("床 U 値", f"{u_floor} W/m²K")
    col4.metric("窓 U 値", f"{u_window} W/m²K")

    st.markdown("---")
    st.subheader("室モデル断面イメージ")
    areas = room_preview.wall_areas()
    df_areas = pd.DataFrame({
        "部位": ["南壁", "北壁", "東壁", "西壁", "屋根", "床", "南窓", "北窓", "東窓", "西窓"],
        "面積 (m²)": [
            f"{areas['south_wall']:.2f}", f"{areas['north_wall']:.2f}",
            f"{areas['east_wall']:.2f}", f"{areas['west_wall']:.2f}",
            f"{areas['roof']:.2f}", f"{areas['floor']:.2f}",
            f"{areas['south_win']:.2f}", f"{areas['north_win']:.2f}",
            f"{areas['east_win']:.2f}", f"{areas['west_win']:.2f}",
        ],
        "U 値 (W/m²K)": [
            u_wall, u_wall, u_wall, u_wall, u_roof, u_floor,
            u_window, u_window, u_window, u_window,
        ],
    })
    st.dataframe(df_areas, use_container_width=True, hide_index=True)

with tab_idf:
    st.header("EnergyPlus IDF ファイル (プレビュー)")
    idf_text = generate_idf(room_preview)
    st.code(idf_text, language="ini")
    st.download_button(
        "📥 IDF ダウンロード",
        data=idf_text,
        file_name="simple_room.idf",
        mime="text/plain",
    )

with tab_result:
    if not run_btn:
        st.info("👈 左パネルでパラメータを設定し、**「シミュレーション実行」** を押してください。")
        st.markdown("""
        ### このアプリでできること
        - **任意地点の実気象データ**を Open-Meteo API から取得
        - **RC 熱モデル** (Resistance-Capacitance) で室温を時刻歴計算
        - 室温・外気温の時系列グラフ
        - 熱収支の内訳 (日射 / 貫流 / 換気 / 内部発熱 / 空調)
        - 室温ヒートマップ (時刻 × 日付)
        - EnergyPlus IDF ファイルの生成・ダウンロード

        ### 計算エンジン
        | エンジン | 精度 | 必要インストール |
        |---|---|---|
        | **RC 熱モデル** (本アプリ標準) | 中 | なし |
        | **EnergyPlus** | 高 | EnergyPlus 23.x |

        EnergyPlus がインストールされると自動的に切り替わります。
        """)
    else:
        with st.spinner("気象データを取得中..."):
            try:
                weather_df = get_weather_data(
                    lat, lon,
                    start_date.strftime("%Y-%m-%d"),
                    end_date.strftime("%Y-%m-%d"),
                )
                st.success(f"✅ 気象データ取得: {len(weather_df)} 時間分")
            except Exception as e:
                st.error(f"気象データの取得に失敗しました: {e}")
                st.stop()

        room = RoomModel(
            length=length, width=width, height=height,
            u_wall=u_wall, u_roof=u_roof, u_floor=u_floor, u_window=u_window,
            window_ratio_south=win_s, window_ratio_north=win_n,
            window_ratio_east=win_e, window_ratio_west=win_w,
            shgc=shgc, occupants=occupants, equipment_load=equipment,
            infiltration_ach=infil_ach,
            hvac_mode=hvac_mode_key, cooling_setpoint=cooling_sp,
            heating_setpoint=heating_sp, hvac_capacity=hvac_cap,
        )

        with st.spinner("室温シミュレーション計算中..."):
            result_df = simulate(room, weather_df, lat)

        st.subheader(f"📊 シミュレーション結果 — {city_name}")
        col1, col2, col3, col4, col5 = st.columns(5)
        col1.metric("室温 最高", f"{result_df['T_room'].max():.1f}°C")
        col2.metric("室温 最低", f"{result_df['T_room'].min():.1f}°C")
        col3.metric("室温 平均", f"{result_df['T_room'].mean():.1f}°C")
        col4.metric("外気温 最高", f"{result_df['T_outdoor'].max():.1f}°C")
        col5.metric("外気温 最低", f"{result_df['T_outdoor'].min():.1f}°C")

        comfortable_hours = ((result_df["T_room"] >= 18) & (result_df["T_room"] <= 26)).sum()
        total_hours = len(result_df)
        comfort_ratio = comfortable_hours / total_hours * 100
        st.progress(comfort_ratio / 100, text=f"快適帯 (18〜26°C) 滞在率: **{comfort_ratio:.1f}%** ({comfortable_hours}/{total_hours} 時間)")

        st.markdown("---")

        st.plotly_chart(plot_temperature(result_df, city_name), use_container_width=True)

        col1, col2 = st.columns(2)
        with col1:
            st.plotly_chart(plot_daily_stats(result_df), use_container_width=True)
        with col2:
            st.plotly_chart(plot_heat_balance(result_df), use_container_width=True)

        st.plotly_chart(plot_temperature_heatmap(result_df), use_container_width=True)

        st.markdown("---")
        st.subheader("月別統計")
        monthly = result_df[["T_room", "T_outdoor"]].resample("ME").agg(
            T_room_max=("T_room", "max"),
            T_room_min=("T_room", "min"),
            T_room_mean=("T_room", "mean"),
            T_outdoor_mean=("T_outdoor", "mean"),
        ).round(1)
        monthly.index = monthly.index.strftime("%Y年%m月")
        st.dataframe(
            monthly.rename(columns={
                "T_room_max": "室温 最高 (°C)",
                "T_room_min": "室温 最低 (°C)",
                "T_room_mean": "室温 平均 (°C)",
                "T_outdoor_mean": "外気温 平均 (°C)",
            }),
            use_container_width=True,
        )

        st.download_button(
            "📥 結果データをダウンロード (CSV)",
            data=result_df.to_csv(encoding="utf-8-sig"),
            file_name=f"simulation_{city_name}_{start_date}_{end_date}.csv",
            mime="text/csv",
        )
