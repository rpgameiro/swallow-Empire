import { useState } from 'react';
import { RivalFirm, RivalEvent, RivalDistrictPresence, District } from '../types/game';
import {
  getThreatLevel, getRivalTypeLabel, EVENT_TYPE_META,
} from '../services/rivalEngine';
import {
  Swords, TrendingDown, AlertTriangle, Info, Star, Shield,
  Building2, ChevronDown, ChevronUp, Eye, Activity, Users, Zap,
} from 'lucide-react';

// ─── Threat meter ─────────────────────────────────────────────────────────────

function ThreatMeter({ score, color }: { score: number; color: string }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
      />
    </div>
  );
}

// ─── Rival detail card ────────────────────────────────────────────────────────

function RivalCard({
  rival,
  events,
  presence,
  districts,
  playerLevel,
}: {
  rival: RivalFirm;
  events: RivalEvent[];
  presence: RivalDistrictPresence[];
  districts: District[];
  playerLevel: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const threat = getThreatLevel(rival, playerLevel);
  const recentEvents = events.filter(e => e.rival_id === rival.id).slice(0, 5);
  const unread = recentEvents.filter(e => !e.is_read).length;
  const totalPresence = presence.filter(p => p.rival_id === rival.id);
  const districtsCovered = totalPresence.length;
  const avgShare = totalPresence.length
    ? (totalPresence.reduce((s, p) => s + p.market_share, 0) / totalPresence.length * 100).toFixed(0)
    : '0';

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all duration-200"
      style={{
        borderColor: rival.accent_color + '30',
        background: `linear-gradient(135deg, ${rival.accent_color}08, rgba(2,6,23,0.97))`,
      }}
    >
      {/* Top accent */}
      <div className="h-px w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${rival.accent_color}80, transparent)` }} />

      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Logo mark */}
          <div
            className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-sm"
            style={{
              background: `linear-gradient(135deg, ${rival.accent_color}30, ${rival.accent_color}15)`,
              border: `1.5px solid ${rival.accent_color}50`,
              color: rival.accent_color,
            }}
          >
            {rival.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-white font-black text-sm leading-tight truncate">{rival.name}</h3>
                <p className="text-xs mt-0.5 italic" style={{ color: rival.accent_color + '99' }}>
                  {rival.tagline}
                </p>
              </div>
              {unread > 0 && (
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center animate-pulse-glow-fast"
                  style={{ backgroundColor: rival.accent_color, color: '#000' }}
                >
                  {unread}
                </span>
              )}
            </div>

            {/* Type + founder */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className="text-[10px] font-black px-1.5 py-0.5 rounded"
                style={{ color: rival.accent_color, backgroundColor: rival.accent_color + '20', border: `1px solid ${rival.accent_color}35` }}
              >
                {getRivalTypeLabel(rival.type)}
              </span>
              <span className="text-[10px] text-slate-600">{rival.founder_name}</span>
            </div>

            {/* Threat level */}
            <div className="mt-2.5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Threat Level</span>
                <span className="font-black" style={{ color: threat.color }}>{threat.label}</span>
              </div>
              <ThreatMeter score={threat.score} color={threat.color} />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: 'Aggression', value: `${rival.aggression}/10`, icon: Swords, color: '#ef4444' },
            { label: 'Rep Score',  value: rival.reputation_score,    icon: Star,   color: '#f59e0b' },
            { label: 'Districts',  value: districtsCovered,           icon: Building2, color: '#06b6d4' },
            { label: 'Avg Share',  value: `${avgShare}%`,             icon: Activity, color: '#10b981' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label}
              className="bg-slate-900/40 border border-slate-800/50 rounded-lg p-2 text-center">
              <Icon className="w-3 h-3 mx-auto mb-1" style={{ color }} />
              <p className="font-black text-sm leading-none" style={{ color }}>{value}</p>
              <p className="text-slate-700 text-[9px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition-colors py-1"
        >
          <span>{expanded ? 'Less' : 'Intel & Activity'}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded intel */}
      {expanded && (
        <div className="border-t border-slate-800/50 p-4 space-y-4 bg-slate-950/40">
          {/* Bio */}
          <div>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Intelligence Brief</p>
            <p className="text-slate-400 text-xs leading-relaxed">{rival.bio}</p>
          </div>

          {/* Specialisation */}
          <div>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Specialisation</p>
            <p className="text-xs" style={{ color: rival.accent_color + 'cc' }}>{rival.specialisation}</p>
          </div>

          {/* District presence */}
          {totalPresence.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">District Presence</p>
              <div className="space-y-1.5">
                {totalPresence.map(p => {
                  const d = districts.find(x => x.id === p.district_id);
                  if (!d) return null;
                  const pct = Math.round(p.market_share * 100);
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-20 truncate flex-shrink-0">{d.name}</span>
                      <div className="flex-1 bg-slate-800/60 rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: rival.accent_color, boxShadow: `0 0 4px ${rival.accent_color}50` }}
                        />
                      </div>
                      <span className="text-[10px] font-black w-7 text-right flex-shrink-0" style={{ color: rival.accent_color }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent activity */}
          {recentEvents.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5">Recent Activity</p>
              <div className="space-y-1.5">
                {recentEvents.map(evt => {
                  const meta = EVENT_TYPE_META[evt.event_type];
                  return (
                    <div key={evt.id}
                      className="flex items-start gap-2 text-xs bg-slate-900/40 rounded-lg px-2.5 py-2 border border-slate-800/40">
                      <span className="text-base flex-shrink-0 leading-none mt-0.5">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-[11px] leading-tight">{evt.title}</p>
                        <p className="text-slate-600 text-[10px] mt-0.5">
                          {new Date(evt.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!evt.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-1 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Conflict timeline ────────────────────────────────────────────────────────

function ConflictTimeline({ events, rivals }: { events: RivalEvent[]; rivals: RivalFirm[] }) {
  const sorted = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8">
        <Shield className="w-8 h-8 text-slate-800 mx-auto mb-2" />
        <p className="text-slate-600 text-sm">No rival activity detected yet.</p>
        <p className="text-slate-700 text-xs mt-1">As you grow, rivals will begin to notice.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map(evt => {
        const rival = rivals.find(r => r.id === evt.rival_id);
        const meta = EVENT_TYPE_META[evt.event_type];
        const severityColor: Record<string, string> = {
          alert: '#ef4444', warning: '#f59e0b', info: '#3b82f6', opportunity: '#10b981',
        };
        const color = severityColor[evt.severity] ?? '#64748b';

        return (
          <div key={evt.id}
            className="flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-all"
            style={{
              borderColor: color + '25',
              backgroundColor: color + '06',
              opacity: evt.is_read ? 0.6 : 1,
            }}
          >
            {/* Timeline dot */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: color,
                  boxShadow: evt.is_read ? 'none' : `0 0 6px ${color}`,
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color }}>
                      {meta.icon} {meta.label}
                    </span>
                    {rival && (
                      <span className="text-[10px] text-slate-600 font-bold">{rival.name}</span>
                    )}
                  </div>
                  <p className="text-white font-bold text-xs leading-tight">{evt.title}</p>
                  <p className="text-slate-500 text-[10px] mt-0.5 leading-relaxed line-clamp-2">{evt.description}</p>
                </div>
                {!evt.is_read && (
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
                )}
              </div>

              {/* Impacts */}
              {(evt.impact_reputation !== 0 || evt.impact_money !== 0 || evt.impact_market_share !== 0) && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {evt.impact_reputation !== 0 && (
                    <span className={`text-[9px] font-black px-1 py-0.5 rounded ${evt.impact_reputation > 0 ? 'text-emerald-400 bg-emerald-950/50' : 'text-red-400 bg-red-950/50'}`}>
                      {evt.impact_reputation > 0 ? '+' : ''}{evt.impact_reputation} rep
                    </span>
                  )}
                  {evt.impact_money !== 0 && (
                    <span className={`text-[9px] font-black px-1 py-0.5 rounded ${evt.impact_money > 0 ? 'text-emerald-400 bg-emerald-950/50' : 'text-red-400 bg-red-950/50'}`}>
                      {evt.impact_money > 0 ? '+' : ''}€{Math.abs(evt.impact_money).toLocaleString()}
                    </span>
                  )}
                  {evt.impact_market_share !== 0 && (
                    <span className={`text-[9px] font-black px-1 py-0.5 rounded ${evt.impact_market_share > 0 ? 'text-emerald-400 bg-emerald-950/50' : 'text-amber-400 bg-amber-950/50'}`}>
                      {evt.impact_market_share > 0 ? '+' : ''}{(evt.impact_market_share * 100).toFixed(0)}% mkt
                    </span>
                  )}
                </div>
              )}

              <p className="text-slate-700 text-[9px] mt-1">
                {new Date(evt.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface RivalsPanelProps {
  rivals: RivalFirm[];
  rivalEvents: RivalEvent[];
  rivalPresence: Map<string, RivalDistrictPresence[]>;
  districts: District[];
  playerLevel: number;
}

type PanelTab = 'firms' | 'activity';

export const RivalsPanel = ({
  rivals, rivalEvents, rivalPresence, districts, playerLevel,
}: RivalsPanelProps) => {
  const [tab, setTab] = useState<PanelTab>('firms');

  // Flatten presence map to array
  const allPresence = Array.from(rivalPresence.values()).flat();

  const unreadCount = rivalEvents.filter(e => !e.is_read).length;
  const alertCount = rivalEvents.filter(e => e.severity === 'alert' && !e.is_read).length;

  // Sort rivals by threat score
  const sortedRivals = [...rivals].sort((a, b) => {
    const ta = getThreatLevel(a, playerLevel).score;
    const tb = getThreatLevel(b, playerLevel).score;
    return tb - ta;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Swords className="w-5 h-5 text-red-400" style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.5))' }} />
            Rival Intelligence
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {rivals.length} competing firms · {unreadCount} unread alerts
          </p>
        </div>
        {alertCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-black text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-2.5 py-1.5 animate-pulse-glow-fast">
            <AlertTriangle className="w-3.5 h-3.5" />
            {alertCount} critical
          </div>
        )}
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          {
            label: 'Active Rivals',
            value: rivals.filter(r => r.is_active).length,
            icon: Users,
            color: '#ef4444',
          },
          {
            label: 'Conflicts',
            value: rivalEvents.filter(e => ['territory_encroach','territory_takeover','deal_stolen'].includes(e.event_type)).length,
            icon: Swords,
            color: '#f97316',
          },
          {
            label: 'Lost Deals',
            value: rivalEvents.filter(e => e.event_type === 'deal_stolen').length,
            icon: TrendingDown,
            color: '#ef4444',
          },
          {
            label: 'Intel Items',
            value: rivalEvents.length,
            icon: Eye,
            color: '#06b6d4',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-3 text-center">
            <Icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color }} />
            <p className="font-black text-lg leading-none" style={{ color }}>{value}</p>
            <p className="text-slate-600 text-[10px] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex rounded-xl overflow-hidden border border-slate-800">
        {([
          { key: 'firms',    label: `Firms (${rivals.length})`,          icon: Building2 },
          { key: 'activity', label: `Activity${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: Activity },
        ] as { key: PanelTab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all"
            style={{
              backgroundColor: tab === key ? '#1e293b' : 'transparent',
              color: tab === key ? '#f59e0b' : '#475569',
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Firms tab */}
      {tab === 'firms' && (
        <div className="space-y-3">
          {sortedRivals.map(rival => (
            <RivalCard
              key={rival.id}
              rival={rival}
              events={rivalEvents.filter(e => e.rival_id === rival.id)}
              presence={allPresence.filter(p => p.rival_id === rival.id)}
              districts={districts}
              playerLevel={playerLevel}
            />
          ))}
        </div>
      )}

      {/* Activity tab */}
      {tab === 'activity' && (
        <ConflictTimeline events={rivalEvents} rivals={rivals} />
      )}
    </div>
  );
};
