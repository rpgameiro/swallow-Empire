import { supabase } from './supabase';
import {
  NPC, PlayerNPCRelationship, NPCDialogue, NPCDialogueChoice,
  RelationshipStatus, NPCPersonality,
} from '../types/game';

// ─── Supabase data layer ──────────────────────────────────────────────────────

export const getAllNPCs = async (): Promise<NPC[]> => {
  const { data, error } = await supabase.from('npcs').select('*').order('min_player_level');
  if (error) throw error;
  return data ?? [];
};

export const getNPCRelationships = async (playerId: string): Promise<PlayerNPCRelationship[]> => {
  const { data, error } = await supabase
    .from('player_npc_relationships')
    .select('*')
    .eq('player_id', playerId);
  if (error) throw error;
  return data ?? [];
};

export const upsertNPCRelationship = async (
  rel: Omit<PlayerNPCRelationship, 'id' | 'unlocked_at'> & { player_id: string; npc_id: string }
): Promise<PlayerNPCRelationship> => {
  const { data, error } = await supabase
    .from('player_npc_relationships')
    .upsert(rel, { onConflict: 'player_id,npc_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const logNPCInteraction = async (entry: {
  player_id: string;
  npc_id: string;
  dialogue_id: string;
  choice_id: string;
  outcome_text: string;
  trust_delta: number;
  rep_delta: number;
  money_delta: number;
}): Promise<void> => {
  await supabase.from('npc_interaction_log').insert([entry]);
};

// ─── Relationship helpers ─────────────────────────────────────────────────────

export const trustToStatus = (trust: number): RelationshipStatus => {
  if (trust >= 90) return 'partner';
  if (trust >= 70) return 'ally';
  if (trust >= 50) return 'contact';
  if (trust >= 30) return 'acquaintance';
  if (trust < 15)  return 'rival';
  return 'stranger';
};

export const statusLabel: Record<RelationshipStatus, string> = {
  stranger:     'Stranger',
  acquaintance: 'Acquaintance',
  contact:      'Contact',
  ally:         'Ally',
  partner:      'Partner',
  rival:        'Rival',
};

export const statusColor: Record<RelationshipStatus, string> = {
  stranger:     '#475569',
  acquaintance: '#64748b',
  contact:      '#06b6d4',
  ally:         '#10b981',
  partner:      '#f59e0b',
  rival:        '#ef4444',
};

export const NPC_TYPE_LABELS: Record<string, string> = {
  investor:   'Investor',
  owner:      'Hotel Owner',
  broker:     'Broker',
  developer:  'Developer',
  operator:   'Operator',
  competitor: 'Competitor',
};

export const NPC_TYPE_COLORS: Record<string, string> = {
  investor:   '#3b82f6',
  owner:      '#10b981',
  broker:     '#f59e0b',
  developer:  '#f97316',
  operator:   '#06b6d4',
  competitor: '#ef4444',
};

export const PERSONALITY_LABELS: Record<NPCPersonality, string> = {
  analytical: 'Analytical',
  aggressive: 'Aggressive',
  charming:   'Charming',
  cautious:   'Cautious',
  visionary:  'Visionary',
  pragmatic:  'Pragmatic',
};

// ─── Dialogue template engine ─────────────────────────────────────────────────
// Each NPC slug maps to a set of dialogue trees. The engine picks the most
// fitting tree based on current trust level and relationship status.

type DialogueMap = Record<string, NPCDialogue[]>;

const DIALOGUES: DialogueMap = {

  // ── Ana Costa (Investor, Lisboa) ──────────────────────────────────────────
  ana_costa: [
    {
      id: 'ana_first_meet',
      npc_slug: 'ana_costa',
      trigger: 'first_meet',
      greeting: '"I have exactly twelve minutes. Impress me."',
      body: 'Ana Costa sits across from you in Lusitano Capital\'s Marquês de Pombal office, a spreadsheet open on her screen. She scans your face the way most people scan balance sheets.',
      choices: [
        { id: 'present_data',  label: 'Lead with numbers',      subtext: '+trust, preferred approach',   trust_delta: 12, rep_delta: 8,  money_delta: 0,      outcome_text: '"Good. You actually prepared." She closes the spreadsheet. "Tell me about your pipeline."',        note: 'Responded well to data-led approach.' },
        { id: 'build_rapport', label: 'Build rapport first',    subtext: 'Neutral — she\'s not charmed', trust_delta: 2,  rep_delta: 2,  money_delta: 0,      outcome_text: '"I\'m not here to make friends. Let\'s talk fundamentals." She isn\'t hostile — just unmoved.',      note: 'Tried rapport-building. She prefers data.' },
        { id: 'ask_mandate',   label: 'Ask about her mandate',  subtext: 'Bold — shows confidence',      trust_delta: 6,  rep_delta: 5,  money_delta: 0,      outcome_text: '"Smart question. Most advisors don\'t ask that." She leans back slightly. You\'ve earned thirty more minutes.',  note: 'Bold opening — she appreciated the directness.' },
      ],
    },
    {
      id: 'ana_acquaintance',
      npc_slug: 'ana_costa',
      trigger: 'growing_trust',
      minTrust: 30,
      maxTrust: 60,
      greeting: '"You\'re back. What do you have?"',
      body: 'Ana remembers your last meeting. Her tone is fractionally warmer — she doesn\'t waste time on pleasantries, but she\'s listening more carefully now.',
      choices: [
        { id: 'share_deal',    label: 'Share an off-market deal',    subtext: '+trust if solid',           trust_delta: 15, rep_delta: 10, money_delta: 5000,   outcome_text: '"That\'s interesting. Send me the IM by end of week." A real lead. Not many advisors get that.',  note: 'Shared quality deal — she engaged seriously.' },
        { id: 'market_update', label: 'Give a market update',        subtext: 'Builds credibility slowly', trust_delta: 6,  rep_delta: 8,  money_delta: 0,      outcome_text: '"Useful context. Keep me updated quarterly."',                                                    note: 'Provided market intel — appreciated.' },
        { id: 'ask_for_intro', label: 'Ask for an investor intro',   subtext: 'Too soon — risk losing trust', trust_delta: -5, rep_delta: 0, money_delta: 0,   outcome_text: '"We\'re not there yet." She\'s not angry — just clear.',                                          note: 'Asked for intro too early — noted.' },
      ],
    },
    {
      id: 'ana_ally',
      npc_slug: 'ana_costa',
      trigger: 'ally',
      minTrust: 65,
      greeting: '"I\'ve been thinking about you for this one."',
      body: 'Ana slides a one-pager across the table. A €12M hotel acquisition mandate — she\'s considering you as exclusive advisor. This is what months of trust-building looks like.',
      choices: [
        { id: 'accept_exclusive',  label: 'Accept the exclusive mandate', subtext: 'Major opportunity',      trust_delta: 20, rep_delta: 20, money_delta: 40000,  outcome_text: '"I expected you to say yes. Don\'t disappoint me." The mandate is yours. Time to deliver.',         note: 'Accepted €12M exclusive mandate.' },
        { id: 'negotiate_fee',     label: 'Negotiate a higher fee',       subtext: 'Risky but possible',     trust_delta: -3, rep_delta: 5,  money_delta: 20000,  outcome_text: '"Bold." A long pause. "Fine. But I\'ll remember this if results are below expectations."',          note: 'Successfully negotiated fee upward.' },
        { id: 'decline_politely',  label: 'Decline — capacity issues',    subtext: 'Honest — keeps trust',   trust_delta: -2, rep_delta: 0,  money_delta: 0,      outcome_text: '"Respect that. Come back when you\'re ready — I may have something else." She means it.',          note: 'Declined due to capacity — relationship intact.' },
      ],
    },
  ],

  // ── Miguel Faria (Investor, Porto) ────────────────────────────────────────
  miguel_faria: [
    {
      id: 'miguel_first',
      npc_slug: 'miguel_faria',
      trigger: 'first_meet',
      greeting: '"Sit down. Coffee? This won\'t be a quick meeting."',
      body: 'Miguel Faria\'s office overlooks the Douro. He\'s unhurried, deliberate. A framed photo of his grandfather\'s bank sits on the credenza. He doesn\'t shake hands — he studies people.',
      choices: [
        { id: 'listen_first',  label: 'Listen more than you speak',   subtext: 'He values patience',    trust_delta: 10, rep_delta: 6,  money_delta: 0,     outcome_text: '"Most people who come in here talk too much." He nods slowly. "You might be worth knowing."',    note: 'Listened well. He valued that.' },
        { id: 'pitch_hard',    label: 'Pitch your firm aggressively', subtext: 'Wrong approach for him', trust_delta: -4, rep_delta: 2,  money_delta: 0,     outcome_text: '"I\'m not a startup investor." He says it without malice. "Come back when you have a track record."', note: 'Pitched too hard. He expects patience.' },
        { id: 'family_angle',  label: 'Ask about family legacy',      subtext: 'He respects heritage',   trust_delta: 8,  rep_delta: 4,  money_delta: 0,     outcome_text: '"You did your homework." He leans forward slightly. "My grandfather would have liked that question."',   note: 'Engaged on family legacy — very positive.' },
      ],
    },
    {
      id: 'miguel_growing',
      npc_slug: 'miguel_faria',
      trigger: 'growing_trust',
      minTrust: 35,
      maxTrust: 70,
      greeting: '"I was wondering when you\'d be back."',
      body: 'Miguel has a long memory. He references something from your last meeting — a small detail — to test whether you remember too. Trust is slow to build here, and precious.',
      choices: [
        { id: 'recall_detail',     label: 'Reference his previous comment',  subtext: '+trust if you remembered', trust_delta: 14, rep_delta: 8,  money_delta: 0,      outcome_text: '"You pay attention." He almost smiles. "Not many do."',                                            note: 'Remembered his previous comment perfectly.' },
        { id: 'update_track',      label: 'Show track record progress',      subtext: 'Evidence-based trust',     trust_delta: 10, rep_delta: 10, money_delta: 8000,   outcome_text: '"These are decent numbers. Let\'s talk about something more substantial next time."',               note: 'Presented track record — he was impressed.' },
        { id: 'rush_relationship', label: 'Propose a partnership directly',  subtext: 'Too fast for him',         trust_delta: -8, rep_delta: 0,  money_delta: 0,      outcome_text: '"You\'re moving faster than I\'m comfortable with." He means it kindly — but it\'s a warning.',    note: 'Moved too fast — he prefers slow relationship-building.' },
      ],
    },
  ],

  // ── Carlos Mendes (Owner, Algarve) ────────────────────────────────────────
  carlos_mendes: [
    {
      id: 'carlos_first',
      npc_slug: 'carlos_mendes',
      trigger: 'first_meet',
      greeting: '"Another advisor. You all say the same thing."',
      body: 'Carlos Mendes leans against the doorframe of his Albufeira hotel, arms crossed. He\'s seen dozens of advisors come and go. His skepticism is earned, not unfriendly.',
      choices: [
        { id: 'acknowledge',   label: 'Acknowledge the skepticism',    subtext: 'Disarms him immediately',   trust_delta: 12, rep_delta: 8,  money_delta: 0,     outcome_text: '"Finally — someone honest." He uncrosses his arms. "Buy me a beer and let\'s talk properly."',  note: 'Disarmed his skepticism with honesty. Good start.' },
        { id: 'sell_pitch',    label: 'Give your standard pitch',      subtext: 'Confirms his fears',        trust_delta: -5, rep_delta: 1,  money_delta: 0,     outcome_text: '"I knew it." He shakes his head — not angry, just resigned.',                                       note: 'Standard pitch — confirmed his low expectations.' },
        { id: 'ask_history',   label: 'Ask about the hotels\' history', subtext: 'He\'ll talk for hours',   trust_delta: 10, rep_delta: 5,  money_delta: 0,     outcome_text: '"Now that\'s the right question." He walks you through forty years of family history. Time well spent.', note: 'Asked about family history — he loved it.' },
      ],
    },
    {
      id: 'carlos_contact',
      npc_slug: 'carlos_mendes',
      trigger: 'growing_trust',
      minTrust: 35,
      maxTrust: 65,
      greeting: '"I\'ve been thinking about what you said last time."',
      body: 'Carlos is warming up. He mentions he\'s had inquiries about one of his properties — a buyer from Germany. He\'s not sure he wants to sell. But he\'s asking for your opinion.',
      choices: [
        { id: 'advise_sell',   label: 'Advise him to sell — good price',  subtext: 'Commission opportunity',  trust_delta: 5,  rep_delta: 8,  money_delta: 15000, outcome_text: '"I think you\'re right. Let\'s talk to the Germans." A real transaction in play.',         note: 'Advised on German buyer — he took it seriously.' },
        { id: 'advise_hold',   label: 'Advise him to hold — not the time', subtext: 'Builds long-term trust', trust_delta: 18, rep_delta: 6,  money_delta: 0,     outcome_text: '"That\'s not what I expected you to say." He\'s surprised. "You\'re not like the others."',  note: 'Advised to hold — massive trust gain. He knows you\'re genuine.' },
        { id: 'get_more_info', label: 'Ask more before advising',         subtext: 'Safe, measured',          trust_delta: 8,  rep_delta: 4,  money_delta: 0,     outcome_text: '"Good instinct. Let me show you the financials."',                                           note: 'Asked for more info before advising — he appreciated the diligence.' },
      ],
    },
  ],

  // ── Tiago Santos (Broker, Lisboa) ────────────────────────────────────────
  tiago_santos: [
    {
      id: 'tiago_first',
      npc_slug: 'tiago_santos',
      trigger: 'first_meet',
      greeting: '"I heard about you from three different people this week. That\'s either very good or very bad."',
      body: 'Tiago Santos is Lisbon\'s most connected broker. He operates from a perpetual state of cheerful calculation — everyone gets the same warm smile while he decides exactly how useful you are.',
      choices: [
        { id: 'name_drop',    label: 'Name the mutual contacts',       subtext: 'Validates your network',   trust_delta: 10, rep_delta: 10, money_delta: 0,    outcome_text: '"That narrows it down." He grins. "Sit down. Let\'s talk about what each of us can do for the other."', note: 'Named mutual contacts — validated. Good start.' },
        { id: 'play_coy',     label: 'Play it mysterious',             subtext: 'He finds it amusing',      trust_delta: 5,  rep_delta: 4,  money_delta: 0,    outcome_text: '"Cheeky." He laughs. "I like that. You\'re buying the next round."',                                   note: 'Played coy — he found it amusing.' },
        { id: 'deal_first',   label: 'Jump straight to deal flow',     subtext: 'Too transactional',        trust_delta: -3, rep_delta: 3,  money_delta: 0,    outcome_text: '"Easy there. This isn\'t a marketplace." A gentle correction — he\'s not offended.',                note: 'Too transactional at first meeting.' },
      ],
    },
    {
      id: 'tiago_ally',
      npc_slug: 'tiago_santos',
      trigger: 'ally',
      minTrust: 65,
      greeting: '"I have something for you. Off-market. Haven\'t told anyone else yet."',
      body: 'Tiago slides his phone across the table. A 4-star hotel near Chiado, owner quietly divorcing, needs a discreet sale. Prime asset. Zero public exposure. This is the kind of thing he only shares with trusted partners.',
      choices: [
        { id: 'take_exclusive',   label: 'Ask for exclusive on the deal',  subtext: 'He might agree',           trust_delta: 12, rep_delta: 15, money_delta: 25000, outcome_text: '"For you? Fine. But I expect reciprocity." The deal is yours — exclusively.',           note: 'Secured exclusive off-market Chiado deal from Tiago.' },
        { id: 'co_advise',        label: 'Propose co-advisory',            subtext: 'He prefers this',          trust_delta: 8,  rep_delta: 10, money_delta: 12000, outcome_text: '"That\'s actually the smarter play." He nods. "Fifty-fifty on fees."',                note: 'Co-advisory arrangement on Chiado hotel.' },
        { id: 'pass_to_client',   label: 'Forward to Ana Costa',           subtext: 'Gives him value signal',   trust_delta: 6,  rep_delta: 8,  money_delta: 5000,  outcome_text: '"Smart — if she bites, I want to be on the call." Tiago approves.',                   note: 'Forwarded Tiago\'s deal to Ana Costa — both appreciated it.' },
      ],
    },
  ],

  // ── Hugo Silva (Operator, Lisboa) ────────────────────────────────────────
  hugo_silva: [
    {
      id: 'hugo_first',
      npc_slug: 'hugo_silva',
      trigger: 'first_meet',
      greeting: '"Mate, I\'ve been meaning to reach out to someone like you for months."',
      body: 'Hugo Silva runs Selina Portugal with infectious energy. He\'s in his late 30s, hoodie, not a suit in sight. He\'s expanding fast and needs hotel-savvy partners who understand the new hospitality model.',
      choices: [
        { id: 'show_pipeline',   label: 'Show your property pipeline',     subtext: '+trust immediately',      trust_delta: 14, rep_delta: 10, money_delta: 0,    outcome_text: '"This is exactly what I need." He scrolls through your list with genuine excitement.',             note: 'Showed pipeline — immediate positive response.' },
        { id: 'ask_model',       label: 'Ask how their model works',       subtext: 'He loves explaining it',  trust_delta: 8,  rep_delta: 6,  money_delta: 0,    outcome_text: '"Finally someone who actually wants to understand." He talks for thirty minutes. Worth every second.', note: 'Asked about Selina\'s model — he was energised.' },
        { id: 'be_skeptical',    label: 'Express skepticism about Selina', subtext: 'He can handle it',        trust_delta: 3,  rep_delta: 4,  money_delta: 0,    outcome_text: '"I get it. The brand is polarising." He isn\'t defensive. "Let the numbers do the talking."',    note: 'Expressed skepticism — he handled it well and respected it.' },
      ],
    },
  ],

  // ── Diogo Carvalho (Competitor, Lisboa) ──────────────────────────────────
  diogo_carvalho: [
    {
      id: 'diogo_first',
      npc_slug: 'diogo_carvalho',
      trigger: 'first_meet',
      greeting: '"I\'ve heard of you. We seem to keep running into the same deals."',
      body: 'Diogo Carvalho is your most dangerous competitor. He knows it. You know it. This conversation could go several ways — and only one of them ends well for you.',
      choices: [
        { id: 'stay_cool',    label: 'Be cordial — no hostility',     subtext: 'Keeps options open',        trust_delta: 8,  rep_delta: 5,  money_delta: 0,    outcome_text: '"Smart." He tilts his head. "I can respect that." He won\'t become a friend — but he won\'t undercut you this week.', note: 'Stayed cordial. Rival relationship managed carefully.' },
        { id: 'warn_off',     label: 'Mark your territory firmly',    subtext: 'Escalates rivalry',         trust_delta: -10, rep_delta: 3, money_delta: 0,   outcome_text: '"Interesting choice." His smile is thin. The war just started.',                                                        note: 'Marked territory — rivalry escalated.' },
        { id: 'propose_truce',label: 'Propose market segmentation',   subtext: 'Unusual — might work',     trust_delta: 12, rep_delta: 8,  money_delta: 0,    outcome_text: '"You\'re thinking bigger than I expected." He considers it. "Lisbon\'s large enough for both of us — for now."',     note: 'Proposed market segmentation. Diogo agreed — for now.' },
      ],
    },
    {
      id: 'diogo_rival',
      npc_slug: 'diogo_carvalho',
      trigger: 'rival',
      maxTrust: 20,
      greeting: '"I see you\'ve taken on the Azevedo deal. That was supposed to be mine."',
      body: 'Diogo\'s tone has an edge now. Word travels fast in the Lisbon market. He\'s not threatening — he\'s establishing that he\'s watching, and that you should be watching too.',
      choices: [
        { id: 'stand_firm',   label: 'Stand your ground calmly',      subtext: 'Earns grudging respect',   trust_delta: 5,  rep_delta: 6,  money_delta: 0,    outcome_text: '"Fair enough." He doesn\'t push. You\'ve handled it correctly.',                          note: 'Stood ground on Azevedo deal. He backed off.' },
        { id: 'apologise',    label: 'Apologise and offer a share',    subtext: 'Costs credibility',        trust_delta: -5, rep_delta: -5, money_delta: 0,   outcome_text: '"Don\'t do that. It makes you look weak." He actually looks disappointed.',                 note: 'Apologised to Diogo — he lost respect for it.' },
        { id: 'counter_info', label: 'Offer intel on another deal',    subtext: 'Unexpected — disarms him', trust_delta: 10, rep_delta: 5,  money_delta: 0,   outcome_text: '"Now we\'re talking." The tension breaks. He files the intel away for later.',            note: 'Offered counter-intel — de-escalated rival tension.' },
      ],
    },
  ],

  // ── Generic fallback for any NPC ─────────────────────────────────────────
  _generic: [
    {
      id: 'generic_first',
      npc_slug: '_generic',
      trigger: 'first_meet',
      greeting: '"I\'ve been told you\'re someone worth meeting."',
      body: 'Your contact greets you with measured warmth. They\'re assessing you the same way you\'re assessing them — this is how every worthwhile relationship in the hospitality industry begins.',
      choices: [
        { id: 'be_direct',    label: 'Be direct about your intentions', subtext: 'Most respect directness',  trust_delta: 8,  rep_delta: 5,  money_delta: 0,   outcome_text: '"I respect that." They nod. "Let\'s talk specifics."',                                     note: 'Was direct about intentions. Positive first impression.' },
        { id: 'listen_first', label: 'Listen first',                    subtext: 'Safe, thoughtful',         trust_delta: 6,  rep_delta: 4,  money_delta: 0,   outcome_text: '"Good instinct." They open up more than expected.',                                        note: 'Listened carefully at first meeting.' },
        { id: 'ask_goals',    label: 'Ask about their current goals',   subtext: 'Shows genuine interest',   trust_delta: 10, rep_delta: 6,  money_delta: 0,   outcome_text: '"Nobody asks that directly." They seem pleasantly surprised.',                           note: 'Asked about their goals — made a strong impression.' },
      ],
    },
    {
      id: 'generic_growing',
      npc_slug: '_generic',
      trigger: 'growing_trust',
      minTrust: 30,
      maxTrust: 65,
      greeting: '"Good timing — I was thinking about reaching out."',
      body: 'The relationship is developing. They remember your last conversation and reference it naturally. Trust is building, and with it, the potential for something more substantial.',
      choices: [
        { id: 'share_value',    label: 'Share a useful market insight',  subtext: 'Builds credibility',       trust_delta: 10, rep_delta: 8,  money_delta: 0,     outcome_text: '"That\'s useful. Thank you." The relationship deepens another notch.',                   note: 'Shared valuable market insight.' },
        { id: 'propose_collab', label: 'Propose a collaboration',        subtext: 'May be too soon',          trust_delta: 4,  rep_delta: 5,  money_delta: 0,     outcome_text: '"Interesting idea. Let me think about it." Noncommittal — but not closed.',              note: 'Proposed collaboration — they\'re considering it.' },
        { id: 'ask_for_deal',   label: 'Ask about any live deals',       subtext: 'Direct but effective',     trust_delta: 6,  rep_delta: 6,  money_delta: 10000, outcome_text: '"Actually — yes. There\'s something." A real lead emerges.',                            note: 'Asked about live deals — got a real lead.' },
      ],
    },
    {
      id: 'generic_ally',
      npc_slug: '_generic',
      trigger: 'ally',
      minTrust: 70,
      greeting: '"I\'ve been recommending you to people. I hope you don\'t mind."',
      body: 'The relationship has matured into something genuinely valuable. They\'re not just a contact now — they\'re an advocate. The question is whether you\'ll capitalise on it well.',
      choices: [
        { id: 'formalise',    label: 'Propose a formal referral arrangement', subtext: 'Solidifies the alliance',   trust_delta: 15, rep_delta: 15, money_delta: 20000, outcome_text: '"That\'s fair and professional." They extend their hand. "Consider it done."',      note: 'Formalised referral arrangement. Partnership secured.' },
        { id: 'reciprocate',  label: 'Reciprocate with a referral of your own', subtext: '+trust, good karma',    trust_delta: 12, rep_delta: 10, money_delta: 0,     outcome_text: '"You\'re the kind of person who makes this industry work." High praise.',           note: 'Reciprocated with a referral. Trust deepened further.' },
        { id: 'coast',        label: 'Accept the goodwill without action',   subtext: 'Slight trust erosion',     trust_delta: -4, rep_delta: 0,  money_delta: 5000,  outcome_text: '"Right." A subtle shift in tone — they notice you took without giving.',             note: 'Accepted goodwill passively. Small trust erosion.' },
      ],
    },
  ],
};

// ─── Dialogue selection engine ────────────────────────────────────────────────

export const getDialogueForNPC = (
  npcSlug: string,
  trust: number,
  interactionCount: number,
  relationshipStatus: RelationshipStatus,
): NPCDialogue => {
  const npcDialogues = DIALOGUES[npcSlug] ?? DIALOGUES['_generic'];
  const genericDialogues = DIALOGUES['_generic'];
  const allDialogues = npcDialogue(npcSlug) ? npcDialogues : genericDialogues;

  // First meeting
  if (interactionCount === 0) {
    const firstMeet = allDialogues.find(d => d.trigger === 'first_meet');
    if (firstMeet) return firstMeet;
  }

  // Rival state
  if (relationshipStatus === 'rival') {
    const rivalD = allDialogues.find(d => d.trigger === 'rival');
    if (rivalD) return rivalD;
  }

  // Ally/partner state
  if (trust >= 65) {
    const allyD = allDialogues.find(d =>
      (d.trigger === 'ally' || d.trigger === 'partner') &&
      (!d.minTrust || trust >= d.minTrust)
    );
    if (allyD) return allyD;
    const genericAlly = genericDialogues.find(d => d.trigger === 'ally');
    if (genericAlly) return genericAlly;
  }

  // Growing trust
  const growing = allDialogues.find(d =>
    d.trigger === 'growing_trust' &&
    (!d.minTrust || trust >= d.minTrust) &&
    (!d.maxTrust || trust <= d.maxTrust)
  );
  if (growing) return growing;

  const genericGrowing = genericDialogues.find(d =>
    d.trigger === 'growing_trust' &&
    (!d.minTrust || trust >= d.minTrust)
  );
  if (genericGrowing) return genericGrowing;

  // Fallback to first generic
  return genericDialogues[0];
};

const npcDialogue = (slug: string): boolean => slug in DIALOGUES;

// ─── NPC unlock logic ─────────────────────────────────────────────────────────

export const getUnlockedNPCs = (npcs: NPC[], playerLevel: number): NPC[] => {
  return npcs.filter(n => n.min_player_level <= playerLevel);
};
