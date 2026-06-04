import { BuildingParams, Region } from '../types';
import { calcUA } from '../simulation/thermalModel';

interface Props {
  params: BuildingParams;
  onChange: (p: BuildingParams) => void;
  region: Region;
}

function Slider({
  label, value, min, max, step, unit, onChange, format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
          {format ? format(value) : value}{unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
          style={{
            background: `linear-gradient(to right, #2563eb ${pct}%, #e2e8f0 ${pct}%)`,
          }}
        />
      </div>
    </div>
  );
}

export default function DesignPanel({ params, onChange, region }: Props) {
  const set = <K extends keyof BuildingParams>(key: K, val: BuildingParams[K]) =>
    onChange({ ...params, [key]: val });

  const ua = calcUA(params);
  const rec = region.recommendations;
  const uaOk = ua <= rec.UA;
  const southOk = params.southWindowRatio >= rec.southWindowRatioMin && params.southWindowRatio <= rec.southWindowRatioMax;

  return (
    <div className="space-y-4 text-sm">
      {/* UA value badge */}
      <div className={`flex items-center justify-between p-2.5 rounded-lg border-2 ${uaOk ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}`}>
        <div>
          <div className="text-xs font-bold text-gray-700">外皮平均熱貫流率 UA値</div>
          <div className="text-xs text-gray-500">目標: {rec.UA} W/(m²K)以下</div>
        </div>
        <div className={`text-xl font-black ${uaOk ? 'text-green-700' : 'text-orange-700'}`}>
          {ua.toFixed(2)}
        </div>
      </div>

      {/* Building geometry */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">建物形状</h4>
        <Slider label="床面積" value={params.floorArea} min={30} max={200} step={5} unit=" m²"
          onChange={(v) => set('floorArea', v)} />
        <Slider label="階高" value={params.height} min={2.2} max={3.5} step={0.1} unit=" m"
          onChange={(v) => set('height', v)} />
      </div>

      {/* Envelope */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">断熱外皮</h4>
        <Slider label="壁 U値" value={params.wallUValue} min={0.1} max={1.5} step={0.05} unit=" W/(m²K)"
          onChange={(v) => set('wallUValue', v)} format={(v) => v.toFixed(2)} />
        <Slider label="屋根 U値" value={params.roofUValue} min={0.05} max={0.8} step={0.05} unit=" W/(m²K)"
          onChange={(v) => set('roofUValue', v)} format={(v) => v.toFixed(2)} />
        <Slider label="床 U値" value={params.floorUValue} min={0.1} max={0.8} step={0.05} unit=" W/(m²K)"
          onChange={(v) => set('floorUValue', v)} format={(v) => v.toFixed(2)} />
      </div>

      {/* Windows */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">開口部</h4>
        <div className={`mb-1 text-xs px-2 py-1 rounded ${southOk ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          推奨南面比: {(rec.southWindowRatioMin * 100).toFixed(0)}〜{(rec.southWindowRatioMax * 100).toFixed(0)}%
        </div>
        <Slider label="南面窓面積比" value={params.southWindowRatio} min={0.02} max={0.4} step={0.01} unit="%"
          onChange={(v) => set('southWindowRatio', v)} format={(v) => (v * 100).toFixed(0)} />
        <Slider label="北面窓面積比" value={params.northWindowRatio} min={0} max={0.15} step={0.01} unit="%"
          onChange={(v) => set('northWindowRatio', v)} format={(v) => (v * 100).toFixed(0)} />
        <Slider label="窓 U値" value={params.windowUValue} min={0.5} max={6.0} step={0.1} unit=" W/(m²K)"
          onChange={(v) => set('windowUValue', v)} format={(v) => v.toFixed(1)} />
        <Slider label="SHGC（日射取得率）" value={params.SHGC} min={0.1} max={0.85} step={0.05} unit=""
          onChange={(v) => set('SHGC', v)} format={(v) => v.toFixed(2)} />
      </div>

      {/* Thermal mass */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">蓄熱・換気</h4>
        <Slider label="熱容量" value={params.thermalMass} min={20} max={300} step={10} unit=" kJ/(m²K)"
          onChange={(v) => set('thermalMass', v)} />
        <Slider label="換気回数" value={params.ACH} min={0.2} max={3.0} step={0.1} unit=" 回/h"
          onChange={(v) => set('ACH', v)} format={(v) => v.toFixed(1)} />
        <Slider label="庇オーバーハング比" value={params.overhanRatio} min={0} max={0.8} step={0.05} unit=""
          onChange={(v) => set('overhanRatio', v)} format={(v) => v.toFixed(2)} />
      </div>

      {/* Occupants */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">内部発熱</h4>
        <Slider label="在室人数" value={params.occupants} min={0} max={8} step={1} unit=" 人"
          onChange={(v) => set('occupants', v)} />
      </div>
    </div>
  );
}
