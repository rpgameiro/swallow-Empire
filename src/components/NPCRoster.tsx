import { useState } from 'react';
import { NPC, PlayerNPCRelationship, RelationshipStatus } from '../types/game';
import {
  statusColor, statusLabel, NPC_TYPE_LABELS, NPC_TYPE_COLORS,
  PERSONALITY_LABELS, getUnlockedNPCs,
} from '../services/npcService';
import { Users, Lock, ChevronRight, MessageCircle, Star, TrendingUp } from 'lucide-react';

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const TYPE_FILTERS = ['all', 'investor', 'owner', 'broker', 'developer', 'operator', 'competitor'] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

// ─── NPC card ─────────────────────────────────────────────────────────────────

function NPCCard({
  npc,
  relationship,
  onTalk,
  locked,
}: {
  npc: NPC;
  relationship: PlayerNPCRelationship | undefined;
  onTalk: () => void;
  locked: boolean;
}) {
  const trust = relationship?.trust_level ?? npc.base_trust;
  const status: RelationshipStatus = relationship?.relationship_status ?? 'stranger';
  const sColor = statusColor[status];
  const typeColor = NPC_TYPE_COLORS[npc.type] ?? npc.accent_color;

  return (
    <div
      className="relative rounded-xl border transition-all duration-200 overflow-hidden group"
      style={{
        borderColor: locked ? '#1e293b' : npc.accent_color + '30',
        background: locked
          ? 'rgba(2,6,23,0.6)'
          : `linear-gradient(135deg, ${npc.accent_color}0a, rgba(2,6,23,0.95))`,
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px transition-opacity duration-200"
        style={{
          background: `linear-gradient(90deg, transparent, ${npc.accent_color}, transparent)`,
          opacity: locked ? 0.2 : 0.7,
        }}
      />

      {locked ? (
        /* Locked state */
        <div className="p-4 flex items-center gap-3 opacity-40">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <p className="text-slate-600 font-bold text-sm">{npc.name}</p>
            <p className="text-slate-700 text-xs">Requires Level {npc.min_player_level}</p>
          </div>
        </div>
      ) : (
        /* Unlocked state */
        <button
          onClick={onTalk}
          className="w-full text-left p-4 group/btn"
        >
          {/* Hover overlay */}
          <div className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity"
            style={{ background: `linear-gradient(135deg, ${npc.accent_color}10, transparent)` }} />

          <div className="relative flex items-start gap-3">
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-sm"
              style={{
                background: `linear-gradient(135deg, ${npc.accent_color}30, ${npc.accent_color}15)`,
                border: `1.5px solid ${npc.accent_color}50`,
                color: npc.accent_color,
                boxShadow: `0 0 12px ${npc.accent_color}20`,
              }}
            >
              {npc.avatar_initials}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm leading-tight truncate">{npc.name}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: npc.accent_color + 'aa' }}>
                    {npc.title}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover/btn:text-slate-400 transition-colors flex-shrink-0 mt-0.5" />
              </div>

              {/* Type + district */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span
                  className="text-[9px] font-black px-1.5 py-0.5 rounded"
                  style={{ color: typeColor, backgroundColor: typeColor + '18', border: `1px solid ${typeColor}30` }}
                >
                  {NPC_TYPE_LABELS[npc.type]}
                </span>
                <span className="text-[9px] text-slate-600">{npc.district_name}</span>
              </div>

              {/* Trust mini-bar */}
              <div className="mt-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black" style={{ color: sColor }}>
                    {statusLabel[status]}
                  </span>
                  <span className="text-[10px] text-slate-600 tabular-nums">{trust}/100</span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${trust}%`,
                      backgroundColor: sColor,
                      boxShadow: `0 0 4px ${sColor}60`,
                    }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 mt-2.5 text-[10px] text-slate-700">
                {relationship && relationship.interaction_count > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-2.5 h-2.5" />
                    {relationship.interaction_count}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Star className="w-2.5 h-2.5" />
                  {PERSONALITY_LABELS[npc.personality as keyof typeof PERSONALITY_LABELS]}
                </span>
              </div>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface NPCRosterProps {
  npcs: NPC[];
  relationships: Map<string, PlayerNPCRelationship>;
  playerLevel: number;
  onTalkTo: (npc: NPC) => void;
}

export const NPCRoster = ({ npcs, relationships, playerLevel, onTalkTo }: NPCRosterProps) => {
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');

  const unlocked = getUnlockedNPCs(npcs, playerLevel);
  const unlockedIds = new Set(unlocked.map(n => n.id));

  const visible = npcs.filter(n => {
    if (filter !== 'all' && n.type !== filter) return false;
    if (search && !n.name.toLowerCase().includes(search.toLowerCase()) &&
        !n.district_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Sort: unlocked first, then by trust desc
  visible.sort((a, b) => {
    const aLocked = !unlockedIds.has(a.id);
    const bLocked = !unlockedIds.has(b.id);
    if (aLocked !== bLocked) return aLocked ? 1 : -1;
    const aTrust = relationships.get(a.id)?.trust_level ?? a.base_trust;
    const bTrust = relationships.get(b.id)?.trust_level ?? b.base_trust;
    return bTrust - aTrust;
  });

  const ally = Array.from(relationships.values()).filter(r =>
    r.relationship_status === 'ally' || r.relationship_status === 'partner'
  ).length;

  const activeContacts = unlocked.filter(n => relationships.has(n.id)).length;

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Contacts', value: activeContacts, color: '#06b6d4', icon: Users },
          { label: 'Allies',   value: ally,            color: '#10b981', icon: Star },
          { label: 'Unlocked', value: unlocked.length, color: '#f59e0b', icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label}
            className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-3 text-center">
            <Icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color }} />
            <p className="font-black text-lg leading-none" style={{ color }}>{value}</p>
            <p className="text-slate-600 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or district…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-amber-800/60 transition-colors"
      />

      {/* Type filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TYPE_FILTERS.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className="flex-shrink-0 text-[10px] font-black px-2.5 py-1.5 rounded-lg border transition-all"
            style={{
              borderColor: filter === t ? (NPC_TYPE_COLORS[t] ?? '#f59e0b') + '60' : '#334155',
              backgroundColor: filter === t ? (NPC_TYPE_COLORS[t] ?? '#f59e0b') + '18' : 'transparent',
              color: filter === t ? (NPC_TYPE_COLORS[t] ?? '#f59e0b') : '#64748b',
            }}
          >
            {t === 'all' ? 'All' : NPC_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* NPC grid */}
      <div className="space-y-2">
        {visible.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-sm">No contacts match your filter.</div>
        )}
        {visible.map(npc => (
          <NPCCard
            key={npc.id}
            npc={npc}
            relationship={relationships.get(npc.id)}
            onTalk={() => onTalkTo(npc)}
            locked={!unlockedIds.has(npc.id)}
          />
        ))}
      </div>
    </div>
  );
};
