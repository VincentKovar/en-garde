# Combat balance: the swashbuckler rules

## The problem with iteration 1

Simulated players showed the original rules were too easy and too short:
- Duels ended in 5 to 8 seconds. Three parries won a fight.
- A bot mashing random strikes won 100% of levels 1 to 3 and 95% of level 4.
- Parries cost almost nothing and the riposte hit for 2 to 3 times normal damage.
- Fast players who raised their guard early on slow windups got plain blocks, not parries.
- The enemy blocked at random, always in the correct direction, so strike choice barely mattered.

## The new rules

1. **A parry means you read the attack.** A guard raised after the enemy began its windup
   (or within 0.34s of impact) is a parry. A guard held from before the windup is only a block.
2. **Parrying is rewarded.** It costs no stamina and restores 8. Holding a block drains 12 per second,
   and absorbing a hit on a plain block costs 14.
3. **Rallies.** After your parry, your riposte can be turned aside by the enemy (counter-parry),
   who fires straight back with a quick riposte. Parry again and the rally grows.
   Each clash adds +0.3x to the riposte that finally lands. Each clash also makes the enemy's
   next counter-parry 25% less likely, so long rallies favor the player, like the hero in a film.
4. **The enemy parries too.** Swinging into a ready enemy guard can be parried and punished.
5. **Feints (level 2 and up).** Partway through a windup the enemy switches its line to a different guard,
   with 0.3s added so the switch is answerable.
6. **Human-friendly speed curve.** Windups shrink with the square root of level speed, minimum 0.36s.
7. **Bug fix.** Holding a guard key or button through your own swing now re-raises the guard afterward.

## Tuning knobs

All in `src/game/combat.ts` (top of file) unless noted.

| Knob | Value | Effect of raising it |
|---|---|---|
| `PARRY_WINDOW_SECONDS` | 0.34 | Parries easier to time |
| `PARRY_READ_GRACE` | 0.06 | More forgiving "you read it" check |
| `PARRY_STAMINA_REWARD` | 8 | Parrying sustains you longer |
| `BLOCK_STAMINA_DRAIN_PER_SEC` | 12 | Turtling punished harder |
| `RIPOSTE_DAMAGE_MULTIPLIER` | 1.2 | Single parry pays more |
| `RALLY_DAMAGE_BONUS` | 0.3 | Long rallies pay more |
| `RALLY_COUNTER_DECAY` | 0.75 | Higher = longer rallies (enemy keeps countering) |
| `QUICK_RIPOSTE_WINDUP` | 0.5 | Enemy's return strike easier to answer |
| `FEINT_EXTENSION` | 0.3 | More time to react to a feint |
| `PLAYER_DAMAGE_SCALE` | 0.38 | Shorter duels, easier |
| `ENEMY_DAMAGE_SCALE` | 1.0 | Harder |

Per level in `src/game/levels.ts`: `enemyBlockChance`, `enemyParryChance`, `enemyCounterParryChance`,
`enemyFeintChance`, `enemySpeedMultiplier`, attack cooldowns, combo chance.

## Simulator results after the change

250 duels per cell. "hpLeft" is the player's average health when winning.

| Bot | Level 1 | Level 2 | Level 3 | Level 4 |
|---|---|---|---|---|
| Button masher | 100%, 25s, hp 77 | 100%, 29s, hp 68 | 94%, 33s, hp 50 | 84%, 35s, hp 42 |
| Novice | 100%, 30s, hp 81 | 100%, 32s, hp 76 | 100%, 34s, hp 66 | 98%, 37s, hp 54 |
| Skilled parrier | 100%, 29s, hp 97 | 100%, 31s, hp 96 | 100%, 33s, hp 93 | 100%, 35s, hp 90 |

Exchanges of 3 or more clashes: about 20% at level 1, rising to about 40% at level 4.

## Open questions for playtesting

- Does a rally *feel* like a film duel, or just like repeated button prompts? (Needs the visual clash, see roadmap.)
- Is level 4 hard enough? Bots win often; humans will defend less steadily, so it may already be right.
- Should the masher lose more? Possible levers: raise `enemyParryChance`, or add a stamina cost to whiffs.
- The telegraph banner still names the correct key on every attack. Consider hiding it after level 1.
