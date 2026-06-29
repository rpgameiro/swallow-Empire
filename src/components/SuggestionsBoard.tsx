import { useState, useMemo, useRef, useEffect } from 'react';
import { AISuggestion } from '../types/game';
import { Cpu, RefreshCw, AlertTriangle, BellOff } from 'lucide-react';
import { SuggestedQuestCard, SUGGESTION_TYPE_CONFIG } from './SuggestedQuestCard';
import { MissionAcceptedToast } from './MissionAcceptedToast';

interface SuggestionsBoardProps {
  suggestions: AISuggestion[];
  onAccept:  (suggestion: AISuggestion) => Promise<void>;
  onDismiss: (suggestionId: string) => void;
  onSnooze:  (suggestionId: string, hours: number) => void;
  onRefresh: () => void;
}

// Derive filter tab labels directly from the type config — single source of truth
const TYPE_FILTER_TABS = Object.entries(SUGGESTION_TYPE_CONFIG).map(([key, v]) => ({
  key:   key as keyof typeof SUGGESTION_TYPE_CONFIG,
  label: v.label,
}));

type FilterKey = keyof typeof SUGGESTION_TYPE_CONFIG | 'all';

export function SuggestionsBoard({
  suggestions,
  onAccept,
  onDismiss,
  onSnooze,
  onRefresh,
}: SuggestionsBoardProps) {
  const [refreshing,      setRefreshing]      = useState(false);
  const [justAcceptedIds, setJustAcceptedIds] = useState<Set<string>>(new Set());
  const [activeFilter,    setActiveFilter]    = useState<FilterKey>('all');
  const [showSnoozed,     setShowSnoozed]     = useState(false);
  const [acceptingId,     setAcceptingId]     = useState<string | null>(null);
  const [acceptErrors,    setAcceptErrors]    = useState<Record<string, string>>({});
  const [toastSuggestion, setToastSuggestion] = useState<AISuggestion | null>(null);

  // Timer refs for cleanup on unmount
  const refreshTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptTimersRef  = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    acceptTimersRef.current.forEach(clearTimeout);
  }, []);

  // Single-pass partition — avoids 4 separate array scans per render
  const { pending, accepted, snoozed, highPri } = useMemo(() => {
    const pending:  AISuggestion[] = [];
    const accepted: AISuggestion[] = [];
    const snoozed:  AISuggestion[] = [];
    const highPri:  AISuggestion[] = [];
    for (const s of suggestions) {
      if (s.status === 'pending')       { pending.push(s); if (s.priority === 'high') highPri.push(s); }
      else if (s.status === 'accepted') accepted.push(s);
      else if (s.status === 'snoozed')  snoozed.push(s);
    }
    return { pending, accepted, snoozed, highPri };
  }, [suggestions]);

  const displayed = useMemo(
    () => activeFilter === 'all' ? pending : pending.filter(s => s.suggestion_type === activeFilter),
    [pending, activeFilter],
  );

  const handleAccept = async (s: AISuggestion) => {
    if (acceptingId) return; // prevent double-accept while one is in-flight
    setAcceptingId(s.id);
    setAcceptErrors(prev => { const n = { ...prev }; delete n[s.id]; return n; });
    try {
      await onAccept(s);
      // Success: show toast, brief highlight, then fade card
      setToastSuggestion(s);
      setJustAcceptedIds(prev => new Set([...prev, s.id]));
      const t = setTimeout(() => {
        setJustAcceptedIds(prev => { const n = new Set(prev); n.delete(s.id); return n; });
        acceptTimersRef.current.delete(s.id);
      }, 4000);
      acceptTimersRef.current.set(s.id, t);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept mission. Please try again.';
      setAcceptErrors(prev => ({ ...prev, [s.id]: msg }));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    refreshTimerRef.current = setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight leading-none">AI Missions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Optional intelligence-driven opportunities</p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors
                     px-3 py-2 rounded-lg hover:bg-slate-800/60 border border-transparent
                     hover:border-slate-700/40 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { label: 'Open',          value: pending.length,  color: '#38bdf8' },
          { label: 'Accepted',      value: accepted.length, color: '#22c55e' },
          { label: 'Snoozed',       value: snoozed.length,  color: '#f59e0b' },
          { label: 'High Priority', value: highPri.length,  color: '#f97316' },
        ] as const).map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center border"
            style={{ background: `linear-gradient(135deg, ${color}08, transparent)`, borderColor: color + '1a' }}
          >
            <div className="text-xl font-black" style={{ color }}>{value}</div>
            <div className="text-xs text-slate-500 mt-0.5 font-medium leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* ── High-priority alert ─────────────────────────────────────────── */}
      {highPri.length > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl
                        bg-orange-950/25 border border-orange-700/20 text-orange-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-semibold">
            {highPri.length} high-priority mission{highPri.length > 1 ? 's' : ''} require immediate attention.
          </span>
        </div>
      )}

      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap">
        {/* All tab */}
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeFilter === 'all'
              ? 'bg-cyan-500/15 border border-cyan-500/35 text-cyan-300'
              : 'bg-slate-800/50 border border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600/40'
          }`}
        >
          All
          {pending.length > 0 && (
            <span className={`ml-1.5 font-bold ${activeFilter === 'all' ? 'text-cyan-400' : 'text-slate-600'}`}>
              {pending.length}
            </span>
          )}
        </button>

        {/* Type tabs — derived from SUGGESTION_TYPE_CONFIG */}
        {TYPE_FILTER_TABS.map(({ key, label }) => {
          const count  = pending.filter(s => s.suggestion_type === key).length;
          const active = activeFilter === key;
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                active
                  ? 'bg-cyan-500/15 border border-cyan-500/35 text-cyan-300'
                  : 'bg-slate-800/50 border border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600/40'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 font-bold ${active ? 'text-cyan-400' : 'text-slate-600'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Mission cards ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center">
              <Cpu className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-slate-400 text-sm font-semibold">No missions in this category</p>
              <p className="text-slate-600 text-xs mt-1">All opportunities have been addressed or cleared.</p>
            </div>
            <button
              onClick={handleRefresh}
              className="text-xs text-cyan-500 hover:text-cyan-400 underline underline-offset-2 transition-colors"
            >
              Generate new suggestions
            </button>
          </div>
        ) : (
          displayed.map(s => (
            <SuggestedQuestCard
              key={s.id}
              suggestion={s}
              onAccept={handleAccept}
              onDismiss={onDismiss}
              onSnooze={onSnooze}
              isAccepted={justAcceptedIds.has(s.id)}
              isAccepting={acceptingId === s.id}
              acceptError={acceptErrors[s.id] ?? null}
            />
          ))
        )}
      </div>

      {/* ── Snoozed section ─────────────────────────────────────────────── */}
      {snoozed.length > 0 && (
        <div className="pt-1 space-y-2">
          <button
            onClick={() => setShowSnoozed(v => !v)}
            className="w-full flex items-center gap-2 px-1 group"
          >
            <div className="h-px flex-1 bg-slate-800" />
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold uppercase tracking-widest
                            group-hover:text-amber-500 transition-colors">
              <BellOff className="w-3 h-3" />
              Snoozed ({snoozed.length})
            </div>
            <div className="h-px flex-1 bg-slate-800" />
          </button>

          {showSnoozed && snoozed.map(s => (
            <SuggestedQuestCard
              key={s.id}
              suggestion={s}
              onAccept={handleAccept}
              onDismiss={onDismiss}
              onSnooze={onSnooze}
            />
          ))}
        </div>
      )}

      {/* ── Accepted archive ─────────────────────────────────────────────── */}
      {accepted.length > 0 && (
        <div className="pt-1 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-600 font-bold uppercase tracking-widest">
              Accepted ({accepted.length})
            </span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          {accepted.slice(0, 3).map(s => (
            <SuggestedQuestCard
              key={s.id}
              suggestion={s}
              onAccept={handleAccept}
              onDismiss={onDismiss}
              onSnooze={onSnooze}
              isAccepted
            />
          ))}
        </div>
      )}

      {/* ── Mission accepted toast ───────────────────────────────────────── */}
      {toastSuggestion && (
        <MissionAcceptedToast
          suggestion={toastSuggestion}
          onDismiss={() => setToastSuggestion(null)}
        />
      )}

    </div>
  );
}
