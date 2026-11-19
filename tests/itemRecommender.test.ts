import { describe, expect, it } from 'vitest';
import snapshotJson from '../src/shared/data/opendota-snapshot.json';
import { buildHeroCatalog } from '../src/shared/data/heroTactics';
import { recommendLanes } from '../src/shared/engine/laneRecommender';
import { recommendTeamItems } from '../src/shared/engine/itemRecommender';
import type { HeroRecord, OpenDotaSnapshot } from '../src/shared/types';

const HEROES = buildHeroCatalog(snapshotJson as OpenDotaSnapshot);
const byName = new Map(HEROES.map((h) => [h.name, h]));

function pick(...names: string[]): HeroRecord[] {
  return names.map((n) => {
    const h = byName.get(n);
    if (!h) throw new Error(`Hero not found: ${n}`);
    return h;
  });
}

describe('itemRecommender', () => {
  it('recommends Break/True Strike (Silver Edge / MKB) against Phantom Assassin + Bristleback', () => {
    const allies = pick(
      'npc_dota_hero_juggernaut',
      'npc_dota_hero_viper',
      'npc_dota_hero_axe',
      'npc_dota_hero_earthshaker',
      'npc_dota_hero_crystal_maiden'
    );
    const enemies = pick(
      'npc_dota_hero_phantom_assassin',
      'npc_dota_hero_bristleback',
      'npc_dota_hero_lion'
    );

    const lanePlan = recommendLanes({ allies, enemies, faction: 'radiant', mode: 'regular' });
    const result = recommendTeamItems({ lanePlan, allies, enemies, mode: 'regular' });

    const juggBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_juggernaut')!;
    const counterKeys = juggBuild.counters.map((c) => c.key);

    expect(counterKeys.includes('silver_edge') || counterKeys.includes('monkey_king_bar')).toBe(true);
    const breakOrTrueStrike = juggBuild.counters.find(
      (c) => c.key === 'silver_edge' || c.key === 'monkey_king_bar'
    )!;
    const attributedNames = breakOrTrueStrike.countersHeroes.map((h) => h.heroName);
    expect(
      attributedNames.includes('Phantom Assassin') || attributedNames.includes('Bristleback')
    ).toBe(true);
  });

  it('assigns Spirit Vessel to exactly one ally (teamUnique deduplication) vs Alchemist + Necrophos + Huskar', () => {
    const allies = pick(
      'npc_dota_hero_drow_ranger',
      'npc_dota_hero_storm_spirit',
      'npc_dota_hero_tidehunter',
      'npc_dota_hero_earth_spirit',
      'npc_dota_hero_oracle'
    );
    const enemies = pick(
      'npc_dota_hero_alchemist',
      'npc_dota_hero_necrolyte',
      'npc_dota_hero_huskar'
    );

    const lanePlan = recommendLanes({ allies, enemies, faction: 'radiant', mode: 'regular' });
    const result = recommendTeamItems({ lanePlan, allies, enemies, mode: 'regular' });

    const vesselDuties = result.teamDuties.filter((d) => d.itemKey === 'spirit_vessel');
    expect(vesselDuties).toHaveLength(1);

    const buildsWithVessel = result.builds.filter((b) =>
      b.counters.some((c) => c.key === 'spirit_vessel')
    );
    expect(buildsWithVessel).toHaveLength(1);
    expect(buildsWithVessel[0].hero.id).toBe(vesselDuties[0].carrierHeroId);

    const drowBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_drow_ranger')!;
    expect(drowBuild.counters.some((c) => c.key === 'skadi')).toBe(true);
  });

  it('assigns Pipe to one core/offlaner, BKB to cores, and Glimmer to support vs heavy magic burst', () => {
    const allies = pick(
      'npc_dota_hero_sven',
      'npc_dota_hero_templar_assassin',
      'npc_dota_hero_centaur',
      'npc_dota_hero_tusk',
      'npc_dota_hero_witch_doctor'
    );
    const enemies = pick(
      'npc_dota_hero_zuus',
      'npc_dota_hero_skywrath_mage',
      'npc_dota_hero_leshrac'
    );

    const lanePlan = recommendLanes({ allies, enemies, faction: 'radiant', mode: 'regular' });
    const result = recommendTeamItems({ lanePlan, allies, enemies, mode: 'regular' });

    const pipeCount = result.builds.filter((b) => b.counters.some((c) => c.key === 'pipe')).length;
    expect(pipeCount).toBe(1);

    const svenBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_sven')!;
    expect(svenBuild.counters.some((c) => c.key === 'black_king_bar')).toBe(true);

    const wdBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_witch_doctor')!;
    expect(wdBuild.counters.some((c) => c.key === 'glimmer_cape')).toBe(true);
  });

  it('recommends Sentry/Dust and a single Gem carrier against invisible enemies', () => {
    const allies = pick(
      'npc_dota_hero_luna',
      'npc_dota_hero_puck',
      'npc_dota_hero_slardar',
      'npc_dota_hero_rubick',
      'npc_dota_hero_dazzle'
    );
    const enemies = pick(
      'npc_dota_hero_riki',
      'npc_dota_hero_bounty_hunter',
      'npc_dota_hero_nyx_assassin'
    );

    const lanePlan = recommendLanes({ allies, enemies, faction: 'radiant', mode: 'regular' });
    const result = recommendTeamItems({ lanePlan, allies, enemies, mode: 'regular' });

    const dazzleBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_dazzle')!;
    expect(dazzleBuild.starting.some((i) => i.key === 'ward_sentry')).toBe(true);
    expect(dazzleBuild.early.some((i) => i.key === 'dust')).toBe(true);

    const gemCount = result.builds.filter((b) => b.counters.some((c) => c.key === 'gem')).length;
    expect(gemCount).toBe(1);
  });

  it('applies Turbo mode replacements (skips Midas, highlights 7:30 Shard & tempo swaps)', () => {
    const allies = pick(
      'npc_dota_hero_antimage',
      'npc_dota_hero_invoker',
      'npc_dota_hero_doom_bringer',
      'npc_dota_hero_earthshaker',
      'npc_dota_hero_crystal_maiden'
    );
    const enemies = pick('npc_dota_hero_phantom_assassin', 'npc_dota_hero_zuus');

    const lanePlan = recommendLanes({ allies, enemies, faction: 'radiant', mode: 'turbo' });
    const result = recommendTeamItems({ lanePlan, allies, enemies, mode: 'turbo' });

    const amBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_antimage')!;
    expect(amBuild.core.some((i) => i.key === 'maelstrom')).toBe(true);
    expect(amBuild.core.some((i) => i.key === 'bfury')).toBe(false);

    const invokerBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_invoker')!;
    expect(invokerBuild.core.some((i) => i.key === 'hand_of_midas')).toBe(false);

    const cmBuild = result.builds.find((b) => b.hero.name === 'npc_dota_hero_crystal_maiden')!;
    expect(cmBuild.core.some((i) => i.key === 'aghanims_shard')).toBe(true);
    expect(cmBuild.turboNotes.some((n) => n.includes('7:30'))).toBe(true);
  });
});
