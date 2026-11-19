import type {
  Faction,
  GameMode,
  HeroRecord,
  LaneAssignment,
  LaneMatchupPlan,
  LaneName,
  LaneRoleLabel,
  LaneSlotHero,
  Position,
} from '../types';

const ALL_POSITIONS: Position[] = [1, 2, 3, 4, 5];

function generateArrangements<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const results: T[][] = [];
  const used = new Array<boolean>(items.length).fill(false);
  const current: T[] = [];

  function backtrack() {
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      current.push(items[i]);
      backtrack();
      current.pop();
      used[i] = false;
    }
  }

  backtrack();
  return results;
}

function getHeroThreatWeight(hero: HeroRecord, tag: string): number {
  return hero.threats.find((t) => t.tag === tag)?.weight ?? 0;
}

function scoreDuoSynergy(a: HeroRecord | undefined, b: HeroRecord | undefined): {
  score: number;
  tags: string[];
} {
  if (!a || !b) return { score: 0, tags: [] };
  let score = 0;
  const tags: string[] = [];

  if (a.attackType !== b.attackType) {
    score += 12;
    tags.push('Melee + Ranged balance');
  } else if (a.attackType === 'Melee' && b.attackType === 'Melee') {
    score -= 10;
  } else {
    score -= 2;
  }

  const hasStun = Boolean(a.laneTraits.hasStun || b.laneTraits.hasStun);
  const hasKill = Boolean(a.laneTraits.hasKillThreat || b.laneTraits.hasKillThreat);
  if (hasStun && hasKill) {
    score += 10;
    tags.push('Stun + Kill setup');
  }

  if (a.laneTraits.laneStrength === 1 && b.laneTraits.hasSave) {
    score += 12;
    tags.push('Defensive save protects fragile core');
  }

  if (b.laneTraits.hasHarass) {
    score += 6;
    tags.push('Strong lane zoning & harass');
  }

  if (a.laneTraits.wantsRangedPartner && b.attackType === 'Ranged') {
    score += 4;
  }
  if (a.laneTraits.wantsMeleePartner && b.attackType === 'Melee') {
    score += 4;
  }

  return { score, tags };
}

function scoreLaneMatchup(
  allyHeroes: HeroRecord[],
  enemyHeroes: HeroRecord[],
  liveMatchups?: Record<number, Record<number, number>>
): { score: number; warnings: string[] } {
  if (allyHeroes.length === 0 || enemyHeroes.length === 0) {
    return { score: 0, warnings: [] };
  }

  const allyAvgStrength =
    allyHeroes.reduce((sum, h) => sum + h.laneTraits.laneStrength, 0) / allyHeroes.length;
  const enemyAvgStrength =
    enemyHeroes.reduce((sum, h) => sum + h.laneTraits.laneStrength, 0) / enemyHeroes.length;

  let score = (allyAvgStrength - enemyAvgStrength) * 8;
  const warnings: string[] = [];

  for (const enemy of enemyHeroes) {
    if (getHeroThreatWeight(enemy, 'spell_spam_lane') >= 2) {
      warnings.push(`High spell spam from ${enemy.localizedName} — prioritize early Magic Stick/Wand`);
      if (!allyHeroes.some((a) => a.laneTraits.hasSave)) {
        score -= 4;
      }
    }
    if (getHeroThreatWeight(enemy, 'invisibility') >= 2) {
      warnings.push(`${enemy.localizedName} invisibility threat — carry early Sentry Ward / Dust`);
    }
    if (getHeroThreatWeight(enemy, 'illusions_summons') >= 2) {
      if (allyHeroes.some((a) => a.laneTraits.hasIllusionClear)) {
        score += 8;
      } else {
        score -= 4;
        warnings.push(`${enemy.localizedName} summon/illusion pressure`);
      }
    }
    if (getHeroThreatWeight(enemy, 'silence_root_debuff') >= 2) {
      if (allyHeroes.some((a) => a.laneTraits.hasDispel)) {
        score += 7;
      }
    }
    if (enemy.attackType === 'Melee' && enemy.laneTraits.laneStrength <= 2) {
      if (allyHeroes.some((a) => a.attackType === 'Ranged' && a.laneTraits.hasHarass)) {
        score += 6;
      }
    }
  }

  if (liveMatchups) {
    for (const ally of allyHeroes) {
      for (const enemy of enemyHeroes) {
        const adv = liveMatchups[ally.id]?.[enemy.id];
        if (typeof adv === 'number' && Number.isFinite(adv)) {
          score += adv * 1.5;
        }
      }
    }
  }

  return { score: Math.round(score), warnings: [...new Set(warnings)].slice(0, 3) };
}

function getHeroRoleFit(hero: HeroRecord, pos: Position, mode: GameMode): number {
  let base = hero.posScores[pos - 1] * 10;
  if (mode === 'turbo') {
    if (
      (pos === 3 || pos === 4) &&
      (hero.archetype === 'tempo_mid' ||
        hero.archetype === 'initiator_offlaner' ||
        hero.archetype === 'roaming_support')
    ) {
      base += 3;
    }
    if (pos === 4 && hero.laneTraits.isGreedy) {
      base += 4;
    }
  }
  return base;
}

function solveEnemyPositions(enemies: HeroRecord[]): Partial<Record<Position, HeroRecord>> {
  if (enemies.length === 0) return {};
  const arrangements = generateArrangements(ALL_POSITIONS, enemies.length);
  let bestScore = -Infinity;
  let bestMap: Partial<Record<Position, HeroRecord>> = {};

  for (const posList of arrangements) {
    const posMap: Partial<Record<Position, HeroRecord>> = {};
    let score = 0;
    for (let i = 0; i < enemies.length; i++) {
      const pos = posList[i];
      const hero = enemies[i];
      posMap[pos] = hero;
      score += hero.posScores[pos - 1] * 10;
    }
    score += scoreDuoSynergy(posMap[1], posMap[5]).score * 0.5;
    score += scoreDuoSynergy(posMap[3], posMap[4]).score * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestMap = posMap;
    }
  }
  return bestMap;
}

function buildGameplanTips(
  label: LaneRoleLabel,
  allies: LaneSlotHero[],
  enemies: Array<{ hero: HeroRecord; position: Position }>,
  mode: GameMode,
  synergyTags: string[]
): string[] {
  const tips: string[] = [];
  if (label === 'Safe Lane') {
    if (mode === 'regular') {
      tips.push('Support: Half-pull Small Camp at :15 / :45 to keep equilibrium near tower (skip 5:00 catapult wave).');
    } else {
      tips.push('Turbo tempo: Fight aggressively at level 2–3 and contest the 1:30 Lotus Pool with your carry.');
    }
  } else if (label === 'Mid Lane') {
    if (mode === 'regular') {
      tips.push('Shove wave before 2:00 & 4:00 for Water Runes, then contest 6:00 Power Rune with support rotation.');
    } else {
      tips.push('Control 2:00/4:00 Water Runes & 6:00 Power Runes; look for side-lane ganks once boots/ult come online.');
    }
  } else {
    tips.push(
      mode === 'regular'
        ? 'Block enemy Small Camp or drag wave if needed; secure 3:00 Lotus and 7:00 Shrine of Wisdom.'
        : 'Pressure enemy carry nonstop; contest 1:30 Lotus Pool and 3:30 Shrine of Wisdom in offlane jungle.'
    );
  }

  if (synergyTags.length > 0) {
    tips.push(`Play to lane strength: ${synergyTags.join(' & ')}.`);
  }

  const carry = allies.find((a) => a.position === 1 || a.position === 2 || a.position === 3);
  if (carry && carry.hero.laneTraits.laneStrength === 1) {
    tips.push(`${carry.hero.localizedName} has a weak early lane — avoid extended trades and prioritize safe XP.`);
  } else if (enemies.some((e) => e.hero.laneTraits.isGreedy)) {
    const greedy = enemies.find((e) => e.hero.laneTraits.isGreedy)!;
    tips.push(`Punish ${greedy.hero.localizedName}'s greedy early levels with wave pressure and kills.`);
  }

  return tips.slice(0, 3);
}

export function recommendLanes(params: {
  allies: HeroRecord[];
  enemies: HeroRecord[];
  faction: Faction;
  mode: GameMode;
  lockedPositions?: Partial<Record<Position, number>>;
  liveMatchups?: Record<number, Record<number, number>>;
}): LaneMatchupPlan {
  const { allies, enemies, faction, mode, lockedPositions = {}, liveMatchups } = params;

  const enemyPositions = solveEnemyPositions(enemies);

  // Resolve valid locked positions
  const allyById = new Map(allies.map((h) => [h.id, h]));
  const usedHeroIds = new Set<number>();
  const lockedPosSet = new Set<Position>();
  const fixedMap: Partial<Record<Position, HeroRecord>> = {};

  for (const pos of ALL_POSITIONS) {
    const lockedId = lockedPositions[pos];
    if (lockedId && allyById.has(lockedId) && !usedHeroIds.has(lockedId)) {
      fixedMap[pos] = allyById.get(lockedId)!;
      usedHeroIds.add(lockedId);
      lockedPosSet.add(pos);
    }
  }

  const remainingAllies = allies.filter((h) => !usedHeroIds.has(h.id));
  const remainingPositions = ALL_POSITIONS.filter((p) => !lockedPosSet.has(p));

  const arrangements = generateArrangements(remainingPositions, remainingAllies.length);

  let bestTotalScore = -Infinity;
  let bestMap: Partial<Record<Position, HeroRecord>> = { ...fixedMap };
  let bestCrossScore = 0;

  let baselineRoleOnlyScore = -Infinity;
  let baselineRoleOnlyMap: Partial<Record<Position, HeroRecord>> = { ...fixedMap };
  let baselineCrossScore = 0;

  const enemySafe = [enemyPositions[1], enemyPositions[5]].filter(Boolean) as HeroRecord[];
  const enemyMid = [enemyPositions[2]].filter(Boolean) as HeroRecord[];
  const enemyOff = [enemyPositions[3], enemyPositions[4]].filter(Boolean) as HeroRecord[];

  for (const posList of arrangements) {
    const posMap: Partial<Record<Position, HeroRecord>> = { ...fixedMap };
    let roleScore = 0;
    for (let i = 0; i < remainingAllies.length; i++) {
      posMap[posList[i]] = remainingAllies[i];
    }

    for (const pos of ALL_POSITIONS) {
      const hero = posMap[pos];
      if (hero) roleScore += getHeroRoleFit(hero, pos, mode);
    }

    const safeSynergy = scoreDuoSynergy(posMap[1], posMap[5]).score;
    const offSynergy = scoreDuoSynergy(posMap[3], posMap[4]).score;

    const allySafe = [posMap[1], posMap[5]].filter(Boolean) as HeroRecord[];
    const allyMid = [posMap[2]].filter(Boolean) as HeroRecord[];
    const allyOff = [posMap[3], posMap[4]].filter(Boolean) as HeroRecord[];

    const safeMatchup = scoreLaneMatchup(allySafe, enemyOff, liveMatchups).score;
    const midMatchup = scoreLaneMatchup(allyMid, enemyMid, liveMatchups).score;
    const offMatchup = scoreLaneMatchup(allyOff, enemySafe, liveMatchups).score;
    const crossScore = safeMatchup + midMatchup + offMatchup;

    const totalScore = roleScore + safeSynergy + offSynergy + crossScore;

    if (totalScore > bestTotalScore) {
      bestTotalScore = totalScore;
      bestMap = posMap;
      bestCrossScore = crossScore;
    }

    if (roleScore > baselineRoleOnlyScore) {
      baselineRoleOnlyScore = roleScore;
      baselineRoleOnlyMap = posMap;
      baselineCrossScore = crossScore;
    }
  }

  let swapRecommendation: { message: string; gain: number } | null = null;
  if (enemies.length > 0 && allies.length >= 2) {
    const moved: Array<{ hero: HeroRecord; from: Position; to: Position }> = [];
    for (const pos of ALL_POSITIONS) {
      const optHero = bestMap[pos];
      if (optHero && baselineRoleOnlyMap[pos]?.id !== optHero.id) {
        const oldPos = ALL_POSITIONS.find((p) => baselineRoleOnlyMap[p]?.id === optHero.id);
        if (oldPos) {
          moved.push({ hero: optHero, from: oldPos, to: pos });
        }
      }
    }
    const gain = Math.round(bestCrossScore - baselineCrossScore);
    if (moved.length >= 2 && gain >= 8) {
      const summary = moved
        .slice(0, 2)
        .map((m) => `${m.hero.localizedName} (Pos ${m.from} -> Pos ${m.to})`)
        .join(' & ');
      swapRecommendation = {
        message: `Matchup flex swap recommended: ${summary} improves lane matchups by +${gain}.`,
        gain,
      };
    }
  }

  const safePositions: Position[] = [1, 5];
  const midPositions: Position[] = [2];
  const offPositions: Position[] = [3, 4];

  const topIsSafe = faction === 'dire';
  const laneSpecs: Array<{
    lane: LaneName;
    label: LaneRoleLabel;
    allyPos: Position[];
    enemyPos: Position[];
  }> = [
    {
      lane: 'top',
      label: topIsSafe ? 'Safe Lane' : 'Offlane',
      allyPos: topIsSafe ? safePositions : offPositions,
      enemyPos: topIsSafe ? offPositions : safePositions,
    },
    {
      lane: 'mid',
      label: 'Mid Lane',
      allyPos: midPositions,
      enemyPos: midPositions,
    },
    {
      lane: 'bot',
      label: topIsSafe ? 'Offlane' : 'Safe Lane',
      allyPos: topIsSafe ? offPositions : safePositions,
      enemyPos: topIsSafe ? safePositions : offPositions,
    },
  ];

  const lanes = {} as Record<LaneName, LaneAssignment>;

  for (const spec of laneSpecs) {
    const laneAllies: LaneSlotHero[] = spec.allyPos
      .map((pos) => {
        const hero = bestMap[pos];
        if (!hero) return null;
        return {
          hero,
          position: pos,
          locked: lockedPosSet.has(pos),
          suitabilityScore: hero.posScores[pos - 1],
        };
      })
      .filter((x): x is LaneSlotHero => x !== null);

    const laneEnemies = spec.enemyPos
      .map((pos) => {
        const hero = enemyPositions[pos];
        return hero ? { hero, position: pos } : null;
      })
      .filter((x): x is { hero: HeroRecord; position: Position } => x !== null);

    const duo =
      laneAllies.length === 2
        ? scoreDuoSynergy(laneAllies[0].hero, laneAllies[1].hero)
        : { score: 0, tags: [] };

    const matchup = scoreLaneMatchup(
      laneAllies.map((a) => a.hero),
      laneEnemies.map((e) => e.hero),
      liveMatchups
    );

    const laneScore = Math.round(matchup.score + duo.score * 0.4);
    const matchupRating: 'favorable' | 'even' | 'tough' =
      laneScore >= 8 ? 'favorable' : laneScore <= -8 ? 'tough' : 'even';

    lanes[spec.lane] = {
      lane: spec.lane,
      label: spec.label,
      allies: laneAllies,
      enemies: laneEnemies,
      matchupRating,
      score: laneScore,
      synergyTags: duo.tags,
      threatWarnings: matchup.warnings,
      gameplan: buildGameplanTips(spec.label, laneAllies, laneEnemies, mode, duo.tags),
    };
  }

  return {
    lanes,
    overallScore: Number.isFinite(bestTotalScore) ? Math.round(bestTotalScore) : 0,
    swapRecommendation,
    allyPositions: bestMap,
    enemyPositions,
  };
}
