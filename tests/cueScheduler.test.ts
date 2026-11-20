import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIO_CLIPS, VOICE_PACKS } from '../src/shared/data/audioClips';
import { TIMING_CUES } from '../src/shared/data/timingPresets';
import { evaluateDueCues, getUpcomingEvents } from '../src/shared/engine/cueScheduler';
import type { BossTrackerState, CueId, CueOverride } from '../src/shared/types';

const NO_BOSS: BossTrackerState = { roshanKilledAt: null, tormentorKilledAt: null };

describe('cueScheduler', () => {
  it('uses distinct Regular vs Turbo schedules for Lotus, Wisdom, Tormentor, Neutral Tiers & Roshan', () => {
    const regUpcoming = getUpcomingEvents(0, 'regular', {}, NO_BOSS, 1300);
    const turboUpcoming = getUpcomingEvents(0, 'turbo', {}, NO_BOSS, 1300);

    expect(regUpcoming.find((c) => c.cueId === 'lotus_pool')?.eventTime).toBe(180);
    expect(turboUpcoming.find((c) => c.cueId === 'lotus_pool')?.eventTime).toBe(90);

    expect(regUpcoming.find((c) => c.cueId === 'wisdom_shrine')?.eventTime).toBe(420);
    expect(turboUpcoming.find((c) => c.cueId === 'wisdom_shrine')?.eventTime).toBe(210);

    expect(regUpcoming.find((c) => c.cueId === 'tormentor')?.eventTime).toBe(1200);
    expect(turboUpcoming.find((c) => c.cueId === 'tormentor')?.eventTime).toBe(600);

    const regNeutrals = regUpcoming.filter((c) => c.cueId === 'neutral_tiers').map((c) => c.eventTime);
    const turboNeutrals = turboUpcoming.filter((c) => c.cueId === 'neutral_tiers').map((c) => c.eventTime);
    expect(regNeutrals.slice(0, 2)).toEqual([0, 900]);
    expect(turboNeutrals.slice(0, 3)).toEqual([0, 450, 900]);

    // Roshan killed at 600s -> Regular Aegis 900s, Min 1080s, Max 1260s; Turbo Aegis 840s, Min 840s, Max 930s
    const killedBoss: BossTrackerState = { roshanKilledAt: 600, tormentorKilledAt: 1200 };
    const regRosh = getUpcomingEvents(600, 'regular', {}, killedBoss, 700).filter((c) => c.cueId === 'roshan');
    const turboRosh = getUpcomingEvents(600, 'turbo', {}, killedBoss, 700).filter((c) => c.cueId === 'roshan');

    expect(regRosh.map((c) => c.eventTime)).toEqual([840, 900, 1080, 1260]);
    expect(turboRosh.map((c) => c.eventTime)).toEqual([780, 840, 840, 930]);
  });

  it('suppresses Small & Large Camp Pull cues on Catapult waves (5:00, 10:00)', () => {
    const overrides: Partial<Record<CueId, CueOverride>> = {
      pull_small: { enabled: true },
      pull_large: { enabled: true },
    };

    const upcoming = getUpcomingEvents(240, 'regular', overrides, NO_BOSS, 400);
    const pullTimes = upcoming
      .filter((c) => c.cueId === 'pull_small' || c.cueId === 'pull_large')
      .map((c) => c.eventTime);

    // 4:15 (255), 4:18 (258), 4:45 (285), 4:48 (288) should exist
    expect(pullTimes).toContain(255);
    expect(pullTimes).toContain(258);
    expect(pullTimes).toContain(285);
    // 5:15 (315) & 5:18 (318) & 10:15 (615) catapult waves must be suppressed
    expect(pullTimes).not.toContain(315);
    expect(pullTimes).not.toContain(318);
    expect(pullTimes).not.toContain(615);
    // 5:45 (345) is the 5:30 non-catapult wave so it remains active
    expect(pullTimes).toContain(345);
  });

  it('batches simultaneous cues (e.g. 6:00 Power Rune + Lotus Pool) into one combined utterance', () => {
    const firedIds = new Set<string>();
    const overrides: Partial<Record<CueId, CueOverride>> = {
      power_rune: { enabled: true, leadSeconds: 15 },
      lotus_pool: { enabled: true, leadSeconds: 15 },
      stack_camp: { enabled: false },
      pull_small: { enabled: false },
    };

    // At 345 (5:45), both Power Rune (6:00) and Lotus Pool (6:00) fire with 15s lead!
    const { batches, newlyFiredIds } = evaluateDueCues(
      344,
      346,
      'regular',
      overrides,
      NO_BOSS,
      firedIds
    );

    expect(batches).toHaveLength(1);
    expect(batches[0].cues.map((c) => c.cueId).sort()).toEqual(['lotus_pool', 'power_rune']);
    expect(batches[0].spokenText).toContain('Power Runes');
    expect(batches[0].spokenText).toContain('Lotus Pools');
    expect(newlyFiredIds).toContain('power_rune@360');
    expect(newlyFiredIds).toContain('lotus_pool@360');
  });

  it('deduplicates fired cues even across GSI clock jitter', () => {
    const firedIds = new Set<string>();
    const first = evaluateDueCues(104, 106, 'regular', {}, NO_BOSS, firedIds);
    expect(first.batches.length).toBeGreaterThan(0);
    for (const id of first.newlyFiredIds) firedIds.add(id);

    // Repeat or jitter backward by 1s and step across 105 again
    const backward = evaluateDueCues(106, 104, 'regular', {}, NO_BOSS, firedIds);
    expect(backward.batches).toHaveLength(0);

    const repeat = evaluateDueCues(104, 106, 'regular', {}, NO_BOSS, firedIds);
    expect(repeat.batches).toHaveLength(0);
  });

  it('assigns valid clipIds to all cues and ships pre-generated MP3 clips for every voice pack', () => {
    const allEnabled = Object.fromEntries(
      TIMING_CUES.map((c) => [c.id, { enabled: true }])
    ) as Partial<Record<CueId, CueOverride>>;
    const nowOverrides = Object.fromEntries(
      TIMING_CUES.map((c) => [c.id, { enabled: true, leadSeconds: 0 }])
    ) as Partial<Record<CueId, CueOverride>>;

    const regSoon = getUpcomingEvents(0, 'regular', allEnabled, { roshanKilledAt: 600, tormentorKilledAt: 1200 }, 4000);
    const turboNow = getUpcomingEvents(0, 'turbo', nowOverrides, { roshanKilledAt: 300, tormentorKilledAt: 600 }, 2200);
    const roshanEvents = getUpcomingEvents(600, 'regular', allEnabled, { roshanKilledAt: 600, tormentorKilledAt: null }, 700);

    const combined = [...regSoon, ...turboNow, ...roshanEvents];
    expect(combined.length).toBeGreaterThan(20);
    for (const cue of combined) {
      expect(Object.prototype.hasOwnProperty.call(AUDIO_CLIPS, cue.clipId)).toBe(true);
    }

    const clipIds = Object.keys(AUDIO_CLIPS);
    expect(clipIds).not.toContain('neutral_tier_5');
    for (const pack of VOICE_PACKS) {
      for (const clipId of clipIds) {
        const filePath = resolve(process.cwd(), 'public/audio/cues', pack.id, `${clipId}.mp3`);
        const info = statSync(filePath);
        expect(info.isFile()).toBe(true);
        expect(info.size).toBeGreaterThan(1000);
        expect(info.size).toBeLessThan(12000);
      }
      const staleTier5 = resolve(process.cwd(), 'public/audio/cues', pack.id, 'neutral_tier_5.mp3');
      expect(existsSync(staleTier5)).toBe(false);
    }
  });
});
