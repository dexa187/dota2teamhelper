import { webcrypto } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CLIPS_PATH = resolve(ROOT_DIR, 'src/shared/data/audioClips.json');
const OUTPUT_ROOT = resolve(ROOT_DIR, 'public/audio/cues');

function collectStream(stream) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolvePromise(Buffer.concat(chunks)));
    stream.on('error', rejectPromise);
  });
}

async function synthesizePack(pack, clipEntries, force) {
  const packDir = resolve(OUTPUT_ROOT, pack.id);
  await mkdir(packDir, { recursive: true });
  console.log(`\nGenerating ${clipEntries.length} clips for voice pack "${pack.id}" (${pack.edgeVoice})...`);

  let generatedCount = 0;
  let skippedCount = 0;
  let totalBytes = 0;

  let tts = null;
  const ensureClient = async () => {
    if (!tts) {
      tts = new MsEdgeTTS({ connectionTimeoutMs: 12000, synthesisTimeoutMs: 25000 });
      await tts.setMetadata(pack.edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    }
    return tts;
  };
  const resetClient = () => {
    if (tts) {
      try {
        tts.close();
      } catch {
        // Ignore close error
      }
      tts = null;
    }
  };

  try {
    let sinceConnect = 0;
    for (const [clipId, phrase] of clipEntries) {
      const outPath = resolve(packDir, `${clipId}.mp3`);
      if (!force) {
        const existing = await stat(outPath).catch(() => null);
        if (existing && existing.size > 1000) {
          skippedCount++;
          totalBytes += existing.size;
          continue;
        }
      }

      if (sinceConnect >= 8) {
        resetClient();
        sinceConnect = 0;
        await new Promise((r) => setTimeout(r, 400));
      }

      let buf = null;
      let lastErr = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const client = await ensureClient();
          const { audioStream } = client.toStream(phrase);
          buf = await collectStream(audioStream);
          if (!buf || buf.length < 1000) {
            throw new Error(`Synthesized buffer too small (${buf?.length ?? 0} bytes)`);
          }
          sinceConnect++;
          break;
        } catch (err) {
          lastErr = err;
          resetClient();
          sinceConnect = 0;
          if (attempt < 5) {
            await new Promise((r) => setTimeout(r, 900 * attempt));
          }
        }
      }

      if (!buf) {
        throw new Error(`Failed clip ${pack.id}/${clipId}: ${lastErr?.message ?? lastErr}`);
      }

      await writeFile(outPath, buf);
      generatedCount++;
      totalBytes += buf.length;
      await new Promise((r) => setTimeout(r, 200));
    }
  } finally {
    resetClient();
  }

  console.log(`Completed "${pack.id}": ${generatedCount} generated, ${skippedCount} cached.`);
  return { generatedCount, skippedCount, totalBytes };
}

async function main() {
  const force = process.argv.includes('--force');
  const raw = await readFile(CLIPS_PATH, 'utf8');
  const config = JSON.parse(raw);

  const clipEntries = Object.entries(config.clips);
  let generatedCount = 0;
  let skippedCount = 0;
  let totalBytes = 0;

  for (const pack of config.voicePacks) {
    const res = await synthesizePack(pack, clipEntries, force);
    generatedCount += res.generatedCount;
    skippedCount += res.skippedCount;
    totalBytes += res.totalBytes;
  }

  console.log(
    `\nAudio generation summary: ${generatedCount} generated, ${skippedCount} cached, total ${(totalBytes / 1024).toFixed(1)} KB.`
  );
}

main().catch((err) => {
  console.error('Failed to generate audio cues:', err);
  process.exit(1);
});
