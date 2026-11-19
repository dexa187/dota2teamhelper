import {
  getClipUrl,
  type AudioClipId,
  type VoicePackId,
} from '../../shared/data/audioClips';
import type { CueCategory, FiredCueBatch } from '../../shared/types';

export type AudioMode = 'both' | 'voice' | 'chime' | 'muted';

export interface AudioSettings {
  mode: AudioMode;
  volume: number; // 0 to 1
  speechRate: number; // 0.85 to 1.35
  voicePack: VoicePackId;
}

const AUDIO_SETTINGS_KEY = 'dota2_helper_audio_settings_v2';

const CORE_PRELOAD_CLIPS: AudioClipId[] = [
  'power_rune',
  'lotus_pool',
  'wisdom_shrine',
  'pull_small',
  'stack_camp',
  'roshan_window_open',
];

const CHIME_PROFILES: Record<CueCategory, number[]> = {
  lane: [523.25, 659.25], // C5 -> E5 gentle two-note chime
  rune: [587.33, 880], // D5 -> A5 bright rune ping
  objective: [440, 554.37, 659.25], // A4 -> C#5 -> E5 major triad
  tier: [659.25, 783.99], // E5 -> G5 crisp chime
  boss: [392, 523.25, 783.99], // G4 -> C5 -> G5 urgent boss fanfare
};

function loadInitialSettings(): AudioSettings {
  const defaults: AudioSettings = {
    mode: 'both',
    volume: 0.85,
    speechRate: 1.0,
    voicePack: 'commander',
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      mode:
        parsed.mode === 'both' ||
        parsed.mode === 'voice' ||
        parsed.mode === 'chime' ||
        parsed.mode === 'muted'
          ? parsed.mode
          : defaults.mode,
      volume:
        typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
          ? Math.min(1, Math.max(0, parsed.volume))
          : defaults.volume,
      speechRate:
        typeof parsed.speechRate === 'number' && Number.isFinite(parsed.speechRate)
          ? Math.min(1.4, Math.max(0.8, parsed.speechRate))
          : defaults.speechRate,
      voicePack:
        parsed.voicePack === 'commander' || parsed.voicePack === 'tactician'
          ? parsed.voicePack
          : defaults.voicePack,
    };
  } catch {
    return defaults;
  }
}

export class DotaAudioEngine {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = loadInitialSettings();
  private listeners = new Set<() => void>();
  private bufferCache = new Map<string, AudioBuffer>();
  private inflight = new Map<string, Promise<AudioBuffer | null>>();
  private activeSources = new Set<AudioBufferSourceNode>();
  private preloadedPacks = new Set<VoicePackId>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  updateSettings(next: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...next };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings));
      } catch {
        // Ignore storage errors
      }
    }
    this.notify();
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  async unlock(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    if (ctx.state === 'running') {
      this.preloadCoreClips(this.settings.voicePack);
    }
    return ctx.state === 'running';
  }

  isUnlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  preloadCoreClips(voicePack: VoicePackId) {
    if (this.preloadedPacks.has(voicePack)) return;
    this.preloadedPacks.add(voicePack);
    for (const clipId of CORE_PRELOAD_CLIPS) {
      void this.loadBuffer(voicePack, clipId);
    }
  }

  private async loadBuffer(voicePack: VoicePackId, clipId: AudioClipId): Promise<AudioBuffer | null> {
    const cacheKey = `${voicePack}/${clipId}`;
    const cached = this.bufferCache.get(cacheKey);
    if (cached) return cached;

    const existingPromise = this.inflight.get(cacheKey);
    if (existingPromise) return existingPromise;

    const ctx = this.ensureContext();
    if (!ctx) return null;

    const promise = (async () => {
      try {
        const res = await fetch(getClipUrl(voicePack, clipId));
        if (!res.ok) return null;
        const arr = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr);
        this.bufferCache.set(cacheKey, decoded);
        return decoded;
      } catch {
        return null;
      } finally {
        this.inflight.delete(cacheKey);
      }
    })();

    this.inflight.set(cacheKey, promise);
    return promise;
  }

  playChime(category: CueCategory, forcePlay = false) {
    if (
      typeof window === 'undefined' ||
      (!forcePlay && (this.settings.mode === 'muted' || this.settings.mode === 'voice'))
    ) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const freqs = CHIME_PROFILES[category] ?? CHIME_PROFILES.objective;
    const now = ctx.currentTime;
    const gainPeak = Math.max(0.02, Math.min(0.35, this.settings.volume * 0.28));

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.11;
      const duration = category === 'boss' ? 0.26 : 0.18;

      osc.type = category === 'boss' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    });
  }

  private stopActiveClips() {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Ignore already-stopped source
      }
    }
    this.activeSources.clear();
  }

  async playClipSequence(
    clipIds: AudioClipId[],
    startDelaySec = 0,
    interrupt = false
  ): Promise<void> {
    if (typeof window === 'undefined' || clipIds.length === 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Proceed cleanly even if autoplay policy blocks until gesture
      }
    }

    const uniqueClips = Array.from(new Set(clipIds));
    const voicePack = this.settings.voicePack;
    const buffers = await Promise.all(uniqueClips.map((id) => this.loadBuffer(voicePack, id)));
    const validBuffers = buffers.filter((b): b is AudioBuffer => b !== null);
    if (validBuffers.length === 0) return;

    if (interrupt) {
      this.stopActiveClips();
    }

    const rate = this.settings.speechRate;
    const gainNode = ctx.createGain();
    gainNode.gain.value = Math.max(0, Math.min(1, this.settings.volume));
    gainNode.connect(ctx.destination);

    let cursor = ctx.currentTime + Math.max(0, startDelaySec);
    for (const buffer of validBuffers) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      source.connect(gainNode);
      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
      };
      source.start(cursor);
      cursor += buffer.duration / rate + 0.14;
    }
  }

  playBatch(batch: FiredCueBatch) {
    if (this.settings.mode === 'muted') return;
    if (this.settings.mode === 'both' || this.settings.mode === 'chime') {
      this.playChime(batch.category);
    }
    if (this.settings.mode === 'both' || this.settings.mode === 'voice') {
      const clipIds = batch.cues.map((c) => c.clipId as AudioClipId);
      const delaySec = this.settings.mode === 'both' ? 0.16 : 0;
      void this.playClipSequence(clipIds, delaySec, batch.category === 'boss');
    }
  }

  async previewClip(category: CueCategory, clipId: AudioClipId) {
    await this.unlock();
    const mode = this.settings.mode;
    if (mode !== 'voice') {
      this.playChime(category, true);
    }
    if (mode !== 'chime') {
      const delaySec = mode === 'voice' ? 0 : 0.16;
      await this.playClipSequence([clipId], delaySec, true);
    }
  }
}

export const audioEngine = new DotaAudioEngine();
