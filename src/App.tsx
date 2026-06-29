import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameState } from './hooks/useGameState';
import { PlayerProfile } from './components/PlayerProfile';
import { DistrictMap } from './components/DistrictMap';
import { QuestPanel } from './components/QuestPanel';
import { AchievementsPanel } from './components/AchievementsPanel';
import { DistrictDetail } from './components/DistrictDetail';
import { LevelUpModal } from './components/LevelUpModal';
import { SkillTree } from './components/SkillTree';
import { QuestCompletionToast } from './components/QuestCompletionToast';
import { TradingPenaltyNotification } from './components/TradingPenaltyNotification';
import { MoneyDisplay } from './components/MoneyDisplay';
import { DealCompletionToast } from './components/DealCompletionToast';
import { OfficePanel } from './components/OfficePanel';
import { ReputationPanel } from './components/ReputationPanel';
import { NPCRoster } from './components/NPCRoster';
import { NPCDialogueWindow } from './components/NPCDialogueWindow';
import { RivalsPanel } from './components/RivalsPanel';
import { DealCinematicSequence } from './components/DealCinematicSequence';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { XPAnalyticsDashboard } from './components/XPAnalyticsDashboard';
import { LeadsMatchingPanel } from './components/LeadsMatchingPanel';
import { LeadsCRMPanel } from './components/LeadsCRMPanel';
import { DistrictHeatmap } from './components/DistrictHeatmap';
import { MatchAnalyticsDashboard } from './components/MatchAnalyticsDashboard';
import { NotionSettingsPanel } from './components/NotionSettingsPanel';
import { SuggestionsBoard } from './components/SuggestionsBoard';
import { Crown, MapPin, TrendingUp, Trophy, TrendingDown, Volume2, VolumeX, DollarSign, Building2, Star, Users, Swords, BarChart2, Handshake, Zap, Cpu } from 'lucide-react';
import { DailyBriefing, useDailyBriefing } from './components/DailyBriefing';
import { computeAllMatches, ComputedMatch } from './services/matchingEngine';
import type { Lead } from './types/game';

type Tab = 'overview' | 'quests' | 'suggestions' | 'skills' | 'achievements' | 'office' | 'reputation' | 'contacts' | 'rivals' | 'analytics' | 'leads';

// ── Sound placeholder system ───────────────────────────────────────────────
const SOUNDS: Record<string, { freq: number; type: OscillatorType; dur: number }> = {
  tab_switch:    { freq: 440, type: 'sine',     dur: 0.08 },
  quest_accept:  { freq: 523, type: 'triangle', dur: 0.15 },
  level_up:      { freq: 880, type: 'sine',     dur: 0.3 },
  territory:     { freq: 330, type: 'sawtooth', dur: 0.2 },
  penalty:       { freq: 150, type: 'square',   dur: 0.25 },
  hover:         { freq: 660, type: 'sine',     dur: 0.04 },
};

function playSound(name: keyof typeof SOUNDS, muted: boolean) {
  if (muted || typeof AudioContext === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const { freq, type, dur } = SOUNDS[name];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch (_) { /* silently skip if AudioContext unavailable */ }
}

// ── Ambient orb data ───────────────────────────────────────────────────────
const ORBS = [
  { color: '#f59e0b', size: 1000, x: '15%',  y: '-15%', dur: 28, blur: 90 },
  { color: '#f97316', size: 700,  x: '78%',  y: '55%',  dur: 35, blur: 80 },
  { color: '#0ea5e9', size: 800,  x: '-8%',  y: '72%',  dur: 30, blur: 85 },
  { color: '#f59e0b', size: 450,  x: '52%',  y: '25%',  dur: 22, blur: 70 },
  { color: '#10b981', size: 350,  x: '88%',  y: '-5%',  dur: 40, blur: 75 },
];

// ── Light rays ─────────────────────────────────────────────────────────────
const RAYS = [12, 28, 48, 66, 84];

function App() {
  const {
    gameState,
    gainXP,
    dismissLevelUp,
    dismissQuestCompletion,
    dismissDealCompletion,
    performAction,
    restoreEnergy,
    openNPCDialogue,
    resolveNPCDialogue,
    closeNPCDialogue,
    dismissCinematicDeal,
    spendSkillPoint,
    completeDynQuest,
    completeDeal,
    applyTradingPenalty,
    enterNewDistrict,
    investInDistrict,
    purchaseUpgrade,
    refreshQuests,
    acceptSuggestion,
    dismissSuggestion,
    snoozeSuggestion,
    refreshSuggestions,
  } = useGameState();

  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [_prevTab, setPrevTab] = useState<Tab>('overview');
  const [tabTransition, setTabTransition] = useState(false);
  const [analyticsSubtab, setAnalyticsSubtab] = useState<'xp' | 'market'>('xp');
  const [showPenaltyNotif, setShowPenaltyNotif] = useState(false);
  const [muted, setMuted] = useState(true); // start muted, player opts in
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [newlyDiscovered, setNewlyDiscovered] = useState<Set<string>>(new Set());
  const [briefingMatches, setBriefingMatches] = useState<ComputedMatch[]>([]);
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const stored = localStorage.getItem('swallow_leads');
      if (!stored) return [];
      const parsed = JSON.parse(stored) as Partial<Lead>[];
      // Normalize old leads that predate bidirectional sync fields
      return parsed.map(l => ({
        notion_page_id:        l.notion_page_id        ?? null,
        stars:                 l.stars                 ?? 0,
        rooms:                 l.rooms                 ?? null,
        last_contact_at:       l.last_contact_at       ?? null,
        next_follow_up:        l.next_follow_up        ?? null,
        status_updated_at:     l.status_updated_at     ?? null,
        notion_last_synced_at: l.notion_last_synced_at ?? null,
        bolt_last_updated_at:  l.bolt_last_updated_at  ?? null,
        ...l,
      } as Lead));
    } catch { return []; }
  });
  const appRef = useRef<HTMLDivElement>(null);

  // Track mouse for parallax lighting
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  const syncLeads = useCallback((incoming: Lead[]) => {
    setLeads(incoming);
    setBriefingMatches(computeAllMatches(incoming));
    try { localStorage.setItem('swallow_leads', JSON.stringify(incoming)); } catch (_) {}
  }, []);

  // Keep briefing matches in sync with leads
  useEffect(() => {
    setBriefingMatches(computeAllMatches(leads));
  }, [leads]);

  const switchTab = useCallback((tab: Tab) => {
    if (tab === activeTab) return;
    setTabTransition(true);
    setPrevTab(activeTab);
    setTimeout(() => {
      setActiveTab(tab);
      setTabTransition(false);
    }, 150);
    playSound('tab_switch', muted);
  }, [activeTab, muted]);

  const handleOpenBinance = () => {
    applyTradingPenalty();
    setShowPenaltyNotif(true);
    playSound('penalty', muted);
  };

  const handleEnterDistrict = (districtId: string) => {
    enterNewDistrict(districtId);
    setNewlyDiscovered(prev => new Set([...prev, districtId]));
    playSound('territory', muted);
    setTimeout(() => {
      setNewlyDiscovered(prev => { const s = new Set(prev); s.delete(districtId); return s; });
    }, 2000);
  };

  if (gameState.loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Loading atmosphere */}
        <div className="absolute inset-0">
          {ORBS.map((orb, i) => (
            <div
              key={i}
              className="ambient-orb animate-orb-drift"
              style={{
                width: orb.size, height: orb.size,
                left: orb.x, top: orb.y,
                backgroundColor: orb.color,
                animationDuration: `${orb.dur}s`,
                animationDelay: `${i * -5}s`,
              }}
            />
          ))}
        </div>
        <div className="rpg-vignette" />
        <div className="rpg-noise" />
        <div className="relative text-center space-y-6 animate-reveal-up">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute w-32 h-32 rounded-full bg-amber-500/10 animate-pulse-glow" />
            <div className="absolute w-48 h-48 rounded-full bg-amber-500/05 animate-pulse-glow" style={{ animationDelay: '0.5s' }} />
            <Crown className="relative w-16 h-16 text-amber-400 animate-float text-glow-amber" />
          </div>
          <div className="space-y-2">
            <p className="text-amber-400 text-3xl font-black tracking-[0.3em] text-glow-amber animate-flicker">
              SWALLOW EMPIRE
            </p>
            <p className="text-slate-500 text-sm tracking-widest animate-fade-in" style={{ animationDelay: '0.3s' }}>
              PORTUGAL · HOTEL INVESTMENT
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <div className="w-1.5 h-6 bg-amber-600 rounded-full sound-bar-1" />
            <div className="w-1.5 h-6 bg-amber-500 rounded-full sound-bar-2" />
            <div className="w-1.5 h-6 bg-amber-400 rounded-full sound-bar-3" />
          </div>
        </div>
      </div>
    );
  }

  const { player, stats, districts, playerDistricts, dynamicQuests,
          achievements, unlockedAchievements, pendingLevelUps, pendingQuestCompletions } = gameState;

  const selectedDistrict = selectedDistrictId ? districts.find(d => d.id === selectedDistrictId) ?? null : null;
  const selectedPlayerDistrict = selectedDistrictId ? playerDistricts.get(selectedDistrictId) : undefined;

  const totalHotels = Array.from(playerDistricts.values()).reduce((s, pd) => s + pd.hotels_invested, 0);
  const avgDominance = playerDistricts.size > 0
    ? Math.round(Array.from(playerDistricts.values()).reduce((s, pd) => s + pd.market_share, 0) / playerDistricts.size * 100)
    : 0;
  const activeQuestCount = dynamicQuests.filter(q => q.status === 'active').length;
  const completedQuestCount = dynamicQuests.filter(q => q.status === 'completed').length;

  // Parallax offset for orbs based on mouse
  const parallaxX = (mousePos.x - 0.5) * 30;
  const parallaxY = (mousePos.y - 0.5) * 20;

  const allyCount = Array.from(gameState.npcRelationships.values())
    .filter(r => r.relationship_status === 'ally' || r.relationship_status === 'partner').length;

  const unreadRivalCount = gameState.pendingRivalEvents.length;

  const tabs: { key: Tab; label: string; Icon: typeof TrendingUp; badge?: number }[] = [
    { key: 'overview',    label: 'Overview',    Icon: TrendingUp },
    { key: 'quests',      label: 'Quests',      Icon: MapPin,     badge: activeQuestCount },
    { key: 'suggestions', label: 'AI Missions', Icon: Cpu,        badge: gameState.aiSuggestions.filter(s => s.status === 'pending' && s.priority === 'high').length || undefined },
    { key: 'contacts',    label: 'Contacts',    Icon: Users,      badge: allyCount > 0 ? allyCount : undefined },
    { key: 'rivals',      label: 'Rivals',      Icon: Swords,     badge: unreadRivalCount > 0 ? unreadRivalCount : undefined },
    { key: 'skills',      label: 'Skills',      Icon: Zap,        badge: player?.skill_points },
    { key: 'reputation',  label: 'Reputation',  Icon: Star },
    { key: 'office',      label: 'Office',      Icon: Building2 },
    { key: 'achievements',label: 'Achievements',Icon: Trophy },
    { key: 'analytics',   label: 'Analytics',   Icon: BarChart2 },
    { key: 'leads',       label: 'Leads',       Icon: Handshake },
  ];

  const levelTitle = gameState.levelRewards.get(player?.level ?? 1)?.title ?? 'Advisory Intern';

  return (
    <div ref={appRef} className="min-h-screen bg-slate-950 overflow-x-hidden page-reveal">
      {/* ── Cinematic letterbox ────────────────────────────────────────── */}
      <div className="letterbox-top" />
      <div className="letterbox-bottom" />

      {/* ── Atmosphere layers ──────────────────────────────────────────── */}
      <div className="rpg-scanlines" />
      <div className="rpg-scanline-sweep" />
      <div className="rpg-vignette" />
      <div className="rpg-noise" />
      <div className="ambient-aurora" />
      <div className="rpg-grid-floor" />

      {/* ── Ambient light orbs (parallax) ──────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {ORBS.map((orb, i) => (
          <div
            key={i}
            className="ambient-orb"
            style={{
              width: orb.size, height: orb.size,
              left: orb.x, top: orb.y,
              backgroundColor: orb.color,
              filter: `blur(${orb.blur}px)`,
              transform: `translate(${parallaxX * (i % 2 === 0 ? 1 : -0.6)}px, ${parallaxY * (i % 2 === 0 ? 1 : -0.6)}px)`,
              transition: 'transform 1s cubic-bezier(0.4,0,0.2,1)',
              animation: `orb-drift ${orb.dur}s ease-in-out infinite`,
              animationDelay: `${i * -6}s`,
            }}
          />
        ))}
        {/* Light rays */}
        {RAYS.map((pos, i) => (
          <div
            key={i}
            className="light-ray"
            style={{ left: `${pos}%`, animationDelay: `${i * 1.8}s`, animation: `light-ray ${7 + i}s ease-in-out infinite` }}
          />
        ))}
        {/* Subtle horizontal sweep line */}
        <div className="absolute left-0 right-0 h-px opacity-30"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)',
            animation: 'sweep-scanline 18s linear infinite',
          }}
        />
      </div>

      {/* ── Level-up modal ─────────────────────────────────────────────── */}
      {pendingLevelUps.length > 0 && (
        <LevelUpModal event={pendingLevelUps[0]} onDismiss={dismissLevelUp} />
      )}

      {/* ── Quest completion toast ─────────────────────────────────────── */}
      {pendingQuestCompletions.length > 0 && (
        <QuestCompletionToast event={pendingQuestCompletions[0]} onDismiss={dismissQuestCompletion} />
      )}

      {/* ── Trading penalty ────────────────────────────────────────────── */}
      {showPenaltyNotif && (
        <TradingPenaltyNotification onDismiss={() => setShowPenaltyNotif(false)} />
      )}

      {/* ── Deal completion ─────────────────────────────────────────────── */}
      {gameState.pendingDealCompletions.length > 0 && (
        <DealCompletionToast
          event={gameState.pendingDealCompletions[0]}
          onDismiss={dismissDealCompletion}
        />
      )}

      {/* ── Cinematic deal sequence ─────────────────────────────────────── */}
      {gameState.pendingCinematicDeal && (
        <DealCinematicSequence
          deal={{
            id: gameState.pendingCinematicDeal.id,
            tier: gameState.pendingCinematicDeal.tier,
            dealName: gameState.pendingCinematicDeal.dealName,
            districtName: gameState.pendingCinematicDeal.districtName,
            accentColor: gameState.pendingCinematicDeal.accentColor,
            moneyEarned: gameState.pendingCinematicDeal.moneyEarned,
            reputationEarned: gameState.pendingCinematicDeal.reputationEarned,
            dominanceGained: gameState.pendingCinematicDeal.dominanceGained,
            xpEarned: gameState.pendingCinematicDeal.xpEarned,
            opponentName: gameState.pendingCinematicDeal.opponentName,
            opponentTitle: gameState.pendingCinematicDeal.opponentTitle,
            dealValue: gameState.pendingCinematicDeal.dealValue,
            negotiationRounds: gameState.pendingCinematicDeal.negotiationRounds,
          }}
          onComplete={() => { dismissCinematicDeal(); playSound('level_up', muted); }}
        />
      )}

      {/* ── NPC dialogue window ─────────────────────────────────────────── */}
      {gameState.activeNPCDialogue && (
        <NPCDialogueWindow
          dialogue={gameState.activeNPCDialogue}
          playerNegotiation={player?.negotiation ?? 10}
          playerNetworking={player?.networking ?? 10}
          onChoice={choice => {
            resolveNPCDialogue(choice);
            playSound('quest_accept', muted);
            setTimeout(() => closeNPCDialogue(), 2400);
          }}
          onClose={closeNPCDialogue}
        />
      )}

      <div className="relative z-10">
        {/* ── Navbar ───────────────────────────────────────────────────── */}
        <div className="navbar-glass border-b border-amber-900/15 sticky top-0 z-20">
          {/* Top line accent */}
          <div className="h-px w-full nav-line-pulse"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.6), rgba(249,115,22,0.4), rgba(245,158,11,0.6), transparent)' }}
          />

          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="relative">
                <Crown className="w-6 h-6 text-amber-400 animate-float" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.7))' }} />
                <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-pulse-glow-fast" />
                <div className="absolute inset-0 rounded-full bg-amber-400/10 animate-ping-slow" />
              </div>
              <div>
                <span className="text-base font-black text-gradient-animate tracking-[0.15em] animate-flicker">
                  SWALLOW EMPIRE
                </span>
                {player && (
                  <p className="text-xs text-slate-600 -mt-0.5 hidden sm:block">{levelTitle}</p>
                )}
              </div>
            </div>

            {/* Center: XP ticker */}
            {player && (
              <div className="hidden md:flex items-center gap-3 flex-1 max-w-xs mx-auto">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Lv {player.level}</span>
                    <span className="text-amber-500 font-mono">{player.current_xp.toLocaleString()} / {player.xp_to_next_level.toLocaleString()} XP</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full xp-bar-shimmer transition-all duration-700"
                      style={{ width: `${Math.min((player.current_xp / player.xp_to_next_level) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Right: controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {player?.skill_points != null && player.skill_points > 0 && (
                <button
                  onClick={() => switchTab('skills')}
                  className="text-xs bg-amber-600/80 hover:bg-amber-500 text-white font-bold px-2.5 py-1 rounded-lg animate-pulse-glow-fast border border-amber-500/50 transition-all"
                >
                  {player.skill_points} SP
                </button>
              )}

              {/* Quick balance in navbar */}
              {player && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/20 text-emerald-400 font-bold">
                  <DollarSign className="w-3.5 h-3.5" />
                  €{(player.money ?? 0).toLocaleString()}
                </div>
              )}

              <button
                onClick={() => setMuted(m => !m)}
                className="p-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-500 hover:text-slate-300 transition-all"
                title={muted ? 'Enable sounds' : 'Mute sounds'}
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={handleOpenBinance}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-900/60 bg-red-950/30 text-red-500 hover:bg-red-900/40 hover:border-red-700 hover:text-red-300 transition-all active:scale-95"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open Binance</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

          {/* ── Two-column hero ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1 animate-slide-in-left">
              <PlayerProfile
                player={player}
                stats={stats}
                reputation={gameState.reputation}
                onPerformAction={performAction}
                onRestoreEnergy={restoreEnergy}
              />
            </div>
            <div className="lg:col-span-2 animate-slide-in-right rpg-card hud-frame p-5">
              <DistrictMap
                districts={districts}
                playerDistricts={playerDistricts}
                playerLevel={player?.level ?? 1}
                newlyDiscovered={newlyDiscovered}
                districtMarket={gameState.districtMarket}
                districtEvents={gameState.districtEvents}
                onSelectDistrict={id => { setSelectedDistrictId(id); playSound('hover', muted); }}
              />
            </div>
          </div>

          {/* ── Tab panel ────────────────────────────────────────────────── */}
          <div className="rpg-card hud-frame-full overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {/* Top accent line */}
            <div className="h-px w-full nav-line-pulse"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3), rgba(249,115,22,0.2), transparent)' }} />
            {/* Tab bar */}
            <div className="bg-slate-900/80 border-b border-slate-800/60 relative backdrop-blur-sm">
              <div className="flex">
                {tabs.map(({ key, label, Icon, badge }) => {
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => switchTab(key)}
                      className={`
                        relative flex-1 px-4 py-4 font-bold text-sm transition-all duration-200
                        flex items-center justify-center gap-2 group
                        ${isActive
                          ? 'text-amber-400'
                          : 'text-slate-500 hover:text-slate-200'
                        }
                      `}
                    >
                      {/* Active bg */}
                      {isActive && (
                        <>
                          <span className="absolute inset-0 bg-gradient-to-b from-amber-900/25 via-amber-950/10 to-transparent" />
                          <span className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-amber-900/10 to-transparent" />
                        </>
                      )}
                      {/* Hover bg */}
                      {!isActive && (
                        <span className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.025] transition-colors duration-200" />
                      )}
                      {/* Icon */}
                      <Icon
                        className={`w-4 h-4 relative z-10 transition-all duration-200 group-hover:scale-110 ${
                          isActive ? 'text-amber-400' : 'group-hover:text-slate-300'
                        }`}
                        style={isActive ? { filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.5))' } : undefined}
                      />
                      <span className="hidden sm:inline relative z-10">{label}</span>
                      {/* Badge */}
                      {badge != null && badge > 0 && (
                        <span className="absolute top-1.5 right-1 w-4 h-4 bg-amber-500 text-slate-900 text-xs font-black rounded-full flex items-center justify-center z-10 animate-pulse-glow-fast">
                          {Math.min(badge, 9)}
                        </span>
                      )}
                      {/* Active bottom border */}
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab content with cinematic transition */}
            <div
              key={activeTab}
              className={`bg-slate-950/40 p-6 min-h-80 ${tabTransition ? 'tab-exit' : 'tab-enter'}`}
            >
              {activeTab === 'overview' && (
                <OverviewTab
                  player={player}
                  playerDistricts={playerDistricts}
                  districts={districts}
                  totalHotels={totalHotels}
                  avgDominance={avgDominance}
                  completedQuestCount={completedQuestCount}
                  activeQuestCount={activeQuestCount}
                  levelRewards={gameState.levelRewards}
                  onSelectDistrict={setSelectedDistrictId}
                  money={player?.money ?? 0}
                  monthlyIncome={player?.monthly_income ?? 0}
                  empireValue={player?.empire_value ?? 0}
                  dynamicQuests={dynamicQuests}
                  npcs={gameState.npcs}
                  npcRelationships={gameState.npcRelationships}
                  recentMatches={briefingMatches}
                  reputation={gameState.reputation}
                />
              )}

              {activeTab === 'quests' && (
                <QuestPanel
                  dynamicQuests={dynamicQuests}
                  officialQuests={gameState.officialQuests}
                  districts={districts}
                  playerLevel={player?.level ?? 1}
                  playerReputation={player?.reputation ?? 0}
                  onComplete={(questId, districtId) => {
                    completeDynQuest(questId, districtId);
                    playSound('quest_accept', muted);
                  }}
                  onRefresh={refreshQuests}
                />
              )}

              {activeTab === 'suggestions' && (
                <SuggestionsBoard
                  suggestions={gameState.aiSuggestions}
                  onAccept={async (s) => {
                    await acceptSuggestion(s);
                    playSound('quest_accept', muted);
                  }}
                  onDismiss={dismissSuggestion}
                  onSnooze={snoozeSuggestion}
                  onRefresh={refreshSuggestions}
                />
              )}

              {activeTab === 'rivals' && (
                <RivalsPanel
                  rivals={gameState.rivals}
                  rivalEvents={gameState.rivalEvents}
                  rivalPresence={gameState.rivalPresence}
                  districts={gameState.districts}
                  playerLevel={player?.level ?? 1}
                />
              )}

              {activeTab === 'contacts' && (
                <NPCRoster
                  npcs={gameState.npcs}
                  relationships={gameState.npcRelationships}
                  playerLevel={player?.level ?? 1}
                  onTalkTo={npc => {
                    openNPCDialogue(npc);
                    playSound('hover', muted);
                  }}
                />
              )}

              {activeTab === 'skills' && player && (
                <SkillTree player={player} onSpend={spendSkillPoint} />
              )}

              {activeTab === 'reputation' && (
                <ReputationPanel reputation={gameState.reputation} />
              )}

              {activeTab === 'office' && (
                <OfficePanel
                  upgrades={gameState.officeUpgrades}
                  purchasedSlugs={gameState.purchasedUpgradeSlugs}
                  playerMoney={player?.money ?? 0}
                  playerLevel={player?.level ?? 1}
                  incomeMultiplier={gameState.officeUpgrades
                    .filter(u => gameState.purchasedUpgradeSlugs.has(u.slug))
                    .reduce((s, u) => s + u.income_multiplier_bonus, 0)}
                  onPurchase={slug => { purchaseUpgrade(slug); playSound('quest_accept', muted); }}
                />
              )}

              {activeTab === 'achievements' && (
                <AchievementsPanel achievements={achievements} unlockedIds={unlockedAchievements} />
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-4">
                  {/* Analytics subtabs */}
                  <div className="flex gap-1.5">
                    {(['xp', 'market'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setAnalyticsSubtab(s)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          analyticsSubtab === s
                            ? 'bg-amber-500/15 border border-amber-500/35 text-amber-300'
                            : 'bg-slate-800/50 border border-slate-700/40 text-slate-500 hover:text-slate-300 hover:border-slate-600/40'
                        }`}
                      >
                        {s === 'xp' ? 'XP & Levels' : 'Market Analytics'}
                      </button>
                    ))}
                  </div>
                  {analyticsSubtab === 'xp' ? (
                    <XPAnalyticsDashboard
                      player={player}
                      dynamicQuests={dynamicQuests}
                    />
                  ) : (
                    <AnalyticsDashboard
                      player={player}
                      districts={districts}
                      playerDistricts={playerDistricts}
                      districtMarket={gameState.districtMarket}
                      dynamicQuests={dynamicQuests}
                      reputation={gameState.reputation}
                      rivals={gameState.rivals}
                      rivalPresence={gameState.rivalPresence}
                      rivalEvents={gameState.rivalEvents}
                    />
                  )}
                </div>
              )}

              {activeTab === 'leads' && player && (
                <LeadsView
                  player={player}
                  districts={districts}
                  playerDistricts={playerDistricts}
                  districtMarket={gameState.districtMarket}
                  gainXP={gainXP}
                  refreshQuests={refreshQuests}
                  investInDistrict={investInDistrict}
                  muted={muted}
                  playSound={playSound}
                  leads={leads}
                  onLeadsSync={syncLeads}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── District modal ─────────────────────────────────────────────── */}
      {selectedDistrictId && (
        <DistrictDetail
          district={selectedDistrict}
          playerDistrict={selectedPlayerDistrict}
          playerLevel={player?.level ?? 1}
          market={selectedDistrictId ? gameState.districtMarket.get(selectedDistrictId) : undefined}
          events={selectedDistrictId ? (gameState.districtEvents.get(selectedDistrictId) ?? []) : []}
          onClose={() => setSelectedDistrictId(null)}
          onEnter={handleEnterDistrict}
          onInvest={id => { investInDistrict(id); playSound('territory', muted); }}
          onCloseDeal={(districtId, dealName) => { completeDeal(districtId, dealName); playSound('quest_accept', muted); }}
          onTradingPenalty={handleOpenBinance}
        />
      )}
    </div>
  );
}

// ── Overview tab component ────────────────────────────────────────────────
function OverviewTab({
  player, playerDistricts, districts, totalHotels, avgDominance,
  completedQuestCount, activeQuestCount, levelRewards, onSelectDistrict,
  money, monthlyIncome, empireValue,
  dynamicQuests, npcs, npcRelationships, recentMatches, reputation,
}: {
  player: ReturnType<typeof useGameState>['gameState']['player'];
  playerDistricts: ReturnType<typeof useGameState>['gameState']['playerDistricts'];
  districts: ReturnType<typeof useGameState>['gameState']['districts'];
  totalHotels: number;
  avgDominance: number;
  completedQuestCount: number;
  activeQuestCount: number;
  levelRewards: ReturnType<typeof useGameState>['gameState']['levelRewards'];
  onSelectDistrict: (id: string) => void;
  money: number;
  monthlyIncome: number;
  empireValue: number;
  dynamicQuests: ReturnType<typeof useGameState>['gameState']['dynamicQuests'];
  npcs: ReturnType<typeof useGameState>['gameState']['npcs'];
  npcRelationships: ReturnType<typeof useGameState>['gameState']['npcRelationships'];
  recentMatches: ComputedMatch[];
  reputation: ReturnType<typeof useGameState>['gameState']['reputation'];
}) {
  const briefing = useDailyBriefing(
    player, districts, playerDistricts,
    dynamicQuests, npcs, npcRelationships,
    recentMatches, reputation,
  );

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">

      {/* Daily Briefing */}
      {briefing && player && (
        <div className="animate-slide-up">
          <DailyBriefing
            briefing={briefing}
            date={today}
            playerName={player.name}
          />
        </div>
      )}

      {/* Main quest card */}
      <div className="relative overflow-hidden rounded-xl border border-amber-800/30 animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-orange-950/10 to-transparent" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl" />
        <div className="relative p-5">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-amber-400 animate-float" />
            <h3 className="font-black text-amber-400 tracking-widest text-xs uppercase">Main Quest</h3>
          </div>
          <p className="text-white font-bold text-lg mb-1 leading-tight">
            Build the Leading Boutique Hotel Investment Advisory in Portugal
          </p>
          <p className="text-slate-400 text-sm mb-4">
            Dominate all 12 districts. Reach Level 50. Become the Swallow Emperor.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Districts',     value: playerDistricts.size,    total: 12 },
              { label: 'Hotels',        value: totalHotels,             total: null },
              { label: 'Avg Dominance', value: `${avgDominance}%`,      total: null },
              { label: 'Quests Done',   value: completedQuestCount,     total: activeQuestCount + completedQuestCount },
            ].map(({ label, value, total }, i) => (
              <div key={label} className={`bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center animate-slide-up stagger-${i + 1}`}>
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-amber-400 font-black text-2xl leading-none">
                  {value}
                  {total != null && <span className="text-slate-700 text-sm font-normal">/{total}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial dashboard */}
      <div className="animate-slide-up" style={{ animationDelay: '0.12s' }}>
        <MoneyDisplay money={money} monthlyIncome={monthlyIncome} empireValue={empireValue} />
      </div>

      {/* Active territories */}
      {playerDistricts.size > 0 && (
        <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Active Territories</h4>
          <div className="space-y-1.5">
            {Array.from(playerDistricts.entries()).map(([districtId, pd], i) => {
              const d = districts.find(x => x.id === districtId);
              if (!d) return null;
              const mp = Math.round(pd.market_share * 100);
              return (
                <button
                  key={districtId}
                  onClick={() => onSelectDistrict(districtId)}
                  className={`w-full flex items-center gap-3 bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-2.5 transition-all group animate-slide-in-left stagger-${Math.min(i + 1, 12)}`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                  <span className="text-white font-bold text-sm flex-shrink-0 w-20 text-left">{d.name}</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${mp}%`,
                        background: 'linear-gradient(90deg, #f59e0b, #f97316)',
                        boxShadow: `0 0 6px #f59e0b60`,
                      }}
                    />
                  </div>
                  <span className="text-amber-400 text-xs font-bold w-9 text-right flex-shrink-0">{mp}%</span>
                  <span className="text-slate-600 text-xs w-6 text-right flex-shrink-0 group-hover:text-slate-400 transition-colors">T{pd.territory_level}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Level roadmap */}
      {player && (
        <div className="animate-slide-up" style={{ animationDelay: '0.25s' }}>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Level Roadmap</h4>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[...Array(Math.min(50 - player.level + 1, 10))].map((_, i) => {
              const lv = player.level + i;
              const r = levelRewards.get(lv);
              if (!r || lv > 50) return null;
              const isCurrent = i === 0;
              return (
                <div
                  key={lv}
                  className={`flex-shrink-0 rounded-xl px-3 py-2.5 text-center min-w-[80px] border transition-all ${
                    isCurrent
                      ? 'border-amber-600/60 bg-amber-900/20 shadow-lg shadow-amber-900/20'
                      : 'border-slate-800 bg-slate-900/40'
                  }`}
                  style={isCurrent ? { '--glow-color': '#f59e0b40' } as React.CSSProperties : {}}
                >
                  <p
                    className="text-sm font-black mb-0.5"
                    style={{ color: isCurrent ? r.badge_color : '#334155' }}
                  >
                    {lv}
                  </p>
                  <p className="text-xs text-slate-600 truncate leading-tight">{r.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { LOCATION_OPTIONS } from './types/game';

function LeadsView({
  player, districts, playerDistricts, districtMarket,
  gainXP, refreshQuests, investInDistrict, muted, playSound,
  leads, onLeadsSync,
}: {
  player: NonNullable<ReturnType<typeof useGameState>['gameState']['player']>;
  districts: ReturnType<typeof useGameState>['gameState']['districts'];
  playerDistricts: ReturnType<typeof useGameState>['gameState']['playerDistricts'];
  districtMarket: ReturnType<typeof useGameState>['gameState']['districtMarket'];
  gainXP: ReturnType<typeof useGameState>['gainXP'];
  refreshQuests: ReturnType<typeof useGameState>['refreshQuests'];
  investInDistrict: ReturnType<typeof useGameState>['investInDistrict'];
  muted: boolean;
  playSound: (name: string, muted: boolean) => void;
  leads: Lead[];
  onLeadsSync: (leads: Lead[]) => void;
}) {
  const [leadsTab, setLeadsTab] = useState<'matching' | 'heatmap' | 'analytics' | 'settings' | 'crm'>('matching');

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800/50 rounded-xl p-1 w-fit">
        {([
          { key: 'matching',  label: 'Matching Engine' },
          { key: 'crm',       label: 'CRM' },
          { key: 'heatmap',   label: 'District Heatmap' },
          { key: 'analytics', label: 'Match Analytics' },
          { key: 'settings',  label: 'Notion Settings' },
        ] as { key: typeof leadsTab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setLeadsTab(t.key)}
            className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
            style={{
              backgroundColor: leadsTab === t.key ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: leadsTab === t.key ? '#f59e0b' : '#475569',
              border: leadsTab === t.key ? '1px solid rgba(245,158,11,0.25)' : '1px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {leadsTab === 'matching' && (
        <LeadsMatchingPanel
          playerId={player.id}
          playerLevel={player.level}
          districts={districts}
          playerDistricts={playerDistricts}
          onXPGained={xp => { gainXP(xp); playSound('level_up', muted); }}
          onQuestGenerated={() => { refreshQuests(); playSound('quest_accept', muted); }}
          onDominanceGained={(districtId) => { investInDistrict(districtId); playSound('territory', muted); }}
          externalLeads={leads}
        />
      )}

      {leadsTab === 'crm' && (
        <LeadsCRMPanel
          playerId={player.id}
          externalLeads={leads}
          onLeadsSync={onLeadsSync}
        />
      )}

      {leadsTab === 'heatmap' && (
        <DistrictHeatmap
          playerId={player.id}
          districts={districts}
          playerDistricts={playerDistricts}
          districtMarket={districtMarket}
          locationOptions={LOCATION_OPTIONS}
          externalLeads={leads}
        />
      )}

      {leadsTab === 'analytics' && (
        <MatchAnalyticsDashboard
          playerId={player.id}
          districts={districts}
          externalLeads={leads}
        />
      )}

      {leadsTab === 'settings' && (
        <NotionSettingsPanel
          playerId={player.id}
          leads={leads}
          onLeadsSync={onLeadsSync}
        />
      )}
    </div>
  );
}

export default App;
