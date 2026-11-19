import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GsiStateManager, generateGsiConfig } from './gsi';
import { OpenDotaService } from './opendota';
import { RoomManager, normalizeRoomCode } from './rooms';
import snapshotJson from '../shared/data/opendota-snapshot.json';
import type { GsiNormalizedState, OpenDotaSnapshot, RoomAction } from '../shared/types';

export interface AppServerOptions {
  port?: number;
  host?: string;
  distDir?: string;
  cacheDir?: string;
  gsiToken?: string;
  roomTtlMs?: number;
}

export interface AppServerHandle {
  server: Server;
  port: number;
  roomManager: RoomManager;
  close: () => Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

function sendJson(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<unknown> {
  return new Promise((resolvePromise, rejectPromise) => {
    let total = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        rejectPromise(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8').trim();
        resolvePromise(text ? JSON.parse(text) : {});
      } catch (err) {
        rejectPromise(err);
      }
    });
    req.on('error', rejectPromise);
  });
}

function resolvePublicOrigin(req: IncomingMessage, activePort: number): string {
  const fwdProto = req.headers['x-forwarded-proto'];
  const fwdHost = req.headers['x-forwarded-host'];
  const proto =
    typeof fwdProto === 'string' && fwdProto.trim()
      ? fwdProto.split(',')[0].trim()
      : 'http';
  const hostHeader =
    typeof fwdHost === 'string' && fwdHost.trim()
      ? fwdHost.split(',')[0].trim()
      : typeof req.headers.host === 'string' && req.headers.host.trim()
      ? req.headers.host.trim()
      : `127.0.0.1:${activePort}`;
  return `${proto}://${hostHeader}`;
}

export async function createAppServer(options: AppServerOptions = {}): Promise<AppServerHandle> {
  const requestedPort = options.port ?? Number(process.env.PORT ?? 4141);
  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const distDir = options.distDir ?? resolve(process.cwd(), 'dist');
  const gsiToken = options.gsiToken ?? (process.env.GSI_TOKEN || undefined);

  const snap = snapshotJson as OpenDotaSnapshot;
  const heroNameToId = new Map(snap.heroes.map((h) => [h.name, h.id]));
  const heroIdToName = new Map(snap.heroes.map((h) => [h.id, h.localizedName]));

  const gsiManager = new GsiStateManager(gsiToken);
  const openDota = new OpenDotaService(options.cacheDir);
  const roomManager = new RoomManager({
    gsiToken,
    roomTtlMs: options.roomTtlMs,
    heroNameToId,
    heroIdToName,
  });
  const sseClients = new Set<ServerResponse>();
  let activePort = requestedPort;

  function broadcastGsi(state: GsiNormalizedState) {
    const payload = `event: gsi\ndata: ${JSON.stringify(state)}\n\n`;
    for (const client of sseClients) {
      if (!client.writableEnded) {
        client.write(payload);
      }
    }
  }

  const keepAliveTimer = setInterval(() => {
    for (const client of sseClients) {
      if (!client.writableEnded) {
        client.write(': ping\n\n');
      }
    }
  }, 15_000);
  keepAliveTimer.unref?.();

  const server = createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    const pathname = url.pathname;

    // Basic CORS for local LAN tablet / Vite dev usage
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true, port: activePort, gsi: gsiManager.getState() });
      return;
    }

    if (method === 'POST' && pathname === '/api/gsi') {
      try {
        const body = await readJsonBody(req);
        const result = gsiManager.ingest(body);
        if (!result.ok) {
          sendJson(res, result.error.includes('token') ? 401 : 400, { error: result.error });
          return;
        }
        broadcastGsi(result.state);
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : 'Bad request' });
      }
      return;
    }

    if (method === 'GET' && pathname === '/api/gsi/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders?.();
      sseClients.add(res);
      res.write(`event: gsi\ndata: ${JSON.stringify(gsiManager.getState())}\n\n`);
      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/gsi/simulate') {
      try {
        const body = (await readJsonBody(req)) as Record<string, any>;
        const action = String(body.action ?? 'tick');
        if (action === 'reset') {
          const resetState = gsiManager.reset();
          broadcastGsi(resetState);
          sendJson(res, 200, { ok: true, state: resetState });
          return;
        }

        const curr = gsiManager.getState();
        const tokenBlock = gsiToken ? { auth: { token: gsiToken } } : {};

        if (action === 'roshan_kill') {
          const killClock = typeof body.clockTime === 'number' ? body.clockTime : curr.clockTime ?? 720;
          // Ensure transition from alive -> respawn_base triggers roshanDiedAtClock
          gsiManager.ingest({
            ...tokenBlock,
            map: {
              clock_time: killClock - 1,
              game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
              roshan_state: 'alive',
            },
          });
          const resIngest = gsiManager.ingest({
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
          if (resIngest.ok) {
            broadcastGsi(resIngest.state);
            sendJson(res, 200, { ok: true, state: resIngest.state });
            return;
          }
        }

        const simPayload = {
          ...tokenBlock,
          map: {
            clock_time: typeof body.clockTime === 'number' ? body.clockTime : curr.clockTime ?? 340,
            game_time: (typeof body.clockTime === 'number' ? body.clockTime : curr.clockTime ?? 340) + 60,
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
        };

        const resIngest = gsiManager.ingest(simPayload);
        if (!resIngest.ok) {
          sendJson(res, 400, { error: resIngest.error });
          return;
        }
        broadcastGsi(resIngest.state);
        sendJson(res, 200, { ok: true, state: resIngest.state });
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : 'Simulation failed' });
      }
      return;
    }

    if (method === 'GET' && pathname === '/api/gsi/config') {
      const roomParam = url.searchParams.get('room');
      const roomCode = roomParam ? normalizeRoomCode(roomParam) : null;
      const hasForwardedHost = Boolean(req.headers['x-forwarded-host']);
      const origin = resolvePublicOrigin(req, activePort);
      const targetUri = roomCode
        ? `${origin}/api/rooms/${roomCode}/gsi`
        : hasForwardedHost
        ? `${origin}/api/gsi`
        : `http://127.0.0.1:${activePort}/api/gsi`;
      const filename = roomCode
        ? `gamestate_integration_dota2_helper_${roomCode}.cfg`
        : 'gamestate_integration_dota2_helper.cfg';
      const cfg = generateGsiConfig(targetUri, gsiToken ?? 'dota2_helper_local');
      if (url.searchParams.get('format') === 'json') {
        sendJson(res, 200, {
          filename,
          port: activePort,
          uri: targetUri,
          content: cfg,
        });
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.end(cfg);
      return;
    }

    // Multiplayer Room Endpoints
    if (method === 'POST' && pathname === '/api/rooms') {
      try {
        const body = (await readJsonBody(req)) as Record<string, any>;
        const room = roomManager.createRoom(body);
        sendJson(res, 201, { code: room.code, room });
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : 'Invalid request' });
      }
      return;
    }

    const roomExactMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)$/);
    if (method === 'GET' && roomExactMatch) {
      const room = roomManager.getSnapshot(roomExactMatch[1]);
      if (!room) {
        sendJson(res, 404, { error: 'Room not found' });
        return;
      }
      sendJson(res, 200, { room });
      return;
    }

    const roomStreamMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/stream$/);
    if (method === 'GET' && roomStreamMatch) {
      const code = roomStreamMatch[1];
      if (!roomManager.hasRoom(code)) {
        sendJson(res, 404, { error: 'Room not found' });
        return;
      }
      const clientId = url.searchParams.get('clientId') || `anon-${Date.now()}`;
      const playerName = url.searchParams.get('name') || '';
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders?.();
      roomManager.addClient(code, res, clientId, playerName);
      req.on('close', () => {
        roomManager.removeClient(code, res);
      });
      return;
    }

    const roomActionMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/action$/);
    if (method === 'POST' && roomActionMatch) {
      try {
        const body = (await readJsonBody(req)) as RoomAction;
        if (!body || typeof body.type !== 'string' || typeof body.clientId !== 'string') {
          sendJson(res, 400, { error: 'Missing action type or clientId' });
          return;
        }
        const room = roomManager.applyAction(roomActionMatch[1], body);
        if (!room) {
          sendJson(res, 404, { error: 'Room not found' });
          return;
        }
        sendJson(res, 200, { ok: true, room });
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : 'Bad action payload' });
      }
      return;
    }

    const roomPresenceMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/presence$/);
    if (method === 'POST' && roomPresenceMatch) {
      try {
        const body = (await readJsonBody(req)) as { clientId?: string; playerName?: string };
        if (!body.clientId) {
          sendJson(res, 400, { error: 'Missing clientId' });
          return;
        }
        const room = roomManager.updatePresence(
          roomPresenceMatch[1],
          body.clientId,
          body.playerName ?? ''
        );
        if (!room) {
          sendJson(res, 404, { error: 'Room not found' });
          return;
        }
        sendJson(res, 200, { ok: true, room });
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : 'Bad presence payload' });
      }
      return;
    }

    const roomGsiMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/gsi$/);
    if (method === 'POST' && roomGsiMatch) {
      try {
        const body = await readJsonBody(req);
        const result = roomManager.ingestRoomGsi(roomGsiMatch[1], body);
        if (!result.ok) {
          sendJson(res, result.status, { error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : 'Bad GSI payload' });
      }
      return;
    }

    const roomGsiSimMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/gsi\/simulate$/);
    if (method === 'POST' && roomGsiSimMatch) {
      try {
        const body = (await readJsonBody(req)) as Record<string, any>;
        const result = roomManager.simulateRoomGsi(roomGsiSimMatch[1], body);
        if (!result.ok) {
          sendJson(res, result.status, { error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, state: result.gsiState, room: result.room });
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : 'Simulation failed' });
      }
      return;
    }

    if (method === 'GET' && pathname === '/api/dota/data') {
      const refresh = url.searchParams.get('refresh') === '1';
      const data = await openDota.getData(refresh);
      sendJson(res, 200, data);
      return;
    }

    const matchupMatch = pathname.match(/^\/api\/dota\/hero\/(\d+)\/matchups$/);
    if (method === 'GET' && matchupMatch) {
      const heroId = Number(matchupMatch[1]);
      const matchups = await openDota.getHeroMatchups(heroId);
      sendJson(res, 200, { heroId, matchups });
      return;
    }

    // Serve static files from dist/ if built
    if (method === 'GET' && !pathname.startsWith('/api/')) {
      try {
        const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const candidate = resolve(distDir, relPath);
        if (candidate.startsWith(resolve(distDir))) {
          const info = await stat(candidate).catch(() => null);
          const isSpaRoute = extname(relPath) === '';
          const targetFile =
            info && info.isFile()
              ? candidate
              : isSpaRoute
              ? join(resolve(distDir), 'index.html')
              : null;
          if (targetFile) {
            const fileBuf = await readFile(targetFile);
            const ext = extname(targetFile);
            const headers: Record<string, string> = {
              'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
            };
            if (relPath.startsWith('audio/')) {
              headers['Cache-Control'] = 'public, max-age=86400';
            }
            res.writeHead(200, headers);
            res.end(fileBuf);
            return;
          }
        }
      } catch {
        // Fallback 404 when dist/ doesn't exist yet (e.g. dev mode on server port)
      }
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(requestedPort, host, () => {
      server.removeListener('error', rejectListen);
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        activePort = addr.port;
      }
      resolveListen();
    });
  });

  return {
    server,
    port: activePort,
    roomManager,
    close: async () => {
      clearInterval(keepAliveTimer);
      roomManager.close();
      for (const client of sseClients) {
        if (!client.writableEnded) {
          client.end();
        }
      }
      sseClients.clear();
      server.closeAllConnections?.();
      await new Promise<void>((resClose, rejClose) => {
        server.close((err) => (err ? rejClose(err) : resClose()));
      });
    },
  };
}

const isMain =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  createAppServer()
    .then((handle) => {
      console.log(`Dota 2 Helper server listening on http://${process.env.HOST ?? '0.0.0.0'}:${handle.port}`);
      const shutdown = () => {
        handle.close().finally(() => process.exit(0));
      };
      process.once('SIGTERM', shutdown);
      process.once('SIGINT', shutdown);
    })
    .catch((err) => {
      console.error('Failed to start Dota 2 Helper server:', err);
      process.exit(1);
    });
}
