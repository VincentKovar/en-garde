# Roadmap

Order: combat balance (done, needs playtest) > phone and tablet controls > visuals and assets.
Each item notes where the work lives.

## 1. Combat balance (in progress)

- [x] Swashbuckler rules: parry reads, rallies, enemy parries, feints (see `docs/BALANCE.md`)
- [ ] Human playtest on desktop and phone; tune with the knobs in BALANCE.md
- [ ] **Visible blade clash.** When a parry or counter-parry happens, the two blades should meet on screen,
      hold for a beat, and spring apart. Today it looks like a normal block. (`FencingScene.ts`)
- [ ] Rally counter on the HUD that builds tension ("×3", "×4") with rising clang pitch per clash (`CombatHud.tsx`, `audio.ts`)
- [ ] Hide the "[W] BLOCK" answer hint after level 1, so players read the enemy's body instead (`CombatHud.tsx`)
- [ ] Enemy holds a visible guard stance the player must strike around (uses the unused `enemyLastGuardSwitchTimer` field)
- [ ] Optional: footwork. Advance and retreat to control distance, like film duels on staircases and decks

## 2. Phone and tablet

- [ ] **Strike input.** Replace tapping the small enemy body with large screen regions or swipe gestures
      (swipe direction = strike line). `triggerTouchStrike()` in `FencingScene.ts` exists but nothing calls it.
- [ ] **Defense buttons.** Bigger, thumb-reachable (split left and right edges), labeled with icons, not W/A/S/D
- [ ] Telegraph text should not say keyboard letters on touch devices
- [ ] Use `100dvh` instead of `h-screen` so mobile browser toolbars do not cut off the HUD
- [ ] Safe-area padding for notches; landscape layout (or a "rotate your phone" prompt)
- [ ] iOS haptics: Vibration API is unsupported in Safari. Options: accept no haptics on iPhone,
      or the `<input type="checkbox" switch>` workaround (a hack that may break)
- [ ] Adaptive quality: lower pixel ratio and turn off shadows on slow phones

## 3. Visuals and assets

Lesson from the Alexandria VR library: the code is capable, it needs real material to work with.

**Improve what exists**
- [ ] Feed `environments.ts` real image textures instead of procedural canvas drawings
- [ ] Replace synthesized clangs, whooshes and footsteps with recorded samples, processed for clarity
      (same approach as the Brazen Head audio)
- [ ] Sky images (HDRI) per arena to replace flat background colors

**Bring in from outside** (check each license before use)
- Textures and HDRI skies: Poly Haven, ambientCG (public domain)
- 3D props and environment pieces: Kenney, Quaternius (public domain)
- Rigged characters and sword animations: Mixamo (free, Adobe account)
- Sound effects: Freesound (license varies per file)

- [ ] Replace primitive-shape duelists in `duelistModel.ts` with rigged models (GLTF via `GLTFLoader`).
      Keep the invisible hitboxes and zone rings; they drive targeting.
- [ ] Each opponent visually distinct beyond palette (castle knight, pirate captain, duchess, frost warden)
