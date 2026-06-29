import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, X, Star, Building2, DollarSign, MapPin, Globe, CreditCard as Edit2, Trash2, Phone, Mail, Calendar, ChevronDown, Check, Users } from 'lucide-react';
import {
  Lead, LeadTipo, LeadStatus, LeadUrgency, LeadSource,
  LOCATION_OPTIONS, ASSET_TYPE_OPTIONS,
} from '../types/game';
import { getLeads, createLead, updateLead, deleteLead } from '../services/matchingEngine';

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CRM_CSS = `
  @keyframes crmDrawerIn {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  @keyframes crmOverlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .crm-drawer  { animation: crmDrawerIn  0.3s cubic-bezier(0.22,1,0.36,1) both; }
  .crm-overlay { animation: crmOverlayIn 0.2s ease-out both; }
  .crm-input {
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
  .crm-input:focus { border-color: rgba(245,158,11,0.5); }
  .crm-input::placeholder { color: #475569; }
  .crm-input option { background: #0f172a; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`;
  return `€${n}`;
}

function parseEuro(s: string): number {
  if (!s.trim()) return 0;
  const clean = s.replace(/[€,\s]/g, '').replace(/k$/i, '000').replace(/m$/i, '000000');
  return parseInt(clean, 10) || 0;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',   color: '#10b981', bg: '#10b98118' },
  matched:  { label: 'Matched',  color: '#3b82f6', bg: '#3b82f618' },
  closed:   { label: 'Closed',   color: '#f59e0b', bg: '#f59e0b18' },
  inactive: { label: 'Inactive', color: '#475569', bg: '#47556918' },
};

const URGENCY_META: Record<LeadUrgency, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444' },
  high:   { label: 'High',   color: '#f97316' },
  medium: { label: 'Medium', color: '#f59e0b' },
  low:    { label: 'Low',    color: '#3b82f6' },
};

const SOURCE_META: Record<LeadSource, string> = {
  manual:   'Manual',
  referral: 'Referral',
  event:    'Event',
  inbound:  'Inbound',
};

// ─── Form data type ───────────────────────────────────────────────────────────

interface CRMFormData {
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
  status: LeadStatus;
  notes: string;
  stars: number;
  rooms: string;
  last_contact_at: string;
  next_follow_up: string;
}

const BLANK_FORM: CRMFormData = {
  tipo: 'Investidor', name: '', company: '', email: '', phone: '',
  locations: [], asset_types: [],
  investment_min: '', investment_max: '', estimated_value: '',
  urgency: 'medium', source: 'manual', status: 'active',
  notes: '', stars: 0, rooms: '', last_contact_at: '', next_follow_up: '',
};

function leadToForm(lead: Lead): CRMFormData {
  return {
    tipo: lead.tipo,
    name: lead.name,
    company: lead.company ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    locations: lead.locations,
    asset_types: lead.asset_types,
    investment_min: lead.investment_min ? String(lead.investment_min) : '',
    investment_max: lead.investment_max ? String(lead.investment_max) : '',
    estimated_value: lead.estimated_value ? String(lead.estimated_value) : '',
    urgency: lead.urgency,
    source: lead.source,
    status: lead.status,
    notes: lead.notes ?? '',
    stars: lead.stars,
    rooms: lead.rooms != null ? String(lead.rooms) : '',
    last_contact_at: lead.last_contact_at ? lead.last_contact_at.slice(0, 10) : '',
    next_follow_up: lead.next_follow_up ? lead.next_follow_up.slice(0, 10) : '',
  };
}

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  size = 'sm',
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: 'sm' | 'md';
}) {
  const [hovered, setHovered] = useState(0);
  const sz = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const active = hovered || value;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(value === n ? 0 : n)}
          onMouseEnter={() => onChange && setHovered(n)}
          onMouseLeave={() => onChange && setHovered(0)}
          disabled={!onChange}
          className={`transition-all ${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        >
          <Star
            className={sz}
            style={{
              color: n <= active ? '#f59e0b' : '#334155',
              fill: n <= active ? '#f59e0b' : 'transparent',
            }}
          />
        </button>
      ))}
    </div>
  );
}

// ─── LeadDrawer ───────────────────────────────────────────────────────────────

function LeadDrawer({
  lead,
  onSave,
  onCancel,
  saving,
}: {
  lead: Lead | null;
  onSave: (form: CRMFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CRMFormData>(() =>
    lead ? leadToForm(lead) : BLANK_FORM
  );

  const f = <K extends keyof CRMFormData>(k: K, v: CRMFormData[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  return (
    <>
      <div className="crm-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onCancel} />
      <div className="crm-drawer fixed top-0 right-0 h-full w-full max-w-lg bg-slate-950 border-l border-slate-800/60 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 flex-shrink-0">
          <div>
            <h3 className="font-black text-white text-sm tracking-wide">
              {lead ? 'Edit Lead' : 'New Lead'}
            </h3>
            {lead?.notion_page_id && (
              <div className="flex items-center gap-1 mt-0.5">
                <Globe className="w-3 h-3 text-cyan-500" />
                <span className="text-[10px] text-cyan-500 font-bold">Notion Synced — edits won't auto-push</span>
              </div>
            )}
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Tipo */}
          <div className="flex gap-2">
            {(['Investidor', 'Proprietário'] as LeadTipo[]).map(t => (
              <button
                key={t}
                type="button"
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
                {t === 'Investidor'
                  ? <DollarSign className="w-4 h-4 inline mr-1.5" />
                  : <Building2 className="w-4 h-4 inline mr-1.5" />
                }
                {t}
              </button>
            ))}
          </div>

          {/* Name + Company + Rooms */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Name *</label>
              <input
                className="crm-input"
                value={form.name}
                onChange={e => f('name', e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Company</label>
                <input className="crm-input" value={form.company} onChange={e => f('company', e.target.value)} placeholder="Company / fund" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Rooms</label>
                <input className="crm-input" type="number" min="0" value={form.rooms} onChange={e => f('rooms', e.target.value)} placeholder="# rooms" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">
                  <Mail className="w-3 h-3 inline mr-1" />Email
                </label>
                <input className="crm-input" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="email@example.com" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">
                  <Phone className="w-3 h-3 inline mr-1" />Phone
                </label>
                <input className="crm-input" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+351 …" />
              </div>
            </div>
          </div>

          {/* Financial */}
          <div className="grid grid-cols-3 gap-3">
            {form.tipo === 'Investidor' ? (
              <>
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Min Budget</label>
                  <input className="crm-input" value={form.investment_min} onChange={e => f('investment_min', e.target.value)} placeholder="€500k" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Max Budget</label>
                  <input className="crm-input" value={form.investment_max} onChange={e => f('investment_max', e.target.value)} placeholder="€5M" />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Estimated Value</label>
                <input className="crm-input" value={form.estimated_value} onChange={e => f('estimated_value', e.target.value)} placeholder="€2.5M" />
              </div>
            )}
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Urgency</label>
              <select className="crm-input" value={form.urgency} onChange={e => f('urgency', e.target.value as LeadUrgency)}>
                {(['urgent', 'high', 'medium', 'low'] as LeadUrgency[]).map(u => (
                  <option key={u} value={u}>{URGENCY_META[u].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status + Source + Stars */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Status</label>
              <select className="crm-input" value={form.status} onChange={e => f('status', e.target.value as LeadStatus)}>
                {(['active', 'matched', 'closed', 'inactive'] as LeadStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Source</label>
              <select className="crm-input" value={form.source} onChange={e => f('source', e.target.value as LeadSource)}>
                {(['manual', 'referral', 'event', 'inbound'] as LeadSource[]).map(s => (
                  <option key={s} value={s}>{SOURCE_META[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">Stars</label>
              <div className="pt-1.5">
                <StarRating value={form.stars} onChange={n => f('stars', n)} size="md" />
              </div>
            </div>
          </div>

          {/* Follow-up dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">
                <Calendar className="w-3 h-3 inline mr-1" />Last Contact
              </label>
              <input className="crm-input" type="date" value={form.last_contact_at} onChange={e => f('last_contact_at', e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1 block">
                <Calendar className="w-3 h-3 inline mr-1" />Next Follow-Up
              </label>
              <input className="crm-input" type="date" value={form.next_follow_up} onChange={e => f('next_follow_up', e.target.value)} />
            </div>
          </div>

          {/* Locations */}
          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">Locations</label>
            <div className="flex flex-wrap gap-1.5">
              {LOCATION_OPTIONS.map(loc => (
                <button
                  key={loc}
                  type="button"
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
                  type="button"
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
              className="crm-input resize-none"
              rows={3}
              value={form.notes}
              onChange={e => f('notes', e.target.value)}
              placeholder="Key context, referral source, deal stage…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-slate-800/60 flex-shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-slate-800 hover:border-slate-600 text-slate-500 hover:text-slate-300 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => form.name.trim() && onSave(form)}
            disabled={!form.name.trim() || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-black border transition-all active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: '#f59e0b18', borderColor: '#f59e0b50', color: '#f59e0b' }}
          >
            {saving ? 'Saving…' : 'Save Lead'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── LeadCRMRow ───────────────────────────────────────────────────────────────

function LeadCRMRow({
  lead,
  onEdit,
  onDelete,
  onStarChange,
  onStatusChange,
}: {
  lead: Lead;
  onEdit: () => void;
  onDelete: () => void;
  onStarChange: (stars: number) => void;
  onStatusChange: (status: LeadStatus) => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const isInvestor = lead.tipo === 'Investidor';
  const accentColor = isInvestor ? '#3b82f6' : '#10b981';
  const status = STATUS_META[lead.status];
  const urgency = URGENCY_META[lead.urgency];

  const followUpDate = lead.next_follow_up ? new Date(lead.next_follow_up) : null;
  const followUpPast = followUpDate != null && followUpDate < new Date();
  const followUpLabel = followUpDate
    ? followUpDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-3 border transition-all group"
      style={{ borderColor: accentColor + '20', backgroundColor: accentColor + '06' }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black"
        style={{ backgroundColor: accentColor + '20', color: accentColor }}
      >
        {lead.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-black text-white truncate">{lead.name}</span>
          {lead.company && (
            <span className="text-[10px] text-slate-600 truncate hidden sm:inline">{lead.company}</span>
          )}
          {lead.notion_page_id && (
            <span
              className="flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest flex-shrink-0"
              style={{ color: '#06b6d4', backgroundColor: '#06b6d415', border: '1px solid #06b6d430' }}
              title="Synced from Notion"
            >
              <Globe className="w-2.5 h-2.5" />
              Notion
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span
            className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ color: accentColor, backgroundColor: accentColor + '15' }}
          >
            {lead.tipo}
          </span>
          {lead.locations.length > 0 && (
            <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />
              {lead.locations.slice(0, 2).join(', ')}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: urgency.color }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: urgency.color }} />
            {urgency.label}
          </span>
          {followUpLabel && (
            <span
              className="flex items-center gap-0.5 text-[9px] font-bold hidden sm:flex"
              style={{ color: followUpPast ? '#ef4444' : '#475569' }}
            >
              <Calendar className="w-2.5 h-2.5" />
              {followUpLabel}
            </span>
          )}
        </div>
      </div>

      {/* Stars */}
      <div className="flex-shrink-0 hidden sm:block">
        <StarRating value={lead.stars} onChange={onStarChange} />
      </div>

      {/* Value/budget */}
      <div className="flex-shrink-0 hidden md:block text-right min-w-[68px]">
        {isInvestor && (lead.investment_min || lead.investment_max) ? (
          <div className="text-xs font-black text-white">
            {fmtMoney(lead.investment_min)}–{fmtMoney(lead.investment_max)}
          </div>
        ) : lead.estimated_value ? (
          <div className="text-xs font-black text-white">{fmtMoney(lead.estimated_value)}</div>
        ) : null}
      </div>

      {/* Status dropdown */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setStatusOpen(o => !o)}
          className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border transition-all"
          style={{ color: status.color, backgroundColor: status.bg, borderColor: status.color + '30' }}
        >
          {status.label}
          <ChevronDown className="w-3 h-3" />
        </button>
        {statusOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
            <div className="absolute right-0 top-8 z-20 rounded-xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden min-w-[110px]">
              {(['active', 'matched', 'closed', 'inactive'] as LeadStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(s); setStatusOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black transition-all hover:bg-slate-800/60"
                  style={{ color: STATUS_META[s].color }}
                >
                  {lead.status === s
                    ? <Check className="w-3 h-3" />
                    : <span className="w-3 h-3" />
                  }
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg border border-slate-700 hover:border-amber-800 text-slate-500 hover:text-amber-400 transition-all"
          title="Edit lead"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg border border-slate-800 hover:border-red-900 text-slate-600 hover:text-red-400 transition-all"
          title="Delete lead"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── LeadsCRMPanel ────────────────────────────────────────────────────────────

interface LeadsCRMPanelProps {
  playerId: string;
  externalLeads?: Lead[];
  onLeadsSync: (leads: Lead[]) => void;
}

export function LeadsCRMPanel({ playerId, externalLeads, onLeadsSync }: LeadsCRMPanelProps) {
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<'all' | LeadTipo>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | LeadStatus>('all');
  const [filterUrgency, setFilterUrgency] = useState<'all' | LeadUrgency>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const leads = (externalLeads && externalLeads.length > 0) ? externalLeads : localLeads;

  const refresh = useCallback(async () => {
    try {
      const fresh = await getLeads(playerId);
      setLocalLeads(fresh);
      onLeadsSync(fresh);
    } catch (err) {
      console.error('[LeadsCRMPanel] refresh failed:', err);
    }
  }, [playerId, onLeadsSync]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  useEffect(() => {
    if (externalLeads && externalLeads.length > 0) setLoading(false);
  }, [externalLeads]);

  const handleSave = useCallback(async (form: CRMFormData) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload: Omit<Lead, 'id' | 'player_id' | 'created_at' | 'updated_at'> = {
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
        status: form.status,
        notes: form.notes.trim() || null,
        stars: form.stars,
        rooms: form.rooms ? parseInt(form.rooms, 10) : null,
        last_contact_at: form.last_contact_at || null,
        next_follow_up: form.next_follow_up || null,
        notion_page_id: editingLead?.notion_page_id ?? null,
        status_updated_at: null,
        notion_last_synced_at: editingLead?.notion_last_synced_at ?? null,
        bolt_last_updated_at: now,
      };

      if (editingLead) {
        await updateLead(editingLead.id, payload);
      } else {
        await createLead(playerId, payload);
      }

      setDrawerOpen(false);
      setEditingLead(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [editingLead, playerId, refresh]);

  const handleDelete = useCallback(async (leadId: string) => {
    await deleteLead(leadId);
    setDeleteConfirmId(null);
    await refresh();
  }, [refresh]);

  const handleStarChange = useCallback(async (lead: Lead, stars: number) => {
    await updateLead(lead.id, { stars, bolt_last_updated_at: new Date().toISOString() });
    await refresh();
  }, [refresh]);

  const handleStatusChange = useCallback(async (lead: Lead, status: LeadStatus) => {
    await updateLead(lead.id, { status, bolt_last_updated_at: new Date().toISOString() });
    await refresh();
  }, [refresh]);

  const filtered = leads
    .filter(l => filterTipo === 'all' || l.tipo === filterTipo)
    .filter(l => filterStatus === 'all' || l.status === filterStatus)
    .filter(l => filterUrgency === 'all' || l.urgency === filterUrgency)
    .filter(l => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        (l.company ?? '').toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q)
      );
    });

  const investors  = leads.filter(l => l.tipo === 'Investidor');
  const owners     = leads.filter(l => l.tipo === 'Proprietário');
  const activeCount = leads.filter(l => l.status === 'active').length;

  return (
    <div className="space-y-4">
      <style>{CRM_CSS}</style>

      {/* Drawer */}
      {drawerOpen && (
        <LeadDrawer
          lead={editingLead}
          onSave={handleSave}
          onCancel={() => { setDrawerOpen(false); setEditingLead(null); }}
          saving={saving}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center px-4">
          <div className="rounded-2xl border border-red-900/50 bg-slate-950 p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-900/50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-black text-white text-sm">Delete Lead</p>
                <p className="text-xs text-slate-500">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-slate-800 hover:border-slate-600 text-slate-500 hover:text-slate-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-black border border-red-900/60 bg-red-950/30 text-red-400 hover:bg-red-900/40 transition-all active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="relative overflow-hidden rounded-xl border border-amber-900/25 p-5"
        style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(2,6,23,0.97))' }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-amber-400" />
              <h3 className="font-black text-amber-400 tracking-widest text-xs uppercase">Leads CRM</h3>
            </div>
            <p className="text-white font-bold text-lg mb-0.5">Contact Management</p>
            <p className="text-slate-500 text-xs">
              {investors.length} investors · {owners.length} owners · {activeCount} active
            </p>
          </div>
          <button
            onClick={() => { setEditingLead(null); setDrawerOpen(true); }}
            className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl border border-amber-800/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/30 transition-all flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add Lead
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Investors', value: investors.length,  color: '#3b82f6', Icon: DollarSign },
            { label: 'Owners',    value: owners.length,     color: '#10b981', Icon: Building2 },
            { label: 'Active',    value: activeCount,       color: '#10b981', Icon: Check },
            { label: 'Total',     value: leads.length,      color: '#f59e0b', Icon: Users },
          ].map(({ label, value, color, Icon }) => (
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
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
        <input
          className="w-full bg-slate-900/60 border border-slate-800/60 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-amber-800/60"
          placeholder="Search by name, company, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'Investidor', 'Proprietário'] as ('all' | LeadTipo)[]).map(t => (
          <button
            key={t}
            onClick={() => setFilterTipo(t)}
            className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all"
            style={{
              color: filterTipo === t ? '#f59e0b' : '#475569',
              borderColor: filterTipo === t ? '#f59e0b40' : 'rgba(255,255,255,0.06)',
              backgroundColor: filterTipo === t ? '#f59e0b10' : 'transparent',
            }}
          >
            {t === 'all' ? 'All Types' : t}
          </button>
        ))}

        <span className="text-slate-800 text-xs self-center px-0.5">·</span>

        {(['all', 'active', 'matched', 'closed', 'inactive'] as ('all' | LeadStatus)[]).map(s => {
          const meta = s !== 'all' ? STATUS_META[s] : null;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all"
              style={{
                color: filterStatus === s ? (meta?.color ?? '#f59e0b') : '#475569',
                borderColor: filterStatus === s ? (meta?.color ?? '#f59e0b') + '40' : 'rgba(255,255,255,0.06)',
                backgroundColor: filterStatus === s ? (meta?.bg ?? '#f59e0b10') : 'transparent',
              }}
            >
              {s === 'all' ? 'All Status' : meta?.label}
            </button>
          );
        })}

        <span className="text-slate-800 text-xs self-center px-0.5">·</span>

        {(['all', 'urgent', 'high', 'medium', 'low'] as ('all' | LeadUrgency)[]).map(u => {
          const meta = u !== 'all' ? URGENCY_META[u] : null;
          return (
            <button
              key={u}
              onClick={() => setFilterUrgency(u)}
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all"
              style={{
                color: filterUrgency === u ? (meta?.color ?? '#f59e0b') : '#475569',
                borderColor: filterUrgency === u ? (meta?.color ?? '#f59e0b') + '40' : 'rgba(255,255,255,0.06)',
                backgroundColor: filterUrgency === u ? '#f59e0b08' : 'transparent',
              }}
            >
              {u === 'all' ? 'All Urgency' : meta?.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-600 text-sm">Loading leads…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Users className="w-12 h-12 text-slate-700 mx-auto" />
          <p className="text-slate-600 text-sm">
            {leads.length === 0 ? 'No leads yet.' : 'No leads match your filters.'}
          </p>
          {leads.length === 0 && (
            <button
              onClick={() => { setEditingLead(null); setDrawerOpen(true); }}
              className="text-xs text-amber-500 hover:text-amber-400 underline transition-colors"
            >
              Add your first lead
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(lead => (
            <LeadCRMRow
              key={lead.id}
              lead={lead}
              onEdit={() => { setEditingLead(lead); setDrawerOpen(true); }}
              onDelete={() => setDeleteConfirmId(lead.id)}
              onStarChange={stars => handleStarChange(lead, stars)}
              onStatusChange={status => handleStatusChange(lead, status)}
            />
          ))}
          <p className="text-[10px] text-slate-700 text-center pt-1">
            {filtered.length} lead{filtered.length !== 1 ? 's' : ''} shown
            {leads.length !== filtered.length && ` of ${leads.length}`}
          </p>
        </div>
      )}
    </div>
  );
}
