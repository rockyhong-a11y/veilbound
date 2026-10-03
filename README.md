# VEILBOUND · 죽음 너머의 여정

A free, original gothic 2D action roguelite for the web. Play an adult female swordswoman through five vertical labyrinths, collect blessings and hidden relics, then face the three-phase Hollow Queen. Inspired by the fast combat and exploration of the roguelite genre; all characters, environments, names and code are original.

**[Play VEILBOUND](https://rockyhong-a11y.github.io/veilbound/)**

## Play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | A/D or ←/→ | Drag the left side |
| Jump / double jump | Space, W or ↑; press again in the air | Swipe upward; a second upward swipe jumps again |
| Attack with the active weapon | Hold J or F | Tap or hold the right side |
| Select / switch carried weapon | 1 / 2 or X | Tap either weapon slot |
| Invulnerable dodge | K or Shift | Swipe sideways on the right |
| First equipped skill | R | Double-tap the right side or tap its skill icon |
| Second equipped skill | T | Tap its skill icon |
| Ground slam / drop through a ledge | ↓ or S | Swipe downward |
| Open a chest / inspect dropped gear / use a nearby portal | E | Tap nearby dropped gear or the interaction button |
| Heal | Q | Tap the potion icon |
| Exploration map | M | Tap the minimap |
| Pause | P or Esc | Tap pause |

The downward action slams while airborne and drops through one-way ledges while grounded. The exploration map pauses the game and reveals more terrain as you travel. A tap anywhere on a crate, urn or cracked wall shatters it into bouncing fragments; sword attacks, skills and slams can also break scenery.

Find each region's **봉인 문양** (sigil) on the high route and defeat its **guardian** to unlock the exit. Ordinary enemies remain optional. Choose a blessing, then use the elevated exit to continue. Backtracking preserves opened chests, broken walls and cleared gates. Coins, potions and relics reward side routes; secret chambers behind cracked walls contain bonuses that last until the run ends.

Each defeated enemy independently has a **10% weapon** and **5% skill** drop chance: one tenth of the previous rates. Treasure chests independently roll a **10% chance for each gear category**, while always granting their relic and currency. Approach a drop and press E or tap it, then select one of the two replacement slots. Replaced gear always stays on the floor. You carry **two weapons and two skills**. Weapon switching during an attack takes effect after recovery. The same skill cannot occupy both slots, and replacing a skill or changing regions preserves its remaining cooldown. Common, rare and epic gear have increasing power; gear level also increases damage and shield strength.

On death or victory, collected embers return to the title screen and can upgrade all your weapons for the next run. Progress saves locally in your browser. Sound is opt-in with the music button. Portrait and landscape layouts are supported; landscape provides a wider view.

## Explore and fight

The five handcrafted **8192×2048** maze biomes are the Ashen Cells, Drowned Aqueduct, Forbidden Archive, Glass Garden and Crimson Forge. Each keeps its original 4096-wide vertical labyrinth in the center and adds a 2048-wide combat wing on each side. Tall walls, low corridors, alternating ledges, vertical shafts and drop routes require climbing and descending. Optional upper routes lead to treasure, and the garden canopy provides a rewarding shortcut. The sixth region is the Hollow Cathedral boss arena, with recovery balconies and elevated platforms for avoiding attacks.

The campaign contains **460 enemies, up from 46**: 90 in each maze and 10 in the cathedral, including one Hollow Queen. The western clearing and eastern battle corridor each contain 36 enemies per maze, arranged on broad floors and raised formations. These additional soldiers have lower health, lighter attacks and staggered timing for sweeping group combat. Entrance banners, a remaining-enemy counter and a consecutive-kill indicator identify the wings. Both wings are optional; the sigil and guardian still control progression. The minimap and full exploration map cover the doubled width. Distant enemies sleep to limit simulation work, while their status effects continue to expire.

Combat combines eight weapon families, double jumps, a fast dodge, two carried skills and an aerial ground slam. Hit pause, knockback, weapon trails, impact flashes, screen shake and stone debris reinforce each strike. Each weapon uses its own **59-frame Blender heroine atlas** for idle, sprint, jump, fall, landing, three attacks, dodge, casting and damage reactions. All five character models are adult women. Only the carried weapon atlases are loaded, keeping unused motion sheets out of browser memory.

| Weapon | Fighting style |
| --- | --- |
| 월광검 · sword | Fast advancing three-hit cuts |
| 파쇄 건틀릿 · gauntlet | Short-range rapid punches, heavy finishing knockback |
| 백야의 창 · spear | Long narrow thrusts |
| 잿빛 권총 · gun | Fast bullets, three-shot finishing burst |
| 가시 활 · bow | Slower arrows that pierce multiple targets |
| 심해 작살 · harpoon | Heavy projectile that drags enemies closer |
| 황혼 대검 · greatsword | Slow broad cuts and heavy knockback |
| 공허의 낫 · scythe | Circular cuts that hit behind you and inflict bleeding |

The eight skills are 혈월의 검기 (piercing wave), 공허의 폭풍 (area blast and projectile counter), 낙성의 심판 (delayed meteor strikes), 서리의 숨결 (piercing freeze), 연쇄 번개 (four-target chain), 천 개의 칼날 (six-dagger fan), 심연의 사슬 (enemy pull), and 여명의 방벽 (four-second damage-absorbing shield). Each has a distinct effect, color, icon and cooldown.

## Develop

Node.js 24; no runtime dependencies.

```sh
npm run dev    # http://localhost:5173
npm test       # physics, combos, skills, exploration, progression and boss checks
npm run build  # static site in dist/
```

The assertion suite covers solid terrain, jumping and falling, dodge collision, timed combos, all eight weapons and skills, projectile range/piercing/pulling, bleeding/freezing/shields, physical drops, two-slot replacement, queued weapon switching, rarity scaling, persistent skill cooldowns, slam impacts, touch destruction, fragment bounces, relics, sigil and guardian gates, backtracking and saved progression. It verifies all 460 enemy spawns, movement through both wings of all six regions, multi-target kills, sleeping-enemy status effects, 5,000 actual combat kills and 1,000 chest interactions for the reduced drop rates. Its full campaign follows the authored routes through all five mazes with active enemies, healing and recovery after falls, then survives all three boss phases using timed dodges and the production movement and combat rules.

GitHub Actions verifies the engine and publishes the static build to GitHub Pages on every push to `main`.

## Art

All five adult female character models were modeled and rendered in Blender. The heroine has eight 59-frame weapon variants, and each of the four other characters has eight frames. `assets/characters.blend` contains the original source scene; `tools/render-assets.py` reproduces the base sheets and `assets/animations.json` records the heroine's animation timing and foot anchor. `tools/render-arsenal.py` renders the weapon variants and eight inventory icons. `tools/render-reliquary.py` renders the hinged treasure chest and the ornate portal's sealed and open loops. Their manifests record dimensions and anchors. The built-in image generator created the original gothic environments and cover. A Higgsfield batch was attempted but returned no confirmed generation result, so it was not repeated. Records and final prompts are stored beside the assets. See [`assets/ART-SOURCES.md`](assets/ART-SOURCES.md) and [`assets/higgsfield-provenance.json`](assets/higgsfield-provenance.json).

This is a compact browser game with a six-region campaign. It does not claim the scale or exact mechanics of a commercial multi-year production.
