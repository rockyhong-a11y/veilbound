"""Pack the intentional native 40x46 HUD portrait with the same pixel pipeline."""
from pathlib import Path
import json
import sheet
ROOT=Path(__file__).resolve().parents[2]
im=sheet.process(ROOT/'artifacts/remake-frames/portrait/idle_000.png')
assert im.size==(40,46)
OUT=ROOT/'assets/remake/characters'
im.save(OUT/'portrait.png',optimize=True)
(OUT/'portrait.json').write_text(json.dumps({'nativeSize':[40,46],
    'source':'tools/remake-art/render_portrait.py','role':'HUD head and shoulders portrait',
    'identity':'adult silver-haired heroine, teal armor and red scarf','forward':'+X'},indent=2))
print('Native HUD portrait packed:40x46')
