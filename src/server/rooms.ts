import { randomInt } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { GsiStateManager } from './gsi';
import type {
  BossTrackerState,
  Faction,
  GameMode,
  GsiNormalizedState,
  Position,
  RoomAction,
  RoomActivityEntry,
  RoomClockState,
  RoomHeroClaim,
  RoomMember,
  RoomSnapshot,
} from '../shared/types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_ROOMS = 500;
const MAX_ACTIVITY = 12;

export function normalizeRoomCode(raw: string): string | null {
  const normalized = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(normalized)) return null;
  return normalized;
}

export function computeCurrentClock(clock: RoomClockState, nowMs = Date.now()): number {
  if (!clock.running) return clock.baseClockSeconds;
  const elapsed = Math.max(0, (nowMs - clock.updatedAtServerMs) / 1000);
  return clock.baseClockSeconds + elapsed;
}

interface InternalRoomState {
  code: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  faction: Faction;
  mode: GameMode;
  allies: number[];
  enemies: number[];
  lockedPositions: Partial<Record<Position, number>>;
  heroClaims: Record<number, RoomHeroClaim>;
  clock: RoomClockState;
  bossState: BossTrackerState;
  recentActivity: RoomActivityEntry[];
}

interface ClientPresence {
  clientId: string;
  playerName: string;
  joinedAt: number;
}

interface RoomEntry {
  state: InternalRoomState;
  gsiManager: GsiStateManager;
  clients: Map<ServerResponse, ClientPresence>;
}

export interface RoomSeed {
  faction?: Faction;
  mode?: GameMode;
  allies?: number[];
  enemies?: number[];
  lockedPositions?: Partial<Record<Position, number>>;
  clockSeconds?: number;
  initialClaim?: { heroId: number; clientId: string; playerName: string };
}

export interface RoomManagerOptions {
  gsiToken?: string;
  roomTtlMs?: number;
  maxRooms?: number;
  heroNameToId?: Map<string, number>;
  heroIdToName?: Map<number, string>;
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomEntry>();
  private readonly gsiToken?: string;
  private readonly roomTtlMs: number;
  private readonly maxRooms: number;
  private readonly heroNameToId: Map<string, number>;
  private readonly heroIdToName: Map<number, string>;
  private readonly keepAliveTimer: NodeJS.Timeout;

  constructor(options: RoomManagerOptions = {}) {
    this.gsiToken = options.gsiToken;
    this.roomTtlMs = options.roomTtlMs ?? DEFAULT_ROOM_TTL_MS;
    this.maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS;
    this.heroNameToId = options.heroNameToId ?? new Map();
    this.heroIdToName = options.heroIdToName ?? new Map();

    this.keepAliveTimer = setInterval(() => {
      for (const room of this.rooms.values()) {
        for (const client of room.clients.keys()) {
          if (!client.writableEnded) {
            client.write(': ping\n\n');
          }
        }
      }
    }, 15_000);
    this.keepAliveTimer.unref?.();
  }

  private generateUniqueCode(): string {
    for (let attempt = 0; attempt < 40; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Failed to generate unique room code');
  }

  private cleanPlayerName(raw: string, fallbackId: string): string {
    const trimmed = String(raw ?? '').trim().slice(0, 24);
    return trimmed || `Player-${fallbackId.slice(0, 4).toUpperCase()}`;
  }

  private getHeroLabel(heroId: number, fallback?: string): string {
    return fallback || this.heroIdToName.get(heroId) || `Hero #${heroId}`;
  }

  private pushActivity(state: InternalRoomState, text: string, nowMs: number) {
    state.recentActivity = [
      { id: `${nowMs}-${state.version}`, text, at: nowMs },
      ...state.recentActivity,
    ].slice(0, MAX_ACTIVITY);
  }

  private buildMembers(room: RoomEntry): RoomMember[] {
    const byClient = new Map<string, RoomMember>();
    for (const c of room.clients.values()) {
      const existing = byClient.get(c.clientId);
      if (!existing) {
        byClient.set(c.clientId, { ...c });
      } else {
        byClient.set(c.clientId, {
          clientId: c.clientId,
          playerName: c.playerName,
          joinedAt: Math.min(existing.joinedAt, c.joinedAt),
        });
      }
    }
    return Array.from(byClient.values()).sort((a, b) => a.joinedAt - b.joinedAt);
  }

  private toSnapshot(room: RoomEntry, nowMs = Date.now()): RoomSnapshot {
    const s = room.state;
    return {
      code: s.code,
      version: s.version,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      serverNowMs: nowMs,
      faction: s.faction,
      mode: s.mode,
      allies: [...s.allies],
      enemies: [...s.enemies],
      lockedPositions: { ...s.lockedPositions },
      heroClaims: { ...s.heroClaims },
      clock: { ...s.clock },
      bossState: { ...s.bossState },
      members: this.buildMembers(room),
      recentActivity: [...s.recentActivity],
    };
  }

  private broadcastRoom(room: RoomEntry) {
    const snap = this.toSnapshot(room);
    const frame = `event: room\ndata: ${JSON.stringify(snap)}\n\n`;
    for (const client of room.clients.keys()) {
      if (!client.writableEnded) {
        client.write(frame);
      }
    }
  }

  private broadcastGsi(room: RoomEntry, gsiState: GsiNormalizedState) {
    const frame = `event: gsi\ndata: ${JSON.stringify(gsiState)}\n\n`;
    for (const client of room.clients.keys()) {
      if (!client.writableEnded) {
        client.write(frame);
      }
    }
  }

  pruneExpiredRooms(nowMs = Date.now()): number {
    let removed = 0;
    for (const [code, room] of this.rooms.entries()) {
      if (room.clients.size === 0 && nowMs - room.state.updatedAt >= this.roomTtlMs) {
        this.rooms.delete(code);
        removed++;
      }
    }
    return removed;
  }

  createRoom(seed: RoomSeed = {}): RoomSnapshot {
    const now = Date.now();
    if (this.rooms.size >= this.maxRooms) {
      this.pruneExpiredRooms(now);
      // Evict oldest empty room if still over limit
      if (this.rooms.size >= this.maxRooms) {
        let oldestEmpty: { code: string; updatedAt: number } | null = null;
        for (const [c, r] of this.rooms.entries()) {
          if (r.clients.size === 0 && (!oldestEmpty || r.state.updatedAt < oldestEmpty.updatedAt)) {
            oldestEmpty = { code: c, updatedAt: r.state.updatedAt };
          }
        }
        if (oldestEmpty) this.rooms.delete(oldestEmpty.code);
      }
    }

    const code = this.generateUniqueCode();
    const allies = Array.from(
      new Set((seed.allies ?? []).filter((id) => Number.isInteger(id) && id > 0))
    ).slice(0, 5);
    const allySet = new Set(allies);
    const enemies = Array.from(
      new Set((seed.enemies ?? []).filter((id) => Number.isInteger(id) && id > 0 && !allySet.has(id)))
    ).slice(0, 5);

    const lockedPositions: Partial<Record<Position, number>> = {};
    if (seed.lockedPositions) {
      for (const pos of [1, 2, 3, 4, 5] as Position[]) {
        const heroId = seed.lockedPositions[pos];
        if (typeof heroId === 'number' && allySet.has(heroId)) {
          lockedPositions[pos] = heroId;
        }
      }
    }

    const heroClaims: Record<number, RoomHeroClaim> = {};
    if (seed.initialClaim && allySet.has(seed.initialClaim.heroId)) {
      heroClaims[seed.initialClaim.heroId] = {
        clientId: seed.initialClaim.clientId,
        playerName: this.cleanPlayerName(seed.initialClaim.playerName, seed.initialClaim.clientId),
      };
    }

    const state: InternalRoomState = {
      code,
      version: 1,
      createdAt: now,
      updatedAt: now,
      faction: seed.faction === 'dire' ? 'dire' : 'radiant',
      mode: seed.mode === 'turbo' ? 'turbo' : 'regular',
      allies,
      enemies,
      lockedPositions,
      heroClaims,
      clock: {
        baseClockSeconds: typeof seed.clockSeconds === 'number' ? seed.clockSeconds : -30,
        running: false,
        updatedAtServerMs: now,
      },
      bossState: {
        roshanKilledAt: null,
        tormentorKilledAt: null,
      },
      recentActivity: [{ id: `${now}-1`, text: `Room ${code} created`, at: now }],
    };

    const entry: RoomEntry = {
      state,
      gsiManager: new GsiStateManager(this.gsiToken),
      clients: new Map(),
    };
    this.rooms.set(code, entry);
    return this.toSnapshot(entry, now);
  }

  getSnapshot(rawCode: string): RoomSnapshot | null {
    const code = normalizeRoomCode(rawCode);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    return this.toSnapshot(room);
  }

  hasRoom(rawCode: string): boolean {
    const code = normalizeRoomCode(rawCode);
    return Boolean(code && this.rooms.has(code));
  }

  addClient(rawCode: string, res: ServerResponse, clientId: string, playerName: string): boolean {
    const code = normalizeRoomCode(rawCode);
    if (!code) return false;
    const room = this.rooms.get(code);
    if (!room) return false;

    const cleanName = this.cleanPlayerName(playerName, clientId);
    room.clients.set(res, {
      clientId,
      playerName: cleanName,
      joinedAt: Date.now(),
    });
    room.state.updatedAt = Date.now();

    // Sync any existing claims held by this client to their latest display name
    for (const claim of Object.values(room.state.heroClaims)) {
      if (claim.clientId === clientId) {
        claim.playerName = cleanName;
      }
    }

    // Send initial state + GSI snapshot to newly connected client, and notify room of updated presence
    if (!res.writableEnded) {
      res.write(`event: room\ndata: ${JSON.stringify(this.toSnapshot(room))}\n\n`);
      res.write(`event: gsi\ndata: ${JSON.stringify(room.gsiManager.getState())}\n\n`);
    }
    this.broadcastRoom(room);
    return true;
  }

  removeClient(rawCode: string, res: ServerResponse) {
    const code = normalizeRoomCode(rawCode);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.clients.delete(res)) {
      room.state.updatedAt = Date.now();
      this.broadcastRoom(room);
    }
  }

  updatePresence(rawCode: string, clientId: string, playerName: string): RoomSnapshot | null {
    const code = normalizeRoomCode(rawCode);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;

    const cleanName = this.cleanPlayerName(playerName, clientId);
    for (const presence of room.clients.values()) {
      if (presence.clientId === clientId) {
        presence.playerName = cleanName;
      }
    }
    for (const claim of Object.values(room.state.heroClaims)) {
      if (claim.clientId === clientId) {
        claim.playerName = cleanName;
      }
    }
    room.state.version++;
    room.state.updatedAt = Date.now();
    this.broadcastRoom(room);
    return this.toSnapshot(room);
  }

  applyAction(rawCode: string, action: RoomAction): RoomSnapshot | null {
    const code = normalizeRoomCode(rawCode);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;

    const s = room.state;
    const now = Date.now();
    const actor = this.cleanPlayerName(action.playerName, action.clientId);

    switch (action.type) {
      case 'ADD_HERO': {
        if (!Number.isInteger(action.heroId) || action.heroId <= 0) break;
        const heroName = this.getHeroLabel(action.heroId, action.heroName);
        if (action.side === 'ally') {
          if (s.allies.includes(action.heroId) || s.allies.length >= 5) break;
          s.allies = [...s.allies, action.heroId];
          s.enemies = s.enemies.filter((id) => id !== action.heroId);
          this.pushActivity(s, `${actor} picked ${heroName} for Your Team`, now);
        } else {
          if (s.enemies.includes(action.heroId) || s.enemies.length >= 5) break;
          s.enemies = [...s.enemies, action.heroId];
          if (s.allies.includes(action.heroId)) {
            s.allies = s.allies.filter((id) => id !== action.heroId);
            delete s.heroClaims[action.heroId];
            for (const p of [1, 2, 3, 4, 5] as Position[]) {
              if (s.lockedPositions[p] === action.heroId) delete s.lockedPositions[p];
            }
          }
          this.pushActivity(s, `${actor} picked ${heroName} for Opposing Team`, now);
        }
        break;
      }

      case 'REMOVE_HERO': {
        const heroName = this.getHeroLabel(action.heroId, action.heroName);
        if (action.side === 'ally') {
          s.allies = s.allies.filter((id) => id !== action.heroId);
          delete s.heroClaims[action.heroId];
          for (const p of [1, 2, 3, 4, 5] as Position[]) {
            if (s.lockedPositions[p] === action.heroId) delete s.lockedPositions[p];
          }
          this.pushActivity(s, `${actor} removed ${heroName}`, now);
        } else {
          s.enemies = s.enemies.filter((id) => id !== action.heroId);
          this.pushActivity(s, `${actor} removed ${heroName}`, now);
        }
        break;
      }

      case 'CLAIM_HERO': {
        for (const [hIdStr, claim] of Object.entries(s.heroClaims)) {
          if (claim.clientId === action.clientId) {
            delete s.heroClaims[Number(hIdStr)];
          }
        }
        if (action.heroId !== null && s.allies.includes(action.heroId)) {
          s.heroClaims[action.heroId] = {
            clientId: action.clientId,
            playerName: actor,
          };
          const heroName = this.getHeroLabel(action.heroId, action.heroName);
          this.pushActivity(s, `${actor} claimed ${heroName}`, now);
        }
        break;
      }

      case 'SET_FACTION': {
        s.faction = action.faction === 'dire' ? 'dire' : 'radiant';
        this.pushActivity(s, `${actor} switched side to ${s.faction.toUpperCase()}`, now);
        break;
      }

      case 'SET_MODE': {
        s.mode = action.mode === 'turbo' ? 'turbo' : 'regular';
        this.pushActivity(
          s,
          `${actor} switched mode to ${s.mode === 'turbo' ? 'Turbo' : 'Regular'}`,
          now
        );
        break;
      }

      case 'LOCK_POSITION': {
        if (![1, 2, 3, 4, 5].includes(action.pos)) break;
        if (action.heroId === null) {
          delete s.lockedPositions[action.pos];
        } else if (s.allies.includes(action.heroId)) {
          for (const p of [1, 2, 3, 4, 5] as Position[]) {
            if (s.lockedPositions[p] === action.heroId) delete s.lockedPositions[p];
          }
          s.lockedPositions[action.pos] = action.heroId;
          this.pushActivity(
            s,
            `${actor} locked ${this.getHeroLabel(action.heroId)} to Pos ${action.pos}`,
            now
          );
        }
        break;
      }

      case 'UNLOCK_ALL_POSITIONS': {
        s.lockedPositions = {};
        this.pushActivity(s, `${actor} unlocked all lane positions`, now);
        break;
      }

      case 'LOAD_SAMPLE_DRAFT': {
        const allies = Array.from(new Set(action.allies)).slice(0, 5);
        const allySet = new Set(allies);
        const enemies = Array.from(new Set(action.enemies))
          .filter((id) => !allySet.has(id))
          .slice(0, 5);
        s.allies = allies;
        s.enemies = enemies;
        s.lockedPositions = {};
        s.heroClaims = {};
        if (allies[0]) {
          s.heroClaims[allies[0]] = { clientId: action.clientId, playerName: actor };
        }
        this.pushActivity(s, `${actor} loaded Sample 5v5 draft`, now);
        break;
      }

      case 'CLEAR_DRAFT': {
        s.allies = [];
        s.enemies = [];
        s.lockedPositions = {};
        s.heroClaims = {};
        this.pushActivity(s, `${actor} cleared the draft`, now);
        break;
      }

      case 'CLOCK_START': {
        if (!s.clock.running) {
          s.clock = {
            baseClockSeconds: s.clock.baseClockSeconds,
            running: true,
            updatedAtServerMs: now,
          };
          this.pushActivity(s, `${actor} started match timer`, now);
        }
        break;
      }

      case 'CLOCK_PAUSE': {
        if (s.clock.running) {
          s.clock = {
            baseClockSeconds: computeCurrentClock(s.clock, now),
            running: false,
            updatedAtServerMs: now,
          };
          this.pushActivity(s, `${actor} paused match timer`, now);
        }
        break;
      }

      case 'CLOCK_SET': {
        if (Number.isFinite(action.seconds)) {
          s.clock = {
            baseClockSeconds: action.seconds,
            running: s.clock.running,
            updatedAtServerMs: now,
          };
          this.pushActivity(s, `${actor} set match clock`, now);
        }
        break;
      }

      case 'CLOCK_NUDGE': {
        if (Number.isFinite(action.delta)) {
          const current = computeCurrentClock(s.clock, now);
          s.clock = {
            baseClockSeconds: current + action.delta,
            running: s.clock.running,
            updatedAtServerMs: now,
          };
        }
        break;
      }

      case 'BOSS_ROSHAN_KILL': {
        const current = Math.max(0, Math.floor(computeCurrentClock(s.clock, now)));
        s.bossState = { ...s.bossState, roshanKilledAt: current };
        this.pushActivity(s, `${actor} marked Roshan killed`, now);
        break;
      }

      case 'BOSS_ROSHAN_CLEAR': {
        s.bossState = { ...s.bossState, roshanKilledAt: null };
        break;
      }

      case 'BOSS_TORMENTOR_KILL': {
        const current = Math.max(0, Math.floor(computeCurrentClock(s.clock, now)));
        s.bossState = { ...s.bossState, tormentorKilledAt: current };
        this.pushActivity(s, `${actor} marked Tormentor killed`, now);
        break;
      }

      case 'BOSS_TORMENTOR_CLEAR': {
        s.bossState = { ...s.bossState, tormentorKilledAt: null };
        break;
      }
    }

    s.version++;
    s.updatedAt = now;
    this.broadcastRoom(room);
    return this.toSnapshot(room, now);
  }

  ingestRoomGsi(
    rawCode: string,
    rawPayload: unknown
  ):
    | { ok: true; gsiState: GsiNormalizedState; room: RoomSnapshot }
    | { ok: false; status: number; error: string } {
    const code = normalizeRoomCode(rawCode);
    if (!code) return { ok: false, status: 404, error: 'Room not found' };
    const room = this.rooms.get(code);
    if (!room) return { ok: false, status: 404, error: 'Room not found' };

    const result = room.gsiManager.ingest(rawPayload);
    if (!result.ok) {
      return {
        ok: false,
        status: result.error.includes('token') ? 401 : 400,
        error: result.error,
      };
    }

    const gsi = result.state;
    const s = room.state;
    const now = Date.now();
    let changed = false;

    if (gsi.detectedMode && s.mode !== gsi.detectedMode) {
      s.mode = gsi.detectedMode;
      changed = true;
    }
    if (gsi.faction && s.faction !== gsi.faction) {
      s.faction = gsi.faction;
      changed = true;
    }
    if (gsi.roshanDiedAtClock !== null && s.bossState.roshanKilledAt !== gsi.roshanDiedAtClock) {
      s.bossState = { ...s.bossState, roshanKilledAt: gsi.roshanDiedAtClock };
      changed = true;
    }
    if (gsi.heroName) {
      const heroId = this.heroNameToId.get(gsi.heroName);
      if (heroId && !s.allies.includes(heroId) && s.allies.length < 5) {
        s.allies = [...s.allies, heroId];
        s.enemies = s.enemies.filter((id) => id !== heroId);
        changed = true;
      }
    }
    if (gsi.clockTime !== null) {
      const currClock = computeCurrentClock(s.clock, now);
      const nextRunning = !gsi.paused;
      if (Math.abs(gsi.clockTime - currClock) > 1.5 || s.clock.running !== nextRunning) {
        s.clock = {
          baseClockSeconds: gsi.clockTime,
          running: nextRunning,
          updatedAtServerMs: now,
        };
        changed = true;
      }
    }

    if (changed) {
      s.version++;
      s.updatedAt = now;
      this.broadcastRoom(room);
    }
    this.broadcastGsi(room, gsi);

    return { ok: true, gsiState: gsi, room: this.toSnapshot(room, now) };
  }

  simulateRoomGsi(
    rawCode: string,
    body: Record<string, any>
  ):
    | { ok: true; gsiState: GsiNormalizedState; room: RoomSnapshot }
    | { ok: false; status: number; error: string } {
    const code = normalizeRoomCode(rawCode);
    if (!code) return { ok: false, status: 404, error: 'Room not found' };
    const room = this.rooms.get(code);
    if (!room) return { ok: false, status: 404, error: 'Room not found' };

    const action = String(body.action ?? 'tick');
    const tokenBlock = this.gsiToken ? { auth: { token: this.gsiToken } } : {};

    if (action === 'reset') {
      const gsiState = room.gsiManager.reset();
      this.broadcastGsi(room, gsiState);
      return { ok: true, gsiState, room: this.toSnapshot(room) };
    }

    const curr = room.gsiManager.getState();

    if (action === 'roshan_kill') {
      const killClock = typeof body.clockTime === 'number' ? body.clockTime : curr.clockTime ?? 720;
      room.gsiManager.ingest({
        ...tokenBlock,
        map: {
          clock_time: killClock - 1,
          game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
          roshan_state: 'alive',
        },
      });
      return this.ingestRoomGsi(code, {
        ...tokenBlock,
        map: {
          clock_time: killClock,
          game_time: killClock + 60,
          game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
          paused: false,
          roshan_state: 'respawn_base',
          roshan_state_end_seconds: 480,
        },
      });
    }

    const clockTime =
      typeof body.clockTime === 'number' ? body.clockTime : curr.clockTime ?? 340;
    return this.ingestRoomGsi(code, {
      ...tokenBlock,
      map: {
        clock_time: clockTime,
        game_time: clockTime + 60,
        game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
        paused: typeof body.paused === 'boolean' ? body.paused : curr.paused,
        roshan_state: curr.roshanState ?? 'alive',
        customgamename: body.mode === 'turbo' ? 'turbo' : curr.customGameName ?? '',
      },
      player: {
        team_name: body.faction ?? curr.faction ?? 'radiant',
      },
      hero: {
        name: body.heroName ?? curr.heroName ?? 'npc_dota_hero_juggernaut',
      },
    });
  }

  close() {
    clearInterval(this.keepAliveTimer);
    for (const room of this.rooms.values()) {
      for (const client of room.clients.keys()) {
        if (!client.writableEnded) {
          client.end();
        }
      }
      room.clients.clear();
    }
    this.rooms.clear();
  }
}
