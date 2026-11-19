import clipsData from './audioClips.json';
import type { CueId } from '../types';

export type VoicePackId = 'commander' | 'tactician';
export type AudioClipId = keyof typeof clipsData.clips;

export interface VoicePackInfo {
  id: VoicePackId;
  label: string;
  edgeVoice: string;
}

export const VOICE_PACKS = clipsData.voicePacks as VoicePackInfo[];
export const AUDIO_CLIPS = clipsData.clips as Record<AudioClipId, string>;

export function getClipUrl(voicePack: VoicePackId, clipId: AudioClipId): string {
  return `/audio/cues/${voicePack}/${clipId}.mp3`;
}

export function getDefaultClipIdForCue(cueId: CueId, leadSeconds: number): AudioClipId {
  const soon = leadSeconds > 0;
  switch (cueId) {
    case 'pull_small':
      return soon ? 'pull_small' : 'pull_small_now';
    case 'pull_large':
      return soon ? 'pull_large' : 'pull_large_now';
    case 'stack_camp':
      return soon ? 'stack_camp' : 'stack_camp_now';
    case 'water_rune':
      return soon ? 'water_rune' : 'water_rune_now';
    case 'power_rune':
      return soon ? 'power_rune' : 'power_rune_now';
    case 'bounty_rune':
      return soon ? 'bounty_rune' : 'bounty_rune_now';
    case 'lotus_pool':
      return soon ? 'lotus_pool' : 'lotus_pool_now';
    case 'wisdom_shrine':
      return soon ? 'wisdom_shrine' : 'wisdom_shrine_now';
    case 'catapult_wave':
      return soon ? 'catapult_wave' : 'catapult_wave_now';
    case 'day_night_pit':
      return 'day_night_top';
    case 'aghanims_shard':
      return soon ? 'aghanims_shard' : 'aghanims_shard_now';
    case 'neutral_tiers':
      return 'neutral_tier_2';
    case 'tormentor':
      return 'tormentor_first';
    case 'roshan':
      return 'roshan_window_open';
  }
}
