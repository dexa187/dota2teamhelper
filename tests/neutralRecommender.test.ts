import { describe, expect, it } from 'vitest';
import snapshotJson from '../src/shared/data/opendota-snapshot.json';
import { buildHeroCatalog } from '../src/shared/data/heroTactics';
import { NEUTRAL_ARTIFACTS, NEUTRAL_ENCHANTMENTS } from '../src/shared/data/neutralCatalog';
import { recommendLanes } from '../src/shared/engine/laneRecommender';
import { recommendTeamItems } from '../src/shared/engine/itemRecommender';
import {
  getCurrentNeutralTier,
  getNeutralTierUnlockSeconds,
} from '../src/shared/engine/neutralRecommender';
import type { HeroRecord, OpenDotaSnapshot } from '../src/shared/types';

const SNAPSHOT = snapshotJson as OpenDotaSnapshot;
const HEROES = buildHeroCatalog(SNAPSHOT);
const byName = new Map(HEROES.map((h) => [h.name, h]));
const enchantmentByKey = new Map(NEUTRAL_ENCHANTMENTS.map((e) => [e.key, e]));

function pick(...names: string[]): HeroRecord[] {
  return names.map((n) => {
    const h = byName.get(n);
    if (!h) throw new Error(`Hero not found: ${n}`);
    return h;
  });
}

describe('neutralRecommender', () => {
  it('ships all 48 Patch 7.42 artifacts and 19 active enchantments with valid OpenDota metadata', () => {
    expect(NEUTRAL_ARTIFACTS).toHaveLength(48);
    expect(NEUTRAL_ENCHANTMENTS).toHaveLength(19);

    for (const tier of [1, 2, 3, 4] as const) {
      const tierItems = NEUTRAL_ARTIFACTS.filter((a) => a.tier === tier);
      expect(tierItems).toHaveLength(12);
      for (const pool of [1, 2, 3, 4] as const) {
        expect(tierItems.filter((a) => a.pool === pool)).toHaveLength(3);
      }
    }

    for (const artifact of NEUTRAL_ARTIFACTS) {
      const snap = SNAPSHOT.items[artifact.key];
      expect(snap).toBeDefined();
      expect(artifact.name.length).toBeGreaterThan(0);
      expect(artifact.img).toMatch(/\.png$/);
    }

    for (const ench of NEUTRAL_ENCHANTMENTS) {
      const snap = SNAPSHOT.items[ench.key];
      expect(snap).toBeDefined();
      expect(ench.name.length).toBeGreaterThan(0);
      expect(ench.img).toMatch(/\.png$/);
      for (const tier of ench.tiers) {
        expect(ench.statsByTier[tier]).toBeTruthy();
      }
    }
  });

  it('enforces primary-attribute legality for enchantments and pool diversity for artifacts across all 4 tiers', () => {
    const allies = pick(
      'npc_dota_hero_antimage', // agi
      'npc_dota_hero_storm_spirit', // int
      'npc_dota_hero_axe', // str
      'npc_dota_hero_abaddon', // all (universal)
      'npc_dota_hero_crystal_maiden' // int
    );
    const enemies = pick('npc_dota_hero_phantom_assassin', 'npc_dota_hero_zuus');

    const lanePlan = recommendLanes({ allies, enemies, faction: 'radiant', mode: 'regular' });
    const result = recommendTeamItems({ lanePlan, allies, enemies, mode: 'regular' });

    for (const build of result.builds) {
      expect(build.neutrals).toHaveLength(4);

      for (const tierRec of build.neutrals) {
        expect(tierRec.artifacts).toHaveLength(3);
        const pools = new Set(tierRec.artifacts.map((a) => a.pool));
        expect(pools.size).toBe(3);

        expect(tierRec.enchantments.length).toBeGreaterThanOrEqual(1);
        expect(tierRec.enchantments.length).toBeLessThanOrEqual(2);

        for (const recEnch of tierRec.enchantments) {
          const def = enchantmentByKey.get(recEnch.key)!;
          expect(def.tiers).toContain(tierRec.tier);
          expect(def.allowedPrimaryAttrs).toContain(build.hero.primaryAttr);
        }
      }
    }

    const amBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_antimage')!;
    const amEnchKeys = amBuild.neutrals.flatMap((n) => n.enchantments.map((e) => e.key));
    expect(amEnchKeys).not.toContain('enhancement_keen_eyed');
    expect(amEnchKeys).not.toContain('enhancement_feverish');
    expect(amEnchKeys).not.toContain('enhancement_crude');
    expect(amEnchKeys).not.toContain('enhancement_hulking');
    expect(amEnchKeys).not.toContain('enhancement_titanic');
    expect(amEnchKeys).not.toContain('enhancement_manic');
    expect(amEnchKeys).not.toContain('enhancement_greedy');

    const axeBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_axe')!;
    const axeEnchKeys = axeBuild.neutrals.flatMap((n) => n.enchantments.map((e) => e.key));
    expect(axeEnchKeys).not.toContain('enhancement_nimble');
    expect(axeEnchKeys).not.toContain('enhancement_audacious');
    expect(axeEnchKeys).not.toContain('enhancement_keen_eyed');
    expect(axeEnchKeys).not.toContain('enhancement_feverish');
    expect(axeEnchKeys).not.toContain('enhancement_titanic');
    expect(axeEnchKeys).not.toContain('enhancement_manic');

    const cmBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_crystal_maiden')!;
    const cmEnchKeys = cmBuild.neutrals.flatMap((n) => n.enchantments.map((e) => e.key));
    expect(cmEnchKeys).not.toContain('enhancement_crude');
    expect(cmEnchKeys).not.toContain('enhancement_hulking');
    expect(cmEnchKeys).not.toContain('enhancement_nimble');
    expect(cmEnchKeys).not.toContain('enhancement_audacious');
    expect(cmEnchKeys).not.toContain('enhancement_titanic');
    expect(cmEnchKeys).not.toContain('enhancement_manic');

    const abaBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_abaddon')!;
    const abaEnchKeys = abaBuild.neutrals.flatMap((n) => n.enchantments.map((e) => e.key));
    expect(abaEnchKeys).not.toContain('enhancement_crude');
    expect(abaEnchKeys).not.toContain('enhancement_hulking');
    expect(abaEnchKeys).not.toContain('enhancement_nimble');
    expect(abaEnchKeys).not.toContain('enhancement_audacious');
    expect(abaEnchKeys).not.toContain('enhancement_keen_eyed');
    expect(abaEnchKeys).not.toContain('enhancement_feverish');
  });

  it('reacts to enemy threats (anti-heal, evasion, magic burst, invisibility) and protects carry roles from Greedy', () => {
    const allies = pick(
      'npc_dota_hero_juggernaut',
      'npc_dota_hero_storm_spirit',
      'npc_dota_hero_tidehunter',
      'npc_dota_hero_rubick',
      'npc_dota_hero_crystal_maiden'
    );

    const healEnemies = pick(
      'npc_dota_hero_alchemist',
      'npc_dota_hero_necrolyte',
      'npc_dota_hero_huskar'
    );
    const healPlan = recommendLanes({ allies, enemies: healEnemies, faction: 'radiant', mode: 'regular' });
    const healResult = recommendTeamItems({ lanePlan: healPlan, allies, enemies: healEnemies, mode: 'regular' });
    const juggHeal = healResult.builds.find((b) => b.hero.name === 'npc_dota_hero_juggernaut')!;
    expect(juggHeal.neutrals[1].artifacts.some((a) => a.key === 'crippling_crossbow')).toBe(true);
    expect(juggHeal.neutrals[2].artifacts.some((a) => a.key === 'vile_phial')).toBe(true);

    const evasionEnemies = pick('npc_dota_hero_phantom_assassin', 'npc_dota_hero_bristleback');
    const evaPlan = recommendLanes({ allies, enemies: evasionEnemies, faction: 'radiant', mode: 'regular' });
    const evaResult = recommendTeamItems({ lanePlan: evaPlan, allies, enemies: evasionEnemies, mode: 'regular' });
    const juggEva = evaResult.builds.find((b) => b.hero.name === 'npc_dota_hero_juggernaut')!;
    expect(juggEva.neutrals[2].artifacts.some((a) => a.key === 'serrated_shiv')).toBe(true);
    expect(juggEva.neutrals[2].enchantments.some((e) => e.key === 'enhancement_greedy')).toBe(false);

    const magicEnemies = pick(
      'npc_dota_hero_zuus',
      'npc_dota_hero_skywrath_mage',
      'npc_dota_hero_leshrac'
    );
    const magicPlan = recommendLanes({ allies, enemies: magicEnemies, faction: 'radiant', mode: 'regular' });
    const magicResult = recommendTeamItems({ lanePlan: magicPlan, allies, enemies: magicEnemies, mode: 'regular' });
    const cmMagic = magicResult.builds.find((b) => b.hero.name === 'npc_dota_hero_crystal_maiden')!;
    expect(cmMagic.neutrals[2].artifacts.some((a) => a.key === 'dandelion_amulet')).toBe(true);
    expect(cmMagic.neutrals[1].enchantments.some((e) => e.key === 'enhancement_mystical')).toBe(true);

    const invisEnemies = pick(
      'npc_dota_hero_riki',
      'npc_dota_hero_bounty_hunter',
      'npc_dota_hero_nyx_assassin'
    );
    const invisPlan = recommendLanes({ allies, enemies: invisEnemies, faction: 'radiant', mode: 'regular' });
    const invisResult = recommendTeamItems({ lanePlan: invisPlan, allies, enemies: invisEnemies, mode: 'regular' });
    const cmInvis = invisResult.builds.find((b) => b.hero.name === 'npc_dota_hero_crystal_maiden')!;
    expect(cmInvis.neutrals[3].artifacts.some((a) => a.key === 'demonicon')).toBe(true);
  });

  it('tracks Patch 7.42 Regular vs Turbo neutral tier unlock schedules', () => {
    expect(getNeutralTierUnlockSeconds(1, 'regular')).toBe(0);
    expect(getNeutralTierUnlockSeconds(2, 'regular')).toBe(900);
    expect(getNeutralTierUnlockSeconds(3, 'regular')).toBe(1800);
    expect(getNeutralTierUnlockSeconds(4, 'regular')).toBe(3000);

    expect(getNeutralTierUnlockSeconds(1, 'turbo')).toBe(0);
    expect(getNeutralTierUnlockSeconds(2, 'turbo')).toBe(450);
    expect(getNeutralTierUnlockSeconds(3, 'turbo')).toBe(900);
    expect(getNeutralTierUnlockSeconds(4, 'turbo')).toBe(1500);

    expect(getCurrentNeutralTier(0, 'regular')).toBe(1);
    expect(getCurrentNeutralTier(899, 'regular')).toBe(1);
    expect(getCurrentNeutralTier(900, 'regular')).toBe(2);
    expect(getCurrentNeutralTier(1800, 'regular')).toBe(3);
    expect(getCurrentNeutralTier(3000, 'regular')).toBe(4);

    expect(getCurrentNeutralTier(449, 'turbo')).toBe(1);
    expect(getCurrentNeutralTier(450, 'turbo')).toBe(2);
    expect(getCurrentNeutralTier(900, 'turbo')).toBe(3);
    expect(getCurrentNeutralTier(1500, 'turbo')).toBe(4);
  });
});
