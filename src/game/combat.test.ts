import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeZoneAnalytics,
  createDuelState,
  doesDefenseCounterZone,
  setPlayerDefense,
  stepDuelState,
  triggerPlayerAttack,
} from './combat';
import { LEVELS, STRIKE_ZONES } from './levels';

test('6 strike zones have distinct motion types and correct defense counters', () => {
  assert.equal(STRIKE_ZONES.head.motion, 'chop');
  assert.equal(STRIKE_ZONES.chest.motion, 'thrust');
  assert.equal(STRIKE_ZONES.left_shoulder.motion, 'slash_left');
  assert.equal(STRIKE_ZONES.right_shoulder.motion, 'slash_right');
  assert.equal(STRIKE_ZONES.left_hip.motion, 'slash_low_left');
  assert.equal(STRIKE_ZONES.right_hip.motion, 'slash_low_right');

  // W horizontal block counters head chop
  assert.equal(doesDefenseCounterZone('block_high', 'head'), true);
  assert.equal(doesDefenseCounterZone('block_high', 'chest'), false);

  // A and D side blocks counter corresponding shoulders and hips
  assert.equal(doesDefenseCounterZone('block_left', 'left_shoulder'), true);
  assert.equal(doesDefenseCounterZone('block_left', 'left_hip'), true);
  assert.equal(doesDefenseCounterZone('block_left', 'right_shoulder'), false);

  assert.equal(doesDefenseCounterZone('block_right', 'right_shoulder'), true);
  assert.equal(doesDefenseCounterZone('block_right', 'right_hip'), true);
  assert.equal(doesDefenseCounterZone('block_right', 'left_hip'), false);

  // S retreat counters chest thrust
  assert.equal(doesDefenseCounterZone('retreat', 'chest'), true);
  assert.equal(doesDefenseCounterZone('retreat', 'head'), false);
});

test('attacking depletes stamina and idle state recharges stamina gradually', () => {
  const state = createDuelState(0);
  const initialStamina = state.player.stamina;

  const launched = triggerPlayerAttack(state, 'head');
  assert.equal(launched, true);
  assert.equal(state.player.stamina, initialStamina - STRIKE_ZONES.head.staminaCost);

  // Advance until attack completes windup -> active -> recovery -> idle
  for (let i = 0; i < 20; i++) {
    stepDuelState(state, 0.04, () => 0.99); // rng=0.99 prevents enemy block
  }
  assert.equal(state.player.action, 'idle');
  const postAttackStamina = state.player.stamina;

  // Remaining idle for 1 second recharges stamina
  for (let i = 0; i < 25; i++) {
    stepDuelState(state, 0.04, () => 0.99);
  }
  assert.ok(
    state.player.stamina > postAttackStamina,
    'Idle player should regenerate stamina',
  );
});

test('blocking depletes stamina and W block parries enemy head chop', () => {
  const state = createDuelState(0);
  state.enemy.action = 'windup';
  state.enemy.activeZone = 'head';
  state.enemy.actionDuration = 0.05;
  state.enemy.actionTimer = 0.05;
  state.enemy.hasDealtActiveHit = false;

  // Player raises W horizontal block right before impact
  setPlayerDefense(state, 'block_high');
  const preBlockStamina = state.player.stamina;

  stepDuelState(state, 0.04, () => 0.5);
  stepDuelState(state, 0.04, () => 0.5);

  assert.equal(state.player.hp, state.player.maxHp, 'W block should negate head chop damage');
  assert.ok(state.player.stamina < preBlockStamina, 'Blocking should consume stamina');
  assert.ok(state.player.riposteWindow > 0, 'Timed parry should open riposte window');
});

test('S retreat specifically counters enemy chest thrust and opens riposte', () => {
  const state = createDuelState(0);
  state.enemy.action = 'windup';
  state.enemy.activeZone = 'chest';
  state.enemy.actionDuration = 0.04;
  state.enemy.actionTimer = 0.04;
  state.enemy.hasDealtActiveHit = false;

  setPlayerDefense(state, 'retreat');
  const enemyStaminaBefore = state.enemy.stamina;

  stepDuelState(state, 0.04, () => 0.5);
  stepDuelState(state, 0.04, () => 0.5);

  assert.equal(state.player.hp, state.player.maxHp, 'Retreat should counter thrust without taking damage');
  assert.equal(state.enemy.action, 'staggered', 'Enemy should stagger on countered thrust');
  assert.ok(state.enemy.stamina < enemyStaminaBefore, 'Countered thrust should drain enemy stamina');
  assert.ok(state.player.riposteWindow > 0, 'Retreat counter should grant riposte window');
});

test('levels progress in environment, speed, and enemy stamina recharge rate', () => {
  assert.equal(LEVELS.length, 4);
  const envs = LEVELS.map((l) => l.environment);
  assert.deepEqual(envs, ['castle', 'pirate_ship', 'medieval_street', 'icy_caverns']);

  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].enemySpeedMultiplier > LEVELS[i - 1].enemySpeedMultiplier);
    assert.ok(LEVELS[i].enemyStaminaRecharge > LEVELS[i - 1].enemyStaminaRecharge);
  }
});

test('defeating enemy transitions duel outcome to victory', () => {
  const state = createDuelState(0);
  state.enemy.hp = 10;

  triggerPlayerAttack(state, 'chest');
  for (let i = 0; i < 15; i++) {
    stepDuelState(state, 0.04, () => 0.99);
    if (state.hitstopTimer > 0) {
      // step through hitstop
      stepDuelState(state, 0.05, () => 0.99);
    }
  }

  assert.equal(state.enemy.hp, 0);
  assert.equal(state.outcome, 'victory');
});

test('tracks 6-zone hit accuracy and cumulative duel timeline analytics', () => {
  const state = createDuelState(0);

  // Strike 1: Head (unblocked, rng=0.99)
  triggerPlayerAttack(state, 'head');
  for (let i = 0; i < 18; i++) {
    stepDuelState(state, 0.04, () => 0.99);
  }

  // Strike 2: Chest (blocked, rng=0.01)
  triggerPlayerAttack(state, 'chest');
  for (let i = 0; i < 18; i++) {
    stepDuelState(state, 0.04, () => 0.01);
  }

  // Strike 3: Left Hip (unblocked, rng=0.99)
  triggerPlayerAttack(state, 'left_hip');
  for (let i = 0; i < 18; i++) {
    stepDuelState(state, 0.04, () => 0.99);
  }

  const analytics = computeZoneAnalytics(state.stats);
  assert.equal(analytics.zoneSeries.length, 6);
  assert.equal(analytics.overallAccuracyPct, 67);
  assert.equal(state.stats.accuracyHistory.length, 3);
  assert.deepEqual(
    state.stats.accuracyHistory.map((pt) => pt.cumulativeAccuracy),
    [100, 50, 67],
  );

  const headRow = analytics.zoneSeries.find((r) => r.zone === 'head')!;
  const chestRow = analytics.zoneSeries.find((r) => r.zone === 'chest')!;
  const leftHipRow = analytics.zoneSeries.find((r) => r.zone === 'left_hip')!;

  assert.equal(headRow.attempts, 1);
  assert.equal(headRow.hits, 1);
  assert.equal(headRow.accuracyPct, 100);

  assert.equal(chestRow.attempts, 1);
  assert.equal(chestRow.blocked, 1);
  assert.equal(chestRow.accuracyPct, 0);

  assert.equal(leftHipRow.attempts, 1);
  assert.equal(leftHipRow.hits, 1);
  assert.equal(leftHipRow.accuracyPct, 100);
});
