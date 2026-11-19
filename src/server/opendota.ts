import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import snapshotJson from '../shared/data/opendota-snapshot.json';
import { buildHeroCatalog } from '../shared/data/heroTactics';
import type { HeroBaseData, HeroRecord, OpenDotaSnapshot } from '../shared/types';

const SNAPSHOT = snapshotJson as OpenDotaSnapshot;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MATCHUP_TTL_MS = 6 * 60 * 60 * 1000;

export class OpenDotaService {
  private memorySnapshot: OpenDotaSnapshot = SNAPSHOT;
  private lastSyncedAt = 0;
  private readonly cachePath: string;
  private readonly matchupCache = new Map<number, { fetchedAt: number; data: Record<number, number> }>();
  private lastUpstreamAt = 0;

  constructor(cacheDir = resolve(process.cwd(), '.cache')) {
    this.cachePath = resolve(cacheDir, 'opendota.json');
  }

  async getData(forceRefresh = false): Promise<{
    source: 'snapshot' | 'cache' | 'opendota';
    updatedAt: string;
    heroes: HeroRecord[];
    snapshot: OpenDotaSnapshot;
  }> {
    const now = Date.now();
    if (!forceRefresh && this.lastSyncedAt > 0 && now - this.lastSyncedAt < CACHE_TTL_MS) {
      return {
        source: 'cache',
        updatedAt: this.memorySnapshot.updatedAt,
        heroes: buildHeroCatalog(this.memorySnapshot),
        snapshot: this.memorySnapshot,
      };
    }

    if (!forceRefresh) {
      try {
        const raw = await readFile(this.cachePath, 'utf8');
        const parsed = JSON.parse(raw) as OpenDotaSnapshot;
        if (parsed && Array.isArray(parsed.heroes) && parsed.heroes.length >= 100) {
          this.memorySnapshot = parsed;
          this.lastSyncedAt = now;
          return {
            source: 'cache',
            updatedAt: parsed.updatedAt,
            heroes: buildHeroCatalog(parsed),
            snapshot: parsed,
          };
        }
      } catch {
        // Ignore missing/stale disk cache
      }
    }

    if (forceRefresh) {
      try {
        const refreshed = await this.fetchLiveOpenDota();
        this.memorySnapshot = refreshed;
        this.lastSyncedAt = now;
        await mkdir(dirname(this.cachePath), { recursive: true });
        await writeFile(this.cachePath, JSON.stringify(refreshed), 'utf8');
        return {
          source: 'opendota',
          updatedAt: refreshed.updatedAt,
          heroes: buildHeroCatalog(refreshed),
          snapshot: refreshed,
        };
      } catch {
        // Fall through cleanly to bundled snapshot
      }
    }

    return {
      source: 'snapshot',
      updatedAt: this.memorySnapshot.updatedAt,
      heroes: buildHeroCatalog(this.memorySnapshot),
      snapshot: this.memorySnapshot,
    };
  }

  async getHeroMatchups(heroId: number): Promise<Record<number, number>> {
    const cached = this.matchupCache.get(heroId);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < MATCHUP_TTL_MS) {
      return cached.data;
    }

    // Simple 1 req/sec rate limiter
    if (now - this.lastUpstreamAt < 1000) {
      return cached?.data ?? {};
    }

    try {
      this.lastUpstreamAt = now;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://api.opendota.com/api/heroes/${heroId}/matchups`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'dota2-helper/1.0' },
      });
      clearTimeout(timeout);
      if (!res.ok) return cached?.data ?? {};

      const rows = (await res.json()) as Array<{
        hero_id: number;
        games_played: number;
        wins: number;
      }>;
      const advantageMap: Record<number, number> = {};
      for (const row of rows) {
        if (!row || !row.hero_id || row.games_played < 20) continue;
        const winrate = (row.wins / row.games_played) * 100;
        advantageMap[row.hero_id] = Number((winrate - 50).toFixed(2));
      }
      this.matchupCache.set(heroId, { fetchedAt: now, data: advantageMap });
      return advantageMap;
    } catch {
      return cached?.data ?? {};
    }
  }

  private async fetchLiveOpenDota(): Promise<OpenDotaSnapshot> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const [heroesRes, itemsRes] = await Promise.all([
      fetch('https://api.opendota.com/api/constants/heroes', { signal: controller.signal }),
      fetch('https://api.opendota.com/api/constants/items', { signal: controller.signal }),
    ]);
    clearTimeout(timeout);

    if (!heroesRes.ok || !itemsRes.ok) {
      throw new Error('OpenDota returned non-200');
    }

    const rawHeroes = (await heroesRes.json()) as Record<string, any>;
    const rawItems = (await itemsRes.json()) as Record<string, any>;

    const heroes: HeroBaseData[] = Object.values(rawHeroes)
      .filter((h) => h && h.id && h.name && h.localized_name)
      .map((h) => ({
        id: Number(h.id),
        name: String(h.name),
        localizedName: String(h.localized_name),
        primaryAttr: (['str', 'agi', 'int', 'all'].includes(h.primary_attr)
          ? h.primary_attr
          : 'all') as HeroBaseData['primaryAttr'],
        attackType: (h.attack_type === 'Melee' ? 'Melee' : 'Ranged') as HeroBaseData['attackType'],
        roles: Array.isArray(h.roles) ? h.roles.map(String) : [],
        img: typeof h.img === 'string' ? h.img.split('?')[0] : '',
        icon: typeof h.icon === 'string' ? h.icon.split('?')[0] : '',
      }))
      .sort((a, b) => a.localizedName.localeCompare(b.localizedName));

    const items: OpenDotaSnapshot['items'] = {};
    for (const [key, item] of Object.entries(rawItems)) {
      if (!item || !item.dname || item.cost === undefined || item.cost === null) continue;
      if (key.startsWith('recipe_')) continue;
      items[key] = {
        id: Number(item.id ?? 0),
        key,
        dname: String(item.dname),
        cost: Number(item.cost ?? 0),
        img: typeof item.img === 'string' ? item.img.split('?')[0] : '',
      };
    }

    return {
      updatedAt: new Date().toISOString(),
      heroes,
      items,
    };
  }
}
