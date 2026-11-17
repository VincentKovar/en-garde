import { useCallback, useEffect, useRef, useState } from 'react';
import { CombatHud } from './components/CombatHud';
import { StatusModal } from './components/StatusModal';
import { TitleScreen } from './components/TitleScreen';
import { soundEngine } from './engine/audio';
import { FencingSceneController, type HudSnapshot } from './engine/FencingScene';
import { haptics } from './engine/haptics';
import { createEmptyZoneBreakdown } from './game/combat';
import { LEVELS } from './game/levels';
import type { DefenseAction, GamePhase } from './game/types';

function createInitialHud(levelIndex: number): HudSnapshot {
  const lvl = LEVELS[levelIndex] ?? LEVELS[0];
  return {
    phase: 'title',
    levelIndex,
    playerHp: 100,
    playerMaxHp: 100,
    playerStamina: 100,
    playerMaxStamina: 100,
    playerAction: 'idle',
    playerDefense: 'none',
    riposteActive: false,
    enemyHp: lvl.enemyMaxHp,
    enemyMaxHp: lvl.enemyMaxHp,
    enemyStamina: lvl.enemyMaxStamina,
    enemyMaxStamina: lvl.enemyMaxStamina,
    enemyAction: 'idle',
    enemyTelegraphZone: null,
    hoveredZone: null,
    hoveredScreenPos: null,
    callout: null,
    stats: {
      damageDealt: 0,
      damageTaken: 0,
      hitsLanded: 0,
      parriesAndCounters: 0,
      swingsAttempted: 0,
      elapsedSeconds: 0,
      comboStreak: 0,
      bestCombo: 0,
      zoneBreakdown: createEmptyZoneBreakdown(),
      accuracyHistory: [],
    },
    outcome: 'ongoing',
  };
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<FencingSceneController | null>(null);

  const [selectedLevelIndex, setSelectedLevelIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const lvlParam = Number(params.get('level'));
    if (Number.isInteger(lvlParam) && lvlParam >= 1 && lvlParam <= LEVELS.length) {
      return lvlParam - 1;
    }
    return 0;
  });

  const [phase, setPhase] = useState<GamePhase>('title');
  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud(selectedLevelIndex));
  const [muted, setMuted] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const phaseRef = useRef<GamePhase>(phase);
  phaseRef.current = phase;
  const levelIndexRef = useRef<number>(selectedLevelIndex);
  levelIndexRef.current = selectedLevelIndex;

  // Mirror game state onto document.body.dataset.state
  useEffect(() => {
    const bodyState = phase === 'victory' ? 'gameover' : phase;
    document.body.dataset.state = bodyState;
  }, [phase]);

  // Mount Three.js WebGL scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const controller = new FencingSceneController(
      container,
      levelIndexRef.current,
      (snap) => setHud(snap),
      (nextPhase) => setPhase(nextPhase),
    );
    controllerRef.current = controller;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      controller.startDuel(levelIndexRef.current);
    }

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleSelectLevel = useCallback((idx: number) => {
    setSelectedLevelIndex(idx);
    controllerRef.current?.previewLevel(idx);
  }, []);

  const handleStartDuel = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    controllerRef.current?.startDuel(levelIndexRef.current);
  }, []);

  const handlePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      controllerRef.current?.setPhase('paused');
    }
  }, []);

  const handleResume = useCallback(() => {
    if (phaseRef.current === 'paused') {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      controllerRef.current?.setPhase('playing');
    }
  }, []);

  const handleRestart = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    controllerRef.current?.startDuel(levelIndexRef.current);
  }, []);

  const handleNextLevel = useCallback(() => {
    const nextIdx = Math.min(LEVELS.length - 1, levelIndexRef.current + 1);
    setSelectedLevelIndex(nextIdx);
    levelIndexRef.current = nextIdx;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    controllerRef.current?.startDuel(nextIdx);
  }, []);

  const handleReturnTitle = useCallback(() => {
    controllerRef.current?.setPhase('title');
    controllerRef.current?.previewLevel(levelIndexRef.current);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleHaptics = useCallback(() => {
    setHapticsEnabled((prev) => {
      const next = !prev;
      haptics.setEnabled(next);
      return next;
    });
  }, []);

  const handleTouchDefense = useCallback((defense: DefenseAction) => {
    controllerRef.current?.setTouchDefense(defense);
  }, []);

  // Global hotkeys (Enter/Space on Title, Esc/P Pause, M Mute)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const curPhase = phaseRef.current;

      if (curPhase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStartDuel();
        return;
      }

      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (curPhase === 'playing') handlePause();
        else if (curPhase === 'paused') handleResume();
        return;
      }

      if ((curPhase === 'victory' || curPhase === 'gameover') && e.code === 'Enter') {
        e.preventDefault();
        if (curPhase === 'victory' && levelIndexRef.current < LEVELS.length - 1) {
          handleNextLevel();
        } else {
          handleRestart();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNextLevel, handlePause, handleRestart, handleResume, handleStartDuel, handleToggleMute]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0d0c0b]">
      {/* Isolated WebGL Viewport Container */}
      <div
        ref={mountRef}
        data-testid="fencing-canvas"
        className="absolute inset-0 w-full h-full"
      />

      {phase === 'title' && (
        <TitleScreen
          levels={LEVELS}
          selectedLevelIndex={selectedLevelIndex}
          onSelectLevel={handleSelectLevel}
          onStart={handleStartDuel}
        />
      )}

      {phase === 'playing' && (
        <CombatHud
          hud={hud}
          muted={muted}
          hapticsEnabled={hapticsEnabled}
          onToggleMute={handleToggleMute}
          onToggleHaptics={handleToggleHaptics}
          onPause={handlePause}
          onTouchDefense={handleTouchDefense}
        />
      )}

      {(phase === 'paused' || phase === 'victory' || phase === 'gameover') && (
        <StatusModal
          phase={phase}
          levelIndex={hud.levelIndex}
          stats={hud.stats}
          onResume={handleResume}
          onRestart={handleRestart}
          onNextLevel={handleNextLevel}
          onReturnTitle={handleReturnTitle}
        />
      )}
    </main>
  );
}
