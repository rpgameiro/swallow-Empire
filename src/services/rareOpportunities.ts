import { ActiveRareOpportunity, RareOpportunityTemplate } from '../types/game';

// ─── Template pool ────────────────────────────────────────────────────────────

export const RARE_OPPORTUNITY_TEMPLATES: RareOpportunityTemplate[] = [

  // ══ RARE tier ════════════════════════════════════════════════════════════════

  {
    id: 'distressed_boutique',
    tier: 'rare',
    title: 'Distressed Boutique Hotel',
    subtitle: 'Distressed Asset · Off-Market · €1.8M',
    body: 'A 28-room boutique in your territory is quietly seeking a buyer after missing two debt payments. The owner wants a clean exit within 30 days. No agent, no auction — just you.',
    reward: { money: 35_000, xp: 400, rep_delta: { owner: 20, operator: 12 }, market_share_delta: 0.06 },
    declineReward: { money: 0, xp: 50, rep_delta: {} },
    timerSeconds: 90,
    requiresLevel: 2,
    accentColor: '#10b981',
    glowColor: 'rgba(16,185,129,0.4)',
    icon: 'Building2',
    cooldownHours: 4,
    acceptLabel: 'Secure the Deal',
    declineLabel: 'Pass',
  },

  {
    id: 'local_family_office',
    tier: 'rare',
    title: 'Local Family Office Mandate',
    subtitle: 'Investor · Porto · €5M Budget',
    body: 'A Porto-based family office has €5M to deploy into hospitality within 60 days. Their CFO contacted you directly — they want one trusted advisor, not a beauty parade.',
    reward: { money: 28_000, xp: 350, rep_delta: { investor: 25, market: 10 }, reputation: 15 },
    declineReward: { money: 0, xp: 40, rep_delta: { investor: 3 } },
    timerSeconds: 75,
    requiresLevel: 3,
    requiresRepTrack: { track: 'investor', minScore: 25 },
    accentColor: '#3b82f6',
    glowColor: 'rgba(59,130,246,0.4)',
    icon: 'Briefcase',
    cooldownHours: 6,
    acceptLabel: 'Accept Mandate',
    declineLabel: 'Decline',
  },

  {
    id: 'operator_expansion',
    tier: 'rare',
    title: 'International Operator Expansion',
    subtitle: 'Operator · Market Entry · 3 Hotels',
    body: 'A European lifestyle hotel brand wants to enter Portugal and is looking for a local advisory partner. They need three sites identified in 45 days — their board meets next month.',
    reward: { money: 42_000, xp: 450, rep_delta: { operator: 30, market: 15 }, reputation: 20 },
    declineReward: { money: 0, xp: 60, rep_delta: {} },
    timerSeconds: 80,
    requiresLevel: 4,
    requiresRepTrack: { track: 'operator', minScore: 25 },
    accentColor: '#f59e0b',
    glowColor: 'rgba(245,158,11,0.4)',
    icon: 'Globe',
    cooldownHours: 8,
    acceptLabel: 'Take the Brief',
    declineLabel: 'Not Now',
  },

  // ══ EPIC tier ═════════════════════════════════════════════════════════════════

  {
    id: 'confidential_portfolio',
    tier: 'epic',
    title: 'Confidential Portfolio Sale',
    subtitle: 'Portfolio · 4 Hotels · €18M · Exclusive',
    body: 'A private family is quietly divesting their entire Portuguese hotel portfolio — four assets across Lisbon and Porto. They want a single trusted advisor. No marketing. No process. Just a quiet sale.',
    reward: { money: 120_000, xp: 900, rep_delta: { owner: 40, investor: 25, market: 20 }, market_share_delta: 0.08, reputation: 35 },
    declineReward: { money: 0, xp: 80, rep_delta: { owner: 5 } },
    timerSeconds: 60,
    requiresLevel: 6,
    requiresRepTrack: { track: 'owner', minScore: 75 },
    accentColor: '#f97316',
    glowColor: 'rgba(249,115,22,0.5)',
    icon: 'Crown',
    cooldownHours: 12,
    acceptLabel: 'Take Exclusive Mandate',
    declineLabel: 'Pass — Too Big',
  },

  {
    id: 'luxury_off_market',
    tier: 'epic',
    title: 'Off-Market Luxury Hotel',
    subtitle: 'Luxury · Cascais · 5-Star · €12M',
    body: 'A 5-star clifftop hotel in Cascais has never been formally marketed. The owning family is considering a sale after third-generation succession. A private contact has given you a 48-hour first-look window.',
    reward: { money: 95_000, xp: 800, rep_delta: { owner: 35, investor: 30, market: 15 }, market_share_delta: 0.07, reputation: 30 },
    declineReward: { money: 0, xp: 60, rep_delta: {} },
    timerSeconds: 70,
    requiresLevel: 7,
    requiresRepTrack: { track: 'owner', minScore: 75 },
    accentColor: '#06b6d4',
    glowColor: 'rgba(6,182,212,0.5)',
    icon: 'Star',
    cooldownHours: 14,
    acceptLabel: 'Secure First-Look',
    declineLabel: 'Let It Pass',
  },

  {
    id: 'pe_fund_mandate',
    tier: 'epic',
    title: 'PE Fund Exclusive Advisory',
    subtitle: 'Private Equity · €80M Deployment · 12 Months',
    body: 'A London-based PE fund is deploying €80M into Iberian hospitality over 12 months. They want one Portugal-based advisor embedded in their deal team. The retainer plus success fees could transform your firm.',
    reward: { money: 85_000, xp: 750, rep_delta: { investor: 45, market: 25 }, reputation: 40 },
    declineReward: { money: 0, xp: 70, rep_delta: {} },
    timerSeconds: 65,
    requiresLevel: 8,
    requiresRepTrack: { track: 'investor', minScore: 75 },
    accentColor: '#3b82f6',
    glowColor: 'rgba(59,130,246,0.5)',
    icon: 'BarChart2',
    cooldownHours: 16,
    acceptLabel: 'Join the Deal Team',
    declineLabel: 'Decline Retainer',
  },

  // ══ LEGENDARY tier ═══════════════════════════════════════════════════════════

  {
    id: 'sovereign_wealth_mandate',
    tier: 'legendary',
    title: 'Sovereign Wealth Fund Mandate',
    subtitle: 'SWF · €500M · National Exclusive',
    body: 'The investment arm of a Gulf sovereign wealth fund has selected you — specifically you — as their exclusive Portuguese hotel advisor. A €500M deployment mandate. This is the defining deal of your career.',
    reward: { money: 500_000, xp: 3_000, rep_delta: { investor: 100, market: 80, owner: 50, operator: 40 }, market_share_delta: 0.12, reputation: 100 },
    declineReward: { money: 5_000, xp: 200, rep_delta: { market: 10 } },
    timerSeconds: 45,
    requiresLevel: 15,
    requiresRepTrack: { track: 'investor', minScore: 275 },
    accentColor: '#ef4444',
    glowColor: 'rgba(239,68,68,0.6)',
    icon: 'Gem',
    cooldownHours: 72,
    acceptLabel: 'Accept the Mandate',
    declineLabel: 'Respectfully Decline',
  },

  {
    id: 'national_brand_launch',
    tier: 'legendary',
    title: 'National Hotel Brand Launch',
    subtitle: 'Brand Partnership · €200M · Pan-Portugal',
    body: 'A global luxury hotel group wants to launch their flagship Portuguese brand. They need a strategic partner to source, structure, and manage the first five flagship properties. You have been nominated as lead advisor.',
    reward: { money: 350_000, xp: 2_500, rep_delta: { market: 90, operator: 70, investor: 60 }, reputation: 80 },
    declineReward: { money: 0, xp: 150, rep_delta: { market: 8 } },
    timerSeconds: 50,
    requiresLevel: 12,
    requiresRepTrack: { track: 'market', minScore: 150 },
    accentColor: '#ef4444',
    glowColor: 'rgba(239,68,68,0.6)',
    icon: 'Award',
    cooldownHours: 60,
    acceptLabel: 'Lead the Launch',
    declineLabel: 'Decline Partnership',
  },

  {
    id: 'empire_acquisition',
    tier: 'legendary',
    title: 'The Empire Acquisition',
    subtitle: 'Trophy Asset · Lisbon · €75M · Once in a Generation',
    body: 'The most iconic hotel in Lisbon — a palace conversion with 200 years of history — has come to market for the first time ever. The owning family will only deal with the most respected advisor in Portugal. They want you.',
    reward: { money: 400_000, xp: 2_800, rep_delta: { owner: 120, market: 100, investor: 60 }, market_share_delta: 0.15, reputation: 120 },
    declineReward: { money: 0, xp: 100, rep_delta: {} },
    timerSeconds: 40,
    requiresLevel: 20,
    requiresRepTrack: { track: 'owner', minScore: 450 },
    accentColor: '#ef4444',
    glowColor: 'rgba(239,68,68,0.7)',
    icon: 'Trophy',
    cooldownHours: 96,
    acceptLabel: 'Seize History',
    declineLabel: 'Step Aside',
  },
];

// ─── Spawn logic ──────────────────────────────────────────────────────────────

const lastRareSpawnTimes: Record<string, number> = {};
let lastAnyRareSpawn = 0;

export const trySpawnRareOpportunity = (opts: {
  playerLevel: number;
  investorRep: number;
  ownerRep: number;
  marketRep: number;
  operatorRep: number;
  activeDistrictIds: string[];
  districtNames: Record<string, string>;
  recentTemplateIds: string[];
}): ActiveRareOpportunity | null => {
  const { playerLevel, investorRep, ownerRep, marketRep, operatorRep, activeDistrictIds, districtNames, recentTemplateIds } = opts;
  const now = Date.now();

  // Global cooldown: at most one rare event per 3 minutes
  if (now - lastAnyRareSpawn < 3 * 60_000) return null;

  const repByTrack: Record<string, number> = {
    investor: investorRep,
    owner: ownerRep,
    market: marketRep,
    operator: operatorRep,
  };

  const eligible = RARE_OPPORTUNITY_TEMPLATES.filter(t => {
    if (playerLevel < t.requiresLevel) return false;
    if (t.requiresRepTrack) {
      const score = repByTrack[t.requiresRepTrack.track] ?? 0;
      if (score < t.requiresRepTrack.minScore) return false;
    }
    const cooldown = t.cooldownHours * 3600 * 1000;
    if (now - (lastRareSpawnTimes[t.id] ?? 0) < cooldown) return false;
    if (recentTemplateIds.includes(t.id)) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Weighted: legendary = 5%, epic = 20%, rare = 75%
  const weighted: RareOpportunityTemplate[] = [];
  for (const t of eligible) {
    const w = t.tier === 'legendary' ? 1 : t.tier === 'epic' ? 4 : 15;
    for (let i = 0; i < w; i++) weighted.push(t);
  }

  const template = weighted[Math.floor(Math.random() * weighted.length)];
  lastRareSpawnTimes[template.id] = now;
  lastAnyRareSpawn = now;

  let districtId: string | undefined;
  let districtName: string | undefined;
  if (activeDistrictIds.length > 0) {
    districtId = activeDistrictIds[Math.floor(Math.random() * activeDistrictIds.length)];
    districtName = districtNames[districtId];
  }

  const event: ActiveRareOpportunity = {
    id: `rare_${now}_${Math.random().toString(36).slice(2, 6)}`,
    templateId: template.id,
    tier: template.tier,
    title: template.title,
    subtitle: template.subtitle,
    body: template.body,
    reward: template.reward,
    declineReward: template.declineReward,
    timerSeconds: template.timerSeconds,
    requiresLevel: template.requiresLevel,
    requiresRepTrack: template.requiresRepTrack,
    accentColor: template.accentColor,
    glowColor: template.glowColor,
    icon: template.icon,
    acceptLabel: template.acceptLabel,
    declineLabel: template.declineLabel,
    spawnedAt: now,
    districtId,
    districtName,
  };

  return event;
};
