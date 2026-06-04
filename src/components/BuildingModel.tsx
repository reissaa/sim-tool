import { BuildingParams } from '../types';

interface Props {
  params: BuildingParams;
  indoorTemp: number;
  outdoorTemp: number;
  month: number;
}

function tempToColor(temp: number): string {
  if (temp < 10) return '#60a5fa';
  if (temp < 18) return '#93c5fd';
  if (temp < 22) return '#86efac';
  if (temp < 26) return '#fde68a';
  if (temp < 30) return '#fca5a5';
  return '#ef4444';
}

export default function BuildingModel({ params, indoorTemp, outdoorTemp, month }: Props) {
  const s = 28;
  const cx = 220;
  const cy = 80;

  const W = 10;
  const D = 8;
  const H = 3;
  const ridgeH = 5;

  function iso(x: number, y: number, z: number): [number, number] {
    const px = cx + (x - y) * s * 0.866;
    const py = cy + (x + y) * s * 0.5 - z * s;
    return [px, py];
  }

  function pts(...coords: [number, number][]): string {
    return coords.map(([x, y]) => `${x},${y}`).join(' ');
  }

  const sw = iso(0, 0, 0);
  const se = iso(W, 0, 0);
  const ne = iso(W, D, 0);
  const nw = iso(0, D, 0);
  const swT = iso(0, 0, H);
  const seT = iso(W, 0, H);
  const neT = iso(W, D, H);
  const nwT = iso(0, D, H);
  const ridgeE = iso(W / 2, 0, ridgeH);
  const ridgeW = iso(W / 2, D, ridgeH);

  const southWindow1 = {
    tl: iso(2, 0, H * 0.4),
    br: iso(5, 0, H * 0.85),
  };
  const southWindow2 = {
    tl: iso(5.5, 0, H * 0.4),
    br: iso(8, 0, H * 0.85),
  };
  const eastWindow = {
    tl: iso(W, 2, H * 0.4),
    br: iso(W, 5, H * 0.75),
  };

  const indoorColor = tempToColor(indoorTemp);
  const outdoorColor = tempToColor(outdoorTemp);

  const insulationThick = Math.max(0.02, Math.min(0.15, (0.5 - params.wallUValue) / 3));
  const wallColor = params.wallUValue < 0.4 ? '#dbeafe' : params.wallUValue < 0.7 ? '#bfdbfe' : '#e2e8f0';

  const isSummer = month >= 5 && month <= 9;
  const hasSunRays = !isSummer || params.overhanRatio < 0.3;
  const shadowDepth = isSummer ? Math.min(s * 2.5, params.overhanRatio * s * 8) : 0;

  const southWindowColor = hasSunRays ? '#fef9c3' : '#dbeafe';
  const southFaceHighlight = isSummer ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.3)';

  const roofColor = isSummer ? '#94a3b8' : '#cbd5e1';

  return (
    <div className="relative">
      <svg width="440" height="320" className="w-full" viewBox="0 0 440 320">
        <defs>
          <linearGradient id="indoorGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={indoorColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={indoorColor} stopOpacity="0.05" />
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="2" dy="4" stdDeviation="4" floodOpacity="0.2" />
          </filter>
          <pattern id="insulation" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0,4 Q2,0 4,4 Q6,8 8,4" stroke="#93c5fd" strokeWidth="1.5" fill="none" />
          </pattern>
        </defs>

        {/* Ground shadow */}
        <ellipse cx={cx + s * 2} cy={cy + (W + D) * s * 0.5 + 8} rx={s * 8} ry={s * 1.5}
          fill="rgba(0,0,0,0.08)" />

        {/* Ground plane */}
        <polygon
          points={pts(
            [sw[0] - s * 2, sw[1] + s * 0.5],
            [se[0] + s * 2, se[1] + s * 0.5],
            [ne[0] + s * 2, ne[1] + s * 0.5],
            [nw[0] - s * 2, nw[1] + s * 0.5],
          )}
          fill="#e8f5e9" stroke="#a7f3d0" strokeWidth="1"
        />

        {/* North wall (back, darker) */}
        <polygon points={pts(nw, ne, neT, nwT)} fill="#b0bec5" stroke="#90a4ae" strokeWidth="1" filter="url(#shadow)" />

        {/* East wall */}
        <polygon points={pts(se, ne, neT, seT)} fill="#cfd8dc" stroke="#b0bec5" strokeWidth="1" />

        {/* South wall (main facade) */}
        <polygon points={pts(sw, se, seT, swT)} fill={wallColor} stroke="#93c5fd" strokeWidth="1.5" />
        <polygon points={pts(sw, se, seT, swT)} fill={southFaceHighlight} />

        {/* Insulation layer on south wall */}
        {params.wallUValue < 0.6 && (
          <polygon
            points={pts(
              [sw[0] + insulationThick * s * 0.866 * 2, sw[1] + insulationThick * s],
              [se[0] + insulationThick * s * 0.866 * 2, se[1] + insulationThick * s],
              [seT[0] + insulationThick * s * 0.866 * 2, seT[1] + insulationThick * s],
              [swT[0] + insulationThick * s * 0.866 * 2, swT[1] + insulationThick * s],
            )}
            fill="url(#insulation)" stroke="#93c5fd" strokeWidth="0.5" opacity="0.6"
          />
        )}

        {/* South windows */}
        <polygon
          points={pts(southWindow1.tl, [southWindow1.br[0], southWindow1.tl[1]], southWindow1.br, [southWindow1.tl[0], southWindow1.br[1]])}
          fill={southWindowColor} stroke="#3b82f6" strokeWidth="1.5"
        />
        <line x1={southWindow1.tl[0]} y1={(southWindow1.tl[1] + southWindow1.br[1]) / 2}
          x2={southWindow1.br[0]} y2={(southWindow1.tl[1] + southWindow1.br[1]) / 2}
          stroke="#3b82f6" strokeWidth="0.8" />
        <line x1={(southWindow1.tl[0] + southWindow1.br[0]) / 2} y1={southWindow1.tl[1]}
          x2={(southWindow1.tl[0] + southWindow1.br[0]) / 2} y2={southWindow1.br[1]}
          stroke="#3b82f6" strokeWidth="0.8" />

        <polygon
          points={pts(southWindow2.tl, [southWindow2.br[0], southWindow2.tl[1]], southWindow2.br, [southWindow2.tl[0], southWindow2.br[1]])}
          fill={southWindowColor} stroke="#3b82f6" strokeWidth="1.5"
        />
        <line x1={southWindow2.tl[0]} y1={(southWindow2.tl[1] + southWindow2.br[1]) / 2}
          x2={southWindow2.br[0]} y2={(southWindow2.tl[1] + southWindow2.br[1]) / 2}
          stroke="#3b82f6" strokeWidth="0.8" />
        <line x1={(southWindow2.tl[0] + southWindow2.br[0]) / 2} y1={southWindow2.tl[1]}
          x2={(southWindow2.tl[0] + southWindow2.br[0]) / 2} y2={southWindow2.br[1]}
          stroke="#3b82f6" strokeWidth="0.8" />

        {/* East window */}
        <polygon
          points={pts(eastWindow.tl, [eastWindow.br[0], eastWindow.tl[1]], eastWindow.br, [eastWindow.tl[0], eastWindow.br[1]])}
          fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8"
        />

        {/* Overhang on south face */}
        {params.overhanRatio > 0.05 && (
          <>
            <polygon
              points={pts(
                [swT[0] - 2, swT[1] - params.overhanRatio * s * 3],
                [seT[0] - 2, seT[1] - params.overhanRatio * s * 3],
                [seT[0] - 2 - params.overhanRatio * s * 0.866 * 2, seT[1] - params.overhanRatio * s * 3 + params.overhanRatio * s],
                [swT[0] - 2 - params.overhanRatio * s * 0.866 * 2, swT[1] - params.overhanRatio * s * 3 + params.overhanRatio * s],
              )}
              fill="#94a3b8" stroke="#64748b" strokeWidth="1"
            />
            {isSummer && (
              <polygon
                points={pts(
                  [swT[0] - 2 - params.overhanRatio * s * 0.866 * 2, swT[1] - params.overhanRatio * s * 3 + params.overhanRatio * s],
                  [seT[0] - 2 - params.overhanRatio * s * 0.866 * 2, seT[1] - params.overhanRatio * s * 3 + params.overhanRatio * s],
                  [seT[0] - 2, seT[1]],
                  [swT[0] - 2, swT[1]],
                )}
                fill="rgba(30,30,30,0.25)"
              />
            )}
          </>
        )}

        {/* North roof slope */}
        <polygon points={pts(nwT, neT, ridgeW, ridgeE)} fill={roofColor} stroke="#64748b" strokeWidth="1" />

        {/* South roof slope */}
        <polygon points={pts(swT, seT, ridgeE, ridgeW)} fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />

        {/* Ridge */}
        <line x1={ridgeE[0]} y1={ridgeE[1]} x2={ridgeW[0]} y2={ridgeW[1]}
          stroke="#475569" strokeWidth="2" />

        {/* West gable */}
        <polygon points={pts(swT, nwT, ridgeW, ridgeE)} fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />

        {/* Solar gain arrows */}
        {hasSunRays && (
          <g opacity="0.75">
            {[0, 1, 2].map((i) => {
              const startX = southWindow1.tl[0] + (i + 0.5) * (southWindow1.br[0] - southWindow1.tl[0]) / 3 - 30;
              const startY = southWindow1.tl[1] - 40;
              const endX = startX + 20;
              const endY = southWindow1.tl[1] - 5;
              return (
                <g key={i}>
                  <line x1={startX} y1={startY} x2={endX} y2={endY}
                    stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrowYellow)" />
                </g>
              );
            })}
            <defs>
              <marker id="arrowYellow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
              </marker>
            </defs>
            <text x={southWindow1.tl[0] - 42} y={southWindow1.tl[1] - 45}
              fontSize="9" fill="#d97706" fontWeight="600">日射</text>
          </g>
        )}

        {/* Overhang blocking summer sun */}
        {isSummer && shadowDepth > 0 && (
          <text x={seT[0] + 10} y={seT[1]} fontSize="8" fill="#475569">庇で遮蔽</text>
        )}

        {/* Indoor temp indicator */}
        <rect x="8" y="220" width="80" height="50" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
        <rect x="8" y="220" width="80" height="14" rx="4" fill={indoorColor} opacity="0.8" />
        <text x="48" y="230" fontSize="8" textAnchor="middle" fill="#1e3a8a" fontWeight="700">室内温度</text>
        <text x="48" y="248" fontSize="16" textAnchor="middle" fill="#1e293b" fontWeight="800">
          {indoorTemp.toFixed(1)}°C
        </text>
        <text x="48" y="262" fontSize="8" textAnchor="middle" fill="#64748b">外気: {outdoorTemp.toFixed(1)}°C</text>

        {/* Compass */}
        <g transform="translate(398, 60)">
          <circle r="22" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
          <text x="0" y="-12" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ef4444">N</text>
          <text x="0" y="18" textAnchor="middle" fontSize="9" fontWeight="700" fill="#3b82f6">S</text>
          <text x="-15" y="4" textAnchor="middle" fontSize="9" fill="#64748b">W</text>
          <text x="15" y="4" textAnchor="middle" fontSize="9" fill="#64748b">E</text>
          <line x1="0" y1="-8" x2="0" y2="8" stroke="#64748b" strokeWidth="1" />
          <line x1="-8" y1="0" x2="8" y2="0" stroke="#64748b" strokeWidth="1" />
          <polygon points="0,-8 3,-2 -3,-2" fill="#ef4444" />
        </g>

        {/* Labels */}
        <text x={iso(W / 2, 0, 0)[0]} y={iso(W / 2, 0, 0)[1] + 16}
          textAnchor="middle" fontSize="9" fill="#1e3a8a" fontWeight="600">南面（正面）</text>
        <text x={iso(W, D / 2, 0)[0] + 5} y={iso(W, D / 2, 0)[1] + 5}
          textAnchor="start" fontSize="9" fill="#475569">東面</text>

        {/* Thermal mass indicator */}
        {params.thermalMass > 80 && (
          <g>
            <rect x="340" y="220" width="90" height="45" rx="6" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5" />
            <text x="385" y="234" textAnchor="middle" fontSize="8" fill="#166534" fontWeight="700">蓄熱層</text>
            <rect x="352" y="238" width="66" height="10" rx="3" fill="#4ade80" opacity="0.6" />
            <rect x="352" y="250" width={Math.min(66, params.thermalMass / 200 * 66)} height="5" rx="2" fill="#16a34a" />
            <text x="385" y="261" textAnchor="middle" fontSize="8" fill="#166534">
              {params.thermalMass} kJ/(m²K)
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-1 px-2 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded" style={{ background: '#fef9c3', border: '1px solid #3b82f6' }} />
          <span>南面窓（日射取得）</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded" style={{ background: '#e2e8f0', border: '1px solid #64748b' }} />
          <span>断熱外皮</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded" style={{ background: '#86efac' }} />
          <span>蓄熱体</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-amber-500 font-bold">→</span>
          <span>日射</span>
        </div>
      </div>
    </div>
  );
}
