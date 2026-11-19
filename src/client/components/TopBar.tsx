import { useState } from 'react';
import { audioEngine, type AudioMode } from '../audio/audioEngine';
import { formatClock } from '../../shared/engine/cueScheduler';
import type { GameMode, GsiNormalizedState, UpcomingCue } from '../../shared/types';

interface TopBarProps {
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  clockSeconds: number;
  isRunning: boolean;
  onTogglePlay: () => void;
  onSyncZero: () => void;
  onNudgeClock: (delta: number) => void;
  onSetClock: (seconds: number) => void;
  onRoshanKilled: () => void;
  onTormentorKilled: () => void;
  roshanStatus: {
    aliveState: 'alive' | 'window' | 'dead';
    aegisRemaining: number | null;
    minRemaining: number | null;
    maxRemaining: number | null;
  };
  tormentorRemaining: number;
  upcomingCues: UpcomingCue[];
  audioMode: AudioMode;
  onToggleMute: () => void;
  gsiState: GsiNormalizedState;
  onOpenGsiModal: () => void;
  roomCode: string | null;
  roomMemberCount: number;
  onOpenRoomModal: () => void;
}

function parseClockInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const neg = trimmed.startsWith('-');
    const clean = neg ? trimmed.slice(1) : trimmed;
    const [mStr, sStr] = clean.split(':');
    const mins = Number(mStr);
    const secs = Number(sStr);
    if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
    const total = mins * 60 + secs;
    return neg ? -total : total;
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export function TopBar({
  mode,
  onModeChange,
  clockSeconds,
  isRunning,
  onTogglePlay,
  onSyncZero,
  onNudgeClock,
  onSetClock,
  onRoshanKilled,
  onTormentorKilled,
  roshanStatus,
  tormentorRemaining,
  upcomingCues,
  audioMode,
  onToggleMute,
  gsiState,
  onOpenGsiModal,
  roomCode,
  roomMemberCount,
  onOpenRoomModal,
}: TopBarProps) {
  const [editingClock, setEditingClock] = useState(false);
  const [clockDraft, setClockDraft] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  const copyRoomInvite = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?room=${roomCode}`);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const nextCue = upcomingCues[0];
  const nextDelta = nextCue ? Math.max(0, Math.ceil(nextCue.eventTime - clockSeconds)) : null;

  const commitClock = () => {
    const parsed = parseClockInput(clockDraft);
    if (parsed !== null) {
      onSetClock(parsed);
    }
    setEditingClock(false);
  };

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <h1 className="brand-title">
          <span aria-hidden="true">⚔️</span>
          Dota 2 Team Helper
        </h1>
        <div className="mode-segmented" role="group" aria-label="Game Mode">
          <button
            type="button"
            className={`mode-btn${mode === 'regular' ? ' active-regular' : ''}`}
            aria-pressed={mode === 'regular'}
            onClick={() => onModeChange('regular')}
          >
            Regular
          </button>
          <button
            type="button"
            className={`mode-btn${mode === 'turbo' ? ' active-turbo' : ''}`}
            aria-pressed={mode === 'turbo'}
            onClick={() => onModeChange('turbo')}
          >
            Turbo
          </button>
        </div>
      </div>

      <div className="clock-cluster" aria-label="Match Timer Controls">
        {editingClock ? (
          <input
            type="text"
            className="clock-input tabular"
            aria-label="Enter match time in MM:SS"
            value={clockDraft}
            autoFocus
            onChange={(e) => setClockDraft(e.target.value)}
            onBlur={commitClock}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitClock();
              if (e.key === 'Escape') setEditingClock(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="clock-readout tabular"
            title="Click to edit match clock (MM:SS)"
            onClick={() => {
              setClockDraft(formatClock(clockSeconds));
              setEditingClock(true);
            }}
          >
            {formatClock(clockSeconds)}
          </button>
        )}

        <button type="button" className="btn btn-sm btn-gold" onClick={onTogglePlay}>
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button type="button" className="btn btn-sm" onClick={onSyncZero} title="Reset clock to 0:00 horn">
          0:00
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onNudgeClock(-10)} title="Rewind 10 seconds">
          -10s
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onNudgeClock(10)} title="Advance 10 seconds">
          +10s
        </button>
      </div>

      <div className="topbar-right">
        <button type="button" className="btn btn-sm btn-danger" onClick={onRoshanKilled}>
          Roshan Killed
        </button>
        {roshanStatus.aliveState !== 'alive' && (
          <span className="status-pill boss tabular">
            {roshanStatus.aegisRemaining !== null
              ? `Aegis ${formatClock(roshanStatus.aegisRemaining)} · `
              : ''}
            Rosh {formatClock(roshanStatus.minRemaining ?? 0)}–{formatClock(roshanStatus.maxRemaining ?? 0)}
          </span>
        )}

        <button type="button" className="btn btn-sm" onClick={onTormentorKilled}>
          Tormentor ({tormentorRemaining === 0 ? 'UP' : formatClock(tormentorRemaining)})
        </button>

        {nextCue && nextDelta !== null && (
          <span className="status-pill next-cue tabular" title={nextCue.announcement}>
            Next: {nextCue.label} ({formatClock(nextDelta)})
          </span>
        )}

        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            void audioEngine.unlock();
            onToggleMute();
          }}
        >
          {audioMode === 'muted' ? 'Audio: Muted' : 'Audio: On'}
        </button>

        <button
          type="button"
          className={`status-pill${gsiState.connected ? ' live' : ''}`}
          onClick={onOpenGsiModal}
        >
          {gsiState.connected ? 'GSI Connected' : 'GSI Setup'}
        </button>

        {roomCode ? (
          <>
            <button
              type="button"
              className="status-pill live"
              onClick={onOpenRoomModal}
              title="Open Team Room settings & player list"
            >
              Room: {roomCode} · {roomMemberCount} online
            </button>
            <button type="button" className="btn btn-sm" onClick={() => void copyRoomInvite()}>
              {copiedInvite ? 'Link Copied!' : 'Copy Link'}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm btn-gold" onClick={onOpenRoomModal}>
            Team Room / Code
          </button>
        )}
      </div>
    </header>
  );
}
