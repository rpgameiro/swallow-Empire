import { createClient } from '@supabase/supabase-js';
import { Player, PlayerDistrict, LevelReward, PlayerReputation } from '../types/game';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

const K = 'swallow_empire_';

// ─── Player ───────────────────────────────────────────────────────────────────

export const loadOrCreatePlayer = async (): Promise<Player> => {
  const cached = localStorage.getItem(K + 'player');
  if (cached) {
    const p: Player = JSON.parse(cached);
    // Validate: if this player has no leads but another player does, switch to that player
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', p.id);
    if ((count ?? 0) > 0) return p;
    // This cached player has no leads — check if any player has leads
    const { data: playerWithLeads } = await supabase
      .from('leads')
      .select('player_id')
      .limit(1)
      .maybeSingle();
    if (playerWithLeads?.player_id && playerWithLeads.player_id !== p.id) {
      const { data: betterPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerWithLeads.player_id)
        .maybeSingle();
      if (betterPlayer) {
        localStorage.setItem(K + 'player', JSON.stringify(betterPlayer));
        return betterPlayer;
      }
    }
    return p;
  }

  // Try to load the player that has leads (most active), falling back to most recent
  const { data: playerWithLeads } = await supabase
    .from('leads')
    .select('player_id')
    .limit(1)
    .maybeSingle();

  if (playerWithLeads?.player_id) {
    const { data: existing } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerWithLeads.player_id)
      .maybeSingle();
    if (existing) {
      localStorage.setItem(K + 'player', JSON.stringify(existing));
      return existing;
    }
  }

  // Fallback: most recently created player
  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    localStorage.setItem(K + 'player', JSON.stringify(existing));
    return existing;
  }

  // No players exist yet — create the first one
  const { data, error } = await supabase
    .from('players')
    .insert([{
      name: 'Ricardo Gameiro',
      level: 1, total_xp: 0, current_xp: 0, xp_to_next_level: 1000,
      focus: 10, discipline: 10, reputation: 0, no_trading_streak: 0,
      negotiation: 10, networking: 10, leadership: 10,
      skill_points: 3, total_skill_points_earned: 3,
      money: 0, monthly_income: 0, empire_value: 0,
      energy: 80, max_energy: 100, stress: 20, morale: 75,
    }])
    .select()
    .single();

  if (error) throw error;

  await supabase.from('player_stats').insert([{
    player_id: data.id,
    deals_closed: 0, properties_acquired: 0, total_investment: 0,
    contracts_violated: 0, trades_executed: 0, quest_completed: 0,
  }]);

  const { data: allQuests } = await supabase.from('quests').select('id');
  if (allQuests) {
    for (const q of allQuests) {
      await supabase.from('player_quests').insert([{ player_id: data.id, quest_id: q.id, status: 'active' }]);
    }
  }

  localStorage.setItem(K + 'player', JSON.stringify(data));
  return data;
};

export const getPlayerStats = async (playerId: string) => {
  const cached = localStorage.getItem(K + 'stats_' + playerId);
  if (cached) return JSON.parse(cached);

  const { data, error } = await supabase
    .from('player_stats').select('*').eq('player_id', playerId).maybeSingle();
  if (error) throw error;
  localStorage.setItem(K + 'stats_' + playerId, JSON.stringify(data));
  return data;
};

export const updatePlayer = async (playerId: string, updates: Record<string, unknown>): Promise<Player> => {
  const { data, error } = await supabase
    .from('players').update(updates).eq('id', playerId).select().single();
  if (error) throw error;
  localStorage.setItem(K + 'player', JSON.stringify(data));
  return data;
};

// ─── Level Rewards ────────────────────────────────────────────────────────────

export const getLevelRewards = async (): Promise<LevelReward[]> => {
  const cached = localStorage.getItem(K + 'level_rewards');
  if (cached) return JSON.parse(cached);

  const { data, error } = await supabase.from('level_rewards').select('*').order('level');
  if (error) throw error;
  localStorage.setItem(K + 'level_rewards', JSON.stringify(data));
  return data ?? [];
};

export const recordLevelUp = async (playerId: string, level: number) => {
  await supabase.from('player_level_history').insert([{ player_id: playerId, level_reached: level }]);
};

// ─── Districts ────────────────────────────────────────────────────────────────

export const getDistricts = async () => {
  const { data, error } = await supabase.from('districts').select('*');
  if (error) throw error;
  return data;
};

export const getPlayerDistricts = async (playerId: string): Promise<PlayerDistrict[]> => {
  const { data, error } = await supabase
    .from('player_districts').select('*').eq('player_id', playerId);
  if (error) throw error;
  return data ?? [];
};

export const enterDistrict = async (playerId: string, districtId: string): Promise<PlayerDistrict> => {
  const { data: existing } = await supabase
    .from('player_districts').select('*')
    .eq('player_id', playerId).eq('district_id', districtId).maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase.from('player_districts').insert([{
    player_id: playerId, district_id: districtId,
    control_level: 0, hotels_invested: 0, market_share: 0.03,
    territory_level: 1, district_reputation: 0, is_unlocked: true,
    opportunities_unlocked: 1, dominance_xp: 0,
  }]).select().single();

  if (error) throw error;
  return data;
};

export const progressDistrictTerritory = async (
  playerId: string, districtId: string, xpGained: number, repGained: number
): Promise<PlayerDistrict> => {
  const { data: pd } = await supabase
    .from('player_districts').select('*')
    .eq('player_id', playerId).eq('district_id', districtId).maybeSingle();

  if (!pd) throw new Error('District not active');

  const newDomXP = pd.dominance_xp + xpGained;
  const newRep = pd.district_reputation + repGained;
  const newMarketShare = Math.min(pd.market_share + 0.04, 1.0);
  const thresholds = [0, 200, 500, 1000, 2000, 4000];

  let newLevel = pd.territory_level;
  for (let l = pd.territory_level; l < 5; l++) {
    if (newDomXP >= thresholds[l + 1]) newLevel = l + 1;
    else break;
  }

  const { data, error } = await supabase.from('player_districts').update({
    dominance_xp: newDomXP,
    district_reputation: newRep,
    market_share: newMarketShare,
    territory_level: newLevel,
    opportunities_unlocked: Math.min(1 + newLevel, 5),
    last_quest_completed_at: new Date().toISOString(),
  }).eq('id', pd.id).select().single();

  if (error) throw error;
  return data;
};

export const investInDistrictDB = async (playerId: string, districtId: string): Promise<PlayerDistrict> => {
  const { data: pd } = await supabase
    .from('player_districts').select('*')
    .eq('player_id', playerId).eq('district_id', districtId).maybeSingle();

  if (!pd) throw new Error('District not active');

  const { data, error } = await supabase.from('player_districts').update({
    hotels_invested: pd.hotels_invested + 1,
    market_share: Math.min(pd.market_share + 0.05, 1.0),
  }).eq('id', pd.id).select().single();

  if (error) throw error;
  return data;
};

// ─── Quests ───────────────────────────────────────────────────────────────────

export const getQuests = async () => {
  const cached = localStorage.getItem(K + 'quests');
  if (cached) return JSON.parse(cached);
  const { data, error } = await supabase.from('quests').select('*');
  if (error) throw error;
  localStorage.setItem(K + 'quests', JSON.stringify(data));
  return data;
};

export const getPlayerQuests = async (playerId: string) => {
  const { data, error } = await supabase
    .from('player_quests')
    .select(`id, quest_id, status, progress, xp_earned,
      quests:quest_id (id, title, description, quest_type, category, xp_reward, difficulty)`)
    .eq('player_id', playerId);
  if (error) throw error;
  return data;
};

export const completeQuestDB = async (playerId: string, questId: string, xpEarned: number) => {
  await supabase.from('player_quests')
    .update({ status: 'completed', xp_earned: xpEarned })
    .eq('player_id', playerId).eq('quest_id', questId);
};

// ─── AI Suggestions ───────────────────────────────────────────────────────────

import type { AISuggestion } from '../types/game';

export async function getAISuggestions(playerId: string): Promise<AISuggestion[]> {
  const now = new Date().toISOString();

  const { error: wakeError } = await supabase
    .from('ai_suggestions')
    .update({ status: 'pending', snoozed_until: null })
    .eq('player_id', playerId)
    .eq('status', 'snoozed')
    .lte('snoozed_until', now);
  if (wakeError) console.error('Failed to wake snoozed suggestions:', wakeError);

  const { data, error } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('player_id', playerId)
    .in('status', ['pending', 'accepted'])
    .gt('expires_at', now)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertAISuggestions(
  suggestions: Omit<AISuggestion, 'id' | 'created_at' | 'updated_at' | 'snoozed_until'>[],
): Promise<AISuggestion[]> {
  const { data, error } = await supabase
    .from('ai_suggestions')
    .insert(suggestions)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function acceptAISuggestion(suggestionId: string, questId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_suggestions')
    .update({ status: 'accepted', accepted_quest_id: questId })
    .eq('id', suggestionId);
  if (error) throw error;
}

export async function dismissAISuggestion(suggestionId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_suggestions')
    .update({ status: 'dismissed' })
    .eq('id', suggestionId);
  if (error) throw error;
}

export async function snoozeSuggestion(
  suggestionId: string,
  snoozedUntil: Date,
): Promise<void> {
  const { error } = await supabase
    .from('ai_suggestions')
    .update({ status: 'snoozed', snoozed_until: snoozedUntil.toISOString() })
    .eq('id', suggestionId);
  if (error) throw error;
}

// ─── Accept mission (AI suggestion → real active quest) ───────────────────────
//
// Inserts the quest and marks the suggestion accepted in a single logical operation.
// Both writes use the same client-generated questId so they can run concurrently.
// Throws on any failure so the caller can roll back optimistic UI.

export interface AcceptedMissionQuest {
  id: string;
  player_id: string;
  quest_type: 'daily';
  title: string;
  description: string;
  category: string;
  difficulty: number;
  xp_reward: number;
  money_reward: number;
  reputation_reward: number;
  skill_point_reward: number;
  bonus_reward_type: null;
  bonus_reward_value: number;
  required_level: number;
  required_reputation: number;
  required_stat: null;
  required_stat_value: number;
  district_id: null;
  status: 'active';
  progress: number;
  progress_target: number;
  expires_at: string;
  generated_at: string;
  completed_at: null;
  generation_context: Record<string, unknown>;
  source: 'ai_mission';
  accepted_at: string;
}

export async function acceptMission(
  suggestion: AISuggestion,
  playerId: string,
): Promise<AcceptedMissionQuest> {
  const questId    = crypto.randomUUID();
  const acceptedAt = new Date().toISOString();

  const quest: AcceptedMissionQuest = {
    id:                  questId,
    player_id:           playerId,
    quest_type:          'daily',
    title:               suggestion.title,
    description:         suggestion.description,
    category:            suggestion.category,
    difficulty:          suggestion.difficulty,
    xp_reward:           suggestion.estimated_xp,
    money_reward:        suggestion.estimated_money,
    reputation_reward:   Math.round(suggestion.estimated_xp / 20),
    skill_point_reward:  suggestion.difficulty >= 4 ? 1 : 0,
    bonus_reward_type:   null,
    bonus_reward_value:  0,
    required_level:      1,
    required_reputation: 0,
    required_stat:       null,
    required_stat_value: 0,
    district_id:         null,
    status:              'active',
    progress:            0,
    progress_target:     1,
    expires_at:          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    generated_at:        acceptedAt,
    completed_at:        null,
    generation_context:  { source: 'ai_mission', suggestion_id: suggestion.id },
    source:              'ai_mission',
    accepted_at:         acceptedAt,
  };

  // Both writes are independent — run concurrently
  const [insertResult] = await Promise.all([
    supabase.from('dynamic_quests').insert(quest).select().single(),
    supabase
      .from('ai_suggestions')
      .update({ status: 'accepted', accepted_quest_id: questId })
      .eq('id', suggestion.id),
  ]);

  if (insertResult.error) throw insertResult.error;
  return insertResult.data as AcceptedMissionQuest;
}

export async function expireOldAISuggestions(playerId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_suggestions')
    .update({ status: 'expired' })
    .eq('player_id', playerId)
    .in('status', ['pending', 'snoozed'])
    .lt('expires_at', new Date().toISOString());
  if (error) throw error;
}

// ─── Official Quests ──────────────────────────────────────────────────────────

export async function getOfficialQuests() {
  const { data, error } = await supabase
    .from('official_quests')
    .select('*')
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export const incrementPlayerStats = async (
  playerId: string,
  delta: Partial<{ deals_closed: number; properties_acquired: number; total_investment: number }>
) => {
  const { data: existing } = await supabase
    .from('player_stats').select('*').eq('player_id', playerId).maybeSingle();
  if (!existing) return;
  const updates: Record<string, number> = {};
  if (delta.deals_closed)       updates.deals_closed       = existing.deals_closed + delta.deals_closed;
  if (delta.properties_acquired) updates.properties_acquired = existing.properties_acquired + delta.properties_acquired;
  if (delta.total_investment)    updates.total_investment    = existing.total_investment + delta.total_investment;
  updates.updated_at = Date.now();
  await supabase.from('player_stats').update(updates).eq('player_id', playerId);
  // bust cache
  localStorage.removeItem('swallow_empire_stats_' + playerId);
};

// ─── Achievements ─────────────────────────────────────────────────────────────

export const getAchievements = async () => {
  const cached = localStorage.getItem(K + 'achievements');
  if (cached) return JSON.parse(cached);
  const { data, error } = await supabase.from('achievements').select('*');
  if (error) throw error;
  localStorage.setItem(K + 'achievements', JSON.stringify(data));
  return data;
};

export const getPlayerAchievements = async (playerId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('player_achievements').select('achievement_id').eq('player_id', playerId);
  if (error) throw error;
  return data?.map(a => a.achievement_id) ?? [];
};

export const unlockAchievementDB = async (playerId: string, achievementId: string) => {
  await supabase.from('player_achievements').insert([{ player_id: playerId, achievement_id: achievementId }]);
};

// ─── Office Upgrades ──────────────────────────────────────────────────────────

export const getOfficeUpgrades = async () => {
  const cached = localStorage.getItem(K + 'office_upgrades');
  if (cached) return JSON.parse(cached);
  const { data, error } = await supabase
    .from('office_upgrades')
    .select('*')
    .order('tier');
  if (error) throw error;
  localStorage.setItem(K + 'office_upgrades', JSON.stringify(data));
  return data ?? [];
};

export const getPurchasedUpgrades = async (playerId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('player_office_upgrades')
    .select('upgrade_id')
    .eq('player_id', playerId);
  if (error) throw error;
  return data?.map(r => r.upgrade_id) ?? [];
};

export const purchaseOfficeUpgrade = async (playerId: string, upgradeId: string): Promise<void> => {
  await supabase.from('player_office_upgrades').insert([{ player_id: playerId, upgrade_id: upgradeId }]);
};

// ─── Reputation ───────────────────────────────────────────────────────────────

export const getOrCreateReputation = async (playerId: string): Promise<PlayerReputation> => {
  const { data: existing } = await supabase
    .from('player_reputation').select('*').eq('player_id', playerId).maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('player_reputation')
    .insert([{ player_id: playerId }])
    .select().single();
  if (error) throw error;
  return data;
};

export const updateReputation = async (
  playerId: string,
  delta: Partial<{
    investor_rep: number; owner_rep: number; market_rep: number;
    operator_rep: number; broker_rep: number; luxury_rep: number;
  }>
): Promise<PlayerReputation> => {
  const { data: existing } = await supabase
    .from('player_reputation').select('*').eq('player_id', playerId).maybeSingle();
  if (!existing) throw new Error('Reputation row missing');

  const updates: Record<string, number> = {};
  const tracks = ['investor', 'owner', 'market', 'operator', 'broker', 'luxury'] as const;
  for (const track of tracks) {
    const key = `${track}_rep` as keyof typeof delta;
    const val = delta[key];
    if (val) {
      updates[key] = (existing[key] as number) + val;
      updates[`${track}_rep_total`] = (existing[`${track}_rep_total` as keyof typeof existing] as number) + val;
    }
  }

  const { data, error } = await supabase
    .from('player_reputation').update(updates).eq('player_id', playerId).select().single();
  if (error) throw error;
  return data;
};
