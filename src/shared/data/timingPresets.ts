import type { CueId, GameMode, RolePreset, TimingCueDefinition } from '../types';

export const TIMING_CUES: TimingCueDefinition[] = [
  {
    id: 'pull_small',
    label: 'Small Camp Pull',
    description: 'Safe lane pull timing (:15 & :45). Automatically skipped on Catapult waves.',
    category: 'lane',
    priority: 20,
    defaultEnabled: true,
    defaultLeadSeconds: 7,
    skipOnCatapult: true,
    regular: { startAt: 75, secondOffsets: [15, 45], endAt: 720 },
    turbo: { startAt: 75, secondOffsets: [15, 45], endAt: 420 },
  },
  {
    id: 'pull_large',
    label: 'Large Camp Pull',
    description: 'Hard camp pull timing (:18 & :48). Automatically skipped on Catapult waves.',
    category: 'lane',
    priority: 18,
    defaultEnabled: false,
    defaultLeadSeconds: 7,
    skipOnCatapult: true,
    regular: { startAt: 78, secondOffsets: [18, 48], endAt: 720 },
    turbo: { startAt: 78, secondOffsets: [18, 48], endAt: 420 },
  },
  {
    id: 'stack_camp',
    label: 'Stack Neutral Camp',
    description: 'Pull neutral creeps out of spawn box at :54 before the minute mark.',
    category: 'lane',
    priority: 30,
    defaultEnabled: true,
    defaultLeadSeconds: 9,
    regular: { startAt: 114, secondOffsets: [54], endAt: 900 },
    turbo: { startAt: 114, secondOffsets: [54], endAt: 600 },
  },
  {
    id: 'water_rune',
    label: 'Water Runes',
    description: 'River sustain runes at 2:00 and 4:00 in both modes.',
    category: 'rune',
    priority: 65,
    defaultEnabled: true,
    defaultLeadSeconds: 15,
    regular: { oneShotTimes: [120, 240] },
    turbo: { oneShotTimes: [120, 240] },
  },
  {
    id: 'power_rune',
    label: 'Power Runes',
    description: 'River power rune spawn starting at 6:00, then every 2:00.',
    category: 'rune',
    priority: 70,
    defaultEnabled: true,
    defaultLeadSeconds: 15,
    regular: { startAt: 360, interval: 120 },
    turbo: { startAt: 360, interval: 120 },
  },
  {
    id: 'bounty_rune',
    label: 'Bounty Runes',
    description: 'Jungle Bounty runes at 0:00 and every 4:00.',
    category: 'rune',
    priority: 55,
    defaultEnabled: true,
    defaultLeadSeconds: 20,
    regular: { startAt: 0, interval: 240 },
    turbo: { startAt: 0, interval: 240 },
  },
  {
    id: 'lotus_pool',
    label: 'Lotus Pools',
    description: 'Healing Lotus spawns every 3:00 (Regular) or 1:30 (Turbo).',
    category: 'objective',
    priority: 60,
    defaultEnabled: true,
    defaultLeadSeconds: 15,
    regular: { startAt: 180, interval: 180 },
    turbo: { startAt: 90, interval: 90 },
  },
  {
    id: 'wisdom_shrine',
    label: 'Shrine of Wisdom',
    description: 'Offlane jungle XP Shrine activates every 7:00 (Regular) or 3:30 (Turbo).',
    category: 'objective',
    priority: 80,
    defaultEnabled: true,
    defaultLeadSeconds: 25,
    regular: { startAt: 420, interval: 420 },
    turbo: { startAt: 210, interval: 210 },
  },
  {
    id: 'catapult_wave',
    label: 'Siege / Catapult Wave',
    description: 'Siege creep wave every 5:00 — push towers and do not pull.',
    category: 'lane',
    priority: 48,
    defaultEnabled: true,
    defaultLeadSeconds: 15,
    regular: { startAt: 300, interval: 300 },
    turbo: { startAt: 300, interval: 300 },
  },
  {
    id: 'day_night_pit',
    label: 'Day/Night & Roshan Pit Swap',
    description: 'Announces 5:00 Day/Night switch and active Roshan/Tormentor map side.',
    category: 'objective',
    priority: 45,
    defaultEnabled: true,
    defaultLeadSeconds: 15,
    regular: { startAt: 300, interval: 300 },
    turbo: { startAt: 300, interval: 300 },
  },
  {
    id: 'aghanims_shard',
    label: "Aghanim's Shard Unlock",
    description: 'Shop availability at 15:00 (Regular) or 7:30 (Turbo).',
    category: 'tier',
    priority: 50,
    defaultEnabled: true,
    defaultLeadSeconds: 10,
    regular: { oneShotTimes: [900] },
    turbo: { oneShotTimes: [450] },
  },
  {
    id: 'neutral_tiers',
    label: 'Neutral Item Tiers (Madstone)',
    description: 'Madstone neutral crafting tier unlocks (0:00 / 15:00 / 30:00 / 50:00 Regular, halved in Turbo).',
    category: 'tier',
    priority: 40,
    defaultEnabled: true,
    defaultLeadSeconds: 10,
    regular: {
      oneShotTimes: [0, 900, 1800, 3000],
      labels: ['Tier 1 Neutral', 'Tier 2 Neutral', 'Tier 3 Neutral', 'Tier 4 Neutral'],
    },
    turbo: {
      oneShotTimes: [0, 450, 900, 1500],
      labels: ['Tier 1 Neutral', 'Tier 2 Neutral', 'Tier 3 Neutral', 'Tier 4 Neutral'],
    },
  },
  {
    id: 'tormentor',
    label: 'Tormentor Spawn',
    description: 'First spawn at 20:00 (+10:00 respawn) Regular, or 10:00 (+5:00 respawn) Turbo.',
    category: 'boss',
    priority: 90,
    defaultEnabled: true,
    defaultLeadSeconds: 30,
    regular: { startAt: 1200, interval: 600 },
    turbo: { startAt: 600, interval: 300 },
  },
  {
    id: 'roshan',
    label: 'Roshan & Aegis Timers',
    description: 'Tracks Aegis expiration (5m / 4m Turbo) and Roshan respawn window (8–11m / 4–5.5m Turbo).',
    category: 'boss',
    priority: 100,
    defaultEnabled: true,
    defaultLeadSeconds: 0,
    regular: { startAt: 300, interval: 480, endAt: 660 },
    turbo: { startAt: 240, interval: 240, endAt: 330 },
  },
];

export const TIMING_CUE_MAP: Record<CueId, TimingCueDefinition> = Object.fromEntries(
  TIMING_CUES.map((c) => [c.id, c])
) as Record<CueId, TimingCueDefinition>;

export const ROLE_PRESETS: Record<RolePreset, { label: string; enabledCues: CueId[] }> = {
  all: {
    label: 'All Cues',
    enabledCues: TIMING_CUES.map((c) => c.id),
  },
  pos1: {
    label: 'Pos 1 Carry',
    enabledCues: [
      'stack_camp',
      'bounty_rune',
      'lotus_pool',
      'catapult_wave',
      'day_night_pit',
      'aghanims_shard',
      'neutral_tiers',
      'tormentor',
      'roshan',
    ],
  },
  pos2: {
    label: 'Pos 2 Mid',
    enabledCues: [
      'stack_camp',
      'water_rune',
      'power_rune',
      'bounty_rune',
      'wisdom_shrine',
      'catapult_wave',
      'day_night_pit',
      'aghanims_shard',
      'neutral_tiers',
      'tormentor',
      'roshan',
    ],
  },
  pos3: {
    label: 'Pos 3 Offlane',
    enabledCues: [
      'pull_large',
      'stack_camp',
      'bounty_rune',
      'lotus_pool',
      'wisdom_shrine',
      'catapult_wave',
      'day_night_pit',
      'aghanims_shard',
      'neutral_tiers',
      'tormentor',
      'roshan',
    ],
  },
  support: {
    label: 'Pos 4/5 Support',
    enabledCues: [
      'pull_small',
      'pull_large',
      'stack_camp',
      'water_rune',
      'power_rune',
      'bounty_rune',
      'lotus_pool',
      'wisdom_shrine',
      'catapult_wave',
      'day_night_pit',
      'aghanims_shard',
      'neutral_tiers',
      'tormentor',
      'roshan',
    ],
  },
};

export function getBossTimingConstants(mode: GameMode) {
  return mode === 'turbo'
    ? {
        aegisDuration: 240,
        roshanMinRespawn: 240,
        roshanMaxRespawn: 330,
        tormentorFirstSpawn: 600,
        tormentorRespawn: 300,
      }
    : {
        aegisDuration: 300,
        roshanMinRespawn: 480,
        roshanMaxRespawn: 660,
        tormentorFirstSpawn: 1200,
        tormentorRespawn: 600,
      };
}

export function getMapCycleState(clockSeconds: number): {
  isNight: boolean;
  roshanPit: 'Bottom Pit (Radiant River)' | 'Top Pit (Dire River)';
  tormentorCorner: 'Top-Left Corner (opposite Bottom Pit)' | 'Bottom-Right Corner (opposite Top Pit)';
  secondsUntilSwap: number;
} {
  const safeClock = Math.max(0, Math.floor(clockSeconds));
  const cycleIndex = Math.floor(safeClock / 300);
  const isNight = cycleIndex % 2 === 1;
  const secondsUntilSwap = 300 - (safeClock % 300);
  return {
    isNight,
    roshanPit: isNight ? 'Top Pit (Dire River)' : 'Bottom Pit (Radiant River)',
    tormentorCorner: isNight
      ? 'Bottom-Right Corner (opposite Top Pit)'
      : 'Top-Left Corner (opposite Bottom Pit)',
    secondsUntilSwap,
  };
}
