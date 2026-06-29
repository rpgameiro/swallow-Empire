import { Lead, LeadMatch, MatchTier, MATCH_TIER_META } from '../types/game';
import { supabase } from './supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `€${Math.round(n / 1_000)}k`;
  return `€${n}`;
}

function hasValue(n: number | null | undefined): boolean {
  return typeof n === 'number' && n > 0;
}

// ─── Completeness check ───────────────────────────────────────────────────────
// Gates on budget + location only. Asset type is intentionally excluded.

function missingFields(investor: Lead, owner: Lead): string[] {
  const missing: string[] = [];
  // Investor needs: budget (investment_max or estimated_value), locations
  if (!hasValue(investor.investment_max) && !hasValue(investor.estimated_value)) {
    missing.push('Investor budget not set (Valor Estimado)');
  }
  if (!investor.locations.length) missing.push('Investor location not set (Localização)');
  // Owner needs: estimated_value, locations
  if (!hasValue(owner.estimated_value)) missing.push('Owner asset value not set (Valor Estimado)');
  if (!owner.locations.length)          missing.push('Owner location not set (Localização)');
  return missing;
}

// ─── Budget check (hard gate) ─────────────────────────────────────────────────

interface BudgetResult { compatible: boolean; reason: string }

function checkBudget(investor: Lead, owner: Lead): BudgetResult {
  // Investor budget = investment_max if set, else estimated_value (mapped from Valor Estimado)
  const budget = hasValue(investor.investment_max)
    ? investor.investment_max
    : hasValue(investor.estimated_value) ? investor.estimated_value : 0;
  const assetValue = owner.estimated_value;

  if (!budget || !assetValue) {
    return { compatible: true, reason: '' }; // unknown — can't gate
  }

  if (assetValue <= budget) {
    return {
      compatible: true,
      reason: `Asset value ${fmt(assetValue)} within investor budget ${fmt(budget)}`,
    };
  }

  return {
    compatible: false,
    reason: `Asset value ${fmt(assetValue)} exceeds investor budget ${fmt(budget)}`,
  };
}

// ─── Asset overlap (informational only — never blocks a match) ────────────────

interface AssetResult { matches: boolean; score: number; reason: string | null }

function checkAssets(investor: Lead, owner: Lead): AssetResult {
  if (!investor.asset_types.length || !owner.asset_types.length) {
    return { matches: false, score: 0, reason: null };
  }
  const overlap = investor.asset_types.filter(a =>
    owner.asset_types.some(oa => oa.toLowerCase() === a.toLowerCase())
  );
  if (!overlap.length) return { matches: false, score: 0, reason: null };

  const pct   = overlap.length / Math.max(investor.asset_types.length, owner.asset_types.length);
  const score = Math.round(pct * 35);
  return {
    matches: true,
    score,
    reason: `Asset match: ${overlap.slice(0, 3).join(', ')}`,
  };
}

// ─── Location check (+35, with "Todas" wildcard) ──────────────────────────────

interface LocationResult { score: number; reason: string | null }

function checkLocations(investor: Lead, owner: Lead): LocationResult {
  if (!investor.locations.length || !owner.locations.length) {
    return { score: 0, reason: null };
  }

  // "Todas" = investor accepts any location
  if (investor.locations.some(l => l.toLowerCase() === 'todas')) {
    return {
      score: 35,
      reason: `Investor accepts all locations · Owner in ${owner.locations.slice(0, 2).join(', ')}`,
    };
  }

  const overlap = investor.locations.filter(l =>
    owner.locations.some(ol => ol.toLowerCase() === l.toLowerCase())
  );
  if (!overlap.length) return { score: 0, reason: null };

  const pct   = overlap.length / Math.max(investor.locations.length, owner.locations.length);
  const score = Math.round(pct * 35);
  const reason = overlap.length === 1
    ? `Location match: ${overlap[0]}`
    : `${overlap.length} shared locations: ${overlap.slice(0, 2).join(', ')}`;
  return { score, reason };
}

// ─── Status/Prioridade signal (+10) ───────────────────────────────────────────

interface UrgencyResult { score: number; reason: string | null }

function checkUrgency(investor: Lead, owner: Lead): UrgencyResult {
  const rank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
  const combined = (rank[investor.urgency] ?? 2) + (rank[owner.urgency] ?? 2);
  if (combined >= 7) return { score: 10, reason: 'Both parties have high urgency' };
  if (combined >= 5) return { score: 5,  reason: 'Strong motivation from both sides' };
  return { score: 0, reason: null };
}

// ─── Data quality bonus (+20) ─────────────────────────────────────────────────
// 3 fields per side × proportional 10 pts = up to 20 total.
// Asset type is intentionally excluded — only budget, location, and name are assessed.

function dataQualityBonus(investor: Lead, owner: Lead): number {
  let score = 0;
  const invFields = [
    hasValue(investor.investment_max) || hasValue(investor.estimated_value),
    investor.locations.length > 0,
    !!investor.name && investor.name !== 'Unnamed',
  ];
  const ownFields = [
    hasValue(owner.estimated_value),
    owner.locations.length > 0,
    !!owner.name && owner.name !== 'Unnamed',
  ];
  const invComplete = invFields.filter(Boolean).length;
  const ownComplete = ownFields.filter(Boolean).length;
  score += Math.round((invComplete / invFields.length) * 10);
  score += Math.round((ownComplete / ownFields.length) * 10);
  return score; // 0–20
}

// ─── Tier assignment ──────────────────────────────────────────────────────────
// Hard gates: budget first, then location.
// Asset type is NOT a gate — only informational.

function tierFromScore(score: number, budgetOk: boolean, locationOk: boolean): MatchTier {
  if (!budgetOk)   return 'budget_mismatch';
  if (!locationOk) return 'low';
  if (score >= MATCH_TIER_META.legendary.minScore) return 'legendary';
  if (score >= MATCH_TIER_META.strong.minScore)    return 'strong';
  if (score >= MATCH_TIER_META.warm.minScore)      return 'warm';
  return 'low';
}

function opportunityType(tier: MatchTier, investor: Lead, owner: Lead): string {
  if (tier === 'budget_mismatch') return 'Budget Review Required';
  if (tier === 'incomplete_data') return 'Incomplete Lead Data';
  if (tier === 'legendary') return 'Premium Direct Introduction';
  if (tier === 'strong') {
    const luxuryTypes = ['luxury', 'heritage', 'resort', 'Luxury', 'Heritage', 'Resort'];
    const hasLuxury = [...investor.asset_types, ...owner.asset_types].some(a => luxuryTypes.includes(a));
    return hasLuxury ? 'Exclusive Advisory Mandate' : 'Acquisition Advisory';
  }
  if (tier === 'warm') return 'Qualified Introduction';
  return 'Exploratory Contact';
}

function suggestedAction(tier: MatchTier, investor: Lead, owner: Lead): string {
  const invName = investor.name.split(' ')[0];
  const ownName = owner.name.split(' ')[0];
  if (tier === 'budget_mismatch') {
    const budget = hasValue(investor.investment_max) ? investor.investment_max : investor.estimated_value;
    return `Review ${ownName}'s asking price (${fmt(owner.estimated_value)}) against ${invName}'s budget cap (${fmt(budget)}). Consider negotiating a price reduction or sourcing a different asset.`;
  }
  if (tier === 'incomplete_data') {
    return `Complete the lead profiles before running matching. Ensure both parties have Valor Estimado and Localização set in Notion.`;
  }
  if (tier === 'legendary') return `Arrange a private introductory meeting between ${invName} and ${ownName}. Prepare a confidential deal brief before the call.`;
  if (tier === 'strong')    return `Send a warm introduction email to both parties. Propose a 30-minute alignment call within the week.`;
  if (tier === 'warm')      return `Reach out to ${ownName} to confirm current timeline. Share an anonymised investor profile with ${invName} for feedback.`;
  return `File for future reference. Revisit when ${ownName}'s asset is closer to market readiness.`;
}

// ─── Main match computation ───────────────────────────────────────────────────

export interface ComputedMatch {
  investor: Lead;
  owner: Lead;
  score: number;
  tier: MatchTier;
  budgetCompatible: boolean;
  reasons: string[];
  suggestedAction: string;
  opportunityType: string;
}

export function computeMatch(investor: Lead, owner: Lead): ComputedMatch {
  // 1. Completeness — gates on budget + location only
  const missing = missingFields(investor, owner);
  if (missing.length > 0) {
    return {
      investor, owner,
      score: 0,
      tier: 'incomplete_data',
      budgetCompatible: true,
      reasons: missing,
      suggestedAction: suggestedAction('incomplete_data', investor, owner),
      opportunityType: opportunityType('incomplete_data', investor, owner),
    };
  }

  // 2. Budget (hard gate)
  const budget = checkBudget(investor, owner);

  // 3. Asset overlap (informational — score only, never blocks tier)
  const asset = checkAssets(investor, owner);

  // 4. Location overlap
  const loc = checkLocations(investor, owner);

  // locationOk: score > 0 means at least one location overlapped (includes Todas wildcard)
  const locationOk = loc.score > 0;

  // 5. Urgency signal
  const urg = checkUrgency(investor, owner);

  // 6. Data quality bonus
  const quality = dataQualityBonus(investor, owner);

  // Score: budget mismatch caps at 30; asset contributes 0 when no overlap
  let score = loc.score + asset.score + urg.score + quality;
  if (!budget.compatible) score = Math.min(score, 30);
  score = Math.min(score, 100);

  // Tier: gated by budget then location; asset.matches is NOT used here
  const tier = tierFromScore(score, budget.compatible, locationOk);

  const reasons: string[] = [];
  if (!budget.compatible) {
    reasons.push(budget.reason); // first — prominent
  } else if (budget.reason) {
    reasons.push(budget.reason);
  }
  if (asset.reason) reasons.push(asset.reason);
  if (loc.reason)   reasons.push(loc.reason);
  if (urg.reason)   reasons.push(urg.reason);
  if (!reasons.length) reasons.push('Shared market segment with exploratory potential');

  return {
    investor, owner, score, tier,
    budgetCompatible: budget.compatible,
    reasons,
    suggestedAction: suggestedAction(tier, investor, owner),
    opportunityType: opportunityType(tier, investor, owner),
  };
}

export function computeAllMatches(leads: Lead[]): ComputedMatch[] {
  const investors = leads.filter(l => l.tipo === 'Investidor'   && l.status === 'active');
  const owners    = leads.filter(l => l.tipo === 'Proprietário' && l.status === 'active');
  const results: ComputedMatch[] = [];

  for (const inv of investors) {
    for (const own of owners) {
      results.push(computeMatch(inv, own));
    }
  }

  // Sort: real tiers first by score desc; budget_mismatch next; incomplete_data last
  return results.sort((a, b) => {
    const rankTier = (t: MatchTier) =>
      t === 'incomplete_data' ? 2 : t === 'budget_mismatch' ? 1 : 0;
    const ra = rankTier(a.tier), rb = rankTier(b.tier);
    if (ra !== rb) return ra - rb;
    return b.score - a.score;
  });
}

// XP awarded per match tier
export const MATCH_XP: Record<MatchTier, number> = {
  legendary:       500,
  strong:          200,
  warm:            75,
  low:             15,
  budget_mismatch: 0,
  incomplete_data: 0,
};

// ─── DB functions ─────────────────────────────────────────────────────────────

export const getLeads = async (playerId: string): Promise<Lead[]> => {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[matchingEngine] getLeads failed:', error);
    throw error;
  }
  return data ?? [];
};

export const createLead = async (
  playerId: string,
  lead: Omit<Lead, 'id' | 'player_id' | 'created_at' | 'updated_at'>,
): Promise<Lead> => {
  const { data, error } = await supabase
    .from('leads')
    .insert([{ ...lead, player_id: playerId }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateLead = async (leadId: string, updates: Partial<Lead>): Promise<Lead> => {
  const { data, error } = await supabase
    .from('leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteLead = async (leadId: string): Promise<void> => {
  await supabase.from('leads').delete().eq('id', leadId);
};

export const getLeadMatches = async (playerId: string): Promise<LeadMatch[]> => {
  const { data, error } = await supabase
    .from('lead_matches')
    .select('*')
    .eq('player_id', playerId)
    .eq('is_dismissed', false)
    .order('match_score', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const saveLeadMatch = async (
  playerId: string,
  match: ComputedMatch,
  xpAwarded: number,
  questGenerated: boolean,
  districtId: string | null,
): Promise<LeadMatch> => {
  const { data, error } = await supabase
    .from('lead_matches')
    .insert([{
      player_id:        playerId,
      investor_lead_id: match.investor.id,
      owner_lead_id:    match.owner.id,
      match_score:      match.score,
      match_tier:       match.tier,
      match_reasons:    match.reasons,
      suggested_action: match.suggestedAction,
      opportunity_type: match.opportunityType,
      district_id:      districtId,
      xp_awarded:       xpAwarded,
      quest_generated:  questGenerated,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const dismissMatch = async (matchId: string): Promise<void> => {
  await supabase.from('lead_matches').update({ is_dismissed: true }).eq('id', matchId);
};

export const actionMatch = async (matchId: string): Promise<void> => {
  await supabase.from('lead_matches').update({ is_actioned: true }).eq('id', matchId);
};
