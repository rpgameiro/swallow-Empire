import { useState, useEffect, useRef } from 'react';
import { DistrictEvent, DistrictMarketData, District, EventSeverity } from '../types/game';
import { TrendingUp, TrendingDown, AlertTriangle, Star, X, Bell, Zap, Activity } from 'lucide-react';

interface DistrictAlertsProps {
  districtEvents: Map<string, DistrictEvent[]>;
  districtMarket: Map<string, DistrictMarketData>;
  districts: District[];
}

const SEVERITY_CONFIG: Record<EventSeverity, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  opportunity: { icon: Star,          color: '#10b981', bg: 'rgba(6,78,59,0.3)',    border: '#065f46', label: 'Opportunity' },
  info:        { icon: Activity,       color: '#3b82f6', bg: 'rgba(30,58,138,0.3)',  border: '#1e3a8a', label: 'Market Intel' },
  warning:     { icon: AlertTriangle,  color: '#f59e0b', bg: 'rgba(120,53,15,0.3)', border: '#92400e', label: 'Warning' },
  alert:       { icon: AlertTriangle,  color: '#ef4444', bg: 'rgba(127,29,29,0.3)', border: '#7f1d1d', label: 'Alert' },
};

const TREND_CONFIG = {
  rising:   { icon: TrendingUp,   color: '#10b981', label: 'Rising' },
  falling:  { icon: TrendingDown, color: '#ef4444', label: 'Falling' },
  stable:   { icon: Activity,     color: '#64748b', label: 'Stable' },
  volatile: { icon: Zap,          color: '#f59e0b', label: 'Volatile' },
};

// Individual sliding-in alert toast
function AlertToast({
  event,
  districtName,
  onDismiss,
  index,
}: {
  event: DistrictEvent;
  districtName: string;
  onDismiss: (id: string) => void;
  index: number;
}) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const cfg = SEVERITY_CONFIG[event.severity];
  const Icon = cfg.icon;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 60);
    const t2 = setTimeout(() => { setPhase('exit'); timerRef.current = setTimeout(() => onDismiss(event.id), 400); }, 7000);
    return () => { clearTimeout(t1); clearTimeout(t2); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [event.id, onDismiss]);

  const dismiss = () => {
    setPhase('exit');
    timerRef.current = setTimeout(() => onDismiss(event.id), 400);
  };

  return (
    <div
      onClick={dismiss}
      className="cursor-pointer w-80"
      style={{
        animation: phase === 'exit'
          ? 'alertSlideOut 0.4s cubic-bezier(0.4,0,1,1) both'
          : 'alertSlideIn 0.4s cubic-bezier(0.22,1,0.36,1) both',
        animationDelay: phase === 'enter' ? `${index * 0.12}s` : '0s',
      }}
    >
      <div
        className="rounded-xl border overflow-hidden shadow-2xl"
        style={{
          background: cfg.bg,
          borderColor: cfg.border,
          boxShadow: `0 0 20px ${cfg.color}20, 0 8px 32px rgba(0,0,0,0.5)`,
        }}
      >
        <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }} />
        <div className="px-3.5 py-3 flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: cfg.color + '25', border: `1px solid ${cfg.color}40` }}
          >
            <Icon className="w-4 h-4" style={{ color: cfg.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: cfg.color + 'cc' }}>
                {cfg.label}
              </span>
              <span className="text-slate-600 text-xs">·</span>
              <span className="text-xs text-slate-500 truncate">{districtName}</span>
            </div>
            <p className="text-white font-bold text-sm leading-tight">{event.title}</p>
            <p className="text-slate-400 text-xs mt-0.5 leading-relaxed line-clamp-2">{event.description}</p>
          </div>
          <button onClick={e => { e.stopPropagation(); dismiss(); }} className="text-slate-700 hover:text-slate-400 flex-shrink-0 mt-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Drain bar */}
        <div className="h-0.5 bg-slate-800/50">
          <div
            className="h-full"
            style={{
              backgroundColor: cfg.color,
              animation: 'alertDrain 7s linear 0.05s both',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const DistrictAlerts = ({ districtEvents, districtMarket, districts }: DistrictAlertsProps) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  // Collect all active (non-expired, non-dismissed) events from last 2 hours
  const cutoff = Date.now() - 2 * 3600 * 1000;
  const allEvents: Array<{ event: DistrictEvent; districtName: string }> = [];

  for (const [districtId, events] of districtEvents) {
    const district = districts.find(d => d.id === districtId);
    if (!district) continue;
    for (const e of events) {
      if (dismissed.has(e.id)) continue;
      if (new Date(e.created_at).getTime() < cutoff) continue;
      if (e.expires_at && new Date(e.expires_at).getTime() < Date.now()) continue;
      allEvents.push({ event: e, districtName: district.name });
    }
  }

  // Show max 3 toasts at a time
  const visible = allEvents.slice(0, 3);
  const hiddenCount = Math.max(0, allEvents.length - 3);

  const dismiss = (id: string) => setDismissed(prev => new Set([...prev, id]));

  if (visible.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes alertSlideIn {
          0%   { transform: translateX(calc(100% + 24px)); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes alertSlideOut {
          0%   { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(calc(100% + 24px)); opacity: 0; }
        }
        @keyframes alertDrain {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>

      <div className="fixed bottom-6 right-6 z-[85] flex flex-col gap-2 items-end pointer-events-none">
        {visible.map(({ event, districtName }, i) => (
          <div key={event.id} className="pointer-events-auto">
            <AlertToast
              event={event}
              districtName={districtName}
              onDismiss={dismiss}
              index={i}
            />
          </div>
        ))}
        {hiddenCount > 0 && (
          <div className="pointer-events-auto flex items-center gap-1.5 text-xs text-slate-500 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-1.5">
            <Bell className="w-3 h-3" />
            +{hiddenCount} more alerts
          </div>
        )}
      </div>
    </>
  );
};

// ─── Market temperature badge (used in map cards) ─────────────────────────────

export function MarketTempBadge({ temp, size = 'sm' }: { temp: number; size?: 'sm' | 'xs' }) {
  const { color, label } = temp >= 80
    ? { color: '#ef4444', label: 'Hot' }
    : temp >= 65
    ? { color: '#f97316', label: 'Warm' }
    : temp >= 45
    ? { color: '#f59e0b', label: 'Neutral' }
    : temp >= 30
    ? { color: '#3b82f6', label: 'Cool' }
    : { color: '#64748b', label: 'Cold' };

  const px = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center font-black rounded ${px}`}
      style={{ color, backgroundColor: color + '18', border: `1px solid ${color}35` }}
    >
      {temp}° {label}
    </span>
  );
}

// ─── Trend indicator (used in detail) ────────────────────────────────────────

export function TrendBadge({ direction }: { direction: keyof typeof TREND_CONFIG }) {
  const { icon: Icon, color, label } = TREND_CONFIG[direction] ?? TREND_CONFIG.stable;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg"
      style={{ color, backgroundColor: color + '18', border: `1px solid ${color}30` }}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
