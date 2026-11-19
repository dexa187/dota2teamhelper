import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppServer, type AppServerHandle } from '../src/server/index';

describe('GSI & OpenDota Local Server', () => {
  let srv: AppServerHandle;
  let baseUrl = '';

  beforeAll(async () => {
    srv = await createAppServer({ port: 0, host: '127.0.0.1', gsiToken: 'secret_tok' });
    baseUrl = `http://127.0.0.1:${srv.port}`;
  });

  afterAll(async () => {
    await srv.close();
  });

  it('serves health and downloadable GSI config pointing to active port', async () => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as { ok: boolean; port: number };
    expect(health.ok).toBe(true);
    expect(health.port).toBe(srv.port);

    const cfgRes = await fetch(`${baseUrl}/api/gsi/config`);
    expect(cfgRes.status).toBe(200);
    const cfgText = await cfgRes.text();
    expect(cfgText).toContain(`http://127.0.0.1:${srv.port}/api/gsi`);
    expect(cfgText).toContain('"token"         "secret_tok"');
  });

  it('rejects bad auth token and broadcasts normalized GSI payloads over SSE', async () => {
    const badRes = await fetch(`${baseUrl}/api/gsi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: { token: 'wrong' }, map: { clock_time: 100 } }),
    });
    expect(badRes.status).toBe(401);

    const streamController = new AbortController();
    const sseRes = await fetch(`${baseUrl}/api/gsi/stream`, { signal: streamController.signal });
    expect(sseRes.status).toBe(200);

    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();

    // Read initial state frame
    const firstChunk = await reader.read();
    expect(decoder.decode(firstChunk.value)).toContain('event: gsi');

    // Post valid GSI payload
    const postRes = await fetch(`${baseUrl}/api/gsi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth: { token: 'secret_tok' },
        map: {
          clock_time: 345,
          paused: false,
          roshan_state: 'alive',
          customgamename: 'turbo',
        },
        player: { team_name: 'radiant' },
        hero: { name: 'npc_dota_hero_juggernaut' },
      }),
    });
    expect(postRes.status).toBe(200);

    const secondChunk = await reader.read();
    const frameText = decoder.decode(secondChunk.value);
    expect(frameText).toContain('"clockTime":345');
    expect(frameText).toContain('"detectedMode":"turbo"');
    expect(frameText).toContain('"heroName":"npc_dota_hero_juggernaut"');

    streamController.abort();
  });

  it('supports /api/gsi/simulate roshan_kill and /api/dota/data full hero snapshot', async () => {
    const simRes = await fetch(`${baseUrl}/api/gsi/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'roshan_kill', clockTime: 720 }),
    });
    expect(simRes.status).toBe(200);
    const simBody = (await simRes.json()) as { ok: boolean; state: { roshanDiedAtClock: number | null } };
    expect(simBody.ok).toBe(true);
    expect(simBody.state.roshanDiedAtClock).toBe(720);

    const dataRes = await fetch(`${baseUrl}/api/dota/data`);
    expect(dataRes.status).toBe(200);
    const dataBody = (await dataRes.json()) as { heroes: unknown[] };
    expect(dataBody.heroes.length).toBeGreaterThanOrEqual(126);
  });
});
