import { Player, PlayerSkills, SKILL_LABELS, SKILL_COLORS, SKILL_ICONS, SKILL_UNLOCKS } from '../types/game';
import { Plus, Lock, CheckCircle2, Info } from 'lucide-react';
import { useState } from 'react';

interface SkillTreeProps {
  player: Player;
  onSpend: (stat: keyof PlayerSkills) => void;
}

const STAT_CAPS = 100;
const MAX_MANUAL_INVEST = 15; // soft cap visual suggestion, not enforced

const SKILL_ORDER: (keyof PlayerSkills)[] = [
  'negotiation', 'networking', 'focus', 'discipline', 'leadership', 'reputation',
];

const STAT_DESCRIPTIONS: Record<keyof PlayerSkills, string> = {
  negotiation: 'Drives deal size and contract value. Higher scores unlock bigger investment deals.',
  networking:  'Determines quality of investor relationships. Unlocks access to better capital sources.',
  focus:       'Amplifies XP gains and reduces time penalties. Critical for sustained growth.',
  discipline:  'Powers the no-trading streak bonus. Prevents focus bleed from trading penalties.',
  leadership:  'Expands team capabilities and advisory scope. Unlocks firm-building milestones.',
  reputation:  'Opens new territories and quest lines. Your standing in the Portuguese market.',
};

function StatBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min((value / STAT_CAPS) * 100, 100);
  return (
    <div className="w-full bg-slate-700/60 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export const SkillTree = ({ player, onSpend }: SkillTreeProps) => {
  const [hoveredStat, setHoveredStat] = useState<keyof PlayerSkills | null>(null);

  const nextUnlocks = SKILL_UNLOCKS.filter(u => {
    const current = player[u.stat] as number;
    return current < u.threshold;
  }).slice(0, 3);

  const recentUnlocks = SKILL_UNLOCKS.filter(u => {
    const current = player[u.stat] as number;
    return current >= u.threshold;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-amber-400">Skill Development</h2>
        <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-600/40 rounded-xl px-4 py-2">
          <span className="text-amber-300 text-sm font-bold">{player.skill_points}</span>
          <span className="text-amber-500 text-xs">skill points available</span>
        </div>
      </div>

      {player.skill_points > 0 && (
        <div className="bg-amber-900/10 border border-amber-700/30 rounded-xl px-4 py-3 text-sm text-amber-300/80">
          You have unspent skill points. Each point adds +3 to the chosen stat.
        </div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SKILL_ORDER.map(stat => {
          const value = player[stat] as number;
          const color = SKILL_COLORS[stat];
          const isHovered = hoveredStat === stat;
          const canSpend = player.skill_points > 0 && value < STAT_CAPS;

          // Find closest unlock milestone
          const nextUnlock = SKILL_UNLOCKS.find(u => u.stat === stat && value < u.threshold);
          const progressToNext = nextUnlock
            ? Math.min((value / nextUnlock.threshold) * 100, 100)
            : 100;

          return (
            <div
              key={stat}
              onMouseEnter={() => setHoveredStat(stat)}
              onMouseLeave={() => setHoveredStat(null)}
              className="relative rounded-xl border transition-all duration-200 overflow-hidden"
              style={{
                borderColor: isHovered ? color + '80' : color + '20',
                backgroundColor: isHovered ? color + '08' : 'transparent',
              }}
            >
              <div className="p-4 space-y-3">
                {/* Stat header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{SKILL_ICONS[stat]}</span>
                    <span className="font-bold text-white text-sm">{SKILL_LABELS[stat]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg" style={{ color }}>{value}</span>
                    <button
                      onClick={() => canSpend && onSpend(stat)}
                      disabled={!canSpend}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        canSpend
                          ? 'hover:scale-110 active:scale-95'
                          : 'opacity-30 cursor-not-allowed'
                      }`}
                      style={{ backgroundColor: canSpend ? color + '30' : '#334155',
                               border: `1px solid ${canSpend ? color + '60' : '#475569'}` }}
                    >
                      <Plus className="w-4 h-4" style={{ color: canSpend ? color : '#64748b' }} />
                    </button>
                  </div>
                </div>

                {/* Main bar */}
                <StatBar value={value} color={color} />

                {/* Progress to next unlock */}
                {nextUnlock && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-500">Next: {nextUnlock.label}</span>
                      <span className="text-xs" style={{ color }}>{value}/{nextUnlock.threshold}</span>
                    </div>
                    <div className="w-full bg-slate-700/40 rounded-full h-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressToNext}%`, backgroundColor: color + '80' }}
                      />
                    </div>
                  </div>
                )}

                {/* Tooltip description on hover */}
                {isHovered && (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {STAT_DESCRIPTIONS[stat]}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming unlocks */}
      {nextUnlocks.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Upcoming Unlocks
          </h3>
          <div className="space-y-2">
            {nextUnlocks.map((u, i) => {
              const current = player[u.stat] as number;
              const pct = Math.min((current / u.threshold) * 100, 100);
              const color = SKILL_COLORS[u.stat];
              const typeColors = {
                deal: 'text-emerald-400',
                investor: 'text-blue-400',
                territory: 'text-amber-400',
                quest: 'text-red-400',
              };
              return (
                <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-bold text-sm">{u.label}</p>
                      <p className="text-slate-400 text-xs">{u.description}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 ${typeColors[u.type]} capitalize`}>
                      {u.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0">
                      {SKILL_LABELS[u.stat]} {current}/{u.threshold}
                    </span>
                    <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <Lock className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achieved unlocks */}
      {recentUnlocks.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Unlocked Capabilities
          </h3>
          <div className="flex flex-wrap gap-2">
            {recentUnlocks.map((u, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-emerald-900/20 border border-emerald-700/30 rounded-lg px-3 py-1.5 text-xs"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-300 font-medium">{u.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
