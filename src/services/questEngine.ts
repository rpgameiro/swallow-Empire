import { supabase } from './supabase';
import { Player, PlayerDistrict, District, MatchTier } from '../types/game';

export interface DynamicQuest {
  id: string;
  player_id: string;
  quest_type: 'daily' | 'weekly' | 'main' | 'legendary';
  title: string;
  description: string;
  category: string;
  difficulty: number;
  xp_reward: number;
  money_reward: number;
  reputation_reward: number;
  skill_point_reward: number;
  bonus_reward_type: string | null;
  bonus_reward_value: number;
  required_level: number;
  required_reputation: number;
  required_stat: string | null;
  required_stat_value: number;
  district_id: string | null;
  status: 'active' | 'completed' | 'expired' | 'failed';
  progress: number;
  progress_target: number;
  expires_at: string | null;
  generated_at: string;
  completed_at: string | null;
  generation_context: Record<string, unknown>;
  // Provenance — set for missions accepted from AI suggestions
  source: string | null;
  accepted_at: string | null;
}

// ─── Template pools ───────────────────────────────────────────────────────────

const DAILY_TEMPLATES = [
  {
    category: 'analysis',
    titles: ['Morning Market Analysis', 'Competitive Landscape Review', 'Cap Rate Assessment', 'Yield Analysis Sprint', 'RevPAR Benchmarking'],
    descriptions: [
      'Analyse market conditions across your active territories and identify emerging opportunities.',
      'Review competitor positioning in your controlled districts and update your strategic outlook.',
      'Assess capitalisation rates for potential acquisition targets in your pipeline.',
      'Run a quick yield analysis on your current hotel portfolio.',
      'Benchmark RevPAR performance across your territories against regional averages.',
    ],
    baseDifficulty: 1, baseXP: 120, baseRep: 5,
  },
  {
    category: 'networking',
    titles: ['Investor Outreach Call', 'Broker Relationship Check-in', 'Lender Introduction', 'Industry Event Follow-up', 'Advisory Board Touch-base'],
    descriptions: [
      'Strengthen your investor network with a targeted outreach call to a potential capital partner.',
      'Maintain your broker relationships with a strategic check-in call.',
      'Introduce yourself to a new lender active in the Portuguese hotel market.',
      'Follow up on contacts from your last industry event to convert connections into relationships.',
      'Touch base with your advisory board to align on current market priorities.',
    ],
    baseDifficulty: 1, baseXP: 100, baseRep: 10,
  },
  {
    category: 'acquisition',
    titles: ['Property Inspection', 'Site Visit Report', 'Due Diligence Checklist', 'Asset Walk-through', 'Pipeline Review'],
    descriptions: [
      'Conduct a structured property inspection and document your findings.',
      'Complete a site visit report for a hotel asset currently in your pipeline.',
      'Work through a due diligence checklist for an active acquisition target.',
      'Walk through a potential acquisition asset and score it against your investment criteria.',
      'Review and prioritise your current deal pipeline by risk and return profile.',
    ],
    baseDifficulty: 2, baseXP: 150, baseRep: 8,
  },
  {
    category: 'strategy',
    titles: ['Strategy Document Update', 'Investment Thesis Refinement', 'Risk Register Review', 'Portfolio Stress Test', 'Exit Planning Session'],
    descriptions: [
      'Update your investment strategy document to reflect current market conditions.',
      'Refine your investment thesis for an active district based on new data.',
      'Review and update your risk register for current active deals.',
      'Stress test your portfolio assumptions under adverse market scenarios.',
      'Plan exit strategies for mature positions in your portfolio.',
    ],
    baseDifficulty: 2, baseXP: 130, baseRep: 6,
  },
];

const WEEKLY_TEMPLATES = [
  {
    category: 'territory',
    titles: ['District Expansion Drive', 'Territory Consolidation', 'Market Share Push', 'Regional Dominance Sprint', 'Competitive Displacement'],
    descriptions: [
      'Execute a targeted expansion campaign to increase your foothold in a key district.',
      'Consolidate your position in a contested territory by outmanoeuvring competitors.',
      'Drive a coordinated push to increase your market share in this region by 5%.',
      'Deploy resources across a full region to establish clear dominance.',
      'Identify and displace a competitor from their primary market position.',
    ],
    baseDifficulty: 3, baseXP: 500, baseRep: 30,
  },
  {
    category: 'deals',
    titles: ['Close a Significant Deal', 'Sign Advisory Mandate', 'Secure Anchor Investment', 'Execute Asset Acquisition', 'Formalise Partnership'],
    descriptions: [
      'Close a hotel investment deal that materially advances your advisory reputation.',
      'Sign a new advisory mandate with an institutional client.',
      'Secure an anchor investment commitment from a key capital partner.',
      'Execute a full asset acquisition through to signed heads of terms.',
      'Formalise a strategic partnership with a complementary advisory firm.',
    ],
    baseDifficulty: 3, baseXP: 650, baseRep: 40,
  },
  {
    category: 'portfolio',
    titles: ['Portfolio Review Week', 'Performance Audit', 'Asset Rebalancing', 'Underperformer Resolution', 'Value-Add Initiative'],
    descriptions: [
      'Conduct a comprehensive weekly review of your entire advisory portfolio.',
      'Audit performance across all active mandates and identify improvement areas.',
      'Rebalance your district exposure to optimise risk-adjusted returns.',
      'Resolve an underperforming position in your portfolio.',
      'Initiate a value-add programme for a strategic asset.',
    ],
    baseDifficulty: 2, baseXP: 450, baseRep: 25,
  },
];

const MAIN_TEMPLATES = [
  {
    category: 'story',
    titles: [
      'Establish Your Lisboa Presence',
      'The Northern Alliance — Porto',
      'Conquer the Algarve Gateway',
      'Alentejo Heartland',
      'Island Authority — Madeira',
      'Island Authority — Açores',
      'Central Portugal Circuit',
      'National Advisory Network',
    ],
    descriptions: [
      'Cement your advisory presence in Lisboa by reaching 25% market dominance in the capital district.',
      'Build a strategic alliance in Porto — the gateway to the Northern market. Reach T3 territory level.',
      'Establish a premium position in Faro, controlling the Algarve hospitality investment landscape.',
      'Penetrate the Alentejo interior and build advisory mandates across Évora and Beja.',
      'Secure Madeira as your first island stronghold and establish luxury hotel advisory credentials.',
      'Reach the Açores and complete your Atlantic island strategy.',
      'Build simultaneous presence across Leiria, Santarém, and Coimbra to dominate the Central region.',
      'Achieve active status in all 12 Portuguese districts. The empire is yours.',
    ],
    difficulty: [2, 2, 3, 2, 4, 4, 3, 5],
    xpRewards: [1000, 1200, 1800, 1000, 2500, 2500, 1500, 5000],
    repRewards: [50, 60, 90, 50, 120, 120, 75, 250],
  },
];

const LEGENDARY_TEMPLATES = [
  {
    category: 'ultimate',
    title: 'Empire Builder',
    description: 'Control 10 or more districts simultaneously with at least 50% market dominance in each. The ultimate display of advisory supremacy.',
    difficulty: 5, xp: 5000, rep: 500, spReward: 3,
    requiredLevel: 20, requiredRep: 200,
  },
  {
    category: 'ultimate',
    title: 'No Compromise',
    description: 'Maintain a 30-day no-trading streak without a single penalty. Discipline defines the empire.',
    difficulty: 3, xp: 3000, rep: 300, spReward: 2,
    requiredLevel: 10, requiredRep: 100,
  },
  {
    category: 'ultimate',
    title: 'Boutique Excellence',
    description: 'Reach Level 25 while holding active advisory mandates in at least 8 districts. Quality over quantity — always.',
    difficulty: 4, xp: 4000, rep: 400, spReward: 2,
    requiredLevel: 15, requiredRep: 150,
  },
  {
    category: 'ultimate',
    title: 'Reputation Forged',
    description: 'Accumulate 500 total reputation points through advisory success alone. Your name is the brand.',
    difficulty: 4, xp: 4500, rep: 0, spReward: 2,
    requiredLevel: 10, requiredRep: 0,
  },
  {
    category: 'ultimate',
    title: 'The Swallow Standard',
    description: 'Complete every main quest and every weekly quest in a single season. Comprehensive mastery.',
    difficulty: 5, xp: 6000, rep: 600, spReward: 4,
    requiredLevel: 30, requiredRep: 300,
  },
];

// ─── Generator ────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function seededIndex(seed: number, len: number): number {
  return seed % len;
}

function dailyExpiry(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function weeklyExpiry(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export interface QuestGeneratorContext {
  player: Player;
  playerDistricts: Map<string, PlayerDistrict>;
  districts: District[];
  existingActive: DynamicQuest[];
}

function xpScaledByLevel(base: number, level: number): number {
  return Math.round(base * (1 + (level - 1) * 0.08));
}

// Money reward in € — scales with level and difficulty
function moneyReward(baseMoney: number, level: number, difficulty: number): number {
  return Math.round(baseMoney * (1 + (level - 1) * 0.1) * (1 + (difficulty - 1) * 0.25));
}

function difficultyFromLevel(base: number, level: number): number {
  return Math.min(5, base + Math.floor(level / 10));
}

export function generateDailyQuests(ctx: QuestGeneratorContext): Omit<DynamicQuest, 'id' | 'generated_at'>[] {
  const { player, playerDistricts, districts } = ctx;
  const results: Omit<DynamicQuest, 'id' | 'generated_at'>[] = [];
  const expiry = dailyExpiry();
  const seed = new Date().getDate() + player.level;

  // Generate 4 daily quests — one per category archetype
  const categoriesUsed = new Set<string>();

  for (let i = 0; i < 4; i++) {
    const pool = DAILY_TEMPLATES[seededIndex(seed + i, DAILY_TEMPLATES.length)];
    const titleIdx = seededIndex(seed * (i + 1), pool.titles.length);

    if (categoriesUsed.has(pool.category)) continue;
    categoriesUsed.add(pool.category);

    // Pick a relevant district if player has active ones
    const activeDistrictIds = Array.from(playerDistricts.keys());
    const districtId = activeDistrictIds.length > 0
      ? activeDistrictIds[seededIndex(seed + i, activeDistrictIds.length)]
      : null;

    const diff = difficultyFromLevel(pool.baseDifficulty, player.level);
    const xp = xpScaledByLevel(pool.baseXP, player.level);

    results.push({
      player_id: player.id,
      quest_type: 'daily',
      title: pool.titles[titleIdx],
      description: pool.descriptions[titleIdx],
      category: pool.category,
      difficulty: diff,
      xp_reward: xp,
      money_reward: moneyReward(500, player.level, diff),
      reputation_reward: pool.baseRep,
      skill_point_reward: diff >= 3 ? 1 : 0,
      bonus_reward_type: pool.category === 'acquisition' ? 'district_xp' : null,
      bonus_reward_value: pool.category === 'acquisition' ? 50 : 0,
      required_level: 1,
      required_reputation: 0,
      required_stat: null,
      required_stat_value: 0,
      district_id: districtId,
      status: 'active',
      progress: 0,
      progress_target: 1,
      expires_at: expiry,
      completed_at: null,
      generation_context: { level: player.level, rep: player.reputation, seed },
      source: null,
      accepted_at: null,
    });
  }

  return results;
}

export function generateWeeklyQuests(ctx: QuestGeneratorContext): Omit<DynamicQuest, 'id' | 'generated_at'>[] {
  const { player, playerDistricts, districts } = ctx;
  const results: Omit<DynamicQuest, 'id' | 'generated_at'>[] = [];
  const expiry = weeklyExpiry();
  const weekNum = Math.ceil(new Date().getDate() / 7) + player.level;

  for (let i = 0; i < 3; i++) {
    const pool = WEEKLY_TEMPLATES[i % WEEKLY_TEMPLATES.length];
    const titleIdx = seededIndex(weekNum + i, pool.titles.length);

    // District-focused weeklies use a specific controlled district
    const activeDistrictIds = Array.from(playerDistricts.keys());
    const districtId = activeDistrictIds.length > 0
      ? activeDistrictIds[seededIndex(weekNum + i, activeDistrictIds.length)]
      : null;

    const diff = difficultyFromLevel(pool.baseDifficulty, player.level);
    const xp = xpScaledByLevel(pool.baseXP, player.level);

    results.push({
      player_id: player.id,
      quest_type: 'weekly',
      title: pool.titles[titleIdx],
      description: pool.descriptions[titleIdx],
      category: pool.category,
      difficulty: diff,
      xp_reward: xp,
      money_reward: moneyReward(2000, player.level, diff),
      reputation_reward: pool.baseRep,
      skill_point_reward: diff >= 4 ? 1 : 0,
      bonus_reward_type: pool.category === 'territory' ? 'market_share' : null,
      bonus_reward_value: pool.category === 'territory' ? 5 : 0,
      required_level: Math.max(1, player.level - 2),
      required_reputation: Math.max(0, player.reputation - 20),
      required_stat: null,
      required_stat_value: 0,
      district_id: districtId,
      status: 'active',
      progress: 0,
      progress_target: 1,
      expires_at: expiry,
      completed_at: null,
      generation_context: { level: player.level, rep: player.reputation, weekNum },
      source: null,
      accepted_at: null,
    });
  }

  return results;
}

export function generateMainQuests(ctx: QuestGeneratorContext): Omit<DynamicQuest, 'id' | 'generated_at'>[] {
  const { player, playerDistricts, districts } = ctx;
  const t = MAIN_TEMPLATES[0];
  const results: Omit<DynamicQuest, 'id' | 'generated_at'>[] = [];

  t.titles.forEach((title, i) => {
    // Match district if name appears in title
    const districtName = districts.find(d => title.includes(d.name));
    const districtId = districtName?.id ?? null;

    results.push({
      player_id: player.id,
      quest_type: 'main',
      title,
      description: t.descriptions[i],
      category: 'story',
      difficulty: t.difficulty[i],
      xp_reward: t.xpRewards[i],
      money_reward: moneyReward(5000, player.level, t.difficulty[i]),
      reputation_reward: t.repRewards[i],
      skill_point_reward: t.difficulty[i] >= 4 ? 2 : 1,
      bonus_reward_type: 'stat_leadership',
      bonus_reward_value: t.difficulty[i],
      required_level: Math.max(1, (i + 1) * 2),
      required_reputation: i * 20,
      required_stat: null,
      required_stat_value: 0,
      district_id: districtId ?? null,
      status: 'active',
      progress: 0,
      progress_target: 1,
      expires_at: null,
      completed_at: null,
      generation_context: { level: player.level, storyIndex: i },
      source: null,
      accepted_at: null,
    });
  });

  return results;
}

export function generateLegendaryQuests(ctx: QuestGeneratorContext): Omit<DynamicQuest, 'id' | 'generated_at'>[] {
  const { player } = ctx;
  return LEGENDARY_TEMPLATES
    .filter(t => player.level >= t.requiredLevel && player.reputation >= t.requiredRep)
    .map(t => ({
      player_id: player.id,
      quest_type: 'legendary' as const,
      title: t.title,
      description: t.description,
      category: t.category,
      difficulty: t.difficulty,
      xp_reward: t.xp,
      money_reward: moneyReward(20000, player.level, t.difficulty),
      reputation_reward: t.rep,
      skill_point_reward: t.spReward,
      bonus_reward_type: 'stat_negotiation',
      bonus_reward_value: 5,
      required_level: t.requiredLevel,
      required_reputation: t.requiredRep,
      required_stat: null,
      required_stat_value: 0,
      district_id: null,
      status: 'active' as const,
      progress: 0,
      progress_target: 1,
      expires_at: null,
      completed_at: null,
      generation_context: { level: player.level, rep: player.reputation },
      source: null,
      accepted_at: null,
    }));
}

// ─── Match-driven quest generation ───────────────────────────────────────────

export interface MatchQuestContext {
  playerId: string;
  playerLevel: number;
  investorName: string;
  ownerName: string;
  tier: MatchTier;
  districtId: string | null;
  matchScore: number;
  opportunityType: string;
}

interface MatchQuestTemplate {
  title: (ctx: MatchQuestContext) => string;
  description: (ctx: MatchQuestContext) => string;
  category: string;
  // Reward multipliers relative to tier base
  xpMultiplier: number;
  moneyMultiplier: number;
  reputationMultiplier: number;
  // Bonus reward type applied to district or empire
  bonusRewardType: 'district_dominance' | 'empire_value' | 'broker_rep' | null;
  bonusRewardValue: (tier: MatchTier) => number;
  difficulty: (tier: MatchTier) => number;
  // Number of days until this step expires
  expiryDays: number;
}

const MATCH_QUEST_STEPS: MatchQuestTemplate[] = [
  {
    title: ctx => `Contact ${ctx.investorName}`,
    description: ctx =>
      `Reach out to ${ctx.investorName} and present the opportunity with ${ctx.ownerName}. Confirm their current mandate and appetite for a ${ctx.opportunityType.toLowerCase()}.`,
    category: 'networking',
    xpMultiplier: 0.5,
    moneyMultiplier: 0.2,
    reputationMultiplier: 0.3,
    bonusRewardType: null,
    bonusRewardValue: () => 0,
    difficulty: tier => (tier === 'legendary' ? 3 : 2),
    expiryDays: 3,
  },
  {
    title: ctx => `Schedule Intro Call — ${ctx.investorName} × ${ctx.ownerName}`,
    description: ctx =>
      `Arrange and confirm a mutual introductory call between ${ctx.investorName} and ${ctx.ownerName}. Set the agenda and send a briefing note to both parties.`,
    category: 'networking',
    xpMultiplier: 0.7,
    moneyMultiplier: 0.3,
    reputationMultiplier: 0.5,
    bonusRewardType: 'broker_rep',
    bonusRewardValue: tier => (tier === 'legendary' ? 15 : 8),
    difficulty: tier => (tier === 'legendary' ? 3 : 2),
    expiryDays: 5,
  },
  {
    title: ctx => `Organise Site Visit`,
    description: ctx =>
      `Coordinate a physical site visit to the asset with ${ctx.investorName}. Prepare the property brief, arrange logistics, and accompany the investor.`,
    category: 'acquisition',
    xpMultiplier: 1.0,
    moneyMultiplier: 0.5,
    reputationMultiplier: 0.7,
    bonusRewardType: 'district_dominance',
    bonusRewardValue: tier => (tier === 'legendary' ? 80 : 40),
    difficulty: tier => (tier === 'legendary' ? 4 : 3),
    expiryDays: 7,
  },
  {
    title: ctx => `Send Investment Deck`,
    description: ctx =>
      `Prepare and deliver a tailored investment deck to ${ctx.investorName} covering the ${ctx.ownerName} asset. Include financial projections, market comparables, and deal structure.`,
    category: 'strategy',
    xpMultiplier: 1.2,
    moneyMultiplier: 0.8,
    reputationMultiplier: 0.8,
    bonusRewardType: 'empire_value',
    bonusRewardValue: tier => (tier === 'legendary' ? 100000 : 50000),
    difficulty: tier => (tier === 'legendary' ? 4 : 3),
    expiryDays: 7,
  },
  {
    title: ctx => `Negotiate Terms`,
    description: ctx =>
      `Lead the negotiation between ${ctx.investorName} and ${ctx.ownerName}. Align on deal structure, price, and timeline. Aim to secure signed heads of terms.`,
    category: 'deals',
    xpMultiplier: 2.0,
    moneyMultiplier: 2.0,
    reputationMultiplier: 2.0,
    bonusRewardType: 'district_dominance',
    bonusRewardValue: tier => (tier === 'legendary' ? 200 : 100),
    difficulty: tier => (tier === 'legendary' ? 5 : 4),
    expiryDays: 14,
  },
];

// Tier base rewards that step multipliers scale from
const TIER_BASE: Record<MatchTier, { xp: number; money: number; rep: number }> = {
  legendary:       { xp: 800,  money: 50000, rep: 30 },
  strong:          { xp: 350,  money: 20000, rep: 15 },
  warm:            { xp: 150,  money: 8000,  rep: 6  },
  low:             { xp: 50,   money: 2000,  rep: 2  },
  budget_mismatch: { xp: 0,    money: 0,     rep: 0  },
  incomplete_data: { xp: 0,    money: 0,     rep: 0  },
};

// Steps generated per tier (higher tiers unlock more steps)
const TIER_STEP_COUNT: Record<MatchTier, number> = {
  legendary:       5,
  strong:          4,
  warm:            2,
  low:             1,
  budget_mismatch: 0,
  incomplete_data: 0,
};

export function generateMatchQuests(ctx: MatchQuestContext): Omit<DynamicQuest, 'id' | 'generated_at'>[] {
  const base = TIER_BASE[ctx.tier];
  const stepCount = TIER_STEP_COUNT[ctx.tier];
  const steps = MATCH_QUEST_STEPS.slice(0, stepCount);
  const questType: DynamicQuest['quest_type'] = ctx.tier === 'legendary' ? 'legendary' : 'weekly';

  return steps.map((tpl, idx) => {
    const expiresAt = new Date(
      Date.now() + tpl.expiryDays * 24 * 60 * 60 * 1000
    ).toISOString();

    return {
      player_id:           ctx.playerId,
      quest_type:          questType,
      title:               tpl.title(ctx),
      description:         tpl.description(ctx),
      category:            tpl.category,
      difficulty:          tpl.difficulty(ctx.tier),
      xp_reward:           Math.round(base.xp * tpl.xpMultiplier),
      money_reward:        Math.round(base.money * tpl.moneyMultiplier),
      reputation_reward:   Math.round(base.rep * tpl.reputationMultiplier),
      skill_point_reward:  idx === steps.length - 1 && ctx.tier === 'legendary' ? 1 : 0,
      bonus_reward_type:   tpl.bonusRewardType,
      bonus_reward_value:  tpl.bonusRewardValue(ctx.tier),
      required_level:      ctx.tier === 'legendary' ? Math.max(ctx.playerLevel - 2, 1) : 1,
      required_reputation: 0,
      required_stat:       null,
      required_stat_value: 0,
      district_id:         ctx.districtId,
      status:              'active' as const,
      progress:            0,
      progress_target:     1,
      expires_at:          expiresAt,
      completed_at:        null,
      generation_context:  {
        source:       'lead_match',
        tier:         ctx.tier,
        match_score:  ctx.matchScore,
        step_index:   idx,
      },
      source: null,
      accepted_at: null,
    };
  });
}

// ─── DB operations ────────────────────────────────────────────────────────────

export const getDynamicQuests = async (playerId: string): Promise<DynamicQuest[]> => {
  const { data, error } = await supabase
    .from('dynamic_quests')
    .select('*')
    .eq('player_id', playerId)
    .order('generated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const insertDynamicQuests = async (
  quests: Omit<DynamicQuest, 'id' | 'generated_at'>[]
): Promise<DynamicQuest[]> => {
  const { data, error } = await supabase
    .from('dynamic_quests')
    .insert(quests)
    .select();

  if (error) throw error;
  return data ?? [];
};

export const completeDynamicQuest = async (questId: string): Promise<DynamicQuest> => {
  const { data, error } = await supabase
    .from('dynamic_quests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', questId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const expireDynamicQuests = async (playerId: string): Promise<void> => {
  const now = new Date().toISOString();
  await supabase
    .from('dynamic_quests')
    .update({ status: 'expired' })
    .eq('player_id', playerId)
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lt('expires_at', now);
};

export const refreshDailyQuests = async (ctx: QuestGeneratorContext): Promise<DynamicQuest[]> => {
  // Expire stale dailies
  await expireDynamicQuests(ctx.player.id);

  // Check if we already have active dailies generated today
  const today = new Date().toDateString();
  const alreadyGenerated = ctx.existingActive.some(q => {
    const genDate = new Date(q.generated_at).toDateString();
    return q.quest_type === 'daily' && genDate === today;
  });

  if (alreadyGenerated) return ctx.existingActive.filter(q => q.quest_type === 'daily' && q.status === 'active');

  const quests = generateDailyQuests(ctx);
  return insertDynamicQuests(quests);
};

export const refreshWeeklyQuests = async (ctx: QuestGeneratorContext): Promise<DynamicQuest[]> => {
  const thisWeek = getWeekKey();
  const alreadyGenerated = ctx.existingActive.some(q => {
    const genWeek = getWeekKeyFromDate(new Date(q.generated_at));
    return q.quest_type === 'weekly' && genWeek === thisWeek;
  });

  if (alreadyGenerated) return ctx.existingActive.filter(q => q.quest_type === 'weekly' && q.status === 'active');

  const quests = generateWeeklyQuests(ctx);
  return insertDynamicQuests(quests);
};

export const ensureMainQuests = async (ctx: QuestGeneratorContext): Promise<DynamicQuest[]> => {
  const hasMain = ctx.existingActive.some(q => q.quest_type === 'main');
  const hasCompleted = ctx.existingActive.filter(q => q.quest_type === 'main' && q.status === 'completed');

  if (hasMain && (ctx.existingActive.filter(q => q.quest_type === 'main' && q.status === 'active').length > 0)) {
    return ctx.existingActive.filter(q => q.quest_type === 'main');
  }

  const allMain = generateMainQuests(ctx);
  // Only insert ones we don't already have (by title)
  const existingTitles = new Set(ctx.existingActive.filter(q => q.quest_type === 'main').map(q => q.title));
  const newOnes = allMain.filter(q => !existingTitles.has(q.title));
  if (newOnes.length === 0) return ctx.existingActive.filter(q => q.quest_type === 'main');

  const inserted = await insertDynamicQuests(newOnes);
  return [...ctx.existingActive.filter(q => q.quest_type === 'main'), ...inserted];
};

export const ensureLegendaryQuests = async (ctx: QuestGeneratorContext): Promise<DynamicQuest[]> => {
  const existing = ctx.existingActive.filter(q => q.quest_type === 'legendary');
  const generated = generateLegendaryQuests(ctx);
  const existingTitles = new Set(existing.map(q => q.title));
  const newOnes = generated.filter(q => !existingTitles.has(q.title));

  if (newOnes.length === 0) return existing;
  const inserted = await insertDynamicQuests(newOnes);
  return [...existing, ...inserted];
};

// ─── Timer helpers ────────────────────────────────────────────────────────────

export function timeRemaining(expiresAt: string | null): { label: string; urgent: boolean; expired: boolean } {
  if (!expiresAt) return { label: 'No limit', urgent: false, expired: false };

  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: 'Expired', urgent: false, expired: true };

  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const urgent = ms < 2 * 3_600_000; // under 2h

  if (h >= 24) {
    const d = Math.floor(h / 24);
    return { label: `${d}d ${h % 24}h`, urgent: false, expired: false };
  }
  if (h > 0) return { label: `${h}h ${m}m`, urgent: h < 2, expired: false };
  return { label: `${m}m`, urgent: true, expired: false };
}

function getWeekKey(): string {
  return getWeekKeyFromDate(new Date());
}

function getWeekKeyFromDate(d: Date): string {
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}
