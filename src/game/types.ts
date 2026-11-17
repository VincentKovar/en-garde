export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type EnvironmentId = 'castle' | 'pirate_ship' | 'medieval_street' | 'icy_caverns';

export type StrikeZone =
  | 'head'
  | 'chest'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_hip'
  | 'right_hip';

export type AttackMotionType =
  | 'chop'
  | 'thrust'
  | 'slash_left'
  | 'slash_right'
  | 'slash_low_left'
  | 'slash_low_right';

export type DefenseAction =
  | 'none'
  | 'block_high'
  | 'block_left'
  | 'block_right'
  | 'retreat';

export type ActionState =
  | 'idle'
  | 'windup'
  | 'active'
  | 'recovery'
  | 'blocking'
  | 'retreating'
  | 'staggered'
  | 'ko';

export interface ZoneDefinition {
  id: StrikeZone;
  label: string;
  motion: AttackMotionType;
  staminaCost: number;
  baseDamage: number;
  windupDuration: number;
  activeDuration: number;
  recoveryDuration: number;
  counteredBy: DefenseAction;
  defenseHintKey: 'W' | 'A' | 'D' | 'S';
  telegraphLabel: string;
}

export interface LevelConfig {
  id: number;
  name: string;
  environment: EnvironmentId;
  environmentTitle: string;
  enemyName: string;
  enemyTitle: string;
  combatStyle: string;
  enemyMaxHp: number;
  enemyMaxStamina: number;
  enemySpeedMultiplier: number;
  enemyStaminaRecharge: number;
  enemyBlockChance: number;
  enemyAttackCooldownMin: number;
  enemyAttackCooldownMax: number;
  enemyComboChance: number;
  attackWeights: Record<StrikeZone, number>;
  palette: {
    armorPrimary: string;
    armorSecondary: string;
    clothAccent: string;
    bladeMetal: string;
    skyTop: string;
    horizonFog: string;
    accentHex: string;
  };
}

export interface CombatantState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  staminaRechargeRate: number;
  action: ActionState;
  actionTimer: number;
  actionDuration: number;
  activeZone: StrikeZone | null;
  hasDealtActiveHit: boolean;
  defense: DefenseAction;
  defenseHoldTime: number;
  retreatCooldown: number;
  riposteWindow: number;
  staggerTimer: number;
  hitFlashTimer: number;
}

export type CombatEventType =
  | 'player_swing'
  | 'enemy_windup'
  | 'enemy_swing'
  | 'player_hit_enemy'
  | 'enemy_blocked_player'
  | 'player_blocked_enemy'
  | 'player_parry'
  | 'retreat_counter'
  | 'enemy_hit_player'
  | 'guard_break_player'
  | 'guard_break_enemy'
  | 'stamina_exhausted'
  | 'player_retreat'
  | 'enemy_ko'
  | 'player_ko';

export interface CombatEvent {
  type: CombatEventType;
  zone?: StrikeZone;
  damage?: number;
  callout?: string;
  heavy?: boolean;
}

export interface ZoneTelemetry {
  attempts: number;
  hits: number;
  blocked: number;
  damage: number;
}

export interface StrikeAccuracyPoint {
  swingIndex: number;
  timeSec: number;
  zone: StrikeZone;
  landed: boolean;
  cumulativeAccuracy: number;
}

export interface DuelStats {
  damageDealt: number;
  damageTaken: number;
  hitsLanded: number;
  parriesAndCounters: number;
  swingsAttempted: number;
  elapsedSeconds: number;
  comboStreak: number;
  bestCombo: number;
  zoneBreakdown: Record<StrikeZone, ZoneTelemetry>;
  accuracyHistory: StrikeAccuracyPoint[];
}

export interface DuelState {
  levelIndex: number;
  level: LevelConfig;
  player: CombatantState;
  enemy: CombatantState;
  enemyNextAttackTimer: number;
  enemyPendingCombo: number;
  enemyLastGuardSwitchTimer: number;
  hitstopTimer: number;
  cameraTrauma: number;
  stats: DuelStats;
  outcome: 'ongoing' | 'victory' | 'defeat';
  koSequenceTimer: number;
  events: CombatEvent[];
}
