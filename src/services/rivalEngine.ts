import { supabase } from './supabase';
import {
  RivalFirm, RivalDistrictPresence, RivalEvent, RivalEventType,
  Player, PlayerDistrict, District, EventSeverity,
} from '../types/game';

// ─── Data fetching ────────────────────────────────────────────────────────────

export const getRivalFirms = async (): Promise<RivalFirm[]> => {
  const { data, error } = await supabase
    .from('rival_firms')
    .select('*')
    .eq('is_active', true)
    .order('reputation_score', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const getRivalPresence = async (): Promise<RivalDistrictPresence[]> => {
  const { data, error } = await supabase
    .from('rival_district_presence')
    .select('*');
  if (error) throw error;
  return data ?? [];
};

export const getRivalEvents = async (playerId: string, maxAge = 48): Promise<RivalEvent[]> => {
  const since = new Date(Date.now() - maxAge * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('rival_events')
    .select('*')
    .eq('player_id', playerId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RivalEvent[];
};

export const markRivalEventRead = async (eventId: string): Promise<void> => {
  await supabase.from('rival_events').update({ is_read: true }).eq('id', eventId);
};

const insertRivalEvent = async (evt: Omit<RivalEvent, 'id' | 'created_at'>): Promise<RivalEvent | null> => {
  const { data, error } = await supabase
    .from('rival_events')
    .insert([evt])
    .select()
    .single();
  if (error) { console.warn('rival event insert failed', error); return null; }
  return data as RivalEvent;
};

const upsertPresence = async (presence: Omit<RivalDistrictPresence, 'id' | 'last_active_at'>): Promise<void> => {
  await supabase
    .from('rival_district_presence')
    .upsert({ ...presence, last_active_at: new Date().toISOString() }, { onConflict: 'rival_id,district_id' });
};

// ─── Rival AI engine ──────────────────────────────────────────────────────────
// Runs on an interval and generates rival actions based on player state.

export interface RivalContext {
  player: Player;
  playerDistricts: Map<string, PlayerDistrict>;
  districts: District[];
  rivals: RivalFirm[];
  rivalPresence: Map<string, RivalDistrictPresence[]>;
  existingEvents: RivalEvent[];
}

// How recently (ms) an event of the same type + rival was generated
const COOLDOWN_MS: Record<RivalEventType, number> = {
  territory_encroach:   12 * 3600 * 1000,  // 12h
  deal_stolen:           6 * 3600 * 1000,  // 6h
  investor_poached:     18 * 3600 * 1000,  // 18h
  rep_attack:           24 * 3600 * 1000,  // 24h
  market_undercutting:   8 * 3600 * 1000,  // 8h
  territory_takeover:   36 * 3600 * 1000,  // 36h
  collaboration_offer:  48 * 3600 * 1000,  // 48h
};

const isOnCooldown = (
  eventType: RivalEventType,
  rivalId: string,
  existingEvents: RivalEvent[],
): boolean => {
  const cooldown = COOLDOWN_MS[eventType];
  const cutoff = Date.now() - cooldown;
  return existingEvents.some(
    e => e.event_type === eventType && e.rival_id === rivalId &&
         new Date(e.created_at).getTime() > cutoff
  );
};

// ── Event templates keyed by type ──────────────────────────────────────────

interface EventTemplate {
  titles: string[];
  descriptions: ((rival: RivalFirm, districtName?: string) => string)[];
  severity: EventSeverity;
  impactMarketShare: number;
  impactReputation: number;
  impactMoney: number;
}

const TEMPLATES: Record<RivalEventType, EventTemplate> = {
  territory_encroach: {
    titles: [
      'Rival Encroachment Detected',
      'Competitor Moving Into Your Territory',
      'Market Position Under Pressure',
    ],
    descriptions: [
      (r, d) => `${r.name} has been spotted meeting with hotel owners in ${d ?? 'your territory'}. They're quietly building relationships in your market.`,
      (r, d) => `Intelligence suggests ${r.founder_name} of ${r.name} is actively canvassing ${d ?? 'your district'} for new mandates. Your market share may be at risk.`,
      (r, d) => `${r.name} has pitched two property owners in ${d ?? 'your district'} this week. Their fee structure is lower than yours — defend your position.`,
    ],
    severity: 'warning',
    impactMarketShare: -0.04,
    impactReputation: -2,
    impactMoney: 0,
  },

  deal_stolen: {
    titles: [
      'Deal Intercepted by Competitor',
      'Lost Mandate to Rival Firm',
      'Competitor Closed a Deal in Your Pipeline',
    ],
    descriptions: [
      (r, d) => `${r.name} closed the ${d ?? 'district'} hotel acquisition you had been working — the owner chose their track record over your pitch. A direct hit to pipeline.`,
      (r, d) => `The Mendes property you were targeting in ${d ?? 'the region'} has been sold through ${r.name}. ${r.founder_name} reportedly undercut fees by 30%.`,
      (r) => `${r.name} just announced a closed transaction that was in your pipeline. Your investor contact confirmed they moved on fee grounds.`,
    ],
    severity: 'alert',
    impactMarketShare: -0.06,
    impactReputation: -5,
    impactMoney: -15000,
  },

  investor_poached: {
    titles: [
      'Investor Relationship at Risk',
      'Rival Firm Pitching Your Contacts',
      'Capital Source Being Cultivated by Competitor',
    ],
    descriptions: [
      (r) => `A source has told you that ${r.name} met with one of your institutional investor contacts last week. ${r.founder_name} presented a 12-month deal pipeline. They are positioning for a mandate.`,
      (r) => `${r.name} has been sending market reports to investors in your network. It's soft coverage — but it's effective. Your position with this capital source is less secure than you thought.`,
      (r) => `${r.founder_name} at ${r.name} has been invited to present at an investor forum where you were not invited. Your relationship with this LP may need reinforcing.`,
    ],
    severity: 'warning',
    impactMarketShare: 0,
    impactReputation: -4,
    impactMoney: -5000,
  },

  rep_attack: {
    titles: [
      'Market Reputation Under Attack',
      'Competitor Spreading Negative Intelligence',
      'Your Track Record Being Questioned',
    ],
    descriptions: [
      (r) => `Market sources indicate ${r.name} has been questioning your recent deal outcomes in conversations with investors. The narrative being pushed: your pipeline is thinner than presented.`,
      (r) => `${r.founder_name} of ${r.name} was overheard at a Lisbon networking event casting doubt on your advisory independence. Reputational management required.`,
      (r) => `An industry contact forwarded a market note from ${r.name} that subtly positions your recent activity unfavorably. Subtle — but deliberate.`,
    ],
    severity: 'alert',
    impactMarketShare: 0,
    impactReputation: -8,
    impactMoney: 0,
  },

  market_undercutting: {
    titles: [
      'Fee Undercutting in Progress',
      'Rival Competing on Price',
      'Market Pricing Under Pressure',
    ],
    descriptions: [
      (r, d) => `${r.name} is quoting advisory fees significantly below market rate in ${d ?? 'your territory'}. Two owners you were in conversation with have mentioned "a better offer" — likely ${r.founder_name}'s team.`,
      (r) => `${r.name} has begun a volume-first strategy, accepting lower fees to build market presence. This compresses margins across the board and makes seller expectations harder to manage.`,
      (r, d) => `A ${d ?? 'district'} hotel owner mentioned that ${r.name} offered a 1.2% fee versus your standard 2%. They're buying market share — consider whether to compete or differentiate.`,
    ],
    severity: 'info',
    impactMarketShare: -0.02,
    impactReputation: 0,
    impactMoney: -8000,
  },

  territory_takeover: {
    titles: [
      'Territory Under Serious Threat',
      'Rival Establishing Dominant Position',
      'Critical: Market Share Loss Accelerating',
    ],
    descriptions: [
      (r, d) => `${r.name} has closed three transactions in ${d ?? 'your district'} in the last 60 days. They are systematically building a portfolio of owner relationships that will be difficult to displace.`,
      (r, d) => `Emergency intelligence: ${r.founder_name}'s team has placed a dedicated relationship manager in ${d ?? 'this district'}. ${r.name} is making a serious territorial play. Act now or cede the ground.`,
      (r, d) => `${r.name} has been appointed exclusive advisor on the largest hotel asset currently for sale in ${d ?? 'your territory'}. This is a statement of market intent.`,
    ],
    severity: 'alert',
    impactMarketShare: -0.10,
    impactReputation: -6,
    impactMoney: -25000,
  },

  collaboration_offer: {
    titles: [
      'Co-Advisory Approach from Competitor',
      'Rival Firm Proposes Partnership',
      'Unexpected Collaboration Opportunity',
    ],
    descriptions: [
      (r) => `${r.founder_name} of ${r.name} has reached out through a mutual contact. They have a buy-side mandate they cannot cover alone and want to explore a co-advisory arrangement. Unusual — but potentially lucrative.`,
      (r) => `${r.name} has proposed a market-segmentation agreement: they focus on the premium tier, you take mid-market. It would reduce direct competition but also limits your upside.`,
      (r, d) => `Your rival ${r.name} is struggling with a ${d ?? 'complex'} transaction and wants your local expertise. A joint deal could earn €40K+ but means sharing credit with a competitor.`,
    ],
    severity: 'opportunity',
    impactMarketShare: 0.03,
    impactReputation: 3,
    impactMoney: 0,
  },
};

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ─── Main tick function ───────────────────────────────────────────────────────
// Called every few minutes from useGameState. Decides if any rivals act.

export const tickRivals = async (ctx: RivalContext): Promise<RivalEvent[]> => {
  const { player, playerDistricts, districts, rivals, rivalPresence, existingEvents } = ctx;
  const newEvents: RivalEvent[] = [];

  // Only generate at most 2 rival events per tick to avoid flooding
  let generated = 0;
  const MAX_PER_TICK = 2;

  // Each active rival decides whether to act
  for (const rival of rivals) {
    if (generated >= MAX_PER_TICK) break;
    if (!rival.is_active) continue;

    // Base probability based on aggression (1–10 → 5%–30% per tick)
    const baseChance = 0.03 + rival.aggression * 0.025;
    if (Math.random() > baseChance) continue;

    // Pick an event type weighted by context
    const eventType = pickEventType(rival, ctx);
    if (!eventType) continue;

    if (isOnCooldown(eventType, rival.id, existingEvents)) continue;

    // Find most relevant district
    const district = pickContestedDistrict(rival, ctx);
    const districtName = district?.name;

    const template = TEMPLATES[eventType];
    const title = pick(template.titles);
    const description = pick(template.descriptions)(rival, districtName);

    const evt = await insertRivalEvent({
      rival_id: rival.id,
      player_id: player.id,
      event_type: eventType,
      district_id: district?.id ?? null,
      title,
      description,
      severity: template.severity,
      impact_market_share: template.impactMarketShare,
      impact_reputation: template.impactReputation,
      impact_money: template.impactMoney,
      is_read: false,
    });

    if (evt) {
      newEvents.push(evt);
      generated++;

      // Update rival presence in district if there's a territory impact
      if (district && template.impactMarketShare !== 0) {
        const existing = (rivalPresence.get(district.id) ?? []).find(p => p.rival_id === rival.id);
        await upsertPresence({
          rival_id: rival.id,
          district_id: district.id,
          market_share: Math.min(0.5, (existing?.market_share ?? 0.05) + Math.abs(template.impactMarketShare)),
          deal_count: (existing?.deal_count ?? 0) + (eventType === 'deal_stolen' ? 1 : 0),
        });
      }
    }
  }

  return newEvents;
};

// ─── AI decision helpers ──────────────────────────────────────────────────────

function pickEventType(rival: RivalFirm, ctx: RivalContext): RivalEventType | null {
  const { playerDistricts } = ctx;
  const hasDistricts = playerDistricts.size > 0;
  const playerLevel = ctx.player.level;

  // Low-level player: mostly market competition and encroachment
  if (playerLevel < 5) {
    return pick(['territory_encroach', 'market_undercutting', 'market_undercutting'] as RivalEventType[]);
  }

  // Build weighted pool based on rival type and player strength
  const pool: RivalEventType[] = ['market_undercutting'];

  if (hasDistricts) {
    pool.push('territory_encroach', 'territory_encroach');
    if (playerDistricts.size >= 2) pool.push('deal_stolen');
    if (playerDistricts.size >= 3) pool.push('territory_takeover');
  }

  if (playerLevel >= 5) pool.push('investor_poached');
  if (playerLevel >= 8) pool.push('rep_attack');

  // High aggression rivals do harder attacks
  if (rival.aggression >= 8) {
    pool.push('deal_stolen', 'rep_attack', 'territory_takeover');
  }

  // Low aggression rivals sometimes offer collaboration
  if (rival.aggression <= 4 && playerLevel >= 6) {
    pool.push('collaboration_offer');
  }

  // International rivals target investors more
  if (rival.type === 'international') {
    pool.push('investor_poached', 'investor_poached');
  }

  return pick(pool);
}

function pickContestedDistrict(rival: RivalFirm, ctx: RivalContext): District | null {
  const { playerDistricts, districts } = ctx;

  if (playerDistricts.size === 0) {
    // Pick a district matching rival's focus
    const focused = districts.filter(d => {
      if (rival.market_focus === 'lisbon') return d.region === 'Lisbon Region';
      if (rival.market_focus === 'north') return d.region === 'North';
      if (rival.market_focus === 'algarve') return d.region === 'Algarve';
      return true;
    });
    return focused.length > 0 ? pick(focused) : pick(districts);
  }

  // Prefer player's active districts for conflict
  const playerDistrictIds = Array.from(playerDistricts.keys());
  const contested = districts.filter(d => playerDistrictIds.includes(d.id));

  // Filter by rival focus
  const focused = contested.filter(d => {
    if (rival.market_focus === 'lisbon') return d.region === 'Lisbon Region';
    if (rival.market_focus === 'north') return d.region === 'North';
    if (rival.market_focus === 'algarve') return d.region === 'Algarve';
    if (rival.market_focus === 'premium') return d.base_difficulty >= 3;
    return true;
  });

  const pool = focused.length > 0 ? focused : contested;
  return pool.length > 0 ? pick(pool) : null;
}

// ─── Rival stats helpers ──────────────────────────────────────────────────────

export const getRivalTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    firm: 'Advisory Firm',
    broker: 'Brokerage',
    boutique: 'Boutique',
    international: 'International',
  };
  return labels[type] ?? type;
};

export const getThreatLevel = (rival: RivalFirm, playerLevel: number): {
  label: string; color: string; score: number;
} => {
  const score = rival.aggression * 10 + rival.reputation_score * 0.5 - playerLevel * 3;
  if (score >= 80) return { label: 'Critical', color: '#ef4444', score };
  if (score >= 60) return { label: 'High',     color: '#f97316', score };
  if (score >= 40) return { label: 'Medium',   color: '#f59e0b', score };
  if (score >= 20) return { label: 'Low',      color: '#3b82f6', score };
  return              { label: 'Minimal',   color: '#10b981', score };
};

export const EVENT_TYPE_META: Record<RivalEventType, { label: string; icon: string; color: string }> = {
  territory_encroach:  { label: 'Territory Pressure', icon: '🗺️', color: '#f59e0b' },
  deal_stolen:         { label: 'Lost Deal',          icon: '💼', color: '#ef4444' },
  investor_poached:    { label: 'Investor Risk',      icon: '💰', color: '#f97316' },
  rep_attack:          { label: 'Rep Attack',         icon: '⚔️', color: '#ef4444' },
  market_undercutting: { label: 'Undercutting',       icon: '📉', color: '#64748b' },
  territory_takeover:  { label: 'Takeover',           icon: '🔴', color: '#ef4444' },
  collaboration_offer: { label: 'Collaboration',      icon: '🤝', color: '#10b981' },
};
