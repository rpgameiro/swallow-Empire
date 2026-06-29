import { useState, useRef, useEffect } from 'react';
import {
  BarChart2, TrendingUp, Map, Activity, Layers, Star,
  Flame, Shield, Eye, ChevronUp, ChevronDown, Minus,
  DollarSign, Building2, Target, Zap, Crown, Users,
  AlertTriangle, Globe, Briefcase,
} from 'lucide-react';
import {
  Player, PlayerDistrict, District, DistrictMarketData,
  PlayerReputation, RivalFirm, RivalDistrictPresence, RivalEvent,
  REP_TRACK_META, getRepRank,
} from '../types/game';
import type { DynamicQuest } from '../services/questEngine';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AnalyticsDashboardProps {
  player: Player | null;
  districts: District[];
  playerDistricts: Map<string, PlayerDistrict>;
  districtMarket: Map<string, DistrictMarketData>;
  dynamicQuests: DynamicQuest[];
  reputation: PlayerReputation | null;
  rivals: RivalFirm[];
  rivalPresence: Map<string, RivalDistrictPresence[]>;
  rivalEvents: RivalEvent[];
}

// ─── Shared palette ───────────────────────────────────────────────────────────

const TERM_GREEN  = '#00ff88';
const TERM_CYAN   = '#00d4ff';
const TERM_AMBER  = '#f59e0b';
const TERM_RED    = '#ef4444';
const TERM_BLUE   = '#3b82f6';
const TERM_ORANGE = '#f97316';
const TERM_SLATE  = '#475569';

const REGION_COLORS: Record<string, string> = {
  'Lisbon Region': '#f59e0b',
  'North':         '#3b82f6',
  'Central':       '#10b981',
  'Alentejo':      '#f97316',
  'Algarve':       '#ef4444',
  'Islands':       '#ec4899',
};

// ─── Inline CSS animations ────────────────────────────────────────────────────

const DASH_CSS = `
  @keyframes dashScanLine {
    0%   { top: -2px; opacity: 0.6; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes dashTickerSlide {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes dashBarGrow {
    from { transform: scaleY(0); }
    to   { transform: scaleY(1); }
  }
  @keyframes dashHeatPulse {
    0%, 100% { opacity: 0.85; }
    50%       { opacity: 1; }
  }
  @keyframes dashLineReveal {
    from { stroke-dashoffset: 1000; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes dashGlitch {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-2px); }
    40%      { transform: translateX(2px); }
    60%      { transform: translateX(-1px); }
    80%      { transform: translateX(1px); }
  }
  @keyframes dashRadarSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes dashBlink {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.2; }
  }
  .dash-bar { transform-origin: bottom; animation: dashBarGrow 0.7s cubic-bezier(0.22,1,0.36,1) both; }
  .dash-scanline {
    position: absolute; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, rgba(0,255,136,0.15), transparent);
    animation: dashScanLine 3.5s linear infinite;
    pointer-events: none;
  }
  .dash-terminal-border {
    border: 1px solid rgba(0,255,136,0.12);
    background: linear-gradient(160deg, rgba(0,255,136,0.03), rgba(2,6,23,0.97));
  }
  .dash-panel {
    border-radius: 0.75rem;
    overflow: hidden;
    position: relative;
  }
  .dash-label {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(0,255,136,0.5);
  }
  .dash-value-lg {
    font-size: 1.75rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .dash-value-md {
    font-size: 1.1rem;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }
  .dash-corner-tl::before, .dash-corner-br::after {
    content: '';
    position: absolute;
    width: 8px; height: 8px;
    border-color: rgba(0,255,136,0.25);
    border-style: solid;
  }
  .dash-corner-tl::before { top: 0; left: 0; border-width: 1px 0 0 1px; }
  .dash-corner-br::after  { bottom: 0; right: 0; border-width: 0 1px 1px 0; }
`;

// ─── Utilities ────────────────────────────────────────────────────────────────

function heatColor(value: number, invert = false): string {
  const v = invert ? 100 - value : value;
  if (v >= 80) return '#ef4444';
  if (v >= 60) return '#f97316';
  if (v >= 40) return '#f59e0b';
  if (v >= 20) return '#10b981';
  return '#3b82f6';
}

function trendIcon(dir: string) {
  if (dir === 'rising')   return { Icon: ChevronUp,   color: TERM_GREEN  };
  if (dir === 'falling')  return { Icon: ChevronDown,  color: TERM_RED    };
  if (dir === 'volatile') return { Icon: Activity,     color: TERM_ORANGE };
  return { Icon: Minus, color: TERM_SLATE };
}

// Generates a simple SVG sparkline path from values
function sparkPath(values: number[], w: number, h: number): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return 'M' + pts.join(' L');
}

// ─── Ticker strip ─────────────────────────────────────────────────────────────

function TickerStrip({ items }: { items: { label: string; value: string; color: string; up?: boolean }[] }) {
  const content = [...items, ...items]; // double for seamless loop
  return (
    <div className="relative overflow-hidden h-7 flex items-center border-b" style={{ borderColor: 'rgba(0,255,136,0.08)' }}>
      <div
        className="flex gap-8 whitespace-nowrap"
        style={{ animation: 'dashTickerSlide 28s linear infinite' }}
      >
        {content.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs font-mono">
            <span style={{ color: 'rgba(0,255,136,0.4)' }}>·</span>
            <span className="text-slate-500 text-[10px] uppercase tracking-wider">{item.label}</span>
            <span className="font-black" style={{ color: item.color }}>{item.value}</span>
            {item.up !== undefined && (
              item.up
                ? <ChevronUp className="w-3 h-3" style={{ color: TERM_GREEN }} />
                : <ChevronDown className="w-3 h-3" style={{ color: TERM_RED }} />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, color, icon: Icon, delta, glow = false,
}: {
  label: string; value: string; sub?: string; color: string;
  icon: React.ElementType; delta?: { value: string; up: boolean };
  glow?: boolean;
}) {
  return (
    <div
      className="dash-panel dash-terminal-border dash-corner-tl dash-corner-br p-4 relative"
      style={{ boxShadow: glow ? `0 0 20px ${color}20, inset 0 0 20px ${color}05` : 'none' }}
    >
      <div className="dash-scanline" />
      <div className="flex items-start justify-between mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: color + '15', border: `1px solid ${color}30` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {delta && (
          <div className={`flex items-center gap-0.5 text-xs font-black`} style={{ color: delta.up ? TERM_GREEN : TERM_RED }}>
            {delta.up ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {delta.value}
          </div>
        )}
      </div>
      <div className="dash-label mb-1">{label}</div>
      <div className="dash-value-lg" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5 font-mono">{sub}</div>}
    </div>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────

function HBar({
  label, value, max = 100, color, sub, index = 0, showValue = true,
}: {
  label: string; value: number; max?: number; color: string;
  sub?: string; index?: number; showValue?: boolean;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-3" style={{ animationDelay: `${index * 0.06}s` }}>
      <div className="w-24 flex-shrink-0">
        <div className="text-xs font-bold text-white truncate">{label}</div>
        {sub && <div className="text-[10px] text-slate-600">{sub}</div>}
      </div>
      <div className="flex-1 relative h-5 bg-slate-900 rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
        <div
          className="h-full rounded transition-all duration-1000 relative overflow-hidden"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}50` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" style={{ backgroundSize: '200% 100%', animation: 'dashTickerSlide 3s linear infinite' }} />
        </div>
        <div className="absolute inset-0 flex items-center px-2">
          {showValue && <span className="text-[10px] font-black font-mono ml-auto" style={{ color: pct > 60 ? '#0f172a' : color }}>{Math.round(value)}</span>}
        </div>
      </div>
      {showValue && <div className="text-xs font-black font-mono w-8 text-right flex-shrink-0" style={{ color }}>{Math.round(pct)}%</div>}
    </div>
  );
}

// ─── SVG vertical bar chart ───────────────────────────────────────────────────

function BarChart({
  data, height = 120, color = TERM_CYAN, showLabels = true,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number; color?: string; showLabels?: boolean;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = 100 / data.length;
  const gap = barW * 0.25;

  return (
    <svg width="100%" viewBox={`0 0 100 ${height + (showLabels ? 16 : 0)}`} preserveAspectRatio="none" className="overflow-visible">
      {/* Grid lines */}
      {[25, 50, 75, 100].map(pct => (
        <line
          key={pct}
          x1="0" y1={height - (pct / 100) * height}
          x2="100" y2={height - (pct / 100) * height}
          stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"
        />
      ))}
      {/* Bars */}
      {data.map((d, i) => {
        const bh = (d.value / max) * height;
        const x = i * barW + gap / 2;
        const w = barW - gap;
        const c = d.color ?? color;
        return (
          <g key={i}>
            <rect
              x={x} y={height - bh} width={w} height={bh}
              fill={c} fillOpacity={0.85} rx="0.5"
              className="dash-bar"
              style={{ animationDelay: `${i * 0.05}s`, filter: `drop-shadow(0 0 2px ${c}60)` }}
            />
            {/* Top glow */}
            <rect x={x} y={height - bh} width={w} height="1.5" fill={c} rx="0.5" />
            {showLabels && (
              <text
                x={x + w / 2} y={height + 12}
                textAnchor="middle" fontSize="4.5" fill="#475569" fontWeight="700"
              >
                {d.label.slice(0, 6)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({
  values, color, height = 32, filled = false,
}: {
  values: number[]; color: string; height?: number; filled?: boolean;
}) {
  if (values.length < 2) return null;
  const W = 100;
  const path = sparkPath(values, W, height);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const lastY = height - ((values[values.length - 1] - min) / range) * height;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      {filled && (
        <path
          d={`${path} L${W},${height} L0,${height} Z`}
          fill={color} fillOpacity={0.08}
        />
      )}
      <path
        d={path}
        fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"
        style={{
          strokeDasharray: 1000, strokeDashoffset: 1000,
          animation: 'dashLineReveal 1s ease-out 0.2s both',
          filter: `drop-shadow(0 0 2px ${color})`,
        }}
      />
      {/* Last point dot */}
      <circle cx={W} cy={lastY} r="2" fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
    </svg>
  );
}

// ─── Radar chart ──────────────────────────────────────────────────────────────

function RadarChart({
  stats, color, size = 120,
}: {
  stats: { label: string; value: number; max?: number }[];
  color: string; size?: number;
}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 14;
  const n = stats.length;
  const angle = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;

  const rings = [0.25, 0.5, 0.75, 1.0];
  const pts = (fraction: number) => stats.map((_, i) => {
    const a = angle(i);
    return [cx + Math.cos(a) * r * fraction, cy + Math.sin(a) * r * fraction];
  });

  const dataFraction = stats.map(s => (s.value / (s.max ?? 100)));
  const dataPts = stats.map((s, i) => {
    const a = angle(i);
    const f = Math.min(dataFraction[i], 1);
    return [cx + Math.cos(a) * r * f, cy + Math.sin(a) * r * f];
  });

  const polyStr = (p: number[][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <svg width={size} height={size} className="overflow-visible">
      {/* Grid rings */}
      {rings.map((frac, ri) => (
        <polygon
          key={ri}
          points={polyStr(pts(frac))}
          fill="none"
          stroke={ri === rings.length - 1 ? color + '20' : 'rgba(255,255,255,0.04)'}
          strokeWidth={ri === rings.length - 1 ? 1 : 0.5}
        />
      ))}
      {/* Spokes */}
      {stats.map((_, i) => {
        const [ex, ey] = [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
        return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
      })}
      {/* Data polygon */}
      <polygon
        points={polyStr(dataPts)}
        fill={color} fillOpacity={0.12}
        stroke={color} strokeWidth="1.5"
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
      {/* Data points */}
      {dataPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      ))}
      {/* Labels */}
      {stats.map((s, i) => {
        const a = angle(i);
        const lx = cx + Math.cos(a) * (r + 10);
        const ly = cy + Math.sin(a) * (r + 10);
        return (
          <text key={i} x={lx} y={ly + 2} textAnchor="middle" fontSize="5.5" fill="#64748b" fontWeight="700">
            {s.label.slice(0, 5).toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Heat cell ────────────────────────────────────────────────────────────────

function HeatCell({ value, max = 100, label, sub, color }: { value: number; max?: number; label: string; sub?: string; color?: string }) {
  const intensity = value / max;
  const c = color ?? heatColor(value);
  return (
    <div
      className="rounded-lg p-2.5 text-center relative overflow-hidden border"
      style={{
        backgroundColor: c + Math.round(intensity * 35).toString(16).padStart(2, '0'),
        borderColor: c + '30',
        boxShadow: intensity > 0.6 ? `0 0 10px ${c}25` : 'none',
        animation: intensity > 0.7 ? 'dashHeatPulse 2s ease-in-out infinite' : 'none',
      }}
    >
      <div className="font-black text-lg leading-none" style={{ color: c }}>{Math.round(value)}</div>
      <div className="text-[9px] font-bold text-slate-500 mt-0.5 uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[9px] text-slate-700">{sub}</div>}
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({
  title, subtitle, icon: Icon, color = TERM_GREEN, children, className = '',
  badge,
}: {
  title: string; subtitle?: string; icon?: React.ElementType; color?: string;
  children: React.ReactNode; className?: string; badge?: string;
}) {
  return (
    <div
      className={`dash-panel relative ${className}`}
      style={{ border: `1px solid ${color}18`, background: 'linear-gradient(160deg, rgba(2,6,23,0.97), rgba(15,23,42,0.95))' }}
    >
      <div className="dash-scanline" />
      {/* Top accent */}
      <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b" style={{ borderColor: color + '10' }}>
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
          )}
          <div>
            <div className="text-xs font-black text-white uppercase tracking-widest">{title}</div>
            {subtitle && <div className="text-[9px] text-slate-600 uppercase tracking-wider mt-0.5">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wide" style={{ color, backgroundColor: color + '18', border: `1px solid ${color}30` }}>
              {badge}
            </span>
          )}
          {/* Blinking status dot */}
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, animation: 'dashBlink 2s ease-in-out infinite' }} />
        </div>
      </div>

      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Section tabs ─────────────────────────────────────────────────────────────

type DashSection = 'empire' | 'districts' | 'pipeline' | 'rivals' | 'reputation';

const SECTIONS: { key: DashSection; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'empire',      label: 'Empire',      icon: Crown,    color: TERM_AMBER  },
  { key: 'districts',   label: 'Districts',   icon: Map,      color: TERM_CYAN   },
  { key: 'pipeline',    label: 'Pipeline',    icon: Layers,   color: TERM_GREEN  },
  { key: 'rivals',      label: 'Rivals',      icon: Shield,   color: TERM_RED    },
  { key: 'reputation',  label: 'Reputation',  icon: Star,     color: TERM_ORANGE },
];

// ─── Empire section ───────────────────────────────────────────────────────────

function EmpireSection({ player, playerDistricts, districts, dynamicQuests }: {
  player: Player;
  playerDistricts: Map<string, PlayerDistrict>;
  districts: District[];
  dynamicQuests: DynamicQuest[];
}) {
  const totalHotels = Array.from(playerDistricts.values()).reduce((s, d) => s + d.hotels_invested, 0);
  const totalMarketShare = Array.from(playerDistricts.values()).reduce((s, d) => s + d.market_share, 0);
  const avgMarketShare = playerDistricts.size > 0 ? (totalMarketShare / playerDistricts.size) * 100 : 0;
  const completedQuests = dynamicQuests.filter(q => q.status === 'completed').length;
  const totalXpFromQuests = dynamicQuests.filter(q => q.status === 'completed').reduce((s, q) => s + q.xp_reward, 0);

  // Simulated empire growth curve (approximated from current data)
  const growthBase = player.total_xp / 1000;
  const growthCurve = Array.from({ length: 12 }, (_, i) => {
    const factor = Math.pow(1 + growthBase * 0.1, i);
    return Math.min(player.empire_value * (0.3 + (i / 11) * 0.7) * (0.8 + Math.random() * 0.4) * (i === 11 ? 1 : 0.85), player.empire_value);
  });
  growthCurve[11] = player.empire_value;

  // Skill radar data
  const skillStats = [
    { label: 'Negotiation', value: player.negotiation, max: 200 },
    { label: 'Networking',  value: player.networking,  max: 200 },
    { label: 'Focus',       value: player.focus,       max: 200 },
    { label: 'Discipline',  value: player.discipline,  max: 200 },
    { label: 'Leadership',  value: player.leadership,  max: 200 },
    { label: 'Reputation',  value: player.reputation,  max: 200 },
  ];

  // Income breakdown
  const baseIncome = playerDistricts.size * 15_000;
  const hotelIncome = totalHotels * 5_000;

  // Territory level distribution
  const tierCounts = [0, 1, 2, 3, 4, 5].map(tier => ({
    label: `T${tier}`,
    value: Array.from(playerDistricts.values()).filter(pd => pd.territory_level === tier).length,
    color: ['#475569', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'][tier],
  }));

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Empire Value" value={`€${(player.empire_value / 1e6).toFixed(1)}M`} sub="advisory portfolio" color={TERM_AMBER} icon={Crown} glow />
        <KPICard label="Monthly Income" value={`€${(player.monthly_income / 1e3).toFixed(0)}k`} sub="recurring advisory" color={TERM_GREEN} icon={DollarSign} />
        <KPICard label="Cash Position" value={`€${(player.money / 1e3).toFixed(0)}k`} sub="available capital" color={TERM_CYAN} icon={Zap} />
        <KPICard label="Total XP" value={player.total_xp.toLocaleString()} sub={`Lv ${player.level} · ${completedQuests} quests`} color={TERM_BLUE} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Empire growth chart */}
        <Panel title="Empire Growth" subtitle="Advisory Portfolio Value" icon={TrendingUp} color={TERM_AMBER}>
          <div className="h-28 relative">
            <Sparkline values={growthCurve} color={TERM_AMBER} height={80} filled />
            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-slate-700 font-mono">
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Now'].map(m => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { l: 'Districts', v: playerDistricts.size },
              { l: 'Hotels', v: totalHotels },
              { l: 'Avg Share', v: `${avgMarketShare.toFixed(0)}%` },
            ].map(({ l, v }) => (
              <div key={l} className="rounded-lg p-2" style={{ backgroundColor: TERM_AMBER + '08', border: `1px solid ${TERM_AMBER}18` }}>
                <div className="dash-label">{l}</div>
                <div className="font-black text-sm" style={{ color: TERM_AMBER }}>{v}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Skill radar */}
        <Panel title="Skill Profile" subtitle="Advisor Competency Radar" icon={Activity} color={TERM_CYAN}>
          <div className="flex items-center gap-4">
            <RadarChart stats={skillStats} color={TERM_CYAN} size={140} />
            <div className="flex-1 space-y-1.5">
              {skillStats.map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-20 flex-shrink-0">{s.label}</span>
                  <div className="flex-1 h-1 bg-slate-800 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${Math.min((s.value / (s.max ?? 200)) * 100, 100)}%`, backgroundColor: TERM_CYAN, boxShadow: `0 0 4px ${TERM_CYAN}50` }}
                    />
                  </div>
                  <span className="text-[10px] font-black font-mono w-6 text-right" style={{ color: TERM_CYAN }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Income breakdown */}
        <Panel title="Income Sources" subtitle="Monthly Revenue Breakdown" icon={DollarSign} color={TERM_GREEN}>
          <div className="space-y-2.5">
            {[
              { label: 'District Advisory', value: baseIncome, max: player.monthly_income || 1, color: TERM_GREEN },
              { label: 'Hotel Investments', value: hotelIncome, max: player.monthly_income || 1, color: TERM_CYAN },
            ].map((row, i) => (
              <HBar key={i} label={row.label} value={(row.value / (player.monthly_income || 1)) * 100} max={100} color={row.color} sub={`€${(row.value / 1000).toFixed(0)}k`} index={i} />
            ))}
            <div className="pt-2 border-t mt-2" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-500">Total monthly</span>
                <span className="font-black" style={{ color: TERM_GREEN }}>€{player.monthly_income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs font-mono mt-0.5">
                <span className="text-slate-500">Annual run-rate</span>
                <span className="font-black" style={{ color: TERM_AMBER }}>€{(player.monthly_income * 12).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* Territory tier chart */}
        <Panel title="Territory Tiers" subtitle="Control Level Distribution" icon={Building2} color={TERM_BLUE}>
          <div className="h-24">
            <BarChart data={tierCounts} color={TERM_BLUE} />
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {tierCounts.map(t => t.value > 0 && (
              <div key={t.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.color }} />
                <span className="text-[10px] text-slate-500">{t.label}: <span className="font-black" style={{ color: t.color }}>{t.value}</span></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Districts section ────────────────────────────────────────────────────────

function DistrictsSection({ districts, playerDistricts, districtMarket }: {
  districts: District[];
  playerDistricts: Map<string, PlayerDistrict>;
  districtMarket: Map<string, DistrictMarketData>;
}) {
  const [selectedMetric, setSelectedMetric] = useState<keyof DistrictMarketData>('market_temp');

  const METRICS: { key: keyof DistrictMarketData; label: string; color: string; invert?: boolean }[] = [
    { key: 'market_temp',       label: 'Market Temp',     color: TERM_AMBER  },
    { key: 'opportunities',     label: 'Opportunities',   color: TERM_GREEN  },
    { key: 'competition',       label: 'Competition',     color: TERM_RED,  invert: true },
    { key: 'investor_activity', label: 'Investor Activity', color: TERM_CYAN },
    { key: 'tourism_growth',    label: 'Tourism',         color: TERM_BLUE  },
    { key: 'luxury_demand',     label: 'Luxury Demand',   color: TERM_ORANGE },
  ];

  const metaMeta = METRICS.find(m => m.key === selectedMetric)!;

  // All districts with market data
  const allDistricts = districts.map(d => ({
    district: d,
    pd: playerDistricts.get(d.id),
    market: districtMarket.get(d.id),
  })).sort((a, b) => {
    const va = a.market ? (a.market[selectedMetric] as number) : 0;
    const vb = b.market ? (b.market[selectedMetric] as number) : 0;
    return vb - va;
  });

  // Active districts detail
  const activeDistricts = allDistricts.filter(d => d.pd?.is_unlocked);

  return (
    <div className="space-y-4">
      {/* Metric selector */}
      <div className="flex gap-2 flex-wrap">
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setSelectedMetric(m.key)}
            className="text-[10px] font-black uppercase tracking-wide px-3 py-1.5 rounded-lg border transition-all"
            style={{
              color: selectedMetric === m.key ? m.color : '#475569',
              borderColor: selectedMetric === m.key ? m.color + '50' : 'rgba(255,255,255,0.06)',
              backgroundColor: selectedMetric === m.key ? m.color + '12' : 'transparent',
              boxShadow: selectedMetric === m.key ? `0 0 10px ${m.color}20` : 'none',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Heatmap grid */}
        <Panel title="District Heatmap" subtitle={`Ranked by ${metaMeta.label}`} icon={Map} color={metaMeta.color}>
          <div className="grid grid-cols-3 gap-2">
            {allDistricts.slice(0, 12).map(({ district, pd, market }) => {
              const val = market ? (market[selectedMetric] as number) : 0;
              const isOwned = !!pd?.is_unlocked;
              const c = metaMeta.invert ? heatColor(100 - val) : heatColor(val);
              return (
                <div
                  key={district.id}
                  className="rounded-lg p-2 relative border transition-all"
                  style={{
                    backgroundColor: isOwned ? c + '18' : c + '08',
                    borderColor: isOwned ? c + '50' : c + '15',
                    boxShadow: isOwned ? `0 0 8px ${c}20` : 'none',
                  }}
                >
                  {isOwned && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: c }} />
                  )}
                  <div className="text-[9px] font-bold text-white truncate">{district.name}</div>
                  <div className="font-black text-base leading-none mt-0.5" style={{ color: c }}>
                    {market ? Math.round(val) : '—'}
                  </div>
                  <div className="text-[9px] text-slate-700">{district.region}</div>
                  {isOwned && pd && (
                    <div className="text-[9px] font-bold mt-0.5" style={{ color: TERM_GREEN }}>
                      T{pd.territory_level} · {Math.round(pd.market_share * 100)}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Bar ranking */}
        <Panel title="Market Ranking" subtitle="All Districts · Current Metric" icon={BarChart2} color={metaMeta.color}>
          <div className="space-y-2">
            {allDistricts.slice(0, 8).map(({ district, pd, market }, i) => {
              const val = market ? (market[selectedMetric] as number) : 0;
              const c = pd?.is_unlocked ? metaMeta.color : TERM_SLATE;
              return (
                <div key={district.id} className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-700 w-3">{i + 1}</span>
                  <span className="text-xs font-bold text-white w-20 flex-shrink-0 truncate">{district.name}</span>
                  <div className="flex-1 h-3 bg-slate-900 rounded overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-1000"
                      style={{ width: `${val}%`, backgroundColor: c, boxShadow: `0 0 4px ${c}50` }}
                    />
                  </div>
                  <span className="text-[10px] font-black font-mono w-7 text-right" style={{ color: c }}>{Math.round(val)}</span>
                  {pd?.is_unlocked && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TERM_GREEN }} />}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Active district deep dive */}
      {activeDistricts.length > 0 && (
        <Panel title="Active Territory Profiles" subtitle="Your Controlled Districts" icon={Target} color={TERM_CYAN}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeDistricts.map(({ district, pd, market }) => {
              const regionColor = REGION_COLORS[district.region] ?? TERM_AMBER;
              const t = market ? trendIcon(market.trend_direction) : { Icon: Minus, color: TERM_SLATE };
              const TrendIcon = t.Icon;
              return (
                <div
                  key={district.id}
                  className="rounded-xl border p-3 relative overflow-hidden"
                  style={{ borderColor: regionColor + '30', background: `linear-gradient(135deg, ${regionColor}08, rgba(2,6,23,0.95))` }}
                >
                  <div className="h-px mb-3" style={{ background: `linear-gradient(90deg, transparent, ${regionColor}60, transparent)` }} />
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-black text-white text-sm">{district.name}</div>
                      <div className="text-[10px] text-slate-600">{district.region}</div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <TrendIcon className="w-3 h-3" style={{ color: t.color }} />
                      <span style={{ color: t.color }}>{market?.trend_direction ?? '—'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {[
                      { l: 'Territory', v: `T${pd!.territory_level}` },
                      { l: 'Share',     v: `${Math.round(pd!.market_share * 100)}%` },
                      { l: 'Hotels',   v: `${pd!.hotels_invested}` },
                    ].map(({ l, v }) => (
                      <div key={l} className="rounded p-1.5 text-center" style={{ backgroundColor: regionColor + '08', border: `1px solid ${regionColor}15` }}>
                        <div className="text-[9px] text-slate-600">{l}</div>
                        <div className="font-black text-xs" style={{ color: regionColor }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {market && (
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { l: 'Temp',     v: market.market_temp },
                        { l: 'Opps',     v: market.opportunities },
                        { l: 'Investors', v: market.investor_activity },
                      ].map(({ l, v }) => (
                        <HeatCell key={l} value={v} label={l} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ─── Pipeline section ─────────────────────────────────────────────────────────

function PipelineSection({ dynamicQuests, player }: { dynamicQuests: DynamicQuest[]; player: Player }) {
  const active    = dynamicQuests.filter(q => q.status === 'active');
  const completed = dynamicQuests.filter(q => q.status === 'completed');
  const expired   = dynamicQuests.filter(q => q.status === 'expired');

  const totalXP    = completed.reduce((s, q) => s + q.xp_reward, 0);
  const totalMoney = completed.reduce((s, q) => s + (q.money_reward ?? 0), 0);
  const totalRep   = completed.reduce((s, q) => s + q.reputation_reward, 0);

  // Category breakdown
  const categories: Record<string, number> = {};
  completed.forEach(q => { categories[q.category] = (categories[q.category] ?? 0) + 1; });
  const catData = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({
      label,
      value,
      color: [TERM_AMBER, TERM_CYAN, TERM_GREEN, TERM_BLUE, TERM_ORANGE, TERM_RED][i],
    }));

  // Difficulty distribution
  const diffDist = [1, 2, 3, 4, 5].map(d => ({
    label: `D${d}`, color: heatColor(d * 20),
    value: completed.filter(q => q.difficulty === d).length,
  }));

  // Type breakdown
  const typeData = ['daily', 'weekly', 'main', 'legendary'].map((t, i) => ({
    type: t,
    active: active.filter(q => q.quest_type === t).length,
    done: completed.filter(q => q.quest_type === t).length,
    color: [TERM_CYAN, TERM_BLUE, TERM_AMBER, TERM_RED][i],
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Active Quests"  value={`${active.length}`}    sub="in pipeline"         color={TERM_CYAN}   icon={Layers} />
        <KPICard label="Completed"      value={`${completed.length}`} sub="total closed"        color={TERM_GREEN}  icon={Target} />
        <KPICard label="XP from Quests" value={totalXP.toLocaleString()} sub="total earned"     color={TERM_AMBER}  icon={Zap} />
        <KPICard label="Quest Revenue"  value={`€${(totalMoney / 1000).toFixed(0)}k`} sub="earned"  color={TERM_ORANGE} icon={DollarSign} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quest type distribution */}
        <Panel title="Quest Pipeline" subtitle="By Type · Active & Completed" icon={Layers} color={TERM_CYAN}>
          <div className="space-y-3">
            {typeData.map(t => (
              <div key={t.type} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-black uppercase tracking-widest" style={{ color: t.color }}>{t.type}</span>
                  <div className="flex gap-3">
                    <span className="text-slate-500">{t.active} active</span>
                    <span className="font-black" style={{ color: t.color }}>{t.done} done</span>
                  </div>
                </div>
                <div className="flex gap-1 h-3">
                  <div className="flex-1 bg-slate-900 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${Math.min((t.active / Math.max(active.length, 1)) * 100, 100)}%`,
                        backgroundColor: t.color + '60',
                      }}
                    />
                  </div>
                  <div className="flex-1 bg-slate-900 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${Math.min((t.done / Math.max(completed.length, 1)) * 100, 100)}%`,
                        backgroundColor: t.color,
                        boxShadow: `0 0 4px ${t.color}50`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Category bar chart */}
        <Panel title="Category Breakdown" subtitle="Completed Quests" icon={BarChart2} color={TERM_AMBER}>
          {catData.length > 0 ? (
            <>
              <div className="h-24 mb-2">
                <BarChart data={catData} />
              </div>
              <div className="flex flex-wrap gap-2">
                {catData.map(d => (
                  <div key={d.label} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] text-slate-500">{d.label}: <span className="font-bold" style={{ color: d.color }}>{d.value}</span></span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-slate-600 text-xs">No completed quests yet</div>
          )}
        </Panel>

        {/* Active quest details */}
        <Panel title="Active Pipeline" subtitle="Current Quest Roster" icon={Activity} color={TERM_GREEN} className="md:col-span-2">
          {active.length === 0 ? (
            <div className="text-center py-6 text-slate-600 text-xs">No active quests in pipeline</div>
          ) : (
            <div className="space-y-2">
              {active.slice(0, 8).map(q => {
                const typeColor = { daily: TERM_CYAN, weekly: TERM_BLUE, main: TERM_AMBER, legendary: TERM_RED }[q.quest_type] ?? TERM_SLATE;
                const progressPct = q.progress_target > 0 ? Math.min((q.progress / q.progress_target) * 100, 100) : 0;
                return (
                  <div
                    key={q.id}
                    className="flex items-center gap-3 rounded-lg border p-2.5"
                    style={{ borderColor: typeColor + '20', backgroundColor: typeColor + '06' }}
                  >
                    <div
                      className="text-[9px] font-black uppercase tracking-wide px-1.5 py-1 rounded flex-shrink-0"
                      style={{ color: typeColor, backgroundColor: typeColor + '18' }}
                    >
                      {q.quest_type.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{q.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-slate-900 rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${progressPct}%`, backgroundColor: typeColor }} />
                        </div>
                        <span className="text-[9px] font-mono text-slate-600">{q.progress}/{q.progress_target}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] font-black" style={{ color: TERM_AMBER }}>+{q.xp_reward} XP</div>
                      {q.money_reward > 0 && <div className="text-[9px]" style={{ color: TERM_GREEN }}>€{q.money_reward.toLocaleString()}</div>}
                    </div>
                    <div
                      className="text-[9px] font-black px-1.5 py-1 rounded flex-shrink-0"
                      style={{ color: heatColor(q.difficulty * 20), backgroundColor: heatColor(q.difficulty * 20) + '18' }}
                    >
                      D{q.difficulty}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ─── Rivals section ───────────────────────────────────────────────────────────

function RivalsSection({ rivals, rivalPresence, rivalEvents, districts, playerDistricts }: {
  rivals: RivalFirm[];
  rivalPresence: Map<string, RivalDistrictPresence[]>;
  rivalEvents: RivalEvent[];
  districts: District[];
  playerDistricts: Map<string, PlayerDistrict>;
}) {
  const recentEvents = rivalEvents.slice(0, 20);

  // Threat score per rival
  const rivalScores = rivals.filter(r => r.is_active).map(r => ({
    rival: r,
    threatScore: r.aggression * 10 + r.reputation_score * 0.3,
    districtCount: Array.from(rivalPresence.values()).filter(arr => arr.some(p => p.rival_id === r.id)).length,
    totalShare: Array.from(rivalPresence.values())
      .flat()
      .filter(p => p.rival_id === r.id)
      .reduce((s, p) => s + p.market_share, 0),
  })).sort((a, b) => b.threatScore - a.threatScore);

  // Event type breakdown
  const eventTypes: Record<string, number> = {};
  recentEvents.forEach(e => { eventTypes[e.event_type] = (eventTypes[e.event_type] ?? 0) + 1; });
  const eventTypeData = Object.entries(eventTypes).map(([label, value], i) => ({
    label: label.replace('_', ' '),
    value,
    color: [TERM_RED, TERM_ORANGE, TERM_AMBER, TERM_CYAN, TERM_BLUE, TERM_GREEN][i],
  }));

  // Market share conflict zones: districts where both player and rivals are present
  const conflictZones = districts
    .map(d => {
      const pd = playerDistricts.get(d.id);
      const rivals = rivalPresence.get(d.id) ?? [];
      if (!pd?.is_unlocked || rivals.length === 0) return null;
      const totalRivalShare = rivals.reduce((s, r) => s + r.market_share, 0);
      return { district: d, playerShare: pd.market_share, rivalShare: totalRivalShare, rivals: rivals.length };
    })
    .filter(Boolean) as { district: District; playerShare: number; rivalShare: number; rivals: number }[];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Active Rivals"    value={`${rivals.filter(r => r.is_active).length}`} sub="competing firms"   color={TERM_RED}    icon={Shield} />
        <KPICard label="Conflict Events"  value={`${recentEvents.length}`}                    sub="recent activity"  color={TERM_ORANGE} icon={AlertTriangle} />
        <KPICard label="Conflict Zones"   value={`${conflictZones.length}`}                   sub="contested districts" color={TERM_AMBER} icon={Map} />
        <KPICard label="Max Aggression"   value={rivals.length > 0 ? `${Math.max(...rivals.map(r => r.aggression))}/10` : '—'} sub="highest threat" color={TERM_RED} icon={Flame} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Threat meter */}
        <Panel title="Rival Threat Index" subtitle="Sorted by Danger Score" icon={Shield} color={TERM_RED}>
          <div className="space-y-2.5">
            {rivalScores.slice(0, 5).map(({ rival, threatScore, districtCount, totalShare }) => {
              const c = rival.accent_color ?? TERM_RED;
              return (
                <div key={rival.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded text-[9px] font-black flex items-center justify-center" style={{ backgroundColor: c + '25', color: c }}>
                        {rival.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-xs font-bold text-white">{rival.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-600">{districtCount}d · {(totalShare * 100).toFixed(0)}%</span>
                      <span className="font-black" style={{ color: heatColor(threatScore) }}>{threatScore.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-900 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${Math.min(threatScore, 100)}%`,
                        background: `linear-gradient(90deg, ${c}80, ${c})`,
                        boxShadow: `0 0 6px ${c}40`,
                      }}
                    />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[9px] text-slate-700">Aggression: <span style={{ color: c }}>{rival.aggression}/10</span></span>
                    <span className="text-[9px] text-slate-700">Rep: <span style={{ color: c }}>{rival.reputation_score}</span></span>
                    <span className="text-[9px] italic text-slate-700">{rival.specialisation}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Conflict zones */}
        <Panel title="Contested Territories" subtitle="Player vs. Rival Presence" icon={Map} color={TERM_ORANGE}>
          {conflictZones.length === 0 ? (
            <div className="text-center py-6 text-slate-600 text-xs">No contested districts yet</div>
          ) : (
            <div className="space-y-2.5">
              {conflictZones.slice(0, 5).map(z => {
                const total = z.playerShare + z.rivalShare;
                const playerPct = total > 0 ? (z.playerShare / total) * 100 : 50;
                const rivalPct = 100 - playerPct;
                return (
                  <div key={z.district.id}>
                    <div className="flex justify-between mb-1 text-[10px]">
                      <span className="font-bold text-white">{z.district.name}</span>
                      <span className="text-slate-600">{z.rivals} rival{z.rivals > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex h-3 rounded overflow-hidden gap-px">
                      <div
                        className="rounded-l"
                        style={{ width: `${playerPct}%`, backgroundColor: TERM_GREEN, boxShadow: `0 0 4px ${TERM_GREEN}50` }}
                        title={`You: ${(z.playerShare * 100).toFixed(0)}%`}
                      />
                      <div
                        className="rounded-r"
                        style={{ width: `${rivalPct}%`, backgroundColor: TERM_RED, boxShadow: `0 0 4px ${TERM_RED}50` }}
                        title={`Rivals: ${(z.rivalShare * 100).toFixed(0)}%`}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] mt-0.5 text-slate-600">
                      <span style={{ color: TERM_GREEN }}>You {(z.playerShare * 100).toFixed(0)}%</span>
                      <span style={{ color: TERM_RED }}>Rivals {(z.rivalShare * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Event type breakdown */}
        <Panel title="Conflict Activity" subtitle="Event Types · Recent Log" icon={Activity} color={TERM_AMBER}>
          {eventTypeData.length > 0 ? (
            <div className="space-y-2">
              {eventTypeData.map((e, i) => (
                <HBar key={i} label={e.label} value={e.value} max={Math.max(...eventTypeData.map(x => x.value), 1)} color={e.color} index={i} showValue={false} />
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-600 text-xs">No events recorded yet</div>
          )}
        </Panel>

        {/* Recent event log */}
        <Panel title="Intel Log" subtitle="Recent Rival Activity" icon={Eye} color={TERM_CYAN}>
          {recentEvents.length === 0 ? (
            <div className="text-center py-4 text-slate-600 text-xs">No rival events recorded</div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${TERM_CYAN}30 transparent` }}>
              {recentEvents.slice(0, 10).map(evt => {
                const rival = rivals.find(r => r.id === evt.rival_id);
                const c = rival?.accent_color ?? TERM_SLATE;
                const sevColor = { alert: TERM_RED, warning: TERM_ORANGE, info: TERM_CYAN, opportunity: TERM_GREEN }[evt.severity] ?? TERM_SLATE;
                return (
                  <div key={evt.id} className="flex items-start gap-2 rounded-lg p-2 border" style={{ borderColor: sevColor + '18', backgroundColor: sevColor + '06' }}>
                    <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: sevColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-white truncate">{evt.title}</div>
                      <div className="text-[9px] text-slate-600 flex items-center gap-1 mt-0.5">
                        <span style={{ color: c }}>{rival?.name ?? 'Unknown'}</span>
                        {evt.impact_money !== 0 && (
                          <span style={{ color: evt.impact_money < 0 ? TERM_RED : TERM_GREEN }}>
                            {evt.impact_money > 0 ? '+' : ''}€{Math.abs(evt.impact_money).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ─── Reputation analytics section ────────────────────────────────────────────

function ReputationSection({ reputation, player }: { reputation: PlayerReputation | null; player: Player }) {
  if (!reputation) return (
    <div className="text-center py-8 text-slate-600 text-sm">No reputation data available</div>
  );

  const TRACKS = ['investor', 'owner', 'market', 'operator', 'broker', 'luxury'] as const;

  const trackData = TRACKS.map(t => {
    const meta = REP_TRACK_META[t];
    const cur   = reputation[`${t}_rep`   as keyof typeof reputation] as number;
    const total = reputation[`${t}_rep_total` as keyof typeof reputation] as number;
    const rank  = getRepRank(cur);
    return { track: t, meta, cur, total, rank };
  });

  // Spider chart data
  const radarStats = trackData.map(d => ({ label: d.track, value: d.cur, max: 700 }));

  // Rep velocity: % of total that's been earned per track (proxy for "growth rate")
  const maxTotal = Math.max(...trackData.map(d => d.total), 1);

  const totalRepScore = trackData.reduce((s, d) => s + d.cur, 0);
  const topTrack = trackData.reduce((best, d) => d.cur > best.cur ? d : best, trackData[0]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Total Rep Score" value={totalRepScore.toLocaleString()} sub="all 6 tracks" color={TERM_AMBER} icon={Star} glow />
        <KPICard label="Leading Track"   value={topTrack.rank.label} sub={topTrack.meta.label} color={topTrack.meta.color} icon={Crown} />
        <KPICard label="Player Rank"     value={getRepRank(Math.floor(totalRepScore / 6)).label} sub="overall market standing" color={TERM_CYAN} icon={Globe} />
        <KPICard label="Lifetime Rep"    value={trackData.reduce((s, d) => s + d.total, 0).toLocaleString()} sub="cumulative total" color={TERM_GREEN} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Radar */}
        <Panel title="Reputation Radar" subtitle="All 6 Tracks · Comparative View" icon={Activity} color={TERM_ORANGE}>
          <div className="flex items-center gap-4">
            <RadarChart stats={radarStats} color={TERM_ORANGE} size={160} />
            <div className="flex-1 space-y-2">
              {trackData.map(d => (
                <div key={d.track} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: d.meta.color }} />
                  <span className="text-[10px] text-slate-500 flex-1 truncate">{d.meta.label}</span>
                  <span className="text-[10px] font-black" style={{ color: d.meta.color }}>{d.cur}</span>
                  <span className="text-[9px] rounded px-1" style={{ color: d.rank.color, backgroundColor: d.rank.color + '18' }}>{d.rank.badge}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Track bars */}
        <Panel title="Track Standings" subtitle="Current Score & Rank" icon={BarChart2} color={TERM_AMBER}>
          <div className="space-y-3">
            {trackData.map(d => {
              const nextRank = d.rank.rank < 7 ? d.cur : d.cur;
              return (
                <div key={d.track}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{d.meta.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black" style={{ color: d.meta.color }}>{d.cur}</span>
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded border"
                        style={{ color: d.rank.color, borderColor: d.rank.color + '40', backgroundColor: d.rank.color + '12' }}
                      >
                        {d.rank.badge}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-900 rounded overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-1000 relative overflow-hidden"
                      style={{ width: `${Math.min((d.cur / 700) * 100, 100)}%`, backgroundColor: d.meta.color, boxShadow: `0 0 4px ${d.meta.color}50` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" style={{ backgroundSize: '200% 100%', animation: 'dashTickerSlide 3s linear infinite' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Rep velocity / total vs. current */}
        <Panel title="Reputation Velocity" subtitle="Lifetime Earnings by Track" icon={TrendingUp} color={TERM_GREEN}>
          <div className="space-y-2.5">
            {trackData.sort((a, b) => b.total - a.total).map((d, i) => (
              <div key={d.track} className="flex items-center gap-3">
                <span className="text-[10px] font-black" style={{ color: d.meta.color }}>{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-slate-400">{d.meta.label}</span>
                    <span className="text-[10px] font-mono" style={{ color: d.meta.color }}>{d.total}</span>
                  </div>
                  <div className="h-1.5 bg-slate-900 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(d.total / maxTotal) * 100}%`, backgroundColor: d.meta.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Opportunity unlocks status */}
        <Panel title="Special Unlock Status" subtitle="Private Opps · Districts · Investors" icon={Globe} color={TERM_CYAN}>
          <div className="space-y-2">
            {[
              { label: 'Private Opportunities', threshold: 75,  tracks: ['investor', 'owner', 'broker', 'luxury'] as const, color: TERM_ORANGE },
              { label: 'Hidden Districts',       threshold: 450, tracks: ['investor', 'owner', 'market', 'operator', 'broker', 'luxury'] as const, color: '#a78bfa' },
              { label: 'Legendary Investors',    threshold: 150, tracks: ['investor', 'broker', 'luxury'] as const, color: TERM_RED },
              { label: 'Off-Market Portfolios',  threshold: 150, tracks: ['owner', 'operator', 'broker'] as const, color: TERM_GREEN },
            ].map(item => {
              const unlocked = item.tracks.filter(t => (reputation[`${t}_rep` as keyof typeof reputation] as number) >= item.threshold).length;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-slate-400">{item.label}</span>
                      <span className="text-[10px] font-black" style={{ color: item.color }}>{unlocked}/{item.tracks.length}</span>
                    </div>
                    <div className="flex gap-1">
                      {item.tracks.map(t => {
                        const score = (reputation[`${t}_rep` as keyof typeof reputation] as number);
                        const reached = score >= item.threshold;
                        return (
                          <div
                            key={t}
                            className="flex-1 h-2 rounded"
                            style={{ backgroundColor: reached ? item.color : '#1e293b', boxShadow: reached ? `0 0 4px ${item.color}50` : 'none' }}
                            title={`${REP_TRACK_META[t].label}: ${score}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function AnalyticsDashboard({
  player, districts, playerDistricts, districtMarket,
  dynamicQuests, reputation, rivals, rivalPresence, rivalEvents,
}: AnalyticsDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashSection>('empire');

  if (!player) return null;

  const totalHotels  = Array.from(playerDistricts.values()).reduce((s, d) => s + d.hotels_invested, 0);
  const totalShare   = Array.from(playerDistricts.values()).reduce((s, d) => s + d.market_share, 0);
  const activeQuests = dynamicQuests.filter(q => q.status === 'active').length;
  const unreadRivals = rivalEvents.filter(e => !e.is_read).length;

  const tickerItems = [
    { label: 'Empire',  value: `€${(player.empire_value / 1e6).toFixed(1)}M`, color: TERM_AMBER, up: true },
    { label: 'Income',  value: `€${(player.monthly_income / 1e3).toFixed(0)}k/mo`, color: TERM_GREEN, up: true },
    { label: 'Level',   value: `LV${player.level}`, color: TERM_CYAN },
    { label: 'Hotels',  value: `${totalHotels}`, color: TERM_BLUE },
    { label: 'Share',   value: `${(totalShare * 100).toFixed(1)}%`, color: TERM_ORANGE },
    { label: 'Quests',  value: `${activeQuests} active`, color: TERM_GREEN },
    { label: 'Rivals',  value: `${unreadRivals} events`, color: TERM_RED, up: false },
    { label: 'Cash',    value: `€${(player.money / 1e3).toFixed(0)}k`, color: TERM_AMBER },
  ];

  return (
    <div className="space-y-4">
      <style>{DASH_CSS}</style>

      {/* Terminal header */}
      <div
        className="rounded-xl relative overflow-hidden"
        style={{ border: '1px solid rgba(0,255,136,0.12)', background: 'linear-gradient(160deg, rgba(0,255,136,0.03), rgba(2,6,23,0.98))' }}
      >
        <div className="dash-scanline" />
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[TERM_RED, TERM_AMBER, TERM_GREEN].map((c, i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c, opacity: 0.7 }} />
              ))}
            </div>
            <div>
              <div className="text-xs font-black text-white tracking-widest uppercase">Swallow Empire · Analytics Terminal</div>
              <div className="text-[9px] font-mono" style={{ color: TERM_GREEN + '80' }}>LIVE DATA · AUTO-REFRESH · v2.4.1</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono">
            <span style={{ color: TERM_GREEN, animation: 'dashBlink 1.5s ease-in-out infinite' }}>● LIVE</span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-600">LV{player.level} ADVISOR</span>
          </div>
        </div>
        <TickerStrip items={tickerItems} />
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex-shrink-0 transition-all border"
            style={{
              color: activeSection === s.key ? s.color : '#475569',
              borderColor: activeSection === s.key ? s.color + '40' : 'rgba(255,255,255,0.06)',
              backgroundColor: activeSection === s.key ? s.color + '10' : 'transparent',
              boxShadow: activeSection === s.key ? `0 0 12px ${s.color}20` : 'none',
            }}
          >
            <s.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      <div key={activeSection} style={{ animation: 'dashBarGrow 0.3s ease-out' }}>
        {activeSection === 'empire' && (
          <EmpireSection player={player} playerDistricts={playerDistricts} districts={districts} dynamicQuests={dynamicQuests} />
        )}
        {activeSection === 'districts' && (
          <DistrictsSection districts={districts} playerDistricts={playerDistricts} districtMarket={districtMarket} />
        )}
        {activeSection === 'pipeline' && (
          <PipelineSection dynamicQuests={dynamicQuests} player={player} />
        )}
        {activeSection === 'rivals' && (
          <RivalsSection rivals={rivals} rivalPresence={rivalPresence} rivalEvents={rivalEvents} districts={districts} playerDistricts={playerDistricts} />
        )}
        {activeSection === 'reputation' && (
          <ReputationSection reputation={reputation} player={player} />
        )}
      </div>
    </div>
  );
}
