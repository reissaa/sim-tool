"""
RC（抵抗-容量）熱モデルによる室温シミュレーション。

EnergyPlus の簡易代替として、単純化した熱収支方程式を数値積分する。
1ノードモデル: 室空気温度のみを計算対象とする。

熱収支:
  C_air * dT_room/dt = Q_solar + Q_cond + Q_infil + Q_internal + Q_hvac
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RoomModel:
    """室モデルパラメータ"""
    # 室寸法
    length: float = 5.0
    width: float = 4.0
    height: float = 2.7

    # 壁・屋根の熱貫流率 (W/m²K)
    u_wall: float = 1.5
    u_roof: float = 1.0
    u_floor: float = 1.5
    u_window: float = 2.9

    # 窓面積比 (0-1)
    window_ratio_south: float = 0.3
    window_ratio_north: float = 0.05
    window_ratio_east: float = 0.1
    window_ratio_west: float = 0.1

    # 日射取得率 (SHGC)
    shgc: float = 0.6

    # 内部発熱 (W/人)
    occupants: int = 2
    heat_per_person: float = 80.0
    equipment_load: float = 200.0

    # 換気 (回/h)
    infiltration_ach: float = 0.5

    # 熱容量 (J/K per m³, 空気 + 家具考慮)
    volumetric_heat_capacity: float = 10000.0

    # HVAC 設定
    hvac_mode: str = "none"
    cooling_setpoint: float = 26.0
    heating_setpoint: float = 20.0
    hvac_capacity: float = 2500.0

    # 地盤温度オフセット
    floor_temp_offset: float = 2.0

    @property
    def floor_area(self) -> float:
        return self.length * self.width

    @property
    def volume(self) -> float:
        return self.floor_area * self.height

    @property
    def total_heat_capacity(self) -> float:
        return self.volumetric_heat_capacity * self.volume

    def wall_areas(self) -> dict:
        """各面の壁面積（窓なし）を計算する"""
        south_gross = self.length * self.height
        north_gross = self.length * self.height
        east_gross = self.width * self.height
        west_gross = self.width * self.height
        return {
            "south_wall": south_gross * (1 - self.window_ratio_south),
            "north_wall": north_gross * (1 - self.window_ratio_north),
            "east_wall": east_gross * (1 - self.window_ratio_east),
            "west_wall": west_gross * (1 - self.window_ratio_west),
            "roof": self.floor_area,
            "floor": self.floor_area,
            "south_win": south_gross * self.window_ratio_south,
            "north_win": north_gross * self.window_ratio_north,
            "east_win": east_gross * self.window_ratio_east,
            "west_win": west_gross * self.window_ratio_west,
        }


def simulate(room: RoomModel, weather_df: pd.DataFrame, lat: float) -> pd.DataFrame:
    """
    RC 熱モデルで室温を時刻歴シミュレーションする。

    Args:
        room: 室モデルパラメータ
        weather_df: Open-Meteo からの気象データ (hourly)
        lat: 緯度 (度)

    Returns:
        結果 DataFrame (time, T_room, T_outdoor, Q_solar, Q_cond, Q_infil, Q_internal, Q_hvac)
    """
    areas = room.wall_areas()
    C = room.total_heat_capacity

    rho_cp = 1200.0
    Q_infil_coeff = rho_cp * room.volume * room.infiltration_ach / 3600.0

    results = []
    T_room = None

    T_outdoor_series = weather_df["temperature_2m"].values

    for i, (ts, row) in enumerate(weather_df.iterrows()):
        T_out = float(row["temperature_2m"])
        sw_rad = max(0.0, float(row.get("shortwave_radiation", 0) or 0))
        diff_rad = max(0.0, float(row.get("diffuse_radiation", 0) or 0))
        dir_rad = max(0.0, float(row.get("direct_radiation", 0) or 0))

        if T_room is None:
            T_room = T_out

        # --- 1. 日射取得 ---
        lat_r = np.radians(lat)
        doy = ts.day_of_year
        decl = np.radians(23.45 * np.sin(np.radians(360 / 365 * (doy - 81))))
        solar_time = ts.hour + ts.minute / 60.0
        hour_angle = np.radians(15 * (solar_time - 12))
        sin_alt = np.sin(lat_r) * np.sin(decl) + np.cos(lat_r) * np.cos(decl) * np.cos(hour_angle)
        sin_alt = float(np.clip(sin_alt, 0, 1))

        south_inc = dir_rad * sin_alt + diff_rad * 0.5
        north_inc = diff_rad * 0.3
        east_inc = dir_rad * max(0, np.sin(hour_angle)) * 0.5 + diff_rad * 0.4
        west_inc = dir_rad * max(0, -np.sin(hour_angle)) * 0.5 + diff_rad * 0.4

        Q_solar = (
            areas["south_win"] * south_inc * room.shgc
            + areas["north_win"] * north_inc * room.shgc
            + areas["east_win"] * east_inc * room.shgc
            + areas["west_win"] * west_inc * room.shgc
        )

        # --- 2. 外皮貫流 ---
        T_ground = np.mean(T_outdoor_series) + room.floor_temp_offset
        Q_cond = (
            areas["south_wall"] * room.u_wall * (T_out - T_room)
            + areas["north_wall"] * room.u_wall * (T_out - T_room)
            + areas["east_wall"] * room.u_wall * (T_out - T_room)
            + areas["west_wall"] * room.u_wall * (T_out - T_room)
            + areas["roof"] * room.u_roof * (T_out - T_room)
            + areas["floor"] * room.u_floor * (T_ground - T_room)
            + areas["south_win"] * room.u_window * (T_out - T_room)
            + areas["north_win"] * room.u_window * (T_out - T_room)
            + areas["east_win"] * room.u_window * (T_out - T_room)
            + areas["west_win"] * room.u_window * (T_out - T_room)
        )

        # --- 3. 換気・隙間風 ---
        Q_infil = Q_infil_coeff * (T_out - T_room)

        # --- 4. 内部発熱 ---
        Q_internal = room.occupants * room.heat_per_person + room.equipment_load

        # --- 5. HVAC ---
        Q_hvac = 0.0
        if room.hvac_mode in ("cooling", "auto"):
            if T_room > room.cooling_setpoint:
                Q_hvac = -min(room.hvac_capacity, C * (T_room - room.cooling_setpoint) / 3600)
        if room.hvac_mode in ("heating", "auto"):
            if T_room < room.heating_setpoint:
                Q_hvac = min(room.hvac_capacity, C * (room.heating_setpoint - T_room) / 3600)

        # --- 6. 温度更新 (オイラー法, dt=3600s) ---
        dt = 3600.0
        Q_total = Q_solar + Q_cond + Q_infil + Q_internal + Q_hvac
        dT = Q_total * dt / C
        T_room += dT

        results.append({
            "time": ts,
            "T_room": round(T_room, 2),
            "T_outdoor": T_out,
            "Q_solar": round(Q_solar, 1),
            "Q_cond": round(Q_cond, 1),
            "Q_infil": round(Q_infil, 1),
            "Q_internal": round(Q_internal, 1),
            "Q_hvac": round(Q_hvac, 1),
            "Q_total": round(Q_total, 1),
        })

    df = pd.DataFrame(results).set_index("time")
    return df
