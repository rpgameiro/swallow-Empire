import { useState, useEffect } from 'react';
import { ActiveStoryEvent, StoryChoice, StoryChoiceEffect, PlayerReputation } from '../types/game';
import {
  X, Briefcase, BarChart2, Globe, DoorOpen, AlertCircle, Building2,
  Plane, TrendingDown, FileText, UserMinus, Key, Mic, Newspaper,
  TrendingUp, Star, Zap, Crown, CheckCircle2, ArrowRight,
} from 'lucide-react';

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Briefcase, BarChart2, Globe, DoorOpen, AlertCircle, Building2,
  Plane, TrendingDown, FileText, UserMinus, Key, Mic, Newspaper,
  TrendingUp, Star, Zap, Crown,
};

function EventIcon({ name, color, size = 'lg' }: { name: string; color: string; size?: 'lg' | 'sm' }) {
  const Icon = ICON_MAP[name] ?? Star;
  const dim = size === 'lg' ? 'w-7 h-7' : 'w-4 h-4';
  return <Icon className={dim} style={{ color }} />;
}

// ─── Category badge ───────────────────────────────────────────────────────────

const CATEGORY_META = {
  investor:   { label: 'Investor',   color: '#3b82f6' },
  owner:      { label: 'Owner',      color: '#10b981' },
  market:     { label: 'Market',     color: '#f59e0b' },
  competitor: { label: 'Competitor', color: '#ef4444' },
  opportunity:{ label: 'Opportunity',color: '#a855f7' },
};

// ─── Effect preview pills ─────────────────────────────────────────────────────

function EffectPills({ effects }: { effects: StoryChoiceEffect }) {
  const pills: { label: string; positive: boolean }[] = [];

  if (effects.money != null && effects.money !== 0)
    pills.push({ label: effects.money > 0 ? `+€${effects.money.toLocaleString()}` : `-€${Math.abs(effects.money).toLocaleString()}`, positive: effects.money > 0 });

  if (effects.xp)
    pills.push({ label: `+${effects.xp} XP`, positive: true });

  if (effects.market_share_delta)
    pills.push({ label: `+${Math.round(effects.market_share_delta * 100)}% territory`, positive: true });

  if (effects.rep_delta) {
    const repTotal = Object.values(effects.rep_delta).reduce((a, b) => a + (b ?? 0), 0);
    if (repTotal !== 0)
      pills.push({ label: repTotal > 0 ? `+${repTotal} REP` : `${repTotal} REP`, positive: repTotal > 0 });
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {pills.map((p, i) => (
        <span
          key={i}
          className="text-[11px] font-black px-2 py-0.5 rounded-full"
          style={{
            color: p.positive ? '#10b981' : '#f87171',
            backgroundColor: p.positive ? '#10b98118' : '#f8717118',
            border: `1px solid ${p.positive ? '#10b98130' : '#f8717130'}`,
          }}
        >
          {p.label}
        </span>
      ))}
    </div>
  );
}

// ─── Single choice card ───────────────────────────────────────────────────────

function ChoiceCard({
  choice,
  accentColor,
  disabled,
  chosen,
  onChoose,
}: {
  choice: StoryChoice;
  accentColor: string;
  disabled: boolean;
  chosen: boolean;
  onChoose: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onChoose}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left rounded-xl border transition-all duration-200 active:scale-[0.98] disabled:cursor-default"
      style={{
        background: chosen
          ? `${accentColor}18`
          : hovered && !disabled
          ? `${accentColor}10`
          : 'rgba(15,23,42,0.5)',
        borderColor: chosen ? accentColor : hovered && !disabled ? `${accentColor}60` : '#1e293b',
        boxShadow: chosen ? `0 0 16px ${accentColor}25` : undefined,
      }}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div
            className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
            style={{
              borderColor: chosen ? accentColor : hovered ? `${accentColor}80` : '#334155',
              backgroundColor: chosen ? accentColor : 'transparent',
            }}
          >
            {chosen && <CheckCircle2 className="w-3.5 h-3.5 text-slate-900" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white">{choice.label}</span>
              {choice.requiresRepTrack && (
                <span className="text-[10px] text-slate-600 font-bold border border-slate-700 rounded px-1.5 py-0.5">
                  {choice.requiresRepTrack.track.toUpperCase()} {choice.requiresRepTrack.minScore}+
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{choice.description}</p>
            <EffectPills effects={choice.effects} />
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Result overlay ───────────────────────────────────────────────────────────

function ResultOverlay({
  choice,
  accentColor,
  onDismiss,
}: {
  choice: StoryChoice;
  accentColor: string;
  onDismiss: () => void;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 40); return () => clearTimeout(t); }, []);

  const pills: { label: string; positive: boolean }[] = [];
  const e = choice.effects;
  if (e.money != null && e.money !== 0)
    pills.push({ label: e.money > 0 ? `+€${e.money.toLocaleString()}` : `-€${Math.abs(e.money).toLocaleString()}`, positive: e.money > 0 });
  if (e.xp) pills.push({ label: `+${e.xp} XP`, positive: true });
  if (e.market_share_delta) pills.push({ label: `+${Math.round(e.market_share_delta * 100)}% territory`, positive: true });
  if (e.rep_delta) {
    Object.entries(e.rep_delta).forEach(([track, val]) => {
      if (val) pills.push({ label: `${val > 0 ? '+' : ''}${val} ${track.toUpperCase()} REP`, positive: val > 0 });
    });
  }

  return (
    <div
      className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center z-10 transition-all duration-300"
      style={{
        background: `radial-gradient(ellipse at center, ${accentColor}22, rgba(2,6,23,0.97))`,
        opacity: show ? 1 : 0,
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: accentColor + '25', border: `2px solid ${accentColor}60`, boxShadow: `0 0 30px ${accentColor}40` }}
      >
        <CheckCircle2 className="w-8 h-8" style={{ color: accentColor }} />
      </div>
      <p className="text-white font-black text-lg mb-1">Decision Made</p>
      <p className="text-slate-400 text-sm mb-5 px-8 text-center">{choice.label}</p>

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-6 px-6">
          {pills.map((p, i) => (
            <span
              key={i}
              className="text-sm font-black px-3 py-1 rounded-full"
              style={{
                color: p.positive ? '#10b981' : '#f87171',
                backgroundColor: p.positive ? '#10b98120' : '#f8717120',
                border: `1px solid ${p.positive ? '#10b98140' : '#f8717140'}`,
              }}
            >
              {p.label}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onDismiss}
        className="flex items-center gap-2 font-black text-sm px-5 py-2.5 rounded-xl transition-all active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
          color: '#0f172a',
          boxShadow: `0 4px 20px ${accentColor}40`,
        }}
      >
        Continue <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface StoryEventModalProps {
  event: ActiveStoryEvent;
  playerReputation: PlayerReputation | null;
  playerLevel: number;
  onChoose: (eventId: string, choice: StoryChoice) => void;
  onDismiss: () => void;
}

export const StoryEventModal = ({
  event,
  playerReputation,
  playerLevel,
  onChoose,
  onDismiss,
}: StoryEventModalProps) => {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<StoryChoice | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const { accentColor, category } = event;
  const catMeta = CATEGORY_META[category];

  const isChoiceAvailable = (choice: StoryChoice): boolean => {
    if (choice.requiresLevel && playerLevel < choice.requiresLevel) return false;
    if (choice.requiresRepTrack && playerReputation) {
      const score = playerReputation[`${choice.requiresRepTrack.track}_rep` as keyof PlayerReputation] as number;
      if (score < choice.requiresRepTrack.minScore) return false;
    }
    return true;
  };

  const handleChoose = (choice: StoryChoice) => {
    if (!isChoiceAvailable(choice) || selectedChoice) return;
    setSelectedChoice(choice);
    setShowResult(true);
    onChoose(event.id, choice);
  };

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <>
      <style>{`
        @keyframes storyPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes storySlideIn {
          from { transform: translateY(24px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>

      <div
        className={`fixed inset-0 z-[70] flex items-center justify-center p-4 transition-all duration-300 ${
          mounted && !leaving ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={e => { if (e.target === e.currentTarget && !showResult) handleDismiss(); }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${accentColor}15 0%, transparent 60%)` }}
        />

        {/* Card */}
        <div
          className="relative z-10 bg-slate-950 rounded-2xl max-w-md w-full border overflow-hidden shadow-2xl"
          style={{
            borderColor: accentColor + '45',
            boxShadow: `0 0 0 1px ${accentColor}20, 0 32px 80px rgba(0,0,0,0.7), 0 0 60px ${accentColor}18`,
            animation: mounted && !leaving ? 'storySlideIn 0.35s cubic-bezier(0.22,1,0.36,1) both' : undefined,
          }}
        >
          {/* Top accent line */}
          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

          {/* Decorative orb */}
          <div
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
            style={{
              backgroundColor: accentColor + '15',
              filter: 'blur(24px)',
              animation: 'storyPulse 4s ease-in-out infinite',
            }}
          />

          {/* Header */}
          <div
            className="relative px-6 pt-5 pb-4 overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${accentColor}14 0%, transparent 60%)` }}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: accentColor + '20',
                  border: `1.5px solid ${accentColor}40`,
                  boxShadow: `0 0 16px ${accentColor}25`,
                }}
              >
                <EventIcon name={event.icon} color={accentColor} size="lg" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{
                      color: catMeta.color,
                      backgroundColor: catMeta.color + '18',
                      border: `1px solid ${catMeta.color}35`,
                    }}
                  >
                    {catMeta.label} Event
                  </span>
                  {event.districtName && (
                    <span className="text-[10px] text-slate-600 font-bold">{event.districtName}</span>
                  )}
                </div>
                <h2 className="text-lg font-black text-white leading-tight">{event.title}</h2>
              </div>

              {!showResult && (
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Body text */}
            <p className="text-slate-400 text-sm leading-relaxed mt-3">{event.body}</p>
          </div>

          {/* Divider */}
          <div className="h-px mx-6" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}30, transparent)` }} />

          {/* Choices */}
          <div className="px-5 py-4 space-y-2.5">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Your Response</p>
            {event.choices.map(choice => {
              const available = isChoiceAvailable(choice);
              return (
                <ChoiceCard
                  key={choice.id}
                  choice={choice}
                  accentColor={available ? accentColor : '#475569'}
                  disabled={!available || !!selectedChoice}
                  chosen={selectedChoice?.id === choice.id}
                  onChoose={() => handleChoose(choice)}
                />
              );
            })}
          </div>

          {/* Bottom bar */}
          <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}30, transparent)` }} />

          {/* Result overlay */}
          {showResult && selectedChoice && (
            <ResultOverlay
              choice={selectedChoice}
              accentColor={accentColor}
              onDismiss={handleDismiss}
            />
          )}
        </div>
      </div>
    </>
  );
};
