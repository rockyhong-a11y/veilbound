# VEILBOUND · 죽음 너머의 여정

A free gothic 2D action roguelite for the web. Play an adult female swordswoman through five vertical labyrinths, collect blessings and hidden relics, then face the three-phase Hollow Queen. The v5 remake adapts art and rig sources from the user-provided [deadsell](https://github.com/rockyhong-a11y/deadsell) reference while preserving VEILBOUND’s authored world, combat simulation and arsenal. Source attribution and adaptations are recorded below.

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

Combat combines eight weapon families, double jumps, a fast dodge, two carried skills and an aerial ground slam. Hit pause, knockback, weapon trails, impact flashes, screen shake and stone debris reinforce each strike. The v5 heroine has **577 native pixel frames across eight Blender weapon atlases**, including sprinting, planted combo attacks, aerial somersaults, dodge, landing and casting. Female enemies now have dedicated preparation, attack, recovery, hurt and death sequences; the queen has 141 frames. Simulation contact ratios synchronize every weapon’s active pose with damage, and animation time freezes with combat. Grounded soles and transparent sprite bounds were measured in Blender and checked visually. All characters are adult women. Only the carried weapon atlases are loaded, keeping unused motion sheets out of browser memory.

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

## v5 remake

The game now fills the viewport with one consistent pixel scale: a native scene buffer, nearest-neighbor character rendering, coherent terrain textures and layered parallax across six regional moods. The compact overlay keeps two weapon slots, two skill slots and the potion available. Settings offer close/wide views, pixel/smooth display and optional camera shake; reduced-motion preferences suppress impact flashes and shake. The map defaults to a readable nearby view, with an entire-region toggle. Only active web assets ship in the static build, and only carried weapon sheets remain loaded.

A **perfect dodge** requires an actual hostile attack collision during the roll. It refunds a small amount of skill cooldown and grants a **+35% one-use melee riposte** for three seconds. Recent HP loss remains recoverable for three seconds; actual damage dealt restores 18% of damage, capped by the recoverable segment and missing HP. Gold and embers attract from nearby, while equipment still requires an explicit slot choice. Kills within four seconds build 5/10/20-kill flow tiers and modestly shorten skill cooldowns.

Each biome has a one-use **80-gold ember shrine** near its central entrance: 35% maximum HP healing, one potion up to capacity, and +4 damage for the run. Each optional combat wing contains a vault that unlocks after **24 actual matching-wing kills** (three in each cathedral wing), rewarding a guaranteed relic, 60 gold and three embers. The existing 10% weapon, 5% skill and 10%-per-category chest gear rolls remain unchanged.

## Develop

Node.js 24; no runtime dependencies.

```sh
npm run dev    # http://localhost:5173
npm test       # physics, combos, skills, exploration, progression and boss checks
npm run build  # static site in dist/
```

New regression checks cover actual hostile collisions for perfect dodges, one-use melee ripostes, all 24 weapon contact boundaries, real second-jump timestamps, capped rally recovery and expiry, currency-only attraction, shrine payment/proximity/revisit persistence, flow tiers, combat-sealed vaults and death timestamps. The art integration suite additionally verifies all 898 native cells, atlas limits, real weapon-contact poses, dash naming, HUD dimensions and the complete boss death sequence. The assertion suite also covers solid terrain, jumping and falling, dodge collision, timed combos, all eight weapons and skills, projectile range/piercing/pulling, bleeding/freezing/shields, physical drops, two-slot replacement, queued weapon switching, rarity scaling, persistent skill cooldowns, slam impacts, touch destruction, fragment bounces, relics, sigil and guardian gates, backtracking and saved progression. It verifies all 460 enemy spawns, movement through both wings of all six regions, multi-target kills, sleeping-enemy status effects, 5,000 actual combat kills and 1,000 chest interactions for the reduced drop rates. Its full campaign follows the authored routes through all five mazes with active enemies, healing and recovery after falls, then survives all three boss phases using timed dodges and the production movement and combat rules.

GitHub Actions verifies the engine and publishes the static build to GitHub Pages on every push to `main`.

## Art and sources

The v5 remake is based on the user-provided `rockyhong-a11y/deadsell` reference at commit `29a98b31be8456f1f3c3b65eb1798ec4dee3370f`. Character rig and animation sources were adapted and regenerated in Blender 5 for VEILBOUND: silver hair, teal armor, crimson scarf, secondary motion, distinct geometry and attacks for all eight weapons, a dedicated HUD portrait, and an enlarged unclipped boss atlas. [`tools/remake-art/README.md`](tools/remake-art/README.md) documents reproduction; [`tools/remake-art/PROVENANCE.md`](tools/remake-art/PROVENANCE.md) records the source relationship. Structured rig and motion inspections record measured sole contact and per-frame bounds.

Terrain atlases and parallax layers from the same reference support six distinct region renderers in `scenery.js`; attribution is in [`assets/remake/scenery/SOURCES.md`](assets/remake/scenery/SOURCES.md). The Galmuri11 pixel font is bundled with its SIL Open Font License in [`assets/remake/fonts/OFL-Galmuri.md`](assets/remake/fonts/OFL-Galmuri.md). The reference repository did not provide a general license file; no permissive redistribution license is asserted for its adapted art or code.

VEILBOUND’s earlier Blender character sources and original weapon icons, hinged treasure chest and sealed/open portal remain in the repository. The active remake keeps the chest/portal and weapon icons. See [`assets/ART-SOURCES.md`](assets/ART-SOURCES.md), `tools/render-reliquary.py` and `tools/render-arsenal.py` for their original pipelines. The earlier gothic cover and backgrounds were created with the built-in image generator. A Higgsfield batch returned no confirmed generation result; its provenance record remains in [`assets/higgsfield-provenance.json`](assets/higgsfield-provenance.json).

This is a compact browser game with a six-region campaign. It does not claim the scale or exact mechanics of a commercial multi-year production.
