import { useEffect, useState } from 'react';
import { Cpu, Zap, TrendingUp, ChevronRight, CheckCircle2 } from 'lucide-react';
import { AISuggestion } from '../types/game';
import { SUGGESTION_TYPE_CONFIG } from './SuggestedQuestCard';

export interface MissionAcceptedToastProps {
  suggestion: AISuggestion;
  onDismiss: () => void;
}

export function MissionAcceptedToast({ suggestion, onDismiss }: MissionAcceptedToastProps) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const typeCfg = SUGGESTION_TYPE_CONFIG[suggestion.suggestion_type] ?? SUGGESTION_TYPE_CONFIG.tactical;
  const color   = typeCfg.color;

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 30);
    const t2 = setTimeout(() => {
      setLeaving(true);
      setTimeout(onDismiss, 400);
    }, 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDismiss]);

  const handleClick = () => {
    setLeaving(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        fixed bottom-6 right-6 z-[90] w-80 cursor-pointer
        transition-all duration-400 ease-out
        ${visible && !leaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div
        className="rounded-2xl overflow-hidden shadow-2xl border"
        style={{ borderColor: color + '60', background: '#0f172a' }}
      >
        {/* Animated top accent bar */}
        <div className="h-0.5 w-full animate-pulse" style={{ backgroundColor: color }} />

        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${color}20 0%, transparent 100%)` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: color + '22', border: `1px solid ${color}50` }}
            >
              <Cpu className="w-4.5 h-4.5" style={{ color }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <p className="text-xs font-black tracking-widest text-emerald-400">MISSION ACCEPTED</p>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{typeCfg.label} · Active on Quest Board</p>
            </div>
          </div>
        </div>

        {/* Mission title */}
        <div className="px-4 py-2.5 border-t border-slate-800">
          <p className="text-white font-bold text-sm leading-tight">{suggestion.title}</p>
        </div>

        {/* Rewards preview */}
        <div className="px-4 pb-4 pt-2 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {suggestion.estimated_xp > 0 && (
              <div
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold"
                style={{ backgroundColor: '#f59e0b20', border: '1px solid #f59e0b40', color: '#f59e0b' }}
              >
                <Zap className="w-3 h-3" />
                ~{suggestion.estimated_xp.toLocaleString()} XP on complete
              </div>
            )}
            {suggestion.estimated_money > 0 && (
              <div className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold
                              bg-emerald-900/25 border border-emerald-600/40 text-emerald-300">
                <TrendingUp className="w-3 h-3" />
                ~€{suggestion.estimated_money.toLocaleString()}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-600 flex items-center gap-1">
            Tap to dismiss <ChevronRight className="w-3 h-3" />
          </p>
        </div>

        {/* Drain progress bar */}
        <div className="h-0.5 bg-slate-800">
          <div
            className="h-full rounded-full"
            style={{
              backgroundColor: color,
              animation: 'drain 4.5s linear forwards',
              width: '100%',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes drain { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </div>
  );
}
