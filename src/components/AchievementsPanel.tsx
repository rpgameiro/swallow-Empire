import { Achievement } from '../types/game';
import { Award, Lock } from 'lucide-react';

interface AchievementsPanelProps {
  achievements: Achievement[];
  unlockedIds: Set<string>;
}

export const AchievementsPanel = ({ achievements, unlockedIds }: AchievementsPanelProps) => {
  const unlockedAchievements = achievements.filter(a => unlockedIds.has(a.id));
  const lockedAchievements = achievements.filter(a => !unlockedIds.has(a.id));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
        <Award className="w-6 h-6" />
        Achievements
      </h2>

      {unlockedAchievements.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-400">Unlocked ({unlockedAchievements.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {unlockedAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-lg p-4 text-center border-2 border-amber-400 shadow-lg shadow-amber-500/20"
              >
                <div className="text-3xl mb-2">{achievement.icon}</div>
                <h4 className="font-bold text-white text-sm">{achievement.name}</h4>
                <p className="text-xs text-amber-100 mt-1">+{achievement.xp_reward} XP</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {lockedAchievements.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-400">Locked ({lockedAchievements.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {lockedAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className="bg-slate-800 rounded-lg p-4 text-center border-2 border-slate-600 opacity-60"
              >
                <Lock className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                <h4 className="font-bold text-slate-400 text-sm">{achievement.name}</h4>
                <p className="text-xs text-slate-500 mt-1">{achievement.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
