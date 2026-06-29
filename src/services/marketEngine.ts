import { supabase } from './supabase';
import { DistrictMarketData, DistrictEvent, TrendDirection } from '../types/game';

// ─── Fetch ─────────────────────────────────────────────────────────────────

export const getDistrictMarketData = async (): Promise<DistrictMarketData[]> => {
  const { data, error } = await supabase.from('district_market_data').select('*');
  if (error) throw error;
  return data ?? [];
};

export const getDistrictEvents = async (maxAgeHours = 72): Promise<DistrictEvent[]> => {
  const since = new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('district_events')
    .select('*')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

// ─── Evolution engine ──────────────────────────────────────────────────────

const clamp = (v: number) => Math.max(0, Math.min(100, v));

const jitter = (range: number) => (Math.random() - 0.5) * range * 2;

type Indicator = keyof Pick<DistrictMarketData,
  'market_temp' | 'opportunities' | 'competition' | 'investor_activity' | 'tourism_growth' | 'luxury_demand'>;

const INDICATORS: Indicator[] = [
  'market_temp', 'opportunities', 'competition',
  'investor_activity', 'tourism_growth', 'luxury_demand',
];

// Returns new trend direction based on average momentum
const computeTrend = (deltas: number[]): TrendDirection => {
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, b) => a + (b - avg) ** 2, 0) / deltas.length;
  if (variance > 40) return 'volatile';
  if (avg > 3)  return 'rising';
  if (avg < -3) return 'falling';
  return 'stable';
};

export const evolveDistrict = async (market: DistrictMarketData): Promise<DistrictMarketData> => {
  const now = new Date();
  const lastEvolved = new Date(market.last_evolved_at);
  const minutesSince = (now.getTime() - lastEvolved.getTime()) / 60000;

  // Only evolve once every 2 real minutes (keeps data fresh without hammering DB)
  if (minutesSince < 2) return market;

  const magnitude = Math.min(minutesSince / 5, 8); // cap drift at 8 pts per tick
  const deltas: number[] = [];

  const updates: Partial<DistrictMarketData> = {};

  for (const key of INDICATORS) {
    const current = market[key] as number;
    let delta: number;

    switch (market.trend_direction) {
      case 'rising':   delta = jitter(4) + magnitude * 0.4; break;
      case 'falling':  delta = jitter(4) - magnitude * 0.4; break;
      case 'volatile': delta = jitter(10); break;
      default:         delta = jitter(3); break;
    }

    // Mean-reversion — values pulled toward 50 softly
    delta += (50 - current) * 0.03;

    const next = clamp(current + delta);
    (updates as Record<string, number>)[key] = Math.round(next);
    deltas.push(next - current);
  }

  updates.trend_direction = computeTrend(deltas);
  updates.last_evolved_at = now.toISOString();

  const { data, error } = await supabase
    .from('district_market_data')
    .update(updates)
    .eq('id', market.id)
    .select()
    .single();

  if (error) return market;
  return data;
};

// ─── Event generation ──────────────────────────────────────────────────────

const EVENT_POOL: Array<{
  event_type: string;
  severity: DistrictEvent['severity'];
  title: string;
  description: string;
  trigger: (m: DistrictMarketData) => boolean;
  impact: Record<string, number>;
  expiryHours: number;
}> = [
  {
    event_type: 'market_surge',
    severity: 'opportunity',
    title: 'Market Surge',
    description: 'Buyer demand is outpacing supply. Pricing power is firmly with sellers.',
    trigger: m => m.market_temp > 80 && m.trend_direction === 'rising',
    impact: { opportunities: 10, investor_activity: 8 },
    expiryHours: 48,
  },
  {
    event_type: 'tourism_boom',
    severity: 'opportunity',
    title: 'Tourism Boom',
    description: 'Record visitor numbers are driving exceptional hotel operating performance.',
    trigger: m => m.tourism_growth > 85,
    impact: { luxury_demand: 12, opportunities: 8 },
    expiryHours: 72,
  },
  {
    event_type: 'luxury_hotspot',
    severity: 'opportunity',
    title: 'Luxury Hotspot Emerging',
    description: 'Ultra-HNW buyers are circling this market. Trophy asset premiums up 20%.',
    trigger: m => m.luxury_demand > 82 && m.investor_activity > 70,
    impact: { luxury_demand: 10, market_temp: 8 },
    expiryHours: 36,
  },
  {
    event_type: 'foreign_capital',
    severity: 'opportunity',
    title: 'Foreign Capital Influx',
    description: 'International investors are making aggressive moves in this district.',
    trigger: m => m.investor_activity > 88,
    impact: { market_temp: 10, competition: 12 },
    expiryHours: 48,
  },
  {
    event_type: 'off_market_window',
    severity: 'opportunity',
    title: 'Off-Market Window',
    description: 'Several owners are quietly testing interest before formally listing.',
    trigger: m => m.opportunities > 80 && m.competition < 50,
    impact: { opportunities: 15 },
    expiryHours: 24,
  },
  {
    event_type: 'competition_spike',
    severity: 'warning',
    title: 'Competition Intensifying',
    description: 'Multiple advisors are targeting the same assets. Margins are compressing.',
    trigger: m => m.competition > 85,
    impact: { opportunities: -8, market_temp: 5 },
    expiryHours: 48,
  },
  {
    event_type: 'market_cooling',
    severity: 'warning',
    title: 'Market Cooling',
    description: 'Transaction volumes falling. Buyers are becoming more selective.',
    trigger: m => m.market_temp < 30 && m.trend_direction === 'falling',
    impact: { opportunities: -12, investor_activity: -10 },
    expiryHours: 72,
  },
  {
    event_type: 'regulatory_risk',
    severity: 'alert',
    title: 'Regulatory Headwinds',
    description: 'Proposed zoning or licensing changes are creating uncertainty for buyers.',
    trigger: m => m.opportunities < 30 && m.competition < 40,
    impact: { opportunities: -8, investor_activity: -6 },
    expiryHours: 96,
  },
  {
    event_type: 'distressed_assets',
    severity: 'opportunity',
    title: 'Distressed Assets Emerging',
    description: 'Overleveraged operators are beginning to explore exit strategies.',
    trigger: m => m.opportunities > 70 && m.market_temp < 45,
    impact: { opportunities: 18, luxury_demand: -5 },
    expiryHours: 36,
  },
  {
    event_type: 'eco_tourism',
    severity: 'info',
    title: 'Eco-Tourism Wave',
    description: 'Sustainable travel demand is reshaping the hospitality offering here.',
    trigger: m => m.tourism_growth > 70 && m.luxury_demand < 60,
    impact: { tourism_growth: 8, opportunities: 6 },
    expiryHours: 48,
  },
  {
    event_type: 'infrastructure',
    severity: 'info',
    title: 'Infrastructure Investment',
    description: 'New transport links announced, boosting accessibility and long-term appeal.',
    trigger: m => m.investor_activity > 65 && m.tourism_growth > 55,
    impact: { market_temp: 6, tourism_growth: 10 },
    expiryHours: 96,
  },
];

export const maybeGenerateEvent = async (
  market: DistrictMarketData,
  existingEvents: DistrictEvent[]
): Promise<DistrictEvent | null> => {
  // Don't spam — max 1 new event per district per hour
  const recentCutoff = Date.now() - 60 * 60 * 1000;
  const recentCount = existingEvents.filter(
    e => e.district_id === market.district_id && new Date(e.created_at).getTime() > recentCutoff
  ).length;
  if (recentCount > 0) return null;

  // 25% base chance per evolution tick
  if (Math.random() > 0.25) return null;

  const triggered = EVENT_POOL.filter(e => e.trigger(market));
  if (triggered.length === 0) return null;

  const template = triggered[Math.floor(Math.random() * triggered.length)];

  const { data, error } = await supabase
    .from('district_events')
    .insert([{
      district_id:  market.district_id,
      event_type:   template.event_type,
      severity:     template.severity,
      title:        template.title,
      description:  template.description,
      impact:       template.impact,
      expires_at:   new Date(Date.now() + template.expiryHours * 3600 * 1000).toISOString(),
    }])
    .select()
    .single();

  if (error) return null;
  return data;
};
