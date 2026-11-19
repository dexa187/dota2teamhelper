import {
  TIMING_CUES,
  getBossTimingConstants,
  getMapCycleState,
} from '../data/timingPresets';
import type { AudioClipId } from '../data/audioClips';
import type {
  BossTrackerState,
  CueId,
  CueOverride,
  FiredCueBatch,
  GameMode,
  TimingCueDefinition,
  UpcomingCue,
} from '../types';

export function formatClock(seconds: number): string {
  const neg = seconds < 0;
  const abs = Math.abs(Math.floor(seconds));
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  return `${neg ? '-' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function isCatapultWaveMinute(eventTimeSeconds: number): boolean {
  if (eventTimeSeconds < 300) return false;
  const minute = Math.floor(eventTimeSeconds / 60);
  const second = eventTimeSeconds % 60;
  return minute >= 5 && minute % 5 === 0 && second < 30;
}

function getEffectiveRule(
  def: TimingCueDefinition,
  override: CueOverride | undefined
): { enabled: boolean; leadSeconds: number; intervalOverride?: number } {
  return {
    enabled: override?.enabled ?? def.defaultEnabled,
    leadSeconds: Math.max(0, override?.leadSeconds ?? def.defaultLeadSeconds),
    intervalOverride: override?.intervalSeconds,
  };
}

function formatCueAnnouncement(
  def: TimingCueDefinition,
  eventTime: number,
  leadSeconds: number,
  customLabel?: string
): string {
  const label = customLabel ?? def.label;
  if (def.id === 'pull_small') {
    return leadSeconds > 0 ? `Pull small camp in ${leadSeconds} seconds` : 'Pull small camp now';
  }
  if (def.id === 'pull_large') {
    return leadSeconds > 0 ? `Pull large camp in ${leadSeconds} seconds` : 'Pull large camp now';
  }
  if (def.id === 'stack_camp') {
    return leadSeconds > 0 ? `Stack camp in ${leadSeconds} seconds` : 'Stack neutral camp now';
  }
  if (def.id === 'day_night_pit') {
    const nextState = getMapCycleState(eventTime);
    const pitWord = nextState.isNight ? 'Nighttime, Roshan moving Top Pit' : 'Daytime, Roshan moving Bottom Pit';
    return leadSeconds > 0 ? `${pitWord} in ${leadSeconds} seconds` : pitWord;
  }
  if (def.id === 'catapult_wave') {
    return leadSeconds > 0
      ? `Catapult wave in ${leadSeconds} seconds, do not pull`
      : 'Catapult wave spawning, push tower';
  }
  if (def.id === 'aghanims_shard') {
    return leadSeconds > 0
      ? `Aghanim's Shard unlocks in ${leadSeconds} seconds`
      : "Aghanim's Shard now available in shop";
  }
  return leadSeconds > 0 ? `${label} in ${leadSeconds} seconds` : `${label} now`;
}

function resolveClipId(
  def: TimingCueDefinition,
  eventTime: number,
  leadSeconds: number,
  customLabel?: string
): AudioClipId {
  const soon = leadSeconds > 0;
  switch (def.id) {
    case 'pull_small':
      return soon ? 'pull_small' : 'pull_small_now';
    case 'pull_large':
      return soon ? 'pull_large' : 'pull_large_now';
    case 'stack_camp':
      return soon ? 'stack_camp' : 'stack_camp_now';
    case 'water_rune':
      return soon ? 'water_rune' : 'water_rune_now';
    case 'power_rune':
      return soon ? 'power_rune' : 'power_rune_now';
    case 'bounty_rune':
      return soon ? 'bounty_rune' : 'bounty_rune_now';
    case 'lotus_pool':
      return soon ? 'lotus_pool' : 'lotus_pool_now';
    case 'wisdom_shrine':
      return soon ? 'wisdom_shrine' : 'wisdom_shrine_now';
    case 'catapult_wave':
      return soon ? 'catapult_wave' : 'catapult_wave_now';
    case 'day_night_pit':
      return getMapCycleState(eventTime).isNight ? 'day_night_top' : 'day_night_bot';
    case 'aghanims_shard':
      return soon ? 'aghanims_shard' : 'aghanims_shard_now';
    case 'neutral_tiers': {
      const m = customLabel?.match(/Tier\s+([1-5])/);
      const tier = m ? m[1] : '1';
      return `neutral_tier_${tier}` as AudioClipId;
    }
    case 'tormentor':
      return customLabel === 'Tormentor Respawn' ? 'tormentor_respawn' : 'tormentor_first';
    case 'roshan':
      return 'roshan_window_open';
  }
}

function generateOccurrencesForCue(
  def: TimingCueDefinition,
  mode: GameMode,
  leadSeconds: number,
  intervalOverride: number | undefined,
  bossState: BossTrackerState,
  minFireTime: number,
  maxFireTime: number
): UpcomingCue[] {
  const occurrences: UpcomingCue[] = [];
  const cfg = mode === 'turbo' ? def.turbo : def.regular;

  const pushOccurrence = (eventTime: number, customLabel?: string, suffix = '') => {
    if (def.skipOnCatapult && isCatapultWaveMinute(eventTime)) return;
    const fireTime = eventTime - leadSeconds;
    if (fireTime < minFireTime || fireTime > maxFireTime) return;
    const key = `${def.id}@${eventTime}${suffix}`;
    occurrences.push({
      key,
      cueId: def.id,
      clipId: resolveClipId(def, eventTime, leadSeconds, customLabel),
      label: customLabel ?? def.label,
      category: def.category,
      priority: def.priority,
      eventTime,
      fireTime,
      leadSeconds,
      announcement: formatCueAnnouncement(def, eventTime, leadSeconds, customLabel),
    });
  };

  if (def.id === 'roshan') {
    if (bossState.roshanKilledAt !== null) {
      const killedAt = bossState.roshanKilledAt;
      const boss = getBossTimingConstants(mode);
      const aegisWarn = killedAt + boss.aegisDuration - 60;
      const aegisExpire = killedAt + boss.aegisDuration;
      const roshMin = killedAt + boss.roshanMinRespawn;
      const roshMax = killedAt + boss.roshanMaxRespawn;

      const items: Array<{
        time: number;
        label: string;
        announcement: string;
        suffix: string;
        clipId: AudioClipId;
      }> = [
        {
          time: aegisWarn,
          label: 'Aegis 1m Warning',
          announcement: 'Aegis expires in 1 minute',
          suffix: ':aegis_warn',
          clipId: 'roshan_aegis_warn',
        },
        {
          time: aegisExpire,
          label: 'Aegis Expired',
          announcement: 'Aegis has expired',
          suffix: ':aegis_exp',
          clipId: 'roshan_aegis_exp',
        },
        {
          time: roshMin,
          label: 'Roshan Window Opens',
          announcement: 'Roshan minimum respawn window is open',
          suffix: ':rosh_min',
          clipId: 'roshan_window_open',
        },
        {
          time: roshMax,
          label: 'Roshan Guaranteed Alive',
          announcement: 'Roshan is guaranteed alive',
          suffix: ':rosh_max',
          clipId: 'roshan_guaranteed',
        },
      ];

      for (const item of items) {
        const fireTime = item.time;
        if (fireTime < minFireTime || fireTime > maxFireTime) continue;
        occurrences.push({
          key: `roshan@${item.time}${item.suffix}`,
          cueId: 'roshan',
          clipId: item.clipId,
          label: item.label,
          category: 'boss',
          priority: def.priority,
          eventTime: item.time,
          fireTime,
          leadSeconds: 0,
          announcement: item.announcement,
        });
      }
    }
    return occurrences;
  }

  if (def.id === 'tormentor') {
    const boss = getBossTimingConstants(mode);
    const targetSpawn =
      bossState.tormentorKilledAt !== null
        ? bossState.tormentorKilledAt + boss.tormentorRespawn
        : boss.tormentorFirstSpawn;
    pushOccurrence(targetSpawn, bossState.tormentorKilledAt !== null ? 'Tormentor Respawn' : 'Tormentor First Spawn');
    return occurrences;
  }

  if (cfg.oneShotTimes) {
    cfg.oneShotTimes.forEach((time, idx) => {
      const label = cfg.labels?.[idx];
      pushOccurrence(time, label);
    });
    return occurrences;
  }

  if (cfg.secondOffsets && cfg.secondOffsets.length > 0) {
    const startAt = cfg.startAt ?? 60;
    const endAt = cfg.endAt ?? maxFireTime + leadSeconds;
    const minMinute = Math.max(0, Math.floor((minFireTime + leadSeconds) / 60) - 1);
    const maxMinute = Math.ceil((Math.min(endAt, maxFireTime + leadSeconds)) / 60) + 1;
    for (let m = minMinute; m <= maxMinute; m++) {
      for (const sec of cfg.secondOffsets) {
        const eventTime = m * 60 + sec;
        if (eventTime < startAt || eventTime > endAt) continue;
        pushOccurrence(eventTime);
      }
    }
    return occurrences;
  }

  const interval = Math.max(10, intervalOverride ?? cfg.interval ?? 120);
  const startAt = cfg.startAt ?? interval;
  const endAt = cfg.endAt ?? maxFireTime + leadSeconds;
  if (endAt < startAt) return occurrences;

  const firstIndex = Math.max(0, Math.floor((minFireTime + leadSeconds - startAt) / interval));
  const lastIndex = Math.ceil((Math.min(endAt, maxFireTime + leadSeconds) - startAt) / interval);
  for (let i = firstIndex; i <= lastIndex; i++) {
    const eventTime = startAt + i * interval;
    if (eventTime < startAt || eventTime > endAt) continue;
    pushOccurrence(eventTime);
  }

  return occurrences;
}

export function getUpcomingEvents(
  clockSeconds: number,
  mode: GameMode,
  cueOverrides: Partial<Record<CueId, CueOverride>>,
  bossState: BossTrackerState,
  lookaheadSeconds = 300
): UpcomingCue[] {
  const all: UpcomingCue[] = [];
  const minFire = clockSeconds;
  const maxFire = clockSeconds + lookaheadSeconds;

  for (const def of TIMING_CUES) {
    const rule = getEffectiveRule(def, cueOverrides[def.id]);
    if (!rule.enabled) continue;
    const items = generateOccurrencesForCue(
      def,
      mode,
      rule.leadSeconds,
      rule.intervalOverride,
      bossState,
      minFire - 10,
      maxFire
    );
    for (const item of items) {
      if (item.eventTime >= clockSeconds) {
        all.push(item);
      }
    }
  }

  return all.sort((a, b) => a.fireTime - b.fireTime || b.priority - a.priority);
}

function combineSpokenPhrases(cues: UpcomingCue[]): string {
  if (cues.length === 1) return cues[0].announcement;
  const sorted = [...cues].sort((a, b) => b.priority - a.priority);
  const allSameLead = sorted.every((c) => c.leadSeconds === sorted[0].leadSeconds && c.leadSeconds > 0);
  if (allSameLead && sorted.every((c) => c.cueId !== 'roshan')) {
    const names = sorted.map((c) => c.label).join(' and ');
    return `${names} in ${sorted[0].leadSeconds} seconds`;
  }
  return sorted.map((c) => c.announcement).join('. ');
}

export function evaluateDueCues(
  prevClock: number,
  currentClock: number,
  mode: GameMode,
  cueOverrides: Partial<Record<CueId, CueOverride>>,
  bossState: BossTrackerState,
  firedIds: Set<string>
): { batches: FiredCueBatch[]; newlyFiredIds: string[] } {
  if (currentClock <= prevClock) {
    return { batches: [], newlyFiredIds: [] };
  }

  // Clamp big forward jumps to a 5s catch-up window so scrubbing clock doesn't spam 30 cues
  const effectivePrev = currentClock - prevClock > 5 ? currentClock - 1 : prevClock;

  const dueCues: UpcomingCue[] = [];
  for (const def of TIMING_CUES) {
    const rule = getEffectiveRule(def, cueOverrides[def.id]);
    if (!rule.enabled) continue;

    const occurrences = generateOccurrencesForCue(
      def,
      mode,
      rule.leadSeconds,
      rule.intervalOverride,
      bossState,
      effectivePrev - 2,
      currentClock + 2
    );

    for (const occ of occurrences) {
      if (firedIds.has(occ.key)) continue;
      if (occ.fireTime > effectivePrev && occ.fireTime <= currentClock) {
        dueCues.push(occ);
      }
    }
  }

  if (dueCues.length === 0) {
    return { batches: [], newlyFiredIds: [] };
  }

  dueCues.sort((a, b) => a.fireTime - b.fireTime || b.priority - a.priority);

  // Batch cues whose trigger timestamps fall within 2 seconds of each other
  const groups: UpcomingCue[][] = [];
  for (const cue of dueCues) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && Math.abs(cue.fireTime - lastGroup[0].fireTime) <= 2) {
      lastGroup.push(cue);
    } else {
      groups.push([cue]);
    }
  }

  const newlyFiredIds: string[] = [];
  const batches: FiredCueBatch[] = groups.map((group) => {
    const sorted = [...group].sort((a, b) => b.priority - a.priority);
    for (const item of sorted) newlyFiredIds.push(item.key);
    const top = sorted[0];
    return {
      id: sorted.map((c) => c.key).join('+'),
      category: top.category,
      priority: top.priority,
      title: sorted.map((c) => c.label).join(' & '),
      spokenText: combineSpokenPhrases(sorted),
      cues: sorted,
      firedAtClock: currentClock,
    };
  });

  return { batches, newlyFiredIds };
}
