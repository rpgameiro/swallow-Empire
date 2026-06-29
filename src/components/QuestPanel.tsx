import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DynamicQuest, timeRemaining } from '../services/questEngine';
import { District, OfficialQuest } from '../types/game';
import { Clock, Zap, Star, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, Shield, Crown, Flame, MapPin, TrendingUp, Lock, Briefcase, AlertCircle, ExternalLink, Archive, CreditCard as Edit3, MoreHorizontal } from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuestPanelProps {
  dynamicQuests: DynamicQuest[];
  officialQuests: OfficialQuest[];
  districts: District[];
  playerLevel: number;
  playerReputation: number;
  onComplete: (questId: string, districtId?: string) => void;
  onRefresh: () => void;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  daily:     { color: '#3b82f6', bg: 'from-blue-900/30',   border: 'border-blue-700/40',   label: 'Daily',     Icon: Zap,    ringColor: 'ring-blue-500/20' },
  weekly:    { color: '#a855f7', bg: 'from-purple-900/30', border: 'border-purple-700/40', label: 'Weekly',    Icon: Shield, ringColor: 'ring-purple-500/20' },
  main:      { color: '#f59e0b', bg: 'from-amber-900/30',  border: 'border-amber-700/40',  label: 'Main',      Icon: Crown,  ringColor: 'ring-amber-500/20' },
  legendary: { color: '#ef4444', bg: 'from-red-900/30',    border: 'border-red-700/40',    label: 'Legendary', Icon: Flame,  ringColor: 'ring-red-500/20' },
} as const;

type QuestType = keyof typeof TYPE_CONFIG;

const BONUS_LABELS: Record<string, string> = {
  district_xp:      '+Dist XP',
  market_share:     '+Mkt',
  stat_negotiation: '+Neg',
  stat_networking:  '+Net',
  stat_focus:       '+Focus',
  stat_discipline:  '+Disc',
  stat_leadership:  '+Lead',
  stat_reputation:  '+Rep',
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: '#ef4444', label: 'Critical' },
  high:     { color: '#f97316', label: 'High'     },
  medium:   { color: '#f59e0b', label: 'Medium'   },
  low:      { color: '#84cc16', label: 'Low'      },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'not started': { color: '#64748b', label: 'Not Started' },
  'in progress': { color: '#3b82f6', label: 'In Progress' },
  'done':        { color: '#22c55e', label: 'Done'        },
  'blocked':     { color: '#ef4444', label: 'Blocked'     },
};

// View tabs at the top of the panel
type ViewTab = 'active' | 'completed';

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(expiresAt: string | null) {
  const [timer, setTimer] = useState(() => timeRemaining(expiresAt));
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setTimer(timeRemaining(expiresAt)), 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return timer;
}

// ─── Transient highlight set ──────────────────────────────────────────────────

function useTransientSet(durationMs: number) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const add = useCallback((id: string) => {
    setIds(prev => new Set([...prev, id]));
    const t = setTimeout(() => {
      setIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      timers.current.delete(id);
    }, durationMs);
    timers.current.set(id, t);
  }, [durationMs]);

  return { ids, add };
}

// ─── Compact dynamic quest card ───────────────────────────────────────────────

function QuestCard({
  quest,
  districts,
  onComplete,
  justCompleted,
}: {
  quest: DynamicQuest;
  districts: District[];
  onComplete: (questId: string, districtId?: string) => void;
  justCompleted: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const cfg        = TYPE_CONFIG[quest.quest_type];
  const timer      = useCountdown(quest.expires_at);
  const district   = quest.district_id ? districts.find(d => d.id === quest.district_id) : null;
  const isCompleted = quest.status === 'completed';
  const isExpired   = quest.status === 'expired' || (timer.expired && quest.status === 'active');
  const isActive    = quest.status === 'active' && !timer.expired;
  const isAIMission = quest.source === 'ai_mission';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        relative rounded-xl border overflow-hidden transition-all duration-200 group
        ${isCompleted
          ? 'border-slate-700/25 bg-slate-900/30 opacity-55'
          : isExpired
            ? 'border-slate-800/40 bg-slate-900/20 opacity-40'
            : `${cfg.border} bg-gradient-to-br ${cfg.bg} to-slate-900 hover:border-opacity-70`
        }
        ${justCompleted ? 'ring-1 ring-emerald-500/40' : ''}
        ${isActive && quest.quest_type === 'legendary' ? `ring-1 ${cfg.ringColor}` : ''}
      `}
    >
      {/* Accent line */}
      {isActive && <div className="h-px" style={{ backgroundColor: cfg.color + '90' }} />}

      <div className="px-3.5 py-3">
        {/* ── Main row: icon · title · badges · timer · action ── */}
        <div className="flex items-center gap-2.5 min-w-0">

          {/* Type icon */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: cfg.color + '18', border: `1px solid ${cfg.color}35` }}
          >
            <cfg.Icon className="w-3.5 h-3.5" style={{ color: isCompleted ? '#475569' : cfg.color }} />
          </div>

          {/* Title + difficulty row */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className={`font-bold text-xs leading-tight truncate max-w-[220px] ${isCompleted ? 'text-slate-500 line-through' : 'text-white'}`}>
                {quest.title}
              </h4>
              {isAIMission && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-cyan-900/30 border border-cyan-700/30 text-cyan-500 flex-shrink-0">
                  AI
                </span>
              )}
            </div>
            {/* Rewards + district on second micro-row */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Stars */}
              <div className="flex items-center gap-px">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-[10px]" style={{ color: i < quest.difficulty ? cfg.color : '#1e293b' }}>★</span>
                ))}
              </div>

              {/* XP chip */}
              <span className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>
                {quest.xp_reward.toLocaleString()} XP
              </span>

              {quest.money_reward > 0 && (
                <span className="text-[10px] font-bold text-emerald-500">
                  €{quest.money_reward.toLocaleString()}
                </span>
              )}

              {quest.reputation_reward > 0 && (
                <span className="text-[10px] font-bold text-yellow-500">+{quest.reputation_reward} Rep</span>
              )}

              {quest.skill_point_reward > 0 && (
                <span className="text-[10px] font-bold text-emerald-400">+{quest.skill_point_reward} SP</span>
              )}

              {quest.bonus_reward_type && quest.bonus_reward_value > 0 && (
                <span className="text-[10px] font-bold" style={{ color: cfg.color }}>
                  {BONUS_LABELS[quest.bonus_reward_type] ?? quest.bonus_reward_type}
                </span>
              )}

              {district && (
                <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                  <MapPin className="w-2.5 h-2.5" />
                  {district.name}
                </span>
              )}
            </div>
          </div>

          {/* Right side: timer / status + action */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Timer */}
            {quest.expires_at && isActive && (
              <div className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                timer.urgent
                  ? 'bg-red-900/50 border border-red-700/50 text-red-300 animate-pulse'
                  : 'text-slate-500'
              }`}>
                <Clock className="w-2.5 h-2.5" />
                {timer.label}
              </div>
            )}

            {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            {isExpired && !isCompleted && <span className="text-[10px] text-slate-600">Expired</span>}

            {/* Complete button — always visible when active */}
            {isActive && (
              <button
                onClick={() => onComplete(quest.id, quest.district_id ?? undefined)}
                className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] text-white transition-all
                           hover:opacity-90 active:scale-95 whitespace-nowrap"
                style={{
                  background:  `linear-gradient(135deg, ${cfg.color}cc, ${cfg.color}88)`,
                  boxShadow:   `0 2px 8px ${cfg.color}20`,
                  letterSpacing: '0.01em',
                }}
              >
                Complete
              </button>
            )}
          </div>
        </div>

        {/* Hover quick actions overlay */}
        {hovered && isActive && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-800/60">
            <button
              onClick={() => onComplete(quest.id, quest.district_id ?? undefined)}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded
                         bg-emerald-900/25 border border-emerald-700/30 text-emerald-400
                         hover:bg-emerald-900/40 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              Complete
            </button>
            <button className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded
                               bg-slate-800/60 border border-slate-700/40 text-slate-400
                               hover:text-blue-400 hover:border-blue-700/30 transition-colors">
              <Edit3 className="w-3 h-3" />
              Edit
            </button>
            <button className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded
                               bg-slate-800/60 border border-slate-700/40 text-slate-400
                               hover:text-slate-300 transition-colors">
              <Archive className="w-3 h-3" />
              Archive
            </button>
            <button className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded
                               bg-slate-800/60 border border-slate-700/40 text-slate-400
                               hover:text-amber-400 hover:border-amber-700/30 transition-colors">
              <ExternalLink className="w-3 h-3" />
              Notion
            </button>
          </div>
        )}

        {justCompleted && (
          <div className="text-center text-[10px] text-emerald-400 font-bold animate-pulse mt-1.5">
            Rewards collected!
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compact official quest row ───────────────────────────────────────────────

function OfficialQuestRow({ quest }: { quest: OfficialQuest }) {
  const [hovered, setHovered] = useState(false);
  const isDone       = quest.completed || quest.status?.toLowerCase() === 'done';
  const priorityCfg  = PRIORITY_CONFIG[(quest.priority ?? '').toLowerCase()] ?? { color: '#f59e0b', label: quest.priority ?? '' };
  const statusCfg    = STATUS_CONFIG[(quest.status ?? '').toLowerCase()]     ?? { color: '#64748b', label: quest.status ?? 'Unknown' };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        rounded-lg border px-3 py-2 transition-all duration-150 group
        ${isDone
          ? 'border-slate-700/20 bg-slate-900/20 opacity-45'
          : 'border-amber-700/30 bg-amber-900/10 hover:bg-amber-900/20 hover:border-amber-600/40'
        }
      `}
    >
      {/* Single information row */}
      <div className="flex items-center gap-2.5 min-w-0">

        {/* Icon */}
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-amber-500/12 border border-amber-500/25">
          <Briefcase className="w-3 h-3" style={{ color: isDone ? '#475569' : '#f59e0b' }} />
        </div>

        {/* Title */}
        <span className={`flex-1 text-xs font-semibold truncate ${isDone ? 'text-slate-500 line-through' : 'text-white'}`}>
          {quest.title}
        </span>

        {/* Meta chips — in a single right-aligned row */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* XP */}
          <span className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>
            {quest.xp.toLocaleString()} XP
          </span>

          {/* Priority */}
          {quest.priority && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: priorityCfg.color + '18', color: priorityCfg.color, border: `1px solid ${priorityCfg.color}30` }}
            >
              {priorityCfg.label}
            </span>
          )}

          {/* Difficulty */}
          {quest.difficulty && (
            <span className="text-[10px] text-slate-500 font-mono">{quest.difficulty}</span>
          )}

          {/* Impact */}
          {quest.impact && (
            <span className="text-[10px] font-bold text-orange-400 hidden sm:inline">{quest.impact}</span>
          )}

          {/* Status */}
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: statusCfg.color + '18', color: statusCfg.color, border: `1px solid ${statusCfg.color}30` }}
          >
            {statusCfg.label}
          </span>

          {/* Deadline */}
          {quest.deadline && !isDone && (
            <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {quest.deadline}
            </span>
          )}

          {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
        </div>
      </div>

      {/* Hover quick actions */}
      {hovered && !isDone && (
        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-amber-700/20">
          <button className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded
                             bg-slate-800/60 border border-slate-700/40 text-slate-400
                             hover:text-amber-400 hover:border-amber-700/30 transition-colors">
            <ExternalLink className="w-3 h-3" />
            Open in Notion
          </button>
          {quest.reward && (
            <span className="text-[10px] text-amber-600/70 truncate">
              Reward: {quest.reward}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible section wrapper ──────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  color,
  activeCount,
  doneCount,
  defaultOpen,
  children,
}: {
  title: string;
  icon: typeof Crown;
  color: string;
  activeCount: number;
  doneCount: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/40">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5
                   bg-slate-800/50 hover:bg-slate-700/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ backgroundColor: color + '20', border: `1px solid ${color}40` }}
          >
            <Icon className="w-3 h-3" style={{ color }} />
          </div>
          <span className="font-bold text-sm text-white">{title}</span>
          <div className="flex items-center gap-1">
            {activeCount > 0 && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: color + '20', color }}
              >
                {activeCount}
              </span>
            )}
            {doneCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-900/30 text-emerald-500">
                {doneCount}✓
              </span>
            )}
          </div>
        </div>
        <div className="text-slate-500 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? '9999px' : '0px' }}
      >
        <div className="bg-slate-900/40 px-3 py-2.5 space-y-2">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Completed quest row (dimmed compact list) ────────────────────────────────

function CompletedQuestRow({ quest, districts }: { quest: DynamicQuest; districts: District[] }) {
  const cfg      = TYPE_CONFIG[quest.quest_type];
  const district = quest.district_id ? districts.find(d => d.id === quest.district_id) : null;
  const completedDate = quest.completed_at
    ? new Date(quest.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-800/40 bg-slate-900/20 opacity-60 hover:opacity-75 transition-opacity">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
      <div
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: cfg.color + '15' }}
      >
        <cfg.Icon className="w-2.5 h-2.5" style={{ color: cfg.color + '80' }} />
      </div>
      <span className="flex-1 text-xs text-slate-500 line-through truncate">{quest.title}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] text-slate-600">{quest.xp_reward.toLocaleString()} XP</span>
        {district && <span className="text-[10px] text-slate-700">{district.name}</span>}
        {completedDate && (
          <span className="text-[10px] text-slate-600">{completedDate}</span>
        )}
      </div>
    </div>
  );
}

// ─── Quest type filter pill strip (sticky) ────────────────────────────────────

function TypeFilter({
  activeType,
  onSelect,
  counts,
}: {
  activeType: QuestType | 'all';
  onSelect: (t: QuestType | 'all') => void;
  counts: Record<QuestType, number>;
}) {
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const types: (QuestType | 'all')[] = ['all', 'daily', 'weekly', 'main', 'legendary'];

  return (
    <div className="flex gap-1 overflow-x-auto pb-0.5 sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm py-1.5 -mx-0.5 px-0.5">
      {types.map(t => {
        const isActive = activeType === t;
        const cfg   = t === 'all' ? null : TYPE_CONFIG[t];
        const count = t === 'all' ? allCount : counts[t];
        const Icon  = cfg?.Icon ?? MoreHorizontal;
        const color = cfg?.color ?? '#64748b';

        return (
          <button
            key={t}
            onClick={() => onSelect(t)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold
              whitespace-nowrap transition-all flex-shrink-0
              ${isActive
                ? 'text-white'
                : 'bg-slate-800/50 border border-slate-700/40 text-slate-500 hover:text-slate-300'
              }
            `}
            style={isActive
              ? { backgroundColor: color + '25', border: `1px solid ${color}45`, color }
              : {}
            }
          >
            <Icon className="w-3 h-3" />
            {t === 'all' ? 'All' : cfg!.label}
            {count > 0 && (
              <span
                className="text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full"
                style={{
                  backgroundColor: isActive ? color : '#334155',
                  color: isActive ? '#fff' : '#94a3b8',
                  fontSize: '9px',
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export const QuestPanel = ({
  dynamicQuests,
  officialQuests,
  districts,
  playerLevel,
  playerReputation,
  onComplete,
  onRefresh,
}: QuestPanelProps) => {
  const [viewTab,    setViewTab]    = useState<ViewTab>('active');
  const [typeFilter, setTypeFilter] = useState<QuestType | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const { ids: justCompletedIds, add: markCompleted } = useTransientSet(3000);

  // Refresh with visual feedback
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    refreshTimerRef.current = setTimeout(() => setRefreshing(false), 1000);
  };

  const handleComplete = (questId: string, districtId?: string) => {
    markCompleted(questId);
    onComplete(questId, districtId);
  };

  // ── Partitions ──────────────────────────────────────────────────────────────

  const { activeQuests, completedQuests, expiredQuests } = useMemo(() => {
    const active: DynamicQuest[]    = [];
    const completed: DynamicQuest[] = [];
    const expired: DynamicQuest[]   = [];
    for (const q of dynamicQuests) {
      if (q.status === 'completed')     completed.push(q);
      else if (q.status === 'expired')  expired.push(q);
      else                              active.push(q);
    }
    // Sort completed by most recent first
    completed.sort((a, b) =>
      (b.completed_at ?? b.generated_at).localeCompare(a.completed_at ?? a.generated_at)
    );
    return { activeQuests: active, completedQuests: completed, expiredQuests: expired };
  }, [dynamicQuests]);

  // Active counts per type for filter badges
  const activeTypeCounts = useMemo(() => ({
    daily:     activeQuests.filter(q => q.quest_type === 'daily').length,
    weekly:    activeQuests.filter(q => q.quest_type === 'weekly').length,
    main:      activeQuests.filter(q => q.quest_type === 'main').length,
    legendary: activeQuests.filter(q => q.quest_type === 'legendary').length,
  }), [activeQuests]);

  // Filtered active quests for the "Active" view
  const filteredActive = useMemo(() =>
    typeFilter === 'all'
      ? activeQuests
      : activeQuests.filter(q => q.quest_type === typeFilter),
    [activeQuests, typeFilter],
  );

  // Group filtered active by type for collapsible sections
  const activeByType = useMemo(() => {
    const map: Partial<Record<QuestType, DynamicQuest[]>> = {};
    for (const q of filteredActive) {
      (map[q.quest_type] ??= []).push(q);
    }
    return map;
  }, [filteredActive]);

  const totalActive    = activeQuests.length;
  const totalCompleted = completedQuests.length;
  const officialActive = officialQuests.filter(q => !q.completed).length;
  const officialDone   = officialQuests.filter(q => q.completed).length;

  return (
    <div className="space-y-3">

      {/* ── Panel header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight leading-none">Quest Board</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {totalActive} active · {totalCompleted} completed
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-400
                     px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 border border-transparent
                     hover:border-slate-700/40 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── View tabs: Active / Completed ──────────────────────────────── */}
      <div className="flex gap-1 bg-slate-800/40 p-1 rounded-xl">
        {([
          { key: 'active' as ViewTab,    label: 'Active',    count: totalActive    },
          { key: 'completed' as ViewTab, label: 'Completed', count: totalCompleted },
        ]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setViewTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              viewTab === key
                ? 'bg-slate-700/70 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                viewTab === key ? 'bg-amber-500/25 text-amber-300' : 'bg-slate-700 text-slate-500'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ACTIVE view
         ══════════════════════════════════════════════════════════════════ */}
      {viewTab === 'active' && (
        <div className="space-y-3">

          {/* ── Official Empire Quests (collapsible) ── */}
          <CollapsibleSection
            title="Official Empire Quests"
            icon={Crown}
            color="#f59e0b"
            activeCount={officialActive}
            doneCount={officialDone}
            defaultOpen
          >
            {officialQuests.length === 0 ? (
              <div className="flex items-center gap-2.5 py-3 text-slate-500 text-xs">
                <div className="w-8 h-8 bg-amber-900/15 rounded-full flex items-center justify-center border border-amber-700/25">
                  <Crown className="w-4 h-4 text-amber-800" />
                </div>
                No official quests synced yet. Connect Notion to begin.
              </div>
            ) : (
              officialQuests.map(q => <OfficialQuestRow key={q.id} quest={q} />)
            )}
          </CollapsibleSection>

          {/* ── Type filter strip (sticky) ── */}
          <TypeFilter
            activeType={typeFilter}
            onSelect={setTypeFilter}
            counts={activeTypeCounts}
          />

          {/* ── Dynamic quest sections by type ── */}
          {filteredActive.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700/50">
                {typeFilter === 'all'
                  ? <Crown className="w-5 h-5 text-slate-600" />
                  : (() => { const cfg = TYPE_CONFIG[typeFilter]; return <cfg.Icon className="w-5 h-5 text-slate-600" />; })()
                }
              </div>
              <p className="text-slate-500 text-sm">No active quests in this category.</p>
              <button onClick={handleRefresh} className="text-xs text-amber-500 hover:text-amber-400 underline">
                Generate new quests
              </button>
            </div>
          ) : (
            /* Render one CollapsibleSection per type that has quests */
            (Object.entries(activeByType) as [QuestType, DynamicQuest[]][])
              .sort(([a], [b]) => {
                const order: QuestType[] = ['legendary', 'main', 'weekly', 'daily'];
                return order.indexOf(a) - order.indexOf(b);
              })
              .map(([type, quests]) => {
                const cfg       = TYPE_CONFIG[type];
                const active    = quests.filter(q => q.status === 'active');
                const completed = quests.filter(q => q.status === 'completed');
                return (
                  <CollapsibleSection
                    key={type}
                    title={`${cfg.label} Quests`}
                    icon={cfg.Icon}
                    color={cfg.color}
                    activeCount={active.length}
                    doneCount={completed.length}
                    defaultOpen={type === 'daily' || type === 'legendary'}
                  >
                    {quests.map(q => (
                      <QuestCard
                        key={q.id}
                        quest={q}
                        districts={districts}
                        onComplete={handleComplete}
                        justCompleted={justCompletedIds.has(q.id)}
                      />
                    ))}
                  </CollapsibleSection>
                );
              })
          )}

          {/* Expired quests — subtle at the bottom */}
          {expiredQuests.length > 0 && (
            <CollapsibleSection
              title="Expired"
              icon={Clock}
              color="#475569"
              activeCount={0}
              doneCount={expiredQuests.length}
              defaultOpen={false}
            >
              {expiredQuests.map(q => (
                <QuestCard
                  key={q.id}
                  quest={q}
                  districts={districts}
                  onComplete={handleComplete}
                  justCompleted={false}
                />
              ))}
            </CollapsibleSection>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          COMPLETED view
         ══════════════════════════════════════════════════════════════════ */}
      {viewTab === 'completed' && (
        <div className="space-y-2">
          {completedQuests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700/50">
                <CheckCircle2 className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-slate-500 text-sm">No completed quests yet.</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest px-1">
                {completedQuests.length} completed — sorted by most recent
              </p>
              {completedQuests.map(q => (
                <CompletedQuestRow key={q.id} quest={q} districts={districts} />
              ))}
            </>
          )}
        </div>
      )}

    </div>
  );
};
