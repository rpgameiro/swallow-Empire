import { useState, useEffect, useRef } from 'react';
import {
  BarChart2, Home, TrendingUp, Settings2,
  Lock, CheckCircle2, ChevronRight, Star,
  UserPlus, Users, Building, Landmark, Globe,
  DoorOpen, Unlock, Briefcase, Crown,
  Newspaper, Mic, Award, ScrollText, Trophy,
  Hotel, Handshake, Gem, Key, MapPin, Zap,
} from 'lucide-react';
import {
  PlayerReputation, RepTrack, REP_RANKS, REP_UNLOCKS, REP_TRACK_META,
  getRepRank, getNextRepRank, RepRank, RepUnlock, RepUnlockCategory,
} from '../types/game';

// ─── Icon maps ────────────────────────────────────────────────────────────────

const UNLOCK_ICON_MAP: Record<string, React.ElementType> = {
  'user-plus': UserPlus, users: Users, building: Building, landmark: Landmark,
  globe: Globe, 'door-open': DoorOpen, 'lock-open': Unlock, briefcase: Briefcase,
  star: Star, crown: Crown, newspaper: Newspaper, mic: Mic, award: Award,
  scroll: ScrollText, trophy: Trophy, hotel: Hotel, 'trending-up': TrendingUp,
  handshake: Handshake, gem: Gem, key: Key,
};

const TRACK_ICON_MAP: Record<RepTrack, React.ElementType> = {
  investor: BarChart2, owner: Home, market: TrendingUp,
  operator: Settings2, broker: Briefcase, luxury: Gem,
};

const TRACK_ORDER: RepTrack[] = ['investor', 'owner', 'market', 'operator', 'broker', 'luxury'];

const CATEGORY_META: Record<RepUnlockCategory, { label: string; color: string; glow: string }> = {
  private_opportunity: { label: 'Private Opportunity', color: '#f97316', glow: 'rgba(249,115,22,0.3)' },
  legendary_investor:  { label: 'Legendary Investor',  color: '#ef4444', glow: 'rgba(239,68,68,0.3)' },
  off_market_portfolio:{ label: 'Off-Market Portfolio', color: '#10b981', glow: 'rgba(16,185,129,0.3)' },
  hidden_district:     { label: 'Hidden District',     color: '#a78bfa', glow: 'rgba(167,139,250,0.3)' },
  deal:                { label: 'Deal',                color: '#10b981', glow: 'rgba(16,185,129,0.2)' },
  investor:            { label: 'Investor',            color: '#3b82f6', glow: 'rgba(59,130,246,0.2)' },
  listing:             { label: 'Listing',             color: '#f59e0b', glow: 'rgba(245,158,11,0.2)' },
  mission:             { label: 'Mission',             color: '#ef4444', glow: 'rgba(239,68,68,0.2)' },
};

const TIER_META = {
  rare:      { label: 'RARE',      color: '#3b82f6', glow: 'rgba(59,130,246,0.4)' },
  epic:      { label: 'EPIC',      color: '#f97316', glow: 'rgba(249,115,22,0.4)' },
  legendary: { label: 'LEGENDARY', color: '#ef4444', glow: 'rgba(239,68,68,0.5)' },
};

// ─── Animated score ───────────────────────────────────────────────────────────

function AnimatedScore({ value, color }: { value: number; color: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const diff = value - prev.current;
    const steps = 20;
    const step = diff / steps;
    let cur = prev.current;
    let i = 0;
    const id = setInterval(() => {
      i++;
      cur += step;
      setDisplay(Math.round(cur));
      if (i >= steps) { setDisplay(value); prev.current = value; clearInterval(id); }
    }, 20);
    return () => clearInterval(id);
  }, [value]);
  return <span style={{ color }}>{display}</span>;
}

// ─── Rank badge ───────────────────────────────────────────────────────────────

export function RepRankBadge({ rank, size = 'md' }: { rank: RepRank; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-xs px-1.5 py-0.5', md: 'text-xs px-2.5 py-1', lg: 'text-sm px-3 py-1.5' };
  return (
    <span
      className={`inline-flex items-center font-black rounded-lg border ${sizes[size]}`}
      style={{
        color: rank.color, borderColor: rank.color + '50',
        backgroundColor: rank.color + '15', boxShadow: `0 0 8px ${rank.glowColor}`,
      }}
    >
      {rank.badge}
    </span>
  );
}

// ─── Unlock preview card ──────────────────────────────────────────────────────

function UnlockPreviewCard({ unlock, isUnlocked }: { unlock: RepUnlock; isUnlocked: boolean }) {
  if (!unlock.previewTitle) return null;
  const tier = unlock.previewTier ? TIER_META[unlock.previewTier] : TIER_META.rare;
  const catMeta = CATEGORY_META[unlock.unlockType];
  const isHiddenDistrict = unlock.unlockType === 'hidden_district';
  const isLegendaryInvestor = unlock.unlockType === 'legendary_investor';

  return (
    <div
      className="rounded-xl border overflow-hidden mt-2"
      style={{
        borderColor: isUnlocked ? tier.color + '40' : '#1e293b',
        background: isUnlocked
          ? `linear-gradient(135deg, ${tier.color}10, rgba(2,6,23,0.95))`
          : 'rgba(2,6,23,0.6)',
        boxShadow: isUnlocked ? `0 0 18px ${tier.glow}` : 'none',
        opacity: isUnlocked ? 1 : 0.4,
        filter: isUnlocked ? 'none' : 'blur(0.5px)',
      }}
    >
      {/* Tier accent */}
      <div
        className="h-px w-full"
        style={{ background: isUnlocked ? `linear-gradient(90deg, transparent, ${tier.color}, transparent)` : '#1e293b' }}
      />

      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: isUnlocked ? catMeta.color + '18' : '#0f172a',
              border: `1px solid ${isUnlocked ? catMeta.color + '40' : '#1e293b'}`,
            }}
          >
            {isHiddenDistrict
              ? <MapPin className="w-4 h-4" style={{ color: isUnlocked ? catMeta.color : '#1e293b' }} />
              : isLegendaryInvestor
                ? <Crown className="w-4 h-4" style={{ color: isUnlocked ? catMeta.color : '#1e293b' }} />
                : <Gem className="w-4 h-4" style={{ color: isUnlocked ? catMeta.color : '#1e293b' }} />
            }
          </div>

          <div className="flex-1 min-w-0">
            {/* Category + tier badges */}
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span
                className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                style={{
                  color: isUnlocked ? catMeta.color : '#334155',
                  backgroundColor: isUnlocked ? catMeta.color + '18' : 'transparent',
                }}
              >
                {catMeta.label}
              </span>
              {unlock.previewTier && (
                <span
                  className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border"
                  style={{
                    color: isUnlocked ? tier.color : '#1e293b',
                    borderColor: isUnlocked ? tier.color + '50' : '#1e293b',
                    backgroundColor: isUnlocked ? tier.color + '12' : 'transparent',
                  }}
                >
                  {tier.label}
                </span>
              )}
            </div>

            <p
              className="text-xs font-bold leading-snug mb-0.5"
              style={{ color: isUnlocked ? '#e2e8f0' : '#1e293b' }}
            >
              {isUnlocked ? unlock.previewTitle : '??? Classified'}
            </p>
            <p
              className="text-[11px] leading-relaxed"
              style={{ color: isUnlocked ? '#475569' : '#0f172a' }}
            >
              {isUnlocked ? unlock.previewBody : 'Increase your reputation to reveal this opportunity.'}
            </p>

            {/* Value tag */}
            {isUnlocked && unlock.previewValue && (
              <div
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded"
                style={{
                  color: tier.color,
                  backgroundColor: tier.color + '15',
                  border: `1px solid ${tier.color}30`,
                }}
              >
                {isHiddenDistrict ? <MapPin className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
                {unlock.previewValue}
              </div>
            )}
          </div>

          {/* Lock/unlock indicator */}
          <div className="flex-shrink-0">
            {isUnlocked
              ? <CheckCircle2 className="w-4 h-4" style={{ color: tier.color + '80' }} />
              : <Lock className="w-3.5 h-3.5 text-slate-800" />
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rank ladder ──────────────────────────────────────────────────────────────

function RankLadder({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      {REP_RANKS.map((r, i) => {
        const reached = score >= r.minScore;
        return (
          <div key={i} className="flex items-center gap-1">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-all duration-500"
              title={`${r.label} (${r.minScore}+)`}
              style={reached ? {
                backgroundColor: r.color + '25', border: `1px solid ${r.color}60`,
                color: r.color, boxShadow: `0 0 6px ${r.glowColor}`,
              } : {
                backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#1e293b',
              }}
            >
              {r.rank}
            </div>
            {i < REP_RANKS.length - 1 && (
              <div className="w-3 h-px" style={{ backgroundColor: reached && score >= REP_RANKS[i + 1].minScore ? color + '60' : '#1e293b' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Track card ───────────────────────────────────────────────────────────────

function TrackCard({
  track, score, meta, expanded, onToggle,
}: {
  track: RepTrack;
  score: number;
  meta: typeof REP_TRACK_META[RepTrack];
  expanded: boolean;
  onToggle: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

  const rank     = getRepRank(score);
  const nextRank = getNextRepRank(score);
  const progress = nextRank
    ? Math.round(((score - rank.minScore) / (nextRank.minScore - rank.minScore)) * 100)
    : 100;

  const unlocks = REP_UNLOCKS.filter(u => u.track === track);
  const unlockedCount = unlocks.filter(u => score >= u.minScore).length;
  const specialUnlocks = unlocks.filter(u =>
    ['private_opportunity', 'legendary_investor', 'off_market_portfolio', 'hidden_district'].includes(u.unlockType)
  );
  const specialUnlockedCount = specialUnlocks.filter(u => score >= u.minScore).length;
  const TrackIcon = TRACK_ICON_MAP[track];

  // Next special unlock teaser
  const nextSpecial = specialUnlocks.find(u => score < u.minScore);

  return (
    <div
      className="rounded-2xl border-2 overflow-hidden transition-all duration-300"
      style={{
        borderColor: expanded ? meta.color + '55' : meta.color + '20',
        background: expanded
          ? `linear-gradient(135deg, ${meta.color}10 0%, rgba(2,6,23,0.97) 100%)`
          : 'rgba(15,23,42,0.6)',
        boxShadow: expanded ? `0 0 30px ${meta.color}18` : 'none',
      }}
    >
      {/* Top accent */}
      <div
        className="h-0.5 w-full transition-all duration-500"
        style={{ background: `linear-gradient(90deg, transparent, ${meta.color}${expanded ? 'cc' : '40'}, transparent)` }}
      />

      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 relative"
          style={{ backgroundColor: meta.color + '18', border: `1px solid ${meta.color}30` }}
        >
          <TrackIcon className="w-5 h-5" style={{ color: meta.color }} />
          {/* Special unlock indicator */}
          {specialUnlockedCount > 0 && (
            <div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
              style={{ backgroundColor: meta.color, color: '#0f172a' }}
            >
              {specialUnlockedCount}
            </div>
          )}
        </div>

        {/* Title + rank */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-white font-black text-sm">{meta.label}</span>
            <RepRankBadge rank={rank} size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-600 truncate">{rank.description}</p>
            {unlockedCount > 0 && (
              <span className="text-[10px] font-bold text-slate-700 flex-shrink-0">{unlockedCount}/{unlocks.length} unlocked</span>
            )}
          </div>
        </div>

        {/* Score + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-xl font-black leading-none">
              <AnimatedScore value={score} color={meta.color} />
            </p>
            {nextRank && <p className="text-xs text-slate-700 mt-0.5">→ {nextRank.minScore}</p>}
          </div>
          <ChevronRight
            className="w-4 h-4 text-slate-600 transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          />
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
            style={{
              width: mounted ? `${Math.min(progress, 100)}%` : '0%',
              backgroundColor: meta.color,
              boxShadow: `0 0 8px ${meta.color}60`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          {nextRank ? (
            <p className="text-xs text-slate-700">
              <span style={{ color: meta.color + 'aa' }}>{score - rank.minScore}</span>
              <span className="text-slate-700"> / {nextRank.minScore - rank.minScore} to </span>
              <span style={{ color: nextRank.color }}>{nextRank.label}</span>
            </p>
          ) : (
            <p className="text-xs" style={{ color: meta.color + '80' }}>Max rank reached</p>
          )}
          {/* Next special teaser */}
          {nextSpecial && !expanded && (
            <p className="text-[10px] text-slate-700 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              <span style={{ color: meta.color + '70' }}>{nextSpecial.minScore} pts</span>
              <span>: {nextSpecial.label}</span>
            </p>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-5 space-y-4 border-t border-slate-800/40 pt-4">

          {/* Special unlocks (preview cards) */}
          {specialUnlocks.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-1.5">
                <Gem className="w-3 h-3" />
                Exclusive Access
              </p>
              <div className="space-y-2">
                {specialUnlocks.map((u, i) => (
                  <UnlockPreviewCard key={i} unlock={u} isUnlocked={score >= u.minScore} />
                ))}
              </div>
            </div>
          )}

          {/* Standard unlocks */}
          {(() => {
            const standard = unlocks.filter(u =>
              !['private_opportunity', 'legendary_investor', 'off_market_portfolio', 'hidden_district'].includes(u.unlockType)
            );
            if (!standard.length) return null;
            return (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-1.5">
                  <Star className="w-3 h-3" />
                  Standard Unlocks
                </p>
                <div className="space-y-2">
                  {standard.map((unlock, i) => {
                    const isUnlocked = score >= unlock.minScore;
                    const UnlockIcon = UNLOCK_ICON_MAP[unlock.icon] ?? CheckCircle2;
                    const catMeta = CATEGORY_META[unlock.unlockType];
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl p-2.5 border transition-all duration-300"
                        style={isUnlocked ? {
                          backgroundColor: meta.color + '0d', borderColor: meta.color + '30',
                        } : {
                          backgroundColor: 'rgba(15,23,42,0.4)', borderColor: '#1e293b',
                        }}
                      >
                        <div className="w-8 flex-shrink-0 text-center">
                          <span className="text-xs font-black" style={{ color: isUnlocked ? meta.color : '#334155' }}>
                            {unlock.minScore}
                          </span>
                        </div>
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={isUnlocked ? {
                            backgroundColor: meta.color + '20', border: `1px solid ${meta.color}40`,
                          } : {
                            backgroundColor: '#0f172a', border: '1px solid #1e293b',
                          }}
                        >
                          {isUnlocked
                            ? <UnlockIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                            : <Lock className="w-3 h-3 text-slate-700" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold" style={{ color: isUnlocked ? '#e2e8f0' : '#334155' }}>
                              {unlock.label}
                            </span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                              style={{ color: isUnlocked ? catMeta.color : '#334155', backgroundColor: isUnlocked ? catMeta.color + '18' : 'transparent' }}
                            >
                              {catMeta.label}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed" style={{ color: isUnlocked ? '#64748b' : '#1e293b' }}>
                            {unlock.description}
                          </p>
                        </div>
                        {isUnlocked && <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: meta.color + '80' }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Hidden districts tease row ───────────────────────────────────────────────

function HiddenDistrictsRow({ scores }: { scores: Record<RepTrack, number> }) {
  const hiddenUnlocks = REP_UNLOCKS.filter(u => u.unlockType === 'hidden_district');
  const unlockedHidden = hiddenUnlocks.filter(u => scores[u.track] >= u.minScore);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#a78bfa30', background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(2,6,23,0.95))' }}
    >
      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, #a78bfa60, transparent)' }} />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4" style={{ color: '#a78bfa' }} />
          <span className="text-sm font-black text-white">Hidden Districts</span>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#a78bfa20', color: '#a78bfa', border: '1px solid #a78bfa40' }}
          >
            {unlockedHidden.length} / {hiddenUnlocks.length} discovered
          </span>
        </div>

        {unlockedHidden.length === 0 && (
          <p className="text-xs text-slate-600 mb-3">
            Raise your reputation across any track to discover hidden investment territories invisible to other advisors.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {hiddenUnlocks.map((u, i) => {
            const isUnlocked = scores[u.track] >= u.minScore;
            const trackMeta = REP_TRACK_META[u.track];
            return (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-xl border p-3 transition-all"
                style={isUnlocked ? {
                  borderColor: '#a78bfa40',
                  backgroundColor: '#a78bfa0a',
                  boxShadow: '0 0 12px rgba(167,139,250,0.15)',
                } : {
                  borderColor: '#1e293b',
                  backgroundColor: 'rgba(2,6,23,0.6)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={isUnlocked ? {
                    backgroundColor: '#a78bfa20', border: '1px solid #a78bfa40',
                  } : {
                    backgroundColor: '#0f172a', border: '1px solid #1e293b',
                  }}
                >
                  {isUnlocked
                    ? <MapPin className="w-4 h-4" style={{ color: '#a78bfa' }} />
                    : <Lock className="w-3.5 h-3.5 text-slate-800" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold" style={{ color: isUnlocked ? '#e2e8f0' : '#334155' }}>
                    {isUnlocked ? u.previewTitle ?? u.label : '??? Undiscovered Territory'}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: isUnlocked ? '#475569' : '#1e293b' }}>
                    {isUnlocked
                      ? u.previewBody ?? u.description
                      : `Requires ${u.minScore} ${trackMeta.label}`
                    }
                  </p>
                  {!isUnlocked && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: trackMeta.color }} />
                      <span className="text-[10px]" style={{ color: trackMeta.color + '90' }}>
                        {trackMeta.label}: {scores[u.track]} / {u.minScore}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Legendary investors spotlight ────────────────────────────────────────────

function LegendaryInvestorsRow({ scores }: { scores: Record<RepTrack, number> }) {
  const investorUnlocks = REP_UNLOCKS.filter(u => u.unlockType === 'legendary_investor');
  const unlocked = investorUnlocks.filter(u => scores[u.track] >= u.minScore);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: '#ef444330', background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(2,6,23,0.95))' }}
    >
      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, #ef444460, transparent)' }} />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Crown className="w-4 h-4 text-red-400" />
          <span className="text-sm font-black text-white">Legendary Investors</span>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
          >
            {unlocked.length} / {investorUnlocks.length} unlocked
          </span>
        </div>

        {unlocked.length === 0 && (
          <p className="text-xs text-slate-600 mb-3">
            Elite relationships with the most powerful figures in Portuguese hospitality. Unlocked through sustained reputation building.
          </p>
        )}

        <div className="space-y-2">
          {investorUnlocks.map((u, i) => {
            const isUnlocked = scores[u.track] >= u.minScore;
            const trackMeta = REP_TRACK_META[u.track];
            const tierMeta = u.previewTier ? TIER_META[u.previewTier] : TIER_META.epic;
            // Generate avatar initials from previewTitle
            const initials = u.previewTitle
              ? u.previewTitle.split(/[\s—]/).filter(w => /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join('')
              : 'L';

            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border p-3 transition-all"
                style={isUnlocked ? {
                  borderColor: tierMeta.color + '35',
                  background: `linear-gradient(135deg, ${tierMeta.color}0a, rgba(2,6,23,0.9))`,
                  boxShadow: `0 0 14px ${tierMeta.glow}`,
                } : {
                  borderColor: '#1e293b',
                  backgroundColor: 'rgba(2,6,23,0.6)',
                }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm"
                  style={isUnlocked ? {
                    background: `radial-gradient(circle, ${tierMeta.color}30, ${tierMeta.color}10)`,
                    border: `1.5px solid ${tierMeta.color}50`,
                    color: tierMeta.color,
                  } : {
                    backgroundColor: '#0f172a', border: '1.5px solid #1e293b', color: '#334155',
                  }}
                >
                  {isUnlocked ? initials : <Lock className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-bold" style={{ color: isUnlocked ? '#e2e8f0' : '#334155' }}>
                      {isUnlocked ? (u.previewTitle ?? u.label) : '??? Locked Contact'}
                    </span>
                    {isUnlocked && u.previewTier && (
                      <span
                        className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded border"
                        style={{ color: tierMeta.color, borderColor: tierMeta.color + '50', backgroundColor: tierMeta.color + '12' }}
                      >
                        {tierMeta.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px]" style={{ color: isUnlocked ? '#475569' : '#1e293b' }}>
                    {isUnlocked
                      ? (u.previewBody ?? u.description)
                      : `Requires ${u.minScore} ${trackMeta.label}`
                    }
                  </p>
                  {isUnlocked && u.previewValue && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-black mt-1 px-1.5 py-0.5 rounded"
                      style={{ color: tierMeta.color, backgroundColor: tierMeta.color + '15' }}
                    >
                      <Zap className="w-2.5 h-2.5" />
                      {u.previewValue}
                    </span>
                  )}
                </div>

                {!isUnlocked && (
                  <div className="flex-shrink-0 text-right">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mb-1 ml-auto" style={{ backgroundColor: trackMeta.color }} />
                    <p className="text-[10px]" style={{ color: trackMeta.color + '90' }}>
                      {scores[u.track]} / {u.minScore}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export const ReputationPanel = ({ reputation }: { reputation: PlayerReputation | null }) => {
  const [expandedTrack, setExpandedTrack] = useState<RepTrack | null>('investor');
  const [activeSection, setActiveSection] = useState<'tracks' | 'hidden' | 'investors'>('tracks');

  const scores: Record<RepTrack, number> = {
    investor: reputation?.investor_rep ?? 0,
    owner:    reputation?.owner_rep    ?? 0,
    market:   reputation?.market_rep   ?? 0,
    operator: reputation?.operator_rep ?? 0,
    broker:   reputation?.broker_rep   ?? 0,
    luxury:   reputation?.luxury_rep   ?? 0,
  };

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const avgScore = Math.floor(totalScore / 6);
  const overallRank = getRepRank(avgScore);

  // Counts for section badges
  const hiddenCount = REP_UNLOCKS.filter(u => u.unlockType === 'hidden_district' && scores[u.track] >= u.minScore).length;
  const legendaryCount = REP_UNLOCKS.filter(u => u.unlockType === 'legendary_investor' && scores[u.track] >= u.minScore).length;

  const SECTIONS = [
    { key: 'tracks' as const,    label: 'Reputation',    badge: null },
    { key: 'hidden' as const,    label: 'Hidden Districts', badge: hiddenCount || null },
    { key: 'investors' as const, label: 'Legendary Contacts', badge: legendaryCount || null },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              Reputation
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Six pillars of influence across the Portuguese hotel investment market.
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-slate-600 uppercase tracking-widest mb-1">Overall</p>
            <RepRankBadge rank={overallRank} size="lg" />
          </div>
        </div>
      </div>

      {/* Overall summary */}
      <div
        className="rounded-2xl border p-4 animate-slide-up"
        style={{
          animationDelay: '0.05s',
          background: `linear-gradient(135deg, ${overallRank.color}10 0%, rgba(2,6,23,0.97) 100%)`,
          borderColor: overallRank.color + '30',
          boxShadow: `0 0 24px ${overallRank.glowColor}`,
        }}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">Overall Rank</p>
            <p className="text-xl font-black" style={{ color: overallRank.color }}>{overallRank.label}</p>
            <p className="text-xs text-slate-600 mt-0.5">{overallRank.description}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-600 mb-1">Total Score</p>
            <p className="text-3xl font-black" style={{ color: overallRank.color }}>
              <AnimatedScore value={totalScore} color={overallRank.color} />
            </p>
          </div>
        </div>

        {/* Track mini grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
          {TRACK_ORDER.map(track => {
            const meta = REP_TRACK_META[track];
            const s = scores[track];
            const r = getRepRank(s);
            const TrackIcon = TRACK_ICON_MAP[track];
            return (
              <button
                key={track}
                onClick={() => { setActiveSection('tracks'); setExpandedTrack(track); }}
                className="flex flex-col items-center gap-1 rounded-xl border p-2 transition-all hover:brightness-110 active:scale-95"
                style={{ borderColor: meta.color + '25', backgroundColor: meta.color + '08' }}
              >
                <TrackIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                <span className="font-black text-xs" style={{ color: meta.color }}>{s}</span>
                <span className="text-[9px] uppercase tracking-wide" style={{ color: r.color }}>{r.badge}</span>
              </button>
            );
          })}
        </div>

        <RankLadder score={avgScore} color={overallRank.color} />
      </div>

      {/* Section tabs */}
      <div className="animate-slide-up flex gap-1 rounded-xl bg-slate-900/60 border border-slate-800/60 p-1" style={{ animationDelay: '0.08s' }}>
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className="relative flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all"
            style={{
              color: activeSection === s.key ? '#fff' : '#475569',
              background: activeSection === s.key
                ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.1))'
                : 'transparent',
              border: activeSection === s.key ? '1px solid rgba(245,158,11,0.25)' : '1px solid transparent',
            }}
          >
            {s.label}
            {s.badge != null && s.badge > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black"
                style={{ backgroundColor: '#f59e0b', color: '#0f172a' }}
              >
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Section content */}
      {activeSection === 'tracks' && (
        <div className="space-y-3">
          {TRACK_ORDER.map((track, i) => (
            <div key={track} className="animate-slide-up" style={{ animationDelay: `${0.05 + i * 0.04}s` }}>
              <TrackCard
                track={track}
                score={scores[track]}
                meta={REP_TRACK_META[track]}
                expanded={expandedTrack === track}
                onToggle={() => setExpandedTrack(prev => prev === track ? null : track)}
              />
            </div>
          ))}
        </div>
      )}

      {activeSection === 'hidden' && (
        <div className="animate-slide-up">
          <HiddenDistrictsRow scores={scores} />
        </div>
      )}

      {activeSection === 'investors' && (
        <div className="animate-slide-up">
          <LegendaryInvestorsRow scores={scores} />
        </div>
      )}

      {/* Rank reference (always shown) */}
      <div
        className="animate-slide-up rounded-2xl border border-slate-800/40 bg-slate-950/40 p-4"
        style={{ animationDelay: '0.3s' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-3">Rank Reference</p>
        <div className="grid grid-cols-2 gap-1.5">
          {REP_RANKS.map(r => (
            <div key={r.rank} className="flex items-center gap-2">
              <RepRankBadge rank={r} size="sm" />
              <span className="text-xs font-bold" style={{ color: r.color }}>{r.label}</span>
              <span className="text-[10px] text-slate-700 ml-auto">{r.minScore}+</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
