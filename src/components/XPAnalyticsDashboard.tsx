import { useState, useMemo } from 'react';
import { Zap, TrendingUp, Star, Target, Calendar, ChevronUp, Award } from 'lucide-react';
import { Player, xpRequiredForLevel } from '../types/game';
import type { DynamicQuest } from '../services/questEngine';

interface XPAnalyticsDashboardProps {
  player: Player | null;
  dynamicQuests: DynamicQuest[];
}

// ── Level system mirrored from the existing xpRequiredForLevel helper ─────────

interface LevelInfo {
  level: number;
  title: string;
  xpRequired: number;
}

const LEVEL_TITLES: Record<number, string> = {
  1: 'Advisory Intern',
  2: 'Deal Scout',
  3: 'Pipeline Builder',
  4: 'District Operator',
  5: 'Strategic Closer',
  6: 'Market Commander',
  7: 'Territory Architect',
  8: 'Capital Strategist',
  9: 'Sovereign Operator',
  10: 'Empire Master',
};

function buildLevelTable(): LevelInfo[] {
  const rows: LevelInfo[] = [];
  for (let l = 1; l <= 10; l++) {
    rows.push({
      level: l,
      title: LEVEL_TITLES[l] ?? `Level ${l}`,
      xpRequired: xpRequiredForLevel(l),
    });
  }
  return rows;
}

const LEVEL_TABLE = buildLevelTable();

type Range = '7d' | '30d';

// ── Daily XP derived from completed dynamic quests ────────────────────────────

interface DayBucket {
  date: string;    // YYYY-MM-DD
  label: string;
  xp: number;
  quests: number;
}

function buildDailyBuckets(quests: DynamicQuest[], days: number): DayBucket[] {
  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const label = days === 7
      ? d.toLocaleDateString('en', { weekday: 'short' })
      : d.getDate().toString();
    buckets.push({ date: dateStr, label, xp: 0, quests: 0 });
  }

  for (const q of quests) {
    if (q.status !== 'completed' || !q.completed_at) continue;
    const dateStr = q.completed_at.split('T')[0];
    const bucket = buckets.find(b => b.date === dateStr);
    if (bucket) {
      bucket.xp += q.xp_reward ?? 0;
      bucket.quests += 1;
    }
  }

  return buckets;
}

// ─────────────────────────────────────────────────────────────────────────────

export function XPAnalyticsDashboard({ player, dynamicQuests }: XPAnalyticsDashboardProps) {
  const [range, setRange] = useState<Range>('30d');

  const days = range === '7d' ? 7 : 30;
  const chartDays = useMemo(() => buildDailyBuckets(dynamicQuests, days), [dynamicQuests, days]);

  const maxXP = useMemo(() => Math.max(...chartDays.map(d => d.xp), 1), [chartDays]);

  const summary = useMemo(() => {
    const total = chartDays.reduce((a, d) => a + d.xp, 0);
    const completions = chartDays.reduce((a, d) => a + d.quests, 0);
    const activeDays = chartDays.filter(d => d.xp > 0).length;
    const best = chartDays.reduce((a, d) => d.xp > a.xp ? d : a, chartDays[0] ?? { xp: 0, date: '', label: '' });
    return { total, completions, activeDays, best, avg: activeDays > 0 ? Math.round(total / activeDays) : 0 };
  }, [chartDays]);

  const totalXP = player?.total_xp ?? 0;
  const currentLevel = player?.level ?? 1;

  const currentThreshold = LEVEL_TABLE.find(t => t.level === currentLevel) ?? LEVEL_TABLE[0];
  const nextThreshold = LEVEL_TABLE.find(t => t.level === currentLevel + 1);

  const progressPct = useMemo(() => {
    if (!nextThreshold) return 100;
    const base = currentThreshold.xpRequired;
    const ceil = nextThreshold.xpRequired;
    if (ceil <= base) return 100;
    return Math.min(Math.round(((totalXP - base) / (ceil - base)) * 100), 100);
  }, [totalXP, currentThreshold, nextThreshold]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight leading-none">XP Analytics</h2>
            <p className="text-xs text-slate-500 mt-0.5">Experience progression and quest activity</p>
          </div>
        </div>
        <div className="flex gap-1">
          {(['7d', '30d'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === r
                  ? 'bg-amber-500/15 border border-amber-500/35 text-amber-300'
                  : 'bg-slate-800/50 border border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600/40'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Level progress card ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-amber-900/20 bg-gradient-to-br from-amber-950/20 to-transparent p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-2xl font-black text-amber-400">Lv {currentLevel}</span>
              {nextThreshold && (
                <span className="text-slate-500 text-sm font-semibold">→ Lv {currentLevel + 1}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-white">{currentThreshold.title}</p>
            {nextThreshold && (
              <p className="text-xs text-slate-500 mt-0.5">{nextThreshold.title} awaits</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-white">{totalXP.toLocaleString()}</div>
            <div className="text-xs text-slate-500">total XP</div>
            {nextThreshold && (
              <div className="text-xs text-amber-500 mt-0.5 font-semibold">
                {Math.max(0, nextThreshold.xpRequired - totalXP).toLocaleString()} to next
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{currentThreshold.xpRequired.toLocaleString()} XP</span>
            <span className="text-amber-400 font-bold">{progressPct}%</span>
            <span>{nextThreshold ? nextThreshold.xpRequired.toLocaleString() : 'Max'} XP</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #f59e0b, #f97316)',
                boxShadow: '0 0 10px rgba(245,158,11,0.4)',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { label: `Total XP (${range})`, value: summary.total.toLocaleString(),       Icon: Zap,        color: '#f59e0b' },
          { label: 'Avg XP (active days)', value: summary.avg.toLocaleString(),         Icon: TrendingUp, color: '#10b981' },
          { label: 'Best Day',             value: summary.best.xp.toLocaleString(),     Icon: Star,       color: '#f97316' },
          { label: 'Quests Done',          value: summary.completions.toString(),        Icon: Target,     color: '#3b82f6' },
        ] as const).map(({ label, value, Icon, color }) => (
          <div
            key={label}
            className="rounded-xl p-4 border text-center"
            style={{ background: `${color}08`, borderColor: `${color}1a` }}
          >
            <Icon className="w-4 h-4 mx-auto mb-1.5" style={{ color }} />
            <div className="text-xl font-black" style={{ color }}>{value}</div>
            <div className="text-xs text-slate-500 mt-0.5 font-medium leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Best day callout ──────────────────────────────────────────────── */}
      {summary.best.xp > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-950/25 border border-amber-700/20 text-amber-400">
          <Award className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-semibold">
            Best day: <strong>{summary.best.xp.toLocaleString()} XP</strong> on {formatDate(summary.best.date)}
            {' '}· {summary.activeDays} active day{summary.activeDays !== 1 ? 's' : ''} this period
          </span>
        </div>
      )}

      {/* ── Daily XP bar chart ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-bold text-slate-300">
            Daily XP Earned — Last {range === '7d' ? '7' : '30'} Days
          </span>
          <span className="ml-auto text-xs text-slate-600 font-mono">
            from completed quests
          </span>
        </div>

        {chartDays.every(d => d.xp === 0) ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-slate-400 text-sm font-semibold">No XP data for this period</p>
              <p className="text-slate-600 text-xs mt-1">Complete quests to start earning and tracking XP.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chart area */}
            <div className="relative" style={{ height: '180px' }}>
              {/* Horizontal guide lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-7">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-full h-px bg-slate-800/50" />
                ))}
              </div>

              {/* Bars */}
              <div className="absolute inset-0 flex items-end gap-px pb-7">
                {chartDays.map((day, i) => {
                  const heightPct = (day.xp / maxXP) * 100;
                  const isToday = day.date === todayStr;
                  const isBest = day.date === summary.best.date && day.xp > 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-0"
                      title={day.xp > 0 ? `${formatDate(day.date)}: ${day.xp.toLocaleString()} XP · ${day.quests} quest${day.quests !== 1 ? 's' : ''}` : formatDate(day.date)}
                    >
                      <div className="w-full flex items-end" style={{ height: '140px' }}>
                        <div
                          className="w-full transition-all duration-500 rounded-t-sm"
                          style={{
                            height: day.xp > 0 ? `${Math.max(heightPct, 3)}%` : '2px',
                            background: isBest
                              ? 'linear-gradient(180deg, #f97316, #f59e0b)'
                              : isToday
                              ? 'linear-gradient(180deg, #38bdf8, #06b6d4)'
                              : 'linear-gradient(180deg, rgba(245,158,11,0.65), rgba(245,158,11,0.25))',
                            boxShadow: isBest
                              ? '0 0 14px rgba(249,115,22,0.55)'
                              : isToday
                              ? '0 0 10px rgba(56,189,248,0.45)'
                              : 'none',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 right-0 flex gap-px" style={{ height: '28px', alignItems: 'flex-end' }}>
                {chartDays.map((day, i) => (
                  <div key={i} className="flex-1 flex items-center justify-center">
                    <span
                      className="font-mono leading-none"
                      style={{
                        fontSize: '9px',
                        color: day.date === todayStr ? '#38bdf8' : '#475569',
                      }}
                    >
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(245,158,11,0.55)' }} />
                XP earned
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(180deg,#f97316,#f59e0b)' }} />
                Best day
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(180deg,#38bdf8,#06b6d4)' }} />
                Today
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Level progression roadmap ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ChevronUp className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-bold text-slate-300">Level Roadmap</span>
        </div>
        <div className="space-y-1.5">
          {LEVEL_TABLE.map(t => {
            const reached = totalXP >= t.xpRequired;
            const isCurrent = t.level === currentLevel;
            return (
              <div
                key={t.level}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-amber-950/30 border border-amber-700/30'
                    : reached
                    ? 'bg-slate-800/20 border border-slate-700/15'
                    : 'border border-transparent opacity-35'
                }`}
              >
                {/* Level badge */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{
                    background: isCurrent ? 'rgba(245,158,11,0.12)' : reached ? '#1e293b' : 'transparent',
                    color:      isCurrent ? '#f59e0b' : reached ? '#64748b' : '#334155',
                    border:     `1px solid ${isCurrent ? 'rgba(245,158,11,0.35)' : reached ? '#334155' : 'transparent'}`,
                  }}
                >
                  {t.level}
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-bold truncate ${isCurrent ? 'text-amber-300' : reached ? 'text-slate-400' : 'text-slate-600'}`}>
                    {t.title}
                  </div>
                </div>

                {/* XP requirement */}
                <div className={`text-xs font-mono flex-shrink-0 ${isCurrent ? 'text-amber-500' : reached ? 'text-slate-600' : 'text-slate-700'}`}>
                  {t.xpRequired.toLocaleString()} XP
                </div>

                {/* Status dot */}
                {reached && !isCurrent && (
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                )}
                {isCurrent && (
                  <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
