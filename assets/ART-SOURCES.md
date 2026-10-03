# VEILBOUND original character assets

All five character sprite strips are original adult female models created and
rendered in Blender for this project. They contain no extracted game assets.

- `player.png`: silver ponytail heroine, indigo armor, red scarf, steel sword.
- `duelist.png`: dark-haired duelist, violet armor, enchanted crimson sword.
- `archer.png`: female hunter in an ochre hood with a recurve bow.
- `warden.png`: silver-haired female warden, teal armor and kite shield.
- `boss.png`: the Thorn Queen, silver hair, antler crown, black gown and scythe.

The heroine uses a transparent 4608×1600 atlas: 12 columns of 384×320 frames,
59 distinct poses packed consecutively. `animations.json` defines each state's
start frame, frame count, playback rate and loop behavior. Its states are idle
(6), sprint (12), jump (3), fall (3), landing (3), three sword combos (6/6/7),
dash (4), spell cast (6) and hurt (3). Poses include articulated shoulder,
elbow, hip and knee motion, forward torso lean, planted lunges, an overhead
slam and a crouched dash. Hair strands and split cloth change geometry with
the state and run cycle rather than moving as rigid blocks.

The duelist, archer and warden use 8 transparent 192×256 frames. The queen
uses 8 transparent 256×320 frames. All characters face right. Enemy frames
0–5 form a run cycle, frame 6 attacks/releases, and frame 7 winds up. Enemy
run poses now lift the knee, extend the stride and lean the torso; melee
attacks use distinct raised windups and extended lunges.
`characters.blend` stores the heroine's first pose; `tools/render-assets.py`
reconstructs every model and animated pose, lights and camera reproducibly.

Render with Blender, then stitch the rendered PNG frames with Python/Pillow:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/render-assets.py
python3 tools/render-assets.py --stitch
```

Add `-- --player-only` or `-- --enemies-only` to Blender and the matching
`--player-only` or `--enemies-only` to stitching to regenerate one cast group.
Stitching checks every frame's dimensions and alpha bounds and rejects
clipped weapons, hair or cloth. The player atlas uses a calibrated foot
anchor `(192, 296)`, recorded in the manifest. Enemy foot anchors are
approximately `(96, 239)` within each standard frame and
`(128, 288)` within each queen frame. Transparent padding includes weapons,
cloth and hair; retain the complete frame when drawing.

## Environments and cover

The original prison, cathedral and female swordswoman cover were generated with the built-in OpenAI image generator. A Higgsfield batch was attempted but its outcome was not confirmed and it was not repeated. Prompts, dimensions and the attempt record are in `higgsfield-provenance.json`.

## Animated reliquary objects

The treasure chest and portal are original 3D models built and rendered in
Blender with physically based materials and transparent film. No extracted
game artwork is used. `tools/render-reliquary.py` recreates their geometry,
animation, cameras and three-point lighting. `reliquary-chest.blend` and
`reliquary-portal.blend` retain the closed and sealed model scenes.

- `reliquary-chest.png`: 8 consecutive 256×192 frames, 2048×192 total. The
  domed oak case has separate brass bindings, rivets, filigree, claw feet,
  hinges and a garnet keyhole. Frames 0–7 physically rotate its lid to
  reveal coins, faceted gemstones and rising treasure sparks. Play the
  opening at 14 fps and hold frame 7. The draw anchor is `(128, 174)`.
- `reliquary-portal.png`: 16 frames of 256×384, packed as 8 columns and
  2 rows, 2048×768 total. The Gothic gateway has individual basalt arch
  stones, inset runes, gilt tracery, pillar collars and crystal keystones.
  Frames 0–7 show crossed binding chains and the crimson royal seal;
  frames 8–15 show broken chains, emissive spiral filaments and orbiting
  aether shards. Each state loops at 12 fps. Anchor: `(128, 366)`.

`reliquary-animations.json` records frame dimensions, state ranges, rates
and anchors. Rebuild with:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/render-reliquary.py
python3 tools/render-reliquary.py --stitch
```

The stitching step verifies dimensions and alpha bounds for every frame.
The complete 24-frame asset pass used Cycles at 20 samples with denoising.

## Weapon arsenal · v3

`tools/render-arsenal.py` builds seven original weapon models and eight
inventory icons in Blender. It reuses the original adult heroine, camera,
clothing, lights and eleven animation states from `tools/render-assets.py`.
The sword retains `player.png`; each of the other seven weapons has a full
59-frame 4608×1600 atlas with 384×320 cells and foot anchor `(192, 296)`.

The gauntlets alternate punches and an uppercut; the spear and harpoon use
two-handed thrusts; the pistol has aim and recoil; the bow draws and releases
its string; the greatsword and scythe use broad two-handed cuts. Their geometry
replaces the sword in each render. The seven new atlases contain 413 new
frames, bringing all eight variants to 472 frames. Every frame's alpha bounds
were checked for clipping. Icons were framed from their modeled geometry at
256×256, then packed with transparent margins for small touch HUDs.

`arsenal-art.json` maps weapon IDs to atlases, icons and pose records.
`animations.json` supplies the shared frame state ranges and timing. Rebuild:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/render-arsenal.py
python3 tools/render-arsenal.py --stitch
```

The browser loads only the carried variants and releases replaced atlas
references. Blender source scenes and backups are excluded from the public
web build; the reproducible sources remain in this repository.
