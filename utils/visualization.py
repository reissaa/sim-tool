"""
Plotly を使った可視化モジュール。
"""

import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots


def plot_temperature(result_df: pd.DataFrame, city_name: str = "") -> go.Figure:
    """室温と外気温の時系列グラフ"""
    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=result_df.index,
        y=result_df["T_room"],
        name="室温",
        line=dict(color="#e74c3c", width=2),
        hovertemplate="%{x|%m/%d %H:%M}<br>室温: %{y:.1f}°C<extra></extra>",
    ))

    fig.add_trace(go.Scatter(
        x=result_df.index,
        y=result_df["T_outdoor"],
        name="外気温",
        line=dict(color="#3498db", width=1.5, dash="dot"),
        hovertemplate="%{x|%m/%d %H:%M}<br>外気温: %{y:.1f}°C<extra></extra>",
    ))

    fig.add_hrect(
        y0=18, y1=26,
        fillcolor="rgba(46, 204, 113, 0.1)",
        line_width=0,
        annotation_text="快適帯 (18-26°C)",
        annotation_position="top left",
        annotation_font_size=11,
        annotation_font_color="rgba(46, 204, 113, 0.8)",
    )

    title = "室温シミュレーション結果"
    if city_name:
        title += f" — {city_name}"

    fig.update_layout(
        title=dict(text=title, font=dict(size=16)),
        xaxis=dict(title="日時", tickformat="%m/%d", dtick=86400000),
        yaxis=dict(title="温度 (°C)"),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        hovermode="x unified",
        height=420,
        margin=dict(l=60, r=20, t=60, b=60),
        plot_bgcolor="#fafafa",
        paper_bgcolor="white",
    )
    fig.update_xaxes(showgrid=True, gridcolor="#eeeeee")
    fig.update_yaxes(showgrid=True, gridcolor="#eeeeee")
    return fig


def plot_heat_balance(result_df: pd.DataFrame) -> go.Figure:
    """熱収支の積み上げグラフ"""
    daily = result_df[["Q_solar", "Q_cond", "Q_infil", "Q_internal", "Q_hvac"]].resample("D").mean()

    fig = go.Figure()

    colors = {
        "Q_solar": "#f39c12",
        "Q_cond": "#3498db",
        "Q_infil": "#9b59b6",
        "Q_internal": "#e74c3c",
        "Q_hvac": "#1abc9c",
    }
    labels = {
        "Q_solar": "日射取得",
        "Q_cond": "貫流熱",
        "Q_infil": "換気・隙間風",
        "Q_internal": "内部発熱",
        "Q_hvac": "空調",
    }

    for col in ["Q_solar", "Q_cond", "Q_infil", "Q_internal", "Q_hvac"]:
        fig.add_trace(go.Bar(
            x=daily.index,
            y=daily[col],
            name=labels[col],
            marker_color=colors[col],
            hovertemplate=f"{labels[col]}: %{{y:.0f}} W<extra></extra>",
        ))

    fig.update_layout(
        title=dict(text="日平均熱収支", font=dict(size=16)),
        xaxis=dict(title="日付", tickformat="%m/%d"),
        yaxis=dict(title="熱量 (W)"),
        barmode="relative",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        height=380,
        margin=dict(l=60, r=20, t=60, b=60),
        plot_bgcolor="#fafafa",
        paper_bgcolor="white",
    )
    fig.update_xaxes(showgrid=True, gridcolor="#eeeeee")
    fig.update_yaxes(showgrid=True, gridcolor="#eeeeee", zeroline=True, zerolinecolor="#555")
    return fig


def plot_temperature_heatmap(result_df: pd.DataFrame) -> go.Figure:
    """時刻 × 日付の室温ヒートマップ"""
    df = result_df[["T_room"]].copy()
    df["date"] = df.index.date
    df["hour"] = df.index.hour

    pivot = df.pivot_table(index="hour", columns="date", values="T_room", aggfunc="mean")

    fig = go.Figure(data=go.Heatmap(
        z=pivot.values,
        x=[str(c) for c in pivot.columns],
        y=pivot.index,
        colorscale="RdBu_r",
        colorbar=dict(title="室温 (°C)"),
        hovertemplate="日付: %{x}<br>時刻: %{y}時<br>室温: %{z:.1f}°C<extra></extra>",
    ))

    fig.update_layout(
        title=dict(text="室温ヒートマップ (時刻 × 日付)", font=dict(size=16)),
        xaxis=dict(title="日付", nticks=10),
        yaxis=dict(title="時刻 (時)", autorange="reversed"),
        height=380,
        margin=dict(l=70, r=20, t=60, b=60),
    )
    return fig


def plot_daily_stats(result_df: pd.DataFrame) -> go.Figure:
    """日別の最高・最低・平均室温"""
    daily_max = result_df["T_room"].resample("D").max()
    daily_min = result_df["T_room"].resample("D").min()
    daily_mean = result_df["T_room"].resample("D").mean()
    outdoor_mean = result_df["T_outdoor"].resample("D").mean()

    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=list(daily_max.index) + list(daily_min.index[::-1]),
        y=list(daily_max.values) + list(daily_min.values[::-1]),
        fill="toself",
        fillcolor="rgba(231, 76, 60, 0.15)",
        line=dict(color="rgba(255,255,255,0)"),
        name="室温範囲 (最高〜最低)",
        hoverinfo="skip",
    ))

    fig.add_trace(go.Scatter(
        x=daily_mean.index,
        y=daily_mean.values,
        name="日平均室温",
        line=dict(color="#e74c3c", width=2),
    ))

    fig.add_trace(go.Scatter(
        x=outdoor_mean.index,
        y=outdoor_mean.values,
        name="日平均外気温",
        line=dict(color="#3498db", width=1.5, dash="dot"),
    ))

    fig.update_layout(
        title=dict(text="日別室温統計", font=dict(size=16)),
        xaxis=dict(title="日付", tickformat="%m/%d"),
        yaxis=dict(title="温度 (°C)"),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        height=380,
        margin=dict(l=60, r=20, t=60, b=60),
        plot_bgcolor="#fafafa",
        paper_bgcolor="white",
    )
    fig.update_xaxes(showgrid=True, gridcolor="#eeeeee")
    fig.update_yaxes(showgrid=True, gridcolor="#eeeeee")
    return fig
