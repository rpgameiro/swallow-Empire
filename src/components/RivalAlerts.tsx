import { useState, useEffect, useRef } from 'react';
import { RivalEvent, RivalFirm } from '../types/game';
import { EVENT_TYPE_META } from '../services/rivalEngine';
import { X, Swords } from 'lucide-react';

interface RivalAlertsProps {
  events: RivalEvent[];
  rivals: RivalFirm[];
  onDismiss: (id: string) => void;
}

function RivalToast({
  event,
  rival,
  onDismiss,
  index,
}: {
  event: RivalEvent;
  rival: RivalFirm | undefined;
  onDismiss: (id: string) => void;
  index: number;
}) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const meta = EVENT_TYPE_META[event.event_type];
  const color = rival?.accent_color ?? meta.color;

  const severityBg: Record<string, string> = {
    alert:       'rgba(127,29,29,0.45)',
    warning:     'rgba(120,53,15,0.40)',
    info:        'rgba(30,58,138,0.35)',
    opportunity: 'rgba(6,78,59,0.35)',
  };
  const severityBorder: Record<string, string> = {
    alert:       '#7f1d1d',
    warning:     '#92400e',
    info:        '#1e3a8a',
    opportunity: '#065f46',
  };

  const bg     = severityBg[event.severity]     ?? 'rgba(15,23,42,0.85)';
  const border = severityBorder[event.severity] ?? '#334155';
  const AUTO_DISMISS = event.severity === 'alert' ? 10000 : 8000;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 60);
    const t2 = setTimeout(() => {
      setPhase('exit');
      timerRef.current = setTimeout(() => onDismiss(event.id), 420);
    }, AUTO_DISMISS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(timerRef.current); };
  }, [event.id, onDismiss, AUTO_DISMISS]);

  const dismiss = () => {
    setPhase('exit');
    timerRef.current = setTimeout(() => onDismiss(event.id), 420);
  };

  return (
    <div
      onClick={dismiss}
      className="cursor-pointer w-80"
      style={{
        animation: phase === 'exit'
          ? 'rivalSlideOut 0.42s cubic-bezier(0.4,0,1,1) both'
          : 'rivalSlideIn 0.42s cubic-bezier(0.22,1,0.36,1) both',
        animationDelay: phase === 'enter' ? `${index * 0.14}s` : '0s',
      }}
    >
      <div
        className="rounded-xl border overflow-hidden shadow-2xl"
        style={{
          background: bg,
          borderColor: border,
          boxShadow: `0 0 24px ${color}25, 0 8px 36px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Top accent */}
        <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

        <div className="px-3.5 py-3 flex items-start gap-3">
          {/* Icon block */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
            style={{ backgroundColor: color + '25', border: `1px solid ${color}40` }}
          >
            <span>{meta.icon}</span>
          </div>

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: color + 'cc' }}>
                {meta.label}
              </span>
              {rival && (
                <>
                  <span className="text-slate-700 text-[10px]">·</span>
                  <span className="text-[10px] text-slate-500 font-bold truncate">{rival.name}</span>
                </>
              )}
            </div>

            <p className="text-white font-bold text-sm leading-tight">{event.title}</p>
            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed line-clamp-2">{event.description}</p>

            {/* Impact row */}
            {(event.impact_reputation !== 0 || event.impact_money !== 0 || event.impact_market_share !== 0) && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {event.impact_reputation !== 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    event.impact_reputation > 0 ? 'text-emerald-400 bg-emerald-950/50' : 'text-red-400 bg-red-950/50'
                  }`}>
                    {event.impact_reputation > 0 ? '+' : ''}{event.impact_reputation} rep
                  </span>
                )}
                {event.impact_money !== 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    event.impact_money > 0 ? 'text-emerald-400 bg-emerald-950/50' : 'text-red-400 bg-red-950/50'
                  }`}>
                    {event.impact_money > 0 ? '+' : ''}€{Math.abs(event.impact_money).toLocaleString()}
                  </span>
                )}
                {event.impact_market_share !== 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    event.impact_market_share > 0 ? 'text-emerald-400 bg-emerald-950/50' : 'text-amber-400 bg-amber-950/50'
                  }`}>
                    {event.impact_market_share > 0 ? '+' : ''}{(event.impact_market_share * 100).toFixed(0)}% share
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            onClick={e => { e.stopPropagation(); dismiss(); }}
            className="text-slate-700 hover:text-slate-400 flex-shrink-0 mt-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Drain bar */}
        <div className="h-0.5 bg-slate-900/50">
          <div className="h-full" style={{
            backgroundColor: color,
            animation: `rivalDrain ${AUTO_DISMISS / 1000}s linear 0.05s both`,
          }} />
        </div>
      </div>
    </div>
  );
}

export const RivalAlerts = ({ events, rivals, onDismiss }: RivalAlertsProps) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const unread = events
    .filter(e => !dismissed.has(e.id) && !e.is_read)
    .slice(0, 2); // max 2 rival toasts at once (coexist with district alerts)

  const dismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    onDismiss(id);
  };

  if (unread.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes rivalSlideIn {
          0%   { transform: translateX(calc(100% + 24px)); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes rivalSlideOut {
          0%   { transform: translateX(0); opacity: 1; max-height: 200px; margin-bottom: 8px; }
          100% { transform: translateX(calc(100% + 24px)); opacity: 0; max-height: 0; margin-bottom: 0; }
        }
        @keyframes rivalDrain {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      <div className="fixed bottom-24 right-6 z-[84] flex flex-col gap-2 items-end pointer-events-none">
        {/* Rival conflict indicator */}
        <div className="flex items-center gap-1.5 text-[10px] font-black text-red-400 mb-1 pointer-events-none"
          style={{ animation: 'rarePulse 1.5s ease-in-out infinite' }}>
          <Swords className="w-3 h-3" />
          <span>RIVAL ACTIVITY</span>
        </div>
        {unread.map((evt, i) => (
          <div key={evt.id} className="pointer-events-auto">
            <RivalToast
              event={evt}
              rival={rivals.find(r => r.id === evt.rival_id)}
              onDismiss={dismiss}
              index={i}
            />
          </div>
        ))}
      </div>
    </>
  );
};
