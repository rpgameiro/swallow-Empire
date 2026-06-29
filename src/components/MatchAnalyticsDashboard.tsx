import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Crown, Flame, Star, TrendingUp, DollarSign, Users,
  MapPin, Activity, BarChart2, RefreshCw,
  Target, Shield,
} from 'lucide-react';
import { Lead, LeadMatch, MatchTier, MATCH_TIER_META, District } from '../types/game';
import { getLeads, getLeadMatches } from '../services/matchingEngine';

// ─── CSS ──────────────────────────────────────────────────────────────────────

const MAD_CSS = `
  @keyframes madReveal {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes madScan {
    from { top: -2px; opacity: 0.5; }
    to   { top: 100%; opacity: 0; }
  }
  @keyframes madBarGrow {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  @keyframes madCountUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes madRingFill {
    from { stroke-dashoffset: 283; }
    to   { stroke-dashoffset: var(--target-offset); }
  }
  @keyframes madPulse {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.45; }
  }
  @keyframes madFlicker {
    0%,88%,100% { opacity: 1; }
    90%          { opacity: 0.35; }
    95%          { opacity: 0.8; }
  }
  @keyframes madTicker {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes madGlow {
    0%,100% { box-shadow: 0 0 16px var(--card-glow); }
    50%      { box-shadow: 0 0 32px var(--card-glow), 0 0 48px var(--card-glow-far); }
  }
  @keyframes madLineReveal {
    from { stroke-dashoffset: 1000; }
    to   { stroke-dashoffset: 0; }
  }
  .mad-card  { animation: madReveal 0.42s cubic-bezier(0.22,1,0.36,1) both; }
  .mad-scan  {
    position: absolute; left: 0; right: 0; height: 1.5px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent);
    animation: madScan 4s linear infinite; pointer-events: none;
  }
  .mad-bar   { transform-origin: left; animation: madBarGrow 0.7s cubic-bezier(0.22,1,0.36,1) both; }
  .mad-count { animation: madCountUp 0.4s ease-out both; }
  .mad-flicker { animation: madFlicker 9s ease-in-out infinite; }
  .mad-glow  { animation: madGlow 3.5s ease-in-out infinite; }
  .mad-line  {
    stroke-dasharray: 1000; stroke-dashoffset: 1000;
    animation: madLineReveal 1.2s ease-out 0.3s both;
  }
`;

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  legendary: '#f59e0b',
  strong:    '#10b981',
  warm:      '#3b82f6',
  low:       '#475569',
  total:     '#06b6d4',
  value:     '#f97316',
  score:     '#a78bfa',
  bg:        'rgba(2,6,23,0.98)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtM(n: number): string {
  if (!n) return '€0';
  if (n >= 1_000_000_000) return `€${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `€${(n / 1_000).toFixed(0)}k`;
  return `€${n}`;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color, w = 80, h = 28 }: { values: number[]; color: string; w?: number; h?: number }) {
  if (values.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rng = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / rng) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const path = 'M' + pts.join(' L');
  const lastPt = pts[pts.length - 1].split(',');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path
        d={`${path} L${w},${h} L0,${h} Z`}
        fill={color} fillOpacity={0.08}
      />
      <path
        className="mad-line"
        d={path}
        fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 2px ${color})` }}
      />
      <circle
        cx={lastPt[0]} cy={lastPt[1]} r="2.5"
        fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ target, prefix = '', suffix = '', color, decimals = 0 }: {
  target: number; prefix?: string; suffix?: string; color: string; decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const DURATION = 900;

  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(eased * target);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();
  return (
    <span className="mad-count font-black" style={{ color }}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

// ─── Big hero metric ──────────────────────────────────────────────────────────

function HeroMetric({ value, label, sub, color, size = 'xl' }: {
  value: string | number; label: string; sub?: string; color: string; size?: 'xl' | '2xl';
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className={`font-black leading-none mad-count ${size === '2xl' ? 'text-5xl' : 'text-4xl'}`} style={{ color, textShadow: `0 0 30px ${color}60` }}>
        {typeof value === 'number' ? <AnimatedNumber target={value} color={color} /> : <span style={{ color }}>{value}</span>}
      </div>
      <div className="text-[9px] font-black uppercase tracking-widest mt-1.5 text-slate-500">{label}</div>
      {sub && <div className="text-[10px] text-slate-700 mt-0.5 font-mono">{sub}</div>}
    </div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, max = 100, color, size = 96, label }: {
  score: number; max?: number; color: string; size?: number; label?: string;
}) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / max, 1);
  const offset = circ - pct * circ;
  const cx = size / 2, cy = size / 2;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ}
          style={{
            strokeDashoffset: offset,
            filter: `drop-shadow(0 0 5px ${color}80)`,
            transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center mad-count">
        <span className="font-black leading-none" style={{ color, fontSize: size * 0.22 }}>{Math.round(score)}</span>
        {label && <span className="text-slate-600 uppercase font-bold" style={{ fontSize: size * 0.09 }}>{label}</span>}
      </div>
    </div>
  );
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: MatchTier }) {
  const m = MATCH_TIER_META[tier];
  const icons: Record<MatchTier, typeof Crown> = { legendary: Crown, strong: Flame, warm: Star, low: Target, budget_mismatch: Shield, incomplete_data: Shield };
  const Icon = icons[tier];
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest"
      style={{ color: m.color, backgroundColor: m.color + '18', border: `1px solid ${m.color}28` }}
    >
      <Icon className="w-2.5 h-2.5" />
      {m.badge}
    </span>
  );
}

// ─── Panel wrapper ─────────────────────────────────────────────────────────────

function Panel({
  title, subtitle, icon: Icon, color, children, delay = 0, badge,
}: {
  title: string; subtitle?: string; icon?: typeof Crown; color: string;
  children: React.ReactNode; delay?: number; badge?: string | number;
}) {
  return (
    <div
      className="mad-card relative rounded-xl overflow-hidden"
      style={{
        animationDelay: `${delay}s`,
        border: `1px solid ${color}18`,
        background: `linear-gradient(160deg, ${color}04, ${C.bg})`,
      }}
    >
      <div className="mad-scan" />
      <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b" style={{ borderColor: color + '12' }}>
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
          )}
          <div>
            <div className="text-xs font-black text-white uppercase tracking-widest">{title}</div>
            {subtitle && <div className="text-[9px] text-slate-600 uppercase tracking-wider">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge !== undefined && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wide" style={{ color, backgroundColor: color + '18', border: `1px solid ${color}28` }}>
              {badge}
            </span>
          )}
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, animation: 'madPulse 2s ease-in-out infinite' }} />
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Computed analytics ───────────────────────────────────────────────────────

interface Analytics {
  total: number;
  legendary: number;
  strong: number;
  warm: number;
  low: number;
  avgScore: number;
  topScore: number;
  totalPotentialValue: number;
  actionedPct: number;

  // Tier distribution for donut / bars
  tierPcts: Record<MatchTier, number>;

  // Top 5 districts by match count
  topDistricts: { name: string; matches: number; legendary: number; strong: number; value: number }[];

  // Top 5 investors by potential (sum of their match scores)
  topInvestors: { name: string; company: string | null; matchCount: number; totalScore: number; topTier: MatchTier; totalValue: number }[];

  // Score distribution buckets 0-100 in 10-unit bands
  scoreBuckets: number[];

  // Tier over time (simulated curve from match created_at ordering)
  cumulativeCurve: number[];
}

function computeAnalytics(leads: Lead[], matches: LeadMatch[]): Analytics {
  const active = matches.filter(m => !m.is_dismissed);
  const total = active.length;

  const byTier = (t: MatchTier) => active.filter(m => m.match_tier === t).length;
  const legendary = byTier('legendary');
  const strong    = byTier('strong');
  const warm      = byTier('warm');
  const low       = byTier('low');

  const avgScore = total > 0 ? active.reduce((s, m) => s + m.match_score, 0) / total : 0;
  const topScore = total > 0 ? Math.max(...active.map(m => m.match_score)) : 0;
  const actionedPct = total > 0 ? (active.filter(m => m.is_actioned).length / total) * 100 : 0;

  // Potential deal value: for each match, use the matched owner's estimated_value (or investor max if no owner value)
  const ownerById = new Map(leads.filter(l => l.tipo === 'Proprietário').map(l => [l.id, l]));
  const investorById = new Map(leads.filter(l => l.tipo === 'Investidor').map(l => [l.id, l]));

  const totalPotentialValue = active.reduce((sum, m) => {
    const owner = ownerById.get(m.owner_lead_id);
    const investor = investorById.get(m.investor_lead_id);
    const val = owner?.estimated_value || investor?.investment_max || 0;
    return sum + val;
  }, 0);

  // Tier distribution percentages
  const tierPcts: Record<MatchTier, number> = {
    legendary:       total > 0 ? (legendary / total) * 100 : 0,
    strong:          total > 0 ? (strong / total)    * 100 : 0,
    warm:            total > 0 ? (warm / total)      * 100 : 0,
    low:             total > 0 ? (low / total)       * 100 : 0,
    budget_mismatch: 0,
    incomplete_data: 0,
  };

  // Top 5 districts
  const districtCounts: Map<string, { matches: number; legendary: number; strong: number; value: number }> = new Map();
  for (const m of active) {
    const inv = investorById.get(m.investor_lead_id);
    const own = ownerById.get(m.owner_lead_id);
    const locations = [...(inv?.locations ?? []), ...(own?.locations ?? [])];
    const val = own?.estimated_value || inv?.investment_max || 0;
    const seen = new Set<string>();
    for (const loc of locations) {
      if (seen.has(loc)) continue;
      seen.add(loc);
      if (!districtCounts.has(loc)) districtCounts.set(loc, { matches: 0, legendary: 0, strong: 0, value: 0 });
      const entry = districtCounts.get(loc)!;
      entry.matches++;
      if (m.match_tier === 'legendary') entry.legendary++;
      if (m.match_tier === 'strong')    entry.strong++;
      entry.value += val;
    }
  }
  const topDistricts = [...districtCounts.entries()]
    .sort((a, b) => b[1].matches * 10 + b[1].legendary * 50 - (a[1].matches * 10 + a[1].legendary * 50))
    .slice(0, 5)
    .map(([name, d]) => ({ name, ...d }));

  // Top 5 investors by total match score
  const invStats: Map<string, { name: string; company: string | null; matchCount: number; totalScore: number; topTier: MatchTier; totalValue: number }> = new Map();
  for (const m of active) {
    const inv = investorById.get(m.investor_lead_id);
    if (!inv) continue;
    if (!invStats.has(inv.id)) {
      invStats.set(inv.id, { name: inv.name, company: inv.company, matchCount: 0, totalScore: 0, topTier: 'low', totalValue: 0 });
    }
    const s = invStats.get(inv.id)!;
    s.matchCount++;
    s.totalScore += m.match_score;
    const tierRank: Record<MatchTier, number> = { legendary: 4, strong: 3, warm: 2, low: 1, budget_mismatch: 0, incomplete_data: 0 };
    if (tierRank[m.match_tier] > tierRank[s.topTier]) s.topTier = m.match_tier;
    const own = ownerById.get(m.owner_lead_id);
    s.totalValue += own?.estimated_value || 0;
  }
  const topInvestors = [...invStats.values()]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);

  // Score distribution in 10-unit buckets
  const scoreBuckets = Array(10).fill(0);
  for (const m of active) {
    const bucket = Math.min(Math.floor(m.match_score / 10), 9);
    scoreBuckets[bucket]++;
  }

  // Cumulative curve: running total of matches sorted by created_at
  const sorted = [...active].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const cumulativeCurve: number[] = [];
  for (let i = 0; i < sorted.length; i++) cumulativeCurve.push(i + 1);
  if (cumulativeCurve.length < 2) cumulativeCurve.push(0, total);

  return { total, legendary, strong, warm, low, avgScore, topScore, totalPotentialValue, actionedPct, tierPcts, topDistricts, topInvestors, scoreBuckets, cumulativeCurve };
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ data, size = 120 }: { data: { value: number; color: string; label: string }[]; size: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 12, circ = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" />
    </svg>
  );
  let offset = 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
      {data.map((d, i) => {
        if (!d.value) return null;
        const arc = (d.value / total) * circ;
        const el = (
          <circle
            key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={d.color} strokeWidth="10"
            strokeDasharray={`${arc - 2} ${circ - arc + 2}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${d.color}60)` }}
          />
        );
        offset += arc;
        return el;
      })}
    </svg>
  );
}

// ─── Bar chart (vertical SVG) ─────────────────────────────────────────────────

function VertBarChart({ data, h = 80, color }: { data: number[]; h: number; color: string }) {
  const max = Math.max(...data, 1);
  const w = 100 / data.length;
  const gap = w * 0.3;
  return (
    <svg width="100%" viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="overflow-visible">
      {[0.25, 0.5, 0.75].map(pct => (
        <line key={pct} x1="0" y1={h - pct * h} x2="100" y2={h - pct * h} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      ))}
      {data.map((v, i) => {
        const bh = (v / max) * h;
        const x = i * w + gap / 2;
        const bw = w - gap;
        return (
          <g key={i}>
            <rect x={x} y={h - bh} width={bw} height={bh}
              fill={color} fillOpacity={v ? 0.85 : 0.15} rx="0.5"
              style={{ transformOrigin: `${x + bw / 2}px ${h}px`, animation: `madBarGrow 0.6s cubic-bezier(0.22,1,0.36,1) ${i * 0.04}s both` }}
            />
            {v > 0 && <rect x={x} y={h - bh} width={bw} height="1.5" fill={color} rx="0.5" />}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MatchAnalyticsDashboardProps {
  playerId: string;
  districts: District[];
  externalLeads?: Lead[];
}

export function MatchAnalyticsDashboard({ playerId, districts: _districts, externalLeads }: MatchAnalyticsDashboardProps) {
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const [matches, setMatches] = useState<LeadMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const leads = (externalLeads && externalLeads.length > 0) ? externalLeads : localLeads;

  const load = useCallback(async () => {
    setRefreshing(true);
    const [ls, ms] = await Promise.all([getLeads(playerId), getLeadMatches(playerId)]);
    setLocalLeads(ls);
    setMatches(ms);
    setLoading(false);
    setRefreshing(false);
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (externalLeads && externalLeads.length > 0) setLoading(false);
  }, [externalLeads]);

  const a = useMemo(() => computeAnalytics(leads, matches), [leads, matches]);

  const tickerItems = [
    { label: 'Total Matches', value: String(a.total),       color: C.total },
    { label: 'Legendary',     value: String(a.legendary),   color: C.legendary },
    { label: 'Strong',        value: String(a.strong),      color: C.strong },
    { label: 'Avg Score',     value: a.avgScore.toFixed(1), color: C.score },
    { label: 'Pipeline',      value: fmtM(a.totalPotentialValue), color: C.value },
    { label: 'Actioned',      value: a.actionedPct.toFixed(0) + '%', color: '#10b981' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-600 text-sm">
        Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{MAD_CSS}</style>

      {/* ── Terminal header ── */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(6,182,212,0.15)', background: `linear-gradient(160deg, rgba(6,182,212,0.04), ${C.bg})` }}
      >
        <div className="mad-scan" />
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.6), transparent)' }} />
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {['#ef4444', '#f59e0b', '#10b981'].map((c, i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c, opacity: 0.7 }} />
              ))}
            </div>
            <div>
              <div className="mad-flicker text-xs font-black text-white uppercase tracking-widest">
                Match Intelligence · Analytics Terminal
              </div>
              <div className="text-[9px] font-mono" style={{ color: 'rgba(6,182,212,0.5)' }}>
                LIVE DATA · {a.total} ACTIVE MATCHES · {leads.length} LEADS
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono" style={{ color: C.total, animation: 'madPulse 1.5s ease-in-out infinite' }}>● LIVE</span>
            <button
              onClick={load}
              disabled={refreshing}
              className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-600 text-slate-600 hover:text-slate-400 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {/* Ticker */}
        <div className="overflow-hidden h-7 border-t flex items-center" style={{ borderColor: 'rgba(6,182,212,0.08)' }}>
          <div
            className="flex gap-8 whitespace-nowrap text-xs font-mono"
            style={{ animation: 'madTicker 22s linear infinite' }}
          >
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span style={{ color: 'rgba(6,182,212,0.3)' }}>·</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-600">{item.label}</span>
                <span className="font-black" style={{ color: item.color }}>{item.value}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Empty state ── */}
      {a.total === 0 && (
        <div className="text-center py-16 space-y-3">
          <Activity className="w-14 h-14 text-slate-800 mx-auto" />
          <p className="text-slate-500 font-bold text-sm">No match data yet.</p>
          <p className="text-slate-700 text-xs">Add investors and owners in the Matching Engine tab, then run the engine to generate analytics.</p>
        </div>
      )}

      {a.total > 0 && (
        <>
          {/* ── Hero stats row ── */}
          <div
            className="mad-card relative rounded-xl overflow-hidden p-5"
            style={{ border: `1px solid ${C.legendary}25`, background: `linear-gradient(135deg, ${C.legendary}06, ${C.bg})` }}
          >
            <div className="mad-scan" />
            <div className="h-px mb-5" style={{ background: `linear-gradient(90deg, transparent, ${C.legendary}70, transparent)` }} />
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 divide-x" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <HeroMetric value={a.total}     label="Total Matches"   color={C.total}     />
              <HeroMetric value={a.legendary} label="Legendary"       color={C.legendary} />
              <HeroMetric value={a.strong}    label="Strong"          color={C.strong}    />
              <HeroMetric value={a.warm}      label="Warm"            color={C.warm}      />
              <HeroMetric value={a.avgScore.toFixed(1)} label="Avg Score" color={C.score} />
              <HeroMetric value={fmtM(a.totalPotentialValue)} label="Pipeline Value" sub="total potential" color={C.value} />
            </div>
          </div>

          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="mad-card relative rounded-xl overflow-hidden p-4 mad-glow"
              style={{ '--card-glow': C.legendary + '30', '--card-glow-far': C.legendary + '10', border: `1px solid ${C.legendary}35`, background: `linear-gradient(145deg, ${C.legendary}08, ${C.bg})` } as React.CSSProperties}
            >
              <div className="mad-scan" />
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.legendary + '20', border: `1px solid ${C.legendary}30` }}>
                  <Crown className="w-4 h-4" style={{ color: C.legendary }} />
                </div>
                <ScoreRing score={a.tierPcts.legendary} max={100} color={C.legendary} size={48} />
              </div>
              <div className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: C.legendary + '70' }}>Legendary Rate</div>
              <div className="text-2xl font-black leading-none" style={{ color: C.legendary }}>{a.tierPcts.legendary.toFixed(1)}%</div>
              <div className="text-[10px] text-slate-600 mt-1 font-mono">{a.legendary} of {a.total}</div>
            </div>

            <div className="mad-card relative rounded-xl overflow-hidden p-4"
              style={{ border: `1px solid ${C.strong}20`, background: `linear-gradient(145deg, ${C.strong}06, ${C.bg})` }}
            >
              <div className="mad-scan" />
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.strong + '18', border: `1px solid ${C.strong}25` }}>
                  <Flame className="w-4 h-4" style={{ color: C.strong }} />
                </div>
                <ScoreRing score={a.tierPcts.strong} max={100} color={C.strong} size={48} />
              </div>
              <div className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: C.strong + '70' }}>Strong Rate</div>
              <div className="text-2xl font-black leading-none" style={{ color: C.strong }}>{a.tierPcts.strong.toFixed(1)}%</div>
              <div className="text-[10px] text-slate-600 mt-1 font-mono">{a.strong} of {a.total}</div>
            </div>

            <div className="mad-card relative rounded-xl overflow-hidden p-4"
              style={{ border: `1px solid ${C.score}20`, background: `linear-gradient(145deg, ${C.score}06, ${C.bg})` }}
            >
              <div className="mad-scan" />
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.score + '18', border: `1px solid ${C.score}25` }}>
                  <Activity className="w-4 h-4" style={{ color: C.score }} />
                </div>
                <ScoreRing score={a.avgScore} max={100} color={C.score} size={48} />
              </div>
              <div className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: C.score + '70' }}>Avg Match Score</div>
              <div className="text-2xl font-black leading-none" style={{ color: C.score }}>{a.avgScore.toFixed(1)}</div>
              <div className="text-[10px] text-slate-600 mt-1 font-mono">Top: {a.topScore}</div>
            </div>

            <div className="mad-card relative rounded-xl overflow-hidden p-4"
              style={{ border: `1px solid ${C.value}20`, background: `linear-gradient(145deg, ${C.value}06, ${C.bg})` }}
            >
              <div className="mad-scan" />
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.value + '18', border: `1px solid ${C.value}25` }}>
                  <DollarSign className="w-4 h-4" style={{ color: C.value }} />
                </div>
                <Sparkline values={a.cumulativeCurve} color={C.value} />
              </div>
              <div className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: C.value + '70' }}>Total Deal Value</div>
              <div className="text-2xl font-black leading-none" style={{ color: C.value }}>{fmtM(a.totalPotentialValue)}</div>
              <div className="text-[10px] text-slate-600 mt-1 font-mono">{a.actionedPct.toFixed(0)}% actioned</div>
            </div>
          </div>

          {/* ── Tier distribution + cumulative ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title="Tier Distribution" subtitle="Match Quality Breakdown" icon={BarChart2} color={C.total} delay={0.1}>
              <div className="flex items-center gap-5">
                {/* Donut */}
                <div className="relative flex-shrink-0">
                  <DonutChart
                    size={120}
                    data={[
                      { value: a.legendary, color: C.legendary, label: 'Legendary' },
                      { value: a.strong,    color: C.strong,    label: 'Strong' },
                      { value: a.warm,      color: C.warm,      label: 'Warm' },
                      { value: a.low,       color: C.low,       label: 'Low' },
                    ]}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="font-black text-xl leading-none text-white">{a.total}</div>
                    <div className="text-[9px] text-slate-600 uppercase">total</div>
                  </div>
                </div>
                {/* Legend + bars */}
                <div className="flex-1 space-y-2.5">
                  {([
                    { tier: 'legendary' as MatchTier, count: a.legendary, color: C.legendary, icon: Crown },
                    { tier: 'strong'    as MatchTier, count: a.strong,    color: C.strong,    icon: Flame },
                    { tier: 'warm'      as MatchTier, count: a.warm,      color: C.warm,      icon: Star },
                    { tier: 'low'       as MatchTier, count: a.low,       color: C.low,       icon: Target },
                  ]).map(({ tier, count, color, icon: Icon }) => (
                    <div key={tier} className="flex items-center gap-2">
                      <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
                      <div className="flex-1 h-2 bg-slate-900 rounded overflow-hidden">
                        <div
                          className="mad-bar h-full rounded"
                          style={{ width: `${a.total > 0 ? (count / a.total) * 100 : 0}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}50` }}
                        />
                      </div>
                      <span className="text-[10px] font-black font-mono w-5 text-right" style={{ color }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Score Distribution" subtitle="Match Score Histogram (0–100)" icon={Activity} color={C.score} delay={0.12}>
              <div>
                <div className="h-20 mb-1">
                  <VertBarChart data={a.scoreBuckets} h={80} color={C.score} />
                </div>
                <div className="flex justify-between text-[9px] text-slate-700 font-mono">
                  {['0', '10', '20', '30', '40', '50', '60', '70', '80', '90+'].map(l => (
                    <span key={l}>{l}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                {[
                  { label: 'Avg Score', value: a.avgScore.toFixed(1), color: C.score },
                  { label: 'Top Score', value: String(a.topScore),    color: C.legendary },
                  { label: 'Actioned',  value: a.actionedPct.toFixed(0) + '%', color: C.strong },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg p-2" style={{ backgroundColor: color + '08', border: `1px solid ${color}15` }}>
                    <div className="text-[9px] text-slate-600">{label}</div>
                    <div className="font-black text-sm" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* ── Top 5 districts ── */}
          <Panel title="Top Districts by Match Activity" subtitle="Ranked by matches · value · quality" icon={MapPin} color={C.value} delay={0.15}>
            {a.topDistricts.length === 0 ? (
              <div className="text-center py-4 text-slate-700 text-xs">No district data. Add location info to leads.</div>
            ) : (
              <div className="space-y-2.5">
                {a.topDistricts.map((d, i) => {
                  const maxM = Math.max(...a.topDistricts.map(x => x.matches), 1);
                  const color = i === 0 ? C.legendary : i === 1 ? C.strong : i === 2 ? C.warm : C.total;
                  return (
                    <div key={d.name} className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={{ backgroundColor: color + '20', color }}
                      >
                        {i + 1}
                      </div>
                      <div className="w-24 flex-shrink-0">
                        <div className="text-xs font-bold text-white truncate">{d.name}</div>
                        <div className="text-[9px] text-slate-600">{fmtM(d.value)}</div>
                      </div>
                      <div className="flex-1 h-5 bg-slate-900/80 rounded overflow-hidden relative" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div
                          className="mad-bar absolute inset-y-0 left-0 rounded"
                          style={{ width: `${(d.matches / maxM) * 100}%`, backgroundColor: color, animationDelay: `${i * 0.06}s`, boxShadow: `0 0 5px ${color}50` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-black font-mono" style={{ color }}>{d.matches}</span>
                        {d.legendary > 0 && (
                          <span className="flex items-center gap-0.5 text-[9px] font-black" style={{ color: C.legendary }}>
                            <Crown className="w-2.5 h-2.5" />{d.legendary}
                          </span>
                        )}
                        {d.strong > 0 && (
                          <span className="flex items-center gap-0.5 text-[9px] font-black hidden sm:flex" style={{ color: C.strong }}>
                            <Flame className="w-2.5 h-2.5" />{d.strong}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* ── Top 5 investors ── */}
          <Panel title="Top Investors by Match Potential" subtitle="Ranked by total match score" icon={Users} color={C.total} delay={0.18}>
            {a.topInvestors.length === 0 ? (
              <div className="text-center py-4 text-slate-700 text-xs">No investor matches yet.</div>
            ) : (
              <div className="space-y-3">
                {a.topInvestors.map((inv, i) => {
                  const maxScore = Math.max(...a.topInvestors.map(x => x.totalScore), 1);
                  const color = MATCH_TIER_META[inv.topTier].color;
                  const initials = inv.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={inv.name} className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                        style={{ backgroundColor: color + '20', color, border: `1px solid ${color}30` }}
                      >
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-white truncate">{inv.name}</span>
                          {inv.company && <span className="text-[10px] text-slate-600 hidden sm:block truncate">{inv.company}</span>}
                          <TierBadge tier={inv.topTier} />
                        </div>
                        <div className="h-2 bg-slate-900/80 rounded overflow-hidden">
                          <div
                            className="mad-bar h-full rounded"
                            style={{ width: `${(inv.totalScore / maxScore) * 100}%`, backgroundColor: color, animationDelay: `${i * 0.07}s`, boxShadow: `0 0 4px ${color}50` }}
                          />
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 space-y-0.5">
                        <div className="text-sm font-black font-mono" style={{ color }}>{inv.totalScore}</div>
                        <div className="text-[9px] text-slate-600">{inv.matchCount}m{inv.totalValue > 0 ? ` · ${fmtM(inv.totalValue)}` : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* ── Pipeline value + match velocity ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title="Match Velocity" subtitle="Cumulative matches over time" icon={TrendingUp} color={C.strong} delay={0.2}>
              <div className="h-24">
                <Sparkline values={a.cumulativeCurve} color={C.strong} w={300} h={80} />
              </div>
              <div className="flex justify-between text-[9px] text-slate-700 mt-1">
                <span>First match</span>
                <span className="font-black" style={{ color: C.strong }}>{a.total} total</span>
              </div>
            </Panel>

            <Panel title="Pipeline Breakdown" subtitle="Deal value by tier" icon={DollarSign} color={C.value} delay={0.22}>
              <div className="space-y-3">
                {(['legendary', 'strong', 'warm', 'low'] as MatchTier[]).map(tier => {
                  const tierMatches = matches.filter(m => !m.is_dismissed && m.match_tier === tier);
                  const ownerById = new Map(leads.filter(l => l.tipo === 'Proprietário').map(l => [l.id, l]));
                  const tierValue = tierMatches.reduce((s, m) => {
                    const own = ownerById.get(m.owner_lead_id);
                    return s + (own?.estimated_value ?? 0);
                  }, 0);
                  const color = MATCH_TIER_META[tier].color;
                  const maxVal = Math.max(a.totalPotentialValue, 1);
                  return (
                    <div key={tier} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '15' }}>
                        {tier === 'legendary' ? <Crown className="w-3 h-3" style={{ color }} /> :
                         tier === 'strong'    ? <Flame className="w-3 h-3" style={{ color }} /> :
                         tier === 'warm'      ? <Star className="w-3 h-3" style={{ color }} />  :
                                               <Target className="w-3 h-3" style={{ color }} />}
                      </div>
                      <div className="flex-1 h-4 bg-slate-900/80 rounded overflow-hidden relative">
                        <div
                          className="mad-bar absolute inset-y-0 left-0 rounded"
                          style={{ width: `${(tierValue / maxVal) * 100}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}50` }}
                        />
                      </div>
                      <span className="text-xs font-black font-mono w-16 text-right flex-shrink-0" style={{ color }}>
                        {fmtM(tierValue)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
