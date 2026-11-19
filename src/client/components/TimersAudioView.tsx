import { useEffect, useState } from 'react';
import { audioEngine, type AudioMode, type AudioSettings } from '../audio/audioEngine';
import { VOICE_PACKS, getDefaultClipIdForCue, type VoicePackId } from '../../shared/data/audioClips';
import { ROLE_PRESETS, TIMING_CUES } from '../../shared/data/timingPresets';
import { formatClock } from '../../shared/engine/cueScheduler';
import type {
  BossTrackerState,
  CueId,
  CueOverride,
  GameMode,
  RolePreset,
  UpcomingCue,
} from '../../shared/types';

interface TimersAudioViewProps {
  mode: GameMode;
  clockSeconds: number;
  bossState: BossTrackerState;
  bossTimers: {
    roshanStatus: {
      aliveState: 'alive' | 'window' | 'dead';
      aegisRemaining: number | null;
      minRemaining: number | null;
      maxRemaining: number | null;
    };
    tormentorNextAt: number;
    tormentorRemaining: number;
  };
  mapCycle: {
    isNight: boolean;
    roshanPit: string;
    tormentorCorner: string;
    secondsUntilSwap: number;
  };
  cueOverrides: Partial<Record<CueId, CueOverride>>;
  activePreset: RolePreset;
  upcomingCues: UpcomingCue[];
  onApplyPreset: (preset: RolePreset) => void;
  onUpdateCue: (id: CueId, patch: Partial<CueOverride>) => void;
  onResetDefaults: () => void;
  onRoshanKilled: () => void;
  onClearRoshan: () => void;
  onTormentorKilled: () => void;
  onClearTormentor: () => void;
}

export function TimersAudioView({
  mode,
  clockSeconds,
  bossState,
  bossTimers,
  mapCycle,
  cueOverrides,
  activePreset,
  upcomingCues,
  onApplyPreset,
  onUpdateCue,
  onResetDefaults,
  onRoshanKilled,
  onClearRoshan,
  onTormentorKilled,
  onClearTormentor,
}: TimersAudioViewProps) {
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => audioEngine.getSettings());

  useEffect(() => {
    return audioEngine.subscribe(() => {
      setAudioSettings(audioEngine.getSettings());
    });
  }, []);

  return (
    <section aria-label="Match Timers and Audio Cues">
      {/* Role Presets */}
      <div className="preset-bar">
        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          Role Audio Preset:
        </span>
        {(Object.keys(ROLE_PRESETS) as RolePreset[]).map((presetKey) => (
          <button
            key={presetKey}
            type="button"
            className={`filter-pill${activePreset === presetKey ? ' active' : ''}`}
            onClick={() => onApplyPreset(presetKey)}
          >
            {ROLE_PRESETS[presetKey].label}
          </button>
        ))}
        <button type="button" className="btn btn-sm" onClick={onResetDefaults} style={{ marginLeft: 'auto' }}>
          Reset Defaults
        </button>
      </div>

      <div className="timers-layout">
        {/* Left column: Audio Mixer + Boss/Map Cycle + Upcoming Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <article className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: '1.02rem' }}>Audio Callout Mixer</h2>
              <button
                type="button"
                className="btn btn-sm btn-gold"
                onClick={() => void audioEngine.previewClip('rune', 'power_rune')}
              >
                Test Voice &amp; Chime
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem' }}>
                Output Mode
                <select
                  className="pos-select"
                  value={audioSettings.mode}
                  onChange={(e) => {
                    void audioEngine.unlock();
                    audioEngine.updateSettings({ mode: e.target.value as AudioMode });
                  }}
                >
                  <option value="both">Voice + Chimes</option>
                  <option value="voice">Spoken Voice Only</option>
                  <option value="chime">Chimes Only</option>
                  <option value="muted">Muted (Visual Toast Only)</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem' }}>
                Volume ({Math.round(audioSettings.volume * 100)}%)
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audioSettings.volume}
                  onChange={(e) => audioEngine.updateSettings({ volume: Number(e.target.value) })}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem' }}>
                Voice Speed ({audioSettings.speechRate.toFixed(2)}x)
                <input
                  type="range"
                  min="0.85"
                  max="1.35"
                  step="0.05"
                  value={audioSettings.speechRate}
                  onChange={(e) => audioEngine.updateSettings({ speechRate: Number(e.target.value) })}
                />
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem' }}>
              Pre-Generated Voice Pack
              <select
                className="pos-select"
                value={audioSettings.voicePack}
                onChange={(e) => {
                  const pack = e.target.value as VoicePackId;
                  audioEngine.updateSettings({ voicePack: pack });
                  audioEngine.preloadCoreClips(pack);
                }}
              >
                {VOICE_PACKS.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.label}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Pre-generated neural MP3 clips — works consistently across desktop, mobile, and second monitors without browser TTS.
            </div>
          </article>

          <article className="card">
            <h2 style={{ margin: 0, fontSize: '1.02rem' }}>
              Boss &amp; Map Objectives ({mode === 'turbo' ? 'Turbo' : 'Regular'})
            </h2>

            <div className="lane-side-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{mapCycle.isNight ? '🌙 Nighttime' : '☀️ Daytime'}</strong>
                <span className="tabular" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Swaps in {formatClock(mapCycle.secondsUntilSwap)}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Roshan Pit: <strong style={{ color: 'var(--text-primary)' }}>{mapCycle.roshanPit}</strong>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Tormentor: <strong style={{ color: 'var(--text-primary)' }}>{mapCycle.tormentorCorner}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="lane-side-box">
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Roshan &amp; Aegis</div>
                {bossState.roshanKilledAt === null ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--radiant)' }}>Assumed Alive</div>
                ) : (
                  <div style={{ fontSize: '0.8rem' }} className="tabular">
                    <div>
                      Aegis:{' '}
                      {bossTimers.roshanStatus.aegisRemaining !== null
                        ? formatClock(bossTimers.roshanStatus.aegisRemaining)
                        : 'Expired'}
                    </div>
                    <div>
                      Respawn: {formatClock(bossTimers.roshanStatus.minRemaining ?? 0)} –{' '}
                      {formatClock(bossTimers.roshanStatus.maxRemaining ?? 0)}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button type="button" className="btn btn-sm btn-danger" onClick={onRoshanKilled}>
                    Killed Now
                  </button>
                  {bossState.roshanKilledAt !== null && (
                    <button type="button" className="btn btn-sm" onClick={onClearRoshan}>
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="lane-side-box">
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Tormentor</div>
                <div style={{ fontSize: '0.8rem' }} className="tabular">
                  {bossTimers.tormentorRemaining === 0 ? (
                    <span style={{ color: 'var(--gold)' }}>Up Now (Spawned {formatClock(bossTimers.tormentorNextAt)})</span>
                  ) : (
                    <span>
                      Next at {formatClock(bossTimers.tormentorNextAt)} (in{' '}
                      {formatClock(bossTimers.tormentorRemaining)})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button type="button" className="btn btn-sm btn-gold" onClick={onTormentorKilled}>
                    Killed Now
                  </button>
                  {bossState.tormentorKilledAt !== null && (
                    <button type="button" className="btn btn-sm" onClick={onClearTormentor}>
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          </article>

          <article className="card">
            <h2 style={{ margin: 0, fontSize: '1.02rem' }}>Upcoming Audio Queue</h2>
            {upcomingCues.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                No enabled cues scheduled in the next 7 minutes.
              </p>
            ) : (
              <div className="upcoming-list">
                {upcomingCues.slice(0, 8).map((cue) => {
                  const delta = Math.max(0, Math.ceil(cue.eventTime - clockSeconds));
                  return (
                    <div key={cue.key} className={`upcoming-row cat-${cue.category}`}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{cue.label}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                          {cue.announcement}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }} className="tabular">
                        <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--gold)' }}>
                          @{formatClock(cue.eventTime)}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          in {formatClock(delta)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </div>

        {/* Right column: Per-Cue Toggles & Editable Intervals */}
        <article className="card">
          <h2 style={{ margin: 0, fontSize: '1.02rem' }}>
            Timing Cue Schedule ({mode === 'turbo' ? 'Turbo Defaults' : 'Regular Defaults'})
          </h2>
          <div className="cue-table">
            {TIMING_CUES.map((def) => {
              const override = cueOverrides[def.id];
              const enabled = override?.enabled ?? def.defaultEnabled;
              const leadSeconds = override?.leadSeconds ?? def.defaultLeadSeconds;
              const modeCfg = mode === 'turbo' ? def.turbo : def.regular;
              const hasSimpleInterval =
                typeof modeCfg.interval === 'number' && !modeCfg.secondOffsets && def.id !== 'roshan' && def.id !== 'tormentor';
              const intervalVal = override?.intervalSeconds ?? modeCfg.interval;

              return (
                <div key={def.id} className="cue-config-row">
                  <div>
                    <label className="cue-switch-label">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => onUpdateCue(def.id, { enabled: e.target.checked })}
                        {...({ switch: '' } as Record<string, string>)}
                      />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{def.label}</span>
                    </label>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                      {def.description}
                    </div>
                  </div>

                  <div className="cue-inputs">
                    <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      Lead (s)
                      <input
                        type="number"
                        className="num-input tabular"
                        min={0}
                        max={90}
                        value={leadSeconds}
                        onChange={(e) =>
                          onUpdateCue(def.id, { leadSeconds: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                    </label>

                    {hasSimpleInterval && typeof intervalVal === 'number' && (
                      <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Interval (s)
                        <input
                          type="number"
                          className="num-input tabular"
                          min={15}
                          max={900}
                          step={15}
                          value={intervalVal}
                          onChange={(e) =>
                            onUpdateCue(def.id, {
                              intervalSeconds: Math.max(15, Number(e.target.value) || 60),
                            })
                          }
                        />
                      </label>
                    )}

                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        void audioEngine.previewClip(
                          def.category,
                          getDefaultClipIdForCue(def.id, leadSeconds)
                        )
                      }
                    >
                      Preview
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}
