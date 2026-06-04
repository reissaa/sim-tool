import { useState, useMemo } from 'react';
import { REGIONS, MONTHS, ZONE_COLORS } from '../data/climateData';
import { BuildingParams, Region } from '../types';
import { runSimulation, calcPassiveScores } from '../simulation/thermalModel';
import BuildingModel from './BuildingModel';
import SimulationChart from './SimulationChart';
import PassiveRadar from './PassiveRadar';
import ClimateCard from './ClimateCard';
import MetricsPanel from './MetricsPanel';
import DesignPanel from './DesignPanel';

const DEFAULT_PARAMS: BuildingParams = {
  floorArea: 100,
  height: 2.7,
  widthDepthRatio: 1.25,
  orientation: 0,
  wallUValue: 0.35,
  roofUValue: 0.15,
  floorUValue: 0.25,
  southWindowRatio: 0.16,
  northWindowRatio: 0.03,
  eastWindowRatio: 0.03,
  westWindowRatio: 0.02,
  windowUValue: 1.4,
  SHGC: 0.55,
  thermalMass: 120,
  ACH: 0.5,
  occupants: 4,
  overhanRatio: 0.3,
};

export default function Dashboard() {
  const [selectedRegionId, setSelectedRegionId] = useState('tokyo');
  const [selectedMonth, setSelectedMonth] = useState(7);
  const [params, setParams] = useState<BuildingParams>(DEFAULT_PARAMS);
  const [sidebarTab, setSidebarTab] = useState<'design' | 'climate'>('design');

  const region = REGIONS.find((r) => r.id === selectedRegionId) ?? REGIONS[2];

  const simResult = useMemo(
    () => runSimulation(params, region, selectedMonth),
    [params, region, selectedMonth]
  );

  const scores = useMemo(
    () => calcPassiveScores(params, region, selectedMonth),
    [params, region, selectedMonth]
  );

  const midDayHour = simResult.hourly.find((h) => h.hour >= 12) ?? simResult.hourly[0];
  const indoorTemp = midDayHour?.T_room ?? 20;
  const outdoorTemp = midDayHour?.T_outside ?? 20;

  const zoneColor = ZONE_COLORS[region.zone];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2">
                <path d="M3 12L12 3L21 12V20H15V15H9V20H3V12Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-black text-gray-900 leading-none">パッシブデザイン分析</h1>
              <p className="text-xs text-gray-500">非定常住宅熱シミュレーション</p>
            </div>
          </div>

          {/* Region selector */}
          <div className="flex items-center gap-1 flex-wrap">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRegionId(r.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  r.id === selectedRegionId
                    ? 'text-white shadow-md scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={r.id === selectedRegionId ? { background: ZONE_COLORS[r.zone] } : {}}
              >
                {r.name}
              </button>
            ))}
          </div>

          {/* Month selector */}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">解析月:</span>
            {MONTHS.map((m, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonth(i)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  i === selectedMonth
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-screen-2xl mx-auto w-full px-3 py-3 gap-3">
        {/* Left sidebar */}
        <aside className="w-72 shrink-0 flex flex-col gap-3">
          {/* Tab selector */}
          <div className="bg-white rounded-2xl p-1 flex gap-1 shadow-sm border border-gray-100">
            <button
              onClick={() => setSidebarTab('design')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                sidebarTab === 'design' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              設計条件
            </button>
            <button
              onClick={() => setSidebarTab('climate')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                sidebarTab === 'climate' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              気候データ
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex-1 overflow-y-auto max-h-[calc(100vh-130px)]">
            {sidebarTab === 'design' ? (
              <DesignPanel params={params} onChange={setParams} region={region} />
            ) : (
              <ClimateCard region={region} month={selectedMonth} />
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Top row: Building model + Passive scores */}
          <div className="grid grid-cols-5 gap-3">
            {/* Building model */}
            <div className="col-span-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-800">建物モデル</h2>
                <div className="flex gap-2 text-xs">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                    {params.floorArea}m² / {params.height}m高
                  </span>
                  <span className="px-2 py-1 rounded-full text-white font-medium"
                    style={{ background: zoneColor }}>
                    {region.zone}地域
                  </span>
                </div>
              </div>
              <BuildingModel
                params={params}
                indoorTemp={indoorTemp}
                outdoorTemp={outdoorTemp}
                month={selectedMonth}
              />
            </div>

            {/* Passive scores */}
            <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <PassiveRadar scores={scores} />
            </div>
          </div>

          {/* Bottom row: Simulation chart + Metrics */}
          <div className="grid grid-cols-5 gap-3">
            {/* Simulation chart */}
            <div className="col-span-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <SimulationChart data={simResult.hourly} month={selectedMonth} />
            </div>

            {/* Metrics */}
            <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 overflow-y-auto">
              <MetricsPanel result={simResult} region={region} month={selectedMonth} />
            </div>
          </div>
        </main>
      </div>

      <footer className="text-center py-2 text-xs text-gray-400 border-t border-gray-100 bg-white">
        非定常住宅熱シミュレーション — パッシブデザイン分析ツール © 2026
      </footer>
    </div>
  );
}
