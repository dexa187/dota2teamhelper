import { ITEMS_CATALOG, THREAT_LABELS, getItemEntry } from '../data/itemsCatalog';
import type {
  GameMode,
  HeroItemBuildRecommendation,
  HeroRecord,
  ItemCatalogEntry,
  LaneMatchupPlan,
  LaneName,
  LaneRoleLabel,
  Position,
  RecommendedItem,
  TeamAuraDuty,
  TeamThreatSummary,
  ThreatSource,
  ThreatTag,
} from '../types';

export function analyzeEnemyThreats(enemies: HeroRecord[]): TeamThreatSummary[] {
  const map = new Map<ThreatTag, { totalWeight: number; sources: ThreatSource[] }>();

  for (const enemy of enemies) {
    for (const threat of enemy.threats) {
      const entry = map.get(threat.tag) ?? { totalWeight: 0, sources: [] };
      entry.totalWeight += threat.weight;
      entry.sources.push({
        heroId: enemy.id,
        heroName: enemy.localizedName,
        img: enemy.img,
        weight: threat.weight,
        note: threat.note,
      });
      map.set(threat.tag, entry);
    }
  }

  return Array.from(map.entries())
    .map(([tag, data]) => ({
      tag,
      label: THREAT_LABELS[tag],
      totalWeight: data.totalWeight,
      severity: (data.totalWeight >= 5 ? 'high' : data.totalWeight >= 3 ? 'medium' : 'low') as
        | 'high'
        | 'medium'
        | 'low',
      sources: data.sources.sort((a, b) => b.weight - a.weight),
    }))
    .sort((a, b) => b.totalWeight - a.totalWeight);
}

function isItemValidForHero(item: ItemCatalogEntry, hero: HeroRecord, pos: Position): boolean {
  if (!item.validPositions.includes(pos)) return false;
  if (item.attackTypeFilter && hero.attackType !== item.attackTypeFilter) return false;
  if (item.validArchetypes && !item.validArchetypes.includes(hero.archetype)) {
    // Allow Pos 3/4/5 utility counters even if archetype differs, unless item is carry/right-click specific
    if (item.stage === 'counter' && (pos === 1 || pos === 2)) {
      return false;
    }
  }
  return true;
}

function scoreItemAgainstThreats(
  item: ItemCatalogEntry,
  threatMap: Map<ThreatTag, TeamThreatSummary>,
  mode: GameMode
): {
  score: number;
  matchedSources: Array<{ heroId: number; heroName: string; img: string; note: string }>;
  reasons: string[];
} {
  if (!item.counters || item.counters.length === 0) {
    return { score: 0, matchedSources: [], reasons: [] };
  }

  let score = 0;
  const heroMap = new Map<number, { heroId: number; heroName: string; img: string; notes: string[] }>();
  const reasons: string[] = [];

  for (const rule of item.counters) {
    const summary = threatMap.get(rule.tag);
    if (!summary) continue;

    score += summary.totalWeight * rule.score;
    reasons.push(rule.reason);

    for (const src of summary.sources) {
      const existing = heroMap.get(src.heroId) ?? {
        heroId: src.heroId,
        heroName: src.heroName,
        img: src.img,
        notes: [],
      };
      if (!existing.notes.includes(src.note)) {
        existing.notes.push(src.note);
      }
      heroMap.set(src.heroId, existing);
    }
  }

  if (score > 0 && mode === 'turbo') {
    score += item.turboBonus ?? 0;
    score -= item.turboPenalty ?? 0;
  }

  const matchedSources = Array.from(heroMap.values()).map((h) => ({
    heroId: h.heroId,
    heroName: h.heroName,
    img: h.img,
    note: h.notes.join('; '),
  }));

  return { score, matchedSources, reasons };
}

function toRecommendedItem(
  key: string,
  stageOverride: ItemCatalogEntry['stage'] | undefined,
  mode: GameMode,
  reason: string,
  score = 0,
  countersHeroes: RecommendedItem['countersHeroes'] = [],
  isTeamDuty = false
): RecommendedItem {
  const entry = getItemEntry(key);
  return {
    key: entry.key,
    name: entry.name,
    cost: entry.cost,
    img: entry.img,
    stage: stageOverride ?? entry.stage,
    score,
    isTeamDuty,
    countersHeroes,
    reason,
    turboNote: mode === 'turbo' ? entry.turboNote : undefined,
  };
}

export function recommendTeamItems(params: {
  lanePlan: LaneMatchupPlan;
  allies: HeroRecord[];
  enemies: HeroRecord[];
  mode: GameMode;
  myHeroId?: number | null;
}): {
  threats: TeamThreatSummary[];
  teamDuties: TeamAuraDuty[];
  builds: HeroItemBuildRecommendation[];
} {
  const { lanePlan, allies, enemies, mode, myHeroId = null } = params;
  const threats = analyzeEnemyThreats(enemies);
  const threatMap = new Map(threats.map((t) => [t.tag, t]));

  // Map each ally to lane/pos from lanePlan
  const allyMeta = new Map<
    number,
    { hero: HeroRecord; position: Position; lane: LaneName; laneLabel: LaneRoleLabel }
  >();
  for (const laneName of ['top', 'mid', 'bot'] as const) {
    const lane = lanePlan.lanes[laneName];
    for (const slot of lane.allies) {
      allyMeta.set(slot.hero.id, {
        hero: slot.hero,
        position: slot.position,
        lane: lane.lane,
        laneLabel: lane.label,
      });
    }
  }
  // Fallback if an ally was not placed (should not happen for <= 5)
  for (const ally of allies) {
    if (!allyMeta.has(ally.id)) {
      allyMeta.set(ally.id, {
        hero: ally,
        position: 3,
        lane: 'top',
        laneLabel: 'Offlane',
      });
    }
  }

  // Team Utility Allocator for teamUnique items
  const teamDutyThresholds: Array<{ key: string; minScore: number }> = [
    { key: 'spirit_vessel', minScore: 45 },
    { key: 'pipe', minScore: 55 },
    { key: 'crimson_guard', minScore: 45 },
    { key: 'shivas_guard', minScore: 45 },
    { key: 'guardian_greaves', minScore: 35 },
    { key: 'assault', minScore: 40 },
    { key: 'gem', minScore: 32 },
  ];

  const teamDuties: TeamAuraDuty[] = [];
  const dutyByHeroId = new Map<number, Array<{ duty: TeamAuraDuty; itemScore: number; matched: RecommendedItem['countersHeroes'] }>>();
  const claimedUniqueItems = new Set<string>();
  const dutyCounts = new Map<number, number>();

  for (const candidate of teamDutyThresholds) {
    const entry = ITEMS_CATALOG[candidate.key];
    if (!entry || !entry.teamUnique) continue;

    const threatEval = scoreItemAgainstThreats(entry, threatMap, mode);
    if (threatEval.score < candidate.minScore) continue;

    const priorityOrder = entry.teamCarrierPriority ?? entry.validPositions;
    let bestCarrier: { hero: HeroRecord; position: Position } | null = null;
    let bestCarrierScore = -Infinity;

    for (const meta of allyMeta.values()) {
      if (!isItemValidForHero(entry, meta.hero, meta.position)) continue;
      const prioIdx = priorityOrder.indexOf(meta.position);
      const prioScore = prioIdx === -1 ? 0 : (priorityOrder.length - prioIdx) * 20;
      const alreadyHasItemBonus = meta.hero.coreItems.core.includes(entry.key) ? 25 : 0;
      const overloadPenalty = (dutyCounts.get(meta.hero.id) ?? 0) * 18;
      const total = prioScore + alreadyHasItemBonus - overloadPenalty;

      if (total > bestCarrierScore) {
        bestCarrierScore = total;
        bestCarrier = { hero: meta.hero, position: meta.position };
      }
    }

    if (bestCarrier) {
      claimedUniqueItems.add(entry.key);
      dutyCounts.set(bestCarrier.hero.id, (dutyCounts.get(bestCarrier.hero.id) ?? 0) + 1);
      const targetNames = threatEval.matchedSources.slice(0, 3).map((s) => s.heroName).join(', ');
      const reason = `${threatEval.reasons[0] ?? 'High-value team counter'} (vs ${targetNames})`;
      const duty: TeamAuraDuty = {
        itemKey: entry.key,
        itemName: entry.name,
        itemImg: entry.img,
        carrierHeroId: bestCarrier.hero.id,
        carrierName: bestCarrier.hero.localizedName,
        carrierPosition: bestCarrier.position,
        reason,
      };
      teamDuties.push(duty);

      const list = dutyByHeroId.get(bestCarrier.hero.id) ?? [];
      list.push({ duty, itemScore: threatEval.score + 50, matched: threatEval.matchedSources });
      dutyByHeroId.set(bestCarrier.hero.id, list);
    }
  }

  // Build per-hero recommendations
  const builds: HeroItemBuildRecommendation[] = [];

  for (const meta of allyMeta.values()) {
    const { hero, position, lane, laneLabel } = meta;
    const laneEnemyHeroes = lanePlan.lanes[lane].enemies.map((e) => e.hero);
    const hasLaneSpellSpam = laneEnemyHeroes.some((e) =>
      e.threats.some((t) => t.tag === 'spell_spam_lane')
    );
    const hasEnemyInvis = (threatMap.get('invisibility')?.totalWeight ?? 0) >= 2;
    const hasEnemyMagic = (threatMap.get('heavy_magic_burst')?.totalWeight ?? 0) >= 3;
    const hasNaturesProphet = enemies.some((e) => e.name === 'npc_dota_hero_furion');

    // Starting items
    const startingKeys = new Set(hero.coreItems.starting);
    if (hasLaneSpellSpam) startingKeys.add('magic_stick');
    if (hasEnemyInvis && (position === 4 || position === 5)) startingKeys.add('ward_sentry');
    if (hasNaturesProphet && position <= 3) startingKeys.add('quelling_blade');
    if (mode === 'turbo') {
      startingKeys.delete('tango');
      startingKeys.delete('clarity');
    }

    const starting: RecommendedItem[] = Array.from(startingKeys).map((k) => {
      if (k === 'magic_stick' && hasLaneSpellSpam) {
        return toRecommendedItem(k, 'starting', mode, 'Lane spell spam sustain');
      }
      if (k === 'ward_sentry' && hasEnemyInvis) {
        return toRecommendedItem(k, 'starting', mode, 'Lane reveal vs enemy invisibility');
      }
      if (k === 'quelling_blade' && hasNaturesProphet) {
        return toRecommendedItem(k, 'starting', mode, "Cuts Nature's Prophet Sprout trees");
      }
      return toRecommendedItem(k, 'starting', mode, 'Standard laning opener');
    });

    // Early items
    const earlyKeys = new Set(hero.coreItems.early);
    if (hasEnemyMagic && position <= 4) earlyKeys.add('infused_raindrop');
    if (hasEnemyInvis && position >= 2) earlyKeys.add('dust');
    if (hasLaneSpellSpam) earlyKeys.add('magic_wand');

    const turboNotes: string[] = [];
    const early: RecommendedItem[] = [];
    for (const rawKey of earlyKeys) {
      let key = rawKey;
      if (mode === 'turbo' && hero.coreItems.turboReplace?.[rawKey]) {
        key = hero.coreItems.turboReplace[rawKey];
        turboNotes.push(
          `Turbo swap: replaced ${getItemEntry(rawKey).name} with ${getItemEntry(key).name} for faster tempo.`
        );
      }
      if (mode === 'turbo' && key === 'hand_of_midas') {
        turboNotes.push('Avoid Hand of Midas in Turbo — accelerated XP/gold favors early fighting items.');
      }
      const entry = getItemEntry(key);
      const evalRes = scoreItemAgainstThreats(entry, threatMap, mode);
      early.push(
        toRecommendedItem(
          key,
          'early',
          mode,
          evalRes.reasons[0] ?? 'Early laning & boots spike',
          evalRes.score,
          evalRes.matchedSources
        )
      );
    }

    // Counter Items
    const counterItems: RecommendedItem[] = [];
    const seenKeys = new Set<string>([...startingKeys, ...earlyKeys]);

    // Assigned team duties first
    for (const assigned of dutyByHeroId.get(hero.id) ?? []) {
      if (seenKeys.has(assigned.duty.itemKey)) continue;
      seenKeys.add(assigned.duty.itemKey);
      counterItems.push(
        toRecommendedItem(
          assigned.duty.itemKey,
          'counter',
          mode,
          assigned.duty.reason,
          assigned.itemScore,
          assigned.matched,
          true
        )
      );
    }

    // Evaluate all catalog counter items
    const candidateCounters: Array<{ item: ItemCatalogEntry; score: number; matched: RecommendedItem['countersHeroes']; reason: string }> = [];
    for (const item of Object.values(ITEMS_CATALOG)) {
      if (item.stage === 'starting' || item.stage === 'early') continue;
      if (seenKeys.has(item.key)) continue;
      if (item.teamUnique && claimedUniqueItems.has(item.key)) continue;
      if (!isItemValidForHero(item, hero, position)) continue;

      const evalRes = scoreItemAgainstThreats(item, threatMap, mode);
      if (evalRes.score < 22) continue;

      // Boost if naturally synergistic with hero's core kit
      const coreSynergy = hero.coreItems.core.includes(item.key) || hero.coreItems.late.includes(item.key) ? 18 : 0;
      const targetNames = evalRes.matchedSources
        .slice(0, 3)
        .map((s) => s.heroName)
        .join(', ');
      const reason = `${evalRes.reasons[0]}${targetNames ? ` — vs ${targetNames}` : ''}`;

      candidateCounters.push({
        item,
        score: evalRes.score + coreSynergy,
        matched: evalRes.matchedSources,
        reason,
      });
    }

    candidateCounters.sort((a, b) => b.score - a.score);
    for (const cand of candidateCounters.slice(0, 5)) {
      if (seenKeys.has(cand.item.key)) continue;
      seenKeys.add(cand.item.key);
      counterItems.push(
        toRecommendedItem(
          cand.item.key,
          'counter',
          mode,
          cand.reason,
          cand.score,
          cand.matched,
          false
        )
      );
    }

    // Core progression (with Turbo replacements, excluding items already promoted to counter list)
    const core: RecommendedItem[] = [];
    for (const rawKey of hero.coreItems.core) {
      let key = rawKey;
      if (mode === 'turbo' && hero.coreItems.turboReplace?.[rawKey]) {
        key = hero.coreItems.turboReplace[rawKey];
        turboNotes.push(
          `Turbo swap: ${getItemEntry(rawKey).name} -> ${getItemEntry(key).name} for faster impact.`
        );
      }
      if (mode === 'turbo' && key === 'hand_of_midas') {
        turboNotes.push('Midas is heavily penalized in Turbo — skip for earlier fight/farm power.');
        continue;
      }
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      core.push(toRecommendedItem(key, 'core', mode, 'Core hero timing item'));
    }

    if (mode === 'turbo' && hero.coreItems.shardPriority === 'high') {
      if (!seenKeys.has('aghanims_shard')) {
        seenKeys.add('aghanims_shard');
        core.push(
          toRecommendedItem(
            'aghanims_shard',
            'core',
            mode,
            'Buy immediately at 7:30 Turbo Shard unlock'
          )
        );
      }
      turboNotes.push("High-priority Aghanim's Shard unlocks at 7:30 in Turbo.");
    }

    // Late / Luxury items
    const late: RecommendedItem[] = [];
    for (const rawKey of hero.coreItems.late) {
      if (seenKeys.has(rawKey)) continue;
      seenKeys.add(rawKey);
      late.push(toRecommendedItem(rawKey, 'late', mode, 'Late-game scaling & luxury'));
    }
    if (mode === 'turbo' && position <= 2 && !seenKeys.has('ultimate_scepter_2')) {
      late.push(
        toRecommendedItem(
          'ultimate_scepter_2',
          'late',
          mode,
          'Consume Aghanim’s Blessing to free a 6th core slot'
        )
      );
    }

    builds.push({
      hero,
      position,
      lane,
      laneLabel,
      isMyHero: myHeroId !== null && hero.id === myHeroId,
      starting,
      early,
      core,
      counters: counterItems,
      late,
      turboNotes: [...new Set(turboNotes)],
    });
  }

  builds.sort((a, b) => {
    if (a.isMyHero !== b.isMyHero) return a.isMyHero ? -1 : 1;
    return a.position - b.position;
  });

  return { threats, teamDuties, builds };
}
