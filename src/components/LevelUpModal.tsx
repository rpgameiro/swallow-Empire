import { useEffect, useState } from 'react';
import { LevelUpEvent, SKILL_LABELS, SKILL_COLORS } from '../types/game';
import { Crown, Zap, Star, ChevronRight } from 'lucide-react';

interface LevelUpModalProps {
  event: LevelUpEvent;
  onDismiss: () => void;
}

export const LevelUpModal = ({ event, onDismiss }: LevelUpModalProps) => {
  const [phase, setPhase] = useState<'flash' | 'reveal' | 'stats' | 'done'>('flash');
  const { newLevel, reward, statGains, skillPointsGained } = event;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('reveal'), 400);
    const t2 = setTimeout(() => setPhase('stats'), 1200);
    const t3 = setTimeout(() => setPhase('done'), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const gainedStats = Object.entries(statGains).filter(([, v]) => (v as number) > 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={phase === 'done' ? onDismiss : undefined}
      />

      {/* Flash ring */}
      {phase === 'flash' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-32 h-32 rounded-full animate-ping"
            style={{ backgroundColor: reward.badge_color + '40' }}
          />
        </div>
      )}

      {/* Main card */}
      <div
        className={`relative z-10 w-full max-w-sm mx-4 rounded-2xl overflow-hidden border-2 shadow-2xl transition-all duration-500
          ${phase === 'flash' ? 'scale-75 opacity-0' : 'scale-100 opacity-100'}`}
        style={{ borderColor: reward.badge_color }}
      >
        {/* Animated top glow bar */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${reward.badge_color}, transparent)` }}
        />

        {/* Header */}
        <div
          className="px-6 pt-8 pb-6 text-center"
          style={{ background: `linear-gradient(180deg, ${reward.badge_color}18 0%, #0f172a 100%)` }}
        >
          {/* Orbiting crown */}
          <div className="relative inline-flex items-center justify-center mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: `radial-gradient(circle, ${reward.badge_color}30, ${reward.badge_color}05)`,
                       boxShadow: `0 0 30px ${reward.badge_color}50` }}
            >
              <Crown className="w-10 h-10" style={{ color: reward.badge_color }} />
            </div>
            {/* Particle dots */}
            {[0, 60, 120, 180, 240, 300].map((deg, i) => (
              <span
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full animate-spin"
                style={{
                  backgroundColor: reward.badge_color,
                  transform: `rotate(${deg}deg) translateX(44px)`,
                  animationDuration: `${3 + i * 0.3}s`,
                  opacity: 0.7,
                }}
              />
            ))}
          </div>

          <p className="text-xs font-bold tracking-[0.3em] uppercase mb-1" style={{ color: reward.badge_color }}>
            Level Up
          </p>
          <h2 className="text-5xl font-black text-white mb-2">{newLevel}</h2>
          <p className="text-lg font-bold text-white mb-1">{reward.title}</p>
          <p className="text-sm text-slate-400 italic">"{reward.flavour_text}"</p>
        </div>

        {/* Stats & rewards */}
        <div
          className={`px-6 pb-6 space-y-4 transition-all duration-500 ${
            phase === 'stats' || phase === 'done' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Skill point reward */}
          {skillPointsGained > 0 && (
            <div className="flex items-center justify-between bg-amber-900/20 border border-amber-600/30 rounded-xl px-4 py-3">
              <span className="flex items-center gap-2 text-amber-300 font-bold">
                <Star className="w-4 h-4 text-amber-400" />
                Skill Points Gained
              </span>
              <span className="text-amber-400 font-black text-xl">+{skillPointsGained}</span>
            </div>
          )}

          {/* Auto stat gains */}
          {gainedStats.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-widest">Stats Upgraded</p>
              <div className="grid grid-cols-2 gap-2">
                {gainedStats.map(([stat, val]) => (
                  <div
                    key={stat}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                    style={{ backgroundColor: (SKILL_COLORS as any)[stat] + '18',
                             border: `1px solid ${(SKILL_COLORS as any)[stat]}40` }}
                  >
                    <span style={{ color: (SKILL_COLORS as any)[stat] }}>
                      {(SKILL_LABELS as any)[stat]}
                    </span>
                    <span className="font-black text-white">+{val as number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unlock reward */}
          {reward.unlock_type && (
            <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3">
              <Zap className="w-5 h-5 flex-shrink-0" style={{ color: reward.badge_color }} />
              <div>
                <p className="text-xs text-slate-400">Unlocked</p>
                <p className="text-white font-bold capitalize">
                  {reward.unlock_type === 'district'
                    ? `${reward.unlock_ref} Territory`
                    : reward.unlock_type === 'quest'
                    ? 'New Legendary Quests'
                    : reward.unlock_ref}
                </p>
              </div>
            </div>
          )}

          {/* CTA */}
          {phase === 'done' && (
            <button
              onClick={onDismiss}
              className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
              style={{ background: `linear-gradient(135deg, ${reward.badge_color}, ${reward.badge_color}99)` }}
            >
              Continue Building Empire
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
