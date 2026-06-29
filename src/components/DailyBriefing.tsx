import { useMemo } from 'react';
import {
  Target, Phone, MapPin, Zap, TrendingUp, Crown,
  AlertTriangle, CheckCircle, Clock, Star, Building2,
  ChevronRight, Flame, Award, BarChart3,
} from 'lucide-react';
import {
  Player, PlayerDistrict, District, NPC,
  PlayerNPCRelationship, PlayerReputation,
  xpRequiredForLevel,
} from '../types/game';
import { DynamicQuest } from '../services/questEngine';
import { ComputedMatch } from '../services/matchingEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BriefingSection<T> {
  items: T[];
  generatedAt: string;
}

export interface DailyBriefingData {
  priorityOpportunities: BriefingSection<PriorityOpportunity>;
  topMatches: BriefingSection<BriefingMatch>;
  recommendedCalls: BriefingSection<RecommendedCall>;
  districtFocus: BriefingSection<DistrictFocusItem>;
  xpGoals: XPGoals;
  empireTargets: EmpireTargets;
}

export interface PriorityOpportunity {
  id: string;
  title: string;
  subtitle: string;
  urgency: 'critical' | 'high' | 'medium';
  reward: string;
  source: 'quest' | 'district' | 'rival' | 'match';
  accentColor: string;
  icon: 'target' | 'alert' | 'flame' | 'crown';
}

export interface BriefingMatch {
  id: string;
  investorName: string;
  ownerName: string;
  score: number;
  tier: string;
  location: string;
  opportunityType: string;
  suggestedAction: string;
}

export interface RecommendedCall {
  id: string;
  name: string;
  role: string;
  reason: string;
  trustLevel: number;
  relationshipStatus: string;
  accentColor: string;
  initials: string;
  priority: 'warm' | 'follow_up' | 'new';
}

export interface DistrictFocusItem {
  districtId: string;
  name: string;
  marketShare: number;
  territoryLevel: number;
  reason: string;
  action: string;
  urgency: 'attack' | 'defend' | 'expand';
}

export interface XPGoals {
  currentXP: number;
  xpToNextLevel: number;
  level: number;
  dailyXPTarget: number;
  questsToComplete: number;
  bonusAction: string;
  progress: number;
}

export interface EmpireTargets {
  currentEmpireValue: number;
  targetEmpireValue: number;
  monthlyIncome: number;
  incomeTarget: number;
  dominanceTarget: number;
  avgDominance: number;
  districtTarget: number;
  currentDistricts: number;
}

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateDailyBriefing(
  player: Player,
  districts: District[],
  playerDistricts: Map<string, PlayerDistrict>,
  dynamicQuests: DynamicQuest[],
  npcs: NPC[],
  npcRelationships: Map<string, PlayerNPCRelationship>,
  recentMatches: ComputedMatch[],
  reputation: PlayerReputation | null,
): DailyBriefingData {
  const now = new Date().toISOString();

  // ── Priority opportunities ──────────────────────────────────────────────
  const activeQuests = dynamicQuests.filter(q => q.status === 'active');
  const expiringSoon = activeQuests.filter(q => {
    if (!q.expires_at) return false;
    const ms = new Date(q.expires_at).getTime() - Date.now();
    return ms < 12 * 3_600_000 && ms > 0;
  });

  const priorityOps: PriorityOpportunity[] = [];

  // Legendary/weekly quests with expiry
  expiringSoon.slice(0, 2).forEach(q => {
    priorityOps.push({
      id: `quest-${q.id}`,
      title: q.title,
      subtitle: `Expires in ${formatHoursRemaining(q.expires_at!)} · ${q.xp_reward} XP`,
      urgency: 'critical',
      reward: `+${q.xp_reward} XP · +${q.reputation_reward} Rep`,
      source: 'quest',
      accentColor: '#ef4444',
      icon: 'alert',
    });
  });

  // Highest-XP active quests
  const topQuests = activeQuests
    .filter(q => !expiringSoon.includes(q))
    .sort((a, b) => b.xp_reward - a.xp_reward)
    .slice(0, 3 - priorityOps.length);

  topQuests.forEach(q => {
    const isLegendary = q.quest_type === 'legendary';
    priorityOps.push({
      id: `quest-${q.id}`,
      title: q.title,
      subtitle: q.description.slice(0, 72) + (q.description.length > 72 ? '…' : ''),
      urgency: isLegendary ? 'high' : 'medium',
      reward: `+${q.xp_reward} XP · €${q.money_reward.toLocaleString()}`,
      source: 'quest',
      accentColor: isLegendary ? '#f59e0b' : '#10b981',
      icon: isLegendary ? 'crown' : 'target',
    });
  });

  // Weak districts being contested
  Array.from(playerDistricts.entries())
    .filter(([, pd]) => pd.market_share < 0.25)
    .slice(0, 2)
    .forEach(([did, pd]) => {
      const d = districts.find(x => x.id === did);
      if (!d) return;
      if (priorityOps.length >= 5) return;
      priorityOps.push({
        id: `district-${did}`,
        title: `Defend ${d.name}`,
        subtitle: `Market share at ${Math.round(pd.market_share * 100)}% — low dominance, needs attention`,
        urgency: 'high',
        reward: '+75 Dominance XP · +5% Market Share',
        source: 'district',
        accentColor: '#f97316',
        icon: 'flame',
      });
    });

  // ── Top matches ────────────────────────────────────────────────────────
  const topMatches: BriefingMatch[] = recentMatches
    .filter(m => m.tier === 'legendary' || m.tier === 'strong')
    .slice(0, 4)
    .map(m => ({
      id: `${m.investor.id}_${m.owner.id}`,
      investorName: m.investor.name,
      ownerName: m.owner.name,
      score: m.score,
      tier: m.tier,
      location: m.investor.locations[0] ?? m.owner.locations[0] ?? 'Portugal',
      opportunityType: m.opportunityType,
      suggestedAction: m.suggestedAction,
    }));

  // ── Recommended calls ─────────────────────────────────────────────────
  const recommendedCalls: RecommendedCall[] = [];

  // NPCs with high trust but not recently contacted
  npcs.forEach(npc => {
    if (recommendedCalls.length >= 4) return;
    const rel = npcRelationships.get(npc.id);
    if (!rel) return;
    const daysSinceLast = rel.last_interaction_at
      ? (Date.now() - new Date(rel.last_interaction_at).getTime()) / 86_400_000
      : 999;

    let priority: RecommendedCall['priority'] | null = null;
    let reason = '';

    if (rel.trust_level >= 70 && daysSinceLast > 3) {
      priority = 'warm';
      reason = 'High-trust contact — reinforce the relationship';
    } else if (rel.trust_level >= 40 && daysSinceLast > 7) {
      priority = 'follow_up';
      reason = `Last contact ${Math.round(daysSinceLast)}d ago — stay on their radar`;
    } else if (rel.relationship_status === 'acquaintance' && rel.interaction_count < 3) {
      priority = 'new';
      reason = 'New contact — build early trust fast';
    }

    if (priority) {
      recommendedCalls.push({
        id: npc.id,
        name: npc.name,
        role: npc.title,
        reason,
        trustLevel: rel.trust_level,
        relationshipStatus: rel.relationship_status,
        accentColor: npc.accent_color,
        initials: npc.avatar_initials,
        priority,
      });
    }
  });

  // ── District focus ────────────────────────────────────────────────────
  const districtFocus: DistrictFocusItem[] = [];

  // Highest-dominance district to push to next level
  const sorted = Array.from(playerDistricts.entries())
    .sort(([, a], [, b]) => b.market_share - a.market_share);

  sorted.slice(0, 2).forEach(([did, pd]) => {
    const d = districts.find(x => x.id === did);
    if (!d) return;
    const pct = Math.round(pd.market_share * 100);
    districtFocus.push({
      districtId: did,
      name: d.name,
      marketShare: pct,
      territoryLevel: pd.territory_level,
      reason: pct >= 50 ? 'Dominant — press for full control' : 'Growing — accelerate to lock in territory',
      action: pct >= 50 ? 'Close a deal to cement dominance' : 'Complete a district quest to gain market share',
      urgency: pct < 25 ? 'defend' : pct < 50 ? 'expand' : 'attack',
    });
  });

  // Unlock a new district if player has capacity
  const unlockedDistricts = new Set(playerDistricts.keys());
  const nextDistrict = districts.find(d =>
    !unlockedDistricts.has(d.id) &&
    d.unlock_requirement <= player.level
  );
  if (nextDistrict && districtFocus.length < 3) {
    districtFocus.push({
      districtId: nextDistrict.id,
      name: nextDistrict.name,
      marketShare: 0,
      territoryLevel: 0,
      reason: 'Unlocked — claim the territory before rivals move in',
      action: 'Enter district and start your first quest',
      urgency: 'expand',
    });
  }

  // ── XP goals ─────────────────────────────────────────────────────────
  const xpToNextLevel = xpRequiredForLevel(player.level + 1);
  const xpProgress = player.current_xp / xpToNextLevel;
  const dailyXPTarget = Math.round(xpToNextLevel * 0.15); // ~7 days to level up
  const questsToComplete = Math.max(1, Math.ceil(dailyXPTarget / 150));
  const bonusAction = player.level < 10
    ? 'Complete a main quest for bonus SP'
    : player.skill_points > 0
    ? 'Spend your skill points to boost stats'
    : 'Run a site visit for +150 XP district bonus';

  // ── Empire targets ────────────────────────────────────────────────────
  const avgDominance = playerDistricts.size > 0
    ? Math.round(
        Array.from(playerDistricts.values()).reduce((s, pd) => s + pd.market_share, 0)
        / playerDistricts.size * 100
      )
    : 0;

  const empireValue   = player.empire_value    ?? 0;
  const monthlyIncome = player.monthly_income  ?? 0;

  const empireTargets: EmpireTargets = {
    currentEmpireValue: empireValue,
    targetEmpireValue:  Math.ceil((empireValue * 1.25) / 50000) * 50000 || 50000,
    monthlyIncome,
    incomeTarget:       Math.ceil((monthlyIncome * 1.3) / 1000) * 1000 || 1000,
    dominanceTarget:    Math.min(100, avgDominance + 15),
    avgDominance,
    districtTarget:     Math.min(12, playerDistricts.size + 2),
    currentDistricts:   playerDistricts.size,
  };

  return {
    priorityOpportunities: { items: priorityOps.slice(0, 5), generatedAt: now },
    topMatches:            { items: topMatches, generatedAt: now },
    recommendedCalls:      { items: recommendedCalls.slice(0, 4), generatedAt: now },
    districtFocus:         { items: districtFocus.slice(0, 3), generatedAt: now },
    xpGoals: {
      currentXP: player.current_xp,
      xpToNextLevel,
      level: player.level,
      dailyXPTarget,
      questsToComplete,
      bonusAction,
      progress: xpProgress,
    },
    empireTargets,
  };
}

function formatHoursRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, count, accentColor = '#f59e0b' }: {
  icon: React.ElementType;
  label: string;
  count?: number;
  accentColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
      <span className="text-xs font-black uppercase tracking-widest" style={{ color: accentColor }}>{label}</span>
      {count != null && (
        <span
          className="ml-1 text-xs font-black px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}30` }}
        >
          {count}
        </span>
      )}
      <div className="flex-1 h-px ml-1" style={{ background: `linear-gradient(90deg, ${accentColor}30, transparent)` }} />
    </div>
  );
}

const URGENCY_META = {
  critical: { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
  high:     { label: 'HIGH',     color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)' },
  medium:   { label: 'MEDIUM',   color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)' },
};

const TIER_META: Record<string, { color: string; label: string }> = {
  legendary: { color: '#f59e0b', label: 'LEGENDARY' },
  strong:    { color: '#10b981', label: 'STRONG' },
  warm:      { color: '#3b82f6', label: 'WARM' },
  low:       { color: '#64748b', label: 'LOW' },
};

const CALL_PRIORITY_META = {
  warm:       { label: 'WARM LEAD', color: '#f59e0b' },
  follow_up:  { label: 'FOLLOW UP', color: '#3b82f6' },
  new:        { label: 'NEW CONTACT', color: '#10b981' },
};

const DISTRICT_URGENCY_META = {
  attack:  { label: 'ATTACK', color: '#f59e0b', icon: Crown },
  defend:  { label: 'DEFEND', color: '#ef4444', icon: AlertTriangle },
  expand:  { label: 'EXPAND', color: '#10b981', icon: TrendingUp },
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  briefing: DailyBriefingData;
  date: string;
  playerName: string;
}

export function DailyBriefing({ briefing, date, playerName }: Props) {
  const { priorityOpportunities, topMatches, recommendedCalls, districtFocus, xpGoals, empireTargets } = briefing;

  const xpPct = Math.min(xpGoals.progress * 100, 100);
  const xpDailyPct = Math.min((xpGoals.currentXP / xpGoals.dailyXPTarget) * 100, 100);

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-800/30"
        style={{ background: 'linear-gradient(135deg, rgba(120,53,15,0.25) 0%, rgba(15,23,42,0.6) 60%, rgba(7,15,30,0.4) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.6), rgba(249,115,22,0.4), transparent)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-px opacity-30"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)' }} />
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)' }} />
        </div>
        <div className="relative p-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">Daily Mission Briefing</span>
            </div>
            <h2 className="text-xl font-black text-white leading-tight">Good morning, {playerName}.</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {date} — Your empire needs direction. Here is today's intelligence report.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <StatChip label="Opportunities" value={priorityOpportunities.items.length} color="#f59e0b" />
            <StatChip label="Matches" value={topMatches.items.length} color="#10b981" />
            <StatChip label="Calls" value={recommendedCalls.items.length} color="#3b82f6" />
          </div>
        </div>
      </div>

      {/* ── Two-column grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* LEFT COLUMN */}
        <div className="space-y-5">

          {/* Priority Opportunities */}
          <BriefingCard>
            <SectionHeader icon={Target} label="Priority Opportunities" count={priorityOpportunities.items.length} accentColor="#f59e0b" />
            {priorityOpportunities.items.length === 0 ? (
              <EmptyState icon={CheckCircle} text="All opportunities handled. Check back after completing a quest." />
            ) : (
              <div className="space-y-2">
                {priorityOpportunities.items.map((op, i) => {
                  const meta = URGENCY_META[op.urgency];
                  return (
                    <div key={op.id}
                      className="rounded-xl px-3.5 py-3 border transition-all"
                      style={{
                        background: meta.bg,
                        borderColor: meta.border,
                        animationDelay: `${i * 0.05}s`,
                      }}>
                      <div className="flex items-start gap-2.5">
                        <OpIcon name={op.icon} color={op.accentColor} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-xs font-black px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
                              {meta.label}
                            </span>
                            <span className="text-white font-bold text-sm truncate">{op.title}</span>
                          </div>
                          <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{op.subtitle}</p>
                          <p className="text-xs font-bold mt-1" style={{ color: op.accentColor }}>{op.reward}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </BriefingCard>

          {/* Recommended Calls */}
          <BriefingCard>
            <SectionHeader icon={Phone} label="Recommended Calls" count={recommendedCalls.items.length} accentColor="#3b82f6" />
            {recommendedCalls.items.length === 0 ? (
              <EmptyState icon={Phone} text="Add contacts in the Contacts tab to get call recommendations." />
            ) : (
              <div className="space-y-2">
                {recommendedCalls.items.map((call, i) => {
                  const pm = CALL_PRIORITY_META[call.priority];
                  return (
                    <div key={call.id}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 border border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/40 transition-all group"
                      style={{ animationDelay: `${i * 0.06}s` }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 text-white"
                        style={{ background: `linear-gradient(135deg, ${call.accentColor}40, ${call.accentColor}20)`, border: `1.5px solid ${call.accentColor}50` }}>
                        {call.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm truncate">{call.name}</span>
                          <span className="text-xs font-black px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ backgroundColor: `${pm.color}18`, color: pm.color }}>
                            {pm.label}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs truncate">{call.role}</p>
                        <p className="text-slate-400 text-xs leading-snug mt-0.5">{call.reason}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <TrustBar trust={call.trustLevel} color={call.accentColor} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </BriefingCard>

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">

          {/* Top Matches */}
          <BriefingCard>
            <SectionHeader icon={Star} label="Top Matches" count={topMatches.items.length} accentColor="#10b981" />
            {topMatches.items.length === 0 ? (
              <EmptyState icon={Star} text="Run the matching engine in the Leads tab to surface top matches." />
            ) : (
              <div className="space-y-2">
                {topMatches.items.map((m, i) => {
                  const tm = TIER_META[m.tier] ?? TIER_META.low;
                  return (
                    <div key={m.id}
                      className="rounded-xl px-3.5 py-3 border transition-all"
                      style={{
                        background: `${tm.color}08`,
                        borderColor: `${tm.color}25`,
                        animationDelay: `${i * 0.05}s`,
                      }}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${tm.color}20`, color: tm.color }}>
                              {tm.label}
                            </span>
                            <span className="text-slate-400 text-xs">{m.location}</span>
                          </div>
                          <p className="text-white font-bold text-sm mt-1 truncate">
                            {m.investorName} <span className="text-slate-500 font-normal">×</span> {m.ownerName}
                          </p>
                          <p className="text-slate-500 text-xs truncate">{m.opportunityType}</p>
                        </div>
                        <ScoreRing score={m.score} color={tm.color} />
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 border-t border-slate-800/60 pt-2 mt-2">
                        {m.suggestedAction}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </BriefingCard>

          {/* District Focus */}
          <BriefingCard>
            <SectionHeader icon={MapPin} label="District Focus" count={districtFocus.items.length} accentColor="#f97316" />
            {districtFocus.items.length === 0 ? (
              <EmptyState icon={Building2} text="Enter your first district to receive territorial intelligence." />
            ) : (
              <div className="space-y-2">
                {districtFocus.items.map((df, i) => {
                  const dm = DISTRICT_URGENCY_META[df.urgency];
                  const DIcon = dm.icon;
                  return (
                    <div key={df.districtId}
                      className="rounded-xl px-3.5 py-3 border border-slate-800/60 bg-slate-900/40 transition-all"
                      style={{ animationDelay: `${i * 0.06}s` }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <DIcon className="w-4 h-4 flex-shrink-0" style={{ color: dm.color }} />
                          <span className="text-white font-black text-sm">{df.name}</span>
                          <span className="text-xs font-black px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${dm.color}18`, color: dm.color }}>
                            {dm.label}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 flex-shrink-0">T{df.territoryLevel}</span>
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">Market Share</span>
                          <span className="font-bold" style={{ color: dm.color }}>{df.marketShare}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${df.marketShare}%`,
                              background: `linear-gradient(90deg, ${dm.color}, ${dm.color}aa)`,
                              boxShadow: `0 0 6px ${dm.color}60`,
                            }} />
                        </div>
                      </div>
                      <p className="text-slate-400 text-xs">{df.reason}</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: dm.color }} />
                        <p className="text-xs font-bold" style={{ color: dm.color }}>{df.action}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </BriefingCard>

        </div>
      </div>

      {/* ── Bottom row: XP Goals + Empire Targets ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* XP Goals */}
        <BriefingCard>
          <SectionHeader icon={Zap} label="XP Goals" accentColor="#a78bfa" />
          <div className="space-y-4">
            {/* Level progress */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Level {xpGoals.level} Progress</span>
                <span className="font-black text-slate-200">
                  {xpGoals.currentXP.toLocaleString()} / {xpGoals.xpToNextLevel.toLocaleString()} XP
                </span>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-700 relative"
                  style={{
                    width: `${xpPct}%`,
                    background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #c4b5fd)',
                    boxShadow: '0 0 10px rgba(167,139,250,0.5)',
                  }}
                >
                  <div className="absolute inset-0 shimmer-overlay rounded-full" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">{Math.round(xpPct)}% to Level {xpGoals.level + 1}</p>
            </div>

            {/* Daily target */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Daily Target ({xpGoals.dailyXPTarget.toLocaleString()} XP)</span>
                <span className="font-bold text-violet-400">{Math.round(xpDailyPct)}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${xpDailyPct}%`,
                    background: xpDailyPct >= 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                  }}
                />
              </div>
            </div>

            {/* Action items */}
            <div className="space-y-1.5">
              <XPActionItem
                icon={Award}
                text={`Complete ${xpGoals.questsToComplete} quest${xpGoals.questsToComplete !== 1 ? 's' : ''} today`}
                xp={`~${(xpGoals.questsToComplete * 150).toLocaleString()} XP`}
              />
              <XPActionItem
                icon={Zap}
                text={xpGoals.bonusAction}
                xp="Bonus XP"
                accent
              />
            </div>
          </div>
        </BriefingCard>

        {/* Empire Growth Targets */}
        <BriefingCard>
          <SectionHeader icon={TrendingUp} label="Empire Growth Targets" accentColor="#10b981" />
          <div className="space-y-3">
            <EmpireTarget
              label="Empire Value"
              current={empireTargets.currentEmpireValue}
              target={empireTargets.targetEmpireValue}
              formatter={v => `€${(v / 1_000_000).toFixed(1)}M`}
              color="#10b981"
            />
            <EmpireTarget
              label="Monthly Income"
              current={empireTargets.monthlyIncome}
              target={empireTargets.incomeTarget}
              formatter={v => `€${v.toLocaleString()}`}
              color="#3b82f6"
            />
            <EmpireTarget
              label="Avg Dominance"
              current={empireTargets.avgDominance}
              target={empireTargets.dominanceTarget}
              formatter={v => `${v}%`}
              color="#f59e0b"
            />
            <EmpireTarget
              label="Districts"
              current={empireTargets.currentDistricts}
              target={empireTargets.districtTarget}
              formatter={v => `${v} / 12`}
              color="#f97316"
            />
          </div>
        </BriefingCard>

      </div>
    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function BriefingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center px-3 py-2 rounded-xl border"
      style={{ borderColor: `${color}30`, background: `${color}08` }}>
      <p className="text-lg font-black leading-none" style={{ color }}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function OpIcon({ name, color }: { name: PriorityOpportunity['icon']; color: string }) {
  const icons = { target: Target, alert: AlertTriangle, flame: Flame, crown: Crown };
  const Icon = icons[name];
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
      <Icon className="w-4 h-4" style={{ color }} />
    </div>
  );
}

function TrustBar({ trust, color }: { trust: number; color: string }) {
  return (
    <div className="text-right">
      <p className="text-xs font-bold mb-1" style={{ color }}>{trust}%</p>
      <div className="w-14 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${trust}%`, background: color }} />
      </div>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="relative text-xs font-black" style={{ color }}>{score}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3 py-3 text-slate-600">
      <Icon className="w-4 h-4 flex-shrink-0" />
      <p className="text-xs leading-relaxed">{text}</p>
    </div>
  );
}

function XPActionItem({ icon: Icon, text, xp, accent }: {
  icon: React.ElementType;
  text: string;
  xp: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 border border-slate-800/60"
      style={{ background: accent ? 'rgba(167,139,250,0.05)' : 'rgba(15,23,42,0.3)' }}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent ? '#a78bfa' : '#64748b' }} />
      <span className="text-xs text-slate-300 flex-1">{text}</span>
      <span className="text-xs font-bold flex-shrink-0" style={{ color: accent ? '#a78bfa' : '#64748b' }}>{xp}</span>
    </div>
  );
}

function EmpireTarget({ label, current, target, formatter, color }: {
  label: string;
  current: number;
  target: number;
  formatter: (v: number) => string;
  color: string;
}) {
  const safeC = isFinite(current) ? current : 0;
  const safeT = isFinite(target)  ? target  : 0;
  const pct = safeT > 0 ? Math.min((safeC / safeT) * 100, 100) : 0;
  const done = safeC >= safeT && safeT > 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="font-bold">
          <span className="text-white">{formatter(safeC)}</span>
          <span className="text-slate-600"> → </span>
          <span style={{ color }}>{formatter(safeT)}</span>
        </span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: done
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : `linear-gradient(90deg, ${color}aa, ${color})`,
            boxShadow: done ? '0 0 8px rgba(16,185,129,0.4)' : `0 0 6px ${color}40`,
          }}
        />
      </div>
      {done && (
        <p className="text-xs text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Target reached
        </p>
      )}
    </div>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDailyBriefing(
  player: Player | null,
  districts: District[],
  playerDistricts: Map<string, PlayerDistrict>,
  dynamicQuests: DynamicQuest[],
  npcs: NPC[],
  npcRelationships: Map<string, PlayerNPCRelationship>,
  recentMatches: ComputedMatch[],
  reputation: PlayerReputation | null,
): DailyBriefingData | null {
  return useMemo(() => {
    if (!player) return null;
    return generateDailyBriefing(
      player, districts, playerDistricts,
      dynamicQuests, npcs, npcRelationships,
      recentMatches, reputation,
    );
  }, [
    player?.id, player?.level, player?.current_xp, player?.empire_value,
    player?.monthly_income, playerDistricts.size, dynamicQuests.length,
    districts.length, npcs.length, npcRelationships.size,
    recentMatches.length, reputation,
  ]);
}
