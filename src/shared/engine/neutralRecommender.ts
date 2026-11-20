import {
  NEUTRAL_ARTIFACTS,
  NEUTRAL_ENCHANTMENTS,
  NEUTRAL_TIER_TIMINGS,
} from '../data/neutralCatalog';
import type {
  GameMode,
  HeroRecord,
  NeutralArtifactCatalogEntry,
  NeutralCounterRule,
  NeutralEnchantmentCatalogEntry,
  NeutralPoolIndex,
  NeutralTier,
  Position,
  RecommendedNeutralArtifact,
  RecommendedNeutralEnchantment,
  TeamThreatSummary,
  ThreatTag,
  TierNeutralRecommendation,
} from '../types';

const TIERS: NeutralTier[] = [1, 2, 3, 4];

export function getNeutralTierUnlockSeconds(tier: NeutralTier, mode: GameMode): number {
  return NEUTRAL_TIER_TIMINGS[mode][tier].seconds;
}

export function getNeutralTierUnlockLabel(tier: NeutralTier, mode: GameMode): string {
  return NEUTRAL_TIER_TIMINGS[mode][tier].label;
}

export function getCurrentNeutralTier(clockSeconds: number, mode: GameMode): NeutralTier {
  const timings = NEUTRAL_TIER_TIMINGS[mode];
  if (clockSeconds >= timings[4].seconds) return 4;
  if (clockSeconds >= timings[3].seconds) return 3;
  if (clockSeconds >= timings[2].seconds) return 2;
  return 1;
}

interface CounterEvalResult {
  threatScore: number;
  modeDelta: number;
  topReason: string | null;
  countersHeroes: Array<{ heroId: number; heroName: string; img: string; note: string }>;
}

function evaluateNeutralCounters(
  counters: NeutralCounterRule[] | undefined,
  threatMap: Map<ThreatTag, TeamThreatSummary>,
  mode: GameMode,
  turboBonus?: number,
  turboPenalty?: number
): CounterEvalResult {
  const modeDelta = mode === 'turbo' ? (turboBonus ?? 0) - (turboPenalty ?? 0) : 0;

  if (!counters || counters.length === 0) {
    return { threatScore: 0, modeDelta, topReason: null, countersHeroes: [] };
  }

  let threatScore = 0;
  let bestRuleContribution = -1;
  let topReason: string | null = null;
  const heroMap = new Map<number, { heroId: number; heroName: string; img: string; notes: string[] }>();

  for (const rule of counters) {
    const summary = threatMap.get(rule.tag);
    if (!summary) continue;

    const contribution = summary.totalWeight * rule.score;
    threatScore += contribution;
    if (contribution > bestRuleContribution) {
      bestRuleContribution = contribution;
      topReason = rule.reason;
    }

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

  const countersHeroes = Array.from(heroMap.values()).map((h) => ({
    heroId: h.heroId,
    heroName: h.heroName,
    img: h.img,
    note: h.notes.join('; '),
  }));

  return { threatScore, modeDelta, topReason, countersHeroes };
}

function buildNeutralReason(
  topCounterReason: string | null,
  countersHeroes: Array<{ heroName: string }>,
  defaultReason: string
): string {
  if (!topCounterReason) return defaultReason;
  const targetNames = countersHeroes
    .slice(0, 3)
    .map((h) => h.heroName)
    .join(', ');
  return targetNames ? `${topCounterReason} — vs ${targetNames}` : topCounterReason;
}

function scoreArtifact(
  entry: NeutralArtifactCatalogEntry,
  hero: HeroRecord,
  position: Position,
  threatMap: Map<ThreatTag, TeamThreatSummary>,
  mode: GameMode
): { score: number; reason: string; countersHeroes: RecommendedNeutralArtifact['countersHeroes'] } {
  const posIdx = entry.validPositions.indexOf(position);
  const posBonus = posIdx === 0 ? 8 : posIdx === 1 ? 4 : 0;
  const archetypeBonus = entry.preferredArchetypes.includes(hero.archetype) ? 16 : 0;
  const evalRes = evaluateNeutralCounters(
    entry.counters,
    threatMap,
    mode,
    entry.turboBonus,
    entry.turboPenalty
  );

  let nuance = 0;
  if (entry.key === 'defiant_shell' && hero.attackType === 'Melee') {
    nuance += 8;
  }
  if (entry.key === 'balmhook' && hero.laneTraits.hasSave) {
    nuance += 10;
  }
  if (
    entry.key === 'metamorphic_mandible' &&
    (threatMap.get('heavy_physical_burst')?.totalWeight ?? 0) >= 5
  ) {
    nuance -= 10;
  }
  if (
    entry.key === 'helm_of_the_hivemind' &&
    (hero.archetype === 'initiator_offlaner' || hero.archetype === 'aura_offlaner')
  ) {
    nuance -= 14;
  }
  if (
    entry.key === 'divine_regalia' &&
    (position >= 4 || (threatMap.get('single_target_ult')?.totalWeight ?? 0) >= 5)
  ) {
    nuance -= 8;
  }

  const score = entry.baseScore + archetypeBonus + posBonus + evalRes.threatScore + evalRes.modeDelta + nuance;
  const reason = buildNeutralReason(evalRes.topReason, evalRes.countersHeroes, entry.defaultReason);
  return { score, reason, countersHeroes: evalRes.countersHeroes };
}

function scoreEnchantment(
  entry: NeutralEnchantmentCatalogEntry,
  hero: HeroRecord,
  position: Position,
  threatMap: Map<ThreatTag, TeamThreatSummary>,
  mode: GameMode
): { score: number; reason: string; countersHeroes: RecommendedNeutralEnchantment['countersHeroes'] } {
  const posIdx = entry.validPositions.indexOf(position);
  const posBonus = posIdx === 0 ? 6 : 0;
  const archetypeBonus = entry.preferredArchetypes.includes(hero.archetype) ? 16 : 0;
  const evalRes = evaluateNeutralCounters(
    entry.counters,
    threatMap,
    mode,
    entry.turboBonus,
    entry.turboPenalty
  );

  let nuance = 0;
  if (entry.key === 'enhancement_crude') {
    if (hero.archetype === 'right_click_carry') nuance += 10;
    if (hero.archetype === 'spell_core' || position >= 4) nuance -= 12;
  }
  if (entry.key === 'enhancement_hulking') {
    if (hero.archetype === 'aura_offlaner' || hero.archetype === 'initiator_offlaner') nuance += 10;
    if (hero.archetype === 'right_click_carry') nuance -= 14;
  }
  if (entry.key === 'enhancement_audacious' && hero.attackType === 'Melee') {
    const highPhys = (threatMap.get('heavy_physical_burst')?.totalWeight ?? 0) >= 5;
    const highMagic = (threatMap.get('heavy_magic_burst')?.totalWeight ?? 0) >= 5;
    if (highPhys || highMagic) nuance -= 10;
  }
  if (entry.key === 'enhancement_greedy') {
    if (
      position <= 3 &&
      (hero.archetype === 'right_click_carry' ||
        hero.archetype === 'illusion_carry' ||
        hero.archetype === 'tempo_mid')
    ) {
      nuance -= 25;
    } else if (position === 3 && hero.archetype !== 'spell_core') {
      nuance -= 12;
    }
  }
  if (
    entry.key === 'enhancement_keen_eyed' &&
    (hero.archetype === 'save_support' ||
      hero.archetype === 'lane_support' ||
      hero.archetype === 'roaming_support')
  ) {
    nuance += 10;
  }

  const score = entry.baseScore + archetypeBonus + posBonus + evalRes.threatScore + evalRes.modeDelta + nuance;
  const reason = buildNeutralReason(evalRes.topReason, evalRes.countersHeroes, entry.defaultReason);
  return { score, reason, countersHeroes: evalRes.countersHeroes };
}

function selectPoolDiverseArtifacts(
  ranked: RecommendedNeutralArtifact[],
  limit = 3
): RecommendedNeutralArtifact[] {
  const picked: RecommendedNeutralArtifact[] = [];
  const usedPools = new Set<NeutralPoolIndex>();
  const usedKeys = new Set<string>();

  for (const item of ranked) {
    if (picked.length >= limit) break;
    if (!usedPools.has(item.pool)) {
      usedPools.add(item.pool);
      usedKeys.add(item.key);
      picked.push(item);
    }
  }

  if (picked.length < limit) {
    for (const item of ranked) {
      if (picked.length >= limit) break;
      if (!usedKeys.has(item.key)) {
        usedKeys.add(item.key);
        picked.push(item);
      }
    }
  }

  return picked;
}

export function recommendHeroNeutrals(
  hero: HeroRecord,
  position: Position,
  threatMap: Map<ThreatTag, TeamThreatSummary>,
  mode: GameMode
): TierNeutralRecommendation[] {
  return TIERS.map((tier) => {
    const candidateArtifacts: RecommendedNeutralArtifact[] = NEUTRAL_ARTIFACTS.filter((entry) => {
      if (entry.tier !== tier) return false;
      if (!entry.validPositions.includes(position)) return false;
      if (entry.attackTypeFilter && hero.attackType !== entry.attackTypeFilter) return false;
      return true;
    })
      .map((entry) => {
        const scored = scoreArtifact(entry, hero, position, threatMap, mode);
        return {
          key: entry.key,
          name: entry.name,
          img: entry.img,
          tier: entry.tier,
          pool: entry.pool,
          summary: entry.summary,
          score: scored.score,
          reason: scored.reason,
          countersHeroes: scored.countersHeroes,
        };
      })
      .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

    const artifacts = selectPoolDiverseArtifacts(candidateArtifacts, 3);

    const enchantments: RecommendedNeutralEnchantment[] = NEUTRAL_ENCHANTMENTS.filter((entry) => {
      if (!entry.tiers.includes(tier)) return false;
      if (!entry.allowedPrimaryAttrs.includes(hero.primaryAttr)) return false;
      if (!entry.validPositions.includes(position)) return false;
      return true;
    })
      .map((entry) => {
        const scored = scoreEnchantment(entry, hero, position, threatMap, mode);
        return {
          key: entry.key,
          name: entry.name,
          img: entry.img,
          tier,
          stats: entry.statsByTier[tier] ?? '',
          tradeoff: entry.tradeoff,
          score: scored.score,
          reason: scored.reason,
          isAttrExclusive: entry.allowedPrimaryAttrs.length === 1,
          countersHeroes: scored.countersHeroes,
        };
      })
      .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
      .slice(0, 2);

    return {
      tier,
      unlockSeconds: getNeutralTierUnlockSeconds(tier, mode),
      unlockLabel: getNeutralTierUnlockLabel(tier, mode),
      artifacts,
      enchantments,
    };
  });
}
