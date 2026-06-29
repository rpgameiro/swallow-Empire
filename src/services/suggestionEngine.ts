import { Player, PlayerDistrict, District, AISuggestion, SuggestionType, SuggestionPriority } from '../types/game';
import { DynamicQuest } from './questEngine';
import { insertAISuggestions, getAISuggestions, expireOldAISuggestions } from './supabase';

export interface SuggestionContext {
  player: Player;
  playerDistricts: Map<string, PlayerDistrict>;
  districts: District[];
  dynamicQuests: DynamicQuest[];
  existingSuggestions: AISuggestion[];
}

// ─── Template banks ───────────────────────────────────────────────────────────

interface SuggestionTemplate {
  title: string;
  description: string;
  rationale: string;
  category: string;
  suggestion_type: SuggestionType;
  priority: SuggestionPriority;
  base_xp: number;
  base_money: number;
  difficulty: number;
  tags: string[];
  source: string;
  min_level?: number;
  max_level?: number;
}

// ─── Strategic ────────────────────────────────────────────────────────────────

const STRATEGIC_TEMPLATES: SuggestionTemplate[] = [
  {
    title: 'Expand into a New District',
    description: 'Your empire has stabilised in current territories. Now is the time to identify an adjacent district and begin positioning for entry.',
    rationale: 'Market saturation in controlled districts reduces marginal returns. New territory opens fresh revenue streams and diversifies risk.',
    category: 'acquisition',
    suggestion_type: 'strategic',
    priority: 'high',
    base_xp: 800,
    base_money: 15000,
    difficulty: 4,
    tags: ['expansion', 'territory', 'acquisition'],
    source: 'empire_analysis',
  },
  {
    title: 'Build a Capital Alliance',
    description: 'Identify a high-net-worth investor and negotiate a long-term capital partnership to fund your next acquisition phase.',
    rationale: 'Sustained growth requires structured capital. A committed LP relationship unlocks deal sizes beyond solo capacity.',
    category: 'networking',
    suggestion_type: 'strategic',
    priority: 'high',
    base_xp: 700,
    base_money: 0,
    difficulty: 4,
    tags: ['investor', 'capital', 'alliance', 'LP'],
    source: 'empire_analysis',
    min_level: 3,
  },
  {
    title: 'Establish a Brand Positioning Statement',
    description: "Define and document your firm's unique value proposition for the Portuguese hotel advisory market.",
    rationale: 'Differentiated positioning attracts better mandates and commands higher advisory fees.',
    category: 'brand',
    suggestion_type: 'strategic',
    priority: 'medium',
    base_xp: 400,
    base_money: 5000,
    difficulty: 2,
    tags: ['brand', 'marketing', 'positioning'],
    source: 'empire_analysis',
  },
  {
    title: 'Develop a Proprietary Deal Pipeline',
    description: 'Create a systematic, off-market deal sourcing system using your broker network and distressed asset intelligence.',
    rationale: 'Off-market deals close at 10–20% better valuations. A proprietary pipeline is your biggest competitive moat.',
    category: 'acquisition',
    suggestion_type: 'strategic',
    priority: 'high',
    base_xp: 900,
    base_money: 20000,
    difficulty: 5,
    tags: ['pipeline', 'deal-flow', 'off-market'],
    source: 'empire_analysis',
    min_level: 5,
  },
  {
    title: 'Analyze the Porto Hotel Market',
    description: 'Conduct a deep-dive into Porto RevPAR trends, occupancy rates, and pipeline activity. Build a conviction-level market thesis.',
    rationale: "Porto's hotel market is showing supply-demand imbalances that create entry windows. A data-backed thesis positions you ahead of generalist buyers.",
    category: 'analysis',
    suggestion_type: 'strategic',
    priority: 'high',
    base_xp: 650,
    base_money: 0,
    difficulty: 3,
    tags: ['porto', 'market-analysis', 'research', 'strategy'],
    source: 'market_intelligence',
  },
  {
    title: 'Review Your Hotel Pipeline',
    description: 'Do a full pass of your active hotel pipeline. Score every asset by IRR potential, timeline, and vendor motivation. Cut or accelerate accordingly.',
    rationale: 'A reviewed pipeline is a live weapon. An unreviewed one is a liability. Know exactly where each deal stands before the week ends.',
    category: 'operations',
    suggestion_type: 'strategic',
    priority: 'high',
    base_xp: 500,
    base_money: 0,
    difficulty: 3,
    tags: ['pipeline', 'hotel', 'review', 'operations'],
    source: 'player_stats',
  },
  {
    title: 'Update Your Investor Database',
    description: 'Audit your full investor contact list. Remove stale records, update deal preferences, and flag the top 10 for re-engagement this quarter.',
    rationale: 'An outdated CRM is worse than no CRM — it creates false confidence. Clean data directly translates to better capital raise outcomes.',
    category: 'operations',
    suggestion_type: 'strategic',
    priority: 'medium',
    base_xp: 300,
    base_money: 0,
    difficulty: 2,
    tags: ['CRM', 'investor', 'database', 'operations'],
    source: 'player_stats',
  },
];

// ─── Tactical ─────────────────────────────────────────────────────────────────

const TACTICAL_TEMPLATES: SuggestionTemplate[] = [
  {
    title: 'Cold Outreach to 5 Brokers',
    description: 'Run a structured cold outreach campaign to five new commercial real estate brokers active in your target markets.',
    rationale: 'Broker relationships are the fastest path to deal flow in the Portuguese hotel sector.',
    category: 'networking',
    suggestion_type: 'tactical',
    priority: 'medium',
    base_xp: 200,
    base_money: 0,
    difficulty: 2,
    tags: ['broker', 'outreach', 'networking'],
    source: 'market_analysis',
  },
  {
    title: 'Audit Your Current Pipeline',
    description: 'Review all active deal threads, score them by probability of close, and cut the bottom 30% to sharpen your focus.',
    rationale: 'Time on low-probability deals is the hidden tax on empire builders. Ruthless pipeline hygiene is a force multiplier.',
    category: 'operations',
    suggestion_type: 'tactical',
    priority: 'high',
    base_xp: 250,
    base_money: 0,
    difficulty: 2,
    tags: ['pipeline', 'focus', 'operations'],
    source: 'player_stats',
  },
  {
    title: 'Schedule Viewings for Top 3 Targets',
    description: 'Book on-site viewings for your three highest-priority acquisition targets this week.',
    rationale: 'Physical presence in target assets accelerates decision-making and signals seriousness to vendors.',
    category: 'acquisition',
    suggestion_type: 'tactical',
    priority: 'high',
    base_xp: 300,
    base_money: 0,
    difficulty: 3,
    tags: ['viewing', 'acquisition', 'deal-flow'],
    source: 'market_analysis',
  },
  {
    title: 'Prepare an Advisory Deck',
    description: 'Build a polished deck presenting your current deal thesis and market edge to potential advisory mandates.',
    rationale: 'A strong advisory deck converts conversations into mandates. This is leverage for your next networking event.',
    category: 'brand',
    suggestion_type: 'tactical',
    priority: 'medium',
    base_xp: 180,
    base_money: 2000,
    difficulty: 2,
    tags: ['deck', 'brand', 'advisory'],
    source: 'player_stats',
  },
  {
    title: 'Negotiate Financing Terms',
    description: 'Re-approach your lender contacts to renegotiate loan terms on an active deal or restructure existing debt.',
    rationale: 'A 25bps improvement in financing terms on a €10M deal is €25k/year. Always be negotiating.',
    category: 'finance',
    suggestion_type: 'tactical',
    priority: 'medium',
    base_xp: 350,
    base_money: 5000,
    difficulty: 3,
    tags: ['finance', 'debt', 'negotiation'],
    source: 'market_analysis',
    min_level: 2,
  },
  {
    title: 'Follow Up on Your Top Acquisition Lead',
    description: 'You have a warm acquisition lead that has gone quiet. Send a structured follow-up with updated pricing context and a clear next step.',
    rationale: 'Most deals die in follow-up limbo, not in negotiation. A well-timed nudge at the right moment can unlock a stalled thread.',
    category: 'acquisition',
    suggestion_type: 'tactical',
    priority: 'high',
    base_xp: 380,
    base_money: 8000,
    difficulty: 2,
    tags: ['follow-up', 'acquisition', 'lead', 'deal-flow'],
    source: 'player_stats',
  },
  {
    title: 'Schedule Your Investor Calls This Week',
    description: 'Block time for three focused investor calls. Prepare a tight 10-minute update on your pipeline and capital needs for each.',
    rationale: 'Consistent investor communication builds trust compounding. The advisor who calls regularly closes capital faster.',
    category: 'networking',
    suggestion_type: 'tactical',
    priority: 'high',
    base_xp: 320,
    base_money: 0,
    difficulty: 2,
    tags: ['investor', 'calls', 'networking', 'capital'],
    source: 'player_stats',
  },
  {
    title: 'Publish a LinkedIn Market Update',
    description: 'Write and publish a 300-word LinkedIn post sharing your current read on the Portuguese hotel investment market.',
    rationale: 'Public market commentary positions you as a thought leader. A single post can generate two or three inbound conversations from warm leads.',
    category: 'brand',
    suggestion_type: 'tactical',
    priority: 'low',
    base_xp: 150,
    base_money: 1000,
    difficulty: 1,
    tags: ['linkedin', 'brand', 'content', 'thought-leadership'],
    source: 'player_stats',
  },
  {
    title: 'Contact a Dormant Investor',
    description: 'Pick one investor from your database who has gone silent for 60+ days. Send a personalised re-engagement message with a relevant deal or insight.',
    rationale: "A dormant investor isn't gone — they're waiting for a reason to re-engage. One relevant touch can reignite a capital conversation.",
    category: 'networking',
    suggestion_type: 'tactical',
    priority: 'medium',
    base_xp: 240,
    base_money: 0,
    difficulty: 1,
    tags: ['investor', 'dormant', 'outreach', 'CRM'],
    source: 'player_stats',
  },
];

// ─── Opportunity ──────────────────────────────────────────────────────────────

const OPPORTUNITY_TEMPLATES: SuggestionTemplate[] = [
  {
    title: 'Distressed Asset Alert: Move Fast',
    description: 'Intelligence indicates a distressed seller in your target market. First-mover advantage is critical — initiate contact within 48 hours.',
    rationale: 'Distressed deals transact 15–25% below market. Speed is the only edge.',
    category: 'acquisition',
    suggestion_type: 'opportunity',
    priority: 'high',
    base_xp: 600,
    base_money: 25000,
    difficulty: 4,
    tags: ['distressed', 'urgent', 'acquisition'],
    source: 'market_intelligence',
    min_level: 3,
  },
  {
    title: 'Industry Event This Week',
    description: 'A high-value industry event is happening. Prepare three targeted conversations and a clear outcome for each.',
    rationale: 'One quality relationship formed at an event can be worth more than months of cold outreach.',
    category: 'networking',
    suggestion_type: 'opportunity',
    priority: 'medium',
    base_xp: 220,
    base_money: 0,
    difficulty: 2,
    tags: ['event', 'networking', 'relationships'],
    source: 'market_intelligence',
  },
  {
    title: 'Joint Venture Window Open',
    description: 'A complementary operator is signalling interest in a JV arrangement. Structure a preliminary term sheet.',
    rationale: 'JV deals spread risk and unlock assets too large for solo execution.',
    category: 'acquisition',
    suggestion_type: 'opportunity',
    priority: 'high',
    base_xp: 750,
    base_money: 30000,
    difficulty: 5,
    tags: ['JV', 'partnership', 'acquisition'],
    source: 'market_intelligence',
    min_level: 5,
  },
  {
    title: 'Emerging Sub-market: First Mover',
    description: 'Data shows an under-penetrated sub-market in your region. Build a competitive analysis and positioning document before rivals notice.',
    rationale: 'First-mover advantage in emerging sub-markets yields 20–40% higher returns at lower competition.',
    category: 'analysis',
    suggestion_type: 'opportunity',
    priority: 'medium',
    base_xp: 400,
    base_money: 8000,
    difficulty: 3,
    tags: ['market', 'research', 'first-mover'],
    source: 'market_intelligence',
    min_level: 2,
  },
  {
    title: 'Off-Market Boutique Hotel Spotted',
    description: 'An unlisted boutique property in a high-demand corridor has appeared in your intelligence feed. Move to obtain financials and schedule a viewing.',
    rationale: 'Boutique assets in premium corridors rarely hit open market. Acting in the first 72 hours gives you a disproportionate edge.',
    category: 'acquisition',
    suggestion_type: 'opportunity',
    priority: 'high',
    base_xp: 550,
    base_money: 18000,
    difficulty: 3,
    tags: ['boutique', 'off-market', 'hotel', 'acquisition'],
    source: 'market_intelligence',
    min_level: 2,
  },
  {
    title: 'Institutional Buyer Entering Your Market',
    description: 'An institutional buyer is reportedly scouting your core market. This is both a competitive threat and a potential co-investment or exit partner.',
    rationale: 'Institutional entry often compresses cap rates, lifts asset values, and creates co-investment or exit opportunities for well-positioned operators.',
    category: 'finance',
    suggestion_type: 'opportunity',
    priority: 'high',
    base_xp: 480,
    base_money: 12000,
    difficulty: 4,
    tags: ['institutional', 'co-invest', 'exit', 'finance'],
    source: 'market_intelligence',
    min_level: 4,
  },
];

// ─── Risk mitigation ──────────────────────────────────────────────────────────

const RISK_TEMPLATES: SuggestionTemplate[] = [
  {
    title: 'Rival Firm Moving Into Your Territory',
    description: 'A rival firm has been sighted sourcing deals in one of your controlled districts. Reinforce your relationships with key local brokers now.',
    rationale: 'Defensive action is 3× cheaper than recovery. Secure your territory before the rival establishes footholds.',
    category: 'territory',
    suggestion_type: 'risk_mitigation',
    priority: 'high',
    base_xp: 500,
    base_money: 0,
    difficulty: 3,
    tags: ['rival', 'defense', 'territory'],
    source: 'rival_move',
    min_level: 3,
  },
  {
    title: 'Review Overdue Commitments',
    description: 'You have commitments in your pipeline that are approaching deadlines without progress updates. Address them before they become liabilities.',
    rationale: 'Missed commitments damage reputation with counterparties faster than any single deal win can repair.',
    category: 'operations',
    suggestion_type: 'risk_mitigation',
    priority: 'high',
    base_xp: 150,
    base_money: 0,
    difficulty: 2,
    tags: ['deadlines', 'pipeline', 'risk'],
    source: 'player_stats',
  },
  {
    title: 'Shore Up a Key Relationship',
    description: 'One of your important contacts has gone quiet. Re-engage before the relationship cools and becomes difficult to revive.',
    rationale: 'A dormant relationship is a slow decay. A 20-minute coffee now is worth 3 months of re-warming later.',
    category: 'networking',
    suggestion_type: 'risk_mitigation',
    priority: 'medium',
    base_xp: 120,
    base_money: 0,
    difficulty: 1,
    tags: ['relationships', 'risk', 'networking'],
    source: 'player_stats',
  },
  {
    title: 'Reassess Your Debt Exposure',
    description: 'With financing conditions shifting, map your current debt obligations against projected deal timelines and identify any refinancing windows.',
    rationale: 'Liquidity crunches destroy empires faster than bad deals. Proactive debt management is the difference between surviving a cycle and thriving in it.',
    category: 'finance',
    suggestion_type: 'risk_mitigation',
    priority: 'high',
    base_xp: 280,
    base_money: 0,
    difficulty: 3,
    tags: ['debt', 'finance', 'risk', 'refinancing'],
    source: 'player_stats',
    min_level: 3,
  },
  {
    title: 'Protect a Key Broker Relationship',
    description: 'One of your top deal-flow brokers has recently been approached by a competitor. Schedule a call and reinforce the relationship with exclusive access or a preferred fee structure.',
    rationale: 'Losing a top broker to a rival can reduce your deal flow by 30%. Retention costs a fraction of replacement.',
    category: 'networking',
    suggestion_type: 'risk_mitigation',
    priority: 'high',
    base_xp: 200,
    base_money: 0,
    difficulty: 2,
    tags: ['broker', 'retention', 'networking', 'risk'],
    source: 'rival_move',
    min_level: 2,
  },
  {
    title: 'Stress Test Your Acquisition Assumptions',
    description: 'For your top two active deals, run a downside case: +150bps interest rate, -15% RevPAR, +6 months to close. Know your floor before you commit.',
    rationale: 'Deals fail in stress scenarios, not base cases. Knowing your downside before signing is the most valuable analysis you can do.',
    category: 'analysis',
    suggestion_type: 'risk_mitigation',
    priority: 'medium',
    base_xp: 330,
    base_money: 0,
    difficulty: 3,
    tags: ['stress-test', 'analysis', 'risk', 'acquisition'],
    source: 'player_stats',
    min_level: 2,
  },
];

const ALL_TEMPLATES = [
  ...STRATEGIC_TEMPLATES,
  ...TACTICAL_TEMPLATES,
  ...OPPORTUNITY_TEMPLATES,
  ...RISK_TEMPLATES,
];

// ─── Generation logic ─────────────────────────────────────────────────────────

function xpScaled(base: number, level: number): number {
  return Math.round(base * (1 + (level - 1) * 0.07));
}

function moneyScaled(base: number, level: number): number {
  return Math.round(base * (1 + (level - 1) * 0.1));
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function generateSuggestions(ctx: SuggestionContext): Promise<AISuggestion[]> {
  const { player, existingSuggestions } = ctx;

  // Don't regenerate if enough pending suggestions already exist
  const pendingCount = existingSuggestions.filter(s => s.status === 'pending').length;
  if (pendingCount >= 7) return existingSuggestions;

  // Only block re-generation for suggestions that are still active in some form;
  // dismissed/expired ones can validly reappear as new suggestions.
  const blockingStatuses = new Set<string>(['pending', 'accepted', 'snoozed']);
  const existingTitles = new Set(
    existingSuggestions.filter(s => blockingStatuses.has(s.status)).map(s => s.title),
  );

  const eligible = ALL_TEMPLATES.filter(t => {
    if (existingTitles.has(t.title)) return false;
    if (t.min_level && player.level < t.min_level) return false;
    if (t.max_level && player.level > t.max_level) return false;
    return true;
  });

  // Seed by player level + day-of-year for reproducible but rotating suggestions
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const seed = player.level * 31 + dayOfYear * 7;
  const shuffled = seededShuffle(eligible, seed);

  const needed = Math.max(0, 8 - pendingCount);
  const selected = shuffled.slice(0, needed);

  if (selected.length === 0) return existingSuggestions;

  const toInsert = selected.map(t => ({
    player_id: player.id,
    title: t.title,
    description: t.description,
    rationale: t.rationale,
    category: t.category,
    suggestion_type: t.suggestion_type,
    priority: t.priority,
    estimated_xp: xpScaled(t.base_xp, player.level),
    estimated_money: moneyScaled(t.base_money, player.level),
    difficulty: t.difficulty,
    tags: t.tags,
    source: t.source,
    status: 'pending' as const,
    accepted_quest_id: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  const inserted = await insertAISuggestions(toInsert);
  return [...existingSuggestions, ...inserted];
}

export async function loadSuggestions(player: Player): Promise<AISuggestion[]> {
  await expireOldAISuggestions(player.id);
  const existing = await getAISuggestions(player.id);
  return existing;
}
