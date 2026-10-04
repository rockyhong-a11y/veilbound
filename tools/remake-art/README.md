# VEILBOUND remake character pipeline

The user's DEADSELL repository is the authored reference. Read [PROVENANCE.md](PROVENANCE.md) for the source and adaptations. The remake retains the silver-haired adult heroine, teal armor, red scarf, and entirely female enemies.

## Rebuild heroine atlases

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/remake-art/render_characters.py
python3 tools/remake-art/pack_characters.py
```

Pass weapon IDs after `--` to render a subset. `--preview` renders idle and attack1. `--inspect` records the anatomical scene inventory without rendering. Blender 5.2 uses the direct per-frame renderer; no external packages beyond Pillow are required to pack the PNGs.

The anatomical Empty-joint hierarchy is rigidly parented to actual body meshes. Two-bone planar IK solves hands and feet; sole planting corrects grounded frames. Hair and scarf use simulated chains. Attack smears follow measured weapon-tip arcs. Paired gauntlets, firearm, barbed chain harpoon, broad greatsword, and curved scythe are actual new geometry. Weapons are stowed during tucked long-weapon somersaults. Pixel processing keeps hard alpha and a one-pixel silhouette outline.

## Runtime contract

- `assets/remake/characters/heroine-{weapon}.png` with a matching JSON.
- Native cells: 128 × 112; foot anchor `[64,100]`; anatomical body height: 57 px across all eight weapon variants. A raised weapon does not change body scale.
- One animation per row; frames advance left to right. Each JSON contains row, frame count, fps, looping, and optional `windup`/`active`/`recover` frame counts.
- Heroine animations: `idle`, `run`, `jump`, `fall`, `land`, `double_jump`, `dodge`, `hurt`, `cast`, `attack1`, `attack2`, `attack3`.
- Display attacks with phase-aware mapping: map simulation startup onto windup frames, start active frames at actual damage release, and consume recovery at the remaining attack duration. Source fps alone does not match the fast gameplay timers.
- Native female enemy atlases: `duelist`, `archer`, `warden`, `lancer`; the queen uses `boss`. Enemy animation names stay faithful to their JSON manifests.
- Boss native cells: 352 × 272; anchor `[176,228]`; body height 138 px. States include `slam`, `sweep`, `charge_windup`, `charge`, `leap`, `leap_fall`, `leap_land`, `summon`, `roar`, `hurt`, and `death`. Transparent padding was expanded when rebuilding the reference rig to recover 20 clipped flail/effect frames; pixel scale and anatomical size are unchanged.
- Boss frames are compacted into an 11-column grid. Its clips use `start` indices and `columns` instead of `row`; the texture is 3872 × 3536, with both dimensions below 4096. Decoded memory is 54,765,568 bytes, versus 96 MB for sparse expanded rows.
- `title-heroine.png` is a transparent heroine key-art portrait from the same authored rig and palette.
- `portrait.png` is a separately rendered native 40 × 46 head-and-shoulders HUD crop from that same rig, centered on the actual face.

## Recorded verification

`rig-inspection.json` records actual mesh bounds, materials, parents, semantic joints, camera, lights, and axis conventions. `motion-inspection.json` records all 577 heroine frames, bounds and ankle positions; all 433 grounded frames have zero measured sole-ground error to five decimals. Every heroine cell has transparent edge margins and binary alpha. `enemy-atlas-inspection.json` records native enemy/boss footprint checks. The contact sheet is written to ignored `artifacts/remake-character-contact.png`.

`pipeline-proof.json` checks all 13 sheets and 898 unique native cells against their runtime metadata. All cells fit with transparent margins, all alpha values are binary, and all textures remain within 4096 × 4096. The compressed public character package is approximately 2.33 MiB, including the portrait and title art.

Forward is world +X and up is +Z. Mirroring left-facing sprites happens at runtime around the same foot anchor. Frame measurements are source evidence and are kept outside the public asset package.

The queen can be rebuilt without Blender's older keyframe APIs:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/remake-art/render_boss.py
python3 tools/remake-art/pack_boss.py
```

Render the native HUD portrait with `render_portrait.py`, then run `python3 tools/remake-art/pack_portrait.py`. It is an intentionally cropped portrait, rather than a foot-anchored full-body sprite.
