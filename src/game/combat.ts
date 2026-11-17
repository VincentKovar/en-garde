import { ALL_STRIKE_ZONES, LEVELS, STRIKE_ZONES } from './levels';
import type {
  CombatantState,
  CombatEvent,
  DefenseAction,
  DuelState,
  DuelStats,
  LevelConfig,
  StrikeZone,
  ZoneTelemetry,
} from './types';

export const PLAYER_MAX_HP = 100;
export const PLAYER_MAX_STAMINA = 100;
export const PLAYER_STAMINA_RECHARGE = 23;
export const PARRY_WINDOW_SECONDS = 0.28;
export const BLOCK_STAMINA_DRAIN_PER_SEC = 7;
export const BLOCK_IMPACT_COST = 10;
export const PARRY_IMPACT_COST = 4;
export const RETREAT_DURATION = 0.42;
export const RETREAT_COOLDOWN = 0.52;
export const RETREAT_STAMINA_COST = 10;
export const MIN_ATTACK_STAMINA = 14;
export const RIPOSTE_WINDOW_DURATION = 1.15;
export const RIPOSTE_DAMAGE_MULTIPLIER = 1.6;
export const GUARD_BREAK_STAGGER = 0.95;

export function createCombatant(
  maxHp: number,
  maxStamina: number,
  staminaRechargeRate: number,
): CombatantState {
  return {
    hp: maxHp,
    maxHp,
    stamina: maxStamina,
    maxStamina,
    staminaRechargeRate,
    action: 'idle',
    actionTimer: 0,
    actionDuration: 0,
    activeZone: null,
    hasDealtActiveHit: false,
    defense: 'none',
    defenseHoldTime: 0,
    retreatCooldown: 0,
    riposteWindow: 0,
    staggerTimer: 0,
    hitFlashTimer: 0,
  };
}

export function createEmptyZoneBreakdown(): Record<StrikeZone, ZoneTelemetry> {
  return {
    head: { attempts: 0, hits: 0, blocked: 0, damage: 0 },
    chest: { attempts: 0, hits: 0, blocked: 0, damage: 0 },
    left_shoulder: { attempts: 0, hits: 0, blocked: 0, damage: 0 },
    right_shoulder: { attempts: 0, hits: 0, blocked: 0, damage: 0 },
    left_hip: { attempts: 0, hits: 0, blocked: 0, damage: 0 },
    right_hip: { attempts: 0, hits: 0, blocked: 0, damage: 0 },
  };
}

export interface ZoneAnalyticsRow {
  zone: StrikeZone;
  label: string;
  shortLabel: string;
  attempts: number;
  hits: number;
  blocked: number;
  accuracyPct: number;
  damage: number;
}

const ZONE_SHORT_LABELS: Record<StrikeZone, string> = {
  head: 'Head',
  chest: 'Chest',
  left_shoulder: 'L.Shldr',
  right_shoulder: 'R.Shldr',
  left_hip: 'L.Hip',
  right_hip: 'R.Hip',
};

export function computeZoneAnalytics(stats: DuelStats): {
  overallAccuracyPct: number;
  zoneSeries: ZoneAnalyticsRow[];
} {
  const overallAccuracyPct =
    stats.swingsAttempted > 0
      ? Math.round((stats.hitsLanded / stats.swingsAttempted) * 100)
      : 0;

  const zoneSeries: ZoneAnalyticsRow[] = ALL_STRIKE_ZONES.map((zone) => {
    const t = stats.zoneBreakdown[zone] ?? { attempts: 0, hits: 0, blocked: 0, damage: 0 };
    const accuracyPct = t.attempts > 0 ? Math.round((t.hits / t.attempts) * 100) : 0;
    return {
      zone,
      label: STRIKE_ZONES[zone].label,
      shortLabel: ZONE_SHORT_LABELS[zone],
      attempts: t.attempts,
      hits: t.hits,
      blocked: t.blocked,
      accuracyPct,
      damage: Math.round(t.damage),
    };
  });

  return { overallAccuracyPct, zoneSeries };
}

export function createDuelState(levelIndex: number): DuelState {
  const clampedIdx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
  const level: LevelConfig = LEVELS[clampedIdx];
  return {
    levelIndex: clampedIdx,
    level,
    player: createCombatant(PLAYER_MAX_HP, PLAYER_MAX_STAMINA, PLAYER_STAMINA_RECHARGE),
    enemy: createCombatant(
      level.enemyMaxHp,
      level.enemyMaxStamina,
      level.enemyStaminaRecharge,
    ),
    enemyNextAttackTimer: 1.15,
    enemyPendingCombo: 0,
    enemyLastGuardSwitchTimer: 0.7,
    hitstopTimer: 0,
    cameraTrauma: 0,
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
    koSequenceTimer: 0,
    events: [],
  };
}

export function doesDefenseCounterZone(defense: DefenseAction, zone: StrikeZone): boolean {
  if (defense === 'none') return false;
  if (zone === 'head') return defense === 'block_high';
  if (zone === 'chest') return defense === 'retreat';
  if (zone === 'left_shoulder' || zone === 'left_hip') return defense === 'block_left';
  if (zone === 'right_shoulder' || zone === 'right_hip') return defense === 'block_right';
  return false;
}

export function pickWeightedZone(
  weights: Record<StrikeZone, number>,
  rng: () => number = Math.random,
): StrikeZone {
  let total = 0;
  for (const z of ALL_STRIKE_ZONES) {
    total += weights[z] ?? 0;
  }
  let roll = rng() * total;
  for (const z of ALL_STRIKE_ZONES) {
    roll -= weights[z] ?? 0;
    if (roll <= 0) return z;
  }
  return 'chest';
}

function pushEvent(state: DuelState, event: CombatEvent): void {
  state.events.push(event);
}

export function triggerPlayerAttack(state: DuelState, zone: StrikeZone): boolean {
  if (state.outcome !== 'ongoing') return false;
  const p = state.player;
  if (p.action !== 'idle' && p.action !== 'blocking') return false;

  const def = STRIKE_ZONES[zone];
  if (p.stamina < Math.min(MIN_ATTACK_STAMINA, def.staminaCost)) {
    pushEvent(state, { type: 'stamina_exhausted', callout: 'LOW STAMINA' });
    return false;
  }

  p.stamina = Math.max(0, p.stamina - def.staminaCost);
  p.defense = 'none';
  p.defenseHoldTime = 0;
  p.action = 'windup';
  p.activeZone = zone;
  p.actionDuration = def.windupDuration;
  p.actionTimer = def.windupDuration;
  p.hasDealtActiveHit = false;
  state.stats.swingsAttempted += 1;
  state.stats.zoneBreakdown[zone].attempts += 1;
  pushEvent(state, { type: 'player_swing', zone });
  return true;
}

export function setPlayerDefense(state: DuelState, defense: DefenseAction): void {
  if (state.outcome !== 'ongoing') return;
  const p = state.player;
  if (p.action === 'staggered' || p.action === 'ko') return;

  if (defense === 'retreat') {
    if (
      (p.action === 'idle' || p.action === 'blocking') &&
      p.retreatCooldown <= 0 &&
      p.stamina >= RETREAT_STAMINA_COST
    ) {
      p.stamina = Math.max(0, p.stamina - RETREAT_STAMINA_COST);
      p.action = 'retreating';
      p.actionDuration = RETREAT_DURATION;
      p.actionTimer = RETREAT_DURATION;
      p.defense = 'retreat';
      p.defenseHoldTime = 0;
      p.retreatCooldown = RETREAT_COOLDOWN;
      pushEvent(state, { type: 'player_retreat' });
    } else if (p.stamina < RETREAT_STAMINA_COST && p.retreatCooldown <= 0) {
      pushEvent(state, { type: 'stamina_exhausted', callout: 'LOW STAMINA' });
    }
    return;
  }

  if (p.action === 'windup' || p.action === 'active' || p.action === 'recovery' || p.action === 'retreating') {
    return;
  }

  if (defense === 'none') {
    if (p.action === 'blocking') {
      p.action = 'idle';
      p.defense = 'none';
      p.defenseHoldTime = 0;
    }
    return;
  }

  if (p.stamina <= 1) {
    p.action = 'idle';
    p.defense = 'none';
    pushEvent(state, { type: 'stamina_exhausted', callout: 'NO STAMINA' });
    return;
  }

  if (p.defense !== defense) {
    p.defenseHoldTime = 0;
  }
  p.action = 'blocking';
  p.defense = defense;
}

function decideEnemyGuard(state: DuelState, incomingZone: StrikeZone, rng: () => number): void {
  const e = state.enemy;
  if (e.action !== 'idle' && e.action !== 'blocking') return;
  if (e.staggerTimer > 0 || e.stamina < BLOCK_IMPACT_COST) return;

  // Enemies are vulnerable during active/recovery or when tired
  const fatigueFactor = e.stamina / e.maxStamina;
  const chance = state.level.enemyBlockChance * (0.55 + 0.45 * fatigueFactor);
  if (rng() < chance) {
    const ideal = STRIKE_ZONES[incomingZone].counteredBy;
    e.defense = ideal;
    e.action = 'blocking';
    e.actionTimer = 0.38;
    e.actionDuration = 0.38;
    e.defenseHoldTime = 0;
  }
}

function resolvePlayerStrikeHit(state: DuelState, rng: () => number): void {
  const p = state.player;
  const e = state.enemy;
  const zone = p.activeZone;
  if (!zone) return;

  const zoneDef = STRIKE_ZONES[zone];
  decideEnemyGuard(state, zone, rng);

  const isCountered = doesDefenseCounterZone(e.defense, zone);
  const canEnemyHoldBlock = e.stamina >= BLOCK_IMPACT_COST;

  if (isCountered && e.action === 'retreating' && zone === 'chest') {
    // Enemy retreated from player thrust
    p.riposteWindow = 0;
    state.stats.comboStreak = 0;
    state.stats.zoneBreakdown[zone].blocked += 1;
    state.stats.accuracyHistory.push({
      swingIndex: state.stats.swingsAttempted,
      timeSec: Number(state.stats.elapsedSeconds.toFixed(1)),
      zone,
      landed: false,
      cumulativeAccuracy: Math.round(
        (state.stats.hitsLanded / Math.max(1, state.stats.swingsAttempted)) * 100,
      ),
    });
    pushEvent(state, {
      type: 'enemy_blocked_player',
      zone,
      callout: 'ENEMY RETREATED',
    });
    return;
  }

  if (isCountered && canEnemyHoldBlock && e.staggerTimer <= 0) {
    e.stamina = Math.max(0, e.stamina - BLOCK_IMPACT_COST);
    e.hitFlashTimer = 0.06;
    state.hitstopTimer = 0.04;
    state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.28);
    state.stats.comboStreak = 0;
    state.stats.zoneBreakdown[zone].blocked += 1;
    state.stats.accuracyHistory.push({
      swingIndex: state.stats.swingsAttempted,
      timeSec: Number(state.stats.elapsedSeconds.toFixed(1)),
      zone,
      landed: false,
      cumulativeAccuracy: Math.round(
        (state.stats.hitsLanded / Math.max(1, state.stats.swingsAttempted)) * 100,
      ),
    });

    if (e.stamina <= 0) {
      e.action = 'staggered';
      e.staggerTimer = GUARD_BREAK_STAGGER;
      e.actionTimer = GUARD_BREAK_STAGGER;
      e.defense = 'none';
      pushEvent(state, {
        type: 'guard_break_enemy',
        zone,
        callout: 'GUARD BROKEN!',
        heavy: true,
      });
    } else {
      pushEvent(state, {
        type: 'enemy_blocked_player',
        zone,
        callout: 'BLOCKED',
      });
    }
    return;
  }

  // Clean hit (or riposte!)
  const riposteMult = p.riposteWindow > 0 ? RIPOSTE_DAMAGE_MULTIPLIER : 1.0;
  const staggerBonus = e.staggerTimer > 0 ? 1.25 : 1.0;
  const partialBlockMult =
    e.action === 'blocking' && e.defense !== 'none' && e.staggerTimer <= 0 ? 0.55 : 1.0;

  const rawDamage = zoneDef.baseDamage * riposteMult * staggerBonus * partialBlockMult;
  const damage = Math.max(1, Math.round(rawDamage));
  const wasRiposte = p.riposteWindow > 0;
  p.riposteWindow = 0;

  e.hp = Math.max(0, e.hp - damage);
  e.hitFlashTimer = 0.08;
  state.stats.damageDealt += damage;
  state.stats.hitsLanded += 1;
  state.stats.comboStreak += 1;
  state.stats.bestCombo = Math.max(state.stats.bestCombo, state.stats.comboStreak);
  state.stats.zoneBreakdown[zone].hits += 1;
  state.stats.zoneBreakdown[zone].damage += damage;
  state.stats.accuracyHistory.push({
    swingIndex: state.stats.swingsAttempted,
    timeSec: Number(state.stats.elapsedSeconds.toFixed(1)),
    zone,
    landed: true,
    cumulativeAccuracy: Math.round(
      (state.stats.hitsLanded / Math.max(1, state.stats.swingsAttempted)) * 100,
    ),
  });

  state.hitstopTimer = wasRiposte ? 0.075 : 0.05;
  state.cameraTrauma = Math.min(1, state.cameraTrauma + (wasRiposte ? 0.55 : 0.36));

  if (e.hp <= 0) {
    e.action = 'ko';
    e.defense = 'none';
    e.activeZone = null;
    state.outcome = 'victory';
    state.koSequenceTimer = 0.75;
    pushEvent(state, {
      type: 'enemy_ko',
      zone,
      damage,
      callout: 'DEFEATED!',
      heavy: true,
    });
  } else {
    if (e.action === 'windup' && wasRiposte) {
      e.action = 'staggered';
      e.staggerTimer = 0.45;
      e.actionTimer = 0.45;
    }
    pushEvent(state, {
      type: 'player_hit_enemy',
      zone,
      damage,
      callout: wasRiposte ? `RIPOSTE! -${damage}` : `-${damage}`,
      heavy: wasRiposte || zone === 'head',
    });
  }
}

function resolveEnemyStrikeHit(state: DuelState): void {
  const p = state.player;
  const e = state.enemy;
  const zone = e.activeZone;
  if (!zone) return;

  const zoneDef = STRIKE_ZONES[zone];

  // Retreat counters chest thrust!
  if (zone === 'chest' && (p.action === 'retreating' || p.defense === 'retreat')) {
    e.stamina = Math.max(0, e.stamina - 14);
    e.action = 'staggered';
    e.staggerTimer = 0.95;
    e.actionTimer = 0.95;
    e.defense = 'none';
    p.riposteWindow = RIPOSTE_WINDOW_DURATION;
    state.stats.parriesAndCounters += 1;
    state.hitstopTimer = 0.065;
    state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.35);
    pushEvent(state, {
      type: 'retreat_counter',
      zone,
      callout: 'THRUST COUNTERED!',
      heavy: true,
    });
    return;
  }

  // Retreat partially evades slashes
  if (p.action === 'retreating' || p.defense === 'retreat') {
    const grazed = Math.max(1, Math.round(zoneDef.baseDamage * 0.4));
    p.hp = Math.max(0, p.hp - grazed);
    p.hitFlashTimer = 0.06;
    state.stats.damageTaken += grazed;
    state.stats.comboStreak = 0;
    state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.25);
    if (p.hp <= 0) {
      p.action = 'ko';
      state.outcome = 'defeat';
      state.koSequenceTimer = 0.7;
      pushEvent(state, { type: 'player_ko', zone, damage: grazed, callout: 'FELLED', heavy: true });
    } else {
      pushEvent(state, {
        type: 'enemy_hit_player',
        zone,
        damage: grazed,
        callout: `GRAZED -${grazed}`,
      });
    }
    return;
  }

  // Player directional block check
  const isCorrectBlock = p.action === 'blocking' && doesDefenseCounterZone(p.defense, zone);
  const isWrongBlock = p.action === 'blocking' && p.defense !== 'none' && !isCorrectBlock;

  if (isCorrectBlock) {
    const isTimedParry = p.defenseHoldTime <= PARRY_WINDOW_SECONDS;
    const staminaCost = isTimedParry ? PARRY_IMPACT_COST : BLOCK_IMPACT_COST;
    p.stamina = Math.max(0, p.stamina - staminaCost);

    if (p.stamina <= 0) {
      p.action = 'staggered';
      p.staggerTimer = GUARD_BREAK_STAGGER;
      p.actionTimer = GUARD_BREAK_STAGGER;
      p.defense = 'none';
      state.hitstopTimer = 0.06;
      state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.5);
      state.stats.comboStreak = 0;
      pushEvent(state, {
        type: 'guard_break_player',
        zone,
        callout: 'GUARD BROKEN!',
        heavy: true,
      });
      return;
    }

    if (isTimedParry) {
      p.riposteWindow = RIPOSTE_WINDOW_DURATION;
      e.action = 'staggered';
      e.staggerTimer = 0.65;
      e.actionTimer = 0.65;
      state.stats.parriesAndCounters += 1;
      state.hitstopTimer = 0.06;
      state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.32);
      pushEvent(state, {
        type: 'player_parry',
        zone,
        callout: 'PARRY! RIPOSTE READY',
        heavy: true,
      });
    } else {
      state.hitstopTimer = 0.035;
      state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.18);
      pushEvent(state, {
        type: 'player_blocked_enemy',
        zone,
        callout: 'BLOCKED',
      });
    }
    return;
  }

  // Unblocked or wrong-direction block
  const chipMultiplier = isWrongBlock ? 0.55 : 1.0;
  if (isWrongBlock) {
    p.stamina = Math.max(0, p.stamina - 6);
  }
  const levelScale = 0.9 + state.levelIndex * 0.12;
  const damage = Math.max(1, Math.round(zoneDef.baseDamage * levelScale * chipMultiplier));
  p.hp = Math.max(0, p.hp - damage);
  p.hitFlashTimer = 0.09;
  state.stats.damageTaken += damage;
  state.stats.comboStreak = 0;
  state.hitstopTimer = 0.055;
  state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.55);

  if (p.hp <= 0) {
    p.action = 'ko';
    p.defense = 'none';
    state.outcome = 'defeat';
    state.koSequenceTimer = 0.7;
    pushEvent(state, {
      type: 'player_ko',
      zone,
      damage,
      callout: 'DEFEATED',
      heavy: true,
    });
  } else {
    pushEvent(state, {
      type: 'enemy_hit_player',
      zone,
      damage,
      callout: isWrongBlock ? `WRONG GUARD -${damage}` : `HIT! -${damage}`,
      heavy: !isWrongBlock,
    });
  }
}

function updateCombatantTimers(
  c: CombatantState,
  dt: number,
  speedScale: number,
  onEnterActive: () => void,
  onFinishRecovery: () => void,
): void {
  if (c.hitFlashTimer > 0) c.hitFlashTimer = Math.max(0, c.hitFlashTimer - dt);
  if (c.retreatCooldown > 0) c.retreatCooldown = Math.max(0, c.retreatCooldown - dt);
  if (c.riposteWindow > 0) c.riposteWindow = Math.max(0, c.riposteWindow - dt);
  if (c.staggerTimer > 0) c.staggerTimer = Math.max(0, c.staggerTimer - dt);

  if (c.action === 'idle') {
    c.stamina = Math.min(c.maxStamina, c.stamina + c.staminaRechargeRate * dt);
    return;
  }

  if (c.action === 'blocking') {
    c.defenseHoldTime += dt;
    c.stamina = Math.max(0, c.stamina - BLOCK_STAMINA_DRAIN_PER_SEC * dt);
    if (c.stamina <= 0) {
      c.action = 'idle';
      c.defense = 'none';
      c.defenseHoldTime = 0;
    }
    return;
  }

  if (c.action === 'ko') {
    return;
  }

  c.actionTimer -= dt;
  if (c.actionTimer > 0) return;

  if (c.action === 'windup' && c.activeZone) {
    const zoneDef = STRIKE_ZONES[c.activeZone];
    c.action = 'active';
    c.actionDuration = zoneDef.activeDuration / speedScale;
    c.actionTimer = c.actionDuration;
    c.hasDealtActiveHit = false;
    onEnterActive();
  } else if (c.action === 'active' && c.activeZone) {
    const zoneDef = STRIKE_ZONES[c.activeZone];
    c.action = 'recovery';
    c.actionDuration = zoneDef.recoveryDuration / speedScale;
    c.actionTimer = c.actionDuration;
  } else if (c.action === 'recovery' || c.action === 'retreating' || c.action === 'staggered') {
    c.action = 'idle';
    c.activeZone = null;
    c.defense = 'none';
    c.actionTimer = 0;
    c.actionDuration = 0;
    onFinishRecovery();
  }
}

function tryStartEnemyAttack(state: DuelState, rng: () => number): void {
  const e = state.enemy;
  if (e.action !== 'idle' && e.action !== 'blocking') return;
  if (e.staggerTimer > 0) return;

  const zone = pickWeightedZone(state.level.attackWeights, rng);
  const def = STRIKE_ZONES[zone];
  if (e.stamina < def.staminaCost) {
    // Wait until stamina recovers
    state.enemyNextAttackTimer = 0.45;
    return;
  }

  e.stamina = Math.max(0, e.stamina - def.staminaCost);
  e.defense = 'none';
  e.activeZone = zone;
  e.action = 'windup';
  // Readable enemy windup scaled by level speed
  const baseEnemyWindup = 0.56 / state.level.enemySpeedMultiplier;
  e.actionDuration = Math.max(0.30, baseEnemyWindup);
  e.actionTimer = e.actionDuration;
  e.hasDealtActiveHit = false;

  pushEvent(state, {
    type: 'enemy_windup',
    zone,
    callout: def.telegraphLabel,
  });
}

export function stepDuelState(
  state: DuelState,
  rawDt: number,
  rng: () => number = Math.random,
): void {
  state.events = [];
  const dt = Math.min(Math.max(rawDt, 0), 0.05);

  if (state.cameraTrauma > 0) {
    state.cameraTrauma = Math.max(0, state.cameraTrauma - dt * 1.9);
  }

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    if (state.player.hitFlashTimer > 0) {
      state.player.hitFlashTimer = Math.max(0, state.player.hitFlashTimer - dt);
    }
    if (state.enemy.hitFlashTimer > 0) {
      state.enemy.hitFlashTimer = Math.max(0, state.enemy.hitFlashTimer - dt);
    }
    return;
  }

  if (state.outcome !== 'ongoing') {
    if (state.koSequenceTimer > 0) {
      state.koSequenceTimer = Math.max(0, state.koSequenceTimer - dt);
    }
    return;
  }

  state.stats.elapsedSeconds += dt;

  // Player update
  updateCombatantTimers(
    state.player,
    dt,
    1.0,
    () => {
      if (!state.player.hasDealtActiveHit) {
        state.player.hasDealtActiveHit = true;
        resolvePlayerStrikeHit(state, rng);
      }
    },
    () => {},
  );

  if (state.outcome !== 'ongoing') return;

  // Enemy AI timers
  const e = state.enemy;
  if (e.action === 'blocking') {
    e.actionTimer -= dt;
    if (e.actionTimer <= 0) {
      e.action = 'idle';
      e.defense = 'none';
    }
  }

  updateCombatantTimers(
    e,
    dt,
    state.level.enemySpeedMultiplier,
    () => {
      pushEvent(state, { type: 'enemy_swing', zone: e.activeZone ?? undefined });
      if (!e.hasDealtActiveHit) {
        e.hasDealtActiveHit = true;
        resolveEnemyStrikeHit(state);
      }
    },
    () => {
      if (state.enemyPendingCombo > 0 && state.outcome === 'ongoing') {
        state.enemyPendingCombo -= 1;
        state.enemyNextAttackTimer = 0.22;
      } else {
        const minCd = state.level.enemyAttackCooldownMin;
        const maxCd = state.level.enemyAttackCooldownMax;
        state.enemyNextAttackTimer = minCd + rng() * (maxCd - minCd);
      }
    },
  );

  if (state.outcome !== 'ongoing') return;

  if (e.action === 'idle' || e.action === 'blocking') {
    state.enemyNextAttackTimer -= dt;
    if (state.enemyNextAttackTimer <= 0) {
      if (state.enemyPendingCombo === 0 && rng() < state.level.enemyComboChance) {
        state.enemyPendingCombo = 1;
      }
      tryStartEnemyAttack(state, rng);
    }
  }
}
