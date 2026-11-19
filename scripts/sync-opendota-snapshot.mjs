import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/shared/data/opendota-snapshot.json');

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'dota2-helper/1.0' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

function normalizeImgPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return '';
  return rawPath.split('?')[0];
}

async function main() {
  console.log('Fetching OpenDota hero and item constants...');
  const [rawHeroes, rawItems] = await Promise.all([
    fetchJson('https://api.opendota.com/api/constants/heroes'),
    fetchJson('https://api.opendota.com/api/constants/items'),
  ]);

  const heroes = Object.values(rawHeroes)
    .filter((h) => h && h.id && h.name && h.localized_name)
    .map((h) => ({
      id: Number(h.id),
      name: String(h.name),
      localizedName: String(h.localized_name),
      primaryAttr: ['str', 'agi', 'int', 'all'].includes(h.primary_attr) ? h.primary_attr : 'all',
      attackType: h.attack_type === 'Melee' ? 'Melee' : 'Ranged',
      roles: Array.isArray(h.roles) ? h.roles.map(String) : [],
      img: normalizeImgPath(h.img),
      icon: normalizeImgPath(h.icon),
    }))
    .sort((a, b) => a.localizedName.localeCompare(b.localizedName));

  const items = {};
  for (const [key, item] of Object.entries(rawItems)) {
    if (!item || !item.dname || item.cost === undefined || item.cost === null) continue;
    if (key.startsWith('recipe_')) continue;
    items[key] = {
      id: Number(item.id ?? 0),
      key,
      dname: String(item.dname),
      cost: Number(item.cost ?? 0),
      img: normalizeImgPath(item.img),
    };
  }

  const snapshot = {
    updatedAt: new Date().toISOString(),
    heroes,
    items,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  console.log(`Saved ${heroes.length} heroes and ${Object.keys(items).length} items to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Failed to sync OpenDota snapshot:', err);
  process.exit(1);
});
