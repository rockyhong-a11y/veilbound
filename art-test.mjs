import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRun, attack, step, WEAPONS } from './engine.js';
import { createSprites } from './sprites.js';

const root = 'assets/remake/characters/';
function metadata(name) { return JSON.parse(readFileSync(root + name + '.json', 'utf8')); }
function dimensions(path) {
  const png = readFileSync(path);
  assert.equal(png.subarray(1, 4).toString(), 'PNG', path);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}
let uniqueCells = 0;
for (const name of [...WEAPONS.map(w => 'heroine-' + w.id), 'duelist', 'archer', 'warden', 'lancer', 'boss']) {
  const data = metadata(name), im = dimensions(root + data.image), cells = new Set();
  assert.ok(im.width <= 4096 && im.height <= 4096, `${name}: mobile texture bound`);
  assert.ok(data.bodyHeightPx > 0 && data.anchor.length === 2);
  for (const [name, clip] of Object.entries(data.animations || data.states)) {
    assert.ok(clip.frames > 0 && clip.fps > 0, name);
    if (clip.windup !== undefined) assert.equal(clip.windup + clip.active + clip.recover, clip.frames, name);
    for (let frame = 0; frame < clip.frames; frame++) {
      const index = (clip.start || 0) + frame;
      const sx = clip.row === undefined ? index % data.columns * data.frameW : frame * data.frameW;
      const sy = clip.row === undefined ? Math.floor(index / data.columns) * data.frameH : clip.row * data.frameH;
      assert.ok(sx >= 0 && sy >= 0 && sx + data.frameW <= im.width && sy + data.frameH <= im.height, `${name}: valid native cell`);
      cells.add(`${sx}/${sy}`);
    }
  }
  uniqueCells += cells.size;
}
assert.equal(uniqueCells, 898);
assert.deepEqual(dimensions(root + 'portrait.png'), { width: 40, height: 46 });
assert.ok(existsSync('assets/remake/fonts/OFL-Galmuri.md'));

// Exercise the production sprite loader/renderer with actual atlas dimensions.
// This checks timer-to-pose integration without introducing a browser dependency.
const originalImage = globalThis.Image, originalFetch = globalThis.fetch;
class NativeImage {
  set src(path) { Object.assign(this, dimensions(path.split('?')[0])); queueMicrotask(() => this.onload?.()); }
}
globalThis.Image = NativeImage;
globalThis.fetch = async path => ({ ok: true, json: async () => JSON.parse(readFileSync(path.split('?')[0], 'utf8')) });
const draws = [], filters = [];
const ctx = {
  globalAlpha: 1, filter: 'none',
  save() { filters.push(this.filter); }, restore() { this.filter = filters.pop(); },
  translate() {}, scale() {},
  drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh) {
    assert.ok([sx, sy, sw, sh, dx, dy, dw, dh].every(Number.isFinite));
    assert.ok(sx >= 0 && sy >= 0 && sx + sw <= im.width && sy + sh <= im.height);
    draws.push({ sx, sy, filter: this.filter });
  },
};
try {
  const sprites = await createSprites();
  for (const weapon of WEAPONS) {
    await sprites.loadWeapon(weapon.id);
    const s = createRun(), p = s.player;
    s.rooms[0].enemies = []; p.weapons[0].type = weapon.id;
    assert.ok(attack(s));
    while (p.attackPending) step(s, {}, 1 / 120);
    sprites.draw(ctx, 'player', p, s, s.time);
    const clip = metadata('heroine-' + weapon.id).animations.attack1;
    assert.equal(draws.at(-1).sy, clip.row * 112, `${weapon.id}: contact uses an attack pose`);
    assert.ok(draws.at(-1).sx >= clip.windup * 128, `${weapon.id}: actual release has reached active frames`);
    assert.ok(Math.abs(p.attackContact - clip.damageAt) < 5.1e-7, `${weapon.id}: asset and simulation contact agree`);
    p.anim = 'dash'; p.dashTimer = .03; sprites.draw(ctx, 'player', p, s, s.time);
    assert.equal(draws.at(-1).sy, metadata('heroine-' + weapon.id).animations.dodge.row * 112, 'engine dash maps to the tumble');
  }
  const s = createRun(), boss = s.rooms[5].enemies[0];
  s.room = 5; s.mode = 'won'; s.time = 12; Object.assign(boss, { dead: true, deathAt: 12, hurt: .16 });
  const frames = [];
  for (const age of [0, .5, 1.5, 2.9]) { sprites.draw(ctx, 'boss', boss, s, 12 + age); frames.push(`${draws.at(-1).sx}/${draws.at(-1).sy}`); assert.equal(draws.at(-1).filter, 'none', 'death does not retain the hurt flash'); }
  assert.equal(new Set(frames).size, 4, 'victory death advances while simulation time is frozen');
  const count = draws.length; sprites.draw(ctx, 'boss', boss, s, 15.5); assert.equal(draws.length, count, 'finished death leaves the scene');
} finally { globalThis.Image = originalImage; globalThis.fetch = originalFetch; }
console.log(`Art checks passed: ${uniqueCells} native cells, atlas bounds, eight exact contact poses, dodge mapping and complete boss death.`);
