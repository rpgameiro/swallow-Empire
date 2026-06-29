import { useState, useEffect } from 'react';
import {
  Settings, Database, CheckCircle, XCircle, Loader, Wifi,
  AlertTriangle, RefreshCw, Users, Shield, Lock, Bug,
  ChevronDown, ChevronUp, Zap, Info,
} from 'lucide-react';
import {
  testNotionConnection, diagnoseNotion, syncFromNotion,
  getDatabaseId, setDatabaseId,
  NotionDiagnoseResult, NotionDiagnoseRow,
} from '../services/notionService';
import { getLeads } from '../services/matchingEngine';
import type { Lead } from '../types/game';

// ─── Shared types ─────────────────────────────────────────────────────────────

type OpStatus = 'idle' | 'loading' | 'success' | 'error';
interface OpResult { status: OpStatus; message: string; detail?: string; count?: number }

// ─── Classification styling ───────────────────────────────────────────────────

const CLASS_META = {
  investor: { label: 'INVESTOR', color: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)' },
  owner:    { label: 'OWNER',    color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.25)' },
  unknown:  { label: 'UNKNOWN',  color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.25)' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResultBanner({ result, loadingText }: { result: OpResult; loadingText: string }) {
  if (result.status === 'idle') return null;
  const styles = {
    loading: { border: 'border-slate-700',      bg: 'bg-slate-900/60',   text: 'text-slate-300',   glow: 'none' },
    success: { border: 'border-emerald-700/50', bg: 'bg-emerald-950/30', text: 'text-emerald-300', glow: '0 0 20px rgba(16,185,129,0.15)' },
    error:   { border: 'border-red-700/50',     bg: 'bg-red-950/30',     text: 'text-red-300',     glow: '0 0 20px rgba(239,68,68,0.10)' },
  }[result.status] ?? { border: 'border-slate-700', bg: 'bg-slate-900/60', text: 'text-slate-300', glow: 'none' };

  return (
    <div className={`relative rounded-xl border ${styles.border} ${styles.bg} p-4 space-y-2 overflow-hidden`}
      style={{ boxShadow: styles.glow }}>
      {result.status === 'loading' ? (
        <div className="flex items-center gap-3">
          <Loader className="w-5 h-5 text-slate-400 animate-spin" />
          <span className="text-sm font-bold text-slate-300">{loadingText}</span>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          {result.status === 'success'
            ? <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.6))' }} />
            : <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />}
          <div className="space-y-1">
            <p className={`text-sm font-bold ${styles.text}`}>{result.message}</p>
            {result.detail && <p className="text-xs text-slate-500 leading-relaxed">{result.detail}</p>}
            {result.status === 'success' && result.count != null && result.count > 0 && (
              <div className="flex items-center gap-2 pt-0.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs text-emerald-600 font-bold font-mono">
                  {result.count} {result.count === 1 ? 'entry' : 'entries'} found
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ onClick, disabled, loading, icon: Icon, label, accent }: {
  onClick: () => void; disabled: boolean; loading: boolean;
  icon: typeof Wifi; label: string; accent: string;
}) {
  const active = !disabled && !loading;
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: active ? `linear-gradient(135deg, ${accent}26, ${accent}1a)` : 'rgba(30,41,59,0.6)',
        border:     active ? `1px solid ${accent}59` : '1px solid rgba(51,65,85,0.5)',
        color:      active ? accent : '#475569',
        boxShadow:  active ? `0 0 16px ${accent}1e` : 'none',
      }}>
      {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

// ─── Property pill ────────────────────────────────────────────────────────────

function PropTypePill({ type }: { type: string }) {
  const colors: Record<string, string> = {
    select: '#f59e0b', multi_select: '#f97316', title: '#3b82f6',
    rich_text: '#6366f1', number: '#10b981', checkbox: '#ec4899',
    date: '#06b6d4', email: '#64748b', phone_number: '#64748b',
    url: '#8b5cf6', formula: '#a78bfa', status: '#f59e0b',
    missing: '#ef4444', unknown: '#ef4444',
  };
  const c = colors[type] ?? '#475569';
  return (
    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded"
      style={{ background: `${c}18`, color: c, border: `1px solid ${c}30` }}>
      {type}
    </span>
  );
}

// ─── Diagnose panel ───────────────────────────────────────────────────────────

function DiagnosePanel({
  result,
  onAutoSync,
}: {
  result: NotionDiagnoseResult;
  onAutoSync: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const hasMatch = result.investors > 0 && result.owners > 0;
  const unknownRows = result.rows.filter(r => r.classification === 'unknown');

  return (
    <div className="space-y-4">

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Rows fetched', value: result.total_rows, note: result.has_more ? '+more' : 'total', color: '#94a3b8' },
          { label: 'Investors',    value: result.investors,  note: 'Investidor',                         color: '#10b981' },
          { label: 'Owners',       value: result.owners,     note: 'Proprietário',                       color: '#3b82f6' },
          { label: 'Unknown',      value: result.skipped,    note: 'no valid Tipo',                      color: result.skipped > 0 ? '#f97316' : '#475569' },
        ].map(({ label, value, note, color }) => (
          <div key={label} className="rounded-xl border px-3 py-2.5 text-center"
            style={{ borderColor: `${color}25`, background: `${color}08` }}>
            <p className="text-xl font-black leading-none" style={{ color }}>{value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{label}</p>
            <p className="text-[9px] font-mono mt-0.5" style={{ color: `${color}80` }}>{note}</p>
          </div>
        ))}
      </div>

      {/* Schema detected */}
      {result.all_property_keys.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
            Property columns detected in this database
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.all_property_keys.map(k => (
              <span key={k} className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Unknown rows alert */}
      {unknownRows.length > 0 && (
        <div className="rounded-xl border border-orange-800/40 bg-orange-950/20 p-3 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-orange-300">
              {unknownRows.length} row{unknownRows.length !== 1 ? 's' : ''} could not be classified
            </p>
            <p className="text-orange-400/70 leading-relaxed">
              The "Tipo" column was not found or its value did not match{' '}
              <span className="font-mono">Investidor</span> / <span className="font-mono">Proprietário</span>.
              Expand a row below to see the raw property shape and fix the mapping.
            </p>
          </div>
        </div>
      )}

      {/* Auto-sync prompt */}
      {hasMatch && (
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-3 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-300">
              <span className="font-bold">{result.investors} investor{result.investors !== 1 ? 's' : ''}</span> and{' '}
              <span className="font-bold">{result.owners} owner{result.owners !== 1 ? 's' : ''}</span> detected.
              Sync now to push them to the Matching Engine.
            </p>
          </div>
          <button onClick={onAutoSync}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981' }}>
            <RefreshCw className="w-3 h-3" />
            Sync &amp; Match
          </button>
        </div>
      )}

      {/* Per-row table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80">
              {['', 'Name / Page ID', 'Tipo key', 'Prop type', 'Raw value', 'Parsed', 'Classification'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 font-black text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row: NotionDiagnoseRow, i: number) => {
              const meta = CLASS_META[row.classification];
              const isOpen = expanded === row.page_id;
              const nameProp = row.properties['Nome'] ?? row.properties['Name'];
              const displayName = nameProp?.parsedValue ?? `(row ${i + 1})`;
              return (
                <>
                  <tr key={row.page_id}
                    className={`border-b border-slate-800/40 transition-colors cursor-pointer ${
                      i % 2 === 0 ? 'bg-slate-900/20' : 'bg-slate-950/10'
                    } hover:bg-slate-800/30`}
                    onClick={() => setExpanded(isOpen ? null : row.page_id)}>
                    <td className="px-3 py-2">
                      {isOpen
                        ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-white font-bold truncate max-w-[130px]" title={displayName}>{displayName}</p>
                      <p className="text-slate-600 font-mono text-[9px] truncate max-w-[130px]">{row.page_id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-slate-400 text-[10px]">{row.tipo_key_found}</span>
                    </td>
                    <td className="px-3 py-2">
                      <PropTypePill type={row.tipo_prop_type} />
                    </td>
                    <td className="px-3 py-2 max-w-[140px]">
                      <span className="font-mono text-amber-300/80 text-[10px] truncate block" title={row.tipo_raw_summary}>
                        {row.tipo_raw_summary}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-[11px]" style={{ color: meta.color }}>
                        {row.tipo_parsed_value ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider"
                        style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                        {meta.label}
                      </span>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr key={`${row.page_id}-detail`}
                      className="border-b border-slate-800/40 bg-slate-900/50">
                      <td />
                      <td colSpan={6} className="px-4 pb-4 pt-2">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-1.5 text-[11px]">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tipo resolution</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-slate-500">Key found in Notion</span>
                            <span className="text-slate-300 font-mono">{row.tipo_key_found}</span>
                            <span className="text-slate-500">Property type</span>
                            <PropTypePill type={row.tipo_prop_type} />
                            <span className="text-slate-500">Raw summary</span>
                            <span className="text-slate-300 font-mono break-all">{row.tipo_raw_summary}</span>
                            <span className="text-slate-500">Parsed value</span>
                            <span className="text-amber-300 font-mono">{row.tipo_parsed_value ?? '(null)'}</span>
                            <span className="text-slate-500">Mapped to</span>
                            <span className="font-bold" style={{ color: CLASS_META[row.classification].color }}>
                              {row.tipo_mapped}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          Click any row to expand Tipo resolution detail
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotionSettingsPanel({
  playerId,
  leads,
  onLeadsSync,
}: {
  playerId: string;
  leads: Lead[];
  onLeadsSync: (leads: Lead[]) => void;
}) {
  const [dbId,        setDbId]       = useState('');
  const [saved,       setSaved]      = useState(false);
  const [testRes,     setTestRes]    = useState<OpResult>({ status: 'idle', message: '' });
  const [syncRes,     setSyncRes]    = useState<OpResult>({ status: 'idle', message: '' });
  const [syncing,     setSyncing]    = useState(false);
  const [diagnoseRes, setDiagnoseRes] = useState<NotionDiagnoseResult | null>(null);
  const [diagnosing,  setDiagnosing]  = useState(false);

  useEffect(() => { setDbId(getDatabaseId()); }, []);

  const validateDbId = (id: string): string | null => {
    if (!id.trim()) return 'Database ID is required';
    const clean = id.trim().replace(/-/g, '');
    if (clean.length !== 32 || !/^[0-9a-f]+$/i.test(clean))
      return 'Database ID should be 32 hex characters — copy it from the Notion database URL';
    return null;
  };

  const handleSave = () => {
    setDatabaseId(dbId.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    const err = validateDbId(dbId);
    if (err) { setTestRes({ status: 'error', message: err }); return; }
    setDatabaseId(dbId.trim());
    setTestRes({ status: 'loading', message: '' });
    const out = await testNotionConnection(dbId.trim());
    if (!out.ok) { setTestRes({ status: 'error', message: out.error ?? 'Connection failed' }); return; }
    const count = out.count ?? 0;
    setTestRes({
      status: 'success',
      message: count === 0 ? 'Connection successful — database is empty' : `Connection successful — ${count} row${count !== 1 ? 's' : ''} returned`,
      detail: count === 0 ? 'Database reached but contains no entries yet.' : 'Notion is reachable and the NOTION_API_KEY secret is valid.',
      count,
    });
  };

  const handleSync = async () => {
    const err = validateDbId(dbId);
    if (err) { setSyncRes({ status: 'error', message: err }); return; }
    setDatabaseId(dbId.trim());
    setSyncing(true);
    setSyncRes({ status: 'loading', message: '' });

    try {
      const result = await syncFromNotion(playerId);

      if (result.error) {
        setSyncRes({ status: 'error', message: result.error });
        return;
      }

      const freshLeads = await getLeads(playerId);
      onLeadsSync(freshLeads);

      setSyncRes({
        status: 'success',
        message: `${result.synced} lead${result.synced !== 1 ? 's' : ''} synced`,
        detail: result.message || `${result.synced} upserted, ${result.skipped} skipped.`,
        count: result.synced,
      });
    } catch (e) {
      console.error('[NotionSettingsPanel] handleSync error:', e);
      setSyncRes({ status: 'error', message: 'Unexpected error — check Notion connection and try again.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDiagnose = async () => {
    const err = validateDbId(dbId);
    if (err) { setTestRes({ status: 'error', message: err }); return; }
    setDatabaseId(dbId.trim());
    setDiagnosing(true);
    setDiagnoseRes(null);
    const out = await diagnoseNotion(playerId);
    setDiagnoseRes(out);
    setDiagnosing(false);
  };

  const canAct = dbId.trim().length > 0;

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center">
          <Settings className="w-5 h-5 text-amber-400" style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.5))' }} />
        </div>
        <div>
          <h2 className="text-base font-black text-white tracking-wide">Notion Connection</h2>
          <p className="text-xs text-slate-500">Connect your Notion Leads database to sync leads directly into the Matching Engine</p>
        </div>
      </div>

      {/* Leads counter */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: 'Leads in Platform',
            value: leads.length,
            color: leads.length > 0 ? '#10b981' : '#475569',
            note: leads.length > 0 ? 'active in matching engine' : 'sync from Notion to populate',
          },
          {
            label: 'Matching Engine',
            value: leads.length,
            color: leads.length > 0 ? '#3b82f6' : '#475569',
            note: leads.length > 0 ? 'leads loaded' : 'awaiting leads',
          },
        ].map(({ label, value, color, note }) => (
          <div key={label} className="rounded-xl border px-4 py-3 text-center"
            style={{ borderColor: `${color}25`, background: `${color}06` }}>
            <p className="text-2xl font-black leading-none" style={{ color }}>{value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest mt-1 text-slate-400">{label}</p>
            <p className="text-[9px] mt-0.5" style={{ color: `${color}70` }}>{note}</p>
          </div>
        ))}
      </div>

      {/* Sync success banner */}
      {syncRes.status === 'success' && syncRes.count != null && syncRes.count > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 flex items-center gap-3"
          style={{ boxShadow: '0 0 20px rgba(16,185,129,0.1)' }}>
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.6))' }} />
          <div>
            <p className="text-sm font-bold text-emerald-300">
              {syncRes.count} lead{syncRes.count !== 1 ? 's' : ''} synced to Swallow Empire
            </p>
            {syncRes.detail && <p className="text-xs text-emerald-600 mt-0.5">{syncRes.detail}</p>}
          </div>
        </div>
      )}

      {/* Security model */}
      <div className="rounded-xl border border-emerald-900/30 bg-slate-900/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Secure proxy architecture</span>
        </div>
        <div className="grid grid-cols-1 gap-2 pl-6">
          {[
            { icon: Lock,     label: 'API key never leaves the server',   detail: 'NOTION_API_KEY is stored as a Supabase secret — never in the browser or .env file.' },
            { icon: Database, label: 'All Notion requests are proxied',   detail: 'The frontend calls the notion-proxy Edge Function. Only mapped lead data is returned.' },
            { icon: Shield,   label: 'Only the Database ID is needed',    detail: 'No API key input is required or accepted from the client.' },
          ].map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex items-start gap-2">
              <Icon className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-300">{label}</span>
                <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Setup guide */}
      <div className="flex gap-3 bg-slate-900/50 border border-slate-800/60 rounded-xl p-4">
        <AlertTriangle className="w-4 h-4 text-amber-500/70 flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-xs text-slate-500 leading-relaxed">
          <p>
            <span className="text-slate-400 font-bold">Database ID: </span>
            Open your Leads database in Notion. Copy the 32-character ID from the URL:{' '}
            <span className="font-mono text-slate-400">notion.so/workspace/<span className="text-amber-500/80">DATABASE_ID</span>?v=…</span>
          </p>
          <p>
            <span className="text-slate-400 font-bold">Permissions: </span>
            Share the database with your integration (database "…" menu → Connect to).
          </p>
          <p>
            <span className="text-slate-400 font-bold">Required Tipo values: </span>
            <span className="font-mono">Investidor</span> or <span className="font-mono">Proprietário</span> (select column).
          </p>
        </div>
      </div>

      {/* Database ID input */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" />
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Leads Database ID</label>
        </div>
        <input type="text" value={dbId} onChange={e => setDbId(e.target.value)}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          spellCheck={false} autoComplete="off"
          className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-600/60 focus:ring-1 focus:ring-amber-600/20 transition-all"
        />
        <p className="text-xs text-slate-600 pl-6">32-character hex ID from the Notion database URL</p>
      </div>

      {/* Result banners */}
      <ResultBanner result={testRes} loadingText="Testing connection via secure proxy…" />
      {syncRes.status !== 'success' && <ResultBanner result={syncRes} loadingText="Syncing leads from Notion…" />}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <ActionButton onClick={handleTest} disabled={!canAct}
          loading={testRes.status === 'loading'} icon={Wifi} label="Test Connection" accent="#f59e0b" />
        <ActionButton onClick={handleSync} disabled={!canAct}
          loading={syncing} icon={RefreshCw} label="Sync Leads" accent="#10b981" />
        <ActionButton onClick={handleDiagnose} disabled={!canAct}
          loading={diagnosing} icon={Bug} label="Run Diagnose" accent="#a78bfa" />
        <button onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all">
          {saved ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Settings className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {getDatabaseId() && (
        <p className="text-xs text-slate-600 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 inline-block" />
          Database ID stored in browser localStorage (this device only).
        </p>
      )}

      {/* Diagnose panel */}
      {(diagnosing || diagnoseRes) && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)' }}>
              <Bug className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-300 tracking-wide">Notion Property Diagnostics</p>
              <p className="text-[10px] text-slate-500">
                First 10 rows · Email and Phone redacted · Expand any row for Tipo resolution detail
              </p>
            </div>
          </div>
          {diagnosing && (
            <div className="flex items-center gap-2.5 text-slate-400 text-xs py-4">
              <Loader className="w-4 h-4 animate-spin" />
              Querying Notion and parsing all property types…
            </div>
          )}
          {diagnoseRes && !diagnosing && (
            diagnoseRes.error
              ? <div className="flex items-start gap-2 text-xs text-red-400">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{diagnoseRes.error}</p>
                </div>
              : <DiagnosePanel result={diagnoseRes} onAutoSync={handleSync} />
          )}
        </div>
      )}
    </div>
  );
}
