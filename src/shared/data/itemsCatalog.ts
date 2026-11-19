import snapshotJson from './opendota-snapshot.json';
import type {
  AttackType,
  HeroArchetype,
  ItemCatalogEntry,
  ItemCounterRule,
  ItemStage,
  OpenDotaSnapshot,
  Position,
  ThreatTag,
} from '../types';

const snapshot = snapshotJson as OpenDotaSnapshot;

export const THREAT_LABELS: Record<ThreatTag, string> = {
  evasion: 'Evasion & Miss Chance',
  strong_passive: 'Strong Hero Passives',
  heavy_heal_regen: 'Heavy Healing & Regen',
  heavy_magic_burst: 'Heavy Magic Burst',
  heavy_disable_stun: 'Chain Stuns & Disables',
  single_target_ult: 'Single-Target Pickoff Ults',
  silence_root_debuff: 'Silences, Roots & Debuffs',
  elusive_mobile: 'Hyper-Mobile / Elusive Heroes',
  invisibility: 'Invisibility & Glimmer',
  illusions_summons: 'Illusions & Summoned Units',
  heavy_physical_burst: 'Heavy Physical Burst',
  high_armor: 'High Physical Armor',
  high_hp_tank: 'High HP / Tanky Frontline',
  defensive_buffs_saves: 'Saves, Ghost & Defensive Buffs',
  channeled_spells: 'Channeled Spells & Ultimates',
  spell_spam_lane: 'Lane Spell Spam',
  kiting_required: 'Melee Brawler (Needs Kiting)',
  mana_dependent_shield: 'Mana-Dependent / Shield Core',
  gap_close_needed: 'Backline Sniper / Artillery',
  aoe_teamfight_save: 'Big AoE Teamfight / Traps',
};

interface ItemBlueprint {
  key: string;
  fallbackName: string;
  fallbackCost: number;
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

const ITEM_BLUEPRINTS: ItemBlueprint[] = [
  // Starting & Early Laning
  { key: 'tango', fallbackName: 'Tango', fallbackCost: 90, stage: 'starting', validPositions: [1, 2, 3, 4, 5], turboNote: 'Optional in Turbo — instant courier regen' },
  { key: 'flask', fallbackName: 'Healing Salve', fallbackCost: 100, stage: 'starting', validPositions: [1, 2, 3, 4, 5] },
  { key: 'clarity', fallbackName: 'Clarity', fallbackCost: 60, stage: 'starting', validPositions: [2, 3, 4, 5] },
  { key: 'enchanted_mango', fallbackName: 'Enchanted Mango', fallbackCost: 65, stage: 'starting', validPositions: [1, 2, 3, 4, 5] },
  { key: 'faerie_fire', fallbackName: 'Faerie Fire', fallbackCost: 65, stage: 'starting', validPositions: [1, 2, 3] },
  { key: 'branches', fallbackName: 'Iron Branch', fallbackCost: 55, stage: 'starting', validPositions: [1, 2, 3, 4, 5] },
  { key: 'circlet', fallbackName: 'Circlet', fallbackCost: 155, stage: 'starting', validPositions: [1, 2, 3, 4, 5] },
  { key: 'gauntlets', fallbackName: 'Gauntlets of Strength', fallbackCost: 140, stage: 'starting', validPositions: [1, 2, 3, 4, 5] },
  { key: 'slippers', fallbackName: 'Slippers of Agility', fallbackCost: 140, stage: 'starting', validPositions: [1, 2] },
  { key: 'mantle', fallbackName: 'Mantle of Intelligence', fallbackCost: 140, stage: 'starting', validPositions: [2, 3, 4, 5] },
  { key: 'vanguard', fallbackName: 'Vanguard', fallbackCost: 1700, stage: 'early', validPositions: [3, 1] },
  { key: 'quelling_blade', fallbackName: 'Quelling Blade', fallbackCost: 100, stage: 'starting', validPositions: [1, 2, 3], attackTypeFilter: 'Melee' },
  { key: 'blood_grenade', fallbackName: 'Blood Grenade', fallbackCost: 50, stage: 'starting', validPositions: [3, 4, 5] },
  { key: 'ward_sentry', fallbackName: 'Sentry Ward', fallbackCost: 50, stage: 'starting', validPositions: [4, 5, 3], counters: [{ tag: 'invisibility', score: 9, reason: 'Blocks invis initiations & reveals lane ganks' }] },
  { key: 'dust', fallbackName: 'Dust of Appearance', fallbackCost: 80, stage: 'early', validPositions: [1, 2, 3, 4, 5], counters: [{ tag: 'invisibility', score: 11, reason: 'Essential kill confirm vs invisible enemies' }] },
  { key: 'magic_stick', fallbackName: 'Magic Stick', fallbackCost: 200, stage: 'starting', validPositions: [1, 2, 3, 4, 5], counters: [{ tag: 'spell_spam_lane', score: 10, reason: 'Converts enemy lane spell spam into burst HP/mana' }] },
  { key: 'magic_wand', fallbackName: 'Magic Wand', fallbackCost: 460, stage: 'early', validPositions: [1, 2, 3, 4, 5], counters: [{ tag: 'spell_spam_lane', score: 11, reason: 'High-value wand charges vs constant spell casters' }] },
  { key: 'infused_raindrop', fallbackName: 'Infused Raindrops', fallbackCost: 225, stage: 'early', validPositions: [1, 2, 3, 4, 5], counters: [{ tag: 'heavy_magic_burst', score: 8, reason: 'Blocks early magic nukes and sustains mana' }] },
  { key: 'wraith_band', fallbackName: 'Wraith Band', fallbackCost: 505, stage: 'early', validPositions: [1, 2, 3], turboPenalty: 2, turboNote: 'Skip or build at most 1 in Turbo to speed up first core item' },
  { key: 'bracer', fallbackName: 'Bracer', fallbackCost: 505, stage: 'early', validPositions: [1, 2, 3, 4, 5], turboPenalty: 1 },
  { key: 'null_talisman', fallbackName: 'Null Talisman', fallbackCost: 505, stage: 'early', validPositions: [2, 3, 4, 5], turboPenalty: 1 },
  { key: 'soul_ring', fallbackName: 'Soul Ring', fallbackCost: 805, stage: 'early', validPositions: [2, 3] },
  { key: 'falcon_blade', fallbackName: 'Falcon Blade', fallbackCost: 1125, stage: 'early', validPositions: [1, 2, 3] },
  { key: 'orb_of_corrosion', fallbackName: 'Orb of Corrosion', fallbackCost: 880, stage: 'early', validPositions: [1, 2, 3, 4], counters: [{ tag: 'heavy_heal_regen', score: 5, reason: 'Early health-regen reduction and lane slow' }] },
  { key: 'blight_stone', fallbackName: 'Blight Stone', fallbackCost: 300, stage: 'starting', validPositions: [1, 2, 3, 4] },
  { key: 'wind_lace', fallbackName: 'Wind Lace', fallbackCost: 225, stage: 'starting', validPositions: [3, 4, 5] },
  { key: 'urn_of_shadows', fallbackName: 'Urn of Shadows', fallbackCost: 875, stage: 'early', validPositions: [3, 4, 5, 2] },
  { key: 'pavise', fallbackName: 'Pavise', fallbackCost: 1250, stage: 'early', validPositions: [4, 5, 3], counters: [{ tag: 'heavy_physical_burst', score: 7, reason: 'Physical shield barrier for early skirmishes' }] },

  // Boots
  { key: 'boots', fallbackName: 'Boots of Speed', fallbackCost: 500, stage: 'early', validPositions: [1, 2, 3, 4, 5] },
  { key: 'power_treads', fallbackName: 'Power Treads', fallbackCost: 1400, stage: 'early', validPositions: [1, 2, 3] },
  { key: 'phase_boots', fallbackName: 'Phase Boots', fallbackCost: 1450, stage: 'early', validPositions: [1, 2, 3, 4] },
  { key: 'arcane_boots', fallbackName: 'Arcane Boots', fallbackCost: 1500, stage: 'early', validPositions: [2, 3, 4, 5] },
  { key: 'tranquil_boots', fallbackName: 'Tranquil Boots', fallbackCost: 900, stage: 'early', validPositions: [4, 5, 3] },
  { key: 'travel_boots', fallbackName: 'Boots of Travel', fallbackCost: 2500, stage: 'core', validPositions: [1, 2, 3], turboBonus: 5, turboNote: 'High value in Turbo for nonstop map pressure and defends' },
  { key: 'boots_of_bearing', fallbackName: 'Boots of Bearing', fallbackCost: 4225, stage: 'late', validPositions: [3, 4, 5], counters: [{ tag: 'kiting_required', score: 8, reason: 'Teamwide unslowable haste vs heavy slows/kiting' }] },
  {
    key: 'guardian_greaves',
    fallbackName: 'Guardian Greaves',
    fallbackCost: 4350,
    stage: 'counter',
    validPositions: [3, 4, 5],
    teamUnique: true,
    teamCarrierPriority: [3, 5, 4],
    counters: [
      { tag: 'silence_root_debuff', score: 10, reason: 'Self-dispel + AoE team sustain burst' },
      { tag: 'aoe_teamfight_save', score: 9, reason: 'Stabilizes team HP and armor after big AoE ultimates' },
    ],
  },

  // Farming & Core Progression
  {
    key: 'hand_of_midas',
    fallbackName: 'Hand of Midas',
    fallbackCost: 2200,
    stage: 'early',
    validPositions: [1, 2, 3],
    turboPenalty: 15,
    turboNote: 'Avoid in Turbo unless ultra-behind — Turbo already doubles XP/gold and punishes greedy Midas timings',
  },
  {
    key: 'bfury',
    fallbackName: 'Battle Fury',
    fallbackCost: 3900,
    stage: 'core',
    validPositions: [1],
    attackTypeFilter: 'Melee',
    counters: [{ tag: 'illusions_summons', score: 9, reason: 'Cleave clears illusions and summons reliably' }],
    turboNote: 'Strong cleave vs illusions; fight earlier once finished in Turbo',
  },
  {
    key: 'maelstrom',
    fallbackName: 'Maelstrom',
    fallbackCost: 2950,
    stage: 'core',
    validPositions: [1, 2, 3],
    counters: [
      { tag: 'illusions_summons', score: 10, reason: 'Chain lightning melts illusions and summons' },
      { tag: 'high_armor', score: 7, reason: 'Magic procs bypass high physical armor' },
    ],
  },
  {
    key: 'mjollnir',
    fallbackName: 'Mjollnir',
    fallbackCost: 5500,
    stage: 'counter',
    validPositions: [1, 2, 3],
    validArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'illusions_summons', score: 15, reason: 'Chain lightning + Static Charge punishes illusion/summon spam' },
      { tag: 'high_armor', score: 10, reason: 'Magic lightning damage ignores heavy physical armor' },
    ],
  },
  {
    key: 'gungir',
    fallbackName: 'Gleipnir',
    fallbackCost: 4650,
    stage: 'counter',
    validPositions: [1, 2, 3, 4],
    counters: [
      { tag: 'elusive_mobile', score: 13, reason: 'AoE ground-targeted root catches blinking/mobile heroes' },
      { tag: 'illusions_summons', score: 9, reason: 'AoE root reveals & lightning clears illusions' },
    ],
  },
  {
    key: 'radiance',
    fallbackName: 'Radiance',
    fallbackCost: 4700,
    stage: 'core',
    validPositions: [1, 2, 3],
    counters: [
      { tag: 'illusions_summons', score: 12, reason: 'Burn clears illusions & miss aura weakens right-clicks' },
      { tag: 'heavy_physical_burst', score: 7, reason: 'Blind aura reduces enemy attack accuracy' },
    ],
  },
  { key: 'echo_sabre', fallbackName: 'Echo Sabre', fallbackCost: 2700, stage: 'core', validPositions: [1, 2, 3], attackTypeFilter: 'Melee' },
  {
    key: 'harpoon',
    fallbackName: 'Harpoon',
    fallbackCost: 4700,
    stage: 'counter',
    validPositions: [1, 2, 3],
    attackTypeFilter: 'Melee',
    counters: [
      { tag: 'gap_close_needed', score: 12, reason: 'Pulls backline ranged targets right into melee range' },
      { tag: 'kiting_required', score: 8, reason: 'Breaks kiting against elusive ranged cores' },
    ],
  },
  { key: 'mask_of_madness', fallbackName: 'Mask of Madness', fallbackCost: 1800, stage: 'early', validPositions: [1, 2] },
  { key: 'helm_of_the_dominator', fallbackName: 'Helm of the Dominator', fallbackCost: 2550, stage: 'core', validPositions: [3, 1] },
  { key: 'armlet', fallbackName: 'Armlet of Mordiggian', fallbackCost: 2500, stage: 'core', validPositions: [1, 2, 3] },
  { key: 'desolator', fallbackName: 'Desolator', fallbackCost: 3500, stage: 'core', validPositions: [1, 2, 3] },
  { key: 'dragon_lance', fallbackName: 'Dragon Lance', fallbackCost: 2000, stage: 'core', validPositions: [1, 2, 3], attackTypeFilter: 'Ranged' },
  {
    key: 'hurricane_pike',
    fallbackName: 'Hurricane Pike',
    fallbackCost: 4550,
    stage: 'counter',
    validPositions: [1, 2, 3],
    attackTypeFilter: 'Ranged',
    counters: [
      { tag: 'kiting_required', score: 13, reason: 'Creates instant distance from melee gap-closers & trapped areas' },
      { tag: 'single_target_ult', score: 7, reason: 'Escape tool against melee blink initiators' },
    ],
  },
  { key: 'kaya', fallbackName: 'Kaya', fallbackCost: 2000, stage: 'early', validPositions: [2, 3, 1, 4] },
  { key: 'yasha', fallbackName: 'Yasha', fallbackCost: 2000, stage: 'early', validPositions: [1, 2] },
  { key: 'sange', fallbackName: 'Sange', fallbackCost: 2000, stage: 'early', validPositions: [1, 2, 3] },
  {
    key: 'sange_and_yasha',
    fallbackName: 'Sange and Yasha',
    fallbackCost: 4000,
    stage: 'counter',
    validPositions: [1, 2, 3],
    counters: [
      { tag: 'heavy_disable_stun', score: 9, reason: 'Slow resistance + tankiness vs stun-heavy drafts' },
      { tag: 'kiting_required', score: 7, reason: 'Movement speed + slow resist helps stay on targets' },
    ],
  },
  { key: 'kaya_and_sange', fallbackName: 'Kaya and Sange', fallbackCost: 4000, stage: 'core', validPositions: [2, 3, 1] },
  { key: 'yasha_and_kaya', fallbackName: 'Yasha and Kaya', fallbackCost: 4000, stage: 'core', validPositions: [2, 1] },
  {
    key: 'manta',
    fallbackName: 'Manta Style',
    fallbackCost: 4550,
    stage: 'counter',
    validPositions: [1, 2],
    validArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'silence_root_debuff', score: 15, reason: 'Basic dispel removes silences, roots, and Vessel/Track' },
      { tag: 'single_target_ult', score: 8, reason: 'Manta dodge & illusion confusion vs single-target spells' },
    ],
  },
  {
    key: 'diffusal_blade',
    fallbackName: 'Diffusal Blade',
    fallbackCost: 2500,
    stage: 'counter',
    validPositions: [1, 2, 3],
    validArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'mana_dependent_shield', score: 13, reason: 'Burns mana rapidly vs Medusa Mana Shield & mana-hungry cores' },
      { tag: 'kiting_required', score: 7, reason: 'Inhibit slow secures early chase kills' },
    ],
  },
  {
    key: 'disperser',
    fallbackName: 'Disperser',
    fallbackCost: 6100,
    stage: 'counter',
    validPositions: [1, 2],
    validArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'silence_root_debuff', score: 14, reason: 'Dispel + unslowable haste escapes roots and slows' },
      { tag: 'mana_dependent_shield', score: 14, reason: 'High-scaling mana burn shreds Mana Shield & low-mana tanks' },
      { tag: 'kiting_required', score: 11, reason: 'Haste + dispel prevents being kited in fights' },
    ],
  },
  { key: 'witch_blade', fallbackName: 'Witch Blade', fallbackCost: 2775, stage: 'core', validPositions: [2, 3, 1] },
  {
    key: 'devastator',
    fallbackName: 'Parasma',
    fallbackCost: 5975,
    stage: 'counter',
    validPositions: [2, 1, 3],
    validArchetypes: ['spell_core', 'tempo_mid', 'right_click_carry'],
    counters: [
      { tag: 'high_armor', score: 11, reason: 'True Strike + magic resistance reduction shreds armored heroes' },
      { tag: 'evasion', score: 8, reason: 'Magic procs pierce physical evasion' },
    ],
  },
  { key: 'phylactery', fallbackName: 'Phylactery', fallbackCost: 2600, stage: 'core', validPositions: [2, 3, 4] },
  { key: 'angels_demise', fallbackName: 'Khanda', fallbackCost: 5600, stage: 'late', validPositions: [1, 2, 3] },
  { key: 'invis_sword', fallbackName: 'Shadow Blade', fallbackCost: 3250, stage: 'core', validPositions: [1, 2, 3] },

  // Defensive, Dispels & Team Auras
  {
    key: 'black_king_bar',
    fallbackName: 'Black King Bar',
    fallbackCost: 4050,
    stage: 'counter',
    validPositions: [1, 2, 3],
    counters: [
      { tag: 'heavy_magic_burst', score: 14, reason: '60% magic res + debuff immunity stops magic nukes' },
      { tag: 'heavy_disable_stun', score: 15, reason: 'Prevents chain stuns during crucial teamfight windows' },
      { tag: 'silence_root_debuff', score: 11, reason: 'Dispels & blocks silences, roots, and slows' },
      { tag: 'aoe_teamfight_save', score: 10, reason: 'Allows fighting through heavy AoE control spells' },
    ],
  },
  {
    key: 'sphere',
    fallbackName: "Linken's Sphere",
    fallbackCost: 4800,
    stage: 'counter',
    validPositions: [1, 2, 3],
    counters: [
      { tag: 'single_target_ult', score: 17, reason: 'Blocks lethal BKB-piercing single-target ultimates (Doom/Duel/Rupture/Lasso)' },
      { tag: 'elusive_mobile', score: 6, reason: 'Buys time to blink/escape before instant hex/stun' },
    ],
  },
  {
    key: 'lotus_orb',
    fallbackName: 'Lotus Orb',
    fallbackCost: 3850,
    stage: 'counter',
    validPositions: [3, 4, 5, 2],
    counters: [
      { tag: 'single_target_ult', score: 15, reason: 'Reflects & deters single-target initiation spells on your carry' },
      { tag: 'silence_root_debuff', score: 13, reason: 'Strong basic dispel on ally to cleanse silences/roots/Vessel' },
    ],
  },
  {
    key: 'pipe',
    fallbackName: 'Pipe of Insight',
    fallbackCost: 3725,
    stage: 'counter',
    validPositions: [3, 4, 2],
    teamUnique: true,
    teamCarrierPriority: [3, 4, 2],
    counters: [
      { tag: 'heavy_magic_burst', score: 17, reason: 'Teamwide magic barrier + magic resistance aura vs heavy nuke drafts' },
      { tag: 'aoe_teamfight_save', score: 9, reason: 'Absorbs AoE spell damage during teamfights & high-ground pushes' },
    ],
  },
  {
    key: 'crimson_guard',
    fallbackName: 'Crimson Guard',
    fallbackCost: 3725,
    stage: 'counter',
    validPositions: [3, 4],
    teamUnique: true,
    teamCarrierPriority: [3, 4],
    counters: [
      { tag: 'illusions_summons', score: 15, reason: 'Flat damage block negates swarm attacks from illusions & summons' },
      { tag: 'heavy_physical_burst', score: 11, reason: 'Protects team & towers from fast right-click physical burst' },
    ],
  },
  {
    key: 'eternal_shroud',
    fallbackName: 'Eternal Shroud',
    fallbackCost: 3900,
    stage: 'counter',
    validPositions: [3, 2, 1],
    validArchetypes: ['aura_offlaner', 'initiator_offlaner', 'spell_core', 'right_click_carry'],
    counters: [
      { tag: 'heavy_magic_burst', score: 13, reason: 'Self-stacking magic resistance + mana return vs magic damage' },
    ],
  },
  {
    key: 'mage_slayer',
    fallbackName: 'Mage Slayer',
    fallbackCost: 3100,
    stage: 'counter',
    validPositions: [1, 2, 3],
    validArchetypes: ['right_click_carry', 'tempo_mid', 'initiator_offlaner'],
    counters: [
      { tag: 'heavy_magic_burst', score: 12, reason: 'Reduces enemy outgoing spell damage by 40% on hit' },
    ],
  },
  {
    key: 'blade_mail',
    fallbackName: 'Blade Mail',
    fallbackCost: 2350,
    stage: 'counter',
    validPositions: [3, 2, 1],
    counters: [
      { tag: 'heavy_physical_burst', score: 11, reason: 'Punishes uncontrolled burst damage & glass-cannon right-clickers' },
      { tag: 'heavy_magic_burst', score: 9, reason: 'Reflects burst magic damage during frontliner engagements' },
    ],
  },
  {
    key: 'vladmir',
    fallbackName: "Vladmir's Offering",
    fallbackCost: 2200,
    stage: 'core',
    validPositions: [3, 4, 5],
    teamUnique: true,
    teamCarrierPriority: [3, 4, 5],
  },
  {
    key: 'spirit_vessel',
    fallbackName: 'Spirit Vessel',
    fallbackCost: 2725,
    stage: 'counter',
    validPositions: [4, 3, 2, 5],
    teamUnique: true,
    teamCarrierPriority: [4, 3, 2, 5],
    counters: [
      { tag: 'heavy_heal_regen', score: 18, reason: 'Cuts enemy HP regen/healing by 45% + deals % current HP damage' },
      { tag: 'high_hp_tank', score: 11, reason: '% HP burn melts high-strength frontliners' },
    ],
  },
  {
    key: 'shivas_guard',
    fallbackName: "Shiva's Guard",
    fallbackCost: 4500,
    stage: 'counter',
    validPositions: [3, 2],
    teamUnique: true,
    teamCarrierPriority: [3, 2],
    counters: [
      { tag: 'heavy_heal_regen', score: 14, reason: 'Aura cuts all nearby enemy healing/lifesteal by 25%' },
      { tag: 'illusions_summons', score: 13, reason: 'Arctic Blast + high armor clears & tanks illusions' },
      { tag: 'heavy_physical_burst', score: 12, reason: '+15 armor & attack speed slow blunt enemy right-clicks' },
    ],
  },
  {
    key: 'assault',
    fallbackName: 'Assault Cuirass',
    fallbackCost: 5125,
    stage: 'counter',
    validPositions: [1, 3, 2],
    teamUnique: true,
    teamCarrierPriority: [3, 1, 2],
    counters: [
      { tag: 'heavy_physical_burst', score: 11, reason: 'Teamwide +5 armor aura mitigates minus-armor & physical burst' },
      { tag: 'high_armor', score: 10, reason: '-5 armor aura helps your physical cores shred tanky targets' },
    ],
  },

  // Support Saves & Positioning
  {
    key: 'force_staff',
    fallbackName: 'Force Staff',
    fallbackCost: 2200,
    stage: 'counter',
    validPositions: [4, 5, 3, 2],
    counters: [
      { tag: 'kiting_required', score: 12, reason: 'Pushes allies out of melee brawlers, Arena, Sprout, or Slark Pounce' },
      { tag: 'silence_root_debuff', score: 9, reason: 'Repositions rooted/trapped teammates immediately' },
      { tag: 'aoe_teamfight_save', score: 11, reason: 'Saves allies caught in Chrono, Black Hole, or Kinetic Field' },
      { tag: 'invisibility', score: 6, reason: 'Helps disengage from invis ambushes like Riki Smoke Screen' },
    ],
  },
  {
    key: 'glimmer_cape',
    fallbackName: 'Glimmer Cape',
    fallbackCost: 2150,
    stage: 'counter',
    validPositions: [4, 5, 3],
    counters: [
      { tag: 'heavy_magic_burst', score: 14, reason: 'Save barrier + 25% magic resistance rescues burst targets' },
      { tag: 'single_target_ult', score: 11, reason: 'Invis + barrier foils single-target follow-up damage' },
      { tag: 'aoe_teamfight_save', score: 9, reason: 'Protects focused allies inside teamfight ultimates' },
    ],
  },
  {
    key: 'ghost',
    fallbackName: 'Ghost Scepter',
    fallbackCost: 1500,
    stage: 'counter',
    validPositions: [4, 5, 2],
    counters: [
      { tag: 'heavy_physical_burst', score: 15, reason: '100% physical immunity vs physical dive carries (PA, Ursa, Clinkz)' },
      { tag: 'gap_close_needed', score: 5, reason: 'Survives dive while repositioning' },
    ],
  },
  {
    key: 'ethereal_blade',
    fallbackName: 'Ethereal Blade',
    fallbackCost: 5200,
    stage: 'counter',
    validPositions: [2, 4, 3, 5],
    counters: [
      { tag: 'heavy_physical_burst', score: 14, reason: 'Can ethereal-save teammates or disarm enemy physical carries' },
      { tag: 'single_target_ult', score: 11, reason: 'Saves Duel / Omnislash / Chrono targets from physical damage' },
    ],
  },
  {
    key: 'cyclone',
    fallbackName: "Eul's Scepter of Divinity",
    fallbackCost: 2600,
    stage: 'counter',
    validPositions: [2, 3, 4, 5],
    counters: [
      { tag: 'silence_root_debuff', score: 12, reason: 'Self-cyclone dispels silences & roots immediately' },
      { tag: 'channeled_spells', score: 13, reason: 'Instant ranged interrupt for channeled spells & TPs' },
      { tag: 'defensive_buffs_saves', score: 8, reason: 'Purges buffs like Ghost/Flame Guard/Windrun on enemy' },
      { tag: 'kiting_required', score: 8, reason: 'Buys 2.5s vs BKB-less melee threats (Troll/Ursa)' },
    ],
  },
  {
    key: 'wind_waker',
    fallbackName: 'Wind Waker',
    fallbackCost: 6800,
    stage: 'late',
    validPositions: [2, 3, 4, 5],
    counters: [
      { tag: 'aoe_teamfight_save', score: 15, reason: 'Can cyclone allies out of Chronosphere, Black Hole, or Duel' },
      { tag: 'single_target_ult', score: 13, reason: 'Premier late-game save for caught teammates' },
    ],
  },
  {
    key: 'aeon_disk',
    fallbackName: 'Aeon Disk',
    fallbackCost: 3000,
    stage: 'counter',
    validPositions: [4, 5, 3, 2],
    counters: [
      { tag: 'aoe_teamfight_save', score: 14, reason: 'Guarantees survival & strong dispel through Chrono/RP/Black Hole' },
      { tag: 'heavy_physical_burst', score: 10, reason: 'Stops instant blink-crit 100-to-0 assassinations' },
      { tag: 'heavy_magic_burst', score: 9, reason: 'Prevents instant hex-burst deletions' },
    ],
  },
  { key: 'aether_lens', fallbackName: 'Aether Lens', fallbackCost: 2100, stage: 'core', validPositions: [4, 5, 2] },
  {
    key: 'solar_crest',
    fallbackName: 'Solar Crest',
    fallbackCost: 2575,
    stage: 'counter',
    validPositions: [4, 5, 3],
    counters: [
      { tag: 'heavy_physical_burst', score: 11, reason: 'Grants ally barrier + armor + attack speed' },
      { tag: 'single_target_ult', score: 8, reason: 'Absorbs burst damage on targeted core' },
    ],
  },
  { key: 'mekansm', fallbackName: 'Mekansm', fallbackCost: 1775, stage: 'core', validPositions: [3, 4, 5] },
  { key: 'holy_locket', fallbackName: 'Holy Locket', fallbackCost: 2250, stage: 'core', validPositions: [4, 5] },
  {
    key: 'gem',
    fallbackName: 'Gem of True Sight',
    fallbackCost: 900,
    stage: 'counter',
    validPositions: [3, 4, 5, 1, 2],
    teamUnique: true,
    teamCarrierPriority: [3, 4, 5, 1, 2],
    counters: [{ tag: 'invisibility', score: 16, reason: 'Mandatory true sight once enemy invis cores scale' }],
  },

  // Offensive & Disable Counters
  {
    key: 'silver_edge',
    fallbackName: 'Silver Edge',
    fallbackCost: 5700,
    stage: 'counter',
    validPositions: [1, 2, 3],
    validArchetypes: ['right_click_carry', 'tempo_mid', 'initiator_offlaner'],
    counters: [
      { tag: 'strong_passive', score: 18, reason: 'Break disables lethal passives (Bristleback, Blur, Dispersion, Untouchable)' },
      { tag: 'evasion', score: 9, reason: 'Breaks passive evasion like PA Blur & Butterfly-less dodge' },
      { tag: 'gap_close_needed', score: 6, reason: 'Invis flank onto backline targets' },
    ],
  },
  {
    key: 'monkey_king_bar',
    fallbackName: 'Monkey King Bar',
    fallbackCost: 5000,
    stage: 'counter',
    validPositions: [1, 2, 3],
    validArchetypes: ['right_click_carry', 'tempo_mid', 'illusion_carry'],
    counters: [
      { tag: 'evasion', score: 18, reason: '80% Pierce through evasion, Butterfly, and miss debuffs' },
      { tag: 'high_armor', score: 8, reason: 'Bonus magical proc damage cuts through high armor' },
    ],
  },
  {
    key: 'bloodthorn',
    fallbackName: 'Bloodthorn',
    fallbackCost: 6250,
    stage: 'counter',
    validPositions: [1, 2, 3],
    counters: [
      { tag: 'evasion', score: 14, reason: 'Soul Rend grants True Strike for all allied hits on target' },
      { tag: 'elusive_mobile', score: 14, reason: 'Instant silence locks down mobile/spell-reliant heroes' },
    ],
  },
  {
    key: 'orchid',
    fallbackName: 'Orchid Malevolence',
    fallbackCost: 3275,
    stage: 'counter',
    validPositions: [2, 1, 3, 4],
    counters: [
      { tag: 'elusive_mobile', score: 14, reason: 'Fast silence stops Puck, Ember, Storm, AM, and Void Spirit' },
      { tag: 'channeled_spells', score: 7, reason: 'Silences casters before spells start' },
    ],
  },
  {
    key: 'rod_of_atos',
    fallbackName: 'Rod of Atos',
    fallbackCost: 2250,
    stage: 'counter',
    validPositions: [3, 4, 2, 5],
    counters: [
      { tag: 'elusive_mobile', score: 12, reason: 'Long-range root disables mobility spells (Blink/Ball/Sleight)' },
    ],
  },
  {
    key: 'sheepstick',
    fallbackName: 'Scythe of Vyse',
    fallbackCost: 5200,
    stage: 'counter',
    validPositions: [2, 3, 4, 1],
    counters: [
      { tag: 'elusive_mobile', score: 15, reason: 'Instant 0-cast-point Hex stops BKB & blink escapes' },
      { tag: 'heavy_disable_stun', score: 7, reason: 'Lockdown threat against priority enemy core' },
      { tag: 'channeled_spells', score: 10, reason: 'Instant reliable interrupt' },
    ],
  },
  {
    key: 'nullifier',
    fallbackName: 'Nullifier',
    fallbackCost: 4350,
    stage: 'counter',
    validPositions: [1, 2, 3],
    validArchetypes: ['right_click_carry', 'tempo_mid', 'initiator_offlaner'],
    counters: [
      { tag: 'defensive_buffs_saves', score: 18, reason: 'Continuously purges Ghost Scepter, Glimmer, Force, Eul, & Windrun' },
      { tag: 'kiting_required', score: 7, reason: 'Stops defensive kiting items' },
    ],
  },
  {
    key: 'skadi',
    fallbackName: 'Eye of Skadi',
    fallbackCost: 5900,
    stage: 'counter',
    validPositions: [1, 2],
    validArchetypes: ['right_click_carry', 'illusion_carry', 'tempo_mid'],
    counters: [
      { tag: 'heavy_heal_regen', score: 15, reason: 'Pierces BKB to reduce enemy lifesteal and HP regeneration by 40%' },
      { tag: 'kiting_required', score: 11, reason: 'BKB-piercing attack & movement slow kites melee cores' },
    ],
  },
  {
    key: 'heavens_halberd',
    fallbackName: "Heaven's Halberd",
    fallbackCost: 2400,
    stage: 'counter',
    validPositions: [3, 4, 2],
    counters: [
      { tag: 'heavy_physical_burst', score: 12, reason: 'Disarms enemy physical carry for 3–5 seconds' },
      { tag: 'single_target_ult', score: 7, reason: 'Disarms Ursa/Troll/Huskar during key engagements' },
    ],
  },
  {
    key: 'blink',
    fallbackName: 'Blink Dagger',
    fallbackCost: 2250,
    stage: 'counter',
    validPositions: [2, 3, 4, 1],
    counters: [
      { tag: 'gap_close_needed', score: 14, reason: 'Instant jump onto backline artillery (Sniper, Drow, Zeus)' },
      { tag: 'channeled_spells', score: 8, reason: 'Lets initiators reach backline channelers immediately' },
    ],
  },
  { key: 'overwhelming_blink', fallbackName: 'Overwhelming Blink', fallbackCost: 6800, stage: 'late', validPositions: [3, 2, 1] },
  { key: 'swift_blink', fallbackName: 'Swift Blink', fallbackCost: 6800, stage: 'late', validPositions: [1, 2] },
  { key: 'arcane_blink', fallbackName: 'Arcane Blink', fallbackCost: 6800, stage: 'late', validPositions: [2, 3, 4] },
  { key: 'basher', fallbackName: 'Skull Basher', fallbackCost: 2875, stage: 'core', validPositions: [1, 2, 3], attackTypeFilter: 'Melee' },
  {
    key: 'abyssal_blade',
    fallbackName: 'Abyssal Blade',
    fallbackCost: 6150,
    stage: 'counter',
    validPositions: [1, 2, 3],
    attackTypeFilter: 'Melee',
    counters: [
      { tag: 'elusive_mobile', score: 12, reason: 'BKB-piercing stun locks down elusive cores' },
      { tag: 'channeled_spells', score: 12, reason: 'Pierces BKB to interrupt Black Hole / Death Ward / Freezing Field' },
    ],
  },
  { key: 'greater_crit', fallbackName: 'Daedalus', fallbackCost: 5200, stage: 'late', validPositions: [1, 2] },
  { key: 'butterfly', fallbackName: 'Butterfly', fallbackCost: 5000, stage: 'late', validPositions: [1, 2] },
  { key: 'satanic', fallbackName: 'Satanic', fallbackCost: 5050, stage: 'late', validPositions: [1, 2, 3] },
  { key: 'heart', fallbackName: 'Heart of Tarrasque', fallbackCost: 5300, stage: 'late', validPositions: [1, 3, 2] },
  { key: 'bloodstone', fallbackName: 'Bloodstone', fallbackCost: 4700, stage: 'core', validPositions: [2, 3] },
  { key: 'octarine_core', fallbackName: 'Octarine Core', fallbackCost: 5100, stage: 'late', validPositions: [2, 3, 4, 5] },
  { key: 'refresher', fallbackName: 'Refresher Orb', fallbackCost: 5000, stage: 'late', validPositions: [2, 3, 1] },
  { key: 'ultimate_scepter', fallbackName: "Aghanim's Scepter", fallbackCost: 4200, stage: 'core', validPositions: [1, 2, 3, 4, 5] },
  {
    key: 'ultimate_scepter_2',
    fallbackName: "Aghanim's Blessing",
    fallbackCost: 5800,
    stage: 'late',
    validPositions: [1, 2, 3, 4, 5],
    turboBonus: 5,
    turboNote: 'Consume Scepter in Turbo to free up a 6th luxury slot early',
  },
  {
    key: 'aghanims_shard',
    fallbackName: "Aghanim's Shard",
    fallbackCost: 1400,
    stage: 'core',
    validPositions: [1, 2, 3, 4, 5],
    turboBonus: 6,
    turboNote: 'Unlocks at 7:30 in Turbo — huge early power spike',
  },
  {
    key: 'moon_shard',
    fallbackName: 'Moon Shard',
    fallbackCost: 4000,
    stage: 'late',
    validPositions: [1, 2],
    turboBonus: 4,
    turboNote: 'Great 7th-slot consumable in fast Turbo late game',
  },
];

export const ITEMS_CATALOG: Record<string, ItemCatalogEntry> = Object.fromEntries(
  ITEM_BLUEPRINTS.map((bp) => {
    const snap = snapshot.items[bp.key];
    return [
      bp.key,
      {
        key: bp.key,
        name: snap?.dname ?? bp.fallbackName,
        cost: snap?.cost ?? bp.fallbackCost,
        img: snap?.img ?? `/apps/dota2/images/dota_react/items/${bp.key}.png`,
        stage: bp.stage,
        validPositions: bp.validPositions,
        validArchetypes: bp.validArchetypes,
        attackTypeFilter: bp.attackTypeFilter,
        teamUnique: bp.teamUnique,
        teamCarrierPriority: bp.teamCarrierPriority,
        counters: bp.counters,
        turboNote: bp.turboNote,
        turboPenalty: bp.turboPenalty,
        turboBonus: bp.turboBonus,
      },
    ];
  })
);

export function getItemEntry(key: string): ItemCatalogEntry {
  const existing = ITEMS_CATALOG[key];
  if (existing) return existing;
  const snap = snapshot.items[key];
  if (snap) {
    return {
      key,
      name: snap.dname,
      cost: snap.cost,
      img: snap.img,
      stage: 'core',
      validPositions: [1, 2, 3, 4, 5],
    };
  }
  return {
    key,
    name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    cost: 0,
    img: `/apps/dota2/images/dota_react/items/${key}.png`,
    stage: 'core',
    validPositions: [1, 2, 3, 4, 5],
  };
}
