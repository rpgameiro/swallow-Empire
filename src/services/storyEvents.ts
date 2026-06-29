import { StoryEventTemplate, ActiveStoryEvent } from '../types/game';

// ─── Story event template pool ────────────────────────────────────────────────

export const STORY_TEMPLATES: StoryEventTemplate[] = [

  // ── INVESTOR events ──────────────────────────────────────────────────────────

  {
    id: 'london_investor',
    category: 'investor',
    title: 'Investor from London Arrives',
    body: 'A London-based family office managing €400M has quietly entered Lisbon, scouting boutique hotel opportunities. Their local fixer has asked if you\'d be willing to brief them on the market. This could open a major capital relationship — or distract you from active deals.',
    accentColor: '#3b82f6',
    icon: 'Briefcase',
    minLevel: 2,
    cooldownHours: 8,
    choices: [
      {
        id: 'brief_them',
        label: 'Host the Briefing',
        description: '+investor rep, +market rep, small money from advisory fee',
        effects: { money: 3500, rep_delta: { investor: 12, market: 6 }, xp: 80, tag: 'london_briefed' },
      },
      {
        id: 'introduce_competitor',
        label: 'Refer to a Colleague',
        description: 'Goodwill gesture — modest rep gain, no money',
        effects: { rep_delta: { investor: 5, market: 8 }, xp: 30 },
      },
      {
        id: 'decline',
        label: 'Decline — Too Busy',
        description: 'No distraction, but a missed connection',
        effects: { xp: 10 },
      },
    ],
  },

  {
    id: 'pe_fund_mandate',
    category: 'investor',
    title: 'PE Fund Seeks Exclusive Mandate',
    body: 'A mid-size private equity fund wants to acquire three hotels in Portugal over 18 months. They\'re offering you an exclusive advisory mandate — but it comes with a 90-day commitment clause that may limit other deals.',
    accentColor: '#3b82f6',
    icon: 'BarChart2',
    minLevel: 5,
    cooldownHours: 24,
    choices: [
      {
        id: 'accept_exclusive',
        label: 'Accept Exclusive Mandate',
        description: 'Large fee upfront, strong investor rep boost',
        effects: { money: 22000, rep_delta: { investor: 25, operator: 10 }, xp: 200, tag: 'pe_mandate_active' },
        requiresRepTrack: { track: 'investor', minScore: 50 },
      },
      {
        id: 'negotiate_nonexclusive',
        label: 'Negotiate Non-Exclusive',
        description: 'Smaller fee, preserve flexibility',
        effects: { money: 8000, rep_delta: { investor: 12, market: 8 }, xp: 120 },
      },
      {
        id: 'pass',
        label: 'Pass on This One',
        description: 'Stay agile — no commitment',
        effects: { xp: 20 },
      },
    ],
  },

  {
    id: 'sovereign_wealth_rumor',
    category: 'investor',
    title: 'Sovereign Wealth Fund Rumored',
    body: 'Word is circulating that a Gulf sovereign wealth fund is preparing to deploy €1B into Portuguese hospitality. No official contact yet — but acting now to position yourself as the go-to advisor could pay off enormously.',
    accentColor: '#3b82f6',
    icon: 'Globe',
    minLevel: 8,
    cooldownHours: 48,
    choices: [
      {
        id: 'publish_report',
        label: 'Publish a Market Report',
        description: 'Invest time creating visibility — strong market rep gain',
        effects: { money: -2000, rep_delta: { market: 20, investor: 15 }, xp: 150 },
      },
      {
        id: 'network_contacts',
        label: 'Work Your Network',
        description: 'Reach out to intermediaries — moderate rep, some cost',
        effects: { money: -500, rep_delta: { investor: 18, market: 8 }, xp: 100 },
      },
      {
        id: 'wait_and_see',
        label: 'Wait for Official Contact',
        description: 'Conserve resources — minimal effect',
        effects: { xp: 25 },
      },
    ],
  },

  // ── OWNER events ─────────────────────────────────────────────────────────────

  {
    id: 'owner_confidential_meeting',
    category: 'owner',
    title: 'Hotel Owner Requests Confidential Meeting',
    body: 'The owner of a well-known boutique hotel in your territory has reached out discreetly. They\'re considering an exit but haven\'t spoken to anyone else yet. This could be the deal of the year — handled right.',
    accentColor: '#10b981',
    icon: 'DoorOpen',
    requiresActiveDistrict: true,
    cooldownHours: 12,
    choices: [
      {
        id: 'meet_confidentially',
        label: 'Meet Confidentially',
        description: 'Off-market lead — strong owner rep, territory boost',
        effects: { rep_delta: { owner: 18, market: 6 }, market_share_delta: 0.04, xp: 120, tag: 'off_market_lead' },
      },
      {
        id: 'bring_investor',
        label: 'Bring a Ready Buyer',
        description: 'Higher money, but less personal rep',
        effects: { money: 12000, rep_delta: { owner: 8, investor: 12 }, xp: 100 },
        requiresRepTrack: { track: 'investor', minScore: 25 },
      },
      {
        id: 'refer_out',
        label: 'Refer to a Larger Firm',
        description: 'Goodwill with the owner, but you miss the deal',
        effects: { rep_delta: { owner: 10 }, xp: 40 },
      },
    ],
  },

  {
    id: 'distressed_owner',
    category: 'owner',
    title: 'Distressed Owner Seeks Urgent Help',
    body: 'A family-owned hotel operator is facing a debt covenant breach next month. They\'re in quiet distress and need either a buyer or restructuring advisor immediately. Acting decisively here could define your reputation.',
    accentColor: '#10b981',
    icon: 'AlertCircle',
    requiresActiveDistrict: true,
    cooldownHours: 20,
    choices: [
      {
        id: 'advisory_restructure',
        label: 'Lead the Restructuring',
        description: 'Complex engagement — big rep, moderate fee',
        effects: { money: 9000, rep_delta: { owner: 22, operator: 15 }, xp: 180, tag: 'restructure_led' },
      },
      {
        id: 'find_buyer_fast',
        label: 'Source a Buyer Fast',
        description: 'Commission play — high money if deal closes',
        effects: { money: 18000, rep_delta: { owner: 12, investor: 10 }, market_share_delta: 0.05, xp: 140 },
        requiresRepTrack: { track: 'investor', minScore: 25 },
      },
      {
        id: 'pass_distressed',
        label: 'Too Risky — Pass',
        description: 'Conservative. No risk, no reward.',
        effects: { xp: 15 },
      },
    ],
  },

  {
    id: 'portfolio_sale',
    category: 'owner',
    title: 'Three-Hotel Portfolio Goes Quiet',
    body: 'A regional operator is quietly testing the market for a three-hotel portfolio valued at €12M. No formal process yet. Getting your name on the shortlist early is the play.',
    accentColor: '#10b981',
    icon: 'Building2',
    minLevel: 4,
    cooldownHours: 16,
    choices: [
      {
        id: 'pitch_mandate',
        label: 'Pitch for the Mandate',
        description: 'High effort, high reward — strong rep if successful',
        effects: { money: 5000, rep_delta: { owner: 20, market: 12 }, xp: 160 },
      },
      {
        id: 'send_teaser',
        label: 'Send a Market Teaser',
        description: 'Low cost positioning — modest rep, keeps door open',
        effects: { rep_delta: { owner: 8, market: 10 }, xp: 70 },
      },
      {
        id: 'ignore',
        label: 'Wait for Formal Process',
        description: 'No early mover advantage',
        effects: { xp: 10 },
      },
    ],
  },

  // ── MARKET events ────────────────────────────────────────────────────────────

  {
    id: 'tourism_boom_porto',
    category: 'market',
    title: 'Tourism Boom Hits Porto',
    body: 'Porto has seen a 34% YoY jump in international visitor arrivals. Hotel RevPAR is up 22%. Buyers are circling. Those positioned now will close deals at a premium before the formal rush.',
    accentColor: '#f59e0b',
    icon: 'Plane',
    requiresActiveDistrict: true,
    cooldownHours: 24,
    choices: [
      {
        id: 'double_down_porto',
        label: 'Double Down in Porto',
        description: 'Aggressive territory push — territory + market rep',
        effects: { rep_delta: { market: 15, owner: 10 }, market_share_delta: 0.06, xp: 130 },
      },
      {
        id: 'publish_intelligence',
        label: 'Publish Tourism Intelligence',
        description: 'Thought leadership — market rep, attracts investors',
        effects: { rep_delta: { market: 20, investor: 8 }, xp: 100 },
      },
      {
        id: 'monitor_only',
        label: 'Monitor the Trend',
        description: 'No commitment yet',
        effects: { xp: 20 },
      },
    ],
  },

  {
    id: 'luxury_slowdown_lisbon',
    category: 'market',
    title: 'Luxury Market Slowdown in Lisbon',
    body: 'Ultra-prime Lisbon deals have stalled. Two high-profile hotel acquisitions just fell through at signing. Market sentiment is shifting — an opportunity for those willing to go counter-cyclical.',
    accentColor: '#f59e0b',
    icon: 'TrendingDown',
    requiresActiveDistrict: true,
    cooldownHours: 20,
    choices: [
      {
        id: 'counter_cyclical',
        label: 'Go Counter-Cyclical',
        description: 'Buy into the dip — market rep, territory upside',
        effects: { money: -3000, rep_delta: { market: 22, investor: 12 }, market_share_delta: 0.05, xp: 160 },
      },
      {
        id: 'advisory_note',
        label: 'Issue a Market Advisory Note',
        description: 'Thought leadership — strong market rep',
        effects: { rep_delta: { market: 18 }, xp: 90 },
      },
      {
        id: 'wait_out',
        label: 'Wait for Recovery',
        description: 'Protect capital, minimal action',
        effects: { xp: 20 },
      },
    ],
  },

  {
    id: 'new_regulation',
    category: 'market',
    title: 'New Short-Let Regulation Announced',
    body: 'The government has announced sweeping new short-let licensing rules affecting Airbnb-adjacent hotel concepts across Portugal. Operators are spooked — but for traditional hotel buyers, this is a tailwind.',
    accentColor: '#f59e0b',
    icon: 'FileText',
    cooldownHours: 48,
    choices: [
      {
        id: 'advise_operators',
        label: 'Advise Affected Operators',
        description: 'Fee income from advisory + strong operator rep',
        effects: { money: 7000, rep_delta: { operator: 20, market: 10 }, xp: 140 },
      },
      {
        id: 'target_fleeing_owners',
        label: 'Target Fleeing Short-Let Owners',
        description: 'Off-market hotel pipeline — owner rep boost',
        effects: { rep_delta: { owner: 18, market: 8 }, market_share_delta: 0.03, xp: 120 },
      },
      {
        id: 'publish_outlook',
        label: 'Publish a Sector Outlook',
        description: 'Broad visibility — market and investor rep',
        effects: { rep_delta: { market: 15, investor: 10 }, xp: 80 },
      },
    ],
  },

  // ── COMPETITOR events ────────────────────────────────────────────────────────

  {
    id: 'competitor_enters_district',
    category: 'competitor',
    title: 'Rival Firm Enters Your District',
    body: 'A well-funded Lisbon advisory firm — known for aggressive pricing and deep pockets — has opened a satellite office right in your strongest territory. They\'re already poaching contacts.',
    accentColor: '#ef4444',
    icon: 'Swords',
    requiresActiveDistrict: true,
    cooldownHours: 24,
    choices: [
      {
        id: 'defend_territory',
        label: 'Defend Your Territory',
        description: 'Aggressive retention — protect market share',
        effects: { money: -2000, rep_delta: { owner: 15, market: 8 }, market_share_delta: 0.03, xp: 120 },
      },
      {
        id: 'co_list_deal',
        label: 'Propose a Co-Listing',
        description: 'Turn rival into ally — moderate rep across tracks',
        effects: { money: 4000, rep_delta: { market: 12, owner: 8, investor: 6 }, xp: 90 },
      },
      {
        id: 'out_price',
        label: 'Undercut Their Fees',
        description: 'Win short term, compress margins — money risk',
        effects: { money: 6000, market_share_delta: 0.04, xp: 70, rep_delta: { market: -5 } },
      },
    ],
  },

  {
    id: 'headhunter_offer',
    category: 'competitor',
    title: 'Rival Firm Tries to Poach Your Analyst',
    body: 'Your most capable analyst has been approached by a competitor offering 40% more. They\'ve come to you first. How you respond will define your firm\'s culture — and word travels fast in this market.',
    accentColor: '#ef4444',
    icon: 'UserMinus',
    minLevel: 3,
    cooldownHours: 36,
    choices: [
      {
        id: 'match_offer',
        label: 'Match the Offer',
        description: 'Keep the talent — costs money, strong operator rep',
        effects: { money: -4000, rep_delta: { operator: 20, market: 5 }, xp: 80 },
      },
      {
        id: 'give_equity',
        label: 'Offer a Profit Share',
        description: 'Creative retention — less cash, builds loyalty culture',
        effects: { money: -1000, rep_delta: { operator: 25, market: 10 }, xp: 120 },
      },
      {
        id: 'let_them_go',
        label: 'Let Them Go',
        description: 'Lose the analyst, maintain budget discipline',
        effects: { xp: 20 },
      },
    ],
  },

  // ── OPPORTUNITY events ────────────────────────────────────────────────────────

  {
    id: 'off_market_hotel',
    category: 'opportunity',
    title: 'Off-Market Hotel Appears',
    body: 'A small but perfectly positioned 22-room hotel in a prime location has just come to your attention through a private contact. It\'s not listed anywhere. The owner wants a quiet deal done in 30 days — or they go to auction.',
    accentColor: '#10b981',
    icon: 'Key',
    requiresActiveDistrict: true,
    cooldownHours: 16,
    choices: [
      {
        id: 'represent_buyer',
        label: 'Find a Buyer Immediately',
        description: 'Commission play — large money, owner + investor rep',
        effects: { money: 15000, rep_delta: { owner: 15, investor: 12 }, market_share_delta: 0.05, xp: 180 },
        requiresRepTrack: { track: 'investor', minScore: 25 },
      },
      {
        id: 'request_exclusivity',
        label: 'Request Exclusivity First',
        description: 'Secure the mandate — strong owner rep, slower money',
        effects: { money: 3000, rep_delta: { owner: 22, market: 8 }, xp: 120 },
      },
      {
        id: 'pass_off_market',
        label: 'Pass — Not the Right Buyer',
        description: 'Stay selective. Reputation intact.',
        effects: { rep_delta: { owner: 4 }, xp: 20 },
      },
    ],
  },

  {
    id: 'conference_keynote',
    category: 'opportunity',
    title: 'Invited to Keynote Industry Conference',
    body: 'Portugal Hotel Investment Forum has offered you a keynote speaking slot — 400 attendees, live-streamed, major press coverage. It\'s a significant time investment but the visibility could be career-defining.',
    accentColor: '#a855f7',
    icon: 'Mic',
    minLevel: 4,
    cooldownHours: 72,
    choices: [
      {
        id: 'accept_keynote',
        label: 'Accept and Prepare Thoroughly',
        description: 'Big prep investment — major market rep boost',
        effects: { money: -1500, rep_delta: { market: 30, investor: 15 }, xp: 220, tag: 'keynote_done' },
      },
      {
        id: 'accept_short_slot',
        label: 'Accept a Shorter Panel Slot',
        description: 'Less prep, modest rep gain',
        effects: { rep_delta: { market: 14, investor: 7 }, xp: 100 },
      },
      {
        id: 'decline_keynote',
        label: 'Decline — Not the Right Moment',
        description: 'Protect bandwidth',
        effects: { xp: 10 },
      },
    ],
  },

  {
    id: 'press_feature',
    category: 'opportunity',
    title: 'Financial Times Wants an Interview',
    body: 'A journalist from the FT\'s property desk is writing a feature on Portuguese hotel investment. They want a comment on market conditions — and potentially a full profile on your firm. Manage carefully.',
    accentColor: '#a855f7',
    icon: 'Newspaper',
    minLevel: 3,
    cooldownHours: 48,
    choices: [
      {
        id: 'full_interview',
        label: 'Give Full Interview',
        description: 'Maximum visibility — huge market rep, some risk',
        effects: { rep_delta: { market: 28, investor: 14 }, xp: 180 },
      },
      {
        id: 'brief_comment',
        label: 'Provide a Brief Comment',
        description: 'Controlled messaging — moderate rep',
        effects: { rep_delta: { market: 14 }, xp: 80 },
      },
      {
        id: 'no_comment',
        label: 'No Comment',
        description: 'Discretion maintained — no upside',
        effects: { xp: 10 },
      },
    ],
  },
];

// ─── Spawn logic ──────────────────────────────────────────────────────────────

let lastSpawnTimes: Record<string, number> = {};

export const trySpawnStoryEvent = (opts: {
  playerLevel: number;
  hasActiveDistricts: boolean;
  activeDistrictIds: string[];
  districtNames: Record<string, string>;
  recentTemplateIds: string[];
}): ActiveStoryEvent | null => {
  const { playerLevel, hasActiveDistricts, activeDistrictIds, districtNames, recentTemplateIds } = opts;

  const now = Date.now();

  // Filter eligible templates
  const eligible = STORY_TEMPLATES.filter(t => {
    // Level gate
    if (t.minLevel && playerLevel < t.minLevel) return false;
    // District requirement
    if (t.requiresActiveDistrict && !hasActiveDistricts) return false;
    // Cooldown
    const cooldownMs = (t.cooldownHours ?? 4) * 3600 * 1000;
    const lastSeen = lastSpawnTimes[t.id] ?? 0;
    if (now - lastSeen < cooldownMs) return false;
    // Don't repeat recently seen (in-session)
    if (recentTemplateIds.includes(t.id)) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const template = eligible[Math.floor(Math.random() * eligible.length)];
  lastSpawnTimes[template.id] = now;

  // Pick a contextual district if needed
  let districtId: string | undefined;
  let districtName: string | undefined;
  if (template.requiresActiveDistrict && activeDistrictIds.length > 0) {
    districtId = activeDistrictIds[Math.floor(Math.random() * activeDistrictIds.length)];
    districtName = districtNames[districtId];
  }

  const event: ActiveStoryEvent = {
    id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    templateId: template.id,
    category: template.category,
    title: template.title,
    body: template.body,
    accentColor: template.accentColor,
    icon: template.icon,
    choices: template.choices,
    districtId,
    districtName,
    spawnedAt: now,
  };

  return event;
};
