import { useState, useEffect, useRef } from 'react';
import {
  Player, PlayerStats, PlayerReputation,
  SKILL_COLORS, SKILL_LABELS, SKILL_ICONS,
  getRepRank, REP_TRACK_META,
} from '../types/game';
import { RepRankBadge } from './ReputationPanel';
import {
  Crown, Star, TrendingUp, Zap, Shield, Brain, Heart,
  Coffee, Moon, Sun, Activity,
} from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlayerProfileProps {
  player: Player | null;
  stats: PlayerStats | null;
  reputation?: PlayerReputation | null;
  onPerformAction?: (action: 'client_call' | 'partner_meeting' | 'site_visit') => void;
  onRestoreEnergy?: (type: 'rest' | 'morning_routine') => void;
}

// ─── Animated number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const diff = value - prev.current;
    const steps = 12;
    const stepVal = diff / steps;
    let current = prev.current;
    let step = 0;
    const id = setInterval(() => {
      step++;
      current += stepVal;
      setDisplay(Math.round(current));
      if (step >= steps) { setDisplay(value); prev.current = value; clearInterval(id); }
    }, 30);
    return () => clearInterval(id);
  }, [value]);

  return <span>{display}</span>;
}

// ─── Standard skill bar ───────────────────────────────────────────────────────

const STAT_ORDER = ['negotiation', 'networking', 'focus', 'discipline', 'leadership', 'reputation'] as const;

function StatBar({ stat, value }: { stat: typeof STAT_ORDER[number]; value: number }) {
  const [mounted, setMounted] = useState(false);
  const [bumping, setBumping] = useState(false);
  const [prev, setPrev] = useState(value);
  const color = SKILL_COLORS[stat];
  const pct = Math.min((value / 100) * 100, 100);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (value !== prev && prev !== 0) { setBumping(true); setTimeout(() => setBumping(false), 500); }
    setPrev(value);
  }, [value]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>{SKILL_ICONS[stat]}</span>
          <span>{SKILL_LABELS[stat]}</span>
        </span>
        <span className={`text-xs font-black transition-all ${bumping ? 'scale-110' : ''}`} style={{ color }}>
          <AnimatedNumber value={value} />
        </span>
      </div>
      <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
          style={{ width: mounted ? `${pct}%` : '0%', backgroundColor: color, boxShadow: pct > 30 ? `0 0 6px ${color}60` : 'none' }}
        >
          {pct > 50 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{ backgroundSize: '200% 100%' }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Vitality bar (energy/stress/morale) ─────────────────────────────────────

interface VitalityBarConfig {
  label: string;
  value: number;
  max: number;
  color: string;
  warnColor: string;
  dangerColor: string;
  warnThreshold: number;   // below this = warn
  dangerThreshold: number; // below this = danger
  invertWarning?: boolean; // for stress: high = bad
  icon: React.ElementType;
  description: string;
}

function VitalityBar({ cfg }: { cfg: VitalityBarConfig }) {
  const [mounted, setMounted] = useState(false);
  const [prev, setPrev] = useState(cfg.value);
  const [delta, setDelta] = useState<number | null>(null);
  const deltaTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (cfg.value !== prev) {
      const d = cfg.value - prev;
      setDelta(d);
      clearTimeout(deltaTimer.current);
      deltaTimer.current = setTimeout(() => setDelta(null), 1800);
      setPrev(cfg.value);
    }
  }, [cfg.value]);

  const pct = Math.min((cfg.value / cfg.max) * 100, 100);

  const activeColor = cfg.invertWarning
    ? (cfg.value > (100 - cfg.warnThreshold) ? cfg.dangerColor : cfg.value > (100 - cfg.dangerThreshold) ? cfg.warnColor : cfg.color)
    : (cfg.value < cfg.dangerThreshold ? cfg.dangerColor : cfg.value < cfg.warnThreshold ? cfg.warnColor : cfg.color);

  const Icon = cfg.icon;
  const isPulsing = cfg.invertWarning ? cfg.value > 70 : cfg.value < cfg.dangerThreshold;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: activeColor, animation: isPulsing ? 'rarePulse 1s ease-in-out infinite' : undefined }}
          />
          <span className="text-xs text-slate-400">{cfg.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {delta !== null && (
            <span
              className="text-[10px] font-black transition-all"
              style={{
                color: delta > 0 ? (cfg.invertWarning ? '#ef4444' : '#10b981') : (cfg.invertWarning ? '#10b981' : '#ef4444'),
                animation: 'vitalDeltaPop 1.8s ease-out both',
              }}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
          <span className="text-xs font-black tabular-nums" style={{ color: activeColor }}>
            <AnimatedNumber value={cfg.value} />
            {cfg.max !== 100 && <span className="text-slate-600 font-normal">/{cfg.max}</span>}
          </span>
        </div>
      </div>
      <div className="w-full bg-slate-800/60 rounded-full h-2.5 overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
          style={{
            width: mounted ? `${cfg.invertWarning ? pct : pct}%` : '0%',
            backgroundColor: activeColor,
            boxShadow: `0 0 8px ${activeColor}50`,
          }}
        >
          {!cfg.invertWarning && pct > 50 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer"
              style={{ backgroundSize: '200% 100%' }} />
          )}
        </div>
        {/* Threshold markers */}
        {!cfg.invertWarning && (
          <>
            <div className="absolute top-0 bottom-0 w-px bg-amber-900/50" style={{ left: `${cfg.warnThreshold}%` }} />
            <div className="absolute top-0 bottom-0 w-px bg-red-900/50" style={{ left: `${cfg.dangerThreshold}%` }} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon, label, cost, color, onClick, disabled,
}: {
  icon: React.ElementType; label: string; cost: string;
  color: string; onClick: () => void; disabled?: boolean;
}) {
  const [flash, setFlash] = useState(false);

  const handle = () => {
    if (disabled) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
    onClick();
  };

  return (
    <button
      onClick={handle}
      disabled={disabled}
      className="relative flex flex-col items-center gap-1 rounded-xl border px-2 py-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed group overflow-hidden"
      style={{
        borderColor: color + '30',
        backgroundColor: flash ? color + '25' : color + '0d',
      }}
      title={label}
    >
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
      <Icon className="w-3.5 h-3.5 relative z-10" style={{ color }} />
      <span className="text-[9px] font-bold text-slate-500 relative z-10 leading-none">{label}</span>
      <span className="text-[9px] font-black relative z-10" style={{ color: color + 'cc' }}>{cost}</span>
    </button>
  );
}

// ─── Vitality status label ────────────────────────────────────────────────────

function vitalityLabel(energy: number, stress: number, morale: number): { text: string; color: string } {
  if (stress >= 80)  return { text: 'Burned Out',    color: '#ef4444' };
  if (energy <= 15)  return { text: 'Exhausted',     color: '#ef4444' };
  if (stress >= 60)  return { text: 'Under Pressure',color: '#f59e0b' };
  if (energy <= 35)  return { text: 'Fatigued',      color: '#f59e0b' };
  if (morale >= 80 && energy >= 70) return { text: 'In the Zone',   color: '#10b981' };
  if (morale >= 65)  return { text: 'Motivated',     color: '#06b6d4' };
  if (morale <= 25)  return { text: 'Demoralized',   color: '#64748b' };
  return { text: 'Steady',          color: '#94a3b8' };
}

// ─── Main component ───────────────────────────────────────────────────────────

export const PlayerProfile = ({
  player, stats, reputation,
  onPerformAction, onRestoreEnergy,
}: PlayerProfileProps) => {
  const [mounted, setMounted] = useState(false);
  const [vitalTab, setVitalTab] = useState<'vitals' | 'skills'>('vitals');

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  if (!player) return null;

  const xpPct = Math.min((player.current_xp / player.xp_to_next_level) * 100, 100);

  const energy    = player.energy    ?? 80;
  const maxEnergy = player.max_energy ?? 100;
  const stress    = player.stress    ?? 20;
  const morale    = player.morale    ?? 75;
  const focus     = player.focus     ?? 10;

  const status = vitalityLabel(energy, stress, morale);

  const vitalBars: VitalityBarConfig[] = [
    {
      label: 'Energy',
      value: energy,
      max: maxEnergy,
      color: '#10b981',
      warnColor: '#f59e0b',
      dangerColor: '#ef4444',
      warnThreshold: 40,
      dangerThreshold: 20,
      icon: Zap,
      description: 'Consumed by calls and meetings. Restored by rest.',
    },
    {
      label: 'Focus',
      value: Math.min(focus, 100),
      max: 100,
      color: '#06b6d4',
      warnColor: '#f59e0b',
      dangerColor: '#ef4444',
      warnThreshold: 30,
      dangerThreshold: 15,
      icon: Brain,
      description: 'Sharp thinking. Reduced by trading and high stress.',
    },
    {
      label: 'Stress',
      value: stress,
      max: 100,
      color: '#3b82f6',
      warnColor: '#f59e0b',
      dangerColor: '#ef4444',
      warnThreshold: 40,   // used inverted: warn when > 60
      dangerThreshold: 20, // used inverted: danger when > 80
      invertWarning: true,
      icon: Activity,
      description: 'Raised by trading and failures. High stress reduces Focus.',
    },
    {
      label: 'Morale',
      value: morale,
      max: 100,
      color: '#f59e0b',
      warnColor: '#f97316',
      dangerColor: '#ef4444',
      warnThreshold: 35,
      dangerThreshold: 20,
      icon: Heart,
      description: 'Confidence and drive. Boosted by successful deals.',
    },
  ];

  return (
    <>
      <style>{`
        @keyframes vitalDeltaPop {
          0%   { opacity: 0; transform: translateY(4px) scale(0.8); }
          20%  { opacity: 1; transform: translateY(-2px) scale(1.1); }
          70%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.9); }
        }
        @keyframes statusGlow {
          0%, 100% { opacity: 0.8; }
          50%       { opacity: 1; }
        }
      `}</style>

      <div className="rpg-card hud-frame overflow-hidden animate-slide-in-left">
        {/* Top accent */}
        <div className="h-0.5 w-full"
          style={{ background: 'linear-gradient(90deg, transparent, #f59e0b, #f97316, #f59e0b, transparent)' }} />

        {/* Corner glow */}
        <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-20 animate-pulse-glow"
            style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }} />
        </div>

        <div className="p-5 space-y-4 relative">

          {/* ── Identity ─────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-white leading-tight tracking-tight">{player.name}</h1>
              <p className="text-amber-600/70 text-xs mt-0.5 tracking-widest uppercase">Hotel Investment Strategist</p>
              {/* Vitality status */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: status.color, boxShadow: `0 0 4px ${status.color}`, animation: 'statusGlow 2s ease-in-out infinite' }}
                />
                <span className="text-xs font-bold" style={{ color: status.color }}>{status.text}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <div className="flex items-center gap-1 justify-end">
                <Crown className="w-4 h-4 text-amber-400 animate-float" />
                <span className="text-3xl font-black text-amber-400 text-glow-amber leading-none">{player.level}</span>
              </div>
              <p className="text-slate-600 text-xs tracking-widest uppercase">Level</p>
            </div>
          </div>

          {/* ── XP bar ───────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-amber-600" />
                Experience
              </span>
              <span className="text-amber-500 font-mono tabular-nums">
                {player.current_xp.toLocaleString()} / {player.xp_to_next_level.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden relative">
              <div className="h-full rounded-full xp-bar-shimmer transition-all duration-1000"
                style={{ width: mounted ? `${xpPct}%` : '0%' }} />
              {[25, 50, 75].map(mark => (
                <div key={mark} className="absolute top-0 bottom-0 w-px bg-slate-900/60" style={{ left: `${mark}%` }} />
              ))}
            </div>
            <p className="text-xs text-slate-600">
              <span className="text-amber-700 font-bold">{(player.xp_to_next_level - player.current_xp).toLocaleString()}</span>
              {' '}XP to Level {player.level + 1}
            </p>
          </div>

          {/* ── Skill points alert ───────────────────────────────────────── */}
          {player.skill_points > 0 && (
            <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2.5 animate-scale-in">
              <Star className="w-4 h-4 text-amber-400 animate-pulse-glow-fast flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-amber-300 text-xs font-bold">
                  {player.skill_points} skill {player.skill_points === 1 ? 'point' : 'points'} available
                </p>
                <p className="text-amber-700 text-xs">Go to Skills tab to spend</p>
              </div>
            </div>
          )}

          {/* ── Reputation mini row ──────────────────────────────────────── */}
          {reputation && (() => {
            const tracks: { key: keyof PlayerReputation; label: string; color: string }[] = [
              { key: 'investor_rep', label: 'INV', color: REP_TRACK_META.investor.color },
              { key: 'owner_rep',    label: 'OWN', color: REP_TRACK_META.owner.color },
              { key: 'market_rep',   label: 'MKT', color: REP_TRACK_META.market.color },
              { key: 'operator_rep', label: 'OPS', color: REP_TRACK_META.operator.color },
            ];
            return (
              <div className="pt-1 border-t border-slate-800/60">
                <p className="text-xs text-slate-600 uppercase tracking-[0.2em] mb-2">Reputation</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {tracks.map(({ key, label, color }) => {
                    const score = (reputation[key] as number) ?? 0;
                    const rank = getRepRank(score);
                    return (
                      <div key={key} className="rounded-lg border p-2 text-center"
                        style={{ borderColor: color + '30', backgroundColor: color + '08' }}>
                        <p className="text-xs font-bold mb-0.5" style={{ color: color + 'aa' }}>{label}</p>
                        <RepRankBadge rank={rank} size="sm" />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Tab toggle: Vitals / Skills ──────────────────────────────── */}
          <div className="pt-1 border-t border-slate-800/60">
            <div className="flex rounded-xl overflow-hidden border border-slate-800 mb-3">
              {(['vitals', 'skills'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setVitalTab(tab)}
                  className="flex-1 py-2 text-xs font-bold transition-all"
                  style={{
                    backgroundColor: vitalTab === tab ? '#1e293b' : 'transparent',
                    color: vitalTab === tab ? '#f59e0b' : '#475569',
                  }}
                >
                  {tab === 'vitals' ? '⚡ Vitals' : '📊 Skills'}
                </button>
              ))}
            </div>

            {/* ── VITALS TAB ────────────────────────────────────────────── */}
            {vitalTab === 'vitals' && (
              <div className="space-y-3">
                {/* Vitality bars */}
                <div className="space-y-2.5">
                  {vitalBars.map(cfg => <VitalityBar key={cfg.label} cfg={cfg} />)}
                </div>

                {/* Action buttons */}
                {(onPerformAction || onRestoreEnergy) && (
                  <div className="pt-2 border-t border-slate-800/40">
                    <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Quick Actions</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      <ActionBtn
                        icon={Coffee}
                        label="Call"
                        cost="−8⚡"
                        color="#06b6d4"
                        onClick={() => onPerformAction?.('client_call')}
                        disabled={energy < 10}
                      />
                      <ActionBtn
                        icon={Activity}
                        label="Meeting"
                        cost="−12⚡"
                        color="#3b82f6"
                        onClick={() => onPerformAction?.('partner_meeting')}
                        disabled={energy < 14}
                      />
                      <ActionBtn
                        icon={Shield}
                        label="Visit"
                        cost="−15⚡"
                        color="#f59e0b"
                        onClick={() => onPerformAction?.('site_visit')}
                        disabled={energy < 17}
                      />
                      <ActionBtn
                        icon={Moon}
                        label="Rest"
                        cost="+25⚡"
                        color="#10b981"
                        onClick={() => onRestoreEnergy?.('rest')}
                      />
                      <ActionBtn
                        icon={Sun}
                        label="Routine"
                        cost="+20⚡"
                        color="#a855f7"
                        onClick={() => onRestoreEnergy?.('morning_routine')}
                      />
                    </div>

                    {/* Low energy warning */}
                    {energy <= 20 && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg px-2.5 py-1.5"
                        style={{ animation: 'rarePulse 1s ease-in-out infinite' }}>
                        <Zap className="w-3 h-3 flex-shrink-0" />
                        <span className="font-bold">Low energy — rest to recover</span>
                      </div>
                    )}
                    {stress >= 70 && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/20 border border-amber-900/30 rounded-lg px-2.5 py-1.5">
                        <Activity className="w-3 h-3 flex-shrink-0" />
                        <span className="font-bold">High stress — avoid trading</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── SKILLS TAB ────────────────────────────────────────────── */}
            {vitalTab === 'skills' && (
              <div className="space-y-2.5">
                {STAT_ORDER.map(stat => (
                  <StatBar key={stat} stat={stat} value={player[stat] as number} />
                ))}
              </div>
            )}
          </div>

          {/* ── Quick stats ──────────────────────────────────────────────── */}
          {stats && (
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/60">
              {[
                { label: 'Deals',      value: stats.deals_closed,        color: '#f59e0b' },
                { label: 'Properties', value: stats.properties_acquired, color: '#10b981' },
                { label: 'Streak',     value: player.no_trading_streak,  color: '#3b82f6' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className="font-black text-xl leading-none mb-0.5" style={{ color }}>
                    <AnimatedNumber value={value} />
                  </p>
                  <p className="text-slate-600 text-xs">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
