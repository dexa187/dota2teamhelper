import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from '../audio/audioEngine';
import { ROLE_PRESETS, getBossTimingConstants, getMapCycleState } from '../../shared/data/timingPresets';
import { evaluateDueCues, getUpcomingEvents } from '../../shared/engine/cueScheduler';
import type {
  BossTrackerState,
  CueId,
  CueOverride,
  Faction,
  FiredCueBatch,
  GameMode,
  GsiNormalizedState,
  RolePreset,
  RoomActionInput,
  RoomClockState,
  UpcomingCue,
} from '../../shared/types';
import { createInitialGsiState } from '../../server/gsi';

interface RoomClockBridge {
  inRoom: boolean;
  clock: RoomClockState | null;
  bossState: BossTrackerState | null;
  gsiState: GsiNormalizedState | null;
  serverClockOffsetMs: number;
  sendAction: (action: RoomActionInput) => Promise<void>;
}

interface UseMatchClockOptions {
  mode: GameMode;
  room?: RoomClockBridge;
  onGsiMode?: (mode: GameMode) => void;
  onGsiFaction?: (faction: Faction) => void;
  onGsiHeroName?: (heroName: string) => void;
  onGsiTeams?: (allies: string[], enemies: string[]) => void;
}

const STORAGE_KEY = 'dota2_helper_cue_overrides_v1';

function loadSavedCueOverrides(): Partial<Record<CueId, CueOverride>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<CueId, CueOverride>>) : {};
  } catch {
    return {};
  }
}

export function useMatchClock(options: UseMatchClockOptions) {
  const { mode, room, onGsiMode, onGsiFaction, onGsiHeroName, onGsiTeams } = options;

  const [clockSeconds, setClockSeconds] = useState<number>(-30);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [localBossState, setLocalBossState] = useState<BossTrackerState>({
    roshanKilledAt: null,
    tormentorKilledAt: null,
  });
  const [cueOverrides, setCueOverrides] = useState<Partial<Record<CueId, CueOverride>>>(
    loadSavedCueOverrides
  );
  const [activePreset, setActivePreset] = useState<RolePreset>('all');
  const [gsiAutoSync, setGsiAutoSync] = useState<boolean>(true);
  const [localGsiState, setLocalGsiState] = useState<GsiNormalizedState>(createInitialGsiState);
  const [activeToast, setActiveToast] = useState<FiredCueBatch | null>(null);
  const [cueHistory, setCueHistory] = useState<FiredCueBatch[]>([]);

  const inRoom = Boolean(room?.inRoom);
  const bossState = inRoom && room?.bossState ? room.bossState : localBossState;
  const gsiState = inRoom && room?.gsiState ? room.gsiState : localGsiState;
  const effectiveRunning = inRoom && room?.clock ? room.clock.running : isRunning;

  const clockRef = useRef<number>(clockSeconds);
  const firedIdsRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);

  const callbacksRef = useRef({
    onGsiMode,
    onGsiFaction,
    onGsiHeroName,
    onGsiTeams,
    advanceAndEvaluate: (_next: number) => {},
  });
  callbacksRef.current.onGsiMode = onGsiMode;
  callbacksRef.current.onGsiFaction = onGsiFaction;
  callbacksRef.current.onGsiHeroName = onGsiHeroName;
  callbacksRef.current.onGsiTeams = onGsiTeams;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cueOverrides));
    } catch {
      // Ignore storage quota errors
    }
  }, [cueOverrides]);

  const fireBatches = useCallback((batches: FiredCueBatch[]) => {
    if (batches.length === 0) return;
    for (const batch of batches) {
      audioEngine.playBatch(batch);
      setActiveToast(batch);
      setCueHistory((prev) => [batch, ...prev].slice(0, 15));
    }
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setActiveToast(null);
    }, 6500);
  }, []);

  const advanceAndEvaluate = useCallback(
    (nextClock: number) => {
      const prevClock = clockRef.current;
      clockRef.current = nextClock;
      setClockSeconds(nextClock);

      if (nextClock > prevClock) {
        const { batches, newlyFiredIds } = evaluateDueCues(
          prevClock,
          nextClock,
          mode,
          cueOverrides,
          bossState,
          firedIdsRef.current
        );
        for (const id of newlyFiredIds) firedIdsRef.current.add(id);
        fireBatches(batches);
      }
    },
    [mode, cueOverrides, bossState, fireBatches]
  );

  callbacksRef.current.advanceAndEvaluate = advanceAndEvaluate;

  const computeRoomClockNow = useCallback(
    (rc: RoomClockState, offsetMs: number) => {
      if (!rc.running) return rc.baseClockSeconds;
      const nowServerMs = Date.now() + offsetMs;
      return rc.baseClockSeconds + Math.max(0, (nowServerMs - rc.updatedAtServerMs) / 1000);
    },
    []
  );

  // Sync clock immediately when room clock snapshot updates
  useEffect(() => {
    if (!inRoom || !room?.clock) return;
    const target = computeRoomClockNow(room.clock, room.serverClockOffsetMs);
    if (target < clockRef.current - 5) {
      firedIdsRef.current.clear();
    }
    callbacksRef.current.advanceAndEvaluate(target);
  }, [inRoom, room?.clock, room?.serverClockOffsetMs, computeRoomClockNow]);

  // Local timer tick loop (drives solo clock OR computes live room clock from server timestamp)
  useEffect(() => {
    if (!effectiveRunning) return;
    let lastTick = performance.now();
    const id = window.setInterval(() => {
      if (inRoom && room?.clock) {
        const nextClock = computeRoomClockNow(room.clock, room.serverClockOffsetMs);
        advanceAndEvaluate(nextClock);
        return;
      }
      const now = performance.now();
      const deltaSec = (now - lastTick) / 1000;
      lastTick = now;
      if (deltaSec > 0) {
        advanceAndEvaluate(clockRef.current + deltaSec);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [effectiveRunning, inRoom, room?.clock, room?.serverClockOffsetMs, computeRoomClockNow, advanceAndEvaluate]);

  // Live SSE stream from local GSI server (Solo mode only; Room mode receives GSI via room stream)
  useEffect(() => {
    if (inRoom) return;
    const es = new EventSource('/api/gsi/stream');
    const handleGsi = (event: MessageEvent) => {
      try {
        const next = JSON.parse(event.data) as GsiNormalizedState;
        setLocalGsiState(next);

        if (!next.connected || !gsiAutoSync) return;

        if (next.detectedMode) {
          callbacksRef.current.onGsiMode?.(next.detectedMode);
        }
        if (next.faction) {
          callbacksRef.current.onGsiFaction?.(next.faction);
        }
        if (next.heroName) {
          callbacksRef.current.onGsiHeroName?.(next.heroName);
        }
        if (next.teamAllies.length > 0 || next.teamEnemies.length > 0) {
          callbacksRef.current.onGsiTeams?.(next.teamAllies, next.teamEnemies);
        }
        if (next.roshanDiedAtClock !== null) {
          setLocalBossState((prev) =>
            prev.roshanKilledAt === next.roshanDiedAtClock
              ? prev
              : { ...prev, roshanKilledAt: next.roshanDiedAtClock }
          );
        }
        if (next.clockTime !== null) {
          if (Math.abs(next.clockTime - clockRef.current) > 1.5) {
            // Re-sync clock cleanly without dropping already-fired future protection if jumping backwards
            if (next.clockTime < clockRef.current - 5) {
              firedIdsRef.current.clear();
            }
            callbacksRef.current.advanceAndEvaluate(next.clockTime);
          }
        }
        setIsRunning(!next.paused && next.clockTime !== null);
      } catch {
        // Ignore malformed SSE frame
      }
    };

    es.addEventListener('gsi', handleGsi as EventListener);
    return () => {
      es.removeEventListener('gsi', handleGsi as EventListener);
      es.close();
    };
  }, [inRoom, gsiAutoSync]);

  const setManualClock = useCallback(
    (seconds: number) => {
      firedIdsRef.current.clear();
      if (inRoom && room) {
        void room.sendAction({ type: 'CLOCK_SET', seconds });
        return;
      }
      clockRef.current = seconds;
      setClockSeconds(seconds);
    },
    [inRoom, room]
  );

  const nudgeClock = useCallback(
    (delta: number) => {
      if (delta < 0) {
        firedIdsRef.current.clear();
      }
      if (inRoom && room) {
        void room.sendAction({ type: 'CLOCK_NUDGE', delta });
        return;
      }
      const target = clockRef.current + delta;
      clockRef.current = target;
      setClockSeconds(target);
    },
    [inRoom, room]
  );

  const togglePlay = useCallback(() => {
    void audioEngine.unlock();
    if (inRoom && room) {
      void room.sendAction({ type: effectiveRunning ? 'CLOCK_PAUSE' : 'CLOCK_START' });
      return;
    }
    setIsRunning((prev) => !prev);
  }, [inRoom, room, effectiveRunning]);

  const markRoshanKilled = useCallback(() => {
    void audioEngine.unlock();
    if (inRoom && room) {
      void room.sendAction({ type: 'BOSS_ROSHAN_KILL' });
      return;
    }
    const killedAt = Math.max(0, Math.floor(clockRef.current));
    setLocalBossState((prev) => ({ ...prev, roshanKilledAt: killedAt }));
  }, [inRoom, room]);

  const clearRoshan = useCallback(() => {
    if (inRoom && room) {
      void room.sendAction({ type: 'BOSS_ROSHAN_CLEAR' });
      return;
    }
    setLocalBossState((prev) => ({ ...prev, roshanKilledAt: null }));
  }, [inRoom, room]);

  const markTormentorKilled = useCallback(() => {
    void audioEngine.unlock();
    if (inRoom && room) {
      void room.sendAction({ type: 'BOSS_TORMENTOR_KILL' });
      return;
    }
    const killedAt = Math.max(0, Math.floor(clockRef.current));
    setLocalBossState((prev) => ({ ...prev, tormentorKilledAt: killedAt }));
  }, [inRoom, room]);

  const clearTormentor = useCallback(() => {
    if (inRoom && room) {
      void room.sendAction({ type: 'BOSS_TORMENTOR_CLEAR' });
      return;
    }
    setLocalBossState((prev) => ({ ...prev, tormentorKilledAt: null }));
  }, [inRoom, room]);

  const updateCueOverride = useCallback((id: CueId, patch: Partial<CueOverride>) => {
    setCueOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }, []);

  const applyRolePreset = useCallback((preset: RolePreset) => {
    setActivePreset(preset);
    const enabledSet = new Set(ROLE_PRESETS[preset].enabledCues);
    setCueOverrides((prev) => {
      const next: Partial<Record<CueId, CueOverride>> = { ...prev };
      for (const id of ROLE_PRESETS.all.enabledCues) {
        next[id] = { ...next[id], enabled: enabledSet.has(id) };
      }
      return next;
    });
  }, []);

  const resetCueDefaults = useCallback(() => {
    setCueOverrides({});
    setActivePreset('all');
  }, []);

  const upcomingCues: UpcomingCue[] = useMemo(
    () => getUpcomingEvents(Math.floor(clockSeconds), mode, cueOverrides, bossState, 420),
    [clockSeconds, mode, cueOverrides, bossState]
  );

  const mapCycle = useMemo(() => getMapCycleState(clockSeconds), [clockSeconds]);

  const bossTimers = useMemo(() => {
    const constants = getBossTimingConstants(mode);
    const now = Math.floor(clockSeconds);

    let roshanStatus: {
      aliveState: 'alive' | 'window' | 'dead';
      aegisRemaining: number | null;
      minRemaining: number | null;
      maxRemaining: number | null;
    } = { aliveState: 'alive', aegisRemaining: null, minRemaining: null, maxRemaining: null };

    if (bossState.roshanKilledAt !== null) {
      const elapsed = Math.max(0, now - bossState.roshanKilledAt);
      const aegisRemaining = Math.max(0, constants.aegisDuration - elapsed);
      const minRemaining = Math.max(0, constants.roshanMinRespawn - elapsed);
      const maxRemaining = Math.max(0, constants.roshanMaxRespawn - elapsed);

      if (maxRemaining === 0) {
        roshanStatus = {
          aliveState: 'alive',
          aegisRemaining: null,
          minRemaining: 0,
          maxRemaining: 0,
        };
      } else {
        roshanStatus = {
          aliveState: minRemaining === 0 ? 'window' : 'dead',
          aegisRemaining: aegisRemaining > 0 ? aegisRemaining : null,
          minRemaining,
          maxRemaining,
        };
      }
    }

    const tormentorNextAt =
      bossState.tormentorKilledAt !== null
        ? bossState.tormentorKilledAt + constants.tormentorRespawn
        : constants.tormentorFirstSpawn;
    const tormentorRemaining = Math.max(0, tormentorNextAt - now);

    return { roshanStatus, tormentorNextAt, tormentorRemaining };
  }, [bossState, clockSeconds, mode]);

  return {
    clockSeconds,
    isRunning: effectiveRunning,
    bossState,
    bossTimers,
    mapCycle,
    cueOverrides,
    activePreset,
    upcomingCues,
    gsiAutoSync,
    setGsiAutoSync,
    gsiState,
    activeToast,
    dismissToast: () => setActiveToast(null),
    cueHistory,
    setManualClock,
    nudgeClock,
    togglePlay,
    markRoshanKilled,
    clearRoshan,
    markTormentorKilled,
    clearTormentor,
    updateCueOverride,
    applyRolePreset,
    resetCueDefaults,
  };
}
