import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Notion raw property shape ─────────────────────────────────────────────────

type NotionTextItem = { plain_text: string };
// deno-lint-ignore no-explicit-any
type NotionProp = { type: string; [key: string]: any };
type NotionRow = { id: string; properties: Record<string, NotionProp> };

// ─── parseNotionProperty ──────────────────────────────────────────────────────

export interface ParsedProperty {
  type: string;
  value: string | null;
  rawSummary: string;
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function parseNotionProperty(prop: NotionProp | undefined): ParsedProperty {
  if (!prop) return { type: "missing", value: null, rawSummary: "(property not found)" };
  const type = prop.type ?? "unknown";
  switch (type) {
    case "title": {
      const items: NotionTextItem[] = prop.title ?? [];
      const value = items.map((t) => t.plain_text).join("").trim() || null;
      return { type, value, rawSummary: truncate(`title[${items.length}]: ${value ?? "(empty)"}`) };
    }
    case "rich_text": {
      const items: NotionTextItem[] = prop.rich_text ?? [];
      const value = items.map((t) => t.plain_text).join("").trim() || null;
      return { type, value, rawSummary: truncate(`rich_text[${items.length}]: ${value ?? "(empty)"}`) };
    }
    case "select": {
      const sel = prop.select as { name: string; color?: string } | null;
      const value = sel?.name?.trim() ?? null;
      return { type, value, rawSummary: truncate(`select: ${value ?? "(null)"} color=${sel?.color ?? "?"}`) };
    }
    case "multi_select": {
      const items = (prop.multi_select ?? []) as { name: string }[];
      const names = items.map((s) => s.name.trim()).filter(Boolean);
      const value = names.length ? names.join(", ") : null;
      return { type, value, rawSummary: truncate(`multi_select[${names.length}]: ${value ?? "(empty)"}`) };
    }
    case "number": {
      const n = prop.number;
      const value = typeof n === "number" ? String(n) : null;
      return { type, value, rawSummary: `number: ${value ?? "(null)"}` };
    }
    case "checkbox": {
      const value = String(prop.checkbox ?? false);
      return { type, value, rawSummary: `checkbox: ${value}` };
    }
    case "date": {
      const d = prop.date as { start?: string; end?: string } | null;
      const value = d?.start ?? null;
      return { type, value, rawSummary: `date: start=${d?.start ?? "null"} end=${d?.end ?? "null"}` };
    }
    case "email": {
      const value = prop.email ? "(present)" : null;
      return { type, value, rawSummary: `email: ${prop.email ? "(present)" : "(null)"}` };
    }
    case "phone_number": {
      const value = prop.phone_number ? "(present)" : null;
      return { type, value, rawSummary: `phone_number: ${prop.phone_number ? "(present)" : "(null)"}` };
    }
    case "url": {
      const value = prop.url ? truncate(prop.url, 60) : null;
      return { type, value, rawSummary: `url: ${value ?? "(null)"}` };
    }
    case "formula": {
      const f = prop.formula as { type?: string; string?: string; number?: number };
      const value = f?.string ?? (f?.number != null ? String(f.number) : null);
      return { type, value, rawSummary: truncate(`formula(${f?.type ?? "?"}): ${value ?? "(null)"}`) };
    }
    case "status": {
      const s = prop.status as { name: string; color?: string } | null;
      const value = s?.name?.trim() ?? null;
      return { type, value, rawSummary: `status: ${value ?? "(null)"}` };
    }
    default:
      return { type, value: null, rawSummary: truncate(`${type}: (unsupported type)`) };
  }
}

// ─── Property key aliases ──────────────────────────────────────────────────────

const PROP_KEYS: Record<string, string[]> = {
  nome:           ["Nome", "Name", "nome", "name", "Full Name", "Contact"],
  empresa:        ["Empresa", "Company", "empresa", "company", "Organisation", "Organização"],
  email:          ["E-mail", "Email", "email", "e-mail"],
  telefone:       ["Telefone", "Phone", "telefone", "phone", "Mobile"],
  tipo:           ["Tipo", "tipo", "Type", "type", "Category", "Categoria", "Role"],
  status:         ["Status", "status", "Estado", "estado", "Stage", "Fase"],
  valor:          ["Valor Estimado", "Valor", "valor", "Estimated Value", "Asset Value", "Value", "Budget", "Orçamento"],
  ticketMin:      ["Ticket Min", "ticket_min", "Investment Min", "Min Investment", "Min", "Ticket Mínimo"],
  ticketMax:      ["Ticket Max", "ticket_max", "Investment Max", "Max Investment", "Max", "Ticket Máximo"],
  localizacao:    ["Localização", "Localizacao", "Location", "Locations", "Localidade", "City", "Cidade", "Region", "Região"],
  assetType:      ["Asset", "Assets", "Asset Type", "Asset Types", "Tipo de Ativo", "Tipo de Activo", "Tipo Ativo"],
  urgency:        ["Prioridade", "Urgência", "Urgencia", "Urgency", "urgency", "Priority"],
  numQuartos:     ["Nº Quartos", "Nº de Quartos", "Quartos", "Rooms", "Bedrooms"],
  lastContact:    ["Último Contacto", "Last Contact", "last_contact", "Último Contato"],
  nextFollowUp:   ["Próximo Follow-up", "Next Follow-up", "Follow-up", "next_follow_up", "Próximo Contacto"],
  notes:          ["Notas", "Notes", "notes", "Observações", "Observacoes", "Comments"],
  stars:          ["Stars", "stars", "Avaliação", "Avaliacao", "Rating"],
};

const SENSITIVE_KEYS = new Set(["email", "telefone"]);

function resolveProp(props: Record<string, NotionProp>, logicalKey: string): NotionProp | undefined {
  for (const alias of PROP_KEYS[logicalKey] ?? []) {
    if (props[alias] !== undefined) return props[alias];
  }
  return undefined;
}

// Returns the first matching Notion property name (key) for a logical key
function resolveKey(props: Record<string, NotionProp>, logicalKey: string): string | undefined {
  for (const alias of PROP_KEYS[logicalKey] ?? []) {
    if (props[alias] !== undefined) return alias;
  }
  return undefined;
}

// ─── Normalisation ────────────────────────────────────────────────────────────

const LOCATION_MAP: Record<string, string> = {
  "todas": "Todas",
  "lisboa": "Lisboa", "lisbon": "Lisboa",
  "porto": "Porto",
  "algarve": "Algarve",
  "cascais": "Cascais",
  "sintra": "Sintra",
  "braga": "Braga",
  "coimbra": "Coimbra",
  "évora": "Évora", "evora": "Évora",
  "faro": "Faro",
  "setúbal": "Setúbal", "setubal": "Setúbal",
  "aveiro": "Aveiro",
  "madeira": "Madeira",
  "açores": "Azores", "azores": "Azores",
  "douro": "Douro Valley", "douro valley": "Douro Valley",
  "alentejo": "Alentejo",
  "silver coast": "Silver Coast", "costa de prata": "Silver Coast",
  "óbidos": "Silver Coast",
};

const ASSET_MAP: Record<string, string> = {
  "boutique": "Boutique",
  "resort": "Resort",
  "hostel": "Hostel",
  "aparthotel": "Aparthotel", "apart-hotel": "Aparthotel",
  "pensão": "Pensão", "pensao": "Pensão", "pension": "Pensão",
  "heritage": "Heritage", "histórico": "Heritage", "historico": "Heritage",
  "rural": "Rural",
  "urbano": "Urban", "urban": "Urban",
  "beachfront": "Beachfront", "praia": "Beachfront",
  "wellness": "Wellness", "spa": "Wellness",
  "luxo": "Luxury", "luxury": "Luxury",
  "budget": "Budget", "económico": "Budget", "economico": "Budget",
  "business": "Business", "negócios": "Business", "negocios": "Business",
};

function normaliseList(raw: string[], map: Record<string, string>): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const key = r.toLowerCase().trim();
    const value = map[key] ?? r.trim();
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

function extractList(prop: NotionProp | undefined): string[] {
  if (!prop) return [];
  if (prop.type === "multi_select") {
    return ((prop.multi_select ?? []) as { name: string }[]).map((s) => s.name.trim()).filter(Boolean);
  }
  if (prop.type === "select") {
    return prop.select?.name ? [prop.select.name.trim()] : [];
  }
  const parsed = parseNotionProperty(prop);
  if (parsed.value) return parsed.value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function mapTipo(raw: string | null): "Investidor" | "Proprietário" | null {
  if (!raw) return null;
  const v = stripAccents(raw);
  if (v === "investidor" || v === "investor" || v.startsWith("invest")) return "Investidor";
  if (
    v === "proprietario" || v === "proprietário" || v === "owner" ||
    v.startsWith("propr") || v.includes("owner") || v.includes("vendedor") || v.includes("seller")
  ) return "Proprietário";
  return null;
}

function mapStatus(raw: string | null): "active" | "matched" | "closed" | "inactive" {
  if (!raw) return "active";
  const v = raw.toLowerCase();
  if (v.includes("active") || v.includes("ativo") || v.includes("ativa")) return "active";
  if (v.includes("match") || v.includes("apresent")) return "matched";
  if (v.includes("close") || v.includes("fechado") || v.includes("conclu")) return "closed";
  if (v.includes("inactive") || v.includes("inativo") || v.includes("arquiv")) return "inactive";
  return "active";
}

function mapUrgency(raw: string | null): "low" | "medium" | "high" | "urgent" {
  if (!raw) return "medium";
  const v = raw.toLowerCase();
  if (v.includes("urgent") || v.includes("urgente")) return "urgent";
  if (v.includes("high") || v.includes("alta") || v.includes("alto")) return "high";
  if (v.includes("low") || v.includes("baixa") || v.includes("baixo")) return "low";
  return "medium";
}

// ─── mapNotionLeadToSupabase ───────────────────────────────────────────────────

function extractRowFields(row: NotionRow) {
  const p = row.properties;

  const name         = parseNotionProperty(resolveProp(p, "nome")).value;
  const company      = parseNotionProperty(resolveProp(p, "empresa")).value;
  const emailProp    = resolveProp(p, "email") as NotionProp | undefined;
  const email        = parseNotionProperty(emailProp).value === "(present)" ? (emailProp?.email ?? null) : null;
  const phoneProp    = resolveProp(p, "telefone") as NotionProp | undefined;
  const phone        = parseNotionProperty(phoneProp).value === "(present)" ? (phoneProp?.phone_number ?? null) : null;
  const tipoRaw      = parseNotionProperty(resolveProp(p, "tipo")).value;
  const statusRaw    = parseNotionProperty(resolveProp(p, "status")).value;
  const urgencyRaw   = parseNotionProperty(resolveProp(p, "urgency")).value;
  const valorRaw     = parseNotionProperty(resolveProp(p, "valor")).value;
  const valorNum     = Number(valorRaw ?? 0) || 0;
  const tickMin      = Number(parseNotionProperty(resolveProp(p, "ticketMin")).value ?? 0) || 0;
  const tickMax      = Number(parseNotionProperty(resolveProp(p, "ticketMax")).value ?? 0) || 0;
  const locRaw       = extractList(resolveProp(p, "localizacao"));
  const assetRaw     = extractList(resolveProp(p, "assetType"));
  const rooms        = Number(parseNotionProperty(resolveProp(p, "numQuartos")).value ?? 0) || null;
  const lastContact  = parseNotionProperty(resolveProp(p, "lastContact")).value;
  const nextFollowUp = parseNotionProperty(resolveProp(p, "nextFollowUp")).value;
  const notes        = parseNotionProperty(resolveProp(p, "notes")).value;
  const stars        = Number(parseNotionProperty(resolveProp(p, "stars")).value ?? 0) || 0;
  const tipo         = mapTipo(tipoRaw);

  return {
    name, company, email, phone, tipoRaw, tipo, statusRaw, urgencyRaw,
    valorRaw, valorNum, tickMin, tickMax, locRaw, assetRaw,
    rooms, lastContact, nextFollowUp, notes, stars,
  };
}

function mapNotionLeadToSupabase(row: NotionRow, playerId: string) {
  const f = extractRowFields(row);
  if (!f.tipo) return null;

  return {
    notion_page_id:       row.id,
    player_id:            playerId,
    tipo:                 f.tipo,
    name:                 f.name ?? "Unnamed",
    company:              f.company ?? null,
    email:                f.email ?? null,
    phone:                f.phone ?? null,
    locations:            normaliseList(f.locRaw, LOCATION_MAP),
    asset_types:          normaliseList(f.assetRaw, ASSET_MAP),
    investment_min:       f.tipo === "Investidor" ? f.tickMin : 0,
    investment_max:       f.tipo === "Investidor" ? (f.tickMax || f.valorNum) : 0,
    estimated_value:      f.tipo === "Proprietário" ? f.valorNum : 0,
    urgency:              mapUrgency(f.urgencyRaw),
    notes:                f.notes ?? null,
    source:               "inbound" as const,
    status:               mapStatus(f.statusRaw),
    rooms:                f.rooms,
    stars:                f.stars,
    last_contact_at:      f.lastContact ?? null,
    next_follow_up:       f.nextFollowUp ?? null,
    notion_last_synced_at: new Date().toISOString(),
  };
}

// ─── mapSupabaseLeadToNotion ──────────────────────────────────────────────────
// Converts Supabase lead fields into Notion property patch format.
// Only includes fields that have a known Notion property name.

interface SupabaseLead {
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
}

function mapStatusToNotion(status: string): string {
  switch (status) {
    case "active":   return "Ativo";
    case "matched":  return "Match";
    case "closed":   return "Fechado";
    case "inactive": return "Inativo";
    default:         return status;
  }
}

function mapUrgencyToNotion(urgency: string): string {
  switch (urgency) {
    case "urgent": return "Urgente";
    case "high":   return "Alta";
    case "medium": return "Média";
    case "low":    return "Baixa";
    default:       return urgency;
  }
}

// Build Notion property patches from Supabase lead fields.
// existingProps is used to detect property types for correct formatting.
function mapSupabaseLeadToNotion(
  lead: SupabaseLead,
  existingProps: Record<string, NotionProp>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  function propType(logicalKey: string): string | undefined {
    return resolveProp(existingProps, logicalKey)?.type;
  }

  function setTextProp(logicalKey: string, value: string | null | undefined) {
    if (value == null) return;
    const key = resolveKey(existingProps, logicalKey);
    if (!key) return;
    const type = propType(logicalKey);
    if (type === "title") {
      patch[key] = { title: [{ text: { content: value } }] };
    } else if (type === "rich_text") {
      patch[key] = { rich_text: [{ text: { content: value } }] };
    }
  }

  function setSelectProp(logicalKey: string, value: string | null | undefined) {
    if (value == null) return;
    const key = resolveKey(existingProps, logicalKey);
    if (!key) return;
    const type = propType(logicalKey);
    if (type === "select" || type === "status") {
      patch[key] = { [type]: { name: value } };
    }
  }

  function setNumberProp(logicalKey: string, value: number | null | undefined) {
    if (value == null) return;
    const key = resolveKey(existingProps, logicalKey);
    if (!key) return;
    if (propType(logicalKey) === "number") {
      patch[key] = { number: value };
    }
  }

  function setMultiSelectProp(logicalKey: string, values: string[] | null | undefined) {
    if (!values?.length) return;
    const key = resolveKey(existingProps, logicalKey);
    if (!key) return;
    if (propType(logicalKey) === "multi_select") {
      patch[key] = { multi_select: values.map((v) => ({ name: v })) };
    }
  }

  function setDateProp(logicalKey: string, value: string | null | undefined) {
    if (value == null) return;
    const key = resolveKey(existingProps, logicalKey);
    if (!key) return;
    if (propType(logicalKey) === "date") {
      patch[key] = { date: { start: value } };
    }
  }

  if (lead.name) setTextProp("nome", lead.name);
  if (lead.company) setTextProp("empresa", lead.company);
  if (lead.notes) setTextProp("notes", lead.notes);
  if (lead.status) setSelectProp("status", mapStatusToNotion(lead.status));
  if (lead.urgency) setSelectProp("urgency", mapUrgencyToNotion(lead.urgency));
  if (lead.stars != null) setNumberProp("stars", lead.stars);
  if (lead.rooms != null) setNumberProp("numQuartos", lead.rooms);
  if (lead.last_contact_at) setDateProp("lastContact", lead.last_contact_at);
  if (lead.next_follow_up) setDateProp("nextFollowUp", lead.next_follow_up);
  if (lead.locations?.length) setMultiSelectProp("localizacao", lead.locations);
  if (lead.asset_types?.length) setMultiSelectProp("assetType", lead.asset_types);

  // Numeric value fields
  if (lead.estimated_value != null) setNumberProp("valor", lead.estimated_value);
  if (lead.investment_min != null) setNumberProp("ticketMin", lead.investment_min);
  if (lead.investment_max != null) setNumberProp("ticketMax", lead.investment_max);

  return patch;
}

// ─── Row mapper (legacy alias) ────────────────────────────────────────────────

function mapRow(row: NotionRow, playerId: string) {
  return mapNotionLeadToSupabase(row, playerId);
}

function mapRowDebug(row: NotionRow) {
  const f = extractRowFields(row);
  return {
    notion_page_id:  row.id,
    name:            f.name ?? "",
    empresa:         f.company ?? "",
    tipo_raw:        f.tipoRaw ?? "",
    tipo_mapped:     f.tipo ?? null,
    locations:       normaliseList(f.locRaw, LOCATION_MAP),
    asset_types:     normaliseList(f.assetRaw, ASSET_MAP),
    valor_estimado:  f.valorNum,
    status_raw:      f.statusRaw ?? "",
    rooms:           f.rooms,
    stars:           f.stars,
  };
}

// ─── Notion API helpers ────────────────────────────────────────────────────────

function notionErrorMessage(status: number, fallback: string): string {
  if (status === 401) return "Invalid Notion API key — update the NOTION_API_KEY secret in Supabase";
  if (status === 404) return "Database not found — check the database ID and share it with your integration";
  if (status === 403) return "Access denied — share the Notion database with your integration (… → Connect to)";
  return fallback;
}

async function notionQuery(
  apiKey: string,
  databaseId: string,
  pageSize: number,
  cursor?: string,
): Promise<{ results: NotionRow[]; has_more: boolean; next_cursor?: string }> {
  const body: Record<string, unknown> = { page_size: pageSize };
  if (cursor) body.start_cursor = cursor;

  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw { status: res.status, message: notionErrorMessage(res.status, err.message ?? `Notion error ${res.status}`) };
  }
  return res.json();
}

async function fetchAllRows(apiKey: string, databaseId: string): Promise<NotionRow[]> {
  const rows: NotionRow[] = [];
  let cursor: string | undefined;
  do {
    const page = await notionQuery(apiKey, databaseId, 100, cursor);
    rows.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return rows;
}

// Fetch a single Notion page to get its current properties
async function fetchNotionPage(apiKey: string, pageId: string): Promise<NotionRow> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw { status: res.status, message: notionErrorMessage(res.status, err.message ?? `Notion error ${res.status}`) };
  }
  return res.json();
}

// ─── updateLeadInNotion ───────────────────────────────────────────────────────

async function updateLeadInNotion(
  apiKey: string,
  pageId: string,
  lead: SupabaseLead,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Fetch current page to get property types for correct formatting
    const page = await fetchNotionPage(apiKey, pageId);
    const properties = mapSupabaseLeadToNotion(lead, page.properties);

    if (Object.keys(properties).length === 0) {
      return { ok: true }; // nothing to patch
    }

    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      return { ok: false, error: notionErrorMessage(res.status, err.message ?? `Notion error ${res.status}`) };
    }

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: (e as { message?: string }).message ?? "Unknown error updating Notion page" };
  }
}

// ─── Action handlers ───────────────────────────────────────────────────────────

async function handleTest(apiKey: string, databaseId: string) {
  const page = await notionQuery(apiKey, databaseId, 10);
  return { ok: true, count: page.results.length };
}

async function handleSync(apiKey: string, databaseId: string, playerId: string) {
  const rows = await fetchAllRows(apiKey, databaseId);
  const mapped = rows.map((r) => mapRow(r, playerId)).filter(Boolean) as NonNullable<ReturnType<typeof mapRow>>[];

  if (mapped.length === 0) {
    return { ok: true, synced: 0, skipped: rows.length, message: "No rows with a valid Tipo (Investidor/Proprietário) found" };
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { error, count } = await supabase
    .from("leads")
    .upsert(mapped, { onConflict: "notion_page_id", ignoreDuplicates: false, count: "exact" });

  if (error) {
    if (error.message.includes("notion_page_id")) {
      const stripped = mapped.map(({ notion_page_id: _id, ...rest }) => rest);
      const { error: e2, count: c2 } = await supabase
        .from("leads")
        .upsert(stripped, { onConflict: "player_id,name,tipo", ignoreDuplicates: false, count: "exact" });
      if (e2) throw e2;
      return { ok: true, synced: c2 ?? mapped.length, skipped: rows.length - mapped.length, message: "Leads synced successfully" };
    }
    throw error;
  }

  return { ok: true, synced: count ?? mapped.length, skipped: rows.length - mapped.length, message: "Leads synced successfully" };
}

async function handleDiagnose(apiKey: string, databaseId: string, playerId: string) {
  const page = await notionQuery(apiKey, databaseId, 10);
  const rows = page.results;

  const allKeysSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.properties)) allKeysSet.add(key);
  }
  const allPropertyKeys = [...allKeysSet].sort();

  const diagnosedRows = rows.map((row) => {
    const p = row.properties;

    const properties: Record<string, { type: string; rawSummary: string; parsedValue: string | null }> = {};
    for (const [key, prop] of Object.entries(p)) {
      const logicalKey = Object.entries(PROP_KEYS).find(([, aliases]) => aliases.includes(key))?.[0];
      const isSensitive = logicalKey !== undefined && SENSITIVE_KEYS.has(logicalKey);
      const parsed = parseNotionProperty(prop);
      properties[key] = {
        type:        parsed.type,
        rawSummary:  isSensitive ? "(redacted)" : parsed.rawSummary,
        parsedValue: isSensitive ? null : parsed.value,
      };
    }

    const tipoProp   = resolveProp(p, "tipo");
    const tipoParsed = parseNotionProperty(tipoProp);
    const tipoMapped = mapTipo(tipoParsed.value);
    const resolvedTipoKey = Object.keys(p).find((k) => PROP_KEYS.tipo.includes(k)) ?? "(not found)";

    const classification: "investor" | "owner" | "unknown" =
      tipoMapped === "Investidor" ? "investor" :
      tipoMapped === "Proprietário" ? "owner" : "unknown";

    return {
      page_id:           row.id,
      property_names:    Object.keys(p),
      tipo_key_found:    resolvedTipoKey,
      tipo_prop_type:    tipoParsed.type,
      tipo_raw_summary:  tipoParsed.rawSummary,
      tipo_parsed_value: tipoParsed.value,
      tipo_mapped:       tipoMapped ?? "(unclassified)",
      classification,
      properties,
    };
  });

  const mapped    = rows.map((r) => mapRow(r, playerId));
  const investors = mapped.filter((r) => r?.tipo === "Investidor").length;
  const owners    = mapped.filter((r) => r?.tipo === "Proprietário").length;
  const skipped   = mapped.filter((r) => r === null).length;

  const allAssets    = new Set<string>();
  const allLocations = new Set<string>();
  for (const row of rows) {
    extractList(resolveProp(row.properties, "assetType")).forEach((v) => allAssets.add(v));
    extractList(resolveProp(row.properties, "localizacao")).forEach((v) => allLocations.add(v));
  }

  const allTipos = new Set<string>();
  for (const row of rows) {
    const v = parseNotionProperty(resolveProp(row.properties, "tipo")).value;
    if (v) allTipos.add(v);
  }

  return {
    ok:                 true,
    total_rows:         rows.length,
    has_more:           page.has_more,
    all_property_keys:  allPropertyKeys,
    investors,
    owners,
    skipped,
    rows:               diagnosedRows,
    unique_tipos:       [...allTipos],
    unique_assets:      [...allAssets],
    unique_locations:   [...allLocations],
  };
}

async function handlePreview(apiKey: string, databaseId: string) {
  const rows   = await fetchAllRows(apiKey, databaseId);
  const parsed = rows.map((r) => mapRowDebug(r));

  const investors = parsed.filter((r) => r.tipo_mapped === "Investidor").length;
  const owners    = parsed.filter((r) => r.tipo_mapped === "Proprietário").length;
  const unknown   = parsed.filter((r) => r.tipo_mapped === null).length;

  return {
    ok:           true,
    raw_count:    rows.length,
    parsed_count: parsed.length,
    investors,
    owners,
    unknown,
    rows:         parsed,
  };
}

// ─── handleUpdateNotion ───────────────────────────────────────────────────────
// Called when a lead is edited in Bolt: updates Supabase first (caller's
// responsibility), then patches the matching Notion page.
// Conflict resolution: latest-update-wins using bolt_last_updated_at vs notion_last_synced_at.

async function handleUpdateNotion(
  apiKey: string,
  lead: SupabaseLead & { notion_page_id: string; bolt_last_updated_at?: string; notion_last_synced_at?: string },
) {
  const { notion_page_id } = lead;
  if (!notion_page_id) {
    return { ok: false, error: "notion_page_id is required to update Notion" };
  }

  // Conflict guard: if Notion was synced more recently than the Bolt update,
  // skip the write-back to avoid overwriting a fresher Notion edit.
  if (lead.bolt_last_updated_at && lead.notion_last_synced_at) {
    const boltTime   = new Date(lead.bolt_last_updated_at).getTime();
    const notionTime = new Date(lead.notion_last_synced_at).getTime();
    if (notionTime > boltTime) {
      return {
        ok:      false,
        skipped: true,
        reason:  "Notion record is newer than the Bolt edit — skipping write-back to avoid overwrite",
      };
    }
  }

  return updateLeadInNotion(apiKey, notion_page_id, lead);
}

// ─── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("NOTION_API_KEY") ?? Deno.env.get("NOTION_TOKEN") ?? null;

    const url = new URL(req.url);
    if (url.pathname.endsWith("/debug") || url.searchParams.get("action") === "debug") {
      return new Response(JSON.stringify({
        NOTION_API_KEY_exists: apiKey !== null,
        token_prefix:          apiKey ? apiKey.slice(0, 4) : null,
        NOTION_API_KEY_length: apiKey?.length ?? 0,
        valid_format:          apiKey
          ? (apiKey.startsWith("ntn_") || apiKey.startsWith("secr") || apiKey.startsWith("secret_"))
          : false,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "NOTION_API_KEY secret is not configured. Add it via: supabase secrets set NOTION_API_KEY=ntn_xxx" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json() as {
      action: "test" | "sync" | "diagnose" | "preview" | "update_notion";
      databaseId?: string;
      playerId?: string;
      lead?: SupabaseLead & { notion_page_id: string; bolt_last_updated_at?: string; notion_last_synced_at?: string };
    };

    const { action } = body;
    if (!action) {
      return new Response(
        JSON.stringify({ error: "action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const respond = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (action === "test") {
      if (!body.databaseId) return respond({ error: "databaseId is required for test" }, 400);
      try { return respond(await handleTest(apiKey, body.databaseId)); }
      catch (e: unknown) { return respond({ ok: false, error: (e as { message?: string }).message ?? "Test failed" }, 502); }
    }

    if (action === "sync") {
      if (!body.databaseId) return respond({ error: "databaseId is required for sync" }, 400);
      if (!body.playerId) return respond({ error: "playerId is required for sync" }, 400);
      try { return respond(await handleSync(apiKey, body.databaseId, body.playerId)); }
      catch (e: unknown) { return respond({ ok: false, error: (e as { message?: string }).message ?? "Sync failed" }, 502); }
    }

    if (action === "diagnose") {
      if (!body.databaseId) return respond({ error: "databaseId is required for diagnose" }, 400);
      const playerId = body.playerId ?? "diagnose";
      try { return respond(await handleDiagnose(apiKey, body.databaseId, playerId)); }
      catch (e: unknown) { return respond({ ok: false, error: (e as { message?: string }).message ?? "Diagnose failed" }, 502); }
    }

    if (action === "preview") {
      if (!body.databaseId) return respond({ error: "databaseId is required for preview" }, 400);
      try { return respond(await handlePreview(apiKey, body.databaseId)); }
      catch (e: unknown) { return respond({ ok: false, error: (e as { message?: string }).message ?? "Preview failed" }, 502); }
    }

    if (action === "update_notion") {
      if (!body.lead?.notion_page_id) return respond({ error: "lead.notion_page_id is required for update_notion" }, 400);
      try { return respond(await handleUpdateNotion(apiKey, body.lead)); }
      catch (e: unknown) { return respond({ ok: false, error: (e as { message?: string }).message ?? "Update Notion failed" }, 502); }
    }

    return respond({ error: `Unknown action: ${action}` }, 400);

  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: (err as { message?: string }).message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
