import { useState, useMemo, useEffect, useRef } from 'react';
import { AISuggestion } from '../types/game';
import {
  Target, Cpu, Lightbulb, Shield,
  Zap, TrendingUp, Tag, Clock, Sparkles,
  ChevronDown, ChevronUp, CheckCircle2,
  Briefcase, BarChart2, DollarSign, Building2,
  Globe, Star, BellOff, Network, AlertTriangle, Loader2, XCircle,
} from 'lucide-react';

// ─── Display configs ──────────────────────────────────────────────────────────

export const SUGGESTION_TYPE_CONFIG = {
  strategic: {
    label:    'Strategic',
    color:    '#f59e0b',
    accent:   '#f59e0b14',
    border:   '#f59e0b30',
    gradient: 'from-amber-950/40 to-slate-900',
    ring:     'ring-amber-500/20',
    Icon:     Target,
  },
  tactical: {
    label:    'Tactical',
    color:    '#38bdf8',
    accent:   '#38bdf814',
    border:   '#38bdf830',
    gradient: 'from-sky-950/40 to-slate-900',
    ring:     'ring-sky-500/20',
    Icon:     Cpu,
  },
  opportunity: {
    label:    'Opportunity',
    color:    '#22c55e',
    accent:   '#22c55e14',
    border:   '#22c55e30',
    gradient: 'from-emerald-950/40 to-slate-900',
    ring:     'ring-emerald-500/20',
    Icon:     Lightbulb,
  },
  risk_mitigation: {
    label:    'Risk Mitigation',
    color:    '#ef4444',
    accent:   '#ef444414',
    border:   '#ef444430',
    gradient: 'from-red-950/40 to-slate-900',
    ring:     'ring-red-500/20',
    Icon:     Shield,
  },
} as const;

const PRIORITY_CONFIG = {
  high:   { color: '#f97316', label: 'High'   },
  medium: { color: '#f59e0b', label: 'Medium' },
  low:    { color: '#84cc16', label: 'Low'    },
} as const;

const CATEGORY_CONFIG: Record<string, { Icon: typeof Briefcase; label: string; color: string }> = {
  acquisition: { Icon: Building2,  label: 'Acquisition', color: '#f59e0b' },
  networking:  { Icon: Network,    label: 'Networking',  color: '#38bdf8' },
  finance:     { Icon: DollarSign, label: 'Finance',     color: '#22c55e' },
  operations:  { Icon: Briefcase,  label: 'Operations',  color: '#94a3b8' },
  brand:       { Icon: Star,       label: 'Brand',       color: '#a78bfa' },
  analysis:    { Icon: BarChart2,  label: 'Analysis',    color: '#fb923c' },
  strategy:    { Icon: Target,     label: 'Strategy',    color: '#f59e0b' },
  territory:   { Icon: Globe,      label: 'Territory',   color: '#34d399' },
};

const SOURCE_LABELS: Record<string, string> = {
  empire_analysis:     'Empire Analysis',
  market_analysis:     'Market Intelligence',
  player_stats:        'Performance Data',
  market_intelligence: 'Market Intelligence',
  rival_move:          'Rival Activity',
  system:              'System',
};

const SNOOZE_OPTIONS = [
  { label: '1 hour',   hours: 1   },
  { label: '4 hours',  hours: 4   },
  { label: '24 hours', hours: 24  },
  { label: '3 days',   hours: 72  },
  { label: '1 week',   hours: 168 },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function DifficultyPips({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-[3px]">
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          className="block rounded-full transition-all"
          style={{
            width:           i < value ? '8px' : '6px',
            height:          i < value ? '8px' : '6px',
            backgroundColor: i < value ? color : '#1e293b',
            boxShadow:       i < value ? `0 0 5px ${color}70` : 'none',
            border:          `1px solid ${i < value ? color + '50' : '#334155'}`,
          }}
        />
      ))}
    </div>
  );
}

function RewardChip({ icon: Icon, value, color }: { icon: typeof Zap; value: string; color: string }) {
  return (
    <div
      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
      style={{ backgroundColor: color + '12', border: `1px solid ${color}28`, color }}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      {value}
    </div>
  );
}

// ─── Snooze picker ────────────────────────────────────────────────────────────

function SnoozeButton({
  label,
  hours,
  accentColor,
  onSnooze,
}: {
  label: string;
  hours: number;
  accentColor: string;
  onSnooze: (hours: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onSnooze(hours)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white
                 transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{
        backgroundColor: hovered ? accentColor + '22' : accentColor + '10',
        border:          `1px solid ${hovered ? accentColor + '50' : accentColor + '25'}`,
      }}
    >
      {label}
    </button>
  );
}

function SnoozePicker({
  accentColor,
  onSnooze,
  onCancel,
}: {
  accentColor: string;
  onSnooze: (hours: number) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden border animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ backgroundColor: '#0f172a', borderColor: accentColor + '30' }}
    >
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b" style={{ borderColor: accentColor + '20' }}>
        <div className="flex items-center gap-2">
          <BellOff className="w-3.5 h-3.5" style={{ color: accentColor }} />
          <span className="text-xs font-bold text-white">Snooze for…</span>
        </div>
        <button
          onClick={onCancel}
          className="text-slate-600 hover:text-slate-400 transition-colors"
        >
          <BellOff className="w-3.5 h-3.5 opacity-0 pointer-events-none" aria-hidden />
          {/* invisible spacer — real close is the overlay */ }
        </button>
      </div>
      <div className="p-2 grid grid-cols-3 gap-1.5">
        {SNOOZE_OPTIONS.map(({ label, hours }) => (
          <SnoozeButton
            key={hours}
            label={label}
            hours={hours}
            accentColor={accentColor}
            onSnooze={onSnooze}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Snoozed banner ───────────────────────────────────────────────────────────

function SnoozedBanner({ snoozedUntil, color }: { snoozedUntil: string; color: string }) {
  const label = useMemo(() => {
    const diffH = Math.round((new Date(snoozedUntil).getTime() - Date.now()) / 3_600_000);
    if (diffH < 24)  return `${diffH}h`;
    if (diffH < 168) return `${Math.round(diffH / 24)}d`;
    return `${Math.round(diffH / 168)}w`;
  }, [snoozedUntil]);

  const dateLabel = useMemo(
    () => new Date(snoozedUntil).toLocaleDateString(undefined, {
      weekday: 'short', hour: '2-digit', minute: '2-digit',
    }),
    [snoozedUntil],
  );

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
      style={{ backgroundColor: color + '10', border: `1px solid ${color}25` }}
    >
      <BellOff className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
      <span className="text-xs font-semibold" style={{ color }}>
        Snoozed — returns in {label}
      </span>
      <span className="ml-auto text-xs text-slate-600">{dateLabel}</span>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export interface SuggestedQuestCardProps {
  suggestion:   AISuggestion;
  onAccept:     (s: AISuggestion) => Promise<void>;
  onDismiss:    (id: string) => void;
  onSnooze:     (id: string, hours: number) => void;
  isAccepted?:  boolean;
  isAccepting?: boolean;
  acceptError?: string | null;
}

export function SuggestedQuestCard({
  suggestion,
  onAccept,
  onDismiss,
  onSnooze,
  isAccepted  = false,
  isAccepting = false,
  acceptError = null,
}: SuggestedQuestCardProps) {
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [showSnooze,    setShowSnooze]    = useState(false);
  const [justSnoozed,   setJustSnoozed]   = useState(false);
  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
  }, []);

  const typeCfg = SUGGESTION_TYPE_CONFIG[suggestion.suggestion_type] ?? SUGGESTION_TYPE_CONFIG.tactical;
  const priCfg  = PRIORITY_CONFIG[suggestion.priority]                ?? PRIORITY_CONFIG.medium;
  const catCfg  = CATEGORY_CONFIG[suggestion.category]                ?? CATEGORY_CONFIG.strategy;

  const accepted = isAccepted || suggestion.status === 'accepted';
  const snoozed  = justSnoozed || suggestion.status === 'snoozed';

  const daysLeft = useMemo(() => Math.max(
    0,
    Math.round((new Date(suggestion.expires_at).getTime() - Date.now()) / 86_400_000),
  ), [suggestion.expires_at]);

  const handleSnooze = (hours: number) => {
    onSnooze(suggestion.id, hours);
    setShowSnooze(false);
    setJustSnoozed(true);
    snoozeTimerRef.current = setTimeout(() => setJustSnoozed(false), 4000);
  };

  return (
    <div
      className={`
        relative rounded-2xl border overflow-hidden transition-all duration-300
        bg-gradient-to-br ${typeCfg.gradient}
        ${accepted || snoozed
          ? 'border-slate-700/25 opacity-55'
          : isAccepting
            ? `ring-2 ${typeCfg.ring} border-transparent`
            : `border-slate-700/40 hover:border-slate-600/55
               ${suggestion.priority === 'high' ? `ring-1 ${typeCfg.ring}` : ''}`
        }
      `}
      style={isAccepting ? { boxShadow: `0 0 32px ${typeCfg.color}30` } : undefined}
    >
      {/* Top accent bar */}
      {!accepted && !snoozed && (
        <div
          className="h-0.5 w-full"
          style={{
            background: `linear-gradient(90deg, ${typeCfg.color} 0%, ${typeCfg.color}35 65%, transparent 100%)`,
          }}
        />
      )}

      {/* High-priority ambient glow */}
      {suggestion.priority === 'high' && !accepted && !snoozed && (
        <div
          className="absolute top-0 right-0 w-28 h-28 pointer-events-none rounded-full opacity-[0.07] blur-2xl"
          style={{ background: priCfg.color, transform: 'translate(40%,-40%)' }}
        />
      )}

      <div className="p-5 space-y-4">

        {/* ── Row 1: icon + title ───────────────────────────────────────── */}
        <div className="flex items-start gap-3">

          {/* Type icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              backgroundColor: accepted || snoozed ? '#1e293b' : typeCfg.accent,
              border:          `1px solid ${accepted || snoozed ? '#334155' : typeCfg.border}`,
              boxShadow:       accepted || snoozed ? 'none' : `0 0 18px ${typeCfg.color}10`,
            }}
          >
            <typeCfg.Icon
              className="w-5 h-5"
              style={{ color: accepted || snoozed ? '#334155' : typeCfg.color }}
            />
          </div>

          {/* Title + badges */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className={`font-bold text-sm leading-snug ${accepted || snoozed ? 'text-slate-600' : 'text-white'}`}>
              {suggestion.title}
            </h3>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: accepted || snoozed ? '#1e293b' : typeCfg.accent,
                  color:           accepted || snoozed ? '#334155' : typeCfg.color,
                }}
              >
                {typeCfg.label}
              </span>

              <div className="flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accepted || snoozed ? '#334155' : priCfg.color }}
                />
                <span className="text-xs" style={{ color: accepted || snoozed ? '#334155' : priCfg.color }}>
                  {priCfg.label}
                </span>
              </div>

              <div
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
                style={{
                  backgroundColor: accepted || snoozed ? '#0f172a' : catCfg.color + '10',
                  border:          `1px solid ${accepted || snoozed ? '#1e293b' : catCfg.color + '22'}`,
                  color:           accepted || snoozed ? '#334155' : catCfg.color,
                }}
              >
                <catCfg.Icon className="w-3 h-3 mr-0.5" />
                <span className="font-medium">{catCfg.label}</span>
              </div>
            </div>
          </div>

          {/* Status indicator */}
          {accepted && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-1" />}
          {snoozed && !accepted && <BellOff className="w-4 h-4 text-slate-600 flex-shrink-0 mt-1.5" />}
        </div>

        {/* ── Row 2: description ───────────────────────────────────────── */}
        {!snoozed && (
          <p className={`text-xs leading-relaxed ${accepted ? 'text-slate-600' : 'text-slate-400'}`}>
            {suggestion.description}
          </p>
        )}

        {/* ── Snoozed banner ───────────────────────────────────────────── */}
        {snoozed && suggestion.snoozed_until && (
          <SnoozedBanner snoozedUntil={suggestion.snoozed_until} color={typeCfg.color} />
        )}

        {/* ── Active-only content ──────────────────────────────────────── */}
        {!accepted && !snoozed && (
          <>
            {/* Difficulty + expiry */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-slate-600 font-medium uppercase tracking-wide">Difficulty</span>
                <DifficultyPips value={suggestion.difficulty} color={typeCfg.color} />
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3 h-3 text-slate-600" />
                {daysLeft === 0
                  ? <span className="text-red-400 font-bold">Expires today</span>
                  : <span className="text-slate-600">{daysLeft}d left</span>
                }
              </div>
            </div>

            {/* Rewards */}
            <div className="flex flex-wrap gap-2">
              {suggestion.estimated_xp > 0 && (
                <RewardChip icon={Zap}        value={`~${suggestion.estimated_xp.toLocaleString()} XP`}     color="#f59e0b" />
              )}
              {suggestion.estimated_money > 0 && (
                <RewardChip icon={TrendingUp} value={`~€${suggestion.estimated_money.toLocaleString()}`}    color="#22c55e" />
              )}
              <RewardChip icon={Tag}          value={SOURCE_LABELS[suggestion.source] ?? suggestion.source} color="#475569" />
            </div>

            {/* Tags */}
            {suggestion.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {suggestion.tags.slice(0, 5).map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-md font-mono"
                    style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#475569' }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* AI rationale (collapsible) */}
            {suggestion.rationale && (
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${typeCfg.color}18`, backgroundColor: typeCfg.accent }}
              >
                <button
                  onClick={() => setRationaleOpen(v => !v)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" style={{ color: typeCfg.color }} />
                    <span className="text-xs font-semibold" style={{ color: typeCfg.color }}>
                      AI Recommendation
                    </span>
                  </div>
                  {rationaleOpen
                    ? <ChevronUp   className="w-3.5 h-3.5 text-slate-500" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  }
                </button>
                {rationaleOpen && (
                  <div className="px-3.5 pb-3.5">
                    <p
                      className="text-xs leading-relaxed text-slate-300 italic border-t pt-2.5"
                      style={{ borderColor: typeCfg.color + '20' }}
                    >
                      {suggestion.rationale}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Snooze picker (inline) */}
            {showSnooze && (
              <SnoozePicker
                accentColor={typeCfg.color}
                onSnooze={handleSnooze}
                onCancel={() => setShowSnooze(false)}
              />
            )}

            {/* Error feedback */}
            {acceptError && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl
                              bg-red-950/30 border border-red-700/30 text-red-400 text-xs font-semibold">
                <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {acceptError}
              </div>
            )}

            {/* Action buttons */}
            {!showSnooze && (
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 pt-1">
                {/* Accept */}
                <button
                  onClick={() => onAccept(suggestion)}
                  disabled={isAccepting}
                  className="py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2
                             transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{
                    background:    `linear-gradient(135deg, ${typeCfg.color}e0 0%, ${typeCfg.color}80 100%)`,
                    boxShadow:     isAccepting
                      ? `0 0 24px ${typeCfg.color}50, inset 0 1px 0 ${typeCfg.color}40`
                      : `0 4px 16px ${typeCfg.color}24, inset 0 1px 0 ${typeCfg.color}40`,
                    letterSpacing: '0.01em',
                  }}
                >
                  {isAccepting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Accepting…</>
                    : <><CheckCircle2 className="w-4 h-4" /> Accept Mission</>
                  }
                </button>

                {/* Snooze */}
                <button
                  onClick={() => setShowSnooze(true)}
                  disabled={isAccepting}
                  className="px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all
                             flex items-center gap-1.5 text-slate-400
                             bg-slate-800/60 border border-slate-700/40
                             hover:text-amber-400 hover:border-amber-700/40 hover:bg-amber-950/20
                             active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Snooze — hide temporarily"
                >
                  <BellOff className="w-3.5 h-3.5" />
                  Snooze
                </button>

                {/* Reject */}
                <button
                  onClick={() => onDismiss(suggestion.id)}
                  disabled={isAccepting}
                  className="px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all
                             flex items-center gap-1.5 text-slate-400
                             bg-slate-800/60 border border-slate-700/40
                             hover:text-red-400 hover:border-red-700/40 hover:bg-red-950/20
                             active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reject — permanently remove"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            )}
          </>
        )}

        {/* Accepted confirmation */}
        {accepted && (
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold
                          text-emerald-400 bg-emerald-900/15 border border-emerald-800/25">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Mission accepted — added to your quest board
          </div>
        )}

      </div>
    </div>
  );
}
