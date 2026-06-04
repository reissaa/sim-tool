import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { HourlyData } from '../types';

interface Props {
  data: HourlyData[];
  month: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-bold text-gray-700 mb-1">{Number(label).toFixed(1)} 時</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-800">{Number(p.value).toFixed(1)}°C</span>
        </div>
      ))}
    </div>
  );
};

export default function SimulationChart({ data, month }: Props) {
  const tickFormatter = (v: number) => `${v}時`;
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  const allTemps = data.flatMap((d) => [d.T_outside, d.T_room, d.T_room_ref]);
  const minTemp = Math.floor(Math.min(...allTemps) - 1);
  const maxTemp = Math.ceil(Math.max(...allTemps) + 1);

  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800">24時間温度シミュレーション</h3>
          <p className="text-xs text-gray-500">{months[month]} — 非定常熱応答解析</p>
        </div>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500" />
            <span className="text-gray-600">設計値</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-orange-400 border-dashed" style={{ borderTop: '2px dashed #fb923c' }} />
            <span className="text-gray-600">参照値</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-red-400" />
            <span className="text-gray-600">外気温</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="hour"
            ticks={ticks}
            tickFormatter={tickFormatter}
            tick={{ fontSize: 10, fill: '#64748b' }}
            domain={[0, 24]}
          />
          <YAxis
            domain={[minTemp, maxTemp]}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickFormatter={(v) => `${v}°C`}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Comfort zone shading */}
          <Area
            type="monotone"
            dataKey="T_outside"
            fill="transparent"
            stroke="transparent"
          />
          <ReferenceLine y={18} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1}
            label={{ value: '快適域下限', position: 'left', fontSize: 9, fill: '#10b981' }} />
          <ReferenceLine y={28} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1}
            label={{ value: '快適域上限', position: 'left', fontSize: 9, fill: '#f59e0b' }} />

          <Area
            type="monotone"
            dataKey="T_room"
            fill="#eff6ff"
            stroke="transparent"
            name="_comfort_fill"
          />

          <Line
            type="monotone"
            dataKey="T_outside"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            name="外気温"
          />
          <Line
            type="monotone"
            dataKey="T_room_ref"
            stroke="#fb923c"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            name="参照建物"
          />
          <Line
            type="monotone"
            dataKey="T_room"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={false}
            name="設計建物"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Thermal lag annotation */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-blue-700 font-bold text-base">
            {Math.round((Math.max(...data.map(d => d.T_room)) - Math.min(...data.map(d => d.T_room))) * 10) / 10}°C
          </div>
          <div className="text-blue-500">室温日较差</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-red-700 font-bold text-base">
            {Math.round((Math.max(...data.map(d => d.T_outside)) - Math.min(...data.map(d => d.T_outside))) * 10) / 10}°C
          </div>
          <div className="text-red-500">外気温日较差</div>
        </div>
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <div className="text-green-700 font-bold text-base">
            {Math.round(data.filter(d => d.T_room >= 18 && d.T_room <= 28).length / data.length * 100)}%
          </div>
          <div className="text-green-500">快適時間率</div>
        </div>
      </div>
    </div>
  );
}
