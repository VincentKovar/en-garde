# En Garde: Blades of Honor

3D first-person fencing duel game for the browser. React 19 + Three.js + Vite + Tailwind, TypeScript.
Originally scaffolded in Google AI Studio (hence `metadata.json` and `@google/genai`, which the game does not use yet).

## About the owner

Vincent is a game designer and playwright, not a coder. When explaining changes:
- Use plain language and short, sequential steps.
- Explain *why* a change helps gameplay, not just what the code does.
- Do not use em dashes in anything written for him (rephrase instead).

## Design goal

The feel of an old swashbuckling movie: back-and-forth blade exchanges, parry and riposte,
the hero winning by reading the opponent. Parrying should be the strongest play;
button mashing should lose ground. See `docs/BALANCE.md`.

## Commands

- `npm install` (if peer dependency errors appear, use `npm install --legacy-peer-deps`)
- `npm run dev` : play at http://localhost:3000 (also reachable from a phone on the same Wi-Fi via the machine's local IP)
- `npm test` : combat rule tests (node test runner via tsx)
- `npm run sim` : balance simulator, bots play 250 duels per level. Run after any change to combat numbers.
- `npm run lint` : TypeScript type-check
- `npm run build` : production build

## Code map

- `src/game/` : pure combat rules, no rendering. Safe to unit test and simulate.
  - `combat.ts` : the duel state machine, all tuning constants at the top
  - `levels.ts` : the four opponents, their stats, and per-level tuning
  - `types.ts` : shared types
- `src/engine/` : Three.js rendering and feedback
  - `FencingScene.ts` : game loop, input, camera, sword and enemy animation, sparks
  - `duelistModel.ts` : enemy built from primitive shapes (candidate for real models)
  - `environments.ts`, `textures.ts` : four arenas, all textures drawn procedurally
  - `audio.ts` : all sound synthesized with Web Audio (candidate for recorded samples)
  - `haptics.ts` : vibration (works on Android only; iOS Safari ignores it)
- `src/components/` : React HUD, title screen, pause and results screens

## Working rules

- Keep combat logic in `src/game/` free of Three.js and DOM code, so tests and the simulator keep working.
- After changing any number in `combat.ts` or `levels.ts`: run `npm test` and `npm run sim`, and report the before and after table.
- Bots defend more consistently than humans. Simulator results guide tuning; human playtests decide it.
- Roadmap and priorities: `docs/ROADMAP.md`. Session history: `docs/HANDOFF.md`.
