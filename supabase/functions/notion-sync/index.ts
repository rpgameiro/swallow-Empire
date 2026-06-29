import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Notion property extraction helpers ────────────────────────────────────────

type NotionProp = {
  type: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  email?: string;
  phone_number?: string;
  number?: number;
  select?: { name: string };
  multi_select?: { name: string }[];
};

type NotionRow = {
  id: string;
  properties: Record<string, NotionProp>;
};

function getText(prop: NotionProp | undefined): string | null {
  if (!prop) return null;
  if (prop.type === "title" && prop.title?.length)
    return prop.title.map((t) => t.plain_text).join("").trim() || null;
  if (prop.type === "rich_text" && prop.rich_text?.length)
    return prop.rich_text.map((t) => t.plain_text).join("").trim() || null;
  if (prop.type === "email") return prop.email ?? null;
  if (prop.type === "phone_number") return prop.phone_number ?? null;
  return null;
}

function getNumber(prop: NotionProp | undefined): number {
  if (!prop || prop.type !== "number") return 0;
  return typeof prop.number === "number" ? prop.number : 0;
}

function getSelect(prop: NotionProp | undefined): string | null {
  if (!prop || prop.type !== "select") return null;
  return prop.select?.name ?? null;
}

function getMultiSelect(prop: NotionProp | undefined): string[] {
  if (!prop || prop.type !== "multi_select") return [];
  return (prop.multi_select ?? []).map((s) => s.name);
}

// ── Normalisation maps ─────────────────────────────────────────────────────

const LOCATION_MAP: Record<string, string> = {
  "lisboa": "Lisbon", "lisbon": "Lisbon",
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
  "boutique": "boutique", "resort": "resort", "hostel": "hostel",
  "aparthotel": "aparthotel", "apart-hotel": "aparthotel",
  "pensão": "pension", "pensao": "pension", "pension": "pension",
  "heritage": "heritage", "histórico": "heritage",
  "rural": "rural", "urbano": "urban", "urban": "urban",
  "beachfront": "beachfront", "praia": "beachfront",
  "wellness": "wellness", "spa": "wellness",
  "luxo": "luxury", "luxury": "luxury",
  "budget": "budget", "económico": "budget",
  "business": "business", "negócios": "business",
};

function normaliseLocations(raw: string[]): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const key = r.toLowerCase().trim();
    const mapped = LOCATION_MAP[key];
    const value = mapped ?? r.trim();
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

function normaliseAssetTypes(raw: string[]): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const key = r.toLowerCase().trim();
    const mapped = ASSET_MAP[key];
    const value = mapped ?? r.trim();
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

function mapStatus(raw: string | null): string {
  if (!raw) return "active";
  const v = raw.toLowerCase();
  if (v.includes("active") || v.includes("ativo") || v.includes("ativa")) return "active";
  if (v.includes("match") || v.includes("apresent")) return "matched";
  if (v.includes("close") || v.includes("fechado") || v.includes("conclu")) return "closed";
  if (v.includes("inactive") || v.includes("inativo") || v.includes("arquiv")) return "inactive";
  return "active";
}

function mapTipo(raw: string | null): "Investidor" | "Proprietário" | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.includes("invest")) return "Investidor";
  if (v.includes("propr") || v.includes("owner") || v.includes("vendedor")) return "Proprietário";
  return null;
}

function mapRow(row: NotionRow, playerId: string) {
  const p = row.properties;

  const name     = getText(p["Nome"] ?? p["Name"] ?? p["nome"]);
  const company  = getText(p["Empresa"] ?? p["Company"] ?? p["empresa"]);
  const email    = getText(p["Email"] ?? p["email"] ?? p["E-mail"]);
  const phone    = getText(p["Telefone"] ?? p["Phone"] ?? p["telefone"]);
  const rawTipo  = getSelect(p["Tipo"] ?? p["tipo"]) ?? getText(p["Tipo"] ?? p["tipo"]);
  const rawStatus = getSelect(p["Status"] ?? p["status"] ?? p["Estado"]) ?? getText(p["Status"] ?? p["status"]);
  const estimVal = getNumber(p["Valor Estimado"] ?? p["Estimated Value"] ?? p["Valor"]);
  const tickMin  = getNumber(p["Ticket Min"] ?? p["ticket_min"] ?? p["Investment Min"]);
  const tickMax  = getNumber(p["Ticket Max"] ?? p["ticket_max"] ?? p["Investment Max"]);

  // Localização: accept multi-select, select, or comma-separated rich text
  const locProp = p["Localização"] ?? p["Localizacao"] ?? p["Location"] ?? p["Locations"];
  const locRaw = [
    ...getMultiSelect(locProp),
    ...(getSelect(locProp) ? [getSelect(locProp)!] : []),
    ...(getText(locProp) ? getText(locProp)!.split(",").map((s) => s.trim()) : []),
  ].filter(Boolean) as string[];

  // Asset Type: same treatment
  const assetProp = p["Asset Type"] ?? p["Asset Types"] ?? p["Tipo de Ativo"];
  const assetRaw = [
    ...getMultiSelect(assetProp),
    ...(getSelect(assetProp) ? [getSelect(assetProp)!] : []),
    ...(getText(assetProp) ? getText(assetProp)!.split(",").map((s) => s.trim()) : []),
  ].filter(Boolean) as string[];

  const tipo = mapTipo(rawTipo);
  if (!tipo) return null;

  return {
    notion_page_id:  row.id,
    player_id:       playerId,
    tipo,
    name:            name ?? "Unnamed",
    company,
    email,
    phone,
    locations:       normaliseLocations(locRaw),
    asset_types:     normaliseAssetTypes(assetRaw),
    investment_min:  tickMin,
    investment_max:  tickMax,
    estimated_value: estimVal,
    urgency:         "medium" as const,
    notes:           null as null,
    source:          "inbound" as const,
    status:          mapStatus(rawStatus) as "active" | "matched" | "closed" | "inactive",
  };
}

// ── Notion pagination ─────────────────────────────────────────────────────

async function fetchAllRows(apiKey: string, databaseId: string): Promise<NotionRow[]> {
  const rows: NotionRow[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw { status: res.status, message: err.message ?? `Notion API error ${res.status}` };
    }

    const data = await res.json() as {
      results: NotionRow[];
      has_more: boolean;
      next_cursor?: string;
    };
    rows.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return rows;
}

// ── Friendly Notion error messages ────────────────────────────────────────

function notionErrorMessage(status: number, fallback: string): string {
  if (status === 401) return "Invalid Notion API key — check your integration token";
  if (status === 404) return "Database not found — share it with your integration in Notion";
  if (status === 403) return "Access denied — share the database with your integration";
  return fallback;
}

// ── Handlers ──────────────────────────────────────────────────────────────

async function handleTest(apiKey: string, databaseId: string) {
  // Fetch just one page to verify credentials cheaply
  const res = await fetch(
    `https://api.notion.com/v1/databases/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 10 }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    return {
      ok: false,
      status: res.status,
      error: notionErrorMessage(res.status, err.message ?? `Notion API error ${res.status}`),
    };
  }

  const data = await res.json() as { results: unknown[] };
  const count = data.results?.length ?? 0;
  return { ok: true, count };
}

async function handleSync(apiKey: string, databaseId: string, playerId: string) {
  let rows: NotionRow[];
  try {
    rows = await fetchAllRows(apiKey, databaseId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return {
      ok: false,
      error: notionErrorMessage(err.status ?? 500, err.message ?? "Failed to reach Notion"),
      notion_status: err.status,
    };
  }

  const mapped = rows.map((r) => mapRow(r, playerId)).filter(Boolean) as NonNullable<ReturnType<typeof mapRow>>[];

  if (mapped.length === 0) {
    return {
      ok: true,
      synced: 0,
      skipped: rows.length,
      message: "No rows with a valid Tipo (Investidor/Proprietário) found",
    };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error, count } = await supabase
    .from("leads")
    .upsert(mapped, {
      onConflict: "notion_page_id",
      ignoreDuplicates: false,
      count: "exact",
    });

  if (error) {
    // Fallback: upsert without notion_page_id if column doesn't exist yet
    if (error.message.includes("notion_page_id")) {
      const stripped = mapped.map(({ notion_page_id: _id, ...rest }) => rest);
      const { error: e2, count: c2 } = await supabase
        .from("leads")
        .upsert(stripped, {
          onConflict: "player_id,name,tipo",
          ignoreDuplicates: false,
          count: "exact",
        });
      if (e2) throw e2;
      return { ok: true, synced: c2 ?? mapped.length, skipped: rows.length - mapped.length, message: "Leads synced successfully" };
    }
    throw error;
  }

  return { ok: true, synced: count ?? mapped.length, skipped: rows.length - mapped.length, message: "Leads synced successfully" };
}

// ── Entry point ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      action: "test" | "sync";
      apiKey: string;
      databaseId: string;
      playerId?: string;
    };

    const { action, apiKey, databaseId } = body;

    if (!action || !apiKey || !databaseId) {
      return new Response(
        JSON.stringify({ error: "action, apiKey, and databaseId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "test") {
      const result = await handleTest(apiKey, databaseId);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync") {
      const { playerId } = body;
      if (!playerId) {
        return new Response(
          JSON.stringify({ error: "playerId is required for sync" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const result = await handleSync(apiKey, databaseId, playerId);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const e = err as { message?: string };
    return new Response(
      JSON.stringify({ error: e.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
