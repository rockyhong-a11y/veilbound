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
