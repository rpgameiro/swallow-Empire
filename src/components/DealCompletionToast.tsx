import { useEffect, useRef, useState } from 'react';
import { DollarSign, Star, TrendingUp, Handshake } from 'lucide-react';
import { DealCompletionEvent } from '../types/game';

interface Props {
  event: DealCompletionEvent;
  onDismiss: () => void;
}

// A floating reward chip that flies up and fades
function FloatingChip({
  label, color, delay,
}: { label: string; color: string; delay: number }) {
  return (
    <span
      className="absolute left-1/2 -translate-x-1/2 text-xs font-black px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{
        color,
        backgroundColor: color + '20',
        border: `1px solid ${color}40`,
        bottom: '0',
        animation: `floatChip 1.4s ease-out ${delay}s both`,
      }}
    >
      {label}
    </span>
  );
}

// Particle burst around the icon
function ParticleBurst({ color }: { color: string }) {
  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    const tx = Math.round(Math.cos(angle) * 28);
    const ty = Math.round(Math.sin(angle) * 28);
    return { tx, ty, delay: i * 0.04 };
  });

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map(({ tx, ty, delay }, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: '50%', top: '50%',
            width: 4, height: 4,
            borderRadius: '50%',
            backgroundColor: color,
            animation: `particleFly 0.7s ease-out ${delay}s both`,
            '--tx': `${tx}px`,
            '--ty': `${ty}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export const DealCompletionToast = ({ event, onDismiss }: Props) => {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // enter → show
    const t1 = setTimeout(() => setPhase('show'), 50);
    // auto-dismiss after 5s
    const t2 = setTimeout(() => {
      setPhase('exit');
      timerRef.current = setTimeout(onDismiss, 400);
    }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onDismiss]);

  const dismiss = () => {
    setPhase('exit');
    timerRef.current = setTimeout(onDismiss, 400);
  };

  const { accentColor, districtName, dealName, moneyEarned, reputationEarned, dominanceGained } = event;

  return (
    <>
      {/* Inject keyframes once */}
      <style>{`
        @keyframes floatChip {
          0%   { opacity: 0; transform: translateX(-50%) translateY(0); }
          30%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-36px); }
        }
        @keyframes particleFly {
          0%   { opacity: 1; transform: translate(-50%, -50%); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))); }
        }
        @keyframes dealDrain {
          from { width: 100%; }
          to   { width: 0%;   }
        }
        @keyframes dealIconPop {
          0%   { transform: scale(0.5) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.2) rotate(4deg);  opacity: 1; }
          80%  { transform: scale(0.95) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes dealSlideIn {
          0%   { transform: translateX(calc(100% + 24px)); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes dealSlideOut {
          0%   { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(calc(100% + 24px)); opacity: 0; }
        }
      `}</style>

      <div
        onClick={dismiss}
        className="fixed bottom-6 right-6 z-[90] cursor-pointer w-80"
        style={{
          animation: phase === 'exit'
            ? 'dealSlideOut 0.4s cubic-bezier(0.4,0,1,1) both'
            : 'dealSlideIn 0.45s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <div
          className="rounded-2xl overflow-hidden shadow-2xl border"
          style={{
            background: 'linear-gradient(135deg, rgba(2,6,23,0.98), rgba(15,23,42,0.95))',
            borderColor: accentColor + '50',
            boxShadow: `0 0 0 1px ${accentColor}20, 0 20px 60px rgba(0,0,0,0.6), 0 0 30px ${accentColor}20`,
          }}
        >
          {/* Top bar */}
          <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

          {/* Header */}
          <div className="p-4 pb-3 flex items-start gap-3">
            {/* Animated icon */}
            <div className="relative flex-shrink-0">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: accentColor + '20',
                  border: `2px solid ${accentColor}50`,
                  animation: 'dealIconPop 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s both',
                }}
              >
                <Handshake className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              <ParticleBurst color={accentColor} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: accentColor + 'cc' }}>
                Deal Closed
              </p>
              <p className="text-white font-bold text-sm leading-snug">{dealName}</p>
              <p className="text-xs mt-0.5" style={{ color: accentColor + '80' }}>{districtName}</p>
            </div>
          </div>

          {/* Reward pills */}
          <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black bg-emerald-950/40 border border-emerald-700/40 text-emerald-300 animate-scale-in" style={{ animationDelay: '0.2s' }}>
              <DollarSign className="w-3 h-3" />
              +€{moneyEarned.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black bg-yellow-950/40 border border-yellow-700/40 text-yellow-300 animate-scale-in" style={{ animationDelay: '0.3s' }}>
              <Star className="w-3 h-3" />
              +{reputationEarned} REP
            </div>
            <div
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black animate-scale-in"
              style={{
                animationDelay: '0.4s',
                backgroundColor: accentColor + '20',
                borderColor: accentColor + '40',
                color: accentColor,
                border: `1px solid ${accentColor}40`,
              }}
            >
              <TrendingUp className="w-3 h-3" />
              +{dominanceGained}% Dominance
            </div>
          </div>

          {/* Drain bar */}
          <div className="h-0.5 bg-slate-800/80">
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: accentColor,
                animation: 'dealDrain 5s linear 0.1s both',
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};
