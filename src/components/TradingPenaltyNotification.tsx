import { useEffect, useState } from 'react';
import { AlertTriangle, X, TrendingDown, Zap } from 'lucide-react';

interface TradingPenaltyNotificationProps {
  onDismiss: () => void;
}

export const TradingPenaltyNotification = ({ onDismiss }: TradingPenaltyNotificationProps) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 30);
    const t2 = setTimeout(() => {
      setLeaving(true);
      setTimeout(onDismiss, 400);
    }, 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDismiss]);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`
        fixed top-20 left-1/2 -translate-x-1/2 z-[95] w-full max-w-sm px-4
        transition-all duration-400 ease-out
        ${visible && !leaving ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}
      `}
    >
      <div className="rounded-2xl overflow-hidden shadow-2xl border border-red-700/60 bg-slate-950">
        {/* Red top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-red-700 via-red-500 to-red-700 animate-pulse" />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-900/40 border border-red-700/50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-red-400 font-black text-sm tracking-wide">TRADING PENALTY</p>
                <p className="text-slate-400 text-xs">Binance opened — focus broken</p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="text-slate-600 hover:text-slate-400 transition-colors mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Penalty breakdown */}
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-3 space-y-2">
            <p className="text-xs text-red-300 font-bold mb-2">Applied penalties:</p>
            <div className="flex items-center gap-2 text-xs text-red-200">
              <Zap className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span>−50 XP deducted from current progress</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-red-200">
              <TrendingDown className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
              <span>Focus −10 &nbsp;·&nbsp; Discipline −10</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-red-200">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
              <span>No-trade streak reset to 0</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 mt-3 text-center italic">
            "The market will always be there. Your empire won't build itself."
          </p>
        </div>

        {/* Drain bar */}
        <div className="h-0.5 bg-slate-800">
          <div
            className="h-full bg-red-600 rounded-full"
            style={{ animation: 'penaltyDrain 6s linear forwards' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes penaltyDrain {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
};
