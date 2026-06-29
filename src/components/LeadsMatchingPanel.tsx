import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Zap, Star, TrendingUp, MapPin, Building2, DollarSign,
  ChevronDown, ChevronUp, X, Check, RefreshCw, Crown, Flame,
  ArrowRight, AlertTriangle,
  UserCheck, UserPlus, Filter,
} from 'lucide-react';
import {
  Lead, LeadMatch, MatchTier, MATCH_TIER_META,
  ASSET_TYPE_OPTIONS, LOCATION_OPTIONS,
  LeadTipo, LeadUrgency, LeadSource, District,
} from '../types/game';
import {
  getLeads, createLead, updateLead, deleteLead,
  getLeadMatches, saveLeadMatch, dismissMatch, actionMatch,
  computeAllMatches, MATCH_XP, ComputedMatch,
} from '../services/matchingEngine';
import { insertDynamicQuests, generateMatchQuests, DynamicQuest } from '../services/questEngine';

// ─── CSS injected once ────────────────────────────────────────────────────────

const PANEL_CSS = `
  @keyframes matchReveal {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes matchGlow {
    0%,100% { box-shadow: 0 0 20px var(--glow); }
    50%     { box-shadow: 0 0 40px var(--glow), 0 0 60px var(--glow-far); }
  }
  @keyframes matchScanLine {
    from { top: -2px; opacity: 0.5; }
    to   { top: 100%; opacity: 0; }
  }
  @keyframes matchBadgePop {
    0%  { transform: scale(0); }
    70% { transform: scale(1.15); }
    100%{ transform: scale(1); }
  }
  @keyframes matchScoreCount {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes matchPulse {
    0%,100% { opacity: 1; }
    50%     { opacity: 0.5; }
  }
  .match-card { animation: matchReveal 0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .match-glow { animation: matchGlow 3s ease-in-out infinite; }
  .match-scan {
    position: absolute; left: 0; right: 0; height: 1.5px;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent);
    animation: matchScanLine 4s linear infinite;
    pointer-events: none;
  }
  .match-badge { animation: matchBadgePop 0.5s cubic-bezier(0.22,1,0.36,1) both; }
  .match-score { animation: matchScoreCount 0.3s ease-out both; }
  .lead-form-input {
    width: 100%;
    background: rgba(15,23,42,0.8);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    color: white;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s;
  }
  .lead-form-input:focus { border-color: rgba(245,158,11,0.5); }
  .lead-form-input::placeholder { color: #475569; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}k`;
  return `€${n}`;
}

const URGENCY_META: Record<LeadUrgency, { label: string; color: string }> = {
  urgent: { label: 'Urgent',  color: '#ef4444' },
  high:   { label: 'High',    color: '#f97316' },
  medium: { label: 'Medium',  color: '#f59e0b' },
  low:    { label: 'Low',     color: '#3b82f6' },
};

const SOURCE_META: Record<LeadSource, { label: string; icon: typeof Users }> = {
  manual:   { label: 'Manual',   icon: UserPlus },
  referral: { label: 'Referral', icon: UserCheck },
  event:    { label: 'Event',    icon: Star },
  inbound:  { label: 'Inbound',  icon: TrendingUp },
};

// ─── Tier icon ────────────────────────────────────────────────────────────────

function TierIcon({ tier, size = 'md' }: { tier: MatchTier; size?: 'sm' | 'md' | 'lg' }) {
  const meta = MATCH_TIER_META[tier];
  const icons: Record<MatchTier, typeof Crown> = {
    legendary: Crown, strong: Flame, warm: Star, low: AlertTriangle,
    budget_mismatch: AlertTriangle, incomplete_data: AlertTriangle,
  };
  const Icon = icons[tier];
  const sz = size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  return <Icon className={sz} style={{ color: meta.color }} />;
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, tier }: { score: number; tier: MatchTier }) {
  const meta = MATCH_TIER_META[tier];
  const r = 22, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
      <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={meta.color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 4px ${meta.color}80)`, transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center match-score">
        <span className="font-black text-base leading-none" style={{ color: meta.color }}>{score}</span>
        <span className="text-[8px] text-slate-600 font-bold uppercase tracking-wide">score</span>
      </div>
    </div>
  );
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({
  match, investorLead, ownerLead, index, onDismiss, onAction,
}: {
  match: LeadMatch;
  investorLead: Lead | undefined;
  ownerLead: Lead | undefined;
  index: number;
  onDismiss: () => void;
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = MATCH_TIER_META[match.match_tier];

  return (
    <div
      className={`match-card relative rounded-xl border overflow-hidden ${match.match_tier === 'legendary' ? 'match-glow' : ''}`}
      style={{
        '--glow': meta.glow,
        '--glow-far': meta.glow.replace('0.4', '0.15'),
        borderColor: meta.color + (match.match_tier === 'legendary' ? '50' : '25'),
        background: `linear-gradient(135deg, ${meta.bg}, rgba(2,6,23,0.97))`,
        animationDelay: `${index * 0.07}s`,
      } as React.CSSProperties}
    >
      <div className="match-scan" />

      {/* Top accent line */}
      <div className="h-px" style={{ background: `linear-gradient(90deg,transparent,${meta.color}80,transparent)` }} />

      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <ScoreRing score={match.match_score} tier={match.match_tier} />

          <div className="flex-1 min-w-0">
            {/* Tier badge + opportunity type */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="match-badge inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest"
                style={{ color: meta.color, backgroundColor: meta.color + '18', border: `1px solid ${meta.color}30` }}
              >
                <TierIcon tier={match.match_tier} size="sm" />
                {meta.badge}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">{match.opportunity_type}</span>
              {match.is_actioned && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ color: '#10b981', backgroundColor: '#10b98118' }}>
                  ACTIONED
                </span>
              )}
            </div>

            {/* Lead names */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-white text-sm">
                {investorLead?.name ?? 'Unknown Investor'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              <span className="font-black text-white text-sm">
                {ownerLead?.name ?? 'Unknown Owner'}
              </span>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {investorLead?.investment_max ? (
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  {fmtMoney(investorLead.investment_min)}–{fmtMoney(investorLead.investment_max)}
                </span>
              ) : null}
              {ownerLead?.estimated_value ? (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {fmtMoney(ownerLead.estimated_value)}
                </span>
              ) : null}
              {match.xp_awarded > 0 && (
                <span className="text-[10px] flex items-center gap-0.5" style={{ color: '#f59e0b' }}>
                  <Zap className="w-3 h-3" />
                  +{match.xp_awarded} XP
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 transition-all"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg border border-slate-800 hover:border-red-900 text-slate-600 hover:text-red-400 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor: meta.color + '18' }}>

          {/* Budget mismatch / incomplete data banner */}
          {(match.match_tier === 'budget_mismatch' || match.match_tier === 'incomplete_data') && (
            <div className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: `${meta.color}10`, border: `1px solid ${meta.color}30` }}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: meta.color }} />
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: meta.color }}>
                  {meta.label}
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: `${meta.color}cc` }}>
                  {match.match_reasons[0]}
                </p>
              </div>
            </div>
          )}

          {/* Match reasons */}
          <div>
            <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1.5">
              {match.match_tier === 'budget_mismatch' || match.match_tier === 'incomplete_data'
                ? 'Other Signals'
                : 'Match Signals'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {match.match_reasons
                .slice(match.match_tier === 'budget_mismatch' || match.match_tier === 'incomplete_data' ? 1 : 0)
                .map((r, i) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded-lg"
                    style={{ backgroundColor: meta.color + '10', color: meta.color + 'cc', border: `1px solid ${meta.color}20` }}>
                    {r}
                  </span>
                ))}
              {match.match_reasons.slice(
                match.match_tier === 'budget_mismatch' || match.match_tier === 'incomplete_data' ? 1 : 0
              ).length === 0 && (
                <span className="text-[10px] text-slate-600 italic">No additional signals</span>
              )}
            </div>
          </div>

          {/* Suggested action */}
          <div className="rounded-xl p-3" style={{ backgroundColor: meta.color + '08', border: `1px solid ${meta.color}18` }}>
            <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Suggested Action</div>
            <p className="text-xs text-slate-300 leading-relaxed">{match.suggested_action}</p>
          </div>

          {/* Lead detail mini cards */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { lead: investorLead, tipo: 'Investidor' as LeadTipo, accentColor: '#3b82f6' },
              { lead: ownerLead,   tipo: 'Proprietário' as LeadTipo, accentColor: '#10b981' },
            ].map(({ lead, tipo, accentColor }) => lead && (
              <div
                key={tipo}
                className="rounded-lg p-2.5"
                style={{ backgroundColor: accentColor + '08', border: `1px solid ${accentColor}18` }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  {tipo === 'Investidor'
                    ? <DollarSign className="w-3 h-3" style={{ color: accentColor }} />
                    : <Building2 className="w-3 h-3" style={{ color: accentColor }} />
                  }
                  <span className="text-[9px] font-black uppercase tracking-wide" style={{ color: accentColor }}>{tipo}</span>
                </div>
                <div className="font-bold text-xs text-white truncate">{lead.name}</div>
                {lead.company && <div className="text-[10px] text-slate-600 truncate">{lead.company}</div>}
                {lead.locations.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="w-2.5 h-2.5 text-slate-600" />
                    <span className="text-[9px] text-slate-500">{lead.locations.slice(0, 2).join(', ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action button */}
          {!match.is_actioned && (
            <button
              onClick={onAction}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
              style={{
                backgroundColor: meta.color + '18',
                border: `1px solid ${meta.color}50`,
                color: meta.color,
                boxShadow: `0 0 12px ${meta.glow}`,
              }}
            >
              <Check className="w-3.5 h-3.5" />
              Mark as Actioned
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Lead form ────────────────────────────────────────────────────────────────

interface LeadFormData {
  tipo: LeadTipo;
  name: string;
  company: string;
  email: string;
  phone: string;
  locations: string[];
  asset_types: string[];
  investment_min: string;
  investment_max: string;
  estimated_value: string;
  urgency: LeadUrgency;
  source: LeadSource;
  notes: string;
}

const BLANK_FORM: LeadFormData = {
  tipo: 'Investidor', name: '', company: '', email: '', phone: '',
  locations: [], asset_types: [], investment_min: '', investment_max: '',
  estimated_value: '', urgency: 'medium', source: 'manual', notes: '',
};

function LeadForm({
  initial, onSave, onCancel,
}: {
  initial?: LeadFormData;
  onSave: (data: LeadFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<LeadFormData>(initial ?? BLANK_FORM);

  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const f = <K extends keyof LeadFormData>(k: K, v: LeadFormData[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Tipo toggle */}
      <div className="flex gap-2">
        {(['Investidor', 'Proprietário'] as LeadTipo[]).map(t => (
          <button
            key={t}
            onClick={() => f('tipo', t)}
            className="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest border transition-all"
            style={{
              backgroundColor: form.tipo === t
                ? (t === 'Investidor' ? '#3b82f620' : '#10b98120')
                : 'transparent',
              borderColor: form.tipo === t
                ? (t === 'Investidor' ? '#3b82f650' : '#10b98150')
                : 'rgba(255,255,255,0.07)',
              color: form.tipo === t
                ? (t === 'Investidor' ? '#3b82f6' : '#10b981')
                : '#475569',
            }}
          >
            {t === 'Investidor' ? <DollarSign className="w-4 h-4 inline mr-1.5" /> : <Building2 className="w-4 h-4 inline mr-1.5" />}
            {t}
          </button>
        ))}
      </div>

      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Name *</label>
          <input className="lead-form-input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Company</label>
          <input className="lead-form-input" value={form.company} onChange={e => f('company', e.target.value)} placeholder="Company / fund" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Phone</label>
          <input className="lead-form-input" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+351 …" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Email</label>
          <input className="lead-form-input" value={form.email} onChange={e => f('email', e.target.value)} placeholder="email@example.com" />
        </div>
      </div>

      {/* Financial */}
      <div className="grid grid-cols-3 gap-3">
        {form.tipo === 'Investidor' ? (
          <>
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Min Budget</label>
              <input className="lead-form-input" value={form.investment_min} onChange={e => f('investment_min', e.target.value)} placeholder="€500k" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Max Budget</label>
              <input className="lead-form-input" value={form.investment_max} onChange={e => f('investment_max', e.target.value)} placeholder="€5M" />
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Estimated Value</label>
            <input className="lead-form-input" value={form.estimated_value} onChange={e => f('estimated_value', e.target.value)} placeholder="€2.5M" />
          </div>
        )}
        <div>
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Urgency</label>
          <select
            className="lead-form-input"
            value={form.urgency}
            onChange={e => f('urgency', e.target.value as LeadUrgency)}
          >
            {(['urgent', 'high', 'medium', 'low'] as LeadUrgency[]).map(u => (
              <option key={u} value={u}>{URGENCY_META[u].label}</option>
            ))}
          </select>
        </div>
        <div className={form.tipo === 'Proprietário' ? '' : ''}>
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Source</label>
          <select
            className="lead-form-input"
            value={form.source}
            onChange={e => f('source', e.target.value as LeadSource)}
          >
            {(['manual', 'referral', 'event', 'inbound'] as LeadSource[]).map(s => (
              <option key={s} value={s}>{SOURCE_META[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Locations */}
      <div>
        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">Locations</label>
        <div className="flex flex-wrap gap-1.5">
          {LOCATION_OPTIONS.map(loc => (
            <button
              key={loc}
              onClick={() => f('locations', toggle(form.locations, loc))}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all"
              style={{
                backgroundColor: form.locations.includes(loc) ? '#f59e0b18' : 'transparent',
                borderColor: form.locations.includes(loc) ? '#f59e0b40' : 'rgba(255,255,255,0.06)',
                color: form.locations.includes(loc) ? '#f59e0b' : '#475569',
              }}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Asset types */}
      <div>
        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">Asset Types</label>
        <div className="flex flex-wrap gap-1.5">
          {ASSET_TYPE_OPTIONS.map(a => (
            <button
              key={a}
              onClick={() => f('asset_types', toggle(form.asset_types, a))}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all capitalize"
              style={{
                backgroundColor: form.asset_types.includes(a) ? '#06b6d418' : 'transparent',
                borderColor: form.asset_types.includes(a) ? '#06b6d440' : 'rgba(255,255,255,0.06)',
                color: form.asset_types.includes(a) ? '#06b6d4' : '#475569',
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Notes</label>
        <textarea
          className="lead-form-input resize-none"
          rows={2}
          value={form.notes}
          onChange={e => f('notes', e.target.value)}
          placeholder="Key context, referral source, deal stage…"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-slate-800 hover:border-slate-600 text-slate-500 hover:text-slate-300 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={() => form.name.trim() && onSave(form)}
          className="flex-1 py-2.5 rounded-xl text-sm font-black border transition-all active:scale-95"
          style={{
            backgroundColor: '#f59e0b18',
            borderColor: '#f59e0b50',
            color: '#f59e0b',
          }}
        >
          Save Lead
        </button>
      </div>
    </div>
  );
}

// ─── Lead row ─────────────────────────────────────────────────────────────────

function LeadRow({ lead, onEdit, onDelete }: { lead: Lead; onEdit: () => void; onDelete: () => void }) {
  const isInvestor = lead.tipo === 'Investidor';
  const accentColor = isInvestor ? '#3b82f6' : '#10b981';
  const urg = URGENCY_META[lead.urgency];

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all group hover:border-opacity-50"
      style={{
        borderColor: accentColor + '20',
        backgroundColor: accentColor + '06',
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black"
        style={{ backgroundColor: accentColor + '20', color: accentColor }}
      >
        {lead.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white truncate">{lead.name}</span>
          {lead.company && <span className="text-[10px] text-slate-600 truncate hidden sm:block">{lead.company}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: accentColor, backgroundColor: accentColor + '15' }}>
            {lead.tipo}
          </span>
          {lead.locations.length > 0 && (
            <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />
              {lead.locations.slice(0, 2).join(', ')}
            </span>
          )}
          <span className="text-[9px] font-bold" style={{ color: urg.color }}>
            {urg.label}
          </span>
        </div>
      </div>

      <div className="text-right flex-shrink-0 hidden sm:block">
        {isInvestor && (lead.investment_min || lead.investment_max) ? (
          <div className="text-xs font-black text-white">
            {fmtMoney(lead.investment_min)}–{fmtMoney(lead.investment_max)}
          </div>
        ) : lead.estimated_value ? (
          <div className="text-xs font-black text-white">{fmtMoney(lead.estimated_value)}</div>
        ) : null}
      </div>

      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 transition-all">
          <Filter className="w-3 h-3" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg border border-slate-800 hover:border-red-900 text-slate-600 hover:text-red-400 transition-all">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Cinematic match notification ─────────────────────────────────────────────

function CinematicMatchNotification({
  match, investorName, ownerName, onDismiss,
}: {
  match: ComputedMatch; investorName: string; ownerName: string; onDismiss: () => void;
}) {
  const meta = MATCH_TIER_META[match.tier];
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none">
      <div
        className="rounded-2xl p-5 text-center relative overflow-hidden pointer-events-auto"
        style={{
          border: `1px solid ${meta.color}50`,
          background: `linear-gradient(135deg, ${meta.bg}, rgba(2,6,23,0.98))`,
          boxShadow: `0 0 60px ${meta.glow}, 0 20px 60px rgba(0,0,0,0.8)`,
          animation: 'matchReveal 0.5s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <div className="match-scan" />
        <div className="h-px mb-4" style={{ background: `linear-gradient(90deg,transparent,${meta.color},transparent)` }} />

        <div className="flex items-center justify-center gap-2 mb-2">
          <TierIcon tier={match.tier} size="lg" />
          <span
            className="text-base font-black uppercase tracking-widest"
            style={{ color: meta.color, textShadow: `0 0 20px ${meta.color}` }}
          >
            {meta.label}
          </span>
        </div>

        <p className="text-white font-bold text-sm mb-1">
          {investorName} <span className="text-slate-500">→</span> {ownerName}
        </p>
        <p className="text-[11px] text-slate-500 mb-3">{match.opportunityType}</p>

        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="font-black text-2xl" style={{ color: meta.color }}>{match.score}</div>
            <div className="text-[9px] text-slate-600 uppercase tracking-widest">Score</div>
          </div>
          <div className="text-center">
            <div className="font-black text-xl" style={{ color: '#f59e0b' }}>+{MATCH_XP[match.tier]}</div>
            <div className="text-[9px] text-slate-600 uppercase tracking-widest">XP Earned</div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="mt-3 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type PanelTab = 'matches' | 'leads' | 'add';
type FilterTier = 'all' | MatchTier;

interface LeadsMatchingPanelProps {
  playerId: string;
  playerLevel: number;
  districts: District[];
  playerDistricts: Map<string, unknown>;
  onXPGained: (amount: number) => void;
  onQuestGenerated: (quest: Omit<DynamicQuest, 'id' | 'generated_at'>) => void;
  onDominanceGained: (districtId: string, xp: number) => void;
  externalLeads?: Lead[];
}

export function LeadsMatchingPanel({
  playerId, playerLevel, districts, playerDistricts,
  onXPGained, onQuestGenerated, onDominanceGained,
  externalLeads,
}: LeadsMatchingPanelProps) {
  const [tab, setTab] = useState<PanelTab>('matches');
  // When externalLeads is provided, it is the sole source of truth for leads.
  // localLeads is only used when no externalLeads prop is passed (standalone mode).
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const [matches, setMatches] = useState<LeadMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [filterTipo, setFilterTipo] = useState<'all' | LeadTipo>('all');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [cinematic, setCinematic] = useState<{ match: ComputedMatch; investor: Lead; owner: Lead } | null>(null);

  // The authoritative leads list: externalLeads (global saved state) when non-empty, otherwise localLeads from DB
  const leads = (externalLeads && externalLeads.length > 0) ? externalLeads : localLeads;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ls, ms] = await Promise.all([getLeads(playerId), getLeadMatches(playerId)]);
      setLocalLeads(ls);
      setMatches(ms);
    } catch (err) {
      console.error('[LeadsMatchingPanel] Failed to load leads or matches from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  // When externalLeads arrives (global save), mark loading done immediately
  useEffect(() => {
    if (externalLeads && externalLeads.length > 0) {
      setLoading(false);
    }
  }, [externalLeads]);

  const handleSaveLead = useCallback(async (form: LeadFormData) => {
    const parseEuro = (s: string) => {
      if (!s) return 0;
      const clean = s.replace(/[€,\s]/g, '').replace('k', '000').replace('M', '000000').replace('m', '000000');
      return parseInt(clean, 10) || 0;
    };

    const payload = {
      tipo: form.tipo,
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      locations: form.locations,
      asset_types: form.asset_types,
      investment_min: parseEuro(form.investment_min),
      investment_max: parseEuro(form.investment_max),
      estimated_value: parseEuro(form.estimated_value),
      urgency: form.urgency,
      source: form.source,
      notes: form.notes.trim() || null,
      status: 'active' as const,
      notion_page_id: null,
      stars: 0,
      rooms: null,
      last_contact_at: null,
      next_follow_up: null,
      status_updated_at: null,
      notion_last_synced_at: null,
      bolt_last_updated_at: null,
    };

    if (editingLead) {
      await updateLead(editingLead.id, payload);
    } else {
      await createLead(playerId, payload);
    }

    setShowForm(false);
    setEditingLead(null);
    await load();
  }, [playerId, editingLead, load]);

  const handleDeleteLead = useCallback(async (leadId: string) => {
    await deleteLead(leadId);
    await load();
  }, [load]);

  const handleDismissMatch = useCallback(async (matchId: string) => {
    await dismissMatch(matchId);
    setMatches(prev => prev.filter(m => m.id !== matchId));
  }, []);

  const handleActionMatch = useCallback(async (matchId: string) => {
    await actionMatch(matchId);
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, is_actioned: true } : m));
  }, []);

  const runMatchEngine = useCallback(async () => {
    if (running) return;
    setRunning(true);

    const activeLs = leads.filter(l => l.status === 'active');
    const computed = computeAllMatches(activeLs);

    // Get existing match pairs to avoid duplicates
    const existingPairs = new Set(matches.map(m => `${m.investor_lead_id}_${m.owner_lead_id}`));

    const newMatches = computed.filter(c =>
      !existingPairs.has(`${c.investor.id}_${c.owner.id}`)
    );

    if (newMatches.length === 0) {
      setRunning(false);
      return;
    }

    // Process matches: award XP, generate quests for high-quality matches
    const saved: LeadMatch[] = [];
    let totalXP = 0;

    for (const m of newMatches) {
      const xp = MATCH_XP[m.tier];
      let questGenerated = false;
      let districtId: string | null = null;

      // Find matching district from lead locations
      if (m.tier === 'legendary' || m.tier === 'strong') {
        const allLocations = [...m.investor.locations, ...m.owner.locations];
        const matchedDistrict = districts.find(d =>
          allLocations.some(loc =>
            d.name.toLowerCase().includes(loc.toLowerCase()) ||
            loc.toLowerCase().includes(d.name.toLowerCase())
          )
        );

        if (matchedDistrict) {
          districtId = matchedDistrict.id;
          // Boost district dominance for strong/legendary matches
          const domXP = m.tier === 'legendary' ? 150 : 75;
          onDominanceGained(matchedDistrict.id, domXP);
        }

        // Auto-generate action quest sequence for legendary/strong matches
        if (m.tier === 'legendary' || m.tier === 'strong') {
          const matchQuests = generateMatchQuests({
            playerId,
            playerLevel,
            investorName: m.investor.name,
            ownerName:    m.owner.name,
            tier:         m.tier,
            districtId,
            matchScore:   m.score,
            opportunityType: m.opportunityType,
          });

          try {
            const inserted = await insertDynamicQuests(matchQuests);
            questGenerated = true;
            // Notify for each generated quest so the quest panel refreshes
            inserted.forEach(q => onQuestGenerated(q));
          } catch (_) { /* non-fatal */ }
        }
      }

      const saved_match = await saveLeadMatch(playerId, m, xp, questGenerated, districtId);
      saved.push({
        ...saved_match,
        investor: m.investor,
        owner: m.owner,
      });

      totalXP += xp;

      // Show cinematic for legendary matches
      if (m.tier === 'legendary') {
        setCinematic({ match: m, investor: m.investor, owner: m.owner });
      }
    }

    if (totalXP > 0) onXPGained(totalXP);

    setMatches(prev => [...saved, ...prev]);
    setRunning(false);
  }, [running, leads, matches, playerId, districts, playerLevel, playerDistricts, onXPGained, onQuestGenerated, onDominanceGained]);

  const investors = leads.filter(l => l.tipo === 'Investidor');
  const owners    = leads.filter(l => l.tipo === 'Proprietário');

  const filteredLeads = leads.filter(l =>
    filterTipo === 'all' || l.tipo === filterTipo
  );

  const filteredMatches = matches.filter(m =>
    filterTier === 'all' || m.match_tier === filterTier
  );

  const legendaryCount      = matches.filter(m => m.match_tier === 'legendary').length;
  const budgetMismatchCount = matches.filter(m => m.match_tier === 'budget_mismatch').length;
  const incompleteCount     = matches.filter(m => m.match_tier === 'incomplete_data').length;

  const allLeadsById = new Map(leads.map(l => [l.id, l]));

  return (
    <div className="space-y-4">
      <style>{PANEL_CSS}</style>

      {/* Cinematic notification */}
      {cinematic && (
        <CinematicMatchNotification
          match={cinematic.match}
          investorName={cinematic.investor.name}
          ownerName={cinematic.owner.name}
          onDismiss={() => setCinematic(null)}
        />
      )}

      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-amber-900/25 p-5"
        style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(2,6,23,0.97))' }}
      >
        <div className="match-scan" />
        <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.5),transparent)' }} />

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-amber-400" />
              <h3 className="font-black text-amber-400 tracking-widest text-xs uppercase">Investor-Owner Matching</h3>
            </div>
            <p className="text-white font-bold text-lg mb-0.5">Lead Intelligence Engine</p>
            <p className="text-slate-500 text-xs">
              {investors.length} investors · {owners.length} owners · {matches.length} active matches
            </p>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => { setShowForm(true); setEditingLead(null); setTab('add'); }}
              className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl border border-amber-800/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Lead
            </button>
            <button
              onClick={runMatchEngine}
              disabled={running || leads.length < 2}
              className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl border transition-all disabled:opacity-40"
              style={{
                borderColor: '#10b98150',
                backgroundColor: '#10b98118',
                color: '#10b981',
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Running…' : 'Run Match Engine'}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: 'Investors',  value: investors.length,                      color: '#3b82f6', icon: DollarSign },
            { label: 'Owners',     value: owners.length,                         color: '#10b981', icon: Building2 },
            { label: 'Legendary',  value: legendaryCount,                        color: '#f59e0b', icon: Crown },
            { label: 'Issues',     value: budgetMismatchCount + incompleteCount, color: '#ef4444', icon: AlertTriangle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl p-2.5 text-center border"
              style={{ backgroundColor: color + '08', borderColor: color + '20' }}
            >
              <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
              <div className="font-black text-lg leading-none" style={{ color }}>{value}</div>
              <div className="text-[9px] text-slate-600 uppercase tracking-wide mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Debug counters */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-600 border-t border-slate-800/40 pt-2.5">
          <span>global leads: <span className="text-amber-500">{externalLeads?.length ?? '—'}</span></span>
          <span>local leads: <span className="text-slate-400">{localLeads.length}</span></span>
          <span>active leads: <span className="text-emerald-500">{leads.length}</span></span>
          <span>localStorage: <span className="text-cyan-500">{(() => { try { const k = Object.keys(localStorage).find(k => k.startsWith('swallow_leads_')); return k ? JSON.parse(localStorage.getItem(k)!).length : 0; } catch { return '?'; } })()}</span></span>
          <span>source: <span style={{ color: (externalLeads && externalLeads.length > 0) ? '#10b981' : '#94a3b8' }}>{(externalLeads && externalLeads.length > 0) ? 'global' : 'supabase'}</span></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800/50 rounded-xl p-1">
        {([
          { key: 'matches', label: 'Matches', badge: matches.filter(m => !m.is_actioned).length },
          { key: 'leads',   label: 'Leads',   badge: leads.length },
          { key: 'add',     label: 'Add Lead', badge: null },
        ] as { key: PanelTab; label: string; badge: number | null }[]).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key !== 'add') setShowForm(false); else setShowForm(true); }}
            className="relative flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              backgroundColor: tab === t.key ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: tab === t.key ? '#f59e0b' : '#475569',
              border: tab === t.key ? '1px solid rgba(245,158,11,0.25)' : '1px solid transparent',
            }}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-900 text-[9px] font-black rounded-full flex items-center justify-center">
                {Math.min(t.badge, 99)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}

      {/* ── Matches tab ── */}
      {tab === 'matches' && (
        <div className="space-y-3">
          {/* Tier filter */}
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'legendary', 'strong', 'warm', 'low', 'budget_mismatch', 'incomplete_data'] as (FilterTier | 'all')[]).map(t => {
              const meta = t === 'all' ? null : MATCH_TIER_META[t as MatchTier];
              return (
                <button
                  key={t}
                  onClick={() => setFilterTier(t as FilterTier)}
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all"
                  style={{
                    color: filterTier === t ? (meta?.color ?? '#f59e0b') : '#475569',
                    borderColor: filterTier === t ? (meta?.color ?? '#f59e0b') + '40' : 'rgba(255,255,255,0.06)',
                    backgroundColor: filterTier === t ? (meta?.color ?? '#f59e0b') + '10' : 'transparent',
                  }}
                >
                  {t === 'all' ? 'All Matches' : meta?.badge}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-600 text-sm">Loading matches…</div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Users className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="text-slate-600 text-sm">No matches yet.</p>
              <p className="text-slate-700 text-xs">Add at least one investor and one owner, then run the Match Engine.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMatches.map((m, i) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  investorLead={allLeadsById.get(m.investor_lead_id)}
                  ownerLead={allLeadsById.get(m.owner_lead_id)}
                  index={i}
                  onDismiss={() => handleDismissMatch(m.id)}
                  onAction={() => handleActionMatch(m.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Leads tab ── */}
      {tab === 'leads' && (
        <div className="space-y-3">
          {/* Tipo filter */}
          <div className="flex gap-1.5">
            {(['all', 'Investidor', 'Proprietário'] as ('all' | LeadTipo)[]).map(t => (
              <button
                key={t}
                onClick={() => setFilterTipo(t as 'all' | LeadTipo)}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all"
                style={{
                  color: filterTipo === t ? '#f59e0b' : '#475569',
                  borderColor: filterTipo === t ? '#f59e0b40' : 'rgba(255,255,255,0.06)',
                  backgroundColor: filterTipo === t ? '#f59e0b10' : 'transparent',
                }}
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-600 text-sm">Loading leads…</div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <UserPlus className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="text-slate-600 text-sm">No leads yet.</p>
              <button
                onClick={() => { setTab('add'); setShowForm(true); }}
                className="text-xs text-amber-500 hover:text-amber-400 underline transition-colors"
              >
                Add your first lead
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredLeads.map(lead => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onEdit={() => {
                    setEditingLead(lead);
                    setShowForm(true);
                    setTab('add');
                  }}
                  onDelete={() => handleDeleteLead(lead.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit lead tab ── */}
      {tab === 'add' && showForm && (
        <LeadForm
          initial={editingLead ? {
            tipo: editingLead.tipo,
            name: editingLead.name,
            company: editingLead.company ?? '',
            email: editingLead.email ?? '',
            phone: editingLead.phone ?? '',
            locations: editingLead.locations,
            asset_types: editingLead.asset_types,
            investment_min: editingLead.investment_min ? String(editingLead.investment_min) : '',
            investment_max: editingLead.investment_max ? String(editingLead.investment_max) : '',
            estimated_value: editingLead.estimated_value ? String(editingLead.estimated_value) : '',
            urgency: editingLead.urgency,
            source: editingLead.source,
            notes: editingLead.notes ?? '',
          } : undefined}
          onSave={handleSaveLead}
          onCancel={() => { setShowForm(false); setEditingLead(null); setTab('leads'); }}
        />
      )}
    </div>
  );
}
