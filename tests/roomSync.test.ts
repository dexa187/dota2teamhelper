import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppServer, type AppServerHandle } from '../src/server/index';
import type { RoomSnapshot } from '../src/shared/types';

class SseReader {
  private readonly controller = new AbortController();
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder = new TextDecoder();
  private buffer = '';

  private constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.reader = reader;
  }

  static async connect(url: string): Promise<SseReader> {
    const res = await fetch(url, { signal: AbortController ? undefined : undefined });
    if (!res.ok || !res.body) {
      throw new Error(`SSE connect failed: HTTP ${res.status}`);
    }
    return new SseReader(res.body.getReader());
  }

  static async connectAbortable(url: string): Promise<{ client: SseReader; close: () => void }> {
    const controller = new AbortController();
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok || !res.body) {
      throw new Error(`SSE connect failed: HTTP ${res.status}`);
    }
    const client = new SseReader(res.body.getReader());
    return {
      client,
      close: () => {
        controller.abort();
      },
    };
  }

  async nextEvent(targetEvent: string, predicate?: (data: any) => boolean, timeoutMs = 3000): Promise<any> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const sepIdx = this.buffer.indexOf('\n\n');
      if (sepIdx !== -1) {
        const block = this.buffer.slice(0, sepIdx);
        this.buffer = this.buffer.slice(sepIdx + 2);
        let evName = 'message';
        let dataLine = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) evName = line.slice(6).trim();
          if (line.startsWith('data:')) dataLine += line.slice(5).trim();
        }
        if (evName === targetEvent && dataLine) {
          const parsed = JSON.parse(dataLine);
          if (!predicate || predicate(parsed)) {
            return parsed;
          }
        }
        continue;
      }

      const chunk = await Promise.race([
        this.reader.read(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`Timed out waiting for SSE event ${targetEvent}`)), Math.max(50, deadline - Date.now()))
        ),
      ]);
      if (chunk.done) throw new Error('SSE stream closed');
      this.buffer += this.decoder.decode(chunk.value, { stream: true });
    }
    throw new Error(`Timed out waiting for SSE event ${targetEvent}`);
  }
}

describe('Real-time Multiplayer Game Code Rooms', () => {
  let srv: AppServerHandle;
  let baseUrl = '';

  beforeAll(async () => {
    srv = await createAppServer({ port: 0, host: '127.0.0.1', roomTtlMs: 100 });
    baseUrl = `http://127.0.0.1:${srv.port}`;
  });

  afterAll(async () => {
    await srv.close();
  });

  it('creates rooms with 6-char unambiguous codes and returns 404 for unknown codes', async () => {
    const createRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faction: 'dire', mode: 'turbo' }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { code: string; room: RoomSnapshot };
    expect(created.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(created.room.faction).toBe('dire');
    expect(created.room.mode).toBe('turbo');

    const missingRes = await fetch(`${baseUrl}/api/rooms/ZZZZ99`);
    expect(missingRes.status).toBe(404);
  });

  it('syncs concurrent picks, independent hero claims, shared clock/bosses, and presence across 2 SSE clients', async () => {
    const createRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { code } = (await createRes.json()) as { code: string };

    const connA = await SseReader.connectAbortable(
      `${baseUrl}/api/rooms/${code}/stream?clientId=cA&name=Ryan`
    );
    const initA = (await connA.client.nextEvent('room')) as RoomSnapshot;
    expect(initA.members).toHaveLength(1);
    expect(initA.members[0].playerName).toBe('Ryan');

    const connB = await SseReader.connectAbortable(
      `${baseUrl}/api/rooms/${code}/stream?clientId=cB&name=Alex`
    );
    const joinBOnA = (await connA.client.nextEvent(
      'room',
      (r: RoomSnapshot) => r.members.length === 2
    )) as RoomSnapshot;
    expect(joinBOnA.members.map((m) => m.playerName)).toEqual(['Ryan', 'Alex']);

    // Concurrent hero picks from Client A and Client B
    await Promise.all([
      fetch(`${baseUrl}/api/rooms/${code}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ADD_HERO',
          side: 'ally',
          heroId: 8,
          clientId: 'cA',
          playerName: 'Ryan',
        }),
      }),
      fetch(`${baseUrl}/api/rooms/${code}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ADD_HERO',
          side: 'ally',
          heroId: 5,
          clientId: 'cB',
          playerName: 'Alex',
        }),
      }),
    ]);

    const bothPickedOnB = (await connB.client.nextEvent(
      'room',
      (r: RoomSnapshot) => r.allies.includes(8) && r.allies.includes(5)
    )) as RoomSnapshot;
    expect(bothPickedOnB.allies).toHaveLength(2);

    // Independent hero claims coexist cleanly
    await fetch(`${baseUrl}/api/rooms/${code}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CLAIM_HERO',
        heroId: 8,
        clientId: 'cA',
        playerName: 'Ryan',
      }),
    });
    await fetch(`${baseUrl}/api/rooms/${code}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CLAIM_HERO',
        heroId: 5,
        clientId: 'cB',
        playerName: 'Alex',
      }),
    });

    const claimsSnap = (await connA.client.nextEvent(
      'room',
      (r: RoomSnapshot) => r.heroClaims[8]?.clientId === 'cA' && r.heroClaims[5]?.clientId === 'cB'
    )) as RoomSnapshot;
    expect(claimsSnap.heroClaims[8].playerName).toBe('Ryan');
    expect(claimsSnap.heroClaims[5].playerName).toBe('Alex');

    // Shared match clock + Roshan kill
    await fetch(`${baseUrl}/api/rooms/${code}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CLOCK_SET',
        seconds: 600,
        clientId: 'cA',
        playerName: 'Ryan',
      }),
    });
    await fetch(`${baseUrl}/api/rooms/${code}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CLOCK_START',
        clientId: 'cA',
        playerName: 'Ryan',
      }),
    });
    await fetch(`${baseUrl}/api/rooms/${code}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'BOSS_ROSHAN_KILL',
        clientId: 'cB',
        playerName: 'Alex',
      }),
    });

    const bossSyncOnA = (await connA.client.nextEvent(
      'room',
      (r: RoomSnapshot) => r.clock.running && r.bossState.roshanKilledAt !== null
    )) as RoomSnapshot;
    expect(bossSyncOnA.bossState.roshanKilledAt).toBeGreaterThanOrEqual(600);

    // Disconnect Client B -> Client A sees 1 member online
    connB.close();
    const afterDisconnect = (await connA.client.nextEvent(
      'room',
      (r: RoomSnapshot) => r.members.length === 1
    )) as RoomSnapshot;
    expect(afterDisconnect.members[0].clientId).toBe('cA');

    connA.close();
  });

  it('generates room-scoped HTTPS GSI config via forwarded headers and isolates room GSI updates', async () => {
    const [r1Res, r2Res] = await Promise.all([
      fetch(`${baseUrl}/api/rooms`, { method: 'POST', body: '{}' }),
      fetch(`${baseUrl}/api/rooms`, { method: 'POST', body: '{}' }),
    ]);
    const r1 = (await r1Res.json()) as { code: string };
    const r2 = (await r2Res.json()) as { code: string };

    const cfgRes = await fetch(`${baseUrl}/api/gsi/config?room=${r1.code}`, {
      headers: {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'dota.myserver.com',
      },
    });
    expect(cfgRes.status).toBe(200);
    const cfgText = await cfgRes.text();
    expect(cfgText).toContain(`https://dota.myserver.com/api/rooms/${r1.code}/gsi`);

    // Post GSI to room 1 -> updates room 1 only, room 2 untouched
    const postRes = await fetch(`${baseUrl}/api/rooms/${r1.code}/gsi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        map: { clock_time: 400, paused: false, roshan_state: 'alive', customgamename: 'turbo' },
        player: { team_name: 'radiant' },
        hero: { name: 'npc_dota_hero_juggernaut' },
      }),
    });
    expect(postRes.status).toBe(200);

    const [check1, check2] = await Promise.all([
      fetch(`${baseUrl}/api/rooms/${r1.code}`).then((r) => r.json() as Promise<{ room: RoomSnapshot }>),
      fetch(`${baseUrl}/api/rooms/${r2.code}`).then((r) => r.json() as Promise<{ room: RoomSnapshot }>),
    ]);

    expect(check1.room.mode).toBe('turbo');
    expect(check1.room.allies).toEqual([8]); // Juggernaut ID 8
    expect(check1.room.clock.baseClockSeconds).toBe(400);

    expect(check2.room.mode).toBe('regular');
    expect(check2.room.allies).toEqual([]);
  });

  it('prunes expired empty rooms cleanly', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`, { method: 'POST', body: '{}' });
    const { code } = (await res.json()) as { code: string };

    await new Promise((r) => setTimeout(r, 130));
    const pruned = srv.roomManager.pruneExpiredRooms();
    expect(pruned).toBeGreaterThanOrEqual(1);

    const check = await fetch(`${baseUrl}/api/rooms/${code}`);
    expect(check.status).toBe(404);
  });
});
