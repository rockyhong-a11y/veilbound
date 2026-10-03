# VEILBOUND · 죽음 너머의 여정

A free, original gothic 2D action roguelite for the web. Play an adult female swordswoman through five vertical labyrinths, collect blessings and hidden relics, then face the three-phase Hollow Queen. Inspired by the fast combat and exploration of the roguelite genre; all characters, environments, names and code are original.

**[Play VEILBOUND](https://rockyhong-a11y.github.io/veilbound/)**

## Play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | A/D or ←/→ | Drag the left side |
| Jump / double jump | Space, W or ↑; press again in the air | Swipe upward; a second upward swipe jumps again |
| Three-hit sword combo | Hold J or F | Tap or hold the right side |
| Invulnerable dodge | K or Shift | Swipe sideways on the right |
| 혈월의 검기 — traveling sword wave | R | Double-tap the right side or tap its skill icon |
| 공허의 폭풍 — nearby blast and projectile counter | T | Tap its skill icon |
| Ground slam / drop through a ledge | ↓ or S | Swipe downward |
| Open a chest / use a nearby door | E | Tap the contextual interaction button |
| Heal | Q | Tap the potion icon |
| Exploration map | M | Tap the minimap |
| Pause | P or Esc | Tap pause |

The downward action slams while airborne and drops through one-way ledges while grounded. The exploration map pauses the game and reveals more terrain as you travel. A tap anywhere on a crate, urn or cracked wall shatters it into bouncing fragments; sword attacks, skills and slams can also break scenery.

Find each region's **봉인 문양** (sigil) on the high route and defeat its **guardian** to unlock the exit. Ordinary enemies remain optional. Choose a blessing, then use the elevated exit to continue. Backtracking preserves opened chests, broken walls and cleared gates. Coins, potions and relics reward side routes; secret chambers behind cracked walls contain bonuses that last until the run ends.

On death or victory, collected embers return to the title screen and can upgrade your blade for the next run. Progress saves locally in your browser. Sound is opt-in with the music button. Portrait and landscape layouts are supported; landscape provides a wider view.

## Explore and fight

The five handcrafted **4096×2048** maze biomes are the Ashen Cells, Drowned Aqueduct, Forbidden Archive, Glass Garden and Crimson Forge. Tall walls, low corridors, alternating ledges, vertical shafts and drop routes require climbing and descending instead of running along a flat floor. Optional upper routes lead to treasure, and the garden canopy provides a rewarding shortcut. The sixth region is the Hollow Cathedral boss arena, with recovery balconies and elevated platforms for avoiding attacks.

Combat combines a three-hit advancing sword combo, double jumps, a fast dodge, two cooldown skills and an aerial ground slam. Hit pause, knockback, animated sword trails, impact flashes, screen shake and stone debris reinforce each strike. The heroine uses **59 Blender-rendered animation frames** for idle, sprint, jump, fall, landing, three attacks, dodge, casting and damage reactions. All five character models are adult women.

## Develop

Node.js 24; no runtime dependencies.

```sh
npm run dev    # http://localhost:5173
npm test       # physics, combos, skills, exploration, progression and boss checks
npm run build  # static site in dist/
```

The assertion suite covers solid terrain, jumping and falling, dodge collision, timed sword combos, both skills, slam impacts, touch destruction, fragment bounces, relics, sigil and guardian gates, backtracking and saved progression. Its full campaign follows the authored routes through all five mazes with active enemies, healing and recovery after falls, then survives all three boss phases using timed dodges and the production movement and combat rules.

GitHub Actions verifies the engine and publishes the static build to GitHub Pages on every push to `main`.

## Art

All five adult female character models were modeled and rendered in Blender. The heroine has a 59-frame atlas, and each of the four other characters has eight frames. `assets/characters.blend` contains the source scene; `tools/render-assets.py` reproduces the sheets and `assets/animations.json` records the heroine's animation timing and foot anchor. The built-in image generator created the original gothic environments and cover. A Higgsfield batch was attempted but returned no confirmed generation result, so it was not repeated. Records and final prompts are stored beside the assets. See [`assets/ART-SOURCES.md`](assets/ART-SOURCES.md) and [`assets/higgsfield-provenance.json`](assets/higgsfield-provenance.json).

This is a compact browser game with a six-region campaign. It does not claim the scale or exact mechanics of a commercial multi-year production.
