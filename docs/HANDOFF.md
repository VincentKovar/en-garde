# Handoff: 2026-11-18 (from a Claude chat session to Claude Code)

## What happened

1. Reviewed the first iteration across four areas: visuals, mobile play, parry versus strike balance, and assets.
   Findings are folded into `docs/ROADMAP.md`.
2. Built `scripts/simulate.ts`, a bot simulator, and measured the original balance (too easy, too short).
3. Implemented the swashbuckler combat rules on branch `swashbuckler-balance`. Details in `docs/BALANCE.md`.
4. Added `react-is` to dependencies. The original project failed `npm run build` without it (recharts needs it).
5. Added `npm test` and `npm run sim` scripts.

## State

- Type-check passes, 11 of 11 tests pass (4 new), production build succeeds.
- Nothing has been playtested by a human yet.

## Next step

Vincent plays the branch (`npm run dev`) on desktop and phone, then tunes with the knobs in `docs/BALANCE.md`.
After that, the highest-value item is the visible blade clash (Roadmap 1), because the new rally rules
are invisible without it.

## Files changed on this branch

- `src/game/combat.ts` : new constants, rally logic, enemy parry and counter-parry, feints, parry read check
- `src/game/levels.ts` : new per-level fields (`enemyParryChance`, `enemyCounterParryChance`, `enemyFeintChance`), retuned block chances
- `src/game/types.ts` : new fields and event types
- `src/engine/FencingScene.ts` : sound and sparks for clashes, held-guard bug fix
- `src/game/combat.test.ts` : two tests updated for the new rules, four added
