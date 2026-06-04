import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { PassiveScores } from '../types';

interface Props {
  scores: PassiveScores;
}

const SCORE_LABELS: Record<keyof Omit<PassiveScores, 'overall'>, string> = {
  solarUtilization: '日射利用',
  insulation: '断熱性能',
  thermalMass: '熱容量',
  naturalVentilation: '自然換気',
  shading: '日射遮蔽',
};

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#2563eb';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 80) return '優秀';
  if (score >= 60) return '良好';
  if (score >= 40) return '普通';
  return '要改善';
}

export default function PassiveRadar({ scores }: Props) {
  const data = [
    { subject: '日射利用', value: scores.solarUtilization, fullMark: 100 },
    { subject: '断熱性能', value: scores.insulation, fullMark: 100 },
    { subject: '熱容量', value: scores.thermalMass, fullMark: 100 },
    { subject: '自然換気', value: scores.naturalVentilation, fullMark: 100 },
    { subject: '日射遮蔽', value: scores.shading, fullMark: 100 },
  ];

  const overall = scores.overall;
  const color = scoreColor(overall);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-800">パッシブデザイン評価</h3>
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white"
          style={{ background: color }}
        >
          <span>{overall}</span>
          <span>点 — {scoreLabel(overall)}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: '#94a3b8' }} tickCount={4} />
          <Radar
            name="スコア"
            dataKey="value"
            stroke="#2563eb"
            fill="#3b82f6"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(val: number) => [`${val}点`, 'スコア']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Score breakdown */}
      <div className="grid grid-cols-1 gap-1 mt-1">
        {(Object.entries(SCORE_LABELS) as [keyof Omit<PassiveScores, 'overall'>, string][]).map(([key, label]) => {
          const val = scores[key];
          const c = scoreColor(val);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-16 shrink-0">{label}</span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${val}%`, background: c }}
                />
              </div>
              <span className="text-xs font-bold w-8 text-right" style={{ color: c }}>{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
