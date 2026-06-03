"""
Open-Meteo API を使って実際の気象データを取得するモジュール。
EPW ファイル不要で任意の地点のデータを取得できる。
"""

import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


JAPAN_CITIES = {
    "札幌": (43.06, 141.35),
    "仙台": (38.27, 140.87),
    "東京": (35.68, 139.69),
    "横浜": (35.44, 139.64),
    "名古屋": (35.18, 136.91),
    "大阪": (34.69, 135.50),
    "広島": (34.40, 132.46),
    "福岡": (33.59, 130.40),
    "那覇": (26.21, 127.68),
    "新潟": (37.91, 139.04),
    "金沢": (36.56, 136.66),
    "松山": (33.84, 132.77),
    "鹿児島": (31.56, 130.56),
    "長野": (36.65, 138.18),
    "盛岡": (39.70, 141.15),
}


def fetch_weather(lat: float, lon: float, start_date: str, end_date: str) -> pd.DataFrame:
    """
    Open-Meteo API から気象データを取得する。

    Returns: hourly DataFrame with columns:
        time, temperature_2m, shortwave_radiation, diffuse_radiation,
        direct_radiation, windspeed_10m, relativehumidity_2m, surface_pressure
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": [
            "temperature_2m",
            "shortwave_radiation",
            "diffuse_radiation",
            "direct_radiation",
            "windspeed_10m",
            "relativehumidity_2m",
        ],
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "Asia/Tokyo",
    }

    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()

    hourly = data["hourly"]
    df = pd.DataFrame(hourly)
    df["time"] = pd.to_datetime(df["time"])
    df = df.set_index("time")
    return df


def fetch_historical_weather(lat: float, lon: float, start_date: str, end_date: str) -> pd.DataFrame:
    """
    Open-Meteo の過去気象データ API を使用する。
    """
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": [
            "temperature_2m",
            "shortwave_radiation",
            "diffuse_radiation",
            "direct_radiation",
            "windspeed_10m",
            "relativehumidity_2m",
        ],
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "Asia/Tokyo",
    }

    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()

    hourly = data["hourly"]
    df = pd.DataFrame(hourly)
    df["time"] = pd.to_datetime(df["time"])
    df = df.set_index("time")

    df = df.interpolate(method="time").ffill().bfill()
    return df


def get_weather_data(lat: float, lon: float, start_date: str, end_date: str) -> pd.DataFrame:
    """
    日付範囲に応じて予報 or 過去データを自動選択して取得する。
    """
    today = datetime.today().date()
    sd = datetime.strptime(start_date, "%Y-%m-%d").date()

    days_ahead = (sd - today).days
    try:
        if days_ahead >= -6:
            df = fetch_weather(lat, lon, start_date, end_date)
        else:
            df = fetch_historical_weather(lat, lon, start_date, end_date)
    except Exception:
        try:
            df = fetch_historical_weather(lat, lon, start_date, end_date)
        except Exception:
            df = fetch_weather(lat, lon, start_date, end_date)

    return df


def solar_altitude(lat_deg: float, lon_deg: float, timestamp: pd.Timestamp) -> float:
    """簡易太陽高度角計算（ラジアン）"""
    lat = np.radians(lat_deg)
    doy = timestamp.day_of_year
    hour = timestamp.hour + timestamp.minute / 60.0

    decl = np.radians(23.45 * np.sin(np.radians(360 / 365 * (doy - 81))))

    lon_correction = (lon_deg - 135) / 15
    solar_time = hour + lon_correction
    hour_angle = np.radians(15 * (solar_time - 12))

    sin_alt = (
        np.sin(lat) * np.sin(decl)
        + np.cos(lat) * np.cos(decl) * np.cos(hour_angle)
    )
    return float(np.arcsin(np.clip(sin_alt, -1, 1)))
