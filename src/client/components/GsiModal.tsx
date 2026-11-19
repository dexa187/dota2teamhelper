import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../../shared/engine/cueScheduler';
import type { GsiNormalizedState } from '../../shared/types';

interface GsiModalProps {
  open: boolean;
  onClose: () => void;
  gsiState: GsiNormalizedState;
  gsiAutoSync: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  roomCode?: string | null;
}

export function GsiModal({
  open,
  onClose,
  gsiState,
  gsiAutoSync,
  onToggleAutoSync,
  roomCode,
}: GsiModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [simStatus, setSimStatus] = useState<string>('');
  const [copiedFlag, setCopiedFlag] = useState(false);

  // Sync open prop with native showModal()/close()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Native close listener + reset returnValue + light-dismiss fallback for browsers lacking closedby
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) {
          dialog.close('light-dismiss');
        }
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      return () => {
        dialog.removeEventListener('close', handleClose);
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  const simulateEvent = async (payload: Record<string, unknown>, label: string) => {
    setSimStatus('Sending...');
    try {
      const endpoint = roomCode
        ? `/api/rooms/${encodeURIComponent(roomCode)}/gsi/simulate`
        : '/api/gsi/simulate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSimStatus(`Simulated: ${label}`);
    } catch (err) {
      setSimStatus(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
    }
  };

  const copyLaunchFlag = async () => {
    try {
      await navigator.clipboard.writeText('-gamestateintegration');
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 2000);
    } catch {
      setCopiedFlag(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="gsi-modal-title"
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="modal-header">
        <h2 id="gsi-modal-title">Dota 2 Game State Integration (Optional Auto-Sync)</h2>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => dialogRef.current?.close('close')}
        >
          Close
        </button>
      </div>

      <div className="modal-body">
        {roomCode && (
          <div className="callout-banner" style={{ margin: 0 }}>
            Room <strong>{roomCode}</strong> active: GSI updates using this room&apos;s config file sync the match clock, pause state, and Roshan timer to all teammates in real time.
          </div>
        )}

        <label className="cue-switch-label" style={{ justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 9 }}>
          <span>
            <strong>Auto-sync match clock, pauses, my hero &amp; Roshan from GSI</strong>
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Note: Valve omits enemy picks in live matchmaking; pick enemies manually in Draft.
            </span>
          </span>
          <input
            type="checkbox"
            checked={gsiAutoSync}
            onChange={(e) => onToggleAutoSync(e.target.checked)}
            {...({ switch: '' } as Record<string, string>)}
          />
        </label>

        <div className="lane-side-box">
          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Setup Instructions (2 Steps)</div>
          <ol style={{ margin: '4px 0', paddingLeft: 18, fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>
              Download the config file and save it inside Dota 2&apos;s <code>gamestate_integration</code> folder:
              <div style={{ marginTop: 4 }}>
                <a
                  className="btn btn-sm btn-gold"
                  href={roomCode ? `/api/gsi/config?room=${encodeURIComponent(roomCode)}` : '/api/gsi/config'}
                  download={
                    roomCode
                      ? `gamestate_integration_dota2_helper_${roomCode}.cfg`
                      : 'gamestate_integration_dota2_helper.cfg'
                  }
                >
                  Download .cfg File
                </a>
              </div>
              <div className="code-block" style={{ marginTop: 6 }}>
                Linux: ~/.steam/steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/
                {'\n'}Windows: C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\
              </div>
            </li>
            <li>
              In Steam → Dota 2 → Properties → Launch Options, add:
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <code>-gamestateintegration</code>
                <button type="button" className="btn btn-sm" onClick={copyLaunchFlag}>
                  {copiedFlag ? 'Copied!' : 'Copy Flag'}
                </button>
              </div>
            </li>
          </ol>
        </div>

        <div className="lane-side-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.88rem' }}>Live GSI Telemetry</strong>
            <span className={`status-pill${gsiState.connected ? ' live' : ''}`}>
              {gsiState.connected ? 'Connected' : 'Waiting for Dota 2'}
            </span>
          </div>
          <div className="code-block tabular">
            Clock: {gsiState.clockTime !== null ? formatClock(gsiState.clockTime) : '--:--'} | Paused: {String(gsiState.paused)} | Side: {gsiState.faction ?? 'unknown'} | Hero: {gsiState.heroName ?? 'none'} | Roshan: {gsiState.roshanState ?? 'unknown'}
          </div>
        </div>

        <div className="lane-side-box">
          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Test GSI Without Launching Dota 2</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm btn-gold"
              onClick={() =>
                void simulateEvent(
                  { action: 'tick', clockTime: 344, heroName: 'npc_dota_hero_juggernaut', faction: 'radiant', paused: false },
                  '05:44 Pre-Power Rune + Juggernaut'
                )
              }
            >
              Simulate 05:44 + Juggernaut
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => void simulateEvent({ action: 'roshan_kill', clockTime: 720 }, 'Roshan Killed at 12:00')}
            >
              Simulate Roshan Kill
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                void simulateEvent({ action: 'pause', paused: !gsiState.paused }, gsiState.paused ? 'Unpaused' : 'Paused')
              }
            >
              Toggle GSI Pause
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void simulateEvent({ action: 'reset' }, 'Reset GSI')}
            >
              Reset GSI
            </button>
          </div>
          {simStatus && (
            <div style={{ fontSize: '0.78rem', color: 'var(--radiant)' }}>{simStatus}</div>
          )}
        </div>
      </div>
    </dialog>
  );
}
