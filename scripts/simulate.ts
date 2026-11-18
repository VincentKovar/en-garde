// Balance simulator: plays scripted bot "players" against the combat engine.
// Run with: npm run sim   (takes about a minute; numbers are directional, not exact)
import { createDuelState, stepDuelState, triggerPlayerAttack, setPlayerDefense } from '../src/game/combat';
import { STRIKE_ZONES, ALL_STRIKE_ZONES } from '../src/game/levels';
import type { StrikeZone, DefenseAction } from '../src/game/types';

interface Player { name: string; react: number; acc: number; timed: boolean; offense: 'mash' | 'riposte_only' | 'smart' }
const DEFS: DefenseAction[] = ['block_high', 'block_left', 'block_right', 'retreat'];

function run(level: number, pl: Player) {
  const s = createDuelState(level);
  const dt = 1 / 60;
  let t = 0, windupStart = -1, windupLen = 0, handled = true, chosen: DefenseAction = 'none', holdUntil = -1;
  let prevAction = 'idle', prevTimer = 0;
  while (s.outcome === 'ongoing' && t < 240) {
    const e = s.enemy, p = s.player;
    // detect a new enemy windup (including back-to-back quick ripostes)
    if (e.action === 'windup' && (prevAction !== 'windup' || e.actionTimer > prevTimer + 1e-6)) {
      windupStart = t; windupLen = e.actionTimer; handled = false;
      const right = STRIKE_ZONES[e.activeZone as StrikeZone].counteredBy;
      chosen = Math.random() < pl.acc ? right : DEFS[Math.floor(Math.random() * 4)];
    }
    prevAction = e.action; prevTimer = e.actionTimer;
    if (!handled && e.action === 'windup') {
      // skilled players time the press to land ~0.15s before impact; others press on reaction
      const jitter = (Math.random() + Math.random() + Math.random() - 1.5) * 0.12; // human variance
      const pressAt = pl.timed ? Math.max(pl.react, windupLen - 0.17) : pl.react + jitter;
      if (t - windupStart >= pressAt && (p.action === 'idle' || p.action === 'blocking')) {
        setPlayerDefense(s, chosen); handled = true; holdUntil = t + 0.12;
      }
    }
    // keep the guard up through the windup, release shortly after the blow lands
    if (holdUntil > 0 && e.action === 'windup') holdUntil = Math.max(holdUntil, t + 0.08);
    if (holdUntil > 0 && t >= holdUntil) { setPlayerDefense(s, 'none'); holdUntil = -1; }

    if (p.action === 'idle' && holdUntil < 0) {
      const z = ALL_STRIKE_ZONES[Math.floor(Math.random() * 6)];
      if (p.riposteWindow > 0 && Math.random() < 0.15) triggerPlayerAttack(s, z); // ~reaction delay on riposte
      else if (pl.offense === 'mash' && p.stamina > 30 && e.action !== 'windup' && Math.random() < 0.1) triggerPlayerAttack(s, z);
      else if (pl.offense === 'smart' && p.stamina > 50 && (e.action === 'recovery' || (e.action === 'idle' && Math.random() < 0.01))) triggerPlayerAttack(s, z);
    }
    stepDuelState(s, dt); t += dt;
  }
  return { hp: s.player.hp, win: s.outcome === 'victory', timeout: s.outcome === 'ongoing', t, best: s.bestRally, parries: s.stats.parriesAndCounters };
}

const players: Player[] = [
  { name: 'button-masher', react: 0.36, acc: 0.65, timed: false, offense: 'mash' },
  { name: 'novice', react: 0.36, acc: 0.75, timed: false, offense: 'smart' },
  { name: 'reactive', react: 0.30, acc: 0.88, timed: false, offense: 'smart' },
  { name: 'parry-only', react: 0.30, acc: 0.88, timed: false, offense: 'riposte_only' },
  { name: 'skilled', react: 0.26, acc: 0.95, timed: true, offense: 'smart' },
];
const N = 250;
for (const pl of players) {
  const cells: string[] = [];
  for (let L = 0; L < 4; L++) {
    let w = 0, tt = 0, best = 0, par = 0, to = 0, hp = 0;
    for (let i = 0; i < N; i++) { const r = run(L, pl); w += +r.win; if (r.win) hp += r.hp; to += +r.timeout; tt += r.t; best += r.best; par += r.parries; }
    cells.push(`L${L + 1} ${String(Math.round(100 * w / N)).padStart(3)}% ${String(Math.round(tt / N)).padStart(3)}s hpLeft${w ? Math.round(hp / w) : 0} rally${(best / N).toFixed(1)} par${(par / N).toFixed(0)}${to ? ' TO' + to : ''}`);
  }
  console.log(pl.name.padEnd(14), cells.join(' | '));
}
