import type { Faction, GameMode, GsiNormalizedState } from '../shared/types';

export function createInitialGsiState(): GsiNormalizedState {
  return {
    connected: false,
    lastUpdatedAt: null,
    clockTime: null,
    gameTime: null,
    gameState: null,
    paused: false,
    customGameName: null,
    detectedMode: null,
    faction: null,
    heroName: null,
    roshanState: null,
    roshanStateEndSeconds: null,
    roshanDiedAtClock: null,
    teamAllies: [],
    teamEnemies: [],
  };
}

export function generateGsiConfig(uriOrPort: string | number, token = 'dota2_helper_local'): string {
  const uri = typeof uriOrPort === 'number' ? `http://127.0.0.1:${uriOrPort}/api/gsi` : uriOrPort;
  return `"Dota 2 Team Helper GSI Configuration"
{
    "uri"           "${uri}"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.25"
    "heartbeat"     "15.0"
    "data"
    {
        "provider"      "1"
        "map"           "1"
        "player"        "1"
        "hero"          "1"
        "abilities"     "0"
        "items"         "1"
        "draft"         "1"
        "buildings"     "0"
        "roshan"        "1"
    }
    "auth"
    {
        "token"         "${token}"
    }
}
`;
}

export class GsiStateManager {
  private state: GsiNormalizedState = createInitialGsiState();
  private prevRoshanState: string | null = null;
  private readonly expectedToken?: string;

  constructor(expectedToken?: string) {
    this.expectedToken = expectedToken;
  }

  getState(): GsiNormalizedState {
    return { ...this.state };
  }

  reset(): GsiNormalizedState {
    this.prevRoshanState = null;
    this.state = createInitialGsiState();
    return this.getState();
  }

  ingest(raw: unknown): { ok: true; state: GsiNormalizedState } | { ok: false; error: string } {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'Invalid GSI JSON object' };
    }
    const payload = raw as Record<string, any>;

    if (this.expectedToken && payload.auth?.token !== this.expectedToken) {
      return { ok: false, error: 'Invalid GSI auth token' };
    }

    const map = payload.map ?? {};
    const player = payload.player ?? {};
    const hero = payload.hero ?? {};

    const clockTime = typeof map.clock_time === 'number' ? map.clock_time : this.state.clockTime;
    const gameTime = typeof map.game_time === 'number' ? map.game_time : this.state.gameTime;
    const gameState = typeof map.game_state === 'string' ? map.game_state : this.state.gameState;
    const paused = typeof map.paused === 'boolean' ? map.paused : this.state.paused;

    const customGameName =
      typeof map.customgamename === 'string' && map.customgamename.length > 0
        ? map.customgamename
        : this.state.customGameName;

    let detectedMode: GameMode | null = this.state.detectedMode;
    const modeHint = `${customGameName ?? ''} ${map.name ?? ''} ${map.game_mode ?? ''}`.toLowerCase();
    if (modeHint.includes('turbo')) {
      detectedMode = 'turbo';
    }

    let faction: Faction | null = this.state.faction;
    if (player.team_name === 'radiant' || player.team_name === 'dire') {
      faction = player.team_name;
    }

    const heroName =
      typeof hero.name === 'string' && hero.name.startsWith('npc_dota_hero_')
        ? hero.name
        : this.state.heroName;

    const roshanState =
      typeof map.roshan_state === 'string' ? map.roshan_state : this.state.roshanState;
    const roshanStateEndSeconds =
      typeof map.roshan_state_end_seconds === 'number'
        ? map.roshan_state_end_seconds
        : this.state.roshanStateEndSeconds;

    let roshanDiedAtClock = this.state.roshanDiedAtClock;
    if (roshanState) {
      if (this.prevRoshanState === 'alive' && roshanState !== 'alive') {
        roshanDiedAtClock = clockTime ?? 0;
      } else if (roshanState === 'alive') {
        roshanDiedAtClock = null;
      }
      this.prevRoshanState = roshanState;
    }

    // Spectator / Captain's Mode team roster extraction if available
    const radiantHeroes: string[] = [];
    const direHeroes: string[] = [];
    if (payload.hero?.team2 && typeof payload.hero.team2 === 'object') {
      for (const h of Object.values(payload.hero.team2) as any[]) {
        if (typeof h?.name === 'string' && h.name.startsWith('npc_dota_hero_')) {
          radiantHeroes.push(h.name);
        }
      }
    }
    if (payload.hero?.team3 && typeof payload.hero.team3 === 'object') {
      for (const h of Object.values(payload.hero.team3) as any[]) {
        if (typeof h?.name === 'string' && h.name.startsWith('npc_dota_hero_')) {
          direHeroes.push(h.name);
        }
      }
    }

    let teamAllies = this.state.teamAllies;
    let teamEnemies = this.state.teamEnemies;
    if (radiantHeroes.length > 0 || direHeroes.length > 0) {
      if (faction === 'dire') {
        teamAllies = direHeroes;
        teamEnemies = radiantHeroes;
      } else {
        teamAllies = radiantHeroes;
        teamEnemies = direHeroes;
      }
    }

    this.state = {
      connected: true,
      lastUpdatedAt: Date.now(),
      clockTime,
      gameTime,
      gameState,
      paused,
      customGameName,
      detectedMode,
      faction,
      heroName,
      roshanState,
      roshanStateEndSeconds,
      roshanDiedAtClock,
      teamAllies,
      teamEnemies,
    };

    return { ok: true, state: this.getState() };
  }
}
