import { useState } from 'react';
import {
  Building2, Users, Megaphone, Landmark, CheckCircle2,
  Lock, TrendingUp, Star, Zap, DollarSign, ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { OfficeUpgrade } from '../types/game';

interface OfficePanelProps {
  upgrades: OfficeUpgrade[];
  purchasedSlugs: Set<string>;
  playerMoney: number;
  playerLevel: number;
  incomeMultiplier: number;
  onPurchase: (slug: string) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  building2:  Building2,
  users:      Users,
  megaphone:  Megaphone,
  landmark:   Landmark,
};

const TIER_COLORS: Record<number, { border: string; glow: string; badge: string; bg: string }> = {
  1: { border: '#334155', glow: 'rgba(51,65,85,0)',       badge: '#64748b', bg: 'rgba(15,23,42,0.6)' },
  2: { border: '#1d4ed8', glow: 'rgba(59,130,246,0.15)',  badge: '#3b82f6', bg: 'rgba(30,58,138,0.15)' },
  3: { border: '#047857', glow: 'rgba(16,185,129,0.15)',  badge: '#10b981', bg: 'rgba(6,78,59,0.2)' },
  4: { border: '#b45309', glow: 'rgba(245,158,11,0.2)',   badge: '#f59e0b', bg: 'rgba(120,53,15,0.2)' },
};

const TIER_LABELS: Record<number, string> = {
  1: 'Foundation',
  2: 'Growth',
  3: 'Scale',
  4: 'Empire',
};

// Only show the 4 main chain upgrades
const CHAIN_SLUGS = ['small_office', 'meeting_room', 'marketing_team', 'investment_division'];

function PurchaseFlash({ color }: { color: string }) {
  return (
    <div
      className="absolute inset-0 rounded-2xl pointer-events-none"
      style={{
        background: `radial-gradient(circle at center, ${color}40 0%, transparent 70%)`,
        animation: 'purchaseFlash 0.8s ease-out both',
      }}
    />
  );
}

function UpgradeCard({
  upgrade,
  isPurchased,
  isUnlocked,
  isNext,
  playerMoney,
  playerLevel,
  onPurchase,
}: {
  upgrade: OfficeUpgrade;
  isPurchased: boolean;
  isUnlocked: boolean;
  isNext: boolean;
  playerMoney: number;
  playerLevel: number;
  onPurchase: () => void;
}) {
  const [flashing, setFlashing] = useState(false);
  const [justPurchased, setJustPurchased] = useState(false);
  const [hovered, setHovered] = useState(false);

  const tc = TIER_COLORS[upgrade.tier] ?? TIER_COLORS[1];
  const Icon = ICON_MAP[upgrade.icon] ?? Building2;

  const canAfford = playerMoney >= upgrade.cost;
  const meetsLevel = playerLevel >= upgrade.required_level;
  const canBuy = isUnlocked && !isPurchased && canAfford && meetsLevel;
  const isLocked = !isUnlocked || !meetsLevel;

  const handlePurchase = () => {
    if (!canBuy) return;
    setFlashing(true);
    onPurchase();
    setTimeout(() => {
      setFlashing(false);
      setJustPurchased(true);
    }, 500);
  };

  return (
    <div
      className="relative rounded-2xl border-2 transition-all duration-300 overflow-hidden"
      style={{
        borderColor: isPurchased || justPurchased
          ? tc.border
          : isNext && hovered
          ? tc.border
          : isLocked
          ? '#1e293b'
          : '#1e293b',
        background: isPurchased || justPurchased
          ? tc.bg
          : isLocked
          ? 'rgba(2,6,23,0.6)'
          : 'rgba(15,23,42,0.7)',
        boxShadow: isPurchased || justPurchased
          ? `0 0 20px ${tc.glow}, 0 4px 24px rgba(0,0,0,0.4)`
          : isNext && hovered
          ? `0 0 16px ${tc.glow}`
          : 'none',
        transform: isNext && hovered ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {flashing && <PurchaseFlash color={tc.badge} />}

      {/* Top accent bar */}
      <div
        className="h-0.5 w-full transition-all duration-300"
        style={{
          background: isPurchased || justPurchased
            ? `linear-gradient(90deg, transparent, ${tc.badge}, transparent)`
            : isNext
            ? `linear-gradient(90deg, transparent, ${tc.badge}60, transparent)`
            : 'transparent',
        }}
      />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
            style={{
              backgroundColor: isPurchased || justPurchased ? tc.badge + '25' : '#0f172a',
              border: `1px solid ${isPurchased || justPurchased ? tc.badge + '50' : '#1e293b'}`,
              boxShadow: isPurchased || justPurchased ? `0 0 12px ${tc.glow}` : 'none',
            }}
          >
            <Icon
              className="w-6 h-6 transition-colors duration-300"
              style={{ color: isPurchased || justPurchased ? tc.badge : isLocked ? '#334155' : '#64748b' }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: tc.badge + '99' }}
                >
                  {TIER_LABELS[upgrade.tier]}
                </span>
                <h3
                  className="font-black text-base leading-tight mt-0.5"
                  style={{ color: isLocked ? '#334155' : isPurchased ? '#f1f5f9' : '#e2e8f0' }}
                >
                  {upgrade.name}
                </h3>
              </div>

              {/* Status badge */}
              {isPurchased || justPurchased ? (
                <div className="flex items-center gap-1 text-xs font-bold flex-shrink-0" style={{ color: tc.badge }}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Owned</span>
                </div>
              ) : isLocked ? (
                <div className="flex items-center gap-1 text-xs text-slate-700 flex-shrink-0">
                  <Lock className="w-3.5 h-3.5" />
                </div>
              ) : null}
            </div>

            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              {upgrade.description}
            </p>

            {/* Bonus pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {upgrade.reputation_bonus > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-yellow-950/30 border border-yellow-800/30 text-yellow-400">
                  <Star className="w-3 h-3" />
                  +{upgrade.reputation_bonus} REP
                </span>
              )}
              {upgrade.income_multiplier_bonus > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-950/30 border border-emerald-800/30 text-emerald-400">
                  <TrendingUp className="w-3 h-3" />
                  +{Math.round(upgrade.income_multiplier_bonus * 100)}% income
                </span>
              )}
              {upgrade.monthly_revenue_bonus > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-950/30 border border-blue-800/30 text-blue-400">
                  <DollarSign className="w-3 h-3" />
                  +€{(upgrade.monthly_revenue_bonus / 1000).toFixed(0)}k/mo
                </span>
              )}
              {upgrade.xp_bonus_pct > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-950/30 border border-amber-800/30 text-amber-400">
                  <Zap className="w-3 h-3" />
                  +{upgrade.xp_bonus_pct}% XP
                </span>
              )}
            </div>

            {/* Action row */}
            {isPurchased || justPurchased ? (
              <div
                className="flex items-center gap-2 text-sm font-bold py-2.5 px-4 rounded-xl border"
                style={{ color: tc.badge, borderColor: tc.badge + '30', backgroundColor: tc.badge + '10' }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Active — boosting your advisory firm
              </div>
            ) : isLocked ? (
              <div className="flex items-center gap-3 text-sm py-2.5 px-4 rounded-xl bg-slate-900/40 border border-slate-800/40">
                <Lock className="w-4 h-4 text-slate-700" />
                <div className="text-slate-700">
                  {!meetsLevel && `Requires Level ${upgrade.required_level}`}
                  {!isUnlocked && meetsLevel && upgrade.required_slug && (
                    <>Purchase <span className="font-bold">{upgrade.required_slug.replace(/_/g, ' ')}</span> first</>
                  )}
                </div>
                {!meetsLevel && (
                  <div className="ml-auto flex-shrink-0 w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-800"
                      style={{ width: `${Math.min((playerLevel / upgrade.required_level) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handlePurchase}
                disabled={!canBuy}
                className="w-full flex items-center justify-between gap-3 py-3 px-4 rounded-xl font-bold text-sm transition-all active:scale-98 group"
                style={canBuy ? {
                  background: `linear-gradient(135deg, ${tc.badge}22, ${tc.badge}11)`,
                  border: `1px solid ${tc.badge}50`,
                  color: tc.badge,
                  boxShadow: `0 2px 12px ${tc.glow}`,
                } : {
                  background: 'rgba(15,23,42,0.5)',
                  border: '1px solid #1e293b',
                  color: '#475569',
                  cursor: 'not-allowed',
                }}
              >
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  {upgrade.cost === 0 ? 'Free — Start Here' : `€${upgrade.cost.toLocaleString()}`}
                </span>
                <span className="flex items-center gap-1">
                  {canAfford || upgrade.cost === 0
                    ? <><span>Purchase</span><ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                    : <span className="text-xs text-red-500 font-normal">Insufficient funds</span>}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const OfficePanel = ({
  upgrades,
  purchasedSlugs,
  playerMoney,
  playerLevel,
  incomeMultiplier: _incomeMultiplier,
  onPurchase,
}: OfficePanelProps) => {
  const [_justPurchasedSlug, setJustPurchasedSlug] = useState<string | null>(null);

  // Only display the 4-upgrade chain
  const chainUpgrades = CHAIN_SLUGS
    .map(slug => upgrades.find(u => u.slug === slug))
    .filter(Boolean) as OfficeUpgrade[];

  const ownedCount = chainUpgrades.filter(u => purchasedSlugs.has(u.slug)).length;
  const totalMultiplier = chainUpgrades
    .filter(u => purchasedSlugs.has(u.slug))
    .reduce((acc, u) => acc + u.income_multiplier_bonus, 0);

  const handlePurchase = (slug: string) => {
    setJustPurchasedSlug(slug);
    onPurchase(slug);
    setTimeout(() => setJustPurchasedSlug(null), 1000);
  };

  // Find the next upgrade in chain
  const nextUpgradeSlug = chainUpgrades.find(u => !purchasedSlugs.has(u.slug))?.slug ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 animate-slide-up">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            Office Upgrades
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Invest in infrastructure to amplify your advisory empire.
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-slate-600 uppercase tracking-widest">Owned</p>
          <p className="text-2xl font-black text-amber-400">{ownedCount}<span className="text-slate-700 text-base font-normal">/{chainUpgrades.length}</span></p>
        </div>
      </div>

      {/* Summary stats */}
      {ownedCount > 0 && (
        <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Income Multiplier</p>
              <p className="text-emerald-400 font-black text-lg leading-none">×{(1 + totalMultiplier).toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-yellow-950/20 border border-yellow-800/30 rounded-xl p-3 flex items-center gap-3">
            <Star className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Rep Bonus</p>
              <p className="text-yellow-400 font-black text-lg leading-none">
                +{chainUpgrades.filter(u => purchasedSlugs.has(u.slug)).reduce((s, u) => s + u.reputation_bonus, 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chain connector */}
      <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {chainUpgrades.map((upgrade, i) => {
          const isPurchased = purchasedSlugs.has(upgrade.slug);
          const isUnlocked = upgrade.required_slug === null || purchasedSlugs.has(upgrade.required_slug);
          const isNext = upgrade.slug === nextUpgradeSlug;

          return (
            <div key={upgrade.id}>
              <UpgradeCard
                upgrade={upgrade}
                isPurchased={isPurchased}
                isUnlocked={isUnlocked}
                isNext={isNext}
                playerMoney={playerMoney}
                playerLevel={playerLevel}
                onPurchase={() => handlePurchase(upgrade.slug)}
              />
              {/* Connector arrow between cards */}
              {i < chainUpgrades.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowRight
                    className="w-4 h-4 rotate-90 transition-colors duration-300"
                    style={{ color: isPurchased ? (TIER_COLORS[upgrade.tier]?.badge ?? '#475569') + '60' : '#1e293b' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All owned */}
      {ownedCount === chainUpgrades.length && (
        <div className="text-center py-6 animate-scale-in">
          <div className="inline-flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-amber-900/20 border border-amber-600/30 flex items-center justify-center">
              <Landmark className="w-7 h-7 text-amber-400" />
            </div>
            <p className="text-amber-400 font-black text-lg text-glow-amber">Full Empire Infrastructure</p>
            <p className="text-slate-500 text-sm">Your advisory firm is operating at maximum capacity.</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Inject keyframe once
const style = document.createElement('style');
style.textContent = `
  @keyframes purchaseFlash {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }
`;
if (!document.head.querySelector('[data-office-styles]')) {
  style.setAttribute('data-office-styles', '');
  document.head.appendChild(style);
}
