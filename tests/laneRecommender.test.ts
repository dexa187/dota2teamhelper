import { describe, expect, it } from 'vitest';
import snapshotJson from '../src/shared/data/opendota-snapshot.json';
import { buildHeroCatalog } from '../src/shared/data/heroTactics';
import { recommendLanes } from '../src/shared/engine/laneRecommender';
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

describe('laneRecommender', () => {
  it('assigns standard 5v5 draft accurately onto Radiant lanes (Safe=Bot, Off=Top)', () => {
    const allies = pick(
      'npc_dota_hero_juggernaut',
      'npc_dota_hero_storm_spirit',
      'npc_dota_hero_axe',
      'npc_dota_hero_earthshaker',
      'npc_dota_hero_crystal_maiden'
    );
    const enemies = pick(
      'npc_dota_hero_phantom_assassin',
      'npc_dota_hero_zuus',
      'npc_dota_hero_bristleback',
      'npc_dota_hero_nyx_assassin',
      'npc_dota_hero_lion'
    );

    const plan = recommendLanes({
      allies,
      enemies,
      faction: 'radiant',
      mode: 'regular',
    });

    expect(plan.allyPositions[1]?.name).toBe('npc_dota_hero_juggernaut');
    expect(plan.allyPositions[2]?.name).toBe('npc_dota_hero_storm_spirit');
    expect(plan.allyPositions[3]?.name).toBe('npc_dota_hero_axe');
    expect(plan.allyPositions[4]?.name).toBe('npc_dota_hero_earthshaker');
    expect(plan.allyPositions[5]?.name).toBe('npc_dota_hero_crystal_maiden');

    expect(plan.lanes.bot.label).toBe('Safe Lane');
    expect(plan.lanes.top.label).toBe('Offlane');
    expect(plan.lanes.mid.label).toBe('Mid Lane');

    expect(plan.lanes.bot.allies.map((a) => a.hero.name).sort()).toEqual([
      'npc_dota_hero_crystal_maiden',
      'npc_dota_hero_juggernaut',
    ]);
    expect(plan.lanes.top.allies.map((a) => a.hero.name).sort()).toEqual([
      'npc_dota_hero_axe',
      'npc_dota_hero_earthshaker',
    ]);
  });

  it('maps Dire Safe Lane to Top and Offlane to Bot', () => {
    const allies = pick(
      'npc_dota_hero_antimage',
      'npc_dota_hero_puck',
      'npc_dota_hero_tidehunter',
      'npc_dota_hero_spirit_breaker',
      'npc_dota_hero_oracle'
    );
    const plan = recommendLanes({
      allies,
      enemies: [],
      faction: 'dire',
      mode: 'regular',
    });

    expect(plan.lanes.top.label).toBe('Safe Lane');
    expect(plan.lanes.bot.label).toBe('Offlane');
    expect(plan.lanes.top.allies.map((a) => a.hero.name)).toContain('npc_dota_hero_antimage');
    expect(plan.lanes.top.allies.map((a) => a.hero.name)).toContain('npc_dota_hero_oracle');
  });

  it('respects lockedPositions overrides and re-optimizes remaining heroes', () => {
    const allies = pick(
      'npc_dota_hero_juggernaut',
      'npc_dota_hero_storm_spirit',
      'npc_dota_hero_axe',
      'npc_dota_hero_earthshaker',
      'npc_dota_hero_crystal_maiden'
    );
    const jugg = byName.get('npc_dota_hero_juggernaut')!;

    const plan = recommendLanes({
      allies,
      enemies: [],
      faction: 'radiant',
      mode: 'regular',
      lockedPositions: { 2: jugg.id },
    });

    expect(plan.allyPositions[2]?.id).toBe(jugg.id);
    expect(plan.lanes.mid.allies[0].locked).toBe(true);
    expect(plan.lanes.mid.allies[0].hero.id).toBe(jugg.id);
  });

  it('handles partial drafts cleanly without crashing', () => {
    const allies = pick('npc_dota_hero_drow_ranger', 'npc_dota_hero_jakiro');
    const enemies = pick('npc_dota_hero_mars');

    const plan = recommendLanes({
      allies,
      enemies,
      faction: 'radiant',
      mode: 'turbo',
    });

    const totalPlaced =
      plan.lanes.top.allies.length + plan.lanes.mid.allies.length + plan.lanes.bot.allies.length;
    expect(totalPlaced).toBe(2);
    expect(plan.lanes.bot.gameplan.length).toBeGreaterThan(0);
  });

  it('surfaces swapRecommendation when matchup-aware flex swap improves lanes by >= 8', () => {
    const allies = pick(
      'npc_dota_hero_dragon_knight',
      'npc_dota_hero_kez',
      'npc_dota_hero_centaur',
      'npc_dota_hero_hoodwink',
      'npc_dota_hero_lich'
    );

    const enemyTeam = pick(
      'npc_dota_hero_slark',
      'npc_dota_hero_huskar',
      'npc_dota_hero_bristleback',
      'npc_dota_hero_rattletrap',
      'npc_dota_hero_dazzle'
    );

    const dk = byName.get('npc_dota_hero_dragon_knight')!;
    const kez = byName.get('npc_dota_hero_kez')!;
    const huskar = byName.get('npc_dota_hero_huskar')!;
    const bb = byName.get('npc_dota_hero_bristleback')!;

    // Baseline role-only prefers Kez Pos 1 (9) / DK Pos 2 (8); live matchups favor swapping DK Pos 1 / Kez Pos 2
    const liveMatchups: Record<number, Record<number, number>> = {
      [dk.id]: { [huskar.id]: -14, [bb.id]: 12 },
      [kez.id]: { [huskar.id]: 14, [bb.id]: -12 },
    };

    const plan = recommendLanes({
      allies,
      enemies: enemyTeam,
      faction: 'radiant',
      mode: 'regular',
      liveMatchups,
    });

    expect(plan.allyPositions[2]?.id).toBe(kez.id);
    expect(plan.allyPositions[1]?.id).toBe(dk.id);
    expect(plan.swapRecommendation).not.toBeNull();
    expect(plan.swapRecommendation!.gain).toBeGreaterThanOrEqual(8);
  });
});
