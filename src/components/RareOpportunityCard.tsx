import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2, Briefcase, Globe, Crown, Star, BarChart2, Gem, Award, Trophy,
  Clock, Zap, TrendingUp, CheckCircle2, XCircle, AlertTriangle, Lock,
} from 'lucide-react';
import { ActiveRareOpportunity, RareTier, PlayerReputation } from '../types/game';

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Building2, Briefcase, Globe, Crown, Star, BarChart2, Gem, Award, Trophy, Zap,
};

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<RareTier, {
  label: string;
  labelColor: string;
  particleCount: number;
  ringPulse: boolean;
  scanlines: boolean;
  cornerFlares: boolean;
  titleGlow: boolean;
}> = {
  rare: {
    label: 'RARE',
    labelColor: '#10b981',
    particleCount: 8,
    ringPulse: false,
    scanlines: false,
    cornerFlares: false,
    titleGlow: false,
  },
  epic: {
    label: 'EPIC',
    labelColor: '#f97316',
    particleCount: 16,
    ringPulse: true,
    scanlines: false,
    cornerFlares: true,
    titleGlow: false,
  },
  legendary: {
    label: 'LEGENDARY',
    labelColor: '#ef4444',
    particleCount: 30,
    ringPulse: true,
    scanlines: true,
    cornerFlares: true,
    titleGlow: true,
  },
};

// ─── Particle system ──────────────────────────────────────────────────────────

function Particles({ count, color }: { count: number; color: string }) {
  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 360 + Math.random() * 20;
    const dist = 60 + Math.random() * 80;
    const size = 2 + Math.random() * 3;
    const duration = 2.5 + Math.random() * 2;
    const delay = Math.random() * 2;
    const tx = Math.cos((angle * Math.PI) / 180) * dist;
    const ty = Math.sin((angle * Math.PI) / 180) * dist;
    return { tx, ty, size, duration, delay, opacity: 0.4 + Math.random() * 0.6 };
  });

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: color,
            animation: `rareParticleFloat ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Corner flare ─────────────────────────────────────────────────────────────

function CornerFlares({ color }: { color: string }) {
  return (
    <>
      {[
        'top-0 left-0 origin-top-left',
        'top-0 right-0 origin-top-right rotate-90',
        'bottom-0 right-0 origin-bottom-right rotate-180',
        'bottom-0 left-0 origin-bottom-left -rotate-90',
      ].map((pos, i) => (
        <div
          key={i}
          className={`absolute w-8 h-8 pointer-events-none ${pos}`}
          style={{ animation: `rareCornerPulse 2s ease-in-out ${i * 0.4}s infinite alternate` }}
        >
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M0 0 L12 0 L0 12 Z" fill={color} opacity="0.7" />
          </svg>
        </div>
      ))}
    </>
  );
}

// ─── Animated countdown ring ──────────────────────────────────────────────────

function CountdownRing({
  seconds,
  totalSeconds,
  color,
  size = 56,
}: {
  seconds: number;
  totalSeconds: number;
  color: string;
  size?: number;
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, seconds / totalSeconds);
  const urgency = pct < 0.3;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={4} />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={urgency ? '#ef4444' : color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-xs font-black tabular-nums leading-none"
          style={{ color: urgency ? '#ef4444' : color, animation: urgency ? 'rarePulse 0.8s ease-in-out infinite' : undefined }}
        >
          {seconds}
        </span>
        <span className="text-[8px] text-slate-600 leading-none mt-0.5">SEC</span>
      </div>
    </div>
  );
}

// ─── Reward pills ─────────────────────────────────────────────────────────────

function RewardPills({ reward, color }: { reward: ActiveRareOpportunity['reward']; color: string }) {
  const pills = [];
  if (reward.money) pills.push({ label: `+€${reward.money.toLocaleString()}`, icon: '€' });
  if (reward.xp) pills.push({ label: `+${reward.xp.toLocaleString()} XP`, icon: '⚡' });
  if (reward.reputation) pills.push({ label: `+${reward.reputation} REP`, icon: '⭐' });
  if (reward.market_share_delta) pills.push({ label: `+${Math.round(reward.market_share_delta * 100)}% Territory`, icon: '📍' });
  const totalRep = Object.values(reward.rep_delta).reduce((a, b) => a + (b ?? 0), 0);
  if (totalRep > 0) pills.push({ label: `+${totalRep} Track REP`, icon: '🏆' });

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((p, i) => (
        <span
          key={i}
          className="text-xs font-black px-2.5 py-1 rounded-lg"
          style={{
            color,
            backgroundColor: color + '18',
            border: `1px solid ${color}35`,
            boxShadow: `0 0 8px ${color}20`,
          }}
        >
          {p.label}
        </span>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RareOpportunityCardProps {
  opportunity: ActiveRareOpportunity;
  playerLevel: number;
  playerReputation: PlayerReputation | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

export const RareOpportunityCard = ({
  opportunity,
  playerLevel,
  playerReputation,
  onAccept,
  onDecline,
}: RareOpportunityCardProps) => {
  const [secondsLeft, setSecondsLeft] = useState(opportunity.timerSeconds);
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit' | 'expired'>('enter');
  const [resolved, setResolved] = useState<'accepted' | 'declined' | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const { accentColor, glowColor, tier } = opportunity;
  const cfg = TIER_CONFIG[tier];
  const Icon = ICON_MAP[opportunity.icon] ?? Star;

  const canAccept = useCallback(() => {
    if (playerLevel < opportunity.requiresLevel) return false;
    if (opportunity.requiresRepTrack && playerReputation) {
      const score = playerReputation[`${opportunity.requiresRepTrack.track}_rep` as keyof PlayerReputation] as number;
      if (score < opportunity.requiresRepTrack.minScore) return false;
    }
    return true;
  }, [playerLevel, playerReputation, opportunity]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 80);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          setPhase('expired');
          setTimeout(() => onDecline(opportunity.id), 1200);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { clearTimeout(t1); clearInterval(timerRef.current); };
  }, [opportunity.id, onDecline]);

  const handleAccept = () => {
    if (!canAccept()) return;
    clearInterval(timerRef.current);
    setResolved('accepted');
    setTimeout(() => {
      setPhase('exit');
      setTimeout(() => onAccept(opportunity.id), 500);
    }, 800);
  };

  const handleDecline = () => {
    clearInterval(timerRef.current);
    setResolved('declined');
    setTimeout(() => {
      setPhase('exit');
      setTimeout(() => onDecline(opportunity.id), 500);
    }, 600);
  };

  const eligible = canAccept();
  const urgency = secondsLeft <= Math.floor(opportunity.timerSeconds * 0.3);

  return (
    <>
      <style>{`
        @keyframes rareSlideIn {
          from { transform: translateY(-32px) scale(0.94); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes rareSlideOut {
          from { transform: translateY(0) scale(1); opacity: 1; }
          to   { transform: translateY(-24px) scale(0.96); opacity: 0; }
        }
        @keyframes rareParticleFloat {
          from { transform: translate(0, 0) scale(0.6); opacity: 0; }
          to   { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 1; }
        }
        @keyframes rareCornerPulse {
          from { opacity: 0.3; transform: scale(0.9); }
          to   { opacity: 1; transform: scale(1.1); }
        }
        @keyframes rarePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.1); }
        }
        @keyframes rareScanline {
          from { background-position: 0 0; }
          to   { background-position: 0 100px; }
        }
        @keyframes rareTitleGlow {
          0%, 100% { text-shadow: 0 0 10px var(--glow), 0 0 20px var(--glow); }
          50%       { text-shadow: 0 0 20px var(--glow), 0 0 40px var(--glow), 0 0 60px var(--glow); }
        }
        @keyframes rareRingPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--ring-color), 0 0 0 0 var(--ring-color); }
          50%       { box-shadow: 0 0 0 8px transparent, 0 0 0 16px transparent; }
        }
        @keyframes rareResultPop {
          0%   { transform: scale(0.8); opacity: 0; }
          60%  { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes rareExpiredShake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-4px); }
          40%       { transform: translateX(4px); }
          60%       { transform: translateX(-3px); }
          80%       { transform: translateX(3px); }
        }
        @keyframes rareBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes legendaryOrbFloat {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          33%       { transform: translate(-48%, -52%) scale(1.06); }
          66%       { transform: translate(-52%, -48%) scale(0.95); }
        }
      `}</style>

      {/* Full-screen backdrop */}
      <div
        className="fixed inset-0 z-[90] flex items-start justify-center pt-16 px-4"
        style={{ animation: 'rareBackdropIn 0.4s ease both' }}
      >
        {/* Semi-transparent overlay */}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 50% 20%, ${glowColor} 0%, rgba(2,6,23,0.88) 55%)` }}
        />

        {/* Legendary background orbs */}
        {tier === 'legendary' && (
          <>
            {[
              { x: '20%', y: '30%', size: 500, delay: 0 },
              { x: '80%', y: '20%', size: 400, delay: 1.5 },
              { x: '50%', y: '70%', size: 600, delay: 0.8 },
            ].map((orb, i) => (
              <div
                key={i}
                className="absolute pointer-events-none rounded-full"
                style={{
                  width: orb.size,
                  height: orb.size,
                  left: orb.x,
                  top: orb.y,
                  backgroundColor: accentColor + '12',
                  filter: 'blur(60px)',
                  animation: `legendaryOrbFloat ${6 + i}s ease-in-out ${orb.delay}s infinite`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </>
        )}

        {/* Card */}
        <div
          className="relative z-10 w-full max-w-md overflow-visible"
          style={{
            animation: phase === 'exit' || phase === 'expired'
              ? 'rareSlideOut 0.5s cubic-bezier(0.4,0,1,1) both'
              : phase === 'show'
              ? 'rareSlideIn 0.5s cubic-bezier(0.22,1,0.36,1) both'
              : undefined,
          }}
        >
          {/* Particle aura */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Particles count={cfg.particleCount} color={accentColor} />
          </div>

          {/* Main card */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              border: `1.5px solid ${accentColor}50`,
              boxShadow: [
                `0 0 0 1px ${accentColor}20`,
                `0 0 40px ${glowColor}`,
                `0 0 80px ${glowColor.replace('0.', '0.2')}`,
                '0 24px 60px rgba(0,0,0,0.8)',
              ].join(', '),
              '--ring-color': glowColor,
              '--glow': accentColor,
            } as React.CSSProperties}
          >
            {/* Scanlines overlay for legendary */}
            {cfg.scanlines && (
              <div
                className="absolute inset-0 pointer-events-none z-20 opacity-[0.03]"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)',
                  animation: 'rareScanline 4s linear infinite',
                }}
              />
            )}

            {/* Corner flares */}
            {cfg.cornerFlares && <CornerFlares color={accentColor} />}

            {/* Top gradient accent bar */}
            <div
              className="h-1 w-full"
              style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, ${accentColor}, transparent)` }}
            />

            {/* Background gradient */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${accentColor}18 0%, rgba(2,6,23,0.97) 70%)` }}
            />

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="relative p-5 pb-3">
              <div className="flex items-start gap-4">
                {/* Icon with ring pulse */}
                <div className="relative flex-shrink-0">
                  {cfg.ringPulse && (
                    <div
                      className="absolute inset-0 rounded-xl pointer-events-none"
                      style={{
                        animation: 'rareRingPulse 2s ease-in-out infinite',
                        '--ring-color': `${accentColor}40`,
                      } as React.CSSProperties}
                    />
                  )}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center relative"
                    style={{
                      backgroundColor: accentColor + '20',
                      border: `2px solid ${accentColor}50`,
                      boxShadow: `0 0 20px ${accentColor}40, inset 0 0 12px ${accentColor}10`,
                    }}
                  >
                    <Icon className="w-7 h-7" style={{ color: accentColor }} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Tier badge */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[10px] font-black tracking-[0.2em] px-2.5 py-0.5 rounded-full"
                      style={{
                        color: cfg.labelColor,
                        backgroundColor: cfg.labelColor + '20',
                        border: `1px solid ${cfg.labelColor}40`,
                        boxShadow: `0 0 10px ${cfg.labelColor}30`,
                      }}
                    >
                      {cfg.label}
                    </span>
                    {opportunity.districtName && (
                      <span className="text-[10px] text-slate-600 font-bold">{opportunity.districtName}</span>
                    )}
                  </div>

                  {/* Title */}
                  <h2
                    className="text-xl font-black text-white leading-tight"
                    style={cfg.titleGlow ? {
                      animation: 'rareTitleGlow 2.5s ease-in-out infinite',
                      '--glow': accentColor + '80',
                    } as React.CSSProperties : undefined}
                  >
                    {opportunity.title}
                  </h2>
                  <p className="text-xs mt-0.5 font-bold" style={{ color: accentColor + 'cc' }}>
                    {opportunity.subtitle}
                  </p>
                </div>

                {/* Countdown ring */}
                <CountdownRing
                  seconds={secondsLeft}
                  totalSeconds={opportunity.timerSeconds}
                  color={accentColor}
                  size={52}
                />
              </div>

              {/* Body text */}
              <p className="text-slate-400 text-sm leading-relaxed mt-3">{opportunity.body}</p>
            </div>

            {/* ── Divider ─────────────────────────────────────────────────── */}
            <div className="mx-5 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)` }} />

            {/* ── Rewards ─────────────────────────────────────────────────── */}
            <div className="relative p-5 pt-3 pb-3">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2.5">If you accept</p>
              <RewardPills reward={opportunity.reward} color={accentColor} />
            </div>

            {/* ── Requirement warning ──────────────────────────────────────── */}
            {!eligible && (
              <div className="mx-5 mb-3 flex items-center gap-2 bg-red-950/30 border border-red-900/40 rounded-xl px-3 py-2">
                <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">
                  {playerLevel < opportunity.requiresLevel
                    ? `Requires Level ${opportunity.requiresLevel} (you are ${playerLevel})`
                    : `Requires ${opportunity.requiresRepTrack?.track.toUpperCase()} REP ${opportunity.requiresRepTrack?.minScore}+`}
                </p>
              </div>
            )}

            {/* ── Urgency warning ───────────────────────────────────────────── */}
            {urgency && !resolved && phase !== 'expired' && (
              <div
                className="mx-5 mb-3 flex items-center gap-2 rounded-xl px-3 py-2"
                style={{
                  backgroundColor: '#ef444415',
                  border: '1px solid #ef444440',
                  animation: 'rarePulse 1s ease-in-out infinite',
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400 font-bold">Opportunity expires in {secondsLeft} seconds</p>
              </div>
            )}

            {/* ── Expired overlay ────────────────────────────────────────── */}
            {phase === 'expired' && (
              <div className="mx-5 mb-4 flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3"
                style={{ animation: 'rareExpiredShake 0.5s ease both' }}>
                <XCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <p className="text-slate-500 text-sm font-bold">Opportunity has expired</p>
              </div>
            )}

            {/* ── Result state ───────────────────────────────────────────── */}
            {resolved && (
              <div
                className="mx-5 mb-4 flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  animation: 'rareResultPop 0.4s cubic-bezier(0.22,1,0.36,1) both',
                  backgroundColor: resolved === 'accepted' ? `${accentColor}18` : '#1e293b',
                  border: `1px solid ${resolved === 'accepted' ? accentColor + '50' : '#334155'}`,
                }}
              >
                {resolved === 'accepted'
                  ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: accentColor }} />
                  : <XCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />
                }
                <p className="font-black text-sm" style={{ color: resolved === 'accepted' ? accentColor : '#64748b' }}>
                  {resolved === 'accepted' ? 'Deal secured — rewards applied' : 'Opportunity passed'}
                </p>
              </div>
            )}

            {/* ── CTA buttons ───────────────────────────────────────────── */}
            {!resolved && phase !== 'expired' && (
              <div className="p-5 pt-2 flex gap-3">
                <button
                  onClick={handleAccept}
                  disabled={!eligible}
                  className="flex-1 py-3 rounded-xl font-black text-sm transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden group"
                  style={{
                    background: eligible
                      ? `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`
                      : '#1e293b',
                    color: eligible ? '#0f172a' : '#475569',
                    boxShadow: eligible ? `0 4px 20px ${accentColor}50` : undefined,
                  }}
                >
                  {eligible && (
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {opportunity.acceptLabel}
                  </span>
                </button>

                <button
                  onClick={handleDecline}
                  className="px-5 py-3 rounded-xl font-bold text-sm border border-slate-800 hover:border-slate-700 text-slate-500 hover:text-slate-300 transition-all active:scale-95"
                >
                  {opportunity.declineLabel}
                </button>
              </div>
            )}

            {/* Bottom accent */}
            <div
              className="h-px w-full"
              style={{ background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)` }}
            />
          </div>
        </div>
      </div>
    </>
  );
};
