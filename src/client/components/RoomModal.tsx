import { useEffect, useMemo, useRef, useState } from 'react';
import type { HeroRecord, RoomSnapshot } from '../../shared/types';
import type { RoomConnectionStatus } from '../hooks/useRoomSync';

interface RoomModalProps {
  open: boolean;
  onClose: () => void;
  room: RoomSnapshot | null;
  status: RoomConnectionStatus;
  error: string | null;
  clientId: string;
  playerName: string;
  heroes: HeroRecord[];
  onSaveName: (name: string) => Promise<void> | void;
  onCreateRoom: () => Promise<void> | void;
  onJoinRoom: (code: string) => Promise<boolean> | void;
  onLeaveRoom: () => void;
  onClearError: () => void;
}

export function RoomModal({
  open,
  onClose,
  room,
  status,
  error,
  clientId,
  playerName,
  heroes,
  onSaveName,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onClearError,
}: RoomModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [nameDraft, setNameDraft] = useState(playerName);
  const [joinCode, setJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [savedNameFlash, setSavedNameFlash] = useState(false);

  useEffect(() => {
    setNameDraft(playerName);
  }, [playerName]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

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

  const heroMap = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);

  const claimedHeroByClient = useMemo(() => {
    const map = new Map<string, string>();
    if (!room) return map;
    for (const [heroIdStr, claim] of Object.entries(room.heroClaims)) {
      const hero = heroMap.get(Number(heroIdStr));
      if (hero) map.set(claim.clientId, hero.localizedName);
    }
    return map;
  }, [room, heroMap]);

  const inviteUrl = room ? `${window.location.origin}/?room=${room.code}` : '';

  const copyText = async (text: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1800);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1800);
      }
    } catch {
      // Clipboard unavailable
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveName(nameDraft);
    setSavedNameFlash(true);
    setTimeout(() => setSavedNameFlash(false), 1500);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onJoinRoom(joinCode);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="room-modal-title"
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="modal-header">
        <h2 id="room-modal-title">
          {room ? `Team Room: ${room.code}` : 'Team Room & Real-Time Game Code'}
        </h2>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => dialogRef.current?.close('close')}
        >
          Close
        </button>
      </div>

      <div className="modal-body">
        <form onSubmit={handleSaveName} className="lane-side-box">
          <label style={{ fontSize: '0.84rem', fontWeight: 700 }} htmlFor="room-player-name">
            Your Display Name
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              id="room-player-name"
              type="text"
              className="search-input"
              style={{ minWidth: 180 }}
              maxLength={24}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Enter your nickname..."
            />
            <button type="submit" className="btn btn-sm btn-gold">
              {savedNameFlash ? 'Saved!' : 'Update Name'}
            </button>
          </div>
        </form>

        {error && (
          <div className="callout-banner" style={{ margin: 0, borderColor: 'var(--dire)', color: '#fecaca', background: 'var(--dire-soft)' }} role="alert">
            {error}
          </div>
        )}

        {!room ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div className="lane-side-box">
              <strong style={{ fontSize: '0.92rem' }}>Host a New Team Room</strong>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Generates a shareable 6-character Game Code &amp; invite link. Any hero picks, lane locks, Regular/Turbo switches, and match clock updates sync instantly to all teammates.
              </p>
              <button
                type="button"
                className="btn btn-gold"
                disabled={status === 'connecting'}
                onClick={() => void onCreateRoom()}
              >
                {status === 'connecting' ? 'Creating Room...' : 'Create Team Room'}
              </button>
            </div>

            <form onSubmit={handleJoinSubmit} className="lane-side-box">
              <strong style={{ fontSize: '0.92rem' }}>Join with Game Code</strong>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Enter the code shared by a teammate to sync into their live draft and timers.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="search-input tabular"
                  style={{ minWidth: 120, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}
                  aria-label="Game Code"
                  placeholder="e.g. K7M9XP"
                  maxLength={12}
                  value={joinCode}
                  onChange={(e) => {
                    if (error) onClearError();
                    setJoinCode(e.target.value.toUpperCase());
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-radiant"
                  disabled={status === 'connecting' || !joinCode.trim()}
                >
                  Join
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="lane-side-box">
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Shareable Game Code
                  </div>
                  <div className="room-code-display tabular">{room.code}</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void copyText(room.code, 'code')}
                  >
                    {copiedCode ? 'Code Copied!' : 'Copy Code'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-gold"
                    onClick={() => void copyText(inviteUrl, 'link')}
                  >
                    {copiedLink ? 'Invite Link Copied!' : 'Copy Invite Link'}
                  </button>
                </div>
              </div>
              <div className="code-block" style={{ marginTop: 4 }}>
                {inviteUrl}
              </div>
            </div>

            <div className="lane-side-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.88rem' }}>
                  Connected Teammates ({room.members.length} online)
                </strong>
                <span className={`status-pill${status === 'connected' ? ' live' : ''}`}>
                  {status === 'connected' ? 'Real-Time Sync Active' : 'Reconnecting...'}
                </span>
              </div>
              <div className="member-pill-list">
                {room.members.map((m) => {
                  const claimedHero = claimedHeroByClient.get(m.clientId);
                  const isSelf = m.clientId === clientId;
                  return (
                    <span
                      key={m.clientId}
                      className={`status-pill${isSelf ? ' live' : ''}`}
                    >
                      <span>
                        {m.playerName}
                        {isSelf ? ' (You)' : ''}
                      </span>
                      {claimedHero && (
                        <strong style={{ color: 'var(--gold)' }}>· {claimedHero}</strong>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {room.recentActivity.length > 0 && (
              <div className="lane-side-box">
                <strong style={{ fontSize: '0.84rem' }}>Recent Activity</strong>
                <ul className="activity-log">
                  {room.recentActivity.slice(0, 6).map((item) => (
                    <li key={item.id}>{item.text}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={onLeaveRoom}
              >
                Leave Room (Return to Solo)
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
