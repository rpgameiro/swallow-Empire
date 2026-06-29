import { useEffect, useState } from 'react';
import { QuestCompletionEvent } from '../types/game';
import { Zap, Star, ChevronRight, Shield, Crown, DollarSign } from 'lucide-react';

interface QuestCompletionToastProps {
  event: QuestCompletionEvent;
  onDismiss: () => void;
}

const TYPE_CONFIG = {
  daily:     { color: '#3b82f6', label: 'DAILY',     Icon: Zap },
  weekly:    { color: '#a855f7', label: 'WEEKLY',    Icon: Shield },
  main:      { color: '#f59e0b', label: 'MAIN',      Icon: Crown },
  legendary: { color: '#ef4444', label: 'LEGENDARY', Icon: Star },
} as const;

const BONUS_LABELS: Record<string, string> = {
  district_xp:       'District XP',
  market_share:      'Market Share',
  stat_negotiation:  '+Negotiation',
  stat_networking:   '+Networking',
  stat_focus:        '+Focus',
  stat_discipline:   '+Discipline',
  stat_leadership:   '+Leadership',
  stat_reputation:   '+Reputation',
};

export const QuestCompletionToast = ({ event, onDismiss }: QuestCompletionToastProps) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const { color, label, Icon } = TYPE_CONFIG[event.questType];

  useEffect(() => {
    // Mount → slide in
    const t1 = setTimeout(() => setVisible(true), 30);
    // Auto-dismiss after 4s
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
        {/* Top bar */}
        <div
          className="h-0.5 w-full animate-pulse"
          style={{ backgroundColor: color }}
        />

        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${color}20 0%, transparent 100%)` }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color + '25', border: `1px solid ${color}50` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-black tracking-widest" style={{ color }}>
                QUEST COMPLETE
              </p>
              <p className="text-xs text-slate-500">{label} QUEST</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {[...Array(event.difficulty)].map((_, i) => (
              <span key={i} className="text-xs" style={{ color }}>★</span>
            ))}
            {[...Array(5 - event.difficulty)].map((_, i) => (
              <span key={i} className="text-xs text-slate-700">★</span>
            ))}
          </div>
        </div>

        {/* Quest title */}
        <div className="px-4 py-2 border-t border-slate-800">
          <p className="text-white font-bold text-sm leading-tight">{event.title}</p>
        </div>

        {/* Rewards */}
        <div className="px-4 pb-4 pt-2 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {event.moneyEarned > 0 && (
              <div className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold bg-emerald-900/25 border border-emerald-600/40 text-emerald-300">
                <DollarSign className="w-3 h-3" />
                +€{event.moneyEarned.toLocaleString()}
              </div>
            )}

            <div
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold"
              style={{ backgroundColor: '#f59e0b20', border: '1px solid #f59e0b40', color: '#f59e0b' }}
            >
              <Zap className="w-3 h-3" />
              +{event.xpEarned.toLocaleString()} XP
            </div>

            {event.reputationEarned > 0 && (
              <div className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold bg-yellow-900/20 border border-yellow-700/40 text-yellow-400">
                <Star className="w-3 h-3" />
                +{event.reputationEarned} REP
              </div>
            )}

            {event.skillPointsEarned > 0 && (
              <div className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold bg-emerald-900/20 border border-emerald-700/40 text-emerald-400">
                +{event.skillPointsEarned} SP
              </div>
            )}

            {event.bonusType && event.bonusValue > 0 && (
              <div
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold"
                style={{ backgroundColor: color + '15', border: `1px solid ${color}35`, color }}
              >
                {BONUS_LABELS[event.bonusType] ?? event.bonusType} +{event.bonusValue}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-600 flex items-center gap-1">
            Tap to dismiss <ChevronRight className="w-3 h-3" />
          </p>
        </div>

        {/* Progress drain bar */}
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
        @keyframes drain {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
};
