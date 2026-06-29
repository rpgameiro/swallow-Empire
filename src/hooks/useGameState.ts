import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, LevelUpEvent, PlayerSkills, QuestCompletionEvent, DistrictEvent, xpRequiredForLevel, EnergyDelta, ENERGY_ACTIONS } from '../types/game';
import {
  loadOrCreatePlayer, getPlayerStats, getDistricts, getPlayerDistricts,
  getQuests, getPlayerQuests, getAchievements, getPlayerAchievements,
  getLevelRewards, updatePlayer, completeQuestDB, unlockAchievementDB,
  enterDistrict, progressDistrictTerritory, investInDistrictDB, recordLevelUp,
  incrementPlayerStats, getOfficeUpgrades, getPurchasedUpgrades, purchaseOfficeUpgrade,
  getOrCreateReputation, updateReputation, getOfficialQuests,
} from '../services/supabase';
import {
  DynamicQuest, getDynamicQuests, completeDynamicQuest, insertDynamicQuests,
  refreshDailyQuests, refreshWeeklyQuests, ensureMainQuests, ensureLegendaryQuests,
} from '../services/questEngine';
import {
  getDistrictMarketData, getDistrictEvents,
} from '../services/marketEngine';
import {
  getAllNPCs, getNPCRelationships, upsertNPCRelationship, logNPCInteraction,
  getDialogueForNPC, trustToStatus,
} from '../services/npcService';
import {
  getRivalFirms, getRivalPresence, getRivalEvents, markRivalEventRead,
} from '../services/rivalEngine';
import { generateSuggestions, loadSuggestions } from '../services/suggestionEngine';
import { acceptMission, dismissAISuggestion, snoozeSuggestion } from '../services/supabase';
import { AISuggestion } from '../types/game';
import {
  NPC, PlayerNPCRelationship, NPCDialogueChoice, ActiveNPCDialogue,
  RivalFirm, RivalDistrictPresence, RivalEvent,
  PendingCinematicDeal, CinematicNegotiationRound, DealTier,
} from '../types/game';

const buildRivalPresenceMap = (arr: RivalDistrictPresence[]): Map<string, RivalDistrictPresence[]> => {
  const map = new Map<string, RivalDistrictPresence[]>();
  for (const p of arr) {
    if (!map.has(p.district_id)) map.set(p.district_id, []);
    map.get(p.district_id)!.push(p);
  }
  return map;
};

const buildEventsMap = (events: DistrictEvent[]): Map<string, DistrictEvent[]> => {
  const map = new Map<string, DistrictEvent[]>();
  for (const e of events) {
    if (!map.has(e.district_id)) map.set(e.district_id, []);
    map.get(e.district_id)!.push(e);
  }
  return map;
};

const initial: GameState = {
  player: null, stats: null, districts: [], playerDistricts: new Map(),
  quests: [], playerQuests: [], dynamicQuests: [], officialQuests: [], aiSuggestions: [],
  achievements: [], unlockedAchievements: new Set(),
  levelRewards: new Map(), pendingLevelUps: [], pendingQuestCompletions: [],
  pendingDealCompletions: [],
  pendingCinematicDeal: null,
  npcs: [],
  npcRelationships: new Map(),
  activeNPCDialogue: null,
  rivals: [],
  rivalPresence: new Map(),
  rivalEvents: [],
  pendingRivalEvents: [],
  officeUpgrades: [], purchasedUpgradeSlugs: new Set(),
  reputation: null,
  districtMarket: new Map(),
  districtEvents: new Map(),
  loading: true,
};

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>(initial);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    (async () => {
      try {
        const player = await loadOrCreatePlayer();
        const [stats, districts, playerDistrictsArr, quests, playerQuests,
               achievements, unlockedIds, levelRewardsArr,
               officeUpgrades, purchasedUpgradeIds, reputation,
               marketDataArr, eventsArr, npcList, npcRelArr,
               rivalList, rivalPresenceArr, rivalEventsArr,
               officialQuestsArr] = await Promise.all([
          getPlayerStats(player.id),
          getDistricts(),
          getPlayerDistricts(player.id),
          getQuests(),
          getPlayerQuests(player.id),
          getAchievements(),
          getPlayerAchievements(player.id),
          getLevelRewards(),
          getOfficeUpgrades(),
          getPurchasedUpgrades(player.id),
          getOrCreateReputation(player.id),
          getDistrictMarketData(),
          getDistrictEvents(),
          getAllNPCs(),
          getNPCRelationships(player.id),
          getRivalFirms(),
          getRivalPresence(),
          getRivalEvents(player.id),
          getOfficialQuests(),
        ]);

        const playerDistricts = new Map(playerDistrictsArr.map(pd => [pd.district_id, pd]));

        // Bootstrap dynamic quest engine
        const existingAll = await getDynamicQuests(player.id);
        const ctx = { player, playerDistricts, districts, existingActive: existingAll };

        const [dailies, weeklies, mains, legendaries] = await Promise.all([
          refreshDailyQuests(ctx),
          refreshWeeklyQuests(ctx),
          ensureMainQuests({ ...ctx, existingActive: existingAll }),
          ensureLegendaryQuests({ ...ctx, existingActive: existingAll }),
        ]);

        const dynamicQuests = await getDynamicQuests(player.id);

        // Bootstrap AI suggestions
        const existingSuggestions = await loadSuggestions(player);
        const aiSuggestions = await generateSuggestions({
          player,
          playerDistricts,
          districts,
          dynamicQuests,
          existingSuggestions,
        });

        // Map purchased upgrade UUIDs → slugs
        const purchasedSlugs = new Set(
          purchasedUpgradeIds
            .map(uid => officeUpgrades.find((u: { id: string; slug: string }) => u.id === uid)?.slug)
            .filter(Boolean) as string[]
        );

        setGameState({
          player, stats, districts, playerDistricts,
          quests, playerQuests, dynamicQuests, officialQuests: officialQuestsArr, aiSuggestions,
          achievements, unlockedAchievements: new Set(unlockedIds),
          levelRewards: new Map(levelRewardsArr.map(r => [r.level, r])),
          pendingLevelUps: [], pendingQuestCompletions: [], pendingDealCompletions: [],
          pendingCinematicDeal: null,
          officeUpgrades, purchasedUpgradeSlugs: purchasedSlugs,
          reputation,
          districtMarket: new Map(marketDataArr.map(m => [m.district_id, m])),
          districtEvents: buildEventsMap(eventsArr),
          npcs: npcList,
          npcRelationships: new Map(npcRelArr.map(r => [r.npc_id, r])),
          activeNPCDialogue: null,
          rivals: rivalList,
          rivalPresence: buildRivalPresenceMap(rivalPresenceArr),
          rivalEvents: rivalEventsArr,
          pendingRivalEvents: rivalEventsArr.filter(e => !e.is_read),
          loading: false,
        });
      } catch (err) {
        console.error('Game init failed:', err);
        setGameState(prev => ({ ...prev, loading: false }));
      }
    })();
  }, []);

  // ─── Core XP engine (shared by all callers) ────────────────────────────────

  const applyXPGain = (
    prev: GameState,
    amount: number
  ): GameState => {
    if (!prev.player) return prev;

    let xp = prev.player.current_xp + amount;
    let total = prev.player.total_xp + amount;
    let level = prev.player.level;
    let xpToNext = prev.player.xp_to_next_level;
    const events: LevelUpEvent[] = [];
    const skillDeltas: Partial<PlayerSkills> = {};
    let spDelta = 0;

    while (xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      xpToNext = xpRequiredForLevel(level + 1);
      const reward = prev.levelRewards.get(level);
      if (reward) {
        const gains: Partial<PlayerSkills> = {
          negotiation: reward.auto_negotiation,
          networking:  reward.auto_networking,
          focus:       reward.auto_focus,
          discipline:  reward.auto_discipline,
          leadership:  reward.auto_leadership,
          reputation:  reward.auto_reputation,
        };
        Object.entries(gains).forEach(([k, v]) => {
          if ((v as number) > 0) (skillDeltas as any)[k] = ((skillDeltas as any)[k] ?? 0) + (v as number);
        });
        spDelta += reward.skill_points_granted;
        events.push({ newLevel: level, reward, statGains: gains, skillPointsGained: reward.skill_points_granted });
      }
    }

    const base = prev.player;
    const updated = {
      ...base,
      current_xp: xp, total_xp: total, level, xp_to_next_level: xpToNext,
      negotiation:  base.negotiation  + (skillDeltas.negotiation  ?? 0),
      networking:   base.networking   + (skillDeltas.networking   ?? 0),
      focus:        base.focus        + (skillDeltas.focus        ?? 0),
      discipline:   base.discipline   + (skillDeltas.discipline   ?? 0),
      leadership:   base.leadership   + (skillDeltas.leadership   ?? 0),
      reputation:   base.reputation   + (skillDeltas.reputation   ?? 0),
      skill_points: base.skill_points + spDelta,
      total_skill_points_earned: base.total_skill_points_earned + spDelta,
    };

    updatePlayer(base.id, {
      current_xp: updated.current_xp, total_xp: updated.total_xp,
      level: updated.level, xp_to_next_level: updated.xp_to_next_level,
      negotiation: updated.negotiation, networking: updated.networking,
      focus: updated.focus, discipline: updated.discipline,
      leadership: updated.leadership, reputation: updated.reputation,
      skill_points: updated.skill_points,
      total_skill_points_earned: updated.total_skill_points_earned,
    });

    if (events.length > 0) events.forEach(e => recordLevelUp(base.id, e.newLevel));

    return {
      ...prev,
      player: updated,
      pendingLevelUps: [...prev.pendingLevelUps, ...events],
    };
  };

  // ─── Energy / vitality engine ─────────────────────────────────────────────

  const applyEnergyDelta = (prev: GameState, delta: EnergyDelta): GameState => {
    if (!prev.player) return prev;
    const p = prev.player;
    const maxE = p.max_energy ?? 100;

    const newEnergy  = Math.max(0, Math.min(maxE, (p.energy ?? 80)  + (delta.energy  ?? 0)));
    const newStress  = Math.max(0, Math.min(100,  (p.stress ?? 20)  + (delta.stress  ?? 0)));
    const newMorale  = Math.max(0, Math.min(100,  (p.morale ?? 75)  + (delta.morale  ?? 0)));
    const newFocus   = Math.max(0, Math.min(200,  (p.focus  ?? 10)  + (delta.focus   ?? 0)));

    // High stress degrades focus passively
    const stressPenalty = newStress > 70 ? -Math.floor((newStress - 70) / 10) : 0;
    const finalFocus = Math.max(0, newFocus + stressPenalty);

    // Discipline slightly increases max_energy (every 20 discipline = +5 max energy)
    const newMaxEnergy = Math.max(100, 100 + Math.floor(p.discipline / 20) * 5);

    const updated = { ...p, energy: newEnergy, stress: newStress, morale: newMorale, focus: finalFocus, max_energy: newMaxEnergy };
    updatePlayer(p.id, { energy: newEnergy, stress: newStress, morale: newMorale, focus: finalFocus, max_energy: newMaxEnergy });
    return { ...prev, player: updated };
  };


  // ─── Rival event dismiss ───────────────────────────────────────────────────

  const dismissRivalEvent = useCallback((eventId: string) => {
    markRivalEventRead(eventId);
    setGameState(prev => ({
      ...prev,
      rivalEvents: prev.rivalEvents.map(e => e.id === eventId ? { ...e, is_read: true } : e),
      pendingRivalEvents: prev.pendingRivalEvents.filter(e => e.id !== eventId),
    }));
  }, []);

  const gainXP = useCallback((amount: number) => {
    setGameState(prev => applyXPGain(prev, amount));
  }, []);

  const dismissLevelUp = useCallback(() => {
    setGameState(prev => ({ ...prev, pendingLevelUps: prev.pendingLevelUps.slice(1) }));
  }, []);

  const dismissQuestCompletion = useCallback(() => {
    setGameState(prev => ({ ...prev, pendingQuestCompletions: prev.pendingQuestCompletions.slice(1) }));
  }, []);

  // ─── Dynamic quest completion ──────────────────────────────────────────────

  type RepDelta = Partial<{ investor_rep: number; owner_rep: number; market_rep: number; operator_rep: number; broker_rep: number; luxury_rep: number }>;

  // Map quest category → which rep track(s) to increment
  const categoryToRepDelta = (
    category: string, amount: number
  ): RepDelta => {
    const base = Math.max(1, Math.round(amount / 3));
    switch (category) {
      case 'acquisition': return { owner_rep: base, market_rep: Math.floor(base / 2), broker_rep: Math.floor(base / 3) };
      case 'territory':   return { owner_rep: base, operator_rep: Math.floor(base / 2) };
      case 'networking':  return { investor_rep: base, market_rep: Math.floor(base / 2), broker_rep: Math.floor(base / 4) };
      case 'finance':     return { investor_rep: base, luxury_rep: Math.floor(base / 4) };
      case 'operations':  return { operator_rep: base };
      case 'management':  return { operator_rep: base, owner_rep: Math.floor(base / 2) };
      case 'brand':       return { market_rep: base, luxury_rep: Math.floor(base / 3) };
      case 'story':       return { market_rep: base, investor_rep: Math.floor(base / 2) };
      default:            return { market_rep: base };
    }
  };

  const completeDynQuest = useCallback((questId: string, districtId?: string) => {
    setGameState(prev => {
      if (!prev.player) return prev;

      const quest = prev.dynamicQuests.find(q => q.id === questId);
      if (!quest || quest.status !== 'active') return prev;

      const district = districtId ? prev.districts.find(d => d.id === districtId) : undefined;
      const pd = districtId ? prev.playerDistricts.get(districtId) : undefined;
      const xpBonus = district && pd ? Math.floor(quest.xp_reward * district.xp_bonus / 100) : 0;
      const totalXP = quest.xp_reward + xpBonus;

      const repGain = quest.reputation_reward;
      const spGain = quest.skill_point_reward;
      const moneyGain = quest.money_reward ?? 0;

      // Map quest category → reputation track gains
      const repDelta = categoryToRepDelta(quest.category, repGain);
      if (prev.reputation) {
        updateReputation(prev.player.id, repDelta).then(updated => {
          setGameState(s => ({ ...s, reputation: updated }));
        });
      }

      // Persist
      completeDynamicQuest(questId);
      completeQuestDB(prev.player.id, questId, totalXP);

      if (districtId && pd) {
        progressDistrictTerritory(prev.player.id, districtId, Math.floor(quest.xp_reward / 2), repGain)
          .then(updated => {
            setGameState(s => {
              const m = new Map(s.playerDistricts);
              m.set(districtId, updated);
              return { ...s, playerDistricts: m };
            });
          });
      }

      const completionEvent: QuestCompletionEvent = {
        questId,
        title: quest.title,
        xpEarned: totalXP,
        moneyEarned: moneyGain,
        reputationEarned: repGain,
        skillPointsEarned: spGain,
        bonusType: quest.bonus_reward_type,
        bonusValue: quest.bonus_reward_value,
        difficulty: quest.difficulty,
        questType: quest.quest_type,
      };

      // Update dynamic quests list
      const updatedDynamic = prev.dynamicQuests.map(q =>
        q.id === questId ? { ...q, status: 'completed' as const, completed_at: new Date().toISOString() } : q
      );

      // Recalculate empire value: hotels * 250k + districts * 100k + market share bonus
      const hotelsTotal = Array.from(prev.playerDistricts.values()).reduce((s, d) => s + d.hotels_invested, 0);
      const districtCount = prev.playerDistricts.size;
      const totalMarket = Array.from(prev.playerDistricts.values()).reduce((s, d) => s + d.market_share, 0);
      const newEmpireValue = hotelsTotal * 250_000 + districtCount * 100_000 + Math.round(totalMarket * 500_000);

      // Monthly income: advisory fees per active district + quest income contribution
      const newMonthlyIncome = districtCount * 15_000 + hotelsTotal * 5_000 + Math.round(moneyGain * 0.1);

      const newMoney = (prev.player.money ?? 0) + moneyGain;

      // Persist financial updates
      updatePlayer(prev.player.id, {
        money: newMoney,
        monthly_income: newMonthlyIncome,
        empire_value: newEmpireValue,
        reputation: prev.player.reputation + repGain,
        skill_points: prev.player.skill_points + spGain,
        total_skill_points_earned: prev.player.total_skill_points_earned + spGain,
      });

      const stateWithMarkedQuest = {
        ...prev,
        dynamicQuests: updatedDynamic,
        pendingQuestCompletions: [...prev.pendingQuestCompletions, completionEvent],
        player: {
          ...prev.player,
          money: newMoney,
          monthly_income: newMonthlyIncome,
          empire_value: newEmpireValue,
          reputation: prev.player.reputation + repGain,
          skill_points: prev.player.skill_points + spGain,
          total_skill_points_earned: prev.player.total_skill_points_earned + spGain,
        },
      };

      const stateAfterXP = applyXPGain(stateWithMarkedQuest, totalXP);
      return applyEnergyDelta(stateAfterXP, ENERGY_ACTIONS.quest_complete);
    });
  }, []);

  // ─── District actions ──────────────────────────────────────────────────────

  const enterNewDistrict = useCallback((districtId: string) => {
    setGameState(prev => {
      if (!prev.player) return prev;
      const district = prev.districts.find(d => d.id === districtId);
      if (!district || prev.player.level < district.unlock_requirement) return prev;

      enterDistrict(prev.player.id, districtId).then(pd => {
        setGameState(s => {
          const m = new Map(s.playerDistricts);
          m.set(districtId, pd);
          return { ...s, playerDistricts: m };
        });
        gainXP(50);
      });

      return prev;
    });
  }, [gainXP]);

  const investInDistrict = useCallback((districtId: string) => {
    setGameState(prev => {
      if (!prev.player) return prev;

      investInDistrictDB(prev.player.id, districtId).then(pd => {
        setGameState(s => {
          const m = new Map(s.playerDistricts);
          m.set(districtId, pd);
          return { ...s, playerDistricts: m };
        });
        gainXP(75);
      });

      return prev;
    });
  }, [gainXP]);

  const dismissDealCompletion = useCallback(() => {
    setGameState(prev => ({ ...prev, pendingDealCompletions: prev.pendingDealCompletions.slice(1) }));
  }, []);

  // Deal values scale with district difficulty and player level
  const DEAL_MONEY: Record<string, number> = {
    'Boutique Advisory Contract': 8_000,
    'Hotel Acquisition Study':    15_000,
    'Feasibility Report':         5_000,
    'Asset Repositioning':        25_000,
    'Portfolio Audit':            12_000,
  };

  const REGION_ACCENT_HOOK: Record<string, string> = {
    'Lisbon Region': '#f59e0b',
    'North':         '#3b82f6',
    'Central':       '#10b981',
    'Alentejo':      '#8b5cf6',
    'Algarve':       '#ef4444',
    'Islands':       '#ec4899',
  };

  // ─── Cinematic deal generator ──────────────────────────────────────────────

  const OPPONENTS = [
    { name: 'Ricardo Neves', title: 'Senior Partner, Ático Capital' },
    { name: 'Leonor Batista', title: 'Managing Director, Fênix Advisory' },
    { name: 'Filipe Vasconcelos', title: 'Head of Acquisitions, Lusitano Group' },
    { name: 'Beatriz Monteiro', title: 'Principal, Bravo & Associates' },
    { name: 'Eduardo Caldas', title: 'Partner, Atlas Hospitality' },
    { name: 'Inês Noronha', title: 'Deal Lead, Meridian Capital' },
  ];

  const NEGOTIATION_MOVES: Record<string, CinematicNegotiationRound[]> = {
    opening: [
      {
        playerMove: 'Present detailed market analysis supporting the asking price reduction.',
        opponentResponse: 'Counter with recent comparable transactions at full market value.',
        advantage: 'neutral',
        outcomeText: 'Both sides hold firm — tension escalates.',
      },
    ],
    pressure: [
      {
        playerMove: 'Introduce a competing offer to create urgency.',
        opponentResponse: 'Challenge the validity of the competing bid.',
        advantage: 'player',
        outcomeText: 'Opponent visibly unsettled by the competitive pressure.',
      },
    ],
    technical: [
      {
        playerMove: 'Present due diligence findings on property condition issues.',
        opponentResponse: 'Disputes findings with their own independent assessment.',
        advantage: 'opponent',
        outcomeText: 'Technical dispute stalls proceedings briefly.',
      },
    ],
    financing: [
      {
        playerMove: 'Propose deferred payment structure to ease seller concerns.',
        opponentResponse: 'Insists on clean all-cash offer as condition of sale.',
        advantage: 'neutral',
        outcomeText: 'Financing structure remains unresolved — pivotal moment.',
      },
    ],
    closing: [
      {
        playerMove: 'Offer enhanced advisory services post-transaction as added incentive.',
        opponentResponse: 'Attempts to match with their own post-sale support package.',
        advantage: 'player',
        outcomeText: 'Your relationship depth wins the room.',
      },
    ],
    legendary: [
      {
        playerMove: 'Invoke sovereign wealth fund interest to reframe the deal stakes.',
        opponentResponse: 'Questions credibility of international capital claim.',
        advantage: 'player',
        outcomeText: 'Room shifts — your network is undeniable.',
      },
      {
        playerMove: 'Propose an exclusive portfolio management mandate post-acquisition.',
        opponentResponse: 'Tries to split the mandate offer to reduce your leverage.',
        advantage: 'opponent',
        outcomeText: 'Opponent seizes partial advantage — critical juncture.',
      },
      {
        playerMove: 'Final play: stake your full reputation on this transaction.',
        opponentResponse: 'Calls the bluff, betting on seller hesitation.',
        advantage: 'player',
        outcomeText: 'Seller chooses you. Your empire expands.',
      },
    ],
  };

  const buildCinematicDeal = (
    dealName: string,
    district: { name: string; base_difficulty: number; region: string },
    moneyEarned: number,
    repEarned: number,
    xpEarned: number,
    dominanceGained: number,
    level: number,
  ): PendingCinematicDeal => {
    const difficulty = district.base_difficulty;
    const tier: DealTier = difficulty >= 5 ? 'legendary' : difficulty >= 3 ? 'major' : 'standard';
    const opponent = OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)];

    let rounds: CinematicNegotiationRound[];
    if (tier === 'legendary') {
      rounds = NEGOTIATION_MOVES.legendary;
    } else if (tier === 'major') {
      rounds = [
        ...NEGOTIATION_MOVES.opening,
        ...NEGOTIATION_MOVES.pressure,
        ...NEGOTIATION_MOVES.closing,
      ];
    } else {
      rounds = [
        ...NEGOTIATION_MOVES.opening,
        ...NEGOTIATION_MOVES.financing,
      ];
    }

    const accentColor = REGION_ACCENT_HOOK[district.region] ?? '#f59e0b';
    const valueMult = tier === 'legendary' ? 12 : tier === 'major' ? 6 : 3;

    return {
      id: `cin_${Date.now()}`,
      tier,
      dealName,
      districtName: district.name,
      accentColor,
      moneyEarned,
      reputationEarned: repEarned,
      dominanceGained,
      xpEarned,
      opponentName: opponent.name,
      opponentTitle: opponent.title,
      dealValue: moneyEarned * valueMult,
      negotiationRounds: rounds,
    };
  };

  const dismissCinematicDeal = useCallback(() => {
    setGameState(prev => ({ ...prev, pendingCinematicDeal: null }));
  }, []);

  const completeDeal = useCallback((districtId: string, dealName: string) => {
    setGameState(prev => {
      if (!prev.player) return prev;

      const district = prev.districts.find(d => d.id === districtId);
      const pd = prev.playerDistricts.get(districtId);
      if (!district || !pd) return prev;

      const level = prev.player.level;
      const difficultyMult = 1 + (district.base_difficulty - 1) * 0.2;
      const levelMult = 1 + (level - 1) * 0.05;
      const baseMoney = DEAL_MONEY[dealName] ?? 10_000;
      const moneyEarned = Math.round(baseMoney * difficultyMult * levelMult);
      const repEarned = 5 + district.base_difficulty * 3;
      const dominanceGained = 0.06;
      const accentColor = REGION_ACCENT_HOOK[district.region] ?? '#f59e0b';

      // Update district dominance
      const newMarketShare = Math.min(pd.market_share + dominanceGained, 1.0);
      const newDistrictRep = pd.district_reputation + repEarned;
      const newPd: typeof pd = { ...pd, market_share: newMarketShare, district_reputation: newDistrictRep };

      // Update player financials
      const newMoney = (prev.player.money ?? 0) + moneyEarned;
      const newPlayerRep = prev.player.reputation + repEarned;
      const hotelsTotal = Array.from(prev.playerDistricts.values()).reduce((s, d) => s + d.hotels_invested, 0);
      const districtCount = prev.playerDistricts.size;
      const totalMarket = Array.from(prev.playerDistricts.values()).reduce((s, d) => s + d.market_share, 0) + dominanceGained;
      const newEmpireValue = hotelsTotal * 250_000 + districtCount * 100_000 + Math.round(totalMarket * 500_000);
      const newMonthlyIncome = districtCount * 15_000 + hotelsTotal * 5_000 + Math.round(moneyEarned * 0.08);

      // Persist
      progressDistrictTerritory(prev.player.id, districtId, 50, repEarned).then(updated => {
        setGameState(s => {
          const m = new Map(s.playerDistricts);
          m.set(districtId, updated);
          return { ...s, playerDistricts: m };
        });
      });
      updatePlayer(prev.player.id, {
        money: newMoney,
        reputation: newPlayerRep,
        monthly_income: newMonthlyIncome,
        empire_value: newEmpireValue,
      });
      incrementPlayerStats(prev.player.id, { deals_closed: 1 });

      // Deals earn owner_rep + operator_rep + broker_rep for harder deals
      if (prev.reputation) {
        const dealRepDelta: RepDelta = {
          owner_rep:    Math.max(1, Math.floor(repEarned * 0.4)),
          operator_rep: Math.max(1, Math.floor(repEarned * 0.25)),
          market_rep:   Math.max(1, Math.floor(repEarned * 0.2)),
          broker_rep:   Math.max(1, Math.floor(repEarned * 0.1)),
          ...(district.base_difficulty >= 4 ? { luxury_rep: Math.max(1, Math.floor(repEarned * 0.1)) } : {}),
        };
        updateReputation(prev.player.id, dealRepDelta).then(updated => {
          setGameState(s => ({ ...s, reputation: updated }));
        });
      }

      const xpEarned = 100 + district.base_difficulty * 25;
      const newPlayerDistricts = new Map(prev.playerDistricts);
      newPlayerDistricts.set(districtId, newPd);

      // Major/legendary deals (difficulty >= 3) get the cinematic sequence
      const useCinematic = district.base_difficulty >= 3;

      const dealEvent = !useCinematic ? {
        districtName: district.name,
        dealName,
        moneyEarned,
        reputationEarned: repEarned,
        dominanceGained: Math.round(dominanceGained * 100),
        accentColor,
      } : null;

      const cinematicDeal = useCinematic
        ? buildCinematicDeal(dealName, district, moneyEarned, repEarned, xpEarned, Math.round(dominanceGained * 100), level)
        : null;

      const stateAfterDeal = {
        ...prev,
        playerDistricts: newPlayerDistricts,
        pendingDealCompletions: dealEvent
          ? [...prev.pendingDealCompletions, dealEvent]
          : prev.pendingDealCompletions,
        pendingCinematicDeal: cinematicDeal ?? prev.pendingCinematicDeal,
        player: {
          ...prev.player,
          money: newMoney,
          reputation: newPlayerRep,
          monthly_income: newMonthlyIncome,
          empire_value: newEmpireValue,
        },
      };

      const stateAfterXP = applyXPGain(stateAfterDeal, xpEarned);
      // Big deals restore energy and morale, reduce stress
      const dealEnergyAction = district.base_difficulty >= 4 ? ENERGY_ACTIONS.deal_success : ENERGY_ACTIONS.deal_small;
      return applyEnergyDelta(stateAfterXP, dealEnergyAction);
    });
  }, [gainXP]);

  const applyTradingPenalty = useCallback(() => {
    setGameState(prev => {
      if (!prev.player) return prev;

      // Subtract 50 XP (floor at 0, no level-down)
      const newXP = Math.max(prev.player.current_xp - 50, 0);
      const newTotal = Math.max(prev.player.total_xp - 50, 0);

      const updated = {
        ...prev.player,
        current_xp: newXP,
        total_xp: newTotal,
        focus:      Math.max(prev.player.focus - 10, 0),
        discipline: Math.max(prev.player.discipline - 10, 0),
        no_trading_streak: 0,
      };

      updatePlayer(prev.player.id, {
        current_xp: updated.current_xp,
        total_xp: updated.total_xp,
        focus: updated.focus,
        discipline: updated.discipline,
        no_trading_streak: 0,
      });

      return applyEnergyDelta({ ...prev, player: updated }, ENERGY_ACTIONS.trading_action);
    });
  }, []);

  // ─── Skill points ──────────────────────────────────────────────────────────

  const spendSkillPoint = useCallback((stat: keyof PlayerSkills) => {
    setGameState(prev => {
      if (!prev.player || prev.player.skill_points <= 0) return prev;
      const updated = {
        ...prev.player,
        [stat]: (prev.player[stat] as number) + 3,
        skill_points: prev.player.skill_points - 1,
      };
      updatePlayer(prev.player.id, { [stat]: updated[stat], skill_points: updated.skill_points });
      return { ...prev, player: updated };
    });
  }, []);

  // ─── Achievements ──────────────────────────────────────────────────────────

  const unlockNewAchievement = useCallback((achievementId: string) => {
    setGameState(prev => {
      if (!prev.player || prev.unlockedAchievements.has(achievementId)) return prev;
      const achievement = prev.achievements.find(a => a.id === achievementId);
      unlockAchievementDB(prev.player.id, achievementId);
      const newSet = new Set(prev.unlockedAchievements);
      newSet.add(achievementId);
      const next = { ...prev, unlockedAchievements: newSet };
      if (achievement) return applyXPGain(next, achievement.xp_reward);
      return next;
    });
  }, []);

  // ─── Refresh quests on demand ──────────────────────────────────────────────

  const refreshQuests = useCallback(async () => {
    setGameState(prev => {
      if (!prev.player) return prev;
      const ctx = {
        player: prev.player,
        playerDistricts: prev.playerDistricts,
        districts: prev.districts,
        existingActive: prev.dynamicQuests,
      };

      Promise.all([
        refreshDailyQuests(ctx),
        refreshWeeklyQuests(ctx),
        ensureMainQuests(ctx),
        ensureLegendaryQuests(ctx),
      ]).then(() => {
        getDynamicQuests(prev.player!.id).then(dqs => {
          setGameState(s => ({ ...s, dynamicQuests: dqs }));
        });
      });

      return prev;
    });
  }, []);

  const purchaseUpgrade = useCallback((upgradeSlug: string) => {
    setGameState(prev => {
      if (!prev.player) return prev;
      const upgrade = prev.officeUpgrades.find(u => u.slug === upgradeSlug);
      if (!upgrade) return prev;
      if (prev.purchasedUpgradeSlugs.has(upgradeSlug)) return prev;
      if (prev.player.money < upgrade.cost) return prev;
      if (prev.player.level < upgrade.required_level) return prev;
      if (upgrade.required_slug && !prev.purchasedUpgradeSlugs.has(upgrade.required_slug)) return prev;

      const newMoney = prev.player.money - upgrade.cost;
      const newRep   = prev.player.reputation + upgrade.reputation_bonus;

      // Monthly income boosted by cumulative income_multiplier_bonus across all owned upgrades
      const allMultiplier = Array.from(prev.purchasedUpgradeSlugs)
        .reduce((acc, slug) => {
          const u = prev.officeUpgrades.find(x => x.slug === slug);
          return acc + (u?.income_multiplier_bonus ?? 0);
        }, 0) + upgrade.income_multiplier_bonus;

      const baseIncome = prev.playerDistricts.size * 15_000
        + Array.from(prev.playerDistricts.values()).reduce((s, d) => s + d.hotels_invested, 0) * 5_000;
      const newMonthlyIncome = Math.round(baseIncome * (1 + allMultiplier));

      const newPurchased = new Set(prev.purchasedUpgradeSlugs);
      newPurchased.add(upgradeSlug);

      // Persist
      purchaseOfficeUpgrade(prev.player.id, upgrade.id);
      updatePlayer(prev.player.id, {
        money: newMoney,
        reputation: newRep,
        monthly_income: newMonthlyIncome,
      });

      const stateAfterPurchase = {
        ...prev,
        purchasedUpgradeSlugs: newPurchased,
        player: { ...prev.player, money: newMoney, reputation: newRep, monthly_income: newMonthlyIncome },
      };

      return applyXPGain(stateAfterPurchase, upgrade.xp_bonus_pct > 0 ? upgrade.xp_bonus_pct * 10 : 200);
    });
  }, []);


  // ─── Energy public actions ─────────────────────────────────────────────────

  const performAction = useCallback((action: keyof typeof ENERGY_ACTIONS) => {
    setGameState(prev => applyEnergyDelta(prev, ENERGY_ACTIONS[action]));
  }, []);

  const restoreEnergy = useCallback((type: 'rest' | 'morning_routine' = 'rest') => {
    setGameState(prev => applyEnergyDelta(prev, ENERGY_ACTIONS[type]));
  }, []);


  // ─── NPC system ───────────────────────────────────────────────────────────

  const openNPCDialogue = useCallback((npc: NPC) => {
    setGameState(prev => {
      if (!prev.player) return prev;

      // Get or initialise relationship
      const existingRel = prev.npcRelationships.get(npc.id);
      const relationship: PlayerNPCRelationship = existingRel ?? {
        id: '',
        player_id: prev.player.id,
        npc_id: npc.id,
        trust_level: npc.base_trust,
        relationship_status: 'stranger',
        interaction_count: 0,
        last_interaction_at: null,
        notes: [],
        unlocked_at: new Date().toISOString(),
      };

      const dialogue = getDialogueForNPC(
        npc.slug,
        relationship.trust_level,
        relationship.interaction_count,
        relationship.relationship_status,
      );

      const activeDialogue: ActiveNPCDialogue = {
        npc,
        relationship,
        dialogue,
        phase: 'intro',
        selectedChoice: null,
      };

      return { ...prev, activeNPCDialogue: activeDialogue };
    });
  }, []);

  const resolveNPCDialogue = useCallback((choice: NPCDialogueChoice) => {
    setGameState(prev => {
      if (!prev.player || !prev.activeNPCDialogue) return prev;

      const { npc, relationship } = prev.activeNPCDialogue;
      const player = prev.player;

      // Update relationship
      const newTrust = Math.max(0, Math.min(100, relationship.trust_level + choice.trust_delta));
      const newStatus = trustToStatus(newTrust);
      const newNotes = choice.note
        ? [...relationship.notes.slice(-9), choice.note]
        : relationship.notes;

      const updatedRel: PlayerNPCRelationship = {
        ...relationship,
        trust_level: newTrust,
        relationship_status: newStatus,
        interaction_count: relationship.interaction_count + 1,
        last_interaction_at: new Date().toISOString(),
        notes: newNotes,
      };

      // Persist to Supabase
      upsertNPCRelationship({
        player_id: player.id,
        npc_id: npc.id,
        trust_level: newTrust,
        relationship_status: newStatus,
        interaction_count: updatedRel.interaction_count,
        last_interaction_at: updatedRel.last_interaction_at,
        notes: newNotes,
      });

      logNPCInteraction({
        player_id: player.id,
        npc_id: npc.id,
        dialogue_id: prev.activeNPCDialogue.dialogue.id,
        choice_id: choice.id,
        outcome_text: choice.outcome_text,
        trust_delta: choice.trust_delta,
        rep_delta: choice.rep_delta,
        money_delta: choice.money_delta,
      });

      // Apply money gain
      let next = { ...prev };
      if (choice.money_delta > 0) {
        const newMoney = (player.money ?? 0) + choice.money_delta;
        next = { ...next, player: { ...player, money: newMoney } };
        updatePlayer(player.id, { money: newMoney });
      }

      // Apply rep delta to the NPC's rep_track
      if (choice.rep_delta && prev.reputation) {
        const trackKey = `${npc.rep_track}_rep` as keyof typeof prev.reputation;
        const cur = (prev.reputation[trackKey] as number) ?? 0;
        const updated = { [trackKey]: cur + choice.rep_delta };
        updateReputation(player.id, updated as Parameters<typeof updateReputation>[1]).then(r => {
          setGameState(s => ({ ...s, reputation: r }));
        });
      }

      // Update npcRelationships map
      const newRelMap = new Map(next.npcRelationships);
      newRelMap.set(npc.id, updatedRel);

      next = { ...next, npcRelationships: newRelMap };

      // Apply XP
      const xpGain = 50 + Math.abs(choice.trust_delta) * 3;
      return applyXPGain(next, xpGain);
    });
  }, []);

  const closeNPCDialogue = useCallback(() => {
    setGameState(prev => ({ ...prev, activeNPCDialogue: null }));
  }, []);

  const refreshMarket = useCallback(async () => {
    const [marketDataArr, eventsArr] = await Promise.all([
      getDistrictMarketData(),
      getDistrictEvents(),
    ]);
    setGameState(prev => ({
      ...prev,
      districtMarket: new Map(marketDataArr.map(m => [m.district_id, m])),
      districtEvents: buildEventsMap(eventsArr),
    }));
  }, []);

  // ─── AI Suggestions ───────────────────────────────────────────────────────

  const acceptSuggestion = useCallback(async (suggestion: AISuggestion): Promise<void> => {
    const player = gameStateRef.current.player;
    if (!player) return;

    // acceptMission handles both DB writes concurrently and throws on failure
    const quest = await acceptMission(suggestion, player.id);

    setGameState(prev => ({
      ...prev,
      aiSuggestions: prev.aiSuggestions.map(s =>
        s.id === suggestion.id ? { ...s, status: 'accepted' as const } : s
      ),
      dynamicQuests: [...prev.dynamicQuests, quest as unknown as DynamicQuest],
    }));
  }, []);

  const dismissSuggestion = useCallback((suggestionId: string) => {
    dismissAISuggestion(suggestionId);
    setGameState(prev => ({
      ...prev,
      aiSuggestions: prev.aiSuggestions.filter(s => s.id !== suggestionId),
    }));
  }, []);

  const snoozeSuggestionCallback = useCallback((suggestionId: string, hours: number) => {
    const wakeAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    snoozeSuggestion(suggestionId, wakeAt);
    setGameState(prev => ({
      ...prev,
      aiSuggestions: prev.aiSuggestions.map(s =>
        s.id === suggestionId
          ? { ...s, status: 'snoozed' as const, snoozed_until: wakeAt.toISOString() }
          : s
      ),
    }));
  }, []);

  const refreshSuggestions = useCallback(async () => {
    const { player, playerDistricts, districts, dynamicQuests, aiSuggestions } = gameStateRef.current;
    if (!player) return;
    const suggestions = await generateSuggestions({
      player,
      playerDistricts,
      districts,
      dynamicQuests,
      existingSuggestions: aiSuggestions,
    });
    setGameState(s => ({ ...s, aiSuggestions: suggestions }));
  }, []);

  return {
    gameState,
    gainXP,
    dismissLevelUp,
    dismissQuestCompletion,
    dismissDealCompletion,
    dismissCinematicDeal,
    performAction,
    restoreEnergy,
    openNPCDialogue,
    resolveNPCDialogue,
    closeNPCDialogue,
    dismissRivalEvent,
    spendSkillPoint,
    completeDynQuest,
    completeDeal,
    applyTradingPenalty,
    enterNewDistrict,
    investInDistrict,
    purchaseUpgrade,
    unlockNewAchievement,
    refreshQuests,
    refreshMarket,
    acceptSuggestion,
    dismissSuggestion,
    snoozeSuggestion: snoozeSuggestionCallback,
    refreshSuggestions,
  };
};
