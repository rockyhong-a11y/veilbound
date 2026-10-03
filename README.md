# VEILBOUND · 죽음 너머의 여정

A free, original gothic 2D action roguelite for the web. Play an adult female swordswoman through six explorable regions, collect blessings, and face the three-phase Hollow Queen. Inspired by the fast combat and exploration of the roguelite genre; all characters, environments, names and code are original.

**[Play VEILBOUND](https://rockyhong-a11y.github.io/veilbound/)**

## Play

Desktop: **A/D** or arrow keys move · **Space/W/↑** double jump · **J/F** sword attack · **K/Shift** invulnerable dodge · **Q** heal · **E** travel through a nearby door · **P/Esc** pause.

Touch: drag the **left** side to move; tap or hold the **right** side to attack. Swipe upward to jump, swipe sideways on the right to dodge. A second upward swipe performs a double jump. Use the contextual travel button beside an open door. The small healing button uses a potion.

Defeat every enemy to open the exit, select a blessing, and explore the raised platforms for coins and persistent embers. On death or victory, embers return to the title screen and can upgrade your blade for the next run. Progress saves locally in your browser. Sound is opt-in with the music button. Portrait and landscape layouts are supported; landscape provides a wider view.

## Develop

Node.js 24; no runtime dependencies.

```sh
npm run dev    # http://localhost:5173
npm test       # physics, combat, progression and boss regression checks
npm run build  # static site in dist/
```

GitHub Actions verifies the engine and publishes the static build to GitHub Pages on every push to `main`.

## Art

All five adult female character models and forty sprite frames were modeled and rendered in Blender. `assets/characters.blend` contains the source scene, and `tools/render-assets.py` reproduces the sheets. The built-in image generator created the original gothic environments and cover. A Higgsfield batch was attempted but returned no confirmed generation result, so it was not repeated. Records and final prompts are stored beside the assets. See `assets/ART-SOURCES.md` and `assets/higgsfield-provenance.json`.

This is a compact browser game with a six-region campaign. It does not claim the scale or exact mechanics of a commercial multi-year production.
