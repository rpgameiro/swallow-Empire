import { District, PlayerDistrict, DistrictMarketData, DistrictEvent, getTerritoryStatus, xpForTerritoryLevel } from '../types/game';
import { X, Building2, TrendingUp, Star, Zap, Lock, AlertCircle, Award, MapPin, Handshake, CheckCircle2, Activity, Users, Plane, Gem } from 'lucide-react';
import { useState, useEffect } from 'react';
import { MarketTempBadge, TrendBadge } from './DistrictAlerts';

interface DistrictDetailProps {
  district: District | null;
  playerDistrict: PlayerDistrict | undefined;
  playerLevel: number;
  market: DistrictMarketData | undefined;
  events: DistrictEvent[];
  onClose: () => void;
  onEnter: (districtId: string) => void;
  onInvest: (districtId: string) => void;
  onCloseDeal: (districtId: string, dealName: string) => void;
  onTradingPenalty: () => void;
}

// Market indicator row
function MarketIndicator({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string; icon: React.ElementType;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color + '18', border: `1px solid ${color}30` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-xs text-slate-500">{label}</span>
          <span className="text-xs font-black" style={{ color }}>{value}</span>
        </div>
        <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
            style={{
              width: mounted ? `${value}%` : '0%',
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}60`,
            }}>
            {value > 70 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                style={{ backgroundSize: '200% 100%' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const DEAL_VALUES: Record<string, { money: string; rep: number }> = {
  'Boutique Advisory Contract': { money: '€8k+',  rep: 8 },
  'Hotel Acquisition Study':    { money: '€15k+', rep: 10 },
  'Feasibility Report':         { money: '€5k+',  rep: 6 },
  'Asset Repositioning':        { money: '€25k+', rep: 14 },
  'Portfolio Audit':            { money: '€12k+', rep: 9 },
};

const OPPORTUNITY_NAMES = [
  'Boutique Advisory Contract',
  'Hotel Acquisition Study',
  'Feasibility Report',
  'Asset Repositioning',
  'Portfolio Audit',
];

const REGION_ACCENT: Record<string, string> = {
  'Lisbon Region': '#f59e0b',
  'North':         '#3b82f6',
  'Central':       '#10b981',
  'Alentejo':      '#8b5cf6',
  'Algarve':       '#ef4444',
  'Islands':       '#ec4899',
};

const TERRITORY_FLAVOR: Record<number, string> = {
  0: 'Uncharted territory. Opportunity awaits those bold enough to enter.',
  1: 'Initial foothold established. Begin building your advisory network here.',
  2: 'Growing influence. Competitors are starting to notice your presence.',
  3: 'You dominate this market. Your brand is synonymous with quality here.',
  4: 'Total authority. Other advisors work through you in this district.',
  5: 'Empire-tier. This district is your legacy — permanent, undeniable.',
};

export const DistrictDetail = ({
  district,
  playerDistrict,
  playerLevel,
  market,
  events,
  onClose,
  onEnter,
  onInvest,
  onCloseDeal,
  onTradingPenalty,
}: DistrictDetailProps) => {
  const [showTradeWarning, setShowTradeWarning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [completedDeals, setCompletedDeals] = useState<Set<number>>(new Set());
  const [flashingDeal, setFlashingDeal] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setLeaving(true);
    setTimeout(onClose, 300);
  };

  if (!district) return null;

  const status = getTerritoryStatus(district, playerDistrict, playerLevel);
  const accentColor = REGION_ACCENT[district.region] ?? '#f59e0b';
  const tlevel = playerDistrict?.territory_level ?? 0;
  const domXP = playerDistrict?.dominance_xp ?? 0;
  const nextLevelXP = xpForTerritoryLevel(tlevel + 1);
  const currentLevelXP = xpForTerritoryLevel(tlevel);
  const domProgress = tlevel >= 5 ? 100 :
    Math.max(0, Math.round(((domXP - currentLevelXP) / Math.max(nextLevelXP - currentLevelXP, 1)) * 100));
  const marketPct = Math.round((playerDistrict?.market_share ?? 0) * 100);
  const oppUnlocked = playerDistrict?.opportunities_unlocked ?? 0;

  const tierLabels = ['—', 'Scouting', 'Established', 'Dominant', 'Authority', 'Empire'];
  const tierColors = ['#64748b', '#3b82f6', '#06b6d4', '#f59e0b', '#f97316', '#ef4444'];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        mounted && !leaving ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={e => { if (e.target === e.currentTarget) close(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Ambient light behind modal */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${accentColor}12 0%, transparent 60%)`,
        }}
      />

      {/* Modal */}
      <div
        className={`relative z-10 bg-slate-950 rounded-2xl max-w-lg w-full border shadow-2xl overflow-hidden transition-all duration-300 ${
          mounted && !leaving ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        style={{
          borderColor: accentColor + '40',
          boxShadow: `0 0 0 1px ${accentColor}20, 0 32px 80px rgba(0,0,0,0.7), 0 0 40px ${accentColor}15`,
        }}
      >
        {/* Top accent bar */}
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

        {/* Header */}
        <div
          className="relative px-6 py-5 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${accentColor}18 0%, transparent 60%)` }}
        >
          {/* BG decoration */}
          <div
            className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl pointer-events-none"
            style={{ backgroundColor: accentColor + '20' }}
          />

          <div className="relative flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-2xl font-black text-white leading-tight">{district.name}</h2>
                {status.isActive && (
                  <span
                    className="text-xs px-2.5 py-0.5 rounded-full font-black border-2 flex items-center gap-1"
                    style={{ color: tierColors[tlevel], borderColor: tierColors[tlevel] + '60', backgroundColor: tierColors[tlevel] + '15' }}
                  >
                    T{tlevel} · {tierLabels[tlevel]}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold" style={{ color: accentColor }}>{district.region}</p>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">{district.description}</p>
              {status.isActive && (
                <p className="text-xs mt-2 italic" style={{ color: accentColor + 'aa' }}>
                  "{TERRITORY_FLAVOR[tlevel]}"
                </p>
              )}
            </div>
            <button
              onClick={close}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-500 hover:text-white ml-4 flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Market pulse panel */}
          {market && (
            <div className="animate-slide-up bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Market Pulse
                </span>
                <div className="flex items-center gap-2">
                  <TrendBadge direction={market.trend_direction} />
                  <MarketTempBadge temp={market.market_temp} />
                </div>
              </div>

              {/* 6 indicators */}
              <div className="space-y-2.5">
                <MarketIndicator label="Market Temperature" value={market.market_temp}    color="#ef4444" icon={Activity} />
                <MarketIndicator label="Active Opportunities" value={market.opportunities}  color="#10b981" icon={Star} />
                <MarketIndicator label="Competition Level"   value={market.competition}   color="#f59e0b" icon={Users} />
                <MarketIndicator label="Investor Activity"   value={market.investor_activity} color="#3b82f6" icon={TrendingUp} />
                <MarketIndicator label="Tourism Growth"      value={market.tourism_growth} color="#06b6d4" icon={Plane} />
                <MarketIndicator label="Luxury Demand"       value={market.luxury_demand} color="#a855f7" icon={Gem} />
              </div>
            </div>
          )}

          {/* Active district events */}
          {events.length > 0 && (
            <div className="animate-slide-up space-y-2" style={{ animationDelay: '0.05s' }}>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Active Events
                <span className="text-slate-700 font-normal normal-case tracking-normal">({events.length})</span>
              </h4>
              {events.slice(0, 4).map(event => {
                const severityColor = event.severity === 'opportunity' ? '#10b981'
                  : event.severity === 'warning' ? '#f59e0b'
                  : event.severity === 'alert' ? '#ef4444'
                  : '#3b82f6';
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 border"
                    style={{ backgroundColor: severityColor + '0d', borderColor: severityColor + '30' }}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: severityColor + '20', border: `1px solid ${severityColor}35` }}
                    >
                      <Zap className="w-3 h-3" style={{ color: severityColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white leading-tight">{event.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{event.description}</p>
                    </div>
                    <span
                      className="text-[10px] font-black uppercase tracking-wider flex-shrink-0 mt-0.5"
                      style={{ color: severityColor + 'cc' }}
                    >
                      {event.severity}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Locked */}
          {!status.isAccessible && (
            <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-4 animate-slide-up">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                <Lock className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <p className="text-slate-300 font-bold">Territory Locked</p>
                <p className="text-slate-500 text-sm">
                  Reach Level <span className="text-amber-400 font-bold">{district.unlock_requirement}</span> to unlock.
                  You are Level <span className="text-amber-400 font-bold">{playerLevel}</span>.
                </p>
                <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-600 transition-all"
                    style={{ width: `${Math.min((playerLevel / district.unlock_requirement) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Base stats grid */}
          <div className="grid grid-cols-3 gap-2 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            {[
              { label: 'Difficulty', value: '★'.repeat(district.base_difficulty) + '☆'.repeat(5 - district.base_difficulty), color: '#f59e0b' },
              { label: 'XP Bonus',   value: `+${district.xp_bonus}%`,  color: '#10b981', Icon: Zap },
              { label: 'Max Hotels', value: `${district.hotel_opportunity_count}`, color: '#3b82f6', Icon: Building2 },
            ].map(({ label, value, color, Icon }) => (
              <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-600 mb-1">{label}</p>
                <p className="font-bold text-sm flex items-center justify-center gap-1" style={{ color }}>
                  {Icon && <Icon className="w-3 h-3" />}
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Active territory stats */}
          {status.isActive && playerDistrict && (
            <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              {/* Market dominance */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Market Dominance
                  </span>
                  <span className="text-sm font-black" style={{ color: accentColor }}>{marketPct}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                    style={{ width: `${Math.min(marketPct, 100)}%`, backgroundColor: accentColor }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                  </div>
                </div>
                {marketPct >= 50 && (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <span className="animate-pulse">★</span> Market leader in this district
                  </p>
                )}
              </div>

              {/* Territory progression */}
              {tlevel < 5 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Territory Progression</span>
                    <span className="text-xs text-slate-500">
                      {domXP}/{nextLevelXP} XP → <span style={{ color: tierColors[tlevel + 1] }}>T{tlevel + 1}</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(domProgress, 100)}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                        boxShadow: '0 0 8px rgba(6,182,212,0.5)',
                      }}
                    />
                  </div>
                </div>
              )}

              {tlevel >= 5 && (
                <div className="flex items-center gap-2 text-xs text-red-400 font-bold bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
                  <Award className="w-4 h-4" />
                  Maximum territory level reached — Empire tier
                </div>
              )}

              {/* Rep + Hotels */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5">
                  <Star className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-600">Reputation</p>
                    <p className="text-yellow-400 font-black text-lg leading-none">{playerDistrict.district_reputation}</p>
                  </div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-600">Hotels</p>
                    <p className="text-emerald-400 font-black text-lg leading-none">{playerDistrict.hotels_invested}</p>
                  </div>
                </div>
              </div>

              {/* Deal Opportunities */}
              <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                  <Handshake className="w-3.5 h-3.5" />
                  Deal Opportunities
                  <span className="text-slate-700 font-normal normal-case tracking-normal">
                    {oppUnlocked}/{district.hotel_opportunity_count} unlocked
                  </span>
                </h4>
                <div className="space-y-2">
                  {OPPORTUNITY_NAMES.slice(0, district.hotel_opportunity_count).map((name, i) => {
                    const unlocked = i < oppUnlocked;
                    const done = completedDeals.has(i);
                    const flashing = flashingDeal === i;
                    const dealVal = DEAL_VALUES[name];

                    if (!unlocked) {
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm border bg-slate-900/30 border-slate-800/30 text-slate-700"
                        >
                          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="flex-1">{name}</span>
                          <span className="text-xs text-slate-800">Locked</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={i}
                        className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
                          done
                            ? 'bg-slate-900/40 border-slate-800/40 opacity-60'
                            : flashing
                            ? 'border-2'
                            : 'border hover:border-opacity-60'
                        }`}
                        style={
                          flashing
                            ? { borderColor: accentColor, boxShadow: `0 0 20px ${accentColor}40, inset 0 0 20px ${accentColor}10` }
                            : done
                            ? {}
                            : { borderColor: accentColor + '35', backgroundColor: accentColor + '08' }
                        }
                      >
                        {/* Flash overlay */}
                        {flashing && (
                          <div
                            className="absolute inset-0 pointer-events-none rounded-xl"
                            style={{
                              background: `radial-gradient(circle at center, ${accentColor}30, transparent 70%)`,
                              animation: 'dealFlash 0.6s ease-out both',
                            }}
                          />
                        )}

                        <div className="px-3 py-2.5 flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={done ? { backgroundColor: '#1e293b' } : { backgroundColor: accentColor + '20' }}
                          >
                            {done
                              ? <CheckCircle2 className="w-4 h-4 text-slate-600" />
                              : <Handshake className="w-3.5 h-3.5" style={{ color: accentColor }} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold leading-tight ${done ? 'text-slate-600' : 'text-white'}`}>
                              {name}
                            </p>
                            {!done && dealVal && (
                              <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: accentColor + '99' }}>
                                <span>{dealVal.money}</span>
                                <span>·</span>
                                <span>+{dealVal.rep} REP</span>
                                <span>·</span>
                                <span>+6% dominance</span>
                              </p>
                            )}
                          </div>

                          {done ? (
                            <span className="text-xs text-slate-600 font-bold flex-shrink-0">Done</span>
                          ) : (
                            <button
                              onClick={() => {
                                setFlashingDeal(i);
                                onCloseDeal(district.id, name);
                                setTimeout(() => {
                                  setFlashingDeal(null);
                                  setCompletedDeals(prev => new Set([...prev, i]));
                                }, 650);
                              }}
                              className="flex-shrink-0 text-xs font-black px-3 py-1.5 rounded-lg transition-all active:scale-95 hover:brightness-110"
                              style={{
                                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
                                color: '#0f172a',
                                boxShadow: `0 2px 10px ${accentColor}40`,
                              }}
                            >
                              Close Deal
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {oppUnlocked < district.hotel_opportunity_count && (
                  <p className="text-xs text-slate-700 mt-2">
                    Complete quests to unlock more deals.
                  </p>
                )}
              </div>
              <style>{`
                @keyframes dealFlash {
                  0%   { opacity: 1; }
                  100% { opacity: 0; }
                }
              `}</style>
            </div>
          )}

          {/* Actions */}
          {status.isAccessible && (
            <div className="space-y-2 pt-2 border-t border-slate-800/60 animate-slide-up" style={{ animationDelay: '0.25s' }}>
              {!status.isActive ? (
                <button
                  onClick={() => { onEnter(district.id); close(); }}
                  className="w-full py-3.5 rounded-xl font-black text-white transition-all flex items-center justify-center gap-2 active:scale-98 group relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)`,
                    boxShadow: `0 4px 20px ${accentColor}40`,
                  }}
                >
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                  <MapPin className="w-5 h-5 relative z-10 group-hover:animate-float" />
                  <span className="relative z-10 tracking-wide">Enter Territory</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { onInvest(district.id); close(); }}
                    className="w-full bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-700/50 hover:border-emerald-600 text-emerald-300 hover:text-emerald-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Building2 className="w-4 h-4" />
                    Invest in Hotel
                    <span className="text-xs text-emerald-600 font-normal">(+5% Dominance)</span>
                  </button>

                  <button
                    onClick={() => setShowTradeWarning(true)}
                    className="w-full bg-slate-900/60 hover:bg-red-950/30 border border-slate-800 hover:border-red-900/60 text-slate-500 hover:text-red-400 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Execute Trade
                    <span className="text-xs font-normal opacity-60">(Penalty)</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Trade warning */}
          {showTradeWarning && (
            <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4 animate-scale-in">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-3 flex-1">
                  <div>
                    <p className="text-red-300 font-bold text-sm">Trading Penalty Warning</p>
                    <p className="text-red-300/60 text-xs mt-1 leading-relaxed">
                      Executing a trade will reset your streak, reduce Focus −10 and Discipline −10, and subtract 50 XP.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { onTradingPenalty(); setShowTradeWarning(false); close(); }}
                      className="flex-1 text-xs bg-red-800/60 hover:bg-red-700/60 border border-red-700/50 text-white px-3 py-2 rounded-lg font-bold transition-colors"
                    >
                      Confirm Trade
                    </button>
                    <button
                      onClick={() => setShowTradeWarning(false)}
                      className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg font-bold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom accent bar */}
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)` }} />
      </div>
    </div>
  );
};
