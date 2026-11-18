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
export const PARRY_WINDOW_SECONDS = 0.34;
/** A guard raised after the enemy began winding up (plus this grace) is a parry. A guard held from before is a plain block. */
export const PARRY_READ_GRACE = 0.06;
// Swashbuckler balance: holding a guard is tiring, a well-timed parry is free and restores breath.
export const BLOCK_STAMINA_DRAIN_PER_SEC = 12;
export const BLOCK_IMPACT_COST = 14;
export const ENEMY_BLOCK_IMPACT_COST = 10;
export const PARRY_IMPACT_COST = 0;
export const PARRY_STAMINA_REWARD = 8;
// Damage scales keep duels in the 40 to 90 second range so exchanges have time to build.
export const PLAYER_DAMAGE_SCALE = 0.38;
export const ENEMY_DAMAGE_SCALE = 1.0;
// Rally: each clash in an unbroken parry exchange makes the finishing riposte hit harder.
export const RALLY_DAMAGE_BONUS = 0.3;
export const RALLY_COUNTER_DECAY = 0.75;
export const QUICK_RIPOSTE_WINDUP = 0.5;
export const QUICK_RIPOSTE_MIN_WINDUP = 0.36;
/** A feint switches target partway through the windup and buys this much extra time to answer it. */
export const FEINT_EXTENSION = 0.3;
export const RETREAT_DURATION = 0.42;
export const RETREAT_COOLDOWN = 0.52;
export const RETREAT_STAMINA_COST = 10;
export const MIN_ATTACK_STAMINA = 14;
export const RIPOSTE_WINDOW_DURATION = 1.15;
export const RIPOSTE_DAMAGE_MULTIPLIER = 1.2;
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
    rally: 0,
    bestRally: 0,
    enemyWindupDuration: 0.6,
    enemyFeintTimer: -1,
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

function bumpRally(state: DuelState): void {
  state.rally += 1;
  state.bestRally = Math.max(state.bestRally, state.rally);
}

/** Enemy fires back immediately after a parry or counter-parry. Short but readable windup. */
function startEnemyQuickRiposte(state: DuelState, rng: () => number): void {
  const e = state.enemy;
  const zone = pickWeightedZone(state.level.attackWeights, rng);
  e.staggerTimer = 0;
  e.defense = 'none';
  e.activeZone = zone;
  e.action = 'windup';
  e.actionDuration = Math.max(
    QUICK_RIPOSTE_MIN_WINDUP,
    QUICK_RIPOSTE_WINDUP / Math.sqrt(state.level.enemySpeedMultiplier),
  );
  e.actionTimer = e.actionDuration;
  e.hasDealtActiveHit = false;
  state.enemyWindupDuration = e.actionDuration;
  state.enemyFeintTimer = -1;
  state.enemyPendingCombo = 0;
  pushEvent(state, { type: 'enemy_windup', zone, callout: STRIKE_ZONES[zone].telegraphLabel });
}

/** Player's blade is knocked aside: they are free to defend straight away. */
function bouncePlayerBlade(state: DuelState): void {
  const p = state.player;
  p.action = 'idle';
  p.activeZone = null;
  p.actionTimer = 0;
  p.actionDuration = 0;
  p.riposteWindow = 0;
}

function recordMiss(state: DuelState, zone: StrikeZone): void {
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
}

function decideEnemyGuard(state: DuelState, incomingZone: StrikeZone, rng: () => number): void {
  const e = state.enemy;
  if (e.action !== 'idle' && e.action !== 'blocking') return;
  if (e.staggerTimer > 0 || e.stamina < ENEMY_BLOCK_IMPACT_COST) return;

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

  // Swashbuckler exchange: the enemy may turn the riposte aside and fire straight back.
  // Each clash makes the next counter-parry less likely, so long rallies favour the player.
  if (p.riposteWindow > 0 && e.stamina >= 6) {
    const counterChance =
      state.level.enemyCounterParryChance * Math.pow(RALLY_COUNTER_DECAY, state.rally);
    if (rng() < counterChance) {
      e.stamina = Math.max(0, e.stamina - 6);
      bumpRally(state);
      recordMiss(state, zone);
      bouncePlayerBlade(state);
      state.hitstopTimer = 0.05;
      state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.3);
      pushEvent(state, {
        type: 'enemy_counter_parry',
        zone,
        callout: `CLASH! ×${state.rally}`,
        heavy: true,
      });
      startEnemyQuickRiposte(state, rng);
      return;
    }
  }

  decideEnemyGuard(state, zone, rng);

  const isCountered = doesDefenseCounterZone(e.defense, zone);
  const canEnemyHoldBlock = e.stamina >= ENEMY_BLOCK_IMPACT_COST;

  // A plain strike into a ready guard can be parried, and the enemy ripostes.
  if (
    isCountered &&
    canEnemyHoldBlock &&
    e.staggerTimer <= 0 &&
    e.action === 'blocking' &&
    rng() < state.level.enemyParryChance
  ) {
    bumpRally(state);
    recordMiss(state, zone);
    bouncePlayerBlade(state);
    state.hitstopTimer = 0.05;
    state.cameraTrauma = Math.min(1, state.cameraTrauma + 0.3);
    pushEvent(state, { type: 'enemy_parry', zone, callout: 'PARRIED!', heavy: true });
    startEnemyQuickRiposte(state, rng);
    return;
  }

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
    e.stamina = Math.max(0, e.stamina - ENEMY_BLOCK_IMPACT_COST);
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
  const wasRiposte = p.riposteWindow > 0;
  const rallyLength = state.rally;
  // Riposte grows with the length of the exchange that earned it.
  const riposteMult = wasRiposte
    ? RIPOSTE_DAMAGE_MULTIPLIER + RALLY_DAMAGE_BONUS * Math.max(0, rallyLength - 1)
    : 1.0;
  // Stagger bonus only for a guard break, not stacked on a riposte.
  const staggerBonus = !wasRiposte && e.staggerTimer > 0 ? 1.25 : 1.0;
  const partialBlockMult =
    e.action === 'blocking' && e.defense !== 'none' && e.staggerTimer <= 0 ? 0.55 : 1.0;

  const rawDamage =
    zoneDef.baseDamage * PLAYER_DAMAGE_SCALE * riposteMult * staggerBonus * partialBlockMult;
  const damage = Math.max(1, Math.round(rawDamage));
  p.riposteWindow = 0;
  state.rally = 0;

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
      callout: wasRiposte
        ? rallyLength > 1
          ? `TOUCHÉ! ${rallyLength}-CLASH RALLY -${damage}`
          : `RIPOSTE! -${damage}`
        : `-${damage}`,
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
    p.stamina = Math.min(p.maxStamina, p.stamina + PARRY_STAMINA_REWARD);
    bumpRally(state);
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
    const grazed = Math.max(1, Math.round(zoneDef.baseDamage * ENEMY_DAMAGE_SCALE * 0.4));
    state.rally = 0;
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
    // Parry = you read this attack and answered it (guard raised during its windup),
    // or you timed it tight to the impact. Turtling behind a guard raised earlier is only a block.
    const isTimedParry =
      p.defenseHoldTime <= PARRY_WINDOW_SECONDS ||
      p.defenseHoldTime <= state.enemyWindupDuration + PARRY_READ_GRACE;
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
      p.stamina = Math.min(p.maxStamina, p.stamina + PARRY_STAMINA_REWARD);
      bumpRally(state);
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
        callout: state.rally > 1 ? `PARRY! ×${state.rally}` : 'PARRY! RIPOSTE READY',
        heavy: true,
      });
    } else {
      state.rally = 0;
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
  const damage = Math.max(
    1,
    Math.round(zoneDef.baseDamage * ENEMY_DAMAGE_SCALE * levelScale * chipMultiplier),
  );
  p.hp = Math.max(0, p.hp - damage);
  state.rally = 0;
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
  // Windups shrink gently with level (square root) so later duelists stay readable by humans.
  const baseEnemyWindup = 0.62 / Math.sqrt(state.level.enemySpeedMultiplier);
  e.actionDuration = Math.max(0.36, baseEnemyWindup);
  e.actionTimer = e.actionDuration;
  state.enemyWindupDuration = e.actionDuration;
  state.enemyFeintTimer =
    rng() < state.level.enemyFeintChance ? e.actionDuration * (0.4 + rng() * 0.2) : -1;
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
  // Only a riposte window that runs out on its own this tick ends the exchange
  // (a counter-parry also zeroes the window, but the rally must continue then).
  const riposteBefore = state.player.riposteWindow;
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
  if (riposteBefore > 0 && riposteBefore <= dt && state.player.riposteWindow <= 0) {
    state.rally = 0;
  }

  // Enemy AI timers
  const e = state.enemy;
  if (e.action === 'blocking') {
    e.actionTimer -= dt;
    if (e.actionTimer <= 0) {
      e.action = 'idle';
      e.defense = 'none';
    }
  }

  // Feint: partway through the windup the blade switches line to a different guard.
  if (e.action === 'windup' && state.enemyFeintTimer > 0) {
    state.enemyFeintTimer -= dt;
    if (state.enemyFeintTimer <= 0 && e.activeZone) {
      state.enemyFeintTimer = -1;
      const oldCounter = STRIKE_ZONES[e.activeZone].counteredBy;
      let next = e.activeZone;
      for (let i = 0; i < 8 && STRIKE_ZONES[next].counteredBy === oldCounter; i++) {
        next = pickWeightedZone(state.level.attackWeights, rng);
      }
      if (STRIKE_ZONES[next].counteredBy !== oldCounter) {
        e.activeZone = next;
        e.actionTimer += FEINT_EXTENSION;
        state.enemyWindupDuration += FEINT_EXTENSION;
        pushEvent(state, {
          type: 'enemy_windup',
          zone: next,
          callout: `FEINT! ${STRIKE_ZONES[next].telegraphLabel}`,
        });
      }
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
