import { useState, useEffect } from 'react';
import { District, PlayerDistrict, DistrictMarketData, DistrictEvent, getTerritoryStatus, xpForTerritoryLevel } from '../types/game';
import { Star, TrendingUp, Building2, Eye, Compass, Activity, Users, Sparkles } from 'lucide-react';
import { MarketTempBadge, TrendBadge } from './DistrictAlerts';

interface DistrictMapProps {
  districts: District[];
  playerDistricts: Map<string, PlayerDistrict>;
  playerLevel: number;
  newlyDiscovered: Set<string>;
  districtMarket: Map<string, DistrictMarketData>;
  districtEvents: Map<string, DistrictEvent[]>;
  onSelectDistrict: (districtId: string) => void;
}

const REGION_ACCENT: Record<string, string> = {
  'Lisbon Region': '#f59e0b',
  'North':         '#3b82f6',
  'Central':       '#10b981',
  'Alentejo':      '#8b5cf6',
  'Algarve':       '#ef4444',
  'Islands':       '#ec4899',
};

const TERRITORY_GLOW: Record<number, string> = {
  1: '0 0 14px rgba(59,130,246,0.35), 0 4px 20px rgba(0,0,0,0.5)',
  2: '0 0 18px rgba(6,182,212,0.4),   0 4px 24px rgba(0,0,0,0.5)',
  3: '0 0 22px rgba(245,158,11,0.45), 0 4px 28px rgba(0,0,0,0.5)',
  4: '0 0 28px rgba(249,115,22,0.55), 0 4px 32px rgba(0,0,0,0.5)',
  5: '0 0 36px rgba(239,68,68,0.65),  0 0 64px rgba(239,68,68,0.2), 0 4px 32px rgba(0,0,0,0.6)',
};

const TERRITORY_BORDER_COLOR: Record<number, string> = {
  1: '#3b82f6', 2: '#06b6d4', 3: '#f59e0b', 4: '#f97316', 5: '#ef4444',
};

const TERRITORY_BG_GRADIENT: Record<number, string> = {
  1: 'linear-gradient(135deg, rgba(30,58,138,0.6)  0%, rgba(2,6,23,0.97) 100%)',
  2: 'linear-gradient(135deg, rgba(22,78,99,0.6)   0%, rgba(2,6,23,0.97) 100%)',
  3: 'linear-gradient(135deg, rgba(120,53,15,0.65) 0%, rgba(2,6,23,0.97) 100%)',
  4: 'linear-gradient(135deg, rgba(124,45,18,0.7)  0%, rgba(2,6,23,0.97) 100%)',
  5: 'linear-gradient(135deg, rgba(127,29,29,0.8)  0%, rgba(15,5,5,0.99)  100%)',
};

const TIER_ICONS: Record<number, string> = {
  0: '●', 1: '◆', 2: '◈', 3: '⬟', 4: '⬡', 5: '✦',
};

function MiniBar({ value, color, label }: { value: number; color: string; label: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 200); return () => clearTimeout(t); }, []);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[9px] text-slate-700 flex-shrink-0 w-7">{label}</span>
      <div className="flex-1 h-1 bg-slate-800/80 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: mounted ? `${value}%` : '0%', backgroundColor: color, boxShadow: `0 0 4px ${color}60` }}
        />
      </div>
    </div>
  );
}

function EventDot({ severity }: { severity: DistrictEvent['severity'] }) {
  const color = severity === 'opportunity' ? '#10b981'
    : severity === 'alert'   ? '#ef4444'
    : severity === 'warning' ? '#f59e0b'
    : '#3b82f6';
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }} />
    </span>
  );
}

function TerritoryCard({
  district, playerDistrict, playerLevel, isNewlyDiscovered, index, market, events, onClick,
}: {
  district: District;
  playerDistrict: PlayerDistrict | undefined;
  playerLevel: number;
  isNewlyDiscovered: boolean;
  index: number;
  market: DistrictMarketData | undefined;
  events: DistrictEvent[];
  onClick: () => void;
}) {
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showScanRing, setShowScanRing] = useState(false);
  const [hovered, setHovered] = useState(false);

  const status    = getTerritoryStatus(district, playerDistrict, playerLevel);
  const tlevel    = playerDistrict?.territory_level ?? 0;
  const domXP     = playerDistrict?.dominance_xp ?? 0;
  const nextLXP   = xpForTerritoryLevel(tlevel + 1);
  const curLXP    = xpForTerritoryLevel(tlevel);
  const prog      = tlevel >= 5 ? 100 : Math.max(0, Math.round(((domXP - curLXP) / Math.max(nextLXP - curLXP, 1)) * 100));
  const mktPct    = Math.round((playerDistrict?.market_share ?? 0) * 100);
  const accent    = REGION_ACCENT[district.region] ?? '#f59e0b';

  const isLocked    = !status.isAccessible;
  const isAvailable = status.isAccessible && !status.isActive;
  const isActive    = status.isActive;

  const live = events.filter(e => !e.expires_at || new Date(e.expires_at).getTime() > Date.now());
  const top  = live[0];
  const hasOpp   = live.some(e => e.severity === 'opportunity');
  const hasAlert = live.some(e => e.severity === 'alert' || e.severity === 'warning');

  useEffect(() => {
    if (isNewlyDiscovered) {
      setShowDiscovery(true);
      setShowScanRing(true);
      const t1 = setTimeout(() => setShowDiscovery(false), 1400);
      const t2 = setTimeout(() => setShowScanRing(false), 1300);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [isNewlyDiscovered]);

  const isEmpire = isActive && tlevel >= 5;

  const cardStyle: React.CSSProperties = isActive
    ? {
        background: TERRITORY_BG_GRADIENT[tlevel],
        borderColor: hovered ? TERRITORY_BORDER_COLOR[tlevel] : TERRITORY_BORDER_COLOR[tlevel] + '99',
        boxShadow: hovered
          ? `${TERRITORY_GLOW[tlevel]}, 0 0 0 1px ${TERRITORY_BORDER_COLOR[tlevel]}40`
          : TERRITORY_GLOW[tlevel],
        transform: hovered ? 'translateY(-2px) scale(1.02)' : undefined,
        transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
      }
    : isAvailable
    ? {
        background: 'linear-gradient(135deg, rgba(15,23,42,0.85), rgba(2,6,23,0.97))',
        borderColor: hovered ? '#64748b' : '#334155',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.4)' : undefined,
        transform: hovered ? 'translateY(-1px) scale(1.01)' : undefined,
        transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
      }
    : { background: 'rgba(2,6,23,0.65)', borderColor: '#1e293b' };

  return (
    <button onClick={onClick} disabled={isLocked}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className={`group relative overflow-hidden rounded-xl text-left border-2 focus:outline-none
        animate-reveal-up stagger-${Math.min(index + 1, 12)}
        ${isLocked ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
        ${isEmpire ? 'territory-empire' : isActive ? 'territory-active' : ''}
        ${isActive && status.isDominating ? 'ring-1 ring-amber-400/20' : ''}
      `}
      style={{ ...cardStyle, '--glow': TERRITORY_BORDER_COLOR[tlevel] + '80', '--glow-wide': TERRITORY_BORDER_COLOR[tlevel] + '30' } as React.CSSProperties}
    >
      {showDiscovery && <div className="discovery-flash" />}
      {showScanRing && (
        <div className="scan-ring" style={{ color: TERRITORY_BORDER_COLOR[tlevel] ?? accent }} />
      )}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 transition-all duration-300"
        style={{
          background: isActive
            ? `linear-gradient(90deg, transparent, ${TERRITORY_BORDER_COLOR[tlevel]}, ${accent}, ${TERRITORY_BORDER_COLOR[tlevel]}, transparent)`
            : accent,
          opacity: isLocked ? 0.25 : hovered ? 1 : isActive ? 0.9 : 0.6,
          boxShadow: isActive ? `0 0 6px ${accent}80` : undefined,
        }}
      />
      {isActive && (
        <>
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl pointer-events-none"
            style={{ backgroundColor: accent + '30', transform: 'translate(40%, -40%)' }} />
          <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full blur-xl pointer-events-none"
            style={{ backgroundColor: TERRITORY_BORDER_COLOR[tlevel] + '15', transform: 'translate(-30%, 30%)' }} />
        </>
      )}
      {!isLocked && hovered && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />
          <div className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ boxShadow: `inset 0 0 20px ${accent}10` }} />
        </>
      )}
      {isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-950/40">
          <span className="text-xs text-slate-700">🔒</span>
          <span className="text-xs text-slate-700 font-bold">Lv {district.unlock_requirement}</span>
        </div>
      )}
      {/* Event dots */}
      {!isLocked && live.length > 0 && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 z-10">
          {hasOpp   && <EventDot severity="opportunity" />}
          {hasAlert && <EventDot severity={live.find(e => e.severity === 'alert') ? 'alert' : 'warning'} />}
          {!hasOpp && !hasAlert && top && <EventDot severity={top.severity} />}
        </div>
      )}
      {/* Controlled pulse — only if no events */}
      {isActive && status.isControlled && !live.length && (
        <span className="absolute top-1.5 right-1.5 flex h-2 w-2 z-10">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: accent }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: accent }} />
        </span>
      )}

      <div className={`p-3 space-y-2 ${isLocked ? 'invisible' : ''}`}>
        {/* Name + tier */}
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-white text-sm leading-tight truncate">{district.name}</h3>
            <p className="text-[10px] mt-0.5 font-medium truncate" style={{ color: accent + 'cc' }}>
              {district.region}
            </p>
          </div>
          {isActive    && <span className="text-base leading-none opacity-80 flex-shrink-0" style={{ color: TERRITORY_BORDER_COLOR[tlevel] }}>{TIER_ICONS[tlevel]}</span>}
          {isAvailable && <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0" />}
        </div>

        {/* Market temp + trend */}
        {market && !isLocked && (
          <div className="flex items-center justify-between gap-1">
            <MarketTempBadge temp={market.market_temp} size="xs" />
            <TrendBadge direction={market.trend_direction} />
          </div>
        )}

        {/* Available */}
        {isAvailable && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span style={{ color: accent }}>{'★'.repeat(district.base_difficulty)}</span>
              <span className="text-slate-700">{'★'.repeat(5 - district.base_difficulty)}</span>
            </div>
            {market && (
              <div className="space-y-0.5">
                <MiniBar value={market.opportunities}    color="#10b981" label="OPP" />
                <MiniBar value={market.investor_activity} color="#3b82f6" label="INV" />
              </div>
            )}
          </div>
        )}

        {/* Active */}
        {isActive && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-bold ${status.tierColor}`}>{status.tierLabel}</span>
              <span className="text-slate-500">T{tlevel}</span>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-slate-500">Dominance</span>
                <span className="font-bold" style={{ color: accent }}>{mktPct}%</span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(mktPct, 100)}%`, backgroundColor: accent, boxShadow: `0 0 6px ${accent}80` }} />
              </div>
            </div>
            {market && (
              <div className="space-y-0.5 pt-0.5 border-t border-slate-800/40">
                <MiniBar value={market.opportunities}    color="#10b981" label="OPP" />
                <MiniBar value={market.competition}      color="#ef4444" label="COMP" />
                <MiniBar value={market.investor_activity} color="#3b82f6" label="INV" />
              </div>
            )}
            {tlevel < 5 && (
              <div className="w-full bg-black/40 rounded-full h-1 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(prog, 100)}%`, background: 'linear-gradient(90deg, #3b82f6, #06b6d4)' }} />
              </div>
            )}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="flex items-center gap-1 text-slate-400"><Star className="w-3 h-3 text-yellow-500" />{playerDistrict?.district_reputation ?? 0}</span>
              <span className="flex items-center gap-1 text-slate-400"><Building2 className="w-3 h-3 text-emerald-500" />{playerDistrict?.hotels_invested ?? 0}</span>
              <span className="flex items-center gap-1 text-slate-400"><TrendingUp className="w-3 h-3 text-blue-400" />{playerDistrict?.opportunities_unlocked ?? 0}/{district.hotel_opportunity_count}</span>
            </div>
            {top && (
              <div className="text-[10px] px-2 py-1 rounded-lg leading-tight"
                style={{
                  color:           top.severity === 'opportunity' ? '#10b981' : top.severity === 'alert' ? '#ef4444' : top.severity === 'warning' ? '#f59e0b' : '#3b82f6',
                  backgroundColor: top.severity === 'opportunity' ? 'rgba(6,78,59,0.3)'   : top.severity === 'alert' ? 'rgba(127,29,29,0.3)' : top.severity === 'warning' ? 'rgba(120,53,15,0.3)' : 'rgba(30,58,138,0.3)',
                }}>
                {top.title}
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

export const DistrictMap = ({
  districts, playerDistricts, playerLevel, newlyDiscovered,
  districtMarket, districtEvents, onSelectDistrict,
}: DistrictMapProps) => {
  const controlled = Array.from(playerDistricts.values()).filter(pd => pd.territory_level >= 3).length;
  const active     = playerDistricts.size;
  const unexplored = districts.length - active;

  const allMarkets = Array.from(districtMarket.values());
  const avgTemp    = allMarkets.length
    ? Math.round(allMarkets.reduce((a, m) => a + m.market_temp, 0) / allMarkets.length) : 50;

  const totalEvents = Array.from(districtEvents.values()).flat()
    .filter(e => !e.expires_at || new Date(e.expires_at).getTime() > Date.now()).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-black text-amber-400 flex items-center gap-2 text-glow-amber">
          <Compass className="w-5 h-5 animate-float" />
          <span className="text-lg">Territory Map</span>
          <span className="text-slate-600 font-normal text-sm">— Portugal</span>
        </h2>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {totalEvents > 0 && (
            <span className="flex items-center gap-1 bg-amber-950/30 border border-amber-800/30 px-2 py-0.5 rounded-lg">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 font-bold">{totalEvents}</span>
              <span className="text-amber-700">events</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-amber-400 font-bold">{active}</span>
            <span className="text-slate-600">Active</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span className="text-orange-400 font-bold">{controlled}</span>
            <span className="text-slate-600">Controlled</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="text-slate-500 font-bold">{unexplored}</span>
            <span className="text-slate-600">Unexplored</span>
          </span>
        </div>
      </div>

      {/* Global market pulse bar */}
      {allMarkets.length > 0 && (
        <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-2.5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-900/5 to-transparent pointer-events-none" />
          <Activity className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">National Market Pulse</span>
              <span className="text-xs font-bold" style={{ color: avgTemp >= 70 ? '#ef4444' : avgTemp >= 50 ? '#f59e0b' : '#3b82f6' }}>
                {avgTemp}°
              </span>
            </div>
            <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${avgTemp}%`,
                  background: avgTemp >= 70 ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                    : avgTemp >= 50 ? 'linear-gradient(90deg, #3b82f6, #f59e0b)'
                    : 'linear-gradient(90deg, #1e3a8a, #3b82f6)',
                  boxShadow: `0 0 8px ${avgTemp >= 70 ? '#ef444450' : '#f59e0b40'}`,
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Users className="w-3 h-3 text-slate-600" />
            <span className="text-xs text-slate-600">
              {allMarkets.filter(m => m.trend_direction === 'rising').length} rising
            </span>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
        {districts.map((d, i) => (
          <TerritoryCard key={d.id} district={d}
            playerDistrict={playerDistricts.get(d.id)}
            playerLevel={playerLevel}
            isNewlyDiscovered={newlyDiscovered.has(d.id)}
            index={i}
            market={districtMarket.get(d.id)}
            events={districtEvents.get(d.id) ?? []}
            onClick={() => onSelectDistrict(d.id)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-800/60 text-xs text-slate-600">
        {[
          { color: '#334155', label: 'Unexplored' },
          { color: '#3b82f6', label: 'Scouting' },
          { color: '#06b6d4', label: 'Established' },
          { color: '#f59e0b', label: 'Dominant' },
          { color: '#f97316', label: 'Authority' },
          { color: '#ef4444', label: 'Empire' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-700">Opportunity</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-700">Warning</span>
        </span>
      </div>
    </div>
  );
};
