import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Region } from '../types';
import { MONTHS, ZONE_COLORS } from '../data/climateData';

interface Props {
  region: Region;
  month: number;
}

export default function ClimateCard({ region, month }: Props) {
  const climate = region.climate;
  const zoneColor = ZONE_COLORS[region.zone];

  const tempData = MONTHS.map((m, i) => ({
    month: m.replace('月', ''),
    temp: climate.monthlyAvgTemp[i],
    solar: climate.monthlySolarSouth[i],
    active: i === month,
  }));

  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-800">{region.name}の気候概要</h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full text-white font-bold"
              style={{ background: zoneColor }}
            >
              {region.zone}地域
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{region.prefecture} / 緯度 {region.latitude}°N</p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <div>HDD: <span className="font-bold text-blue-700">{climate.HDD}</span> °D</div>
          <div>CDD: <span className="font-bold text-red-600">{climate.CDD}</span> °D</div>
        </div>
      </div>

      {/* Monthly temp chart */}
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={tempData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} tickFormatter={(v) => `${v}°`} />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(1)}°C`, '月平均気温']}
            contentStyle={{ fontSize: 11, borderRadius: 6 }}
          />
          <Bar dataKey="temp" radius={[3, 3, 0, 0]}>
            {tempData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.active ? '#2563eb' : entry.temp < 0 ? '#93c5fd' : entry.temp < 15 ? '#7dd3fc' : entry.temp < 25 ? '#86efac' : '#fca5a5'}
                opacity={entry.active ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Key climate stats */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-blue-700 font-bold text-sm">
            {climate.monthlyAvgTemp[month].toFixed(1)}°C
          </div>
          <div className="text-blue-500 text-xs">{MONTHS[month]}平均気温</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-2 text-center">
          <div className="text-amber-700 font-bold text-sm">
            {climate.monthlySolarSouth[month].toFixed(1)}
          </div>
          <div className="text-amber-500 text-xs">南面日射 kWh/m²</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-slate-700 font-bold text-sm">
            {climate.avgWindSpeed}m/s
          </div>
          <div className="text-slate-500 text-xs">{climate.prevailingWind}卓越風</div>
        </div>
      </div>

      {/* Passive strategies */}
      <div className="mt-2">
        <p className="text-xs font-semibold text-gray-700 mb-1">地域のパッシブ戦略</p>
        <div className="flex flex-wrap gap-1">
          {region.passiveStrategies.map((s) => (
            <span key={s} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
