"""
EnergyPlus IDF ファイル生成モジュール。
インストール済みの場合は EnergyPlus を直接実行できる。
"""

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional
from .thermal_model import RoomModel


IDF_TEMPLATE = """\
! EnergyPlus IDF - 自動生成 (Streamlit EnergyPlus App)
Version,{version};

Building,
    SimpleRoom,             !- Name
    0.0,                    !- North Axis (deg)
    City,                   !- Terrain
    0.04,                   !- Loads Convergence Tolerance Value
    0.4,                    !- Temperature Convergence Tolerance Value (deltaC)
    FullInteriorAndExterior, !- Solar Distribution
    25,                     !- Maximum Number of Warmup Days
    6;                      !- Minimum Number of Warmup Days

Timestep,6;

RunPeriod,
    AnnualRun,              !- Name
    {start_month},          !- Begin Month
    {start_day},            !- Begin Day of Month
    ,                       !- Begin Year
    {end_month},            !- End Month
    {end_day},              !- End Day of Month
    ,                       !- End Year
    UseWeatherFile,         !- Day of Week for Start Day
    Yes,                    !- Use Weather File Holidays and Special Days
    Yes,                    !- Use Weather File DST Indicators
    Yes,                    !- Apply Weekend Holiday Rule
    Yes,                    !- Use Weather File Rain Indicators
    Yes;                    !- Use Weather File Snow Indicators

! --- ゾーン定義 ---
Zone,
    ZONE1,                  !- Name
    0,                      !- Direction of Relative North (deg)
    0,0,0;                  !- Origin X,Y,Z (m)

! --- スケジュール ---
ScheduleTypeLimits,
    Fraction,               !- Name
    0.0,                    !- Lower Limit Value
    1.0,                    !- Upper Limit Value
    CONTINUOUS;             !- Numeric Type

Schedule:Constant,
    AlwaysOn,               !- Name
    Fraction,               !- Schedule Type Limits Name
    1.0;                    !- Hourly Value

Schedule:Constant,
    AlwaysOff,              !- Name
    Fraction,               !- Schedule Type Limits Name
    0.0;                    !- Hourly Value

! --- 建築材料 ---
Material,
    Concrete200mm,          !- Name
    MediumRough,            !- Roughness
    0.2,                    !- Thickness (m)
    1.0,                    !- Conductivity (W/m-K)
    2000,                   !- Density (kg/m3)
    900,                    !- Specific Heat (J/kg-K)
    0.9,                    !- Thermal Absorptance
    0.6,                    !- Solar Absorptance
    0.6;                    !- Visible Absorptance

Material:NoMass,
    InsulationR2,           !- Name
    Rough,                  !- Roughness
    2.0,                    !- Thermal Resistance (m2-K/W)
    0.9,                    !- Thermal Absorptance
    0.6,                    !- Solar Absorptance
    0.6;                    !- Visible Absorptance

WindowMaterial:SimpleGlazingSystem,
    SimpleGlazing,          !- Name
    {u_window},             !- U-Factor (W/m2-K)
    {shgc};                 !- Solar Heat Gain Coefficient

Construction,
    WallConstruction,       !- Name
    Concrete200mm,          !- Outside Layer
    InsulationR2;           !- Layer 2

Construction,
    WindowConstruction,     !- Name
    SimpleGlazing;          !- Outside Layer

! --- 出力設定 ---
OutputControl:Table:Style,HTML;

Output:Variable,
    *,
    Zone Mean Air Temperature,
    Hourly;

Output:Variable,
    *,
    Site Outdoor Air Drybulb Temperature,
    Hourly;

Output:Variable,
    *,
    Zone Windows Total Heat Gain Rate,
    Hourly;

Output:Meter,
    Electricity:Facility,
    Hourly;

Output:Table:SummaryReports,
    AllSummary;
"""


def generate_idf(room: RoomModel, start_month: int = 1, end_month: int = 12) -> str:
    """室モデルから EnergyPlus IDF 文字列を生成する"""
    return IDF_TEMPLATE.format(
        version="23.2",
        u_window=room.u_window,
        shgc=room.shgc,
        start_month=start_month,
        start_day=1,
        end_month=end_month,
        end_day=28 if end_month == 2 else 30,
        deg="",
        deltaC="",
    )


def find_energyplus() -> Optional[str]:
    """システム上の EnergyPlus バイナリを探す"""
    candidates = [
        "/usr/local/bin/energyplus",
        "/usr/bin/energyplus",
        "/opt/EnergyPlus/energyplus",
        "/Applications/EnergyPlus/energyplus",
    ]
    for path in candidates:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path

    result = subprocess.run(["which", "energyplus"], capture_output=True, text=True)
    if result.returncode == 0:
        return result.stdout.strip()

    return None


def run_energyplus(idf_content: str, epw_path: str) -> Optional[dict]:
    """
    EnergyPlus をコマンドライン実行し、結果を返す。
    EnergyPlus が見つからない場合は None を返す。
    """
    ep_binary = find_energyplus()
    if not ep_binary:
        return None

    with tempfile.TemporaryDirectory() as tmpdir:
        idf_path = os.path.join(tmpdir, "model.idf")
        with open(idf_path, "w", encoding="utf-8") as f:
            f.write(idf_content)

        result = subprocess.run(
            [ep_binary, "-w", epw_path, "-d", tmpdir, idf_path],
            capture_output=True, text=True, timeout=120
        )

        if result.returncode != 0:
            return {"error": result.stderr, "stdout": result.stdout}

        import glob
        csv_files = glob.glob(os.path.join(tmpdir, "*.csv"))
        outputs = {}
        for csv_file in csv_files:
            import pandas as pd
            outputs[os.path.basename(csv_file)] = pd.read_csv(csv_file)

        return outputs
