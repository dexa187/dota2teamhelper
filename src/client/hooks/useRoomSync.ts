import { useCallback, useEffect, useRef, useState } from 'react';
import { createInitialGsiState } from '../../server/gsi';
import type {
  Faction,
  GameMode,
  GsiNormalizedState,
  Position,
  RoomActionInput,
  RoomSnapshot,
} from '../../shared/types';

const CLIENT_ID_KEY = 'dota2_helper_client_id_v1';
const PLAYER_NAME_KEY = 'dota2_helper_player_name_v1';

function getOrCreateClientId(): string {
  try {
    const existing = sessionStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(CLIENT_ID_KEY, generated);
    return generated;
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function getInitialPlayerName(clientId: string): string {
  try {
    const tabSaved = sessionStorage.getItem(PLAYER_NAME_KEY);
    if (tabSaved && tabSaved.trim()) return tabSaved.trim().slice(0, 24);
    const saved = localStorage.getItem(PLAYER_NAME_KEY);
    if (saved && saved.trim()) return saved.trim().slice(0, 24);
  } catch {
    // Ignore storage issues
  }
  return `Player-${clientId.slice(0, 4).toUpperCase()}`;
}

function updateUrlRoomParam(code: string | null) {
  try {
    const url = new URL(window.location.href);
    if (code) {
      url.searchParams.set('room', code);
    } else {
      url.searchParams.delete('room');
    }
    window.history.replaceState(null, '', url.toString());
  } catch {
    // Ignore history API issues
  }
}

export type RoomConnectionStatus = 'solo' | 'connecting' | 'connected' | 'error';

export interface CreateRoomSeed {
  faction?: Faction;
  mode?: GameMode;
  allies?: number[];
  enemies?: number[];
  lockedPositions?: Partial<Record<Position, number>>;
  clockSeconds?: number;
  myHeroId?: number | null;
}

export function useRoomSync() {
  const [clientId] = useState<string>(getOrCreateClientId);
  const [playerName, setPlayerNameState] = useState<string>(() => getInitialPlayerName(clientId));
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [roomGsiState, setRoomGsiState] = useState<GsiNormalizedState>(createInitialGsiState);
  const [status, setStatus] = useState<RoomConnectionStatus>('solo');
  const [error, setError] = useState<string | null>(null);
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState<number>(0);

  const versionRef = useRef<number>(0);
  const playerNameRef = useRef<string>(playerName);
  playerNameRef.current = playerName;

  const applyRoomSnapshot = useCallback((snapshot: RoomSnapshot) => {
    if (snapshot.version < versionRef.current) return;
    versionRef.current = snapshot.version;
    setServerClockOffsetMs(snapshot.serverNowMs - Date.now());
    setRoom(snapshot);
  }, []);

  const joinRoom = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const normalized = rawCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{4,12}$/.test(normalized)) {
        setError('Enter a valid 4–12 character alphanumeric game code.');
        return false;
      }

      setError(null);
      setStatus('connecting');
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(normalized)}`);
        if (!res.ok) {
          setStatus(roomCode ? 'connected' : 'solo');
          setError(`Room "${normalized}" was not found on this server.`);
          return false;
        }
        const data = (await res.json()) as { room: RoomSnapshot };
        versionRef.current = 0;
        applyRoomSnapshot(data.room);
        setRoomCode(data.room.code);
        updateUrlRoomParam(data.room.code);
        return true;
      } catch (err) {
        setStatus(roomCode ? 'connected' : 'solo');
        setError(err instanceof Error ? err.message : 'Unable to reach room server.');
        return false;
      }
    },
    [applyRoomSnapshot, roomCode]
  );

  // Auto-join ?room=XXXXXX from invite link on initial mount
  useEffect(() => {
    const initialRoom = new URLSearchParams(window.location.search).get('room');
    if (initialRoom) {
      void joinRoom(initialRoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open SSE connection whenever roomCode is active
  useEffect(() => {
    if (!roomCode) {
      setStatus('solo');
      return;
    }

    setStatus('connecting');
    const qs = new URLSearchParams({
      clientId,
      name: playerNameRef.current,
    });
    const es = new EventSource(`/api/rooms/${encodeURIComponent(roomCode)}/stream?${qs.toString()}`);

    const onRoom = (event: MessageEvent) => {
      try {
        const snap = JSON.parse(event.data) as RoomSnapshot;
        applyRoomSnapshot(snap);
        setStatus('connected');
        setError(null);
      } catch {
        // Ignore malformed frame
      }
    };

    const onGsi = (event: MessageEvent) => {
      try {
        const next = JSON.parse(event.data) as GsiNormalizedState;
        setRoomGsiState(next);
      } catch {
        // Ignore malformed frame
      }
    };

    es.addEventListener('room', onRoom as EventListener);
    es.addEventListener('gsi', onGsi as EventListener);
    es.onerror = () => {
      setStatus((prev) => (prev === 'connected' ? 'connecting' : 'error'));
    };

    return () => {
      es.removeEventListener('room', onRoom as EventListener);
      es.removeEventListener('gsi', onGsi as EventListener);
      es.close();
    };
  }, [roomCode, clientId, applyRoomSnapshot]);

  const createRoom = useCallback(
    async (seed: CreateRoomSeed = {}): Promise<string | null> => {
      setError(null);
      setStatus('connecting');
      try {
        const body: Record<string, unknown> = {
          faction: seed.faction,
          mode: seed.mode,
          allies: seed.allies,
          enemies: seed.enemies,
          lockedPositions: seed.lockedPositions,
          clockSeconds: seed.clockSeconds,
        };
        if (seed.myHeroId) {
          body.initialClaim = {
            heroId: seed.myHeroId,
            clientId,
            playerName: playerNameRef.current,
          };
        }

        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { code: string; room: RoomSnapshot };
        versionRef.current = 0;
        applyRoomSnapshot(data.room);
        setRoomCode(data.code);
        updateUrlRoomParam(data.code);
        return data.code;
      } catch (err) {
        setStatus('solo');
        setError(err instanceof Error ? err.message : 'Failed to create room');
        return null;
      }
    },
    [clientId, applyRoomSnapshot]
  );

  const leaveRoom = useCallback(() => {
    versionRef.current = 0;
    setRoomCode(null);
    setRoom(null);
    setRoomGsiState(createInitialGsiState());
    setStatus('solo');
    setError(null);
    updateUrlRoomParam(null);
  }, []);

  const sendAction = useCallback(
    async (action: RoomActionInput) => {
      if (!roomCode) return;
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...action,
            clientId,
            playerName: playerNameRef.current,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { room?: RoomSnapshot };
          if (data.room) applyRoomSnapshot(data.room);
        }
      } catch {
        // SSE reconnect will reconcile state on recovery
      }
    },
    [roomCode, clientId, applyRoomSnapshot]
  );

  const setPlayerName = useCallback(
    async (rawName: string) => {
      const cleaned = rawName.trim().slice(0, 24) || `Player-${clientId.slice(0, 4).toUpperCase()}`;
      setPlayerNameState(cleaned);
      playerNameRef.current = cleaned;
      try {
        sessionStorage.setItem(PLAYER_NAME_KEY, cleaned);
        localStorage.setItem(PLAYER_NAME_KEY, cleaned);
      } catch {
        // Ignore storage error
      }
      if (roomCode) {
        try {
          const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/presence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, playerName: cleaned }),
          });
          if (res.ok) {
            const data = (await res.json()) as { room?: RoomSnapshot };
            if (data.room) applyRoomSnapshot(data.room);
          }
        } catch {
          // Ignore transient network error
        }
      }
    },
    [clientId, roomCode, applyRoomSnapshot]
  );

  return {
    clientId,
    playerName,
    setPlayerName,
    roomCode,
    room,
    roomGsiState,
    status,
    error,
    clearError: () => setError(null),
    serverClockOffsetMs,
    createRoom,
    joinRoom,
    leaveRoom,
    sendAction,
  };
}
