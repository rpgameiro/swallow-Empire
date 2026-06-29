import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Handshake, DollarSign, TrendingUp, Star, Crown, Zap, Shield,
  Clock, ChevronRight, X, AlertTriangle, Trophy, Flame,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DealTier = 'standard' | 'major' | 'legendary';

export interface CinematicDeal {
  id: string;
  tier: DealTier;
  dealName: string;
  districtName: string;
  accentColor: string;
  moneyEarned: number;
  reputationEarned: number;
  dominanceGained: number;
  xpEarned: number;
  // Cinematic flavour
  opponentName: string;       // who you're negotiating against
  opponentTitle: string;
  dealValue: number;          // total deal value (larger than money earned)
  negotiationRounds: NegotiationRound[];
}

export interface NegotiationRound {
  playerMove: string;         // what the player does
  opponentResponse: string;   // rival's counter
  advantage: 'player' | 'opponent' | 'neutral'; // who wins this round
  outcomeText: string;
}

interface Props {
  deal: CinematicDeal;
  onComplete: () => void;
  onAbort?: () => void;
}

// ─── Phase type ────────────────────────────────────────────────────────────

type Phase =
  | 'approach'      // dramatic full-screen reveal
  | 'briefing'      // deal details
  | 'negotiation'   // round-by-round back and forth
  | 'countdown'     // 5-second final countdown with tension
  | 'decision'      // player commits or walks
  | 'victory'       // reward celebration
  | 'legendary';    // epic legendary-only finale

// ─── Constants ────────────────────────────────────────────────────────────

const TIER_META: Record<DealTier, {
  label: string;
  color: string;
  glow: string;
  bg: string;
  particle: string;
}> = {
  standard: {
    label: 'DEAL CLOSED',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.4)',
    bg: 'rgba(120,53,15,0.15)',
    particle: '#f59e0b',
  },
  major: {
    label: 'MAJOR DEAL',
    color: '#f97316',
    glow: 'rgba(249,115,22,0.5)',
    bg: 'rgba(120,40,5,0.18)',
    particle: '#f97316',
  },
  legendary: {
    label: 'LEGENDARY DEAL',
    color: '#ef4444',
    glow: 'rgba(239,68,68,0.6)',
    bg: 'rgba(90,10,10,0.22)',
    particle: '#ef4444',
  },
};

// ─── Keyframe CSS ─────────────────────────────────────────────────────────

const STYLES = `
  @keyframes dealCinFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes dealCinFadeOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  @keyframes dealCinScaleIn {
    0%   { transform: scale(0.85) translateY(20px); opacity: 0; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes dealCinSlideUp {
    from { transform: translateY(32px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }
  @keyframes dealCinSlideLeft {
    from { transform: translateX(40px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  @keyframes dealCinSlideRight {
    from { transform: translateX(-40px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  @keyframes dealCinPulse {
    0%, 100% { opacity: 0.8; transform: scale(1); }
    50%       { opacity: 1;   transform: scale(1.03); }
  }
  @keyframes dealCinShake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-6px); }
    40%       { transform: translateX(5px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(3px); }
  }
  @keyframes dealCinGlowPulse {
    0%, 100% { box-shadow: 0 0 20px var(--deal-glow); }
    50%       { box-shadow: 0 0 50px var(--deal-glow), 0 0 80px var(--deal-glow-wide); }
  }
  @keyframes dealCinRipple {
    0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
    100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
  }
  @keyframes dealCinParticle {
    0%   { transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0); opacity: 1; }
    100% { transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-120px); opacity: 0; }
  }
  @keyframes dealCinCountdown {
    0%   { transform: scale(1.4); opacity: 0; }
    30%  { transform: scale(1);   opacity: 1; }
    80%  { transform: scale(1);   opacity: 1; }
    100% { transform: scale(0.8); opacity: 0; }
  }
  @keyframes dealCinChrono {
    from { stroke-dashoffset: 0; }
    to   { stroke-dashoffset: 283; }
  }
  @keyframes dealCinBarFill {
    from { width: 0%; }
    to   { width: 100%; }
  }
  @keyframes dealCinTextReveal {
    from { clip-path: inset(0 100% 0 0); opacity: 0.3; }
    to   { clip-path: inset(0 0% 0 0);   opacity: 1; }
  }
  @keyframes dealCinGoldSweep {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes dealCinVictoryExpand {
    0%   { transform: scale(0); opacity: 0; }
    60%  { transform: scale(1.08); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes dealCinLegendaryRing {
    0%   { transform: rotate(0deg) scale(1); }
    100% { transform: rotate(360deg) scale(1); }
  }
  @keyframes dealCinShimmer {
    0%, 100% { opacity: 0.3; }
    50%       { opacity: 0.9; }
  }
  @keyframes dealCinFloatReward {
    0%   { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-50px); opacity: 0; }
  }
`;

// ─── Particle burst ───────────────────────────────────────────────────────

function ParticleField({ color, count = 16 }: { color: string; count?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360;
        const delay = (i / count) * 0.4;
        const size = 3 + Math.random() * 4;
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: '50%', top: '50%',
              width: size, height: size,
              backgroundColor: color,
              '--angle': `${angle}deg`,
              animation: `dealCinParticle 1.2s ease-out ${delay}s both`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

// ─── Ripple circle ────────────────────────────────────────────────────────

function Ripple({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <div
      className="absolute rounded-full border-2 pointer-events-none"
      style={{
        left: '50%', top: '50%',
        width: 120, height: 120,
        borderColor: color + '60',
        animation: `dealCinRipple 1.4s ease-out ${delay}s both`,
      }}
    />
  );
}

// ─── Negotiation round card ───────────────────────────────────────────────

function NegotiationCard({
  round, index, revealed,
}: {
  round: NegotiationRound;
  index: number;
  revealed: boolean;
}) {
  const advantageColor: Record<string, string> = {
    player:   '#10b981',
    opponent: '#ef4444',
    neutral:  '#94a3b8',
  };
  const advantageLabel: Record<string, string> = {
    player:   'Advantage: YOU',
    opponent: 'Advantage: OPPONENT',
    neutral:  'Contested',
  };

  if (!revealed) return null;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: advantageColor[round.advantage] + '40',
        background: `linear-gradient(135deg, ${advantageColor[round.advantage]}08, rgba(2,6,23,0.9))`,
        animation: `dealCinSlideUp 0.4s ease-out ${index * 0.15}s both`,
      }}
    >
      {/* Advantage indicator */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${advantageColor[round.advantage]}, transparent)` }} />

      <div className="p-3 space-y-2">
        {/* Player move */}
        <div className="flex items-start gap-2.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black"
            style={{ backgroundColor: '#10b98125', border: '1px solid #10b98140', color: '#10b981' }}
          >
            Y
          </div>
          <div>
            <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Your Move</p>
            <p className="text-white text-xs font-semibold leading-snug">{round.playerMove}</p>
          </div>
        </div>

        {/* Opponent response */}
        <div className="flex items-start gap-2.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-black"
            style={{ backgroundColor: '#ef444425', border: '1px solid #ef444440', color: '#ef4444' }}
          >
            O
          </div>
          <div>
            <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">Counter</p>
            <p className="text-slate-300 text-xs font-semibold leading-snug">{round.opponentResponse}</p>
          </div>
        </div>

        {/* Outcome */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
          <p className="text-xs text-slate-500 italic">{round.outcomeText}</p>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              color: advantageColor[round.advantage],
              backgroundColor: advantageColor[round.advantage] + '18',
              border: `1px solid ${advantageColor[round.advantage]}35`,
            }}
          >
            {advantageLabel[round.advantage]}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export function DealCinematicSequence({ deal, onComplete, onAbort }: Props) {
  const meta = TIER_META[deal.tier];
  const isLegendary = deal.tier === 'legendary';
  const isMajorPlus = deal.tier === 'major' || deal.tier === 'legendary';

  const [phase, setPhase] = useState<Phase>('approach');
  const [revealedRounds, setRevealedRounds] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [countdownPhase, setCountdownPhase] = useState<'active' | 'done'>('active');
  const [victorySparks, setVictorySparks] = useState(false);
  const [exitPhase, setExitPhase] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const advance = useCallback((toPhase: Phase, delay = 0) => {
    setTimeout(() => {
      if (!mountedRef.current) return;
      setPhase(toPhase);
    }, delay);
  }, []);

  // Auto-advance approach phase after 2.5s
  useEffect(() => {
    if (phase === 'approach') {
      const t = setTimeout(() => setPhase('briefing'), 2500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Negotiation: reveal rounds one by one
  useEffect(() => {
    if (phase !== 'negotiation') return;
    if (revealedRounds >= deal.negotiationRounds.length) {
      const t = setTimeout(() => setPhase('countdown'), 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealedRounds(r => r + 1), 900);
    return () => clearTimeout(t);
  }, [phase, revealedRounds, deal.negotiationRounds.length]);

  // Countdown phase
  useEffect(() => {
    if (phase !== 'countdown') return;
    setCountdown(5);
    setCountdownPhase('active');
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          setCountdownPhase('done');
          setTimeout(() => setPhase('decision'), 600);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Victory / legendary phase
  useEffect(() => {
    if (phase === 'victory' || phase === 'legendary') {
      setTimeout(() => setVictorySparks(true), 300);
    }
  }, [phase]);

  // Progress bar for briefing
  useEffect(() => {
    if (phase === 'briefing') {
      const t = setTimeout(() => setBarWidth(100), 100);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const handleDecision = (accept: boolean) => {
    if (!accept && onAbort) { onAbort(); return; }
    setPhase(isLegendary ? 'legendary' : 'victory');
  };

  const handleDismiss = () => {
    setExitPhase(true);
    setTimeout(onComplete, 500);
  };

  // Countdown ring dimensions
  const R = 44;
  const CIRCUM = 2 * Math.PI * R;

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Full-screen backdrop ─────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{
          background: exitPhase
            ? 'transparent'
            : `radial-gradient(ellipse at 50% 40%, ${meta.bg} 0%, rgba(2,6,23,0.97) 70%)`,
          animation: exitPhase
            ? 'dealCinFadeOut 0.5s ease-out both'
            : 'dealCinFadeIn 0.4s ease-out both',
          '--deal-glow': meta.glow,
          '--deal-glow-wide': meta.glow.replace('0.4', '0.15').replace('0.5', '0.15').replace('0.6', '0.15'),
        } as React.CSSProperties}
      >
        {/* ── Ambient light streaks ──────────────────────────────────── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[20, 50, 80].map((pos, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px opacity-10"
              style={{
                left: `${pos}%`,
                background: `linear-gradient(180deg, transparent, ${meta.color}, transparent)`,
                animation: `dealCinShimmer ${3 + i}s ease-in-out ${i * 0.8}s infinite`,
              }}
            />
          ))}
          {/* Corner accents */}
          {[
            'top-0 left-0 border-t-2 border-l-2',
            'top-0 right-0 border-t-2 border-r-2',
            'bottom-0 left-0 border-b-2 border-l-2',
            'bottom-0 right-0 border-b-2 border-r-2',
          ].map((cls, i) => (
            <div
              key={i}
              className={`absolute w-8 h-8 ${cls}`}
              style={{
                borderColor: meta.color + '40',
                animation: `dealCinFadeIn 0.6s ease-out ${0.2 + i * 0.08}s both`,
              }}
            />
          ))}
        </div>

        {/* ── PHASE: Approach ──────────────────────────────────────────── */}
        {phase === 'approach' && (
          <div className="flex flex-col items-center gap-6 text-center px-8 max-w-lg"
            style={{ animation: 'dealCinScaleIn 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>

            {/* Tier badge */}
            <div
              className="relative inline-flex flex-col items-center justify-center"
              style={{ '--deal-glow': meta.glow } as React.CSSProperties}
            >
              <div
                className="absolute inset-[-20px] rounded-full"
                style={{
                  background: `radial-gradient(circle, ${meta.color}20, transparent 70%)`,
                  animation: 'dealCinGlowPulse 1.5s ease-in-out infinite',
                }}
              />
              <Ripple color={meta.color} delay={0.3} />
              <Ripple color={meta.color} delay={0.7} />
              <div
                className="relative w-28 h-28 rounded-full flex items-center justify-center"
                style={{
                  background: `radial-gradient(circle, ${meta.color}25, ${meta.color}08)`,
                  border: `2px solid ${meta.color}60`,
                  boxShadow: `0 0 40px ${meta.glow}`,
                }}
              >
                {isLegendary
                  ? <Crown className="w-14 h-14" style={{ color: meta.color }} />
                  : isMajorPlus
                    ? <Trophy className="w-12 h-12" style={{ color: meta.color }} />
                    : <Handshake className="w-12 h-12" style={{ color: meta.color }} />
                }
              </div>
            </div>

            <div className="space-y-2">
              <p
                className="text-xs font-black tracking-[0.4em] uppercase"
                style={{ color: meta.color + 'aa', animation: 'dealCinFadeIn 0.5s ease-out 0.3s both', opacity: 0 }}
              >
                {meta.label}
              </p>
              <h1
                className="font-black text-white leading-tight"
                style={{
                  fontSize: isLegendary ? '2rem' : '1.6rem',
                  animation: 'dealCinSlideUp 0.6s ease-out 0.5s both',
                  opacity: 0,
                  background: isLegendary
                    ? `linear-gradient(135deg, #fff 30%, ${meta.color}, #fff 70%)`
                    : undefined,
                  WebkitBackgroundClip: isLegendary ? 'text' : undefined,
                  WebkitTextFillColor: isLegendary ? 'transparent' : undefined,
                  backgroundClip: isLegendary ? 'text' : undefined,
                }}
              >
                {deal.dealName}
              </h1>
              <p
                className="text-slate-400 text-sm"
                style={{ animation: 'dealCinFadeIn 0.5s ease-out 0.8s both', opacity: 0 }}
              >
                {deal.districtName} · €{deal.dealValue.toLocaleString()} Transaction
              </p>
            </div>

            {/* Pulse bar */}
            <div
              className="w-48 h-0.5 rounded-full overflow-hidden"
              style={{ backgroundColor: meta.color + '25', animation: 'dealCinFadeIn 0.5s ease-out 1s both', opacity: 0 }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: '40%',
                  backgroundColor: meta.color,
                  animation: 'dealCinPulse 0.8s ease-in-out infinite',
                }}
              />
            </div>

            <p
              className="text-slate-600 text-xs tracking-widest uppercase"
              style={{ animation: 'dealCinFadeIn 0.5s ease-out 1.2s both', opacity: 0 }}
            >
              Negotiation beginning...
            </p>
          </div>
        )}

        {/* ── PHASE: Briefing ───────────────────────────────────────────── */}
        {phase === 'briefing' && (
          <div
            className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden"
            style={{
              border: `1px solid ${meta.color}35`,
              background: 'linear-gradient(160deg, rgba(2,6,23,0.98), rgba(15,23,42,0.95))',
              boxShadow: `0 0 60px ${meta.glow}, 0 40px 80px rgba(0,0,0,0.6)`,
              animation: 'dealCinScaleIn 0.5s cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            {/* Top bar */}
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: meta.color + 'aa' }}>
                    {meta.label} · {deal.districtName}
                  </p>
                  <h2 className="text-white font-black text-xl leading-tight">{deal.dealName}</h2>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: meta.color + '15', border: `1px solid ${meta.color}35` }}
                >
                  <Handshake className="w-6 h-6" style={{ color: meta.color }} />
                </div>
              </div>

              {/* Deal metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { icon: DollarSign, label: 'Advisory Fee', value: `€${deal.moneyEarned.toLocaleString()}`, color: '#10b981' },
                  { icon: TrendingUp, label: 'Deal Value',   value: `€${deal.dealValue.toLocaleString()}`,   color: meta.color },
                  { icon: Star,        label: 'Reputation',  value: `+${deal.reputationEarned}`,             color: '#f59e0b' },
                  { icon: Zap,         label: 'XP Earned',   value: `+${deal.xpEarned.toLocaleString()}`,    color: '#3b82f6' },
                ].map(({ icon: Icon, label, value, color }, i) => (
                  <div
                    key={label}
                    className="rounded-xl p-3 text-center border"
                    style={{
                      borderColor: color + '25',
                      backgroundColor: color + '08',
                      animation: `dealCinSlideUp 0.4s ease-out ${0.1 + i * 0.08}s both`,
                      opacity: 0,
                    }}
                  >
                    <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="font-black text-sm" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Opponent intel */}
              <div
                className="flex items-center gap-3 rounded-xl border p-3 mb-5"
                style={{
                  borderColor: '#ef444430',
                  backgroundColor: '#ef444408',
                  animation: 'dealCinSlideUp 0.4s ease-out 0.4s both',
                  opacity: 0,
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black"
                  style={{ backgroundColor: '#ef444420', border: '1px solid #ef444440', color: '#ef4444' }}
                >
                  {deal.opponentName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="text-xs font-black text-red-400">{deal.opponentName}</p>
                  <p className="text-[11px] text-slate-500">{deal.opponentTitle}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  <span className="text-[10px] text-red-500 font-bold uppercase tracking-wide">Competing for this deal</span>
                </div>
              </div>

              {/* Progress bar before negotiation */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-slate-600 uppercase tracking-wider">
                  <span>Entering negotiation room</span>
                  <span>Standby</span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: meta.color,
                      width: `${barWidth}%`,
                      transition: 'width 1.8s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Proceed button */}
            <div className="px-6 pb-6">
              <button
                onClick={() => { setRevealedRounds(0); setPhase('negotiation'); }}
                className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
                  boxShadow: `0 4px 20px ${meta.glow}`,
                  animation: 'dealCinSlideUp 0.4s ease-out 0.6s both',
                  opacity: 0,
                }}
              >
                Enter Negotiations
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── PHASE: Negotiation ────────────────────────────────────────── */}
        {phase === 'negotiation' && (
          <div
            className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden"
            style={{
              border: `1px solid ${meta.color}35`,
              background: 'linear-gradient(160deg, rgba(2,6,23,0.98), rgba(15,23,42,0.95))',
              boxShadow: `0 0 60px ${meta.glow}, 0 40px 80px rgba(0,0,0,0.6)`,
              animation: 'dealCinScaleIn 0.4s cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />

            <div className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: meta.color + '20', border: `1px solid ${meta.color}40` }}
                >
                  <Handshake className="w-3.5 h-3.5" style={{ color: meta.color }} />
                </div>
                <div>
                  <p className="font-black text-white text-sm">Negotiation Room</p>
                  <p className="text-[10px] text-slate-500">vs. {deal.opponentName}</p>
                </div>
                <div className="ml-auto text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  Round {Math.min(revealedRounds, deal.negotiationRounds.length)} / {deal.negotiationRounds.length}
                </div>
              </div>

              {/* Round progress dots */}
              <div className="flex gap-1.5 mb-4">
                {deal.negotiationRounds.map((round, i) => (
                  <div
                    key={i}
                    className="flex-1 h-1 rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: i < revealedRounds
                        ? (round.advantage === 'player' ? '#10b981' : round.advantage === 'opponent' ? '#ef4444' : '#94a3b8')
                        : '#1e293b',
                    }}
                  />
                ))}
              </div>

              {/* Round cards */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: `${meta.color}30 transparent` }}>
                {deal.negotiationRounds.map((round, i) => (
                  <NegotiationCard key={i} round={round} index={i} revealed={i < revealedRounds} />
                ))}
                {revealedRounds < deal.negotiationRounds.length && (
                  <div className="text-center py-3">
                    <div
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600"
                      style={{ animation: 'dealCinPulse 0.8s ease-in-out infinite' }}
                    >
                      <div className="w-1 h-1 rounded-full bg-slate-600" />
                      <div className="w-1 h-1 rounded-full bg-slate-600" style={{ animationDelay: '0.2s' }} />
                      <div className="w-1 h-1 rounded-full bg-slate-600" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Score summary when all revealed */}
              {revealedRounds >= deal.negotiationRounds.length && (
                <div
                  className="mt-4 flex items-center justify-between rounded-xl border p-3"
                  style={{
                    borderColor: '#10b98130',
                    backgroundColor: '#10b98108',
                    animation: 'dealCinSlideUp 0.4s ease-out both',
                  }}
                >
                  <div className="text-center">
                    <p className="text-2xl font-black text-emerald-400">
                      {deal.negotiationRounds.filter(r => r.advantage === 'player').length}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Your Wins</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-slate-500 animate-pulse">Finalising...</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-red-400">
                      {deal.negotiationRounds.filter(r => r.advantage === 'opponent').length}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Opponent</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PHASE: Countdown ──────────────────────────────────────────── */}
        {phase === 'countdown' && (
          <div
            className="flex flex-col items-center gap-6 text-center"
            style={{ animation: 'dealCinScaleIn 0.4s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            <p
              className="text-xs font-black uppercase tracking-[0.4em]"
              style={{ color: meta.color + 'aa' }}
            >
              Final Decision Required
            </p>

            {/* Circular countdown */}
            <div className="relative w-40 h-40">
              {/* Ripples */}
              {countdown <= 2 && <Ripple color={meta.color} />}

              {/* SVG ring */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={R} fill="none" stroke={meta.color + '15'} strokeWidth="4" />
                <circle
                  cx="50" cy="50" r={R}
                  fill="none"
                  stroke={meta.color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUM}
                  transform="rotate(-90 50 50)"
                  style={{
                    animation: `dealCinChrono ${5}s linear both`,
                    filter: `drop-shadow(0 0 4px ${meta.color})`,
                  }}
                />
              </svg>

              {/* Number */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  key={countdown}
                  className="font-black"
                  style={{
                    fontSize: '3.5rem',
                    color: countdown <= 2 ? '#ef4444' : meta.color,
                    animation: 'dealCinCountdown 1s ease-out both',
                    textShadow: `0 0 20px ${countdown <= 2 ? '#ef444480' : meta.glow}`,
                  }}
                >
                  {countdownPhase === 'done' ? '!' : countdown}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <p
                className="text-white font-black text-lg"
                style={{ animation: 'dealCinPulse 0.6s ease-in-out infinite' }}
              >
                {deal.dealName}
              </p>
              <p className="text-slate-500 text-sm">
                {countdown <= 2 ? 'Last chance — act now!' : 'Opportunity closing soon...'}
              </p>
            </div>

            {countdown <= 2 && (
              <div
                className="flex items-center gap-2 text-red-400 text-xs font-black uppercase tracking-widest"
                style={{ animation: 'dealCinPulse 0.4s ease-in-out infinite' }}
              >
                <Flame className="w-4 h-4" />
                <span>Opponent Moving In</span>
                <Flame className="w-4 h-4" />
              </div>
            )}
          </div>
        )}

        {/* ── PHASE: Decision ───────────────────────────────────────────── */}
        {phase === 'decision' && (
          <div
            className="w-full max-w-md mx-4 rounded-2xl overflow-hidden"
            style={{
              border: `1px solid ${meta.color}45`,
              background: 'linear-gradient(160deg, rgba(2,6,23,0.99), rgba(15,23,42,0.96))',
              boxShadow: `0 0 80px ${meta.glow}, 0 40px 80px rgba(0,0,0,0.7)`,
              animation: 'dealCinScaleIn 0.4s cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }} />

            <div className="p-6 space-y-5">
              {/* Title */}
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: meta.color + 'aa' }}>
                  Moment of Truth
                </p>
                <h2 className="text-white font-black text-lg">{deal.dealName}</h2>
                <p className="text-slate-400 text-sm">{deal.districtName}</p>
              </div>

              {/* Final rewards recap */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Advisory Fee', value: `€${deal.moneyEarned.toLocaleString()}`, color: '#10b981' },
                  { label: 'Reputation',   value: `+${deal.reputationEarned}`,             color: '#f59e0b' },
                  { label: 'Dominance',    value: `+${deal.dominanceGained}%`,             color: meta.color },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl p-2.5 text-center border"
                    style={{ borderColor: color + '25', backgroundColor: color + '08' }}
                  >
                    <p className="text-[10px] text-slate-600 mb-0.5">{label}</p>
                    <p className="font-black text-xs" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Decision buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={() => handleDecision(true)}
                  className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all active:scale-95 hover:brightness-110 flex items-center justify-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${meta.color}ee, ${meta.color}99)`,
                    boxShadow: `0 4px 24px ${meta.glow}, 0 0 40px ${meta.glow}`,
                    animation: 'dealCinSlideUp 0.4s ease-out 0.1s both',
                    opacity: 0,
                  }}
                >
                  {isLegendary ? <Crown className="w-5 h-5" /> : <Handshake className="w-4 h-4" />}
                  {isLegendary ? 'Seal the Legendary Deal' : 'Close the Deal'}
                </button>

                {onAbort && (
                  <button
                    onClick={() => handleDecision(false)}
                    className="w-full py-2.5 rounded-xl text-xs text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-all"
                    style={{ animation: 'dealCinSlideUp 0.4s ease-out 0.2s both', opacity: 0 }}
                  >
                    Walk Away
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PHASE: Victory ────────────────────────────────────────────── */}
        {(phase === 'victory') && (
          <div
            className="flex flex-col items-center gap-6 text-center max-w-sm px-6"
            style={{ animation: 'dealCinScaleIn 0.5s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            {/* Victory icon with particles */}
            <div className="relative">
              {victorySparks && <ParticleField color={meta.color} count={20} />}
              <div
                className="relative w-24 h-24 rounded-full flex items-center justify-center"
                style={{
                  background: `radial-gradient(circle, ${meta.color}30, ${meta.color}08)`,
                  border: `2px solid ${meta.color}50`,
                  animation: 'dealCinVictoryExpand 0.6s cubic-bezier(0.22,1,0.36,1) both',
                  boxShadow: `0 0 40px ${meta.glow}`,
                }}
              >
                <Trophy className="w-12 h-12" style={{ color: meta.color }} />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-black tracking-[0.4em] uppercase" style={{ color: meta.color + 'aa' }}>
                Deal Sealed
              </p>
              <h1 className="text-white font-black text-2xl leading-tight">{deal.dealName}</h1>
              <p className="text-slate-400 text-sm">{deal.districtName}</p>
            </div>

            {/* Rewards */}
            <div className="w-full grid grid-cols-2 gap-2">
              {[
                { icon: DollarSign, label: 'Advisory Fee', value: `+€${deal.moneyEarned.toLocaleString()}`, color: '#10b981', delay: '0.1s' },
                { icon: Star,        label: 'Reputation',  value: `+${deal.reputationEarned}`,             color: '#f59e0b', delay: '0.2s' },
                { icon: TrendingUp,  label: 'Dominance',   value: `+${deal.dominanceGained}%`,             color: meta.color, delay: '0.3s' },
                { icon: Zap,         label: 'XP',          value: `+${deal.xpEarned.toLocaleString()}`,    color: '#3b82f6', delay: '0.4s' },
              ].map(({ icon: Icon, label, value, color, delay }) => (
                <div
                  key={label}
                  className="rounded-xl border p-3 text-center"
                  style={{
                    borderColor: color + '30',
                    backgroundColor: color + '0a',
                    animation: `dealCinSlideUp 0.4s ease-out ${delay} both`,
                    opacity: 0,
                  }}
                >
                  <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
                  <p className="font-black text-sm" style={{ color }}>{value}</p>
                  <p className="text-[10px] text-slate-600">{label}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleDismiss}
              className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all active:scale-95 hover:brightness-110 flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color}77)`,
                boxShadow: `0 4px 20px ${meta.glow}`,
                animation: 'dealCinSlideUp 0.4s ease-out 0.5s both',
                opacity: 0,
              }}
            >
              <ChevronRight className="w-4 h-4" />
              Continue
            </button>
          </div>
        )}

        {/* ── PHASE: Legendary ──────────────────────────────────────────── */}
        {phase === 'legendary' && (
          <div
            className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden"
            style={{
              border: `2px solid ${meta.color}60`,
              background: 'linear-gradient(160deg, rgba(8,2,2,0.99), rgba(20,6,6,0.97))',
              boxShadow: `0 0 100px ${meta.glow}, 0 0 200px ${meta.glow}40, 0 40px 80px rgba(0,0,0,0.8)`,
              animation: 'dealCinScaleIn 0.6s cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            <div
              className="h-1"
              style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, #fff, ${meta.color}, transparent)` }}
            />

            <div className="p-8">
              {/* Legendary crown + ring */}
              <div className="relative flex justify-center mb-6">
                {victorySparks && <ParticleField color={meta.color} count={32} />}
                {victorySparks && <ParticleField color="#fff" count={12} />}

                {/* Outer rotating ring */}
                <div
                  className="absolute w-40 h-40 rounded-full"
                  style={{
                    border: `1px solid ${meta.color}30`,
                    background: `conic-gradient(from 0deg, transparent, ${meta.color}20, transparent, ${meta.color}15, transparent)`,
                    animation: 'dealCinLegendaryRing 4s linear infinite',
                  }}
                />
                <div
                  className="absolute w-28 h-28 rounded-full"
                  style={{
                    border: `1px solid ${meta.color}50`,
                    background: `conic-gradient(from 180deg, transparent, ${meta.color}30, transparent)`,
                    animation: 'dealCinLegendaryRing 2.5s linear infinite reverse',
                  }}
                />

                <div
                  className="relative w-24 h-24 rounded-full flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle, ${meta.color}40, ${meta.color}10)`,
                    border: `2px solid ${meta.color}70`,
                    boxShadow: `0 0 60px ${meta.glow}, inset 0 0 30px ${meta.color}20`,
                    animation: 'dealCinVictoryExpand 0.7s cubic-bezier(0.22,1,0.36,1) both',
                  }}
                >
                  <Crown className="w-12 h-12" style={{ color: meta.color, filter: `drop-shadow(0 0 12px ${meta.color})` }} />
                </div>
              </div>

              {/* Title */}
              <div className="text-center mb-6 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${meta.color}40)` }} />
                  <p
                    className="text-xs font-black tracking-[0.5em] uppercase px-4"
                    style={{ color: meta.color }}
                  >
                    LEGENDARY DEAL CLOSED
                  </p>
                  <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${meta.color}40, transparent)` }} />
                </div>
                <h1
                  className="font-black leading-tight"
                  style={{
                    fontSize: '1.9rem',
                    background: `linear-gradient(135deg, #fff 20%, ${meta.color} 50%, #fff 80%)`,
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    animation: 'dealCinGoldSweep 3s linear infinite',
                  }}
                >
                  {deal.dealName}
                </h1>
                <p className="text-slate-400">{deal.districtName} · €{deal.dealValue.toLocaleString()} Transaction</p>
              </div>

              {/* Epic rewards */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { icon: DollarSign, label: 'Advisory Fee', value: `€${deal.moneyEarned.toLocaleString()}`, color: '#10b981', delay: '0.15s' },
                  { icon: Star,        label: 'Reputation',  value: `+${deal.reputationEarned}`,             color: '#f59e0b', delay: '0.25s' },
                  { icon: TrendingUp,  label: 'Dominance',   value: `+${deal.dominanceGained}%`,             color: meta.color, delay: '0.35s' },
                  { icon: Zap,         label: 'XP',          value: `+${deal.xpEarned.toLocaleString()}`,    color: '#3b82f6', delay: '0.45s' },
                ].map(({ icon: Icon, label, value, color, delay }) => (
                  <div
                    key={label}
                    className="rounded-xl border p-3 text-center relative overflow-hidden"
                    style={{
                      borderColor: color + '40',
                      background: `linear-gradient(160deg, ${color}12, ${color}04)`,
                      animation: `dealCinSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) ${delay} both`,
                      opacity: 0,
                      boxShadow: `0 0 15px ${color}20`,
                    }}
                  >
                    {/* Shimmer overlay */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `linear-gradient(135deg, transparent 40%, ${color}08 50%, transparent 60%)`,
                        animation: 'dealCinGoldSweep 2s linear infinite',
                        backgroundSize: '200% auto',
                      }}
                    />
                    <Icon className="w-5 h-5 mx-auto mb-1.5" style={{ color, filter: `drop-shadow(0 0 4px ${color}80)` }} />
                    <p className="font-black text-sm leading-none" style={{ color }}>{value}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Achievement-style unlock banner */}
              <div
                className="flex items-center gap-3 rounded-xl border p-3.5 mb-5"
                style={{
                  borderColor: meta.color + '40',
                  background: `linear-gradient(135deg, ${meta.color}12, ${meta.color}04)`,
                  animation: 'dealCinSlideUp 0.4s ease-out 0.6s both',
                  opacity: 0,
                }}
              >
                <Shield className="w-5 h-5 flex-shrink-0" style={{ color: meta.color }} />
                <div>
                  <p className="text-xs font-black" style={{ color: meta.color }}>Empire Milestone Unlocked</p>
                  <p className="text-[11px] text-slate-500">Your legend grows across Portugal. This deal will be remembered.</p>
                </div>
              </div>

              {/* Continue */}
              <button
                onClick={handleDismiss}
                className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all active:scale-95 hover:brightness-110 flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
                  boxShadow: `0 4px 30px ${meta.glow}, 0 0 60px ${meta.glow}60`,
                  animation: 'dealCinSlideUp 0.4s ease-out 0.75s both',
                  opacity: 0,
                }}
              >
                <Crown className="w-4 h-4" />
                Claim Your Victory
              </button>
            </div>
          </div>
        )}

        {/* ── Escape hint ────────────────────────────────────────────────── */}
        {phase !== 'approach' && phase !== 'countdown' && phase !== 'victory' && phase !== 'legendary' && (
          <button
            onClick={onAbort ?? handleDismiss}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full border border-slate-700 text-slate-600 hover:text-slate-400 hover:border-slate-500 transition-all"
            style={{ animation: 'dealCinFadeIn 0.4s ease-out 1s both', opacity: 0 }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </>
  );
}
