export type GameMode = 'regular' | 'turbo';
export type Faction = 'radiant' | 'dire';
export type Position = 1 | 2 | 3 | 4 | 5;
export type LaneName = 'top' | 'mid' | 'bot';
export type LaneRoleLabel = 'Safe Lane' | 'Mid Lane' | 'Offlane';
export type PrimaryAttr = 'str' | 'agi' | 'int' | 'all';
export type AttackType = 'Melee' | 'Ranged';

export type HeroArchetype =
  | 'right_click_carry'
  | 'illusion_carry'
  | 'spell_core'
  | 'tempo_mid'
  | 'aura_offlaner'
  | 'initiator_offlaner'
  | 'roaming_support'
  | 'save_support'
  | 'lane_support';

export type ThreatTag =
  | 'evasion'
  | 'strong_passive'
  | 'heavy_heal_regen'
  | 'heavy_magic_burst'
  | 'heavy_disable_stun'
  | 'single_target_ult'
  | 'silence_root_debuff'
  | 'elusive_mobile'
  | 'invisibility'
  | 'illusions_summons'
  | 'heavy_physical_burst'
  | 'high_armor'
  | 'high_hp_tank'
  | 'defensive_buffs_saves'
  | 'channeled_spells'
  | 'spell_spam_lane'
  | 'kiting_required'
  | 'mana_dependent_shield'
  | 'gap_close_needed'
  | 'aoe_teamfight_save';

export interface HeroThreat {
  tag: ThreatTag;
  weight: 1 | 2 | 3;
  note: string;
}

export interface LaneTraits {
  laneStrength: 1 | 2 | 3;
  hasStun?: boolean;
  hasKillThreat?: boolean;
  hasSave?: boolean;
  hasHarass?: boolean;
  hasPush?: boolean;
  hasDispel?: boolean;
  hasIllusionClear?: boolean;
  isGreedy?: boolean;
  wantsMeleePartner?: boolean;
  wantsRangedPartner?: boolean;
}

export interface HeroCoreItems {
  starting: string[];
  early: string[];
  core: string[];
  late: string[];
  turboReplace?: Record<string, string>;
  shardPriority?: 'high' | 'medium' | 'low';
}

export interface HeroTactics {
  posScores: [number, number, number, number, number];
  aliases: string[];
  archetype: HeroArchetype;
  laneTraits: LaneTraits;
  threats: HeroThreat[];
  coreItems: HeroCoreItems;
}

export interface HeroBaseData {
  id: number;
  name: string;
  localizedName: string;
  primaryAttr: PrimaryAttr;
  attackType: AttackType;
  roles: string[];
  img: string;
  icon: string;
}

export type HeroRecord = HeroBaseData & HeroTactics;

export type ItemStage = 'starting' | 'early' | 'core' | 'counter' | 'late';

export interface ItemCounterRule {
  tag: ThreatTag;
  score: number;
  reason: string;
}

export interface ItemCatalogEntry {
  key: string;
  name: string;
  cost: number;
  img: string;
  stage: ItemStage;
  validPositions: Position[];
  validArchetypes?: HeroArchetype[];
  attackTypeFilter?: AttackType;
  teamUnique?: boolean;
  teamCarrierPriority?: Position[];
  counters?: ItemCounterRule[];
  turboNote?: string;
  turboPenalty?: number;
  turboBonus?: number;
}

export interface OpenDotaSnapshotItem {
  id: number;
  key: string;
  dname: string;
  cost: number;
  img: string;
}

export interface OpenDotaSnapshot {
  updatedAt: string;
  heroes: HeroBaseData[];
  items: Record<string, OpenDotaSnapshotItem>;
}

export interface DraftState {
  faction: Faction;
  mode: GameMode;
  allies: number[];
  enemies: number[];
  myHeroId: number | null;
  lockedPositions: Partial<Record<Position, number>>;
}

export interface LaneSlotHero {
  hero: HeroRecord;
  position: Position;
  locked: boolean;
  suitabilityScore: number;
}

export interface LaneAssignment {
  lane: LaneName;
  label: LaneRoleLabel;
  allies: LaneSlotHero[];
  enemies: Array<{ hero: HeroRecord; position: Position }>;
  matchupRating: 'favorable' | 'even' | 'tough';
  score: number;
  synergyTags: string[];
  threatWarnings: string[];
  gameplan: string[];
}

export interface LaneMatchupPlan {
  lanes: Record<LaneName, LaneAssignment>;
  overallScore: number;
  swapRecommendation: { message: string; gain: number } | null;
  allyPositions: Partial<Record<Position, HeroRecord>>;
  enemyPositions: Partial<Record<Position, HeroRecord>>;
}

export interface ThreatSource {
  heroId: number;
  heroName: string;
  img: string;
  weight: 1 | 2 | 3;
  note: string;
}

export interface TeamThreatSummary {
  tag: ThreatTag;
  label: string;
  totalWeight: number;
  severity: 'high' | 'medium' | 'low';
  sources: ThreatSource[];
}

export interface RecommendedItem {
  key: string;
  name: string;
  cost: number;
  img: string;
  stage: ItemStage;
  score: number;
  isTeamDuty?: boolean;
  countersHeroes: Array<{ heroId: number; heroName: string; img: string; note: string }>;
  reason: string;
  turboNote?: string;
}

export interface TeamAuraDuty {
  itemKey: string;
  itemName: string;
  itemImg: string;
  carrierHeroId: number;
  carrierName: string;
  carrierPosition: Position;
  reason: string;
}

export interface HeroItemBuildRecommendation {
  hero: HeroRecord;
  position: Position;
  lane: LaneName;
  laneLabel: LaneRoleLabel;
  isMyHero: boolean;
  starting: RecommendedItem[];
  early: RecommendedItem[];
  core: RecommendedItem[];
  counters: RecommendedItem[];
  late: RecommendedItem[];
  turboNotes: string[];
}

export type CueId =
  | 'pull_small'
  | 'pull_large'
  | 'stack_camp'
  | 'water_rune'
  | 'power_rune'
  | 'bounty_rune'
  | 'lotus_pool'
  | 'wisdom_shrine'
  | 'catapult_wave'
  | 'day_night_pit'
  | 'aghanims_shard'
  | 'neutral_tiers'
  | 'tormentor'
  | 'roshan';

export type CueCategory = 'lane' | 'rune' | 'objective' | 'tier' | 'boss';
export type RolePreset = 'all' | 'pos1' | 'pos2' | 'pos3' | 'support';

export interface TimingModeConfig {
  startAt?: number;
  interval?: number;
  endAt?: number;
  oneShotTimes?: number[];
  secondOffsets?: number[];
  labels?: string[];
}

export interface TimingCueDefinition {
  id: CueId;
  label: string;
  description: string;
  category: CueCategory;
  priority: number;
  defaultEnabled: boolean;
  defaultLeadSeconds: number;
  skipOnCatapult?: boolean;
  regular: TimingModeConfig;
  turbo: TimingModeConfig;
}

export interface CueOverride {
  enabled?: boolean;
  leadSeconds?: number;
  intervalSeconds?: number;
}

export interface BossTrackerState {
  roshanKilledAt: number | null;
  tormentorKilledAt: number | null;
}

export interface UpcomingCue {
  key: string;
  cueId: CueId;
  clipId: string;
  label: string;
  category: CueCategory;
  priority: number;
  eventTime: number;
  fireTime: number;
  leadSeconds: number;
  announcement: string;
}

export interface FiredCueBatch {
  id: string;
  category: CueCategory;
  priority: number;
  title: string;
  spokenText: string;
  cues: UpcomingCue[];
  firedAtClock: number;
}

export interface GsiNormalizedState {
  connected: boolean;
  lastUpdatedAt: number | null;
  clockTime: number | null;
  gameTime: number | null;
  gameState: string | null;
  paused: boolean;
  customGameName: string | null;
  detectedMode: GameMode | null;
  faction: Faction | null;
  heroName: string | null;
  roshanState: string | null;
  roshanStateEndSeconds: number | null;
  roshanDiedAtClock: number | null;
  teamAllies: string[];
  teamEnemies: string[];
}

export interface RoomClockState {
  baseClockSeconds: number;
  running: boolean;
  updatedAtServerMs: number;
}

export interface RoomHeroClaim {
  clientId: string;
  playerName: string;
}

export interface RoomMember {
  clientId: string;
  playerName: string;
  joinedAt: number;
}

export interface RoomActivityEntry {
  id: string;
  text: string;
  at: number;
}

export interface RoomSnapshot {
  code: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  serverNowMs: number;
  faction: Faction;
  mode: GameMode;
  allies: number[];
  enemies: number[];
  lockedPositions: Partial<Record<Position, number>>;
  heroClaims: Record<number, RoomHeroClaim>;
  clock: RoomClockState;
  bossState: BossTrackerState;
  members: RoomMember[];
  recentActivity: RoomActivityEntry[];
}

export type RoomAction =
  | { type: 'ADD_HERO'; side: 'ally' | 'enemy'; heroId: number; clientId: string; playerName: string; heroName?: string }
  | { type: 'REMOVE_HERO'; side: 'ally' | 'enemy'; heroId: number; clientId: string; playerName: string; heroName?: string }
  | { type: 'CLAIM_HERO'; heroId: number | null; clientId: string; playerName: string; heroName?: string }
  | { type: 'SET_FACTION'; faction: Faction; clientId: string; playerName: string }
  | { type: 'SET_MODE'; mode: GameMode; clientId: string; playerName: string }
  | { type: 'LOCK_POSITION'; pos: Position; heroId: number | null; clientId: string; playerName: string }
  | { type: 'UNLOCK_ALL_POSITIONS'; clientId: string; playerName: string }
  | { type: 'LOAD_SAMPLE_DRAFT'; allies: number[]; enemies: number[]; clientId: string; playerName: string }
  | { type: 'CLEAR_DRAFT'; clientId: string; playerName: string }
  | { type: 'CLOCK_START'; clientId: string; playerName: string }
  | { type: 'CLOCK_PAUSE'; clientId: string; playerName: string }
  | { type: 'CLOCK_SET'; seconds: number; clientId: string; playerName: string }
  | { type: 'CLOCK_NUDGE'; delta: number; clientId: string; playerName: string }
  | { type: 'BOSS_ROSHAN_KILL'; clientId: string; playerName: string }
  | { type: 'BOSS_ROSHAN_CLEAR'; clientId: string; playerName: string }
  | { type: 'BOSS_TORMENTOR_KILL'; clientId: string; playerName: string }
  | { type: 'BOSS_TORMENTOR_CLEAR'; clientId: string; playerName: string };

export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type RoomActionInput = DistributiveOmit<RoomAction, 'clientId' | 'playerName'>;

