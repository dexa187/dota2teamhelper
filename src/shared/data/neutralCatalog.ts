import snapshotJson from './opendota-snapshot.json';
import type {
  AttackType,
  GameMode,
  HeroArchetype,
  NeutralArtifactCatalogEntry,
  NeutralCounterRule,
  NeutralEnchantmentCatalogEntry,
  NeutralPoolIndex,
  NeutralTier,
  OpenDotaSnapshot,
  Position,
  PrimaryAttr,
} from '../types';

const snapshot = snapshotJson as OpenDotaSnapshot;

export const NEUTRAL_TIER_TIMINGS: Record<
  GameMode,
  Record<NeutralTier, { seconds: number; label: string }>
> = {
  regular: {
    1: { seconds: 0, label: '0:00' },
    2: { seconds: 900, label: '15:00' },
    3: { seconds: 1800, label: '30:00' },
    4: { seconds: 3000, label: '50:00' },
  },
  turbo: {
    1: { seconds: 0, label: '0:00' },
    2: { seconds: 450, label: '7:30' },
    3: { seconds: 900, label: '15:00' },
    4: { seconds: 1500, label: '25:00' },
  },
};

interface NeutralArtifactBlueprint {
  key: string;
  fallbackName: string;
  tier: NeutralTier;
  pool: NeutralPoolIndex;
  summary: string;
  validPositions: Position[];
  preferredArchetypes: HeroArchetype[];
  attackTypeFilter?: AttackType;
  counters?: NeutralCounterRule[];
  turboBonus?: number;
  turboPenalty?: number;
  baseScore: number;
  defaultReason: string;
}

interface NeutralEnchantmentBlueprint {
  key: string;
  fallbackName: string;
  tiers: NeutralTier[];
  allowedPrimaryAttrs: PrimaryAttr[];
  statsByTier: Partial<Record<NeutralTier, string>>;
  tradeoff?: string;
  validPositions: Position[];
  preferredArchetypes: HeroArchetype[];
  counters?: NeutralCounterRule[];
  turboBonus?: number;
  turboPenalty?: number;
  baseScore: number;
  defaultReason: string;
}

const ALL_POSITIONS: Position[] = [1, 2, 3, 4, 5];
const ALL_ATTRS: PrimaryAttr[] = ['str', 'agi', 'int', 'all'];

const ARTIFACT_BLUEPRINTS: NeutralArtifactBlueprint[] = [
  // ================= TIER 1 (0:00) =================
  // Pool 1
  {
    key: 'chipped_vest',
    fallbackName: 'Chipped Vest',
    tier: 1,
    pool: 1,
    summary: 'Reflects physical attack damage back to attackers',
    validPositions: [3, 1, 2, 4],
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner', 'right_click_carry'],
    counters: [
      { tag: 'illusions_summons', score: 9, reason: 'Reflects damage back onto swarms of illusions and summons' },
      { tag: 'heavy_physical_burst', score: 6, reason: 'Punishes early physical right-click harassment' },
    ],
    baseScore: 18,
    defaultReason: 'Speeds up jungle clearing and punishes right-click trades',
  },
  {
    key: 'ash_legion_shield',
    fallbackName: 'Ash Legion Shield',
    tier: 1,
    pool: 1,
    summary: 'Active: grants 160 physical barrier to nearby allies (slows self by 20)',
    validPositions: [3, 4, 5, 1, 2],
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner', 'save_support', 'lane_support'],
    counters: [
      { tag: 'heavy_physical_burst', score: 9, reason: 'Teamwide physical barrier absorbs dive and tower dives' },
      { tag: 'illusions_summons', score: 7, reason: 'Blocks multi-unit physical chip damage for nearby allies' },
    ],
    baseScore: 19,
    defaultReason: 'Strong AoE physical barrier for early skirmishes and tower pushes',
  },
  {
    key: 'possessed_mask',
    fallbackName: 'Possessed Mask',
    tier: 1,
    pool: 1,
    summary: 'Lifesteals on attacks for lane & jungle sustain',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'spell_spam_lane', score: 7, reason: 'Sustains HP in lane without spending gold on extra salves' },
    ],
    baseScore: 20,
    defaultReason: 'Free right-click lifesteal for farming ancients and lane sustain',
  },
  // Pool 2
  {
    key: 'dormant_curio',
    fallbackName: 'Dormant Curio',
    tier: 1,
    pool: 2,
    summary: 'Increases potency of your next crafted neutral artifact by +30%',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'spell_core', 'tempo_mid'],
    turboBonus: 4,
    baseScore: 18,
    defaultReason: 'Investing in T1 boosts your Tier 2/3/4 artifact potency by 30%',
  },
  {
    key: 'red_ledger',
    fallbackName: 'Red Ledger',
    tier: 1,
    pool: 2,
    summary: 'Active: marks trait-sharing enemies for bonus kill/assist gold',
    validPositions: [4, 2, 5, 3, 1],
    preferredArchetypes: ['roaming_support', 'tempo_mid', 'lane_support', 'initiator_offlaner'],
    turboBonus: 3,
    baseScore: 19,
    defaultReason: 'Generates bonus bounty gold on ganks and teamfight assists',
  },
  {
    key: 'weighted_dice',
    fallbackName: 'Weighted Dice',
    tier: 1,
    pool: 2,
    summary: 'Rolls attack damage and creep last-hit gold twice, keeping higher',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    baseScore: 20,
    defaultReason: 'Increases average last-hit damage and creep bounty reliability',
  },
  // Pool 3
  {
    key: 'polliwog_charm',
    fallbackName: 'Pollywog Charm',
    tier: 1,
    pool: 3,
    summary: 'Active HP regen buff with bonus speed & regen in river',
    validPositions: [4, 5, 2, 3, 1],
    preferredArchetypes: ['roaming_support', 'lane_support', 'tempo_mid', 'save_support'],
    counters: [
      { tag: 'spell_spam_lane', score: 8, reason: 'Cheap burst HP recovery after heavy lane trading' },
    ],
    baseScore: 19,
    defaultReason: 'Fast river rotations and sustain around rune/lotus contests',
  },
  {
    key: 'seeds_of_serenity',
    fallbackName: 'Seeds of Serenity',
    tier: 1,
    pool: 3,
    summary: 'Plants a healing grove that restores ally HP in an area',
    validPositions: [5, 4, 3],
    preferredArchetypes: ['save_support', 'lane_support', 'aura_offlaner'],
    counters: [
      { tag: 'spell_spam_lane', score: 9, reason: 'Re-heals lane duo after constant spell harassment' },
      { tag: 'aoe_teamfight_save', score: 5, reason: 'Sustains grouped teammates after early teamfights' },
    ],
    baseScore: 19,
    defaultReason: 'Reliable AoE lane healing for carry and support duo',
  },
  {
    key: 'foragers_kit',
    fallbackName: "Forager's Kit",
    tier: 1,
    pool: 3,
    summary: 'Forages nearby marked trees for free HP, mana, stats, or gold treats',
    validPositions: [5, 4, 2, 3, 1],
    preferredArchetypes: ['save_support', 'lane_support', 'spell_core', 'roaming_support'],
    baseScore: 18,
    defaultReason: 'Steady stream of free consumables and permanent stats from trees',
  },
  // Pool 4
  {
    key: 'kobold_cup',
    fallbackName: 'Kobold Cup',
    tier: 1,
    pool: 4,
    summary: 'Active: grants +20% movement speed aura to nearby allies',
    validPositions: [4, 5, 3, 2],
    preferredArchetypes: ['roaming_support', 'lane_support', 'save_support', 'aura_offlaner'],
    counters: [
      { tag: 'kiting_required', score: 8, reason: 'Speeds up team chases and disengages against slows' },
    ],
    baseScore: 18,
    defaultReason: 'Teamwide movement speed burst for ganks and early rotations',
  },
  {
    key: 'stonefeather_satchel',
    fallbackName: 'Stonefeather Satchel',
    tier: 1,
    pool: 4,
    summary: 'Toggle: +12 MS & +30% push distance OR +3 armor & -30% push',
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['tempo_mid', 'initiator_offlaner', 'right_click_carry', 'roaming_support'],
    counters: [
      { tag: 'heavy_physical_burst', score: 6, reason: 'Rocks mode gives +3 armor and resists displacement' },
      { tag: 'kiting_required', score: 6, reason: 'Feathers mode grants +12 MS and boosts Force Staff distance' },
    ],
    baseScore: 18,
    defaultReason: 'Flexible toggle between bonus movement speed and armor',
  },
  {
    key: 'pogo_stick',
    fallbackName: "Tumbler's Toy",
    tier: 1,
    pool: 4,
    summary: 'Active: hops forward 300 units (disabled briefly on player damage)',
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['save_support', 'lane_support', 'spell_core', 'roaming_support'],
    counters: [
      { tag: 'kiting_required', score: 7, reason: 'Short hop escapes Sprout/trees and repositions in fights' },
      { tag: 'gap_close_needed', score: 6, reason: 'Extra mobility gap-closer for early pickoffs' },
    ],
    baseScore: 17,
    defaultReason: 'Extra positioning hop for dodging trees, cliffs, and skillshots',
  },

  // ================= TIER 2 (15:00 / 7:30 Turbo) =================
  // Pool 1
  {
    key: 'psychic_headband',
    fallbackName: 'Psychic Headband',
    tier: 2,
    pool: 1,
    summary: 'Active: pushes target enemy hero 400 units away',
    validPositions: [4, 5, 2, 3],
    preferredArchetypes: ['save_support', 'lane_support', 'spell_core', 'roaming_support'],
    counters: [
      { tag: 'kiting_required', score: 11, reason: 'Pushes diving melee brawlers away from your backline' },
      { tag: 'channeled_spells', score: 7, reason: 'Displaces channeling enemies out of position' },
      { tag: 'gap_close_needed', score: 6, reason: 'Keeps gap-closing enemies at arm’s length' },
    ],
    baseScore: 20,
    defaultReason: 'Zero-gold defensive Force push against diving enemies',
  },
  {
    key: 'safety_bubble',
    fallbackName: 'Safety Bubble',
    tier: 2,
    pool: 1,
    summary: 'Passive regenerating all-damage barrier when out of combat',
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['right_click_carry', 'spell_core', 'save_support', 'lane_support'],
    counters: [
      { tag: 'heavy_magic_burst', score: 8, reason: 'Absorbs opening magic nuke damage in skirmishes' },
      { tag: 'heavy_physical_burst', score: 7, reason: 'Provides buffer HP against blink-burst initiations' },
    ],
    baseScore: 20,
    defaultReason: 'Free regenerating shield that protects squishier heroes and farming cores',
  },
  {
    key: 'metamorphic_mandible',
    fallbackName: 'Metamorphic Mandible',
    tier: 2,
    pool: 1,
    summary: 'Active 4s: +35% magic res, +15% MS, smaller model, -45% armor',
    validPositions: [4, 5, 2, 3],
    preferredArchetypes: ['spell_core', 'save_support', 'lane_support', 'roaming_support', 'tempo_mid'],
    counters: [
      { tag: 'heavy_magic_burst', score: 10, reason: 'Active +35% magic resistance shrugs off burst combos' },
      { tag: 'kiting_required', score: 7, reason: '+15% movement speed burst helps kite or chase' },
    ],
    baseScore: 17,
    defaultReason: 'Burst magic resistance and movespeed escape (watch the armor drop)',
  },
  // Pool 2
  {
    key: 'jidi_pollen_bag',
    fallbackName: 'Jidi Pollen Bag',
    tier: 2,
    pool: 2,
    summary: 'Applies AoE % max HP poison and heals nearby allies on expiry',
    validPositions: [3, 4, 5, 2],
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner', 'roaming_support', 'lane_support'],
    counters: [
      { tag: 'high_hp_tank', score: 10, reason: '% max HP damage burns down tanky strength frontliners' },
      { tag: 'illusions_summons', score: 8, reason: 'AoE pollen ticks clear grouped illusions and summons' },
    ],
    baseScore: 19,
    defaultReason: 'AoE % HP damage and follow-up team sustain in midgame brawls',
  },
  {
    key: 'brick',
    fallbackName: 'Brick',
    tier: 2,
    pool: 2,
    summary: 'Active: throws brick to strip 200 barrier and deal 150 physical damage',
    validPositions: [4, 5, 3, 2],
    preferredArchetypes: ['roaming_support', 'lane_support', 'tempo_mid', 'initiator_offlaner'],
    counters: [
      { tag: 'defensive_buffs_saves', score: 11, reason: 'Instantly strips Glimmer, Pavise, Aphotic Shield, or Pipe barriers' },
      { tag: 'mana_dependent_shield', score: 8, reason: 'Shatters defensive shields before follow-up nukes' },
    ],
    baseScore: 18,
    defaultReason: 'Instant 600-range barrier shredder and extra nuke in skirmishes',
  },
  {
    key: 'crippling_crossbow',
    fallbackName: 'Crippling Crossbow',
    tier: 2,
    pool: 2,
    summary: 'Active: slows enemy and reduces their healing/regen by 40%',
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['right_click_carry', 'tempo_mid', 'roaming_support', 'lane_support'],
    counters: [
      { tag: 'heavy_heal_regen', score: 14, reason: '40% healing reduction shuts down Alchemist, Huskar, and Necrophos' },
      { tag: 'kiting_required', score: 7, reason: 'Ranged slow helps stick onto or kite melee targets' },
    ],
    baseScore: 20,
    defaultReason: 'Strong anti-heal and ranged slow for early midgame pickoffs',
  },
  // Pool 3
  {
    key: 'imp_claw',
    fallbackName: 'Imp Claw',
    tier: 2,
    pool: 3,
    summary: 'Empowers next attack with a guaranteed critical strike on cooldown',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'tempo_mid', 'initiator_offlaner'],
    counters: [
      { tag: 'gap_close_needed', score: 7, reason: 'Boosts burst damage when jumping squishy backline targets' },
    ],
    baseScore: 21,
    defaultReason: 'Reliable critical hit burst for carries and physical tempo cores',
  },
  {
    key: 'gunpowder_gauntlets',
    fallbackName: 'Gunpowder Gauntlet',
    tier: 2,
    pool: 3,
    summary: 'Passive attack proc triggers AoE magic damage explosion',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid', 'aura_offlaner'],
    counters: [
      { tag: 'illusions_summons', score: 9, reason: 'AoE magic proc helps clear waves and illusion swarms' },
      { tag: 'high_armor', score: 8, reason: 'Magic proc bypasses high physical armor' },
    ],
    baseScore: 20,
    defaultReason: 'Accelerates wave/camp clear and adds magic burst to right-clicks',
  },
  {
    key: 'defiant_shell',
    fallbackName: 'Defiant Shell',
    tier: 2,
    pool: 3,
    summary: 'Triggers an instant counter-attack when struck by an enemy',
    validPositions: [3, 1, 2],
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner', 'right_click_carry'],
    attackTypeFilter: 'Melee',
    counters: [
      { tag: 'heavy_physical_burst', score: 8, reason: 'Trades back free counter-attacks when focused in melee' },
      { tag: 'illusions_summons', score: 7, reason: 'Procs frequently against fast-hitting summon/illusion packs' },
    ],
    baseScore: 19,
    defaultReason: 'Extra free attack procs for frontline melee brawlers',
  },
  // Pool 4
  {
    key: 'spellslinger',
    fallbackName: 'Spellslinger',
    tier: 2,
    pool: 4,
    summary: 'Restores a percentage of mana spent on abilities over time',
    validPositions: [2, 3, 4, 5, 1],
    preferredArchetypes: ['spell_core', 'tempo_mid', 'save_support', 'lane_support'],
    counters: [
      { tag: 'mana_dependent_shield', score: 6, reason: 'Sustains extended spell rotations and mana pool' },
    ],
    baseScore: 20,
    defaultReason: 'Sustains continuous spellcasting through midgame fights',
  },
  {
    key: 'partisans_brand',
    fallbackName: "Partisan's Brand",
    tier: 2,
    pool: 4,
    summary: 'Grants +7% spell damage amplification against enemy heroes and player units',
    validPositions: [2, 3, 4, 5],
    preferredArchetypes: ['spell_core', 'tempo_mid', 'lane_support', 'roaming_support'],
    counters: [
      { tag: 'high_armor', score: 8, reason: 'Amplifies spell damage against high-armor physical cores' },
      { tag: 'illusions_summons', score: 7, reason: 'Bonus spell damage hits summons, illusions, and clones' },
    ],
    baseScore: 20,
    defaultReason: 'Unconditional 7% spell amp for nukers and magic-damage cores',
  },
  {
    key: 'mana_draught',
    fallbackName: 'Mana Draught',
    tier: 2,
    pool: 4,
    summary: 'Active: restores burst mana (doubled while standing in river)',
    validPositions: [2, 4, 5, 3],
    preferredArchetypes: ['tempo_mid', 'spell_core', 'roaming_support', 'save_support'],
    baseScore: 19,
    defaultReason: 'On-demand burst mana refill for ganking and defending waves',
  },

  // ================= TIER 3 (30:00 / 15:00 Turbo) =================
  // Pool 1
  {
    key: 'enchanters_bauble',
    fallbackName: "Enchanter's Bauble",
    tier: 3,
    pool: 1,
    summary: 'Boosts current Enchantment bonuses by +10% (+35% per recraft)',
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['right_click_carry', 'spell_core', 'tempo_mid', 'save_support', 'aura_offlaner'],
    baseScore: 21,
    defaultReason: 'Amplifies strong Tier 3 enchantments and scales further on recrafts',
  },
  {
    key: 'ceremonial_robe',
    fallbackName: 'Ceremonial Robe',
    tier: 3,
    pool: 1,
    summary: 'Aura: reduces nearby enemy magic resistance and status resistance by 10%',
    validPositions: [3, 4, 5, 2],
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner', 'spell_core', 'lane_support'],
    counters: [
      { tag: 'high_hp_tank', score: 8, reason: 'Cuts enemy magic resistance so spells melt tanky cores' },
      { tag: 'heavy_disable_stun', score: 6, reason: 'Reduces enemy status resistance so your stuns last longer' },
    ],
    baseScore: 20,
    defaultReason: 'Strong aura increasing your team’s magic damage and disable duration',
  },
  {
    key: 'harmonizer',
    fallbackName: 'Harmonizer',
    tier: 3,
    pool: 1,
    summary: 'Reduces mana costs of ready spells & amps damage while spells are on CD',
    validPositions: [2, 3, 4, 5],
    preferredArchetypes: ['spell_core', 'tempo_mid', 'lane_support', 'save_support'],
    counters: [
      { tag: 'high_armor', score: 8, reason: 'Ramps up magic spell output against armored frontliners' },
    ],
    baseScore: 20,
    defaultReason: 'Rewards rapid spell combos with cheaper casts and higher spell amp',
  },
  // Pool 2
  {
    key: 'prophets_pendulum',
    fallbackName: "Prophet's Pendulum",
    tier: 3,
    pool: 2,
    summary: 'Delays 30% of incoming damage, spreading it over 5 seconds',
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner', 'right_click_carry', 'save_support'],
    counters: [
      { tag: 'heavy_magic_burst', score: 10, reason: 'Staggers 30% of lethal nuke damage so saves/heals can land' },
      { tag: 'heavy_physical_burst', score: 10, reason: 'Prevents instant 100-to-0 assassin deletions' },
      { tag: 'single_target_ult', score: 8, reason: 'Buys time to pop BKB, Satanic, or receive ally saves' },
    ],
    baseScore: 21,
    defaultReason: 'Smoothes burst spikes into manageable DoT ticks during teamfights',
  },
  {
    key: 'idol_of_screeauk',
    fallbackName: "Idol of Scree'auk",
    tier: 3,
    pool: 2,
    summary: 'Active 5s: +50% damage resistance, free-pathing, +25% evasion',
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['save_support', 'lane_support', 'spell_core', 'right_click_carry', 'tempo_mid'],
    counters: [
      { tag: 'heavy_physical_burst', score: 10, reason: '50% damage reduction + 25% evasion survives physical focus' },
      { tag: 'kiting_required', score: 9, reason: 'Free-pathing walks straight out of Arena, Sprout, or cliff traps' },
      { tag: 'aoe_teamfight_save', score: 9, reason: 'Halves incoming damage during enemy AoE ultimate combos' },
    ],
    baseScore: 22,
    defaultReason: 'Clutch defensive active with damage reduction and unobstructed pathing',
  },
  {
    key: 'dandelion_amulet',
    fallbackName: 'Dandelion Amulet',
    tier: 3,
    pool: 2,
    summary: 'Passive block against large single instances of magic damage on cooldown',
    validPositions: [4, 5, 2, 1, 3],
    preferredArchetypes: ['save_support', 'lane_support', 'spell_core', 'right_click_carry'],
    counters: [
      { tag: 'heavy_magic_burst', score: 12, reason: 'Blocks big magic nukes (Zeus/Skywrath/Lion) automatically' },
      { tag: 'single_target_ult', score: 7, reason: 'Absorbs burst magic ultimates like Laguna Blade or Finger' },
    ],
    baseScore: 19,
    defaultReason: 'Automatic magic-nuke shield plus helpful movespeed',
  },
  // Pool 3
  {
    key: 'balmhook',
    fallbackName: 'Balmhook',
    tier: 3,
    pool: 3,
    summary: 'Casting any spell on an ally grants them +12 HP regen for 12s',
    validPositions: [5, 4, 3],
    preferredArchetypes: ['save_support', 'lane_support', 'aura_offlaner'],
    counters: [
      { tag: 'aoe_teamfight_save', score: 8, reason: 'Keeps healed/buffed teammates healthy through sustained fights' },
      { tag: 'heavy_magic_burst', score: 7, reason: 'Stabilizes allies after heavy spell poke and sieges' },
    ],
    baseScore: 19,
    defaultReason: 'Turns every ally-targeted heal or buff into +144 extra HP regeneration',
  },
  {
    key: 'rattlecage',
    fallbackName: 'Rattlecage',
    tier: 3,
    pool: 3,
    summary: 'Fires damaging, slowing projectiles after taking damage thresholds',
    validPositions: [3, 4, 2],
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner'],
    counters: [
      { tag: 'heavy_physical_burst', score: 9, reason: 'Triggers rapid slowing counter-volleys when tanking focus' },
      { tag: 'illusions_summons', score: 8, reason: 'AoE retaliation hits surrounding illusions and summons' },
    ],
    baseScore: 19,
    defaultReason: 'Bonus armor and automatic slowing retaliation for frontliners',
  },
  {
    key: 'stormcrafter',
    fallbackName: 'Stormcrafter',
    tier: 3,
    pool: 3,
    summary: 'Passive lightning zaps nearby enemies every 3s (+mana regen & MS)',
    validPositions: [3, 2, 4, 5],
    preferredArchetypes: ['aura_offlaner', 'spell_core', 'tempo_mid', 'roaming_support'],
    counters: [
      { tag: 'illusions_summons', score: 8, reason: 'Consistent lightning zaps chip illusions and speed wave clear' },
      { tag: 'high_armor', score: 6, reason: 'Passive magic zaps ignore armor' },
    ],
    baseScore: 19,
    defaultReason: 'Reliable passive farming speed, mana regen, and movement speed',
  },
  // Pool 4
  {
    key: 'vile_phial',
    fallbackName: 'Vile Phial',
    tier: 3,
    pool: 4,
    summary: '4 attacks poison enemy: -35% health restoration and 40 DPS for 5s',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'heavy_heal_regen', score: 15, reason: '35% anti-heal poison shuts down high-regen/lifesteal cores' },
      { tag: 'high_hp_tank', score: 7, reason: 'Sustained DoT and heal cut wear down tanky frontliners' },
    ],
    baseScore: 20,
    defaultReason: 'Free anti-heal poison proc for fast-attacking cores and illusion heroes',
  },
  {
    key: 'serrated_shiv',
    fallbackName: 'Serrated Shiv',
    tier: 3,
    pool: 4,
    summary: 'Passive attack proc pierces evasion and deals % current HP damage',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'tempo_mid', 'illusion_carry'],
    counters: [
      { tag: 'evasion', score: 14, reason: 'Guaranteed True Strike procs pierce Butterfly, Blur, and Radiance' },
      { tag: 'high_hp_tank', score: 10, reason: '% current HP damage chunks high-health strength cores' },
    ],
    baseScore: 21,
    defaultReason: 'Adds True Strike burst and % HP damage before needing full MKB',
  },
  {
    key: 'revenants_brooch',
    fallbackName: "Revenant's Brooch",
    tier: 3,
    pool: 4,
    summary: 'Attacks have a chance to deal bonus magic damage with spell lifesteal',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'tempo_mid', 'spell_core'],
    counters: [
      { tag: 'high_armor', score: 12, reason: 'Magic attack procs punch straight through 30+ armor targets' },
      { tag: 'defensive_buffs_saves', score: 8, reason: 'Magic damage threatens Ghost Scepter / high-armor saves' },
    ],
    baseScore: 20,
    defaultReason: 'Hybrid magic burst and lifesteal on right-click cores',
  },

  // ================= TIER 4 (50:00 / 25:00 Turbo) =================
  // Pool 1
  {
    key: 'fallen_sky',
    fallbackName: 'Fallen Sky',
    tier: 4,
    pool: 1,
    summary: 'Active: Blink + Meteor Hammer AoE stun and burn impact',
    validPositions: [3, 2, 4, 1],
    preferredArchetypes: ['initiator_offlaner', 'aura_offlaner', 'tempo_mid', 'roaming_support'],
    counters: [
      { tag: 'gap_close_needed', score: 11, reason: 'Instant blink initiation + stun onto distant backline threats' },
      { tag: 'channeled_spells', score: 9, reason: 'AoE stun cancels channeled spells from range' },
    ],
    baseScore: 21,
    defaultReason: 'Adds a free Blink initiation + AoE stun and tower siege threat',
  },
  {
    key: 'flicker',
    fallbackName: 'Flicker',
    tier: 4,
    pool: 1,
    summary: '4s cooldown self basic dispel + short-range random blink',
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['save_support', 'lane_support', 'spell_core', 'tempo_mid', 'right_click_carry'],
    counters: [
      { tag: 'silence_root_debuff', score: 14, reason: '4s cooldown basic dispel cleanses silences, roots, and Vessel' },
      { tag: 'kiting_required', score: 9, reason: 'Short blink escapes melee brawlers and ground traps' },
    ],
    baseScore: 22,
    defaultReason: 'Ultra-short cooldown dispel and mobility lifeline in late-game fights',
  },
  {
    key: 'minotaur_horn',
    fallbackName: 'Minotaur Horn',
    tier: 4,
    pool: 1,
    summary: 'Active: grants short-duration Debuff Immunity (mini-BKB)',
    validPositions: [1, 2, 3, 4],
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid', 'initiator_offlaner'],
    counters: [
      { tag: 'heavy_disable_stun', score: 14, reason: 'Extra Debuff Immunity window covers BKB downtime' },
      { tag: 'heavy_magic_burst', score: 11, reason: 'Grants magic resistance & debuff immunity during focus' },
      { tag: 'silence_root_debuff', score: 9, reason: 'Lets cores attack unhindered through control spells' },
    ],
    baseScore: 23,
    defaultReason: 'Second mini-BKB window for surviving late-game teamfight disables',
  },
  // Pool 2
  {
    key: 'mind_breaker',
    fallbackName: 'Mind Breaker',
    tier: 4,
    pool: 2,
    summary: 'Attack proc silences target and deals bonus magic damage',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'elusive_mobile', score: 13, reason: 'On-hit silence prevents Puck/Storm/Ember/AM from blinking out' },
      { tag: 'channeled_spells', score: 9, reason: 'Instant silence disrupts spell combos on first hit' },
      { tag: 'heavy_magic_burst', score: 8, reason: 'Silences dangerous spellcasters before they unload' },
    ],
    baseScore: 21,
    defaultReason: 'Free on-hit silence and magic damage burst for right-clickers',
  },
  {
    key: 'divine_regalia',
    fallbackName: 'Divine Regalia',
    tier: 4,
    pool: 2,
    summary: 'Grants +20% outgoing damage amplification (breaks into Disgraced on death)',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'spell_core', 'tempo_mid'],
    counters: [
      { tag: 'high_hp_tank', score: 9, reason: '+20% outgoing damage helps burst down ultra-tanky late cores' },
    ],
    baseScore: 20,
    defaultReason: 'Massive +20% damage spike for high-survivability carries or mids',
  },
  {
    key: 'heavy_blade',
    fallbackName: 'Witchbane',
    tier: 4,
    pool: 2,
    summary: 'Active: targeted dispel + bonus magic attack damage scaling with target max mana',
    validPositions: [1, 2, 3, 4],
    preferredArchetypes: ['right_click_carry', 'tempo_mid', 'spell_core', 'roaming_support'],
    counters: [
      { tag: 'defensive_buffs_saves', score: 13, reason: 'Active basic dispel purges Ghost, Glimmer, Eul, and Solar Crest' },
      { tag: 'mana_dependent_shield', score: 12, reason: 'Bonus damage scales with enemy max mana vs INT/Mana Shield cores' },
    ],
    baseScore: 21,
    defaultReason: 'Targeted offensive dispel and heavy anti-mana bonus attack damage',
  },
  // Pool 3
  {
    key: 'dezun_bloodrite',
    fallbackName: 'Dezun Bloodrite',
    tier: 4,
    pool: 3,
    summary: 'Expands spell AoE radius and converts part of spell costs into HP',
    validPositions: [2, 3, 4, 5],
    preferredArchetypes: ['spell_core', 'aura_offlaner', 'initiator_offlaner', 'lane_support'],
    counters: [
      { tag: 'illusions_summons', score: 8, reason: 'Larger AoE spells blanket entire illusion and summon packs' },
    ],
    baseScore: 21,
    defaultReason: 'Amplifies AoE radius on stuns, nukes, and teamfight ultimates',
  },
  {
    key: 'helm_of_the_hivemind',
    fallbackName: 'Helm of the Hivemind',
    tier: 4,
    pool: 3,
    summary: '+120 cast range (+80 per wearer on either team), -8% max HP per wearer',
    validPositions: [4, 5, 2, 3],
    preferredArchetypes: ['save_support', 'lane_support', 'spell_core', 'roaming_support'],
    counters: [
      { tag: 'aoe_teamfight_save', score: 9, reason: 'Extra cast range lets supports save allies safely from outside AoE ults' },
      { tag: 'kiting_required', score: 8, reason: 'Longer cast range keeps backliners far from melee gap-closers' },
    ],
    baseScore: 20,
    defaultReason: 'Huge cast range boost for backline casters (avoid if enemies stack HP burst)',
  },
  {
    key: 'conjurers_catalyst',
    fallbackName: "Conjurer's Catalyst",
    tier: 4,
    pool: 3,
    summary: 'Tracks spell damage dealt and unleashes AoE burst explosions on thresholds',
    validPositions: [2, 3, 4, 5],
    preferredArchetypes: ['spell_core', 'tempo_mid', 'lane_support'],
    counters: [
      { tag: 'high_hp_tank', score: 8, reason: 'Bonus spell procs add extra sustained burst against tanky teams' },
      { tag: 'illusions_summons', score: 7, reason: 'AoE spell detonations punish clumped enemy units' },
    ],
    baseScore: 20,
    defaultReason: 'Turns sustained spell damage output into extra AoE nuke bursts',
  },
  // Pool 4
  {
    key: 'riftshadow_prism',
    fallbackName: 'Riftshadow Prism',
    tier: 4,
    pool: 4,
    summary: 'Active: sacrifices HP percentage to summon a strong controllable illusion',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['illusion_carry', 'right_click_carry', 'aura_offlaner'],
    counters: [
      { tag: 'single_target_ult', score: 8, reason: 'Extra illusion baits single-target spells and adds tower push' },
    ],
    baseScore: 20,
    defaultReason: 'Creates a high-impact illusion for split push, scouting, and DPS',
  },
  {
    key: 'giants_ring',
    fallbackName: "Giant's Ring",
    tier: 4,
    pool: 4,
    summary: 'Grants unobstructed free-pathing, model size, and AoE stomp damage',
    validPositions: [3, 1, 2],
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner', 'right_click_carry'],
    counters: [
      { tag: 'kiting_required', score: 11, reason: 'Unobstructed movement walks directly over cliffs, Sprout, and Fissures' },
      { tag: 'illusions_summons', score: 7, reason: 'Continuous AoE stomp damage clears nearby units while walking' },
    ],
    baseScore: 22,
    defaultReason: 'Unobstructed pathing prevents kiting and boosts frontline presence',
  },
  {
    key: 'demonicon',
    fallbackName: 'Book of the Dead',
    tier: 4,
    pool: 4,
    summary: 'Active: summons Necronomicon units with True Sight & mana burn',
    validPositions: [4, 5, 3, 2, 1],
    preferredArchetypes: ['save_support', 'lane_support', 'aura_offlaner', 'spell_core'],
    counters: [
      { tag: 'invisibility', score: 13, reason: 'Summoned Archer/Warrior provide mobile True Sight detection' },
      { tag: 'mana_dependent_shield', score: 9, reason: 'Summon attacks burn enemy mana and siege high ground' },
    ],
    baseScore: 22,
    defaultReason: 'Massive push, dewarding True Sight, and extra teamfight bodies',
  },
];

const ENCHANTMENT_BLUEPRINTS: NeutralEnchantmentBlueprint[] = [
  // ================= MULTI-TIER CORE (T1–T3) =================
  {
    key: 'enhancement_quickened',
    fallbackName: 'Quickened',
    tiers: [1, 2, 3],
    allowedPrimaryAttrs: ALL_ATTRS,
    statsByTier: {
      1: '+15 Movement Speed',
      2: '+20 Movement Speed, +100 Mana',
      3: '+25 Movement Speed, +160 Mana',
    },
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['roaming_support', 'save_support', 'lane_support', 'tempo_mid', 'initiator_offlaner'],
    counters: [
      { tag: 'kiting_required', score: 8, reason: 'Flat movement speed improves chasing and kiting' },
    ],
    baseScore: 19,
    defaultReason: 'Reliable movement speed and mana pool across any role',
  },
  {
    key: 'enhancement_vital',
    fallbackName: 'Vital',
    tiers: [1, 2],
    allowedPrimaryAttrs: ALL_ATTRS,
    statsByTier: {
      1: '+1.5 HP Regen, +0.5 Mana Regen',
      2: '+3 HP Regen, +0.8 Mana Regen',
    },
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['lane_support', 'save_support', 'aura_offlaner', 'right_click_carry'],
    counters: [
      { tag: 'spell_spam_lane', score: 7, reason: 'Passive HP & mana regeneration absorbs lane poke' },
    ],
    baseScore: 18,
    defaultReason: 'Steady HP and mana regen for early lane/jungle recovery',
  },
  {
    key: 'enhancement_brawny',
    fallbackName: 'Brawny',
    tiers: [1, 2, 3],
    allowedPrimaryAttrs: ['str', 'agi'],
    statsByTier: {
      1: '+125 Health',
      2: '+175 Health, +4 HP Regen',
      3: '+225 Health, +8 HP Regen',
    },
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner', 'right_click_carry', 'roaming_support'],
    counters: [
      { tag: 'heavy_magic_burst', score: 9, reason: 'Flat max HP buffer prevents early magic burst deaths' },
      { tag: 'heavy_physical_burst', score: 7, reason: 'Extra raw health helps survive physical dive' },
    ],
    baseScore: 19,
    defaultReason: 'Raw HP and health regeneration for STR/AGI heroes',
  },
  {
    key: 'enhancement_tough',
    fallbackName: 'Tough',
    tiers: [1, 2, 3],
    allowedPrimaryAttrs: ['str', 'int'],
    statsByTier: {
      1: '+5 Damage',
      2: '+8 Damage, +4 Armor',
      3: '+11 Damage, +7 Armor',
    },
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner', 'save_support', 'lane_support', 'spell_core'],
    counters: [
      { tag: 'heavy_physical_burst', score: 10, reason: 'Flat bonus armor directly mitigates physical burst' },
      { tag: 'illusions_summons', score: 7, reason: 'Armor reduces physical chip from illusions and creeps' },
    ],
    baseScore: 19,
    defaultReason: 'Flat armor and attack damage boost for STR/INT heroes',
  },
  {
    key: 'enhancement_alert',
    fallbackName: 'Alert',
    tiers: [1, 2, 3],
    allowedPrimaryAttrs: ['agi', 'all'],
    statsByTier: {
      1: '+10 Attack Speed',
      2: '+15 Attack Speed, +75 Night Vision',
      3: '+20 Attack Speed, +150 Night Vision',
    },
    validPositions: [1, 2, 3, 4],
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'invisibility', score: 6, reason: 'Bonus night vision helps spot flanks and wards earlier' },
    ],
    baseScore: 19,
    defaultReason: 'Free attack speed for right-click farming plus night vision',
  },
  {
    key: 'enhancement_mystical',
    fallbackName: 'Mystical',
    tiers: [1, 2, 3],
    allowedPrimaryAttrs: ['int', 'all'],
    statsByTier: {
      1: '+1 Mana Regen',
      2: '+2 Mana Regen, +10% Magic Res',
      3: '+3 Mana Regen, +16% Magic Res',
    },
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['spell_core', 'save_support', 'lane_support', 'tempo_mid'],
    counters: [
      { tag: 'heavy_magic_burst', score: 10, reason: '10–16% magic resistance blunts heavy spell burst' },
    ],
    baseScore: 19,
    defaultReason: 'Mana regeneration and scaling magic resistance for INT/Universal heroes',
  },

  // ================= MID-TIER (T2–T3) =================
  {
    key: 'enhancement_crude',
    fallbackName: 'Crude',
    tiers: [2, 3],
    allowedPrimaryAttrs: ['str'],
    statsByTier: {
      2: '+10% Heal Amp, -7% BAT',
      3: '+15% Heal Amp, -12% BAT',
    },
    tradeoff: '-15% Intelligence',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'initiator_offlaner', 'aura_offlaner'],
    baseScore: 20,
    defaultReason: 'Faster Base Attack Time & lifesteal/heal amp for Strength brawlers',
  },
  {
    key: 'enhancement_nimble',
    fallbackName: 'Nimble',
    tiers: [2, 3],
    allowedPrimaryAttrs: ['agi'],
    statsByTier: {
      2: '+6% Movement Speed, +12 Damage',
      3: '+8% Movement Speed, +18 Damage',
    },
    tradeoff: '-2 / -3 HP Regen',
    validPositions: [1, 2, 3, 4],
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'kiting_required', score: 9, reason: '% Movement speed + attack damage helps kite and chase' },
    ],
    baseScore: 21,
    defaultReason: 'High-value % movement speed and raw attack damage for Agility heroes',
  },
  {
    key: 'enhancement_keen_eyed',
    fallbackName: 'Keen-eyed',
    tiers: [2, 3],
    allowedPrimaryAttrs: ['int'],
    statsByTier: {
      2: '+125 Cast Range, +1 Mana Regen',
      3: '+135 Cast Range, +1.5 Mana Regen',
    },
    tradeoff: '-15% Max Mana',
    validPositions: [4, 5, 2, 3],
    preferredArchetypes: ['save_support', 'lane_support', 'roaming_support', 'spell_core'],
    counters: [
      { tag: 'aoe_teamfight_save', score: 9, reason: 'Cast saves and disables safely outside enemy AoE ultimates' },
      { tag: 'kiting_required', score: 7, reason: '+125/135 cast range keeps casters out of melee reach' },
    ],
    baseScore: 21,
    defaultReason: 'Premium bonus cast range for INT supports and spellcasters',
  },
  {
    key: 'enhancement_titanic',
    fallbackName: 'Titanic',
    tiers: [2, 3],
    allowedPrimaryAttrs: ['all'],
    statsByTier: {
      2: '+10% Base Damage, +11% Status Res',
      3: '+15% Base Damage, +13% Status Res',
    },
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['right_click_carry', 'tempo_mid', 'initiator_offlaner', 'aura_offlaner'],
    counters: [
      { tag: 'heavy_disable_stun', score: 11, reason: 'Status resistance shortens enemy stun chains' },
      { tag: 'silence_root_debuff', score: 8, reason: 'Reduces silence and root durations on Universal cores' },
    ],
    baseScore: 21,
    defaultReason: 'Status resistance plus % base attack damage for Universal heroes',
  },
  {
    key: 'enhancement_greedy',
    fallbackName: 'Greedy',
    tiers: [3],
    allowedPrimaryAttrs: ALL_ATTRS,
    statsByTier: {
      3: '+80 GPM, +200 Mana',
    },
    tradeoff: '-70 Attack Damage',
    validPositions: [4, 5, 3],
    preferredArchetypes: ['save_support', 'lane_support', 'roaming_support', 'spell_core'],
    turboPenalty: 4,
    baseScore: 18,
    defaultReason: 'Accelerates support luxury items when your hero does not rely on right-clicks',
  },

  // ================= LATE-GAME TIER 4 (50:00 / 25:00 Turbo) =================
  {
    key: 'enhancement_evolved',
    fallbackName: 'Evolved',
    tiers: [4],
    allowedPrimaryAttrs: ALL_ATTRS,
    statsByTier: {
      4: '+20 Primary Attr (+12 All), +20% Item Potency',
    },
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid', 'spell_core'],
    baseScore: 22,
    defaultReason: 'Primary attribute boost plus +20% Item Potency on late-game procs',
  },
  {
    key: 'enhancement_fleetfooted',
    fallbackName: 'Fleetfooted',
    tiers: [4],
    allowedPrimaryAttrs: ALL_ATTRS,
    statsByTier: {
      4: '+115 Movement Speed',
    },
    validPositions: ALL_POSITIONS,
    preferredArchetypes: ['right_click_carry', 'save_support', 'lane_support', 'roaming_support'],
    counters: [
      { tag: 'kiting_required', score: 10, reason: '+115 MS lets six-slotted carries replace boots or avoid kiting' },
      { tag: 'gap_close_needed', score: 7, reason: 'Massive speed lets heroes close gaps or reposition rapidly' },
    ],
    baseScore: 21,
    defaultReason: 'Enormous +115 movement speed (can even free up your Boots slot)',
  },
  {
    key: 'enhancement_timeless',
    fallbackName: 'Timeless',
    tiers: [4],
    allowedPrimaryAttrs: ALL_ATTRS,
    statsByTier: {
      4: '+15% Debuff Amp, +20% Spell Amp',
    },
    validPositions: [2, 3, 4, 5],
    preferredArchetypes: ['spell_core', 'lane_support', 'roaming_support', 'initiator_offlaner'],
    counters: [
      { tag: 'high_armor', score: 8, reason: '+20% spell amp scales magic damage past late armor' },
      { tag: 'elusive_mobile', score: 7, reason: '+15% debuff amp extends lockdown stun/hex durations' },
    ],
    baseScore: 21,
    defaultReason: 'Top-tier spell amplification and longer disables for casters',
  },
  {
    key: 'enhancement_vampiric',
    fallbackName: 'Vampiric',
    tiers: [4],
    allowedPrimaryAttrs: ALL_ATTRS,
    statsByTier: {
      4: '+20% Lifesteal, +16% Spell Lifesteal',
    },
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'spell_core', 'tempo_mid', 'aura_offlaner'],
    counters: [
      { tag: 'heavy_physical_burst', score: 7, reason: 'Sustains HP through prolonged late-game brawls' },
      { tag: 'heavy_magic_burst', score: 7, reason: 'Dual lifesteal keeps cores topped off after burst exchanges' },
    ],
    baseScore: 20,
    defaultReason: 'High attack and spell lifesteal for sustained late-game fighting',
  },
  {
    key: 'enhancement_hulking',
    fallbackName: 'Hulking',
    tiers: [4],
    allowedPrimaryAttrs: ['str'],
    statsByTier: {
      4: '+5% Max HP, +1.5% Max HP Regen',
    },
    tradeoff: '-Attack Speed',
    validPositions: [3, 4, 2, 1],
    preferredArchetypes: ['aura_offlaner', 'initiator_offlaner', 'spell_core'],
    counters: [
      { tag: 'heavy_magic_burst', score: 8, reason: 'Scales max HP pool and % regeneration for Strength tanks' },
      { tag: 'heavy_physical_burst', score: 8, reason: 'Massive effective HP recovery during late sieges' },
    ],
    baseScore: 20,
    defaultReason: 'Strong % max HP and regen for tanky Strength frontliners',
  },
  {
    key: 'enhancement_audacious',
    fallbackName: 'Audacious',
    tiers: [4],
    allowedPrimaryAttrs: ['agi'],
    statsByTier: {
      4: '+Attack Speed, +Magic Attack Damage',
    },
    tradeoff: '+Incoming Damage Taken',
    validPositions: [1, 2, 3],
    preferredArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'high_armor', score: 9, reason: 'Bonus magic attack damage + AS shreds high-armor foes' },
    ],
    baseScore: 20,
    defaultReason: 'Glass-cannon DPS steroid for backline/safe Agility carries',
  },
  {
    key: 'enhancement_feverish',
    fallbackName: 'Feverish',
    tiers: [4],
    allowedPrimaryAttrs: ['int'],
    statsByTier: {
      4: '+15% Cooldown Reduction',
    },
    tradeoff: '+10% Mana Cost',
    validPositions: [2, 3, 4, 5],
    preferredArchetypes: ['spell_core', 'save_support', 'lane_support', 'tempo_mid'],
    baseScore: 22,
    defaultReason: '15% cooldown reduction accelerates spells, hexes, and saves',
  },
  {
    key: 'enhancement_manic',
    fallbackName: 'Manic',
    tiers: [4],
    allowedPrimaryAttrs: ['all'],
    statsByTier: {
      4: 'Faster Cast Speed & Lower BAT',
    },
    tradeoff: '-Vision',
    validPositions: [1, 2, 3, 4],
    preferredArchetypes: ['tempo_mid', 'right_click_carry', 'spell_core', 'initiator_offlaner'],
    baseScore: 20,
    defaultReason: 'Snappier cast animations and faster attacks for Universal heroes',
  },
];

export const NEUTRAL_ARTIFACTS: NeutralArtifactCatalogEntry[] = ARTIFACT_BLUEPRINTS.map((bp) => {
  const snap = snapshot.items[bp.key];
  return {
    key: bp.key,
    name: snap?.dname ?? bp.fallbackName,
    img: snap?.img ?? `/apps/dota2/images/dota_react/items/${bp.key}.png`,
    tier: bp.tier,
    pool: bp.pool,
    summary: bp.summary,
    validPositions: bp.validPositions,
    preferredArchetypes: bp.preferredArchetypes,
    attackTypeFilter: bp.attackTypeFilter,
    counters: bp.counters,
    turboBonus: bp.turboBonus,
    turboPenalty: bp.turboPenalty,
    baseScore: bp.baseScore,
    defaultReason: bp.defaultReason,
  };
});

export const NEUTRAL_ENCHANTMENTS: NeutralEnchantmentCatalogEntry[] = ENCHANTMENT_BLUEPRINTS.map((bp) => {
  const snap = snapshot.items[bp.key];
  return {
    key: bp.key,
    name: snap?.dname ?? bp.fallbackName,
    img: snap?.img ?? `/apps/dota2/images/dota_react/items/${bp.key}.png`,
    tiers: bp.tiers,
    allowedPrimaryAttrs: bp.allowedPrimaryAttrs,
    statsByTier: bp.statsByTier,
    tradeoff: bp.tradeoff,
    validPositions: bp.validPositions,
    preferredArchetypes: bp.preferredArchetypes,
    counters: bp.counters,
    turboBonus: bp.turboBonus,
    turboPenalty: bp.turboPenalty,
    baseScore: bp.baseScore,
    defaultReason: bp.defaultReason,
  };
});
