import { execFile } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

async function trimSilence(rawBuf, tag) {
  const workDir = join(tmpdir(), 'dota2-helper-tts');
  await mkdir(workDir, { recursive: true });
  const inPath = join(workDir, `${tag}-in.mp3`);
  const outPath = join(workDir, `${tag}-out.mp3`);

  try {
    await writeFile(inPath, rawBuf);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inPath,
      '-af',
      'silenceremove=start_periods=1:start_duration=0:start_threshold=-42dB:detection=peak,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=-42dB:detection=peak,areverse,atempo=1.12,apad=pad_dur=0.04',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '48k',
      '-ar',
      '24000',
      '-ac',
      '1',
      outPath,
    ]);
    const trimmed = await readFile(outPath);
    if (trimmed && trimmed.length >= 1000) {
      return trimmed;
    }
    return rawBuf;
  } catch (err) {
    console.warn(`ffmpeg trim fallback for ${tag}: ${err?.message ?? err}`);
    return rawBuf;
  } finally {
    await Promise.all([
      rm(inPath, { force: true }).catch(() => {}),
      rm(outPath, { force: true }).catch(() => {}),
    ]);
  }
}

async function pruneStaleClips(packDir, validClipIds) {
  const validFilenames = new Set(validClipIds.map((id) => `${id}.mp3`));
  const files = await readdir(packDir).catch(() => []);
  let removed = 0;
  for (const file of files) {
    if (file.endsWith('.mp3') && !validFilenames.has(file)) {
      await rm(resolve(packDir, file), { force: true });
      removed++;
    }
  }
  return removed;
}

async function synthesizePack(pack, clipEntries, force) {
  const packDir = resolve(OUTPUT_ROOT, pack.id);
  await mkdir(packDir, { recursive: true });
  const prunedCount = await pruneStaleClips(
    packDir,
    clipEntries.map(([id]) => id)
  );
  if (prunedCount > 0) {
    console.log(`Removed ${prunedCount} stale clip(s) from "${pack.id}".`);
  }

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

      if (sinceConnect >= 5) {
        resetClient();
        sinceConnect = 0;
        await new Promise((r) => setTimeout(r, 400));
      }

      let rawBuf = null;
      let lastErr = null;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const client = await ensureClient();
          const { audioStream } = client.toStream(phrase);
          rawBuf = await collectStream(audioStream);
          if (!rawBuf || rawBuf.length < 1000) {
            throw new Error(`Synthesized buffer too small (${rawBuf?.length ?? 0} bytes)`);
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

      if (!rawBuf) {
        throw new Error(`Failed clip ${pack.id}/${clipId}: ${lastErr?.message ?? lastErr}`);
      }

      const finalBuf = await trimSilence(rawBuf, `${pack.id}-${clipId}`);
      await writeFile(outPath, finalBuf);
      generatedCount++;
      totalBytes += finalBuf.length;
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
