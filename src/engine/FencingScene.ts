import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createDuelState, setPlayerDefense, stepDuelState, triggerPlayerAttack } from '../game/combat';
import { LEVELS, STRIKE_ZONES } from '../game/levels';
import type {
  CombatEvent,
  DefenseAction,
  DuelState,
  DuelStats,
  GamePhase,
  StrikeZone,
} from '../game/types';
import { soundEngine } from './audio';
import { buildDuelistModel, type DuelistRig } from './duelistModel';
import { buildEnvironment, type BuiltEnvironment } from './environments';
import { haptics } from './haptics';
import { buildPlayerRapierRig } from './swordModel';

export interface HudSnapshot {
  phase: GamePhase;
  levelIndex: number;
  playerHp: number;
  playerMaxHp: number;
  playerStamina: number;
  playerMaxStamina: number;
  playerAction: string;
  playerDefense: DefenseAction;
  riposteActive: boolean;
  enemyHp: number;
  enemyMaxHp: number;
  enemyStamina: number;
  enemyMaxStamina: number;
  enemyAction: string;
  enemyTelegraphZone: StrikeZone | null;
  hoveredZone: StrikeZone | null;
  hoveredScreenPos: { x: number; y: number } | null;
  callout: { text: string; tone: 'gold' | 'crimson' | 'cyan' | 'neutral'; id: number } | null;
  stats: DuelStats;
  outcome: 'ongoing' | 'victory' | 'defeat';
}

interface SparkParticle {
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
}

const _vec3 = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _flashColor = new THREE.Color(0xffffff);
const _ringHighlight = new THREE.Color(0xffe082);
const _ringTelegraph = new THREE.Color(0xff4d4d);

export class FencingSceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmremTex: THREE.Texture;
  private isSoftwareGl: boolean;

  private playerSwordMount: THREE.Group;
  private playerSwordRig: THREE.Group;
  private enemyRig: DuelistRig | null = null;
  private env: BuiltEnvironment | null = null;

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2(0, 0);
  private hoveredZone: StrikeZone | null = null;
  private lastScreenPos: { x: number; y: number } | null = null;

  // Particle ring buffer
  private sparkMesh: THREE.InstancedMesh;
  private sparks: SparkParticle[] = [];
  private sparkCursor = 0;

  // Game & loop state
  private duelState: DuelState;
  private phase: GamePhase = 'title';
  private frameId = 0;
  private lastTime = performance.now();
  private elapsed = 0;
  private lastHudPush = 0;
  private calloutId = 0;
  private activeCallout: HudSnapshot['callout'] = null;
  private calloutTimer = 0;

  // Input state
  private heldKeys = new Set<string>();
  private touchDefense: DefenseAction = 'none';
  private resizeObserver: ResizeObserver;
  private canvasBounds: DOMRect;

  // Smoothed animation states
  private swordPos = new THREE.Vector3(0.32, -0.26, -0.48);
  private swordRot = new THREE.Euler(0.18, 0.2, 0.12);
  private enemyPos = new THREE.Vector3(0, 0, -0.82);
  private camPos = new THREE.Vector3(0, 1.56, 1.48);
  private camLook = new THREE.Vector3(0, 1.32, -0.82);
  private koTopple = 0;
  private playerHurtVignette = 0;
  private disposed = false;

  private onHudUpdate: (snap: HudSnapshot) => void;
  private onPhaseChange: (phase: GamePhase) => void;

  constructor(
    container: HTMLElement,
    initialLevelIndex: number,
    onHudUpdate: (snap: HudSnapshot) => void,
    onPhaseChange: (phase: GamePhase) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onPhaseChange = onPhaseChange;

    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);
    this.canvasBounds = this.renderer.domElement.getBoundingClientRect();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.08, 120);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.scene.add(this.camera);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.pmremTex;
    pmremGenerator.dispose();

    // Layer 1 for raycast zone hitboxes
    this.raycaster.layers.set(1);

    // Player first-person rapier rig attached to camera
    this.playerSwordMount = new THREE.Group();
    this.camera.add(this.playerSwordMount);
    this.playerSwordRig = buildPlayerRapierRig();
    this.playerSwordRig.position.copy(this.swordPos);
    this.playerSwordRig.rotation.copy(this.swordRot);
    this.playerSwordMount.add(this.playerSwordRig);

    // Pooled sparks InstancedMesh
    const sparkGeo = new THREE.OctahedronGeometry(0.032, 0);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd275 });
    const sparkCount = 96;
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, sparkCount);
    this.sparkMesh.frustumCulled = false;
    for (let i = 0; i < sparkCount; i++) {
      this.sparks.push({
        active: false,
        life: 0,
        maxLife: 0.4,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.sparkMesh);

    this.duelState = createDuelState(initialLevelIndex);
    this.loadLevelScene(initialLevelIndex);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    this.bindInputs();

    this.updateCamera(0.016);
    this.updatePlayerSwordRig(0.016);
    this.updateEnemyRig(0.016);
    this.renderer.render(this.scene, this.camera);
    this.pushHudSnapshot(true);
    this.scheduleNextTick();
  }

  public loadLevelScene(levelIndex: number): void {
    const clamped = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
    this.duelState = createDuelState(clamped);
    this.koTopple = 0;
    this.activeCallout = null;
    this.calloutTimer = 0;
    this.hoveredZone = null;

    if (this.env) {
      this.env.dispose();
      this.env = null;
    }
    if (this.enemyRig) {
      this.scene.remove(this.enemyRig.root);
      this.enemyRig.dispose();
      this.enemyRig = null;
    }

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.env = buildEnvironment(
      this.duelState.level.environment,
      this.scene,
      this.isSoftwareGl,
      maxAniso,
    );

    this.enemyRig = buildDuelistModel(this.duelState.level);
    this.enemyRig.root.position.set(0, 0, -0.82);
    this.scene.add(this.enemyRig.root);
    this.pushHudSnapshot(true);
  }

  public startDuel(levelIndex?: number): void {
    soundEngine.unlock();
    if (typeof levelIndex === 'number') {
      this.loadLevelScene(levelIndex);
    } else {
      this.loadLevelScene(this.duelState.levelIndex);
    }
    this.clearHeldInputs();
    this.setPhase('playing');
    this.pushHudSnapshot(true);
  }

  public previewLevel(levelIndex: number): void {
    this.loadLevelScene(levelIndex);
  }

  public setPhase(next: GamePhase): void {
    this.phase = next;
    if (next !== 'playing') {
      this.clearHeldInputs();
    }
    this.onPhaseChange(next);
    this.pushHudSnapshot(true);
  }

  public setTouchDefense(defense: DefenseAction): void {
    soundEngine.unlock();
    this.touchDefense = defense;
    if (this.phase === 'playing') {
      this.syncPlayerDefenseFromInputs();
    }
  }

  public triggerTouchStrike(zone: StrikeZone): void {
    soundEngine.unlock();
    if (this.phase !== 'playing') return;
    this.hoveredZone = zone;
    this.performStrike(zone);
  }

  private clearHeldInputs(): void {
    this.heldKeys.clear();
    this.touchDefense = 'none';
    setPlayerDefense(this.duelState, 'none');
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.canvasBounds = this.renderer.domElement.getBoundingClientRect();
  };

  private updatePointerNdc(clientX: number, clientY: number): void {
    this.canvasBounds = this.renderer.domElement.getBoundingClientRect();
    const { left, top, width, height } = this.canvasBounds;
    if (width <= 0 || height <= 0) return;
    this.pointerNdc.x = ((clientX - left) / width) * 2 - 1;
    this.pointerNdc.y = -((clientY - top) / height) * 2 + 1;
  }

  private pickZoneAtPointer(clientX: number, clientY: number): StrikeZone | null {
    if (!this.enemyRig) return null;
    this.updatePointerNdc(clientX, clientY);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.enemyRig.zoneTargets, false);
    if (hits.length > 0) {
      return hits[0].object.userData.strikeZone as StrikeZone;
    }

    // Ergonomic fallback: map click relative to duelist torso center if clicking in central region
    if (Math.abs(this.pointerNdc.x) < 0.65 && Math.abs(this.pointerNdc.y) < 0.72) {
      if (this.pointerNdc.y > 0.25) return 'head';
      if (this.pointerNdc.y < -0.14) {
        return this.pointerNdc.x < 0 ? 'left_hip' : 'right_hip';
      }
      if (Math.abs(this.pointerNdc.x) < 0.14) return 'chest';
      return this.pointerNdc.x < 0 ? 'left_shoulder' : 'right_shoulder';
    }

    return null;
  }

  private performStrike(zone: StrikeZone): void {
    const launched = triggerPlayerAttack(this.duelState, zone);
    if (launched) {
      soundEngine.playSwing(zone, 0.95 + Math.random() * 0.1);
      haptics.trigger('swing');
    } else {
      soundEngine.playExhaustedClick();
    }
    this.processDuelEvents();
    this.pushHudSnapshot(true);
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.phase !== 'playing') return;
    this.updatePointerNdc(e.clientX, e.clientY);
    const zone = this.pickZoneAtPointer(e.clientX, e.clientY);
    if (zone !== this.hoveredZone) {
      this.hoveredZone = zone;
      if (zone) {
        haptics.trigger('zone_hover');
      }
      this.pushHudSnapshot(true);
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'playing') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    soundEngine.unlock();
    const zone = this.pickZoneAtPointer(e.clientX, e.clientY);
    if (zone) {
      this.hoveredZone = zone;
      this.performStrike(zone);
    }
  };

  private syncPlayerDefenseFromInputs(): void {
    if (this.touchDefense !== 'none') {
      setPlayerDefense(this.duelState, this.touchDefense);
      this.processDuelEvents();
      return;
    }

    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) {
      setPlayerDefense(this.duelState, 'retreat');
    } else if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) {
      setPlayerDefense(this.duelState, 'block_high');
    } else if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) {
      setPlayerDefense(this.duelState, 'block_left');
    } else if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) {
      setPlayerDefense(this.duelState, 'block_right');
    } else {
      setPlayerDefense(this.duelState, 'none');
    }
    this.processDuelEvents();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.phase !== 'playing') return;
    const code = e.code;
    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      if (!this.heldKeys.has(code)) {
        this.heldKeys.add(code);
        soundEngine.unlock();
        this.syncPlayerDefenseFromInputs();
        this.pushHudSnapshot(true);
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.heldKeys.has(e.code)) {
      this.heldKeys.delete(e.code);
      if (this.phase === 'playing') {
        this.syncPlayerDefenseFromInputs();
        this.pushHudSnapshot(true);
      }
    }
  };

  private onBlur = (): void => {
    this.clearHeldInputs();
  };

  private bindInputs(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onBlur);
  }

  private unbindInputs(): void {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onBlur);
  }

  private spawnSparks(x: number, y: number, z: number, count: number, speed = 4.2): void {
    for (let i = 0; i < count; i++) {
      const p = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % this.sparks.length;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.25 + Math.random() * 0.25;
      p.x = x + (Math.random() - 0.5) * 0.18;
      p.y = y + (Math.random() - 0.5) * 0.18;
      p.z = z + (Math.random() - 0.5) * 0.18;
      p.vx = (Math.random() - 0.5) * speed;
      p.vy = 0.6 + Math.random() * speed * 0.7;
      p.vz = (Math.random() - 0.5) * speed;
      p.scale = 0.75 + Math.random() * 0.85;
    }
  }

  private triggerCallout(text: string, tone: 'gold' | 'crimson' | 'cyan' | 'neutral'): void {
    this.calloutId += 1;
    this.activeCallout = { text, tone, id: this.calloutId };
    this.calloutTimer = 0.95;
  }

  private processDuelEvents(): void {
    const events: CombatEvent[] = this.duelState.events;
    if (!events.length) return;

    for (const ev of events) {
      switch (ev.type) {
        case 'enemy_windup':
          if (ev.zone) soundEngine.playWindupTelegraph(ev.zone);
          break;
        case 'enemy_swing':
          if (ev.zone) soundEngine.playSwing(ev.zone, 0.88);
          break;
        case 'player_retreat':
          soundEngine.playRetreatStep();
          haptics.trigger('retreat');
          break;
        case 'player_hit_enemy':
          soundEngine.playHitImpact(ev.heavy, false);
          haptics.trigger('hit_enemy');
          this.spawnSparks(0, 1.25, -0.55, ev.heavy ? 18 : 10, 4.5);
          if (ev.callout) this.triggerCallout(ev.callout, ev.heavy ? 'gold' : 'neutral');
          break;
        case 'enemy_blocked_player':
          soundEngine.playSteelClang(0.85, false);
          haptics.trigger('block');
          this.spawnSparks(0, 1.32, -0.4, 14, 5.0);
          if (ev.callout) this.triggerCallout(ev.callout, 'neutral');
          break;
        case 'player_blocked_enemy':
          soundEngine.playSteelClang(0.95, false);
          haptics.trigger('block');
          this.spawnSparks(0, 1.32, 0.45, 14, 4.8);
          if (ev.callout) this.triggerCallout(ev.callout, 'cyan');
          break;
        case 'player_parry':
          soundEngine.playSteelClang(1.2, true);
          soundEngine.playRiposteReady();
          haptics.trigger('parry');
          this.spawnSparks(0, 1.35, 0.4, 24, 6.2);
          if (ev.callout) this.triggerCallout(ev.callout, 'gold');
          break;
        case 'retreat_counter':
          soundEngine.playRiposteReady();
          haptics.trigger('retreat_counter');
          this.spawnSparks(0, 1.25, 0.1, 18, 5.2);
          if (ev.callout) this.triggerCallout(ev.callout, 'cyan');
          break;
        case 'enemy_hit_player':
          soundEngine.playHitImpact(ev.heavy, true);
          haptics.trigger('hit_player');
          this.playerHurtVignette = 0.45;
          if (ev.callout) this.triggerCallout(ev.callout, 'crimson');
          break;
        case 'guard_break_player':
        case 'guard_break_enemy':
          soundEngine.playSteelClang(1.3, true);
          haptics.trigger('guard_break');
          this.spawnSparks(0, 1.3, 0, 26, 6.5);
          if (ev.callout) this.triggerCallout(ev.callout, 'crimson');
          break;
        case 'stamina_exhausted':
          if (ev.callout) this.triggerCallout(ev.callout, 'crimson');
          break;
        case 'enemy_ko':
          soundEngine.playHitImpact(true, false);
          soundEngine.playOutcomeFanfare(true);
          haptics.trigger('victory');
          this.spawnSparks(0, 1.3, -0.5, 28, 6.5);
          this.triggerCallout('VICTORY!', 'gold');
          break;
        case 'player_ko':
          soundEngine.playHitImpact(true, true);
          soundEngine.playOutcomeFanfare(false);
          haptics.trigger('defeat');
          this.triggerCallout('FELLED', 'crimson');
          break;
      }
    }
    this.duelState.events = [];
  }

  private updatePlayerSwordRig(dt: number): void {
    const p = this.duelState.player;
    const parallaxX = this.pointerNdc.x * 0.045;
    const parallaxY = this.pointerNdc.y * 0.035;

    let tx = 0.34 + parallaxX;
    let ty = -0.25 + parallaxY + Math.sin(this.elapsed * 2.2) * 0.008;
    let tz = -0.46;
    let rx = 0.22;
    let ry = 0.24;
    let rz = 0.14;

    if (p.action === 'blocking') {
      if (p.defense === 'block_high') {
        // Horizontal overhead guard: hilt at upper-right brow, blade sweeping left across top of view
        tx = 0.46;
        ty = 0.29;
        tz = -0.52;
        rx = -0.12;
        ry = Math.PI * 0.46;
        rz = 0.14;
      } else if (p.defense === 'block_left') {
        // Left lateral parry guard
        tx = -0.26;
        ty = -0.14;
        tz = -0.46;
        rx = 0.18;
        ry = -0.22;
        rz = 0.42;
      } else if (p.defense === 'block_right') {
        // Right lateral parry guard
        tx = 0.30;
        ty = -0.14;
        tz = -0.46;
        rx = 0.18;
        ry = 0.22;
        rz = -0.42;
      }
    } else if (p.action === 'retreating') {
      tx = 0.26;
      ty = -0.24;
      tz = -0.44;
      rx = 0.32;
      ry = 0.35;
      rz = 0.38;
    } else if (p.action === 'staggered') {
      tx = 0.44;
      ty = -0.42;
      tz = -0.44;
      rx = -0.35;
      ry = 0.65;
      rz = -0.55;
    } else if (p.activeZone && (p.action === 'windup' || p.action === 'active' || p.action === 'recovery')) {
      const z = p.activeZone;
      const progress = p.actionDuration > 0 ? 1 - p.actionTimer / p.actionDuration : 1;

      if (z === 'head') {
        // Downward chop: blade raised high on right, slices diagonally down toward center-head
        if (p.action === 'windup') {
          tx = 0.26;
          ty = 0.24;
          tz = -0.44;
          rx = 0.72;
          ry = 0.14;
          rz = 0.15;
        } else if (p.action === 'active') {
          tx = 0.12;
          ty = -0.14 - progress * 0.12;
          tz = -0.68;
          rx = -0.46;
          ry = 0.12;
          rz = 0.18;
        } else {
          tx = 0.22;
          ty = -0.28;
          tz = -0.52;
          rx = -0.22;
          ry = 0.18;
          rz = 0.14;
        }
      } else if (z === 'chest') {
        // Direct forward thrust
        if (p.action === 'windup') {
          tx = 0.22;
          ty = -0.14;
          tz = -0.28;
          rx = 0.02;
          ry = 0.05;
          rz = 0.15;
        } else if (p.action === 'active') {
          tx = 0.04;
          ty = -0.10;
          tz = -1.06;
          rx = 0.0;
          ry = 0.0;
          rz = 0.05;
        } else {
          tx = 0.22;
          ty = -0.22;
          tz = -0.58;
          rx = 0.12;
          ry = 0.12;
          rz = 0.12;
        }
      } else if (z === 'left_shoulder' || z === 'left_hip') {
        const yOff = z === 'left_hip' ? -0.16 : 0.02;
        if (p.action === 'windup') {
          tx = 0.48;
          ty = yOff + 0.12;
          tz = -0.38;
          rx = 0.2;
          ry = -0.75;
          rz = -0.85;
        } else if (p.action === 'active') {
          tx = -0.32;
          ty = yOff - 0.05;
          tz = -0.76;
          rx = -0.1;
          ry = 0.88;
          rz = 1.05;
        } else {
          tx = -0.12;
          ty = -0.24;
          tz = -0.5;
          rx = 0.1;
          ry = 0.35;
          rz = 0.35;
        }
      } else {
        // right_shoulder or right_hip
        const yOff = z === 'right_hip' ? -0.16 : 0.02;
        if (p.action === 'windup') {
          tx = -0.34;
          ty = yOff + 0.12;
          tz = -0.38;
          rx = 0.2;
          ry = 0.85;
          rz = 0.95;
        } else if (p.action === 'active') {
          tx = 0.40;
          ty = yOff - 0.05;
          tz = -0.76;
          rx = -0.1;
          ry = -0.78;
          rz = -1.05;
        } else {
          tx = 0.28;
          ty = -0.24;
          tz = -0.5;
          rx = 0.1;
          ry = -0.1;
          rz = -0.15;
        }
      }
    }

    const dampSpeed = p.action === 'active' ? 32 : 18;
    this.swordPos.x = THREE.MathUtils.damp(this.swordPos.x, tx, dampSpeed, dt);
    this.swordPos.y = THREE.MathUtils.damp(this.swordPos.y, ty, dampSpeed, dt);
    this.swordPos.z = THREE.MathUtils.damp(this.swordPos.z, tz, dampSpeed, dt);
    this.swordRot.x = THREE.MathUtils.damp(this.swordRot.x, rx, dampSpeed, dt);
    this.swordRot.y = THREE.MathUtils.damp(this.swordRot.y, ry, dampSpeed, dt);
    this.swordRot.z = THREE.MathUtils.damp(this.swordRot.z, rz, dampSpeed, dt);

    this.playerSwordRig.position.copy(this.swordPos);
    this.playerSwordRig.rotation.copy(this.swordRot);
  }

  private updateEnemyRig(dt: number): void {
    const rig = this.enemyRig;
    if (!rig) return;
    const e = this.duelState.enemy;

    // Hit flash tinting
    const flashing = e.hitFlashTimer > 0;
    rig.flashMaterials.forEach((mat) => {
      const base = rig.baseColors.get(mat);
      if (!base) return;
      if (flashing) {
        mat.color.copy(base).lerp(_flashColor, 0.72);
        mat.emissive.setHex(0x4a2010);
      } else {
        mat.color.copy(base);
        mat.emissive.setHex(0x000000);
      }
    });

    // Update target ring highlights & enemy windup telegraph glow
    const telegraphZone = e.action === 'windup' ? e.activeZone : null;
    (Object.keys(rig.zoneRings) as StrikeZone[]).forEach((z) => {
      const ring = rig.zoneRings[z];
      const mat = ring.material as THREE.MeshBasicMaterial;
      const isTelegraph = this.phase === 'playing' && telegraphZone === z;
      const isHovered = this.phase === 'playing' && this.hoveredZone === z;
      if (isTelegraph) {
        mat.color.copy(_ringTelegraph);
        mat.opacity = 0.65 + Math.sin(this.elapsed * 22) * 0.25;
        ring.scale.setScalar(1.22 + Math.sin(this.elapsed * 18) * 0.1);
      } else if (isHovered) {
        mat.color.copy(_ringHighlight);
        mat.opacity = 0.78;
        ring.scale.setScalar(1.06);
      } else {
        mat.opacity = 0;
      }
    });

    // KO topple
    if (e.action === 'ko') {
      this.koTopple = THREE.MathUtils.damp(this.koTopple, 1, 6.5, dt);
      rig.root.rotation.x = -this.koTopple * (Math.PI * 0.46);
      rig.root.position.set(0, -this.koTopple * 0.12, -0.82 - this.koTopple * 0.65);
      return;
    }

    rig.root.rotation.x = 0;

    // Breathing + combat stance pose targets
    const idleBob = Math.sin(this.elapsed * 2.5) * 0.025;
    let ez = -0.82;
    let ex = Math.sin(this.elapsed * 1.1) * 0.04;
    let torsoRotY = -0.18;
    let torsoRotX = 0.06;
    let rShoulderX = -0.55;
    let rShoulderY = 0.08;
    let rShoulderZ = -0.22;
    let rElbowX = -0.45;
    let weaponX = Math.PI * 0.36;
    let weaponZ = 0;

    if (e.action === 'staggered') {
      ez = -1.05;
      torsoRotX = -0.28;
      torsoRotY = 0.35;
      rShoulderX = -0.1;
      rShoulderZ = -0.85;
      rElbowX = -0.15;
    } else if (e.action === 'blocking') {
      ez = -0.88;
      if (e.defense === 'block_high') {
        rShoulderX = -1.75;
        rShoulderZ = 0.15;
        rElbowX = -0.65;
        weaponZ = 1.35;
      } else if (e.defense === 'block_left') {
        rShoulderX = -0.85;
        rShoulderY = -0.5;
        rShoulderZ = 0.3;
      } else {
        rShoulderX = -0.85;
        rShoulderY = 0.5;
        rShoulderZ = -0.45;
      }
    } else if (e.activeZone && (e.action === 'windup' || e.action === 'active' || e.action === 'recovery')) {
      const az = e.activeZone;
      if (e.action === 'windup') {
        ez = -0.92;
        if (az === 'head') {
          rShoulderX = -2.45;
          rShoulderZ = -0.1;
          rElbowX = -0.3;
          torsoRotX = -0.12;
        } else if (az === 'chest') {
          rShoulderX = 0.25;
          rShoulderZ = -0.35;
          rElbowX = -1.25;
          torsoRotY = -0.42;
        } else if (az === 'left_shoulder' || az === 'left_hip') {
          // Enemy swings toward player's left side (screen left = enemy's right)
          rShoulderX = -0.95;
          rShoulderZ = -1.15;
          rElbowX = -0.35;
          torsoRotY = -0.45;
        } else {
          rShoulderX = -0.95;
          rShoulderZ = 0.75;
          rElbowX = -0.55;
          torsoRotY = 0.35;
        }
      } else if (e.action === 'active') {
        ez = -0.36; // Lunges forward into strike
        torsoRotX = 0.24;
        if (az === 'head') {
          rShoulderX = -0.45;
          rElbowX = -0.15;
          weaponX = Math.PI * 0.58;
        } else if (az === 'chest') {
          rShoulderX = -1.45;
          rElbowX = -0.05;
          weaponX = Math.PI * 0.5;
        } else if (az === 'left_shoulder' || az === 'left_hip') {
          rShoulderX = -1.05;
          rShoulderZ = 0.55;
          torsoRotY = 0.28;
        } else {
          rShoulderX = -1.05;
          rShoulderZ = -0.85;
          torsoRotY = -0.38;
        }
      } else {
        ez = -0.78;
        torsoRotX = 0.08;
        rShoulderX = -0.42;
        rElbowX = -0.35;
      }
    }

    const damp = e.action === 'active' ? 28 : 14;
    this.enemyPos.x = THREE.MathUtils.damp(this.enemyPos.x, ex, damp, dt);
    this.enemyPos.z = THREE.MathUtils.damp(this.enemyPos.z, ez, damp, dt);
    rig.root.position.set(this.enemyPos.x, 0, this.enemyPos.z);

    rig.pelvis.position.y = 0.92 + idleBob;
    rig.torso.rotation.y = THREE.MathUtils.damp(rig.torso.rotation.y, torsoRotY, damp, dt);
    rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, torsoRotX, damp, dt);
    rig.rightShoulder.rotation.x = THREE.MathUtils.damp(rig.rightShoulder.rotation.x, rShoulderX, damp, dt);
    rig.rightShoulder.rotation.y = THREE.MathUtils.damp(rig.rightShoulder.rotation.y, rShoulderY, damp, dt);
    rig.rightShoulder.rotation.z = THREE.MathUtils.damp(rig.rightShoulder.rotation.z, rShoulderZ, damp, dt);
    rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, rElbowX, damp, dt);
    rig.weaponPivot.rotation.x = THREE.MathUtils.damp(rig.weaponPivot.rotation.x, weaponX, damp, dt);
    rig.weaponPivot.rotation.z = THREE.MathUtils.damp(rig.weaponPivot.rotation.z, weaponZ, damp, dt);
    rig.cape.rotation.x = 0.14 + Math.sin(this.elapsed * 3.2) * 0.05;
  }

  private updateCamera(dt: number): void {
    if (this.phase === 'title') {
      // Atmospheric gentle live-world camera pan around the courtyard/duelist
      const panAngle = Math.sin(this.elapsed * 0.28) * 0.42;
      const targetPosX = Math.sin(panAngle) * 2.2;
      const targetPosZ = 2.4 + Math.cos(panAngle) * 0.5;
      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetPosX, 4, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, 1.72, 4, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetPosZ, 4, dt);
      this.camLook.set(0, 1.35, -0.85);
      this.playerSwordMount.visible = false;
    } else {
      this.playerSwordMount.visible = true;
      const p = this.duelState.player;
      const retreatOffset = p.action === 'retreating' || p.defense === 'retreat' ? 0.56 : 0;
      const lungeOffset = p.action === 'active' && p.activeZone === 'chest' ? -0.22 : 0;
      const targetZ = 1.48 + retreatOffset + lungeOffset;
      const targetX =
        p.defense === 'block_left' ? -0.12 : p.defense === 'block_right' ? 0.12 : 0;
      const targetY = 1.56 + Math.sin(this.elapsed * 2.1) * 0.012;

      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetX, 14, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetY, 14, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetZ, 16, dt);
      this.camLook.set(0, 1.30, -0.82);
    }

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Decaying trauma * trauma shake
    const trauma = this.duelState.cameraTrauma;
    if (trauma > 0.005) {
      const shake = trauma * trauma;
      this.camera.rotation.z += (Math.random() * 2 - 1) * 0.032 * shake;
      this.camera.rotation.x += (Math.random() * 2 - 1) * 0.022 * shake;
      this.camera.rotation.y += (Math.random() * 2 - 1) * 0.022 * shake;
    }
  }

  private updateSparks(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.sparks.length; i++) {
      const p = this.sparks[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0);
      } else {
        p.vy -= 9.5 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const fade = 1 - p.life / p.maxLife;
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.rotation.set(p.life * 8, p.life * 10, 0);
        _dummy.scale.setScalar(p.scale * fade);
      }
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
    }
    if (anyChanged) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private computeHoveredScreenPos(): { x: number; y: number } | null {
    if (!this.hoveredZone || !this.enemyRig || this.phase !== 'playing') return null;
    const ring = this.enemyRig.zoneRings[this.hoveredZone];
    ring.getWorldPosition(_projVec);
    _projVec.project(this.camera);
    if (_projVec.z < -1 || _projVec.z > 1) return null;

    const w = this.canvasBounds.width || window.innerWidth;
    const h = this.canvasBounds.height || window.innerHeight;
    return {
      x: ((_projVec.x + 1) * 0.5) * w,
      y: ((-_projVec.y + 1) * 0.5) * h,
    };
  }

  private pushHudSnapshot(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastHudPush < 85) return;
    this.lastHudPush = now;

    const s = this.duelState;
    const enemyTelegraphZone =
      this.phase === 'playing' && s.enemy.action === 'windup' ? s.enemy.activeZone : null;

    this.lastScreenPos = this.computeHoveredScreenPos();

    this.onHudUpdate({
      phase: this.phase,
      levelIndex: s.levelIndex,
      playerHp: Math.round(s.player.hp),
      playerMaxHp: s.player.maxHp,
      playerStamina: Math.round(s.player.stamina),
      playerMaxStamina: s.player.maxStamina,
      playerAction: s.player.action,
      playerDefense: s.player.defense,
      riposteActive: s.player.riposteWindow > 0,
      enemyHp: Math.round(s.enemy.hp),
      enemyMaxHp: s.enemy.maxHp,
      enemyStamina: Math.round(s.enemy.stamina),
      enemyMaxStamina: s.enemy.maxStamina,
      enemyAction: s.enemy.action,
      enemyTelegraphZone,
      hoveredZone: this.hoveredZone,
      hoveredScreenPos: this.lastScreenPos,
      callout: this.activeCallout,
      stats: {
        ...s.stats,
        zoneBreakdown: {
          head: { ...s.stats.zoneBreakdown.head },
          chest: { ...s.stats.zoneBreakdown.chest },
          left_shoulder: { ...s.stats.zoneBreakdown.left_shoulder },
          right_shoulder: { ...s.stats.zoneBreakdown.right_shoulder },
          left_hip: { ...s.stats.zoneBreakdown.left_hip },
          right_hip: { ...s.stats.zoneBreakdown.right_hip },
        },
        accuracyHistory: s.stats.accuracyHistory.slice(),
      },
      outcome: s.outcome,
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.elapsed += dt;

    if (this.calloutTimer > 0) {
      this.calloutTimer -= dt;
      if (this.calloutTimer <= 0) {
        this.activeCallout = null;
        this.pushHudSnapshot(true);
      }
    }

    if (this.playerHurtVignette > 0) {
      this.playerHurtVignette = Math.max(0, this.playerHurtVignette - dt);
    }

    if (this.env) {
      this.env.update(this.elapsed, dt);
    }

    if (this.phase === 'playing') {
      stepDuelState(this.duelState, dt);
      this.processDuelEvents();

      if (this.duelState.outcome !== 'ongoing' && this.duelState.koSequenceTimer <= 0) {
        this.setPhase(this.duelState.outcome === 'victory' ? 'victory' : 'gameover');
      }
    }

    this.updateCamera(dt);
    this.updatePlayerSwordRig(dt);
    this.updateEnemyRig(dt);
    this.updateSparks(dt);

    this.renderer.render(this.scene, this.camera);
    this.pushHudSnapshot(false);
    this.scheduleNextTick();
  };

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public getDebugZoneInfo(zone: StrikeZone): { label: string; motion: string } {
    return { label: STRIKE_ZONES[zone].label, motion: STRIKE_ZONES[zone].motion };
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.unbindInputs();
    if (this.env) this.env.dispose();
    if (this.enemyRig) this.enemyRig.dispose();
    this.pmremTex.dispose();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
