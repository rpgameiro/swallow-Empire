const LS_KEY_DB = 'notion_leads_db_id';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export interface NotionSyncResult {
  synced: number;
  skipped: number;
  message: string;
  error?: string;
}

export interface NotionTestResult {
  ok: boolean;
  count?: number;
  error?: string;
}

export interface DiagnosedProperty {
  type: string;
  rawSummary: string;
  parsedValue: string | null;
}

export interface NotionDiagnoseRow {
  page_id: string;
  property_names: string[];
  tipo_key_found: string;
  tipo_prop_type: string;
  tipo_raw_summary: string;
  tipo_parsed_value: string | null;
  tipo_mapped: string;
  classification: 'investor' | 'owner' | 'unknown';
  properties: Record<string, DiagnosedProperty>;
}

export interface NotionDiagnoseResult {
  ok: boolean;
  total_rows: number;
  has_more: boolean;
  all_property_keys: string[];
  investors: number;
  owners: number;
  skipped: number;
  rows: NotionDiagnoseRow[];
  // Debug extras returned by the edge function
  unique_tipos?: string[];
  unique_assets?: string[];
  unique_locations?: string[];
  error?: string;
}

const DIAGNOSE_ERROR = (error: string): NotionDiagnoseResult => ({
  ok: false, total_rows: 0, has_more: false, all_property_keys: [],
  investors: 0, owners: 0, skipped: 0, rows: [], error,
});

export function getDatabaseId(): string {
  return localStorage.getItem(LS_KEY_DB) ?? '';
}

export function setDatabaseId(id: string): void {
  localStorage.setItem(LS_KEY_DB, id);
}

export function hasDatabaseId(): boolean {
  return getDatabaseId().length > 0;
}

async function callProxy(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${SUPABASE_URL}/functions/v1/notion-proxy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function testNotionConnection(databaseId: string): Promise<NotionTestResult> {
  try {
    const res = await callProxy({ action: 'test', databaseId });
    const data = await res.json() as NotionTestResult & { error?: string };
    if (!res.ok || data.error) return { ok: false, error: data.error ?? `Server error (${res.status})` };
    return data;
  } catch {
    return { ok: false, error: 'Could not reach the Supabase Edge Function. Check your network connection.' };
  }
}

export async function diagnoseNotion(playerId: string): Promise<NotionDiagnoseResult> {
  const databaseId = getDatabaseId();
  if (!databaseId) return DIAGNOSE_ERROR('No Database ID configured.');
  try {
    const res = await callProxy({ action: 'diagnose', databaseId, playerId });
    const data = await res.json() as NotionDiagnoseResult & { error?: string };
    if (!res.ok || data.error) return DIAGNOSE_ERROR(data.error ?? `Server error (${res.status})`);
    return data;
  } catch {
    return DIAGNOSE_ERROR('Could not reach the Supabase Edge Function.');
  }
}

export interface NotionPreviewRow {
  notion_page_id: string;
  name: string;
  empresa: string;
  tipo_raw: string;
  tipo_mapped: 'Investidor' | 'Proprietário' | null;
  locations: string[];
  asset_types: string[];
  valor_estimado: number;
  status_raw: string;
}

export interface NotionPreviewResult {
  ok: boolean;
  raw_count: number;
  parsed_count: number;
  investors: number;
  owners: number;
  unknown: number;
  rows: NotionPreviewRow[];
  error?: string;
}

export async function previewFromNotion(databaseId: string): Promise<NotionPreviewResult> {
  const empty: NotionPreviewResult = { ok: false, raw_count: 0, parsed_count: 0, investors: 0, owners: 0, unknown: 0, rows: [] };
  if (!databaseId) return { ...empty, error: 'No Database ID configured.' };
  try {
    const res  = await callProxy({ action: 'preview', databaseId });
    const data = await res.json() as NotionPreviewResult & { error?: string };
    if (!res.ok || data.error) return { ...empty, error: data.error ?? `Server error (${res.status})` };
    return data;
  } catch {
    return { ...empty, error: 'Could not reach the Supabase Edge Function.' };
  }
}

export async function syncFromNotion(playerId: string): Promise<NotionSyncResult> {
  const databaseId = getDatabaseId();
  if (!databaseId) {
    return { synced: 0, skipped: 0, message: '', error: 'Notion Database ID not configured. Set it in Leads → Notion Settings.' };
  }
  try {
    const res = await callProxy({ action: 'sync', databaseId, playerId });
    const data = await res.json() as NotionSyncResult & { error?: string };
    if (!res.ok || data.error) return { synced: 0, skipped: 0, message: '', error: data.error ?? `Server error (${res.status})` };
    return data;
  } catch {
    return { synced: 0, skipped: 0, message: '', error: 'Could not reach the Supabase Edge Function. Check your network connection.' };
  }
}

// ─── Lead fields that can be written back to Notion ──────────────────────────

export interface LeadNotionUpdate {
  notion_page_id: string;
  name?: string | null;
  company?: string | null;
  status?: string | null;
  urgency?: string | null;
  estimated_value?: number | null;
  investment_min?: number | null;
  investment_max?: number | null;
  locations?: string[] | null;
  asset_types?: string[] | null;
  notes?: string | null;
  stars?: number | null;
  rooms?: number | null;
  last_contact_at?: string | null;
  next_follow_up?: string | null;
  bolt_last_updated_at?: string | null;
  notion_last_synced_at?: string | null;
}

export interface UpdateNotionResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Pushes a Bolt lead edit back to the matching Notion page.
 * Requires the lead to have a notion_page_id.
 * If Notion is newer than the Bolt edit, the write-back is skipped (conflict guard).
 */
export async function updateLeadFromBolt(lead: LeadNotionUpdate): Promise<UpdateNotionResult> {
  if (!lead.notion_page_id) {
    return { ok: false, error: 'Lead has no notion_page_id — cannot write back to Notion.' };
  }
  try {
    const res = await callProxy({ action: 'update_notion', lead });
    const data = await res.json() as UpdateNotionResult & { error?: string };
    if (!res.ok && !data.skipped) {
      return { ok: false, error: data.error ?? `Server error (${res.status})` };
    }
    return data;
  } catch {
    return { ok: false, error: 'Could not reach the Supabase Edge Function. Check your network connection.' };
  }
}
