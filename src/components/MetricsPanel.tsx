import { SimulationResult, Region } from '../types';

interface Props {
  result: SimulationResult;
  region: Region;
  month: number;
}

function Metric({ label, value, unit, color, sub }: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className={`rounded-xl p-3 ${color || 'bg-gray-50'} border border-gray-100`}>
      <div className="text-xs text-gray-500 mb-1 font-medium">{label}</div>
      <div className="text-xl font-black text-gray-800">
        {value}<span className="text-xs font-normal text-gray-500 ml-0.5">{unit}</span>
      </div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function savingPct(design: number, ref: number): string {
  if (ref === 0) return '—';
  const pct = ((ref - design) / ref) * 100;
  return `${pct >= 0 ? '-' : '+'}${Math.abs(pct).toFixed(0)}%`;
}

export default function MetricsPanel({ result, region, month }: Props) {
  const isSummerMonth = month >= 5 && month <= 9;
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  const coolingEnergySaving = savingPct(result.dailyCoolingEnergy, result.dailyCoolingEnergy_ref);
  const heatingEnergySaving = savingPct(result.dailyHeatingEnergy, result.dailyHeatingEnergy_ref);

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-800 mb-3">シミュレーション結果 — {months[month]}</h3>

      {/* Thermal performance */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Metric
          label="熱時定数 τ"
          value={result.thermalTimeConstant.toFixed(1)}
          unit="h"
          color="bg-blue-50"
          sub="建物の熱応答速度"
        />
        <Metric
          label="位相遅れ"
          value={result.thermalLag.toFixed(1)}
          unit="h"
          color="bg-indigo-50"
          sub="外気→室温ピーク差"
        />
        <Metric
          label="室温最小値"
          value={result.indoorMin.toFixed(1)}
          unit="°C"
          color={result.indoorMin >= 18 ? 'bg-green-50' : 'bg-blue-50'}
          sub={result.indoorMin >= 18 ? '✓ 快適域内' : '⚠ 暖房必要'}
        />
        <Metric
          label="室温最高値"
          value={result.indoorMax.toFixed(1)}
          unit="°C"
          color={result.indoorMax <= 28 ? 'bg-green-50' : 'bg-red-50'}
          sub={result.indoorMax <= 28 ? '✓ 快適域内' : '⚠ 冷房必要'}
        />
      </div>

      {/* Energy comparison */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 mb-2 border border-green-100">
        <div className="text-xs font-bold text-green-800 mb-2">エネルギー削減効果（vs 参照建物）</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-600 mb-0.5">冷房負荷（日）</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-gray-800">{result.dailyCoolingEnergy.toFixed(2)}</span>
              <span className="text-xs text-gray-500">kWh</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                coolingEnergySaving.startsWith('-') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>{coolingEnergySaving}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-0.5">暖房負荷（日）</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-gray-800">{result.dailyHeatingEnergy.toFixed(2)}</span>
              <span className="text-xs text-gray-500">kWh</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                heatingEnergySaving.startsWith('-') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>{heatingEnergySaving}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Comfort hours */}
      <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-3 border border-amber-100">
        <div className="text-3xl font-black text-amber-700">
          {((result.comfortHours / 24) * 100).toFixed(0)}%
        </div>
        <div>
          <div className="text-xs font-bold text-amber-800">快適時間率</div>
          <div className="text-xs text-amber-600">
            {result.comfortHours.toFixed(1)}時間 / 24時間が快適域（18〜28°C）
          </div>
          <div className="mt-1 h-2 w-full bg-amber-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${(result.comfortHours / 24) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
        <div className="text-xs font-bold text-slate-700 mb-1">
          {region.name}（{region.zone}地域）の推奨UA値
        </div>
        <div className="flex gap-2 text-xs">
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
            省エネ基準: {region.recommendations.UA} W/(m²K)
          </span>
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
            ZEH基準: {region.recommendations.zehUA} W/(m²K)
          </span>
        </div>
      </div>
    </div>
  );
}
