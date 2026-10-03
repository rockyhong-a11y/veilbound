# VEILBOUND original character assets

All five character sprite strips are original adult female models created and
rendered in Blender for this project. They contain no extracted game assets.

- `player.png`: silver ponytail heroine, indigo armor, red scarf, steel sword.
- `duelist.png`: dark-haired duelist, violet armor, enchanted crimson sword.
- `archer.png`: female hunter in an ochre hood with a recurve bow.
- `warden.png`: silver-haired female warden, teal armor and kite shield.
- `boss.png`: the Thorn Queen, silver hair, antler crown, black gown and scythe.

The first four strips contain 8 transparent 192×256 frames, left to right.
The queen contains 8 transparent 256×320 frames. All characters face right.
Frames 0–5 form the run cycle. Frame 6 is the attack/release pose. Frame 7 is
the heroine's low dodge, other fighters' raised windup, the hunter's drawn
bow, and the queen's scythe windup.
`characters.blend` stores the heroine's first pose; `tools/render-assets.py`
reconstructs every model and animated pose, lights and camera reproducibly.

Render with Blender, then stitch the rendered PNG frames with Python/Pillow:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/render-assets.py
python3 tools/render-assets.py --stitch
```

Foot anchor: approximately `(96, 239)` within each standard frame and
`(128, 288)` within each queen frame. Transparent padding includes weapons,
cloth and hair; retain the complete frame when drawing.

## Environments and cover

The original prison, cathedral and female swordswoman cover were generated with the built-in OpenAI image generator. A Higgsfield batch was attempted but its outcome was not confirmed and it was not repeated. Prompts, dimensions and the attempt record are in `higgsfield-provenance.json`.
