import { useCallback, useEffect, useMemo, useState } from 'react';
import snapshotJson from '../shared/data/opendota-snapshot.json';
import { buildHeroCatalog } from '../shared/data/heroTactics';
import { recommendLanes } from '../shared/engine/laneRecommender';
import { recommendTeamItems } from '../shared/engine/itemRecommender';
import { audioEngine, type AudioMode } from './audio/audioEngine';
import { useMatchClock } from './hooks/useMatchClock';
import { useRoomSync } from './hooks/useRoomSync';
import { TopBar } from './components/TopBar';
import { DraftBoard } from './components/DraftBoard';
import { LaneView } from './components/LaneView';
import { ItemBuildsView } from './components/ItemBuildsView';
import { TimersAudioView } from './components/TimersAudioView';
import { GsiModal } from './components/GsiModal';
import { RoomModal } from './components/RoomModal';
import { CueToastBanner } from './components/CueToastBanner';
import type {
  DraftState,
  Faction,
  GameMode,
  HeroRecord,
  OpenDotaSnapshot,
  Position,
} from '../shared/types';

type ActiveTab = 'draft' | 'lanes' | 'items' | 'timers';

const DRAFT_STORAGE_KEY = 'dota2_helper_draft_v1';
const INITIAL_HEROES = buildHeroCatalog(snapshotJson as OpenDotaSnapshot);

function loadDraft(): DraftState {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DraftState;
      if (parsed && Array.isArray(parsed.allies) && Array.isArray(parsed.enemies)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage issues
  }
  return {
    faction: 'radiant',
    mode: 'regular',
    allies: [],
    enemies: [],
    myHeroId: null,
    lockedPositions: {},
  };
}

export function App() {
  const [heroes, setHeroes] = useState<HeroRecord[]>(INITIAL_HEROES);
  const [soloDraft, setSoloDraft] = useState<DraftState>(loadDraft);
  const [activeTab, setActiveTab] = useState<ActiveTab>('draft');
  const [gsiModalOpen, setGsiModalOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>(() => audioEngine.getSettings().mode);
  const [liveMatchups, setLiveMatchups] = useState<Record<number, Record<number, number>>>({});

  const roomSync = useRoomSync();
  const inRoom = Boolean(roomSync.room);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(soloDraft));
    } catch {
      // Ignore quota errors
    }
  }, [soloDraft]);

  useEffect(() => {
    return audioEngine.subscribe(() => {
      setAudioMode(audioEngine.getSettings().mode);
    });
  }, []);

  // Hydrate fresh OpenDota data if server has newer cache
  useEffect(() => {
    let active = true;
    fetch('/api/dota/data')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data && Array.isArray(data.heroes) && data.heroes.length > 0) {
          setHeroes(data.heroes as HeroRecord[]);
        }
      })
      .catch(() => {
        // Bundled snapshot already loaded
      });
    return () => {
      active = false;
    };
  }, []);

  const heroById = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const heroByName = useMemo(() => new Map(heroes.map((h) => [h.name, h])), [heroes]);

  const effectiveDraft: DraftState = useMemo(() => {
    if (!roomSync.room) return soloDraft;
    let claimedHeroId: number | null = null;
    for (const [heroIdStr, claim] of Object.entries(roomSync.room.heroClaims)) {
      if (claim.clientId === roomSync.clientId) {
        claimedHeroId = Number(heroIdStr);
        break;
      }
    }
    return {
      faction: roomSync.room.faction,
      mode: roomSync.room.mode,
      allies: roomSync.room.allies,
      enemies: roomSync.room.enemies,
      myHeroId: claimedHeroId,
      lockedPositions: roomSync.room.lockedPositions,
    };
  }, [roomSync.room, roomSync.clientId, soloDraft]);

  // Optional background OpenDota matchup winrate fetch for drafted allies
  useEffect(() => {
    for (const heroId of effectiveDraft.allies) {
      if (liveMatchups[heroId]) continue;
      fetch(`/api/dota/hero/${heroId}/matchups`)
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (res && res.matchups) {
            setLiveMatchups((prev) => ({ ...prev, [heroId]: res.matchups }));
          }
        })
        .catch(() => {});
    }
  }, [effectiveDraft.allies, liveMatchups]);

  const handleGsiHeroName = useCallback(
    (heroName: string) => {
      const hero = heroByName.get(heroName);
      if (!hero) return;
      setSoloDraft((prev) => {
        const nextAllies = prev.allies.includes(hero.id)
          ? prev.allies
          : prev.allies.length < 5
          ? [...prev.allies, hero.id]
          : prev.allies;
        if (prev.myHeroId === hero.id && nextAllies === prev.allies) return prev;
        return {
          ...prev,
          allies: nextAllies,
          enemies: prev.enemies.filter((id) => id !== hero.id),
          myHeroId: hero.id,
        };
      });
    },
    [heroByName]
  );

  const handleGsiTeams = useCallback(
    (allyNames: string[], enemyNames: string[]) => {
      const allyIds = allyNames
        .map((n) => heroByName.get(n)?.id)
        .filter((id): id is number => typeof id === 'number')
        .slice(0, 5);
      const enemyIds = enemyNames
        .map((n) => heroByName.get(n)?.id)
        .filter((id): id is number => typeof id === 'number')
        .slice(0, 5);
      if (allyIds.length === 0 && enemyIds.length === 0) return;
      setSoloDraft((prev) => ({
        ...prev,
        allies: allyIds.length > 0 ? allyIds : prev.allies,
        enemies: enemyIds.length > 0 ? enemyIds : prev.enemies,
      }));
    },
    [heroByName]
  );

  const roomClockBridge = useMemo(
    () => ({
      inRoom,
      clock: roomSync.room?.clock ?? null,
      bossState: roomSync.room?.bossState ?? null,
      gsiState: inRoom ? roomSync.roomGsiState : null,
      serverClockOffsetMs: roomSync.serverClockOffsetMs,
      sendAction: roomSync.sendAction,
    }),
    [
      inRoom,
      roomSync.room?.clock,
      roomSync.room?.bossState,
      roomSync.roomGsiState,
      roomSync.serverClockOffsetMs,
      roomSync.sendAction,
    ]
  );

  const clock = useMatchClock({
    mode: effectiveDraft.mode,
    room: roomClockBridge,
    onGsiMode: (mode) => setSoloDraft((prev) => (prev.mode === mode ? prev : { ...prev, mode })),
    onGsiFaction: (faction) =>
      setSoloDraft((prev) => (prev.faction === faction ? prev : { ...prev, faction })),
    onGsiHeroName: handleGsiHeroName,
    onGsiTeams: handleGsiTeams,
  });

  const allyHeroes = useMemo(
    () => effectiveDraft.allies.map((id) => heroById.get(id)).filter((h): h is HeroRecord => Boolean(h)),
    [effectiveDraft.allies, heroById]
  );

  const enemyHeroes = useMemo(
    () => effectiveDraft.enemies.map((id) => heroById.get(id)).filter((h): h is HeroRecord => Boolean(h)),
    [effectiveDraft.enemies, heroById]
  );

  const lanePlan = useMemo(
    () =>
      recommendLanes({
        allies: allyHeroes,
        enemies: enemyHeroes,
        faction: effectiveDraft.faction,
        mode: effectiveDraft.mode,
        lockedPositions: effectiveDraft.lockedPositions,
        liveMatchups,
      }),
    [
      allyHeroes,
      enemyHeroes,
      effectiveDraft.faction,
      effectiveDraft.mode,
      effectiveDraft.lockedPositions,
      liveMatchups,
    ]
  );

  const itemRecommendations = useMemo(
    () =>
      recommendTeamItems({
        lanePlan,
        allies: allyHeroes,
        enemies: enemyHeroes,
        mode: effectiveDraft.mode,
        myHeroId: effectiveDraft.myHeroId,
      }),
    [lanePlan, allyHeroes, enemyHeroes, effectiveDraft.mode, effectiveDraft.myHeroId]
  );

  const handleSetMode = (mode: GameMode) => {
    if (inRoom) {
      void roomSync.sendAction({ type: 'SET_MODE', mode });
    } else {
      setSoloDraft((prev) => ({ ...prev, mode }));
    }
  };

  const handleSetFaction = (faction: Faction) => {
    if (inRoom) {
      void roomSync.sendAction({ type: 'SET_FACTION', faction });
    } else {
      setSoloDraft((prev) => ({ ...prev, faction }));
    }
  };

  const handleAddHero = (side: 'ally' | 'enemy', heroId: number) => {
    if (inRoom) {
      void roomSync.sendAction({
        type: 'ADD_HERO',
        side,
        heroId,
        heroName: heroById.get(heroId)?.localizedName,
      });
      return;
    }
    setSoloDraft((prev) => {
      if (side === 'ally') {
        if (prev.allies.includes(heroId) || prev.allies.length >= 5) return prev;
        return {
          ...prev,
          allies: [...prev.allies, heroId],
          enemies: prev.enemies.filter((id) => id !== heroId),
        };
      }
      if (prev.enemies.includes(heroId) || prev.enemies.length >= 5) return prev;
      return {
        ...prev,
        enemies: [...prev.enemies, heroId],
        allies: prev.allies.filter((id) => id !== heroId),
      };
    });
  };

  const handleRemoveHero = (side: 'ally' | 'enemy', heroId: number) => {
    if (inRoom) {
      void roomSync.sendAction({
        type: 'REMOVE_HERO',
        side,
        heroId,
        heroName: heroById.get(heroId)?.localizedName,
      });
      return;
    }
    setSoloDraft((prev) => {
      if (side === 'ally') {
        const nextLocks = { ...prev.lockedPositions };
        for (const p of [1, 2, 3, 4, 5] as Position[]) {
          if (nextLocks[p] === heroId) delete nextLocks[p];
        }
        return {
          ...prev,
          allies: prev.allies.filter((id) => id !== heroId),
          myHeroId: prev.myHeroId === heroId ? null : prev.myHeroId,
          lockedPositions: nextLocks,
        };
      }
      return {
        ...prev,
        enemies: prev.enemies.filter((id) => id !== heroId),
      };
    });
  };

  const handleSetMyHero = (myHeroId: number | null) => {
    if (inRoom) {
      void roomSync.sendAction({
        type: 'CLAIM_HERO',
        heroId: myHeroId,
        heroName: myHeroId ? heroById.get(myHeroId)?.localizedName : undefined,
      });
      return;
    }
    setSoloDraft((prev) => ({ ...prev, myHeroId }));
  };

  const handleSetLockedPosition = (pos: Position, heroId: number | null) => {
    if (inRoom) {
      void roomSync.sendAction({ type: 'LOCK_POSITION', pos, heroId });
      return;
    }
    setSoloDraft((prev) => {
      const next = { ...prev.lockedPositions };
      if (heroId === null) {
        delete next[pos];
      } else {
        for (const p of [1, 2, 3, 4, 5] as Position[]) {
          if (next[p] === heroId) delete next[p];
        }
        next[pos] = heroId;
      }
      return { ...prev, lockedPositions: next };
    });
  };

  const handleUnlockAll = () => {
    if (inRoom) {
      void roomSync.sendAction({ type: 'UNLOCK_ALL_POSITIONS' });
    } else {
      setSoloDraft((prev) => ({ ...prev, lockedPositions: {} }));
    }
  };

  const handleClearDraft = () => {
    if (inRoom) {
      void roomSync.sendAction({ type: 'CLEAR_DRAFT' });
    } else {
      setSoloDraft((prev) => ({
        ...prev,
        allies: [],
        enemies: [],
        myHeroId: null,
        lockedPositions: {},
      }));
    }
  };

  const handleLoadSampleDraft = () => {
    const pickIds = (names: string[]) =>
      names.map((n) => heroByName.get(n)?.id).filter((id): id is number => typeof id === 'number');

    const sampleAllies = pickIds([
      'npc_dota_hero_juggernaut',
      'npc_dota_hero_storm_spirit',
      'npc_dota_hero_axe',
      'npc_dota_hero_earthshaker',
      'npc_dota_hero_crystal_maiden',
    ]);
    const sampleEnemies = pickIds([
      'npc_dota_hero_phantom_assassin',
      'npc_dota_hero_zuus',
      'npc_dota_hero_bristleback',
      'npc_dota_hero_riki',
      'npc_dota_hero_lion',
    ]);

    if (inRoom) {
      void roomSync.sendAction({
        type: 'LOAD_SAMPLE_DRAFT',
        allies: sampleAllies,
        enemies: sampleEnemies,
      });
      return;
    }

    setSoloDraft((prev) => ({
      ...prev,
      allies: sampleAllies,
      enemies: sampleEnemies,
      myHeroId: sampleAllies[0] ?? null,
      lockedPositions: {},
    }));
  };

  const handleCreateRoom = async () => {
    await roomSync.createRoom({
      faction: soloDraft.faction,
      mode: soloDraft.mode,
      allies: soloDraft.allies,
      enemies: soloDraft.enemies,
      lockedPositions: soloDraft.lockedPositions,
      clockSeconds: clock.clockSeconds,
      myHeroId: soloDraft.myHeroId,
    });
  };

  const handleToggleMute = () => {
    const nextMode: AudioMode = audioMode === 'muted' ? 'both' : 'muted';
    audioEngine.updateSettings({ mode: nextMode });
  };

  return (
    <div className="app-shell">
      <TopBar
        mode={effectiveDraft.mode}
        onModeChange={handleSetMode}
        clockSeconds={clock.clockSeconds}
        isRunning={clock.isRunning}
        onTogglePlay={clock.togglePlay}
        onSyncZero={() => clock.setManualClock(0)}
        onNudgeClock={clock.nudgeClock}
        onSetClock={clock.setManualClock}
        onRoshanKilled={clock.markRoshanKilled}
        onTormentorKilled={clock.markTormentorKilled}
        roshanStatus={clock.bossTimers.roshanStatus}
        tormentorRemaining={clock.bossTimers.tormentorRemaining}
        upcomingCues={clock.upcomingCues}
        audioMode={audioMode}
        onToggleMute={handleToggleMute}
        gsiState={clock.gsiState}
        onOpenGsiModal={() => setGsiModalOpen(true)}
        roomCode={roomSync.roomCode}
        roomMemberCount={roomSync.room?.members.length ?? 0}
        onOpenRoomModal={() => setRoomModalOpen(true)}
      />

      <nav className="nav-tabs" role="tablist" aria-label="Helper Views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'draft'}
          className="nav-tab"
          onClick={() => setActiveTab('draft')}
        >
          Draft
          <span className="badge-count">
            {effectiveDraft.allies.length}v{effectiveDraft.enemies.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'lanes'}
          className="nav-tab"
          onClick={() => setActiveTab('lanes')}
        >
          Lanes &amp; Matchups
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'items'}
          className="nav-tab"
          onClick={() => setActiveTab('items')}
        >
          Counter Items
          {itemRecommendations.teamDuties.length > 0 && (
            <span className="badge-count">{itemRecommendations.teamDuties.length} duties</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'timers'}
          className="nav-tab"
          onClick={() => setActiveTab('timers')}
        >
          Timers &amp; Audio
          <span className="badge-count">{effectiveDraft.mode === 'turbo' ? 'Turbo' : 'Regular'}</span>
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'draft' && (
          <DraftBoard
            heroes={heroes}
            draft={effectiveDraft}
            threats={itemRecommendations.threats}
            heroClaims={roomSync.room?.heroClaims}
            currentClientId={roomSync.clientId}
            onSetFaction={handleSetFaction}
            onAddHero={handleAddHero}
            onRemoveHero={handleRemoveHero}
            onSetMyHero={handleSetMyHero}
            onClearDraft={handleClearDraft}
            onLoadSampleDraft={handleLoadSampleDraft}
          />
        )}

        {activeTab === 'lanes' && (
          <LaneView
            plan={lanePlan}
            faction={effectiveDraft.faction}
            mode={effectiveDraft.mode}
            allyCount={allyHeroes.length}
            enemyCount={enemyHeroes.length}
            onSetLockedPosition={handleSetLockedPosition}
            onUnlockAll={handleUnlockAll}
          />
        )}

        {activeTab === 'items' && (
          <ItemBuildsView
            mode={effectiveDraft.mode}
            threats={itemRecommendations.threats}
            teamDuties={itemRecommendations.teamDuties}
            builds={itemRecommendations.builds}
          />
        )}

        {activeTab === 'timers' && (
          <TimersAudioView
            mode={effectiveDraft.mode}
            clockSeconds={clock.clockSeconds}
            bossState={clock.bossState}
            bossTimers={clock.bossTimers}
            mapCycle={clock.mapCycle}
            cueOverrides={clock.cueOverrides}
            activePreset={clock.activePreset}
            upcomingCues={clock.upcomingCues}
            onApplyPreset={clock.applyRolePreset}
            onUpdateCue={clock.updateCueOverride}
            onResetDefaults={clock.resetCueDefaults}
            onRoshanKilled={clock.markRoshanKilled}
            onClearRoshan={clock.clearRoshan}
            onTormentorKilled={clock.markTormentorKilled}
            onClearTormentor={clock.clearTormentor}
          />
        )}
      </main>

      <CueToastBanner batch={clock.activeToast} onDismiss={clock.dismissToast} />

      <GsiModal
        open={gsiModalOpen}
        onClose={() => setGsiModalOpen(false)}
        gsiState={clock.gsiState}
        gsiAutoSync={clock.gsiAutoSync}
        onToggleAutoSync={clock.setGsiAutoSync}
        roomCode={roomSync.roomCode}
      />

      <RoomModal
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        room={roomSync.room}
        status={roomSync.status}
        error={roomSync.error}
        clientId={roomSync.clientId}
        playerName={roomSync.playerName}
        heroes={heroes}
        onSaveName={roomSync.setPlayerName}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={roomSync.joinRoom}
        onLeaveRoom={roomSync.leaveRoom}
        onClearError={roomSync.clearError}
      />
    </div>
  );
}
