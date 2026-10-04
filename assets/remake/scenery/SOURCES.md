# VEILBOUND scenery remake · source record

The three terrain atlases and twelve parallax layers in `tiles/` and `bg/` are
copied without image modification from the user's own DEADSELL repository:

- Repository: https://github.com/rockyhong-a11y/deadsell
- Source commit: `29a98b31be8456f1f3c3b65eb1798ec4dee3370f`
- Original paths: `public/assets/tiles/` and `public/assets/bg/`
- Source pipeline: `tools/blender/asset_tiles.py`, `tools/blender/asset_bg.py`,
  `tools/pack/post_tiles.py`, and `tools/pack/post_bg.py` in that repository.

The user supplied DEADSELL as their own work and explicitly asked to use it as
the basis for improving VEILBOUND. Its repository has no top-level license;
these assets are not represented as permissively licensed third-party art.
They are user-authorized source material for this project. They contain no
extracted Dead Cells game assets according to the source design document.

`scenery.js` is new VEILBOUND rendering code. It preserves the authored
collision geometry and adapts the source art to six scenes: prison, aqueduct,
archive, garden, forge, and cathedral. Palette tinting, stone-depth bands,
arcades, bookshelf bays, torch light, waterfalls, vines, particles, and foreground
accents are assembled in the browser. The original PNGs and atlas JSON files
are retained intact so the source art remains reproducible and attributable.

No font or character assets are included in this scenery directory.
