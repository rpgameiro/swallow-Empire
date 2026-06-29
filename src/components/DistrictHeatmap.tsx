import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, Users, Building2, DollarSign, Zap, Crown,
  MapPin,
  Flame, Activity, BarChart2, RefreshCw,
  ArrowRight, Target,
} from 'lucide-react';
import { Lead, LeadMatch, MATCH_TIER_META, District, DistrictMarketData } from '../types/game';
import { getLeads, getLeadMatches } from '../services/matchingEngine';

// ─── CSS ──────────────────────────────────────────────────────────────────────

const HEATMAP_CSS = `
  @keyframes hmPulse {
    0%,100% { opacity: 1; }
    50%     { opacity: 0.6; }
  }
  @keyframes hmReveal {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes hmScan {
    from { top: -2px; opacity: 0.4; }
    to   { top: 100%; opacity: 0; }
  }
  @keyframes hmBarGrow {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  @keyframes hmFlicker {
    0%,100% { opacity: 1; }
    92%     { opacity: 1; }
    93%     { opacity: 0.4; }
    94%     { opacity: 1; }
    97%     { opacity: 0.7; }
    98%     { opacity: 1; }
  }
  @keyframes hmAlertPop {
    0%  { transform: scale(0.85) translateY(8px); opacity: 0; }
    60% { transform: scale(1.03) translateY(-2px); }
    100%{ transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes hmTicker {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  .hm-card  { animation: hmReveal 0.4s cubic-bezier(0.22,1,0.36,1) both; }
  .hm-scan  {
    position: absolute; left: 0; right: 0; height: 1.5px;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);
    animation: hmScan 3.5s linear infinite; pointer-events: none;
  }
  .hm-bar   { transform-origin: left; animation: hmBarGrow 0.6s cubic-bezier(0.22,1,0.36,1) both; }
  .hm-alert { animation: hmAlertPop 0.5s cubic-bezier(0.22,1,0.36,1) both; }
  .hm-flicker { animation: hmFlicker 8s ease-in-out infinite; }
`;

// ─── Colour scale ─────────────────────────────────────────────────────────────
// Returns colour for a 0-100 opportunity score

function scoreColor(score: number): string {
  if (score >= 80) return '#ef4444'; // red-hot
  if (score >= 65) return '#f97316'; // orange
  if (score >= 50) return '#f59e0b'; // amber
  if (score >= 35) return '#10b981'; // green
  if (score >= 20) return '#3b82f6'; // blue
  return '#334155';                  // cold/empty
}

function heatLabel(score: number): string {
  if (score >= 80) return 'Blazing';
  if (score >= 65) return 'Hot';
  if (score >= 50) return 'Warm';
  if (score >= 35) return 'Active';
  if (score >= 20) return 'Cool';
  return 'Dormant';
}

function fmtM(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000_000) return `€${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `€${(n / 1_000).toFixed(0)}k`;
  return `€${n}`;
}

// ─── District data type ───────────────────────────────────────────────────────

export interface DistrictHeatEntry {
  districtName: string;
  region: string;
  investors: number;
  owners: number;
  matches: number;
  legendaryMatches: number;
  strongMatches: number;
  totalValue: number;          // sum of owner estimated_value
  topMatchScore: number;       // highest single match score in this district
  opportunityScore: number;    // computed 0-100
  isPlayerOwned: boolean;
  marketTemp?: number;         // from DistrictMarketData
  gameDistrict?: District;
}

// ─── Compute district heat entries ───────────────────────────────────────────

function buildHeatEntries(
  leads: Lead[],
  matches: LeadMatch[],
  districts: District[],
  playerDistricts: Map<string, unknown>,
  districtMarket: Map<string, DistrictMarketData>,
  locationOptions: readonly string[],
): DistrictHeatEntry[] {
  return locationOptions.map(loc => {
    const locLower = loc.toLowerCase();

    const investors = leads.filter(l =>
      l.tipo === 'Investidor' &&
      l.status === 'active' &&
      l.locations.some(ll => ll.toLowerCase() === locLower)
    );

    const owners = leads.filter(l =>
      l.tipo === 'Proprietário' &&
      l.status === 'active' &&
      l.locations.some(ll => ll.toLowerCase() === locLower)
    );

    // Matches relevant to this location: either the investor or owner has this location
    const relevantMatches = matches.filter(m => !m.is_dismissed && (
      investors.some(i => i.id === m.investor_lead_id) ||
      owners.some(o => o.id === m.owner_lead_id)
    ));

    const legendaryMatches = relevantMatches.filter(m => m.match_tier === 'legendary').length;
    const strongMatches    = relevantMatches.filter(m => m.match_tier === 'strong').length;
    const topMatchScore    = relevantMatches.reduce((max, m) => Math.max(max, m.match_score), 0);
    const totalValue       = owners.reduce((s, o) => s + (o.estimated_value ?? 0), 0);

    // Find matching game district
    const gameDistrict = districts.find(d =>
      d.name.toLowerCase().includes(locLower) ||
      locLower.includes(d.name.toLowerCase())
    );
    const isPlayerOwned = gameDistrict ? playerDistricts.has(gameDistrict.id) : false;
    const market = gameDistrict ? districtMarket.get(gameDistrict.id) : undefined;

    // Opportunity score formula:
    // - investor presence:    0-20 pts (up to 5 investors = 20pts)
    // - owner presence:       0-20 pts
    // - match quality:        0-30 pts (legendary=30, strong=20, warm=10)
    // - total deal value:     0-15 pts
    // - market temperature:   0-15 pts (from game district market data)
    const invPts   = Math.min(investors.length * 4, 20);
    const ownPts   = Math.min(owners.length * 4, 20);
    const matchPts = Math.min(legendaryMatches * 30 + strongMatches * 15 + relevantMatches.filter(m => m.match_tier === 'warm').length * 6, 30);
    const valPts   = totalValue >= 50_000_000 ? 15 : totalValue >= 10_000_000 ? 10 : totalValue >= 1_000_000 ? 5 : 0;
    const mktPts   = market ? Math.round((market.market_temp / 100) * 15) : 0;

    const opportunityScore = Math.min(invPts + ownPts + matchPts + valPts + mktPts, 100);

    // Determine region
    const region = gameDistrict?.region ?? (
      ['Lisbon', 'Cascais', 'Sintra', 'Setúbal'].includes(loc) ? 'Lisbon Region' :
      ['Porto', 'Braga', 'Douro Valley', 'Aveiro'].includes(loc) ? 'North' :
      ['Coimbra', 'Silver Coast'].includes(loc) ? 'Central' :
      ['Alentejo', 'Évora'].includes(loc) ? 'Alentejo' :
      ['Algarve', 'Faro'].includes(loc) ? 'Algarve' :
      ['Madeira', 'Azores'].includes(loc) ? 'Islands' :
      'Other'
    );

    return {
      districtName: loc,
      region,
      investors: investors.length,
      owners: owners.length,
      matches: relevantMatches.length,
      legendaryMatches,
      strongMatches,
      totalValue,
      topMatchScore,
      opportunityScore,
      isPlayerOwned,
      marketTemp: market?.market_temp,
      gameDistrict,
    };
  }).filter(e => e.opportunityScore > 0 || e.investors > 0 || e.owners > 0);
}

// ─── Region colors ─────────────────────────────────────────────────────────────

const REGION_COLORS: Record<string, string> = {
  'Lisbon Region': '#f59e0b',
  'North':         '#3b82f6',
  'Central':       '#06b6d4',
  'Alentejo':      '#f97316',
  'Algarve':       '#ef4444',
  'Islands':       '#a78bfa',
  'Other':         '#475569',
};

// ─── Heat intensity cell ──────────────────────────────────────────────────────

function HeatCell({ entry, rank, onClick, selected }: {
  entry: DistrictHeatEntry;
  rank: number;
  onClick: () => void;
  selected: boolean;
}) {
  const color = scoreColor(entry.opportunityScore);
  const intensity = entry.opportunityScore / 100;
  const regionColor = REGION_COLORS[entry.region] ?? '#475569';

  return (
    <div
      onClick={onClick}
      className="hm-card relative rounded-xl border cursor-pointer transition-all overflow-hidden group"
      style={{
        animationDelay: `${rank * 0.04}s`,
        borderColor: selected ? color + '80' : color + (intensity > 0.5 ? '35' : '18'),
        background: `linear-gradient(135deg, ${color}${Math.round(intensity * 22).toString(16).padStart(2, '0')}, rgba(2,6,23,0.97))`,
        boxShadow: selected
          ? `0 0 24px ${color}40, inset 0 0 20px ${color}08`
          : intensity > 0.65 ? `0 0 12px ${color}20` : 'none',
        transform: selected ? 'scale(1.01)' : 'scale(1)',
      }}
    >
      <div className="hm-scan" />
      {/* Top accent */}
      <div className="h-px" style={{ background: `linear-gradient(90deg,transparent,${color}${intensity > 0.5 ? '80' : '40'},transparent)` }} />

      <div className="p-3">
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              {entry.isPlayerOwned && (
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10b981', animation: 'hmPulse 2s ease-in-out infinite' }} />
              )}
              <span className="font-black text-white text-sm leading-tight">{entry.districtName}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: regionColor }} />
              <span className="text-[9px] text-slate-600">{entry.region}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ color, backgroundColor: color + '18' }}
            >
              {heatLabel(entry.opportunityScore)}
            </span>
            <span className="font-black text-lg leading-none" style={{ color }}>{entry.opportunityScore}</span>
          </div>
        </div>

        {/* Score bar */}
        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden mb-3">
          <div
            className="hm-bar h-full rounded-full"
            style={{ width: `${entry.opportunityScore}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}80` }}
          />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { label: 'Investors', value: entry.investors,  color: '#3b82f6' },
            { label: 'Owners',    value: entry.owners,     color: '#10b981' },
            { label: 'Matches',   value: entry.matches,    color: color },
          ].map(({ label, value, color: c }) => (
            <div key={label} className="rounded-lg py-1.5 px-1" style={{ backgroundColor: c + '10', border: `1px solid ${c}18` }}>
              <div className="font-black text-sm leading-none" style={{ color: c }}>{value}</div>
              <div className="text-[8px] text-slate-600 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Value + top match */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-slate-600 font-mono">{fmtM(entry.totalValue)}</span>
          {entry.legendaryMatches > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-black" style={{ color: '#f59e0b' }}>
              <Crown className="w-2.5 h-2.5" /> {entry.legendaryMatches}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── District detail drawer ───────────────────────────────────────────────────

function DistrictDetail({ entry, leads, matches, onClose }: {
  entry: DistrictHeatEntry;
  leads: Lead[];
  matches: LeadMatch[];
  onClose: () => void;
}) {
  const color = scoreColor(entry.opportunityScore);
  const locLower = entry.districtName.toLowerCase();

  const distInvestors = leads.filter(l =>
    l.tipo === 'Investidor' && l.status === 'active' &&
    l.locations.some(ll => ll.toLowerCase() === locLower)
  );
  const distOwners = leads.filter(l =>
    l.tipo === 'Proprietário' && l.status === 'active' &&
    l.locations.some(ll => ll.toLowerCase() === locLower)
  );
  const distMatches = matches.filter(m => !m.is_dismissed && (
    distInvestors.some(i => i.id === m.investor_lead_id) ||
    distOwners.some(o => o.id === m.owner_lead_id)
  )).sort((a, b) => b.match_score - a.match_score);

  const allLeads = new Map(leads.map(l => [l.id, l]));

  const scoreBreakdown = [
    { label: 'Investor Activity', value: Math.min(distInvestors.length * 4, 20), max: 20, color: '#3b82f6' },
    { label: 'Owner Inventory',   value: Math.min(distOwners.length * 4, 20),    max: 20, color: '#10b981' },
    { label: 'Match Quality',     value: Math.min(entry.legendaryMatches * 30 + entry.strongMatches * 15, 30), max: 30, color: '#f59e0b' },
    { label: 'Asset Value',       value: entry.totalValue >= 50_000_000 ? 15 : entry.totalValue >= 10_000_000 ? 10 : entry.totalValue >= 1_000_000 ? 5 : 0, max: 15, color: '#f97316' },
    { label: 'Market Temp',       value: entry.marketTemp ? Math.round((entry.marketTemp / 100) * 15) : 0, max: 15, color: '#06b6d4' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border"
        style={{
          borderColor: color + '40',
          background: 'linear-gradient(160deg, rgba(2,6,23,0.99), rgba(15,23,42,0.98))',
          boxShadow: `0 0 60px ${color}25, 0 40px 80px rgba(0,0,0,0.8)`,
        }}
      >
        <div className="hm-scan" />
        <div className="h-px" style={{ background: `linear-gradient(90deg,transparent,${color},transparent)` }} />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '20', border: `1px solid ${color}30` }}>
                  <MapPin className="w-4 h-4" style={{ color }} />
                </div>
                <h3 className="font-black text-white text-xl">{entry.districtName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{entry.region}</span>
                <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest" style={{ color, backgroundColor: color + '18' }}>
                  {heatLabel(entry.opportunityScore)} · {entry.opportunityScore}/100
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center border border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 transition-all"
            >
              ×
            </button>
          </div>

          {/* Score breakdown */}
          <div className="rounded-xl border p-4 mb-4" style={{ borderColor: color + '20', backgroundColor: color + '05' }}>
            <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3">Opportunity Score Breakdown</div>
            <div className="space-y-2.5">
              {scoreBreakdown.map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 w-32 flex-shrink-0">{s.label}</span>
                  <div className="flex-1 h-2 bg-slate-900 rounded overflow-hidden">
                    <div
                      className="hm-bar h-full rounded"
                      style={{ width: `${(s.value / s.max) * 100}%`, backgroundColor: s.color, boxShadow: `0 0 4px ${s.color}60` }}
                    />
                  </div>
                  <span className="text-[10px] font-black font-mono w-8 text-right" style={{ color: s.color }}>{s.value}/{s.max}</span>
                </div>
              ))}
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Total Value', value: fmtM(entry.totalValue), icon: DollarSign, color: '#f59e0b' },
              { label: 'Investors',   value: distInvestors.length,    icon: Users,      color: '#3b82f6' },
              { label: 'Owners',      value: distOwners.length,       icon: Building2,  color: '#10b981' },
            ].map(({ label, value, icon: Icon, color: c }) => (
              <div key={label} className="rounded-xl p-3 text-center border" style={{ borderColor: c + '20', backgroundColor: c + '08' }}>
                <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: c }} />
                <div className="font-black text-sm" style={{ color: c }}>{value}</div>
                <div className="text-[9px] text-slate-600">{label}</div>
              </div>
            ))}
          </div>

          {/* Top matches */}
          {distMatches.length > 0 && (
            <div className="mb-4">
              <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">
                Top Matches ({distMatches.length})
              </div>
              <div className="space-y-2">
                {distMatches.slice(0, 5).map(m => {
                  const inv = allLeads.get(m.investor_lead_id);
                  const own = allLeads.get(m.owner_lead_id);
                  const tierMeta = MATCH_TIER_META[m.match_tier];
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 rounded-xl p-2.5 border"
                      style={{ borderColor: tierMeta.color + '25', backgroundColor: tierMeta.color + '06' }}
                    >
                      <div
                        className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                        style={{ color: tierMeta.color, backgroundColor: tierMeta.color + '18' }}
                      >
                        {m.match_score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="font-bold text-white truncate">{inv?.name ?? '—'}</span>
                          <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                          <span className="font-bold text-white truncate">{own?.name ?? '—'}</span>
                        </div>
                        <div className="text-[9px] text-slate-600 truncate">{m.opportunity_type}</div>
                      </div>
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                        style={{ color: tierMeta.color, backgroundColor: tierMeta.color + '15' }}
                      >
                        {tierMeta.badge}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Investor list */}
          {distInvestors.length > 0 && (
            <div className="mb-3">
              <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Active Investors</div>
              <div className="space-y-1">
                {distInvestors.map(inv => (
                  <div key={inv.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: '#3b82f608', border: '1px solid #3b82f615' }}>
                    <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black" style={{ backgroundColor: '#3b82f620', color: '#3b82f6' }}>
                      {inv.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-white flex-1 truncate">{inv.name}</span>
                    {(inv.investment_max || inv.investment_min) && (
                      <span className="text-[9px] text-slate-600 font-mono">{fmtM(inv.investment_min)}–{fmtM(inv.investment_max)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Owner list */}
          {distOwners.length > 0 && (
            <div>
              <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Available Assets</div>
              <div className="space-y-1">
                {distOwners.map(own => (
                  <div key={own.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: '#10b98108', border: '1px solid #10b98115' }}>
                    <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>
                      {own.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-white flex-1 truncate">{own.name}</span>
                    {own.estimated_value > 0 && (
                      <span className="text-[9px] font-black font-mono" style={{ color: '#10b981' }}>{fmtM(own.estimated_value)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Opportunity alert ────────────────────────────────────────────────────────

function OpportunityAlert({ entry, index, onClick }: { entry: DistrictHeatEntry; index: number; onClick: () => void }) {
  const color = scoreColor(entry.opportunityScore);
  const isHot = entry.opportunityScore >= 65;

  return (
    <button
      onClick={onClick}
      className="hm-alert w-full text-left rounded-xl border px-3.5 py-3 flex items-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        animationDelay: `${index * 0.08}s`,
        borderColor: color + '35',
        background: `linear-gradient(135deg, ${color}08, rgba(2,6,23,0.97))`,
        boxShadow: isHot ? `0 0 10px ${color}20` : 'none',
      }}
    >
      {/* Pulsing dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color, animation: isHot ? 'hmPulse 1.5s ease-in-out infinite' : 'none' }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-black text-sm text-white">{entry.districtName}</span>
          {entry.legendaryMatches > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-black" style={{ color: '#f59e0b' }}>
              <Crown className="w-2.5 h-2.5" />{entry.legendaryMatches}
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 truncate">
          {entry.investors}i · {entry.owners}o · {entry.matches} matches
          {entry.totalValue > 0 && ` · ${fmtM(entry.totalValue)}`}
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="font-black text-base" style={{ color }}>{entry.opportunityScore}</span>
        <span className="text-[9px] uppercase font-black tracking-wide" style={{ color }}>{heatLabel(entry.opportunityScore)}</span>
      </div>

      <ArrowRight className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
    </button>
  );
}

// ─── Ranking table row ────────────────────────────────────────────────────────

function RankRow({ entry, rank, prev: _prev, onClick }: {
  entry: DistrictHeatEntry;
  rank: number;
  prev: DistrictHeatEntry | undefined;
  onClick: () => void;
}) {
  const color = scoreColor(entry.opportunityScore);
  const regionColor = REGION_COLORS[entry.region] ?? '#475569';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all group hover:scale-[1.005]"
      style={{ borderColor: color + '18', backgroundColor: color + '05' }}
    >
      {/* Rank */}
      <div className="w-6 flex-shrink-0 text-center">
        <span className="font-black text-sm" style={{ color: rank <= 3 ? color : '#334155' }}>
          {rank <= 3 ? ['①', '②', '③'][rank - 1] : rank}
        </span>
      </div>

      {/* Region dot + name */}
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: regionColor }} />
        <span className="font-bold text-sm text-white truncate">{entry.districtName}</span>
      </div>

      {/* Heat bar */}
      <div className="flex-1 h-2.5 bg-slate-900 rounded-full overflow-hidden hidden sm:block">
        <div
          className="hm-bar h-full rounded-full"
          style={{ width: `${entry.opportunityScore}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}50` }}
        />
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-[10px] text-slate-600 hidden md:block w-12 text-center">{entry.investors}i {entry.owners}o</span>
        <span className="text-[10px] text-slate-600 hidden lg:block w-16 text-right font-mono">{fmtM(entry.totalValue)}</span>
        <span className="font-black text-sm w-8 text-right" style={{ color }}>{entry.opportunityScore}</span>
        {entry.legendaryMatches > 0 && (
          <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
        )}
        {entry.isPlayerOwned && (
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#10b981' }} />
        )}
      </div>
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DistrictHeatmapProps {
  playerId: string;
  districts: District[];
  playerDistricts: Map<string, unknown>;
  districtMarket: Map<string, DistrictMarketData>;
  locationOptions: readonly string[];
  externalLeads?: Lead[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DistrictHeatmap({
  playerId, districts, playerDistricts, districtMarket, locationOptions,
  externalLeads,
}: DistrictHeatmapProps) {
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const [matches, setMatches] = useState<LeadMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<DistrictHeatEntry | null>(null);
  const [view, setView] = useState<'grid' | 'rank' | 'alerts'>('grid');
  const [sortBy, setSortBy] = useState<'score' | 'value' | 'matches' | 'investors'>('score');
  const [refreshing, setRefreshing] = useState(false);

  const leads = (externalLeads && externalLeads.length > 0) ? externalLeads : localLeads;

  const load = useCallback(async () => {
    setRefreshing(true);
    const [ls, ms] = await Promise.all([getLeads(playerId), getLeadMatches(playerId)]);
    setLocalLeads(ls);
    setMatches(ms);
    setLoading(false);
    setRefreshing(false);
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (externalLeads && externalLeads.length > 0) setLoading(false);
  }, [externalLeads]);

  const entries = useMemo(() =>
    buildHeatEntries(leads, matches, districts, playerDistricts, districtMarket, locationOptions),
    [leads, matches, districts, playerDistricts, districtMarket, locationOptions]
  );

  const sorted = useMemo(() => {
    const copy = [...entries];
    if (sortBy === 'score')     copy.sort((a, b) => b.opportunityScore - a.opportunityScore);
    if (sortBy === 'value')     copy.sort((a, b) => b.totalValue - a.totalValue);
    if (sortBy === 'matches')   copy.sort((a, b) => b.matches - a.matches);
    if (sortBy === 'investors') copy.sort((a, b) => b.investors - a.investors);
    return copy;
  }, [entries, sortBy]);

  const hotZones    = sorted.filter(e => e.opportunityScore >= 65);
  const totalVal    = entries.reduce((s, e) => s + e.totalValue, 0);
  const totalMatch  = matches.filter(m => !m.is_dismissed).length;

  const alerts = sorted.filter(e => e.legendaryMatches > 0 || e.opportunityScore >= 50);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-600 text-sm">
        Loading market intelligence…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{HEATMAP_CSS}</style>

      {/* ── Terminal header ── */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(239,68,68,0.15)', background: 'linear-gradient(160deg, rgba(239,68,68,0.04), rgba(2,6,23,0.98))' }}
      >
        <div className="hm-scan" />
        <div className="h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(239,68,68,0.6),transparent)' }} />

        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {['#ef4444', '#f59e0b', '#10b981'].map((c, i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c, opacity: 0.7 }} />
              ))}
            </div>
            <div>
              <div className="hm-flicker font-black text-xs text-white uppercase tracking-widest">
                District Intelligence · Heat Map Terminal
              </div>
              <div className="text-[9px] font-mono" style={{ color: 'rgba(239,68,68,0.5)' }}>
                LIVE PIPELINE · PORTUGAL MARKET · {entries.length} ZONES ACTIVE
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono" style={{ color: '#ef4444', animation: 'hmPulse 1.5s ease-in-out infinite' }}>● LIVE</span>
            <button
              onClick={load}
              disabled={refreshing}
              className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-600 text-slate-600 hover:text-slate-400 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Ticker */}
        <div className="border-t overflow-hidden h-7 flex items-center" style={{ borderColor: 'rgba(239,68,68,0.08)' }}>
          <div className="flex gap-8 whitespace-nowrap font-mono text-xs" style={{ animation: 'hmTicker 25s linear infinite' }}>
            {[...sorted, ...sorted].map((e, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span style={{ color: 'rgba(239,68,68,0.35)' }}>·</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-600">{e.districtName}</span>
                <span className="font-black" style={{ color: scoreColor(e.opportunityScore) }}>{e.opportunityScore}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Zones',  value: entries.length,    sub: 'with lead data',    icon: MapPin,     color: '#ef4444' },
          { label: 'Hot Zones',     value: hotZones.length,   sub: 'score ≥65',         icon: Flame,      color: '#f97316' },
          { label: 'Pipeline Value',value: fmtM(totalVal),    sub: 'owner assets',       icon: DollarSign, color: '#f59e0b' },
          { label: 'Total Matches', value: totalMatch,        sub: `${leads.length} leads`, icon: Activity, color: '#10b981' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div
            key={label}
            className="relative rounded-xl overflow-hidden p-4"
            style={{ border: `1px solid ${color}20`, background: `linear-gradient(160deg,${color}06,rgba(2,6,23,0.97))` }}
          >
            <div className="hm-scan" />
            <div className="flex items-start justify-between mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '18', border: `1px solid ${color}25` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: color + '80' }}>{label}</div>
            <div className="font-black text-2xl leading-none" style={{ color }}>{value}</div>
            <div className="text-[10px] text-slate-700 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── View controls ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-slate-900/50 border border-slate-800/50 rounded-xl p-1">
          {([
            { key: 'grid',   label: 'Heat Grid',   icon: BarChart2 },
            { key: 'rank',   label: 'Ranking',     icon: TrendingUp },
            { key: 'alerts', label: 'Alerts',      icon: Zap, badge: alerts.length },
          ] as { key: typeof view; label: string; icon: typeof BarChart2; badge?: number }[]).map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
              style={{
                backgroundColor: view === v.key ? 'rgba(239,68,68,0.12)' : 'transparent',
                color: view === v.key ? '#ef4444' : '#475569',
                border: view === v.key ? '1px solid rgba(239,68,68,0.25)' : '1px solid transparent',
              }}
            >
              <v.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
              {v.badge != null && v.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {Math.min(v.badge, 99)}
                </span>
              )}
            </button>
          ))}
        </div>

        {view === 'rank' && (
          <div className="flex gap-1 bg-slate-900/50 border border-slate-800/50 rounded-xl p-1">
            {(['score', 'value', 'matches', 'investors'] as typeof sortBy[]).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                style={{
                  backgroundColor: sortBy === s ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color: sortBy === s ? '#f59e0b' : '#475569',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {entries.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <MapPin className="w-12 h-12 text-slate-700 mx-auto" />
          <p className="text-slate-500 text-sm font-bold">No district data yet.</p>
          <p className="text-slate-700 text-xs">Add leads with locations in the Leads tab to see district intelligence here.</p>
        </div>
      )}

      {/* ── Heat grid view ── */}
      {view === 'grid' && entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {sorted.map((entry, i) => (
            <HeatCell
              key={entry.districtName}
              entry={entry}
              rank={i + 1}
              onClick={() => setSelectedEntry(entry)}
              selected={selectedEntry?.districtName === entry.districtName}
            />
          ))}
        </div>
      )}

      {/* ── Ranking view ── */}
      {view === 'rank' && entries.length > 0 && (
        <div className="space-y-1">
          {/* Header */}
          <div className="flex items-center gap-3 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-700">
            <span className="w-6">#</span>
            <span className="w-28">District</span>
            <span className="flex-1 hidden sm:block">Score Bar</span>
            <span className="text-right">Score</span>
          </div>
          {sorted.map((entry, i) => (
            <RankRow
              key={entry.districtName}
              entry={entry}
              rank={i + 1}
              prev={undefined}
              onClick={() => setSelectedEntry(entry)}
            />
          ))}
        </div>
      )}

      {/* ── Alerts view ── */}
      {view === 'alerts' && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-slate-600 text-sm">
              No high-priority opportunities yet. Add more leads to generate alerts.
            </div>
          ) : (
            <>
              {/* Legendary zones */}
              {alerts.filter(e => e.legendaryMatches > 0).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#f59e0b' }}>
                      Legendary Opportunity Zones
                    </span>
                  </div>
                  <div className="space-y-2">
                    {alerts.filter(e => e.legendaryMatches > 0).map((e, i) => (
                      <OpportunityAlert key={e.districtName} entry={e} index={i} onClick={() => setSelectedEntry(e)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Hot zones */}
              {alerts.filter(e => e.opportunityScore >= 65 && e.legendaryMatches === 0).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-3.5 h-3.5" style={{ color: '#f97316' }} />
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#f97316' }}>
                      Hot Zones
                    </span>
                  </div>
                  <div className="space-y-2">
                    {alerts.filter(e => e.opportunityScore >= 65 && e.legendaryMatches === 0).map((e, i) => (
                      <OpportunityAlert key={e.districtName} entry={e} index={i} onClick={() => setSelectedEntry(e)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Warm zones */}
              {alerts.filter(e => e.opportunityScore >= 50 && e.opportunityScore < 65).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#3b82f6' }}>
                      Warm Opportunities
                    </span>
                  </div>
                  <div className="space-y-2">
                    {alerts.filter(e => e.opportunityScore >= 50 && e.opportunityScore < 65).map((e, i) => (
                      <OpportunityAlert key={e.districtName} entry={e} index={i} onClick={() => setSelectedEntry(e)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── District detail drawer ── */}
      {selectedEntry && (
        <DistrictDetail
          entry={selectedEntry}
          leads={leads}
          matches={matches}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
