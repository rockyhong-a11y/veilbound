import assert from 'node:assert/strict';
import { W, H, FLOOR, MAP_CELL, ROOM_DEFS, WEAPONS, SKILLS, RARITIES, weaponFor, skillFor, switchWeapon, equipDrop, nearbyDrop, createRun, step, attack, jump, dash, skill, groundSlam, shatterAt, heal, interact, chooseBoon } from './engine.js';

const tick = (s, seconds, input = {}) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) step(s, input, 1 / 60); };
const fresh = () => createRun({ seed: 7 });
const quiet = s => { for (const e of s.rooms[s.room].enemies) { e.dead = true; e.hp = 0; } };
const place = (s, x, surface = FLOOR) => Object.assign(s.player, { x, y: surface - s.player.h, vx: 0, vy: 0, onGround: true, jumps: 0, coyote: .1 });
const target = (s, index, x, hp = 999, surface = FLOOR) => {
  const e = s.rooms[s.room].enemies[index];
  Object.assign(e, { x, y: surface - e.h, hp, maxHp: hp, dead: false, speed: 0, timer: 999, phase: 'idle', stagger: 0, vx: 0, vy: 0, onGround: true });
  return e;
};
const settledAttack = s => { for (let i = 0; i < 90 && (s.player.attackTimer > 0 || s.hitStop > 0); i++) step(s); };

assert.equal(ROOM_DEFS.length, 6);
assert.deepEqual([W, H, FLOOR, MAP_CELL], [4096, 2048, 1880, 128]);
assert.equal(createRun(null).meta.runs, 1);
assert.deepEqual(fresh().rooms, fresh().rooms, 'seeded runs have the same enemies, loot and explored cells');
assert.equal(createRun({ embers: -4, power: Infinity }).meta.power, 0, 'stored progression is validated');
assert.ok(ROOM_DEFS.slice(0, 5).every(r => r.waypoints.length >= 20 && r.solids.length >= 5 && r.chests.some(c => c.secret)), 'every maze has a vertical route, solid walls and a secret reward');

{
  const s = fresh(); quiet(s);
  assert.ok(jump(s)); assert.ok(jump(s)); assert.equal(jump(s), false, 'two jumps only');
  tick(s, 1.5); assert.equal(s.player.y + s.player.h, FLOOR); assert.ok(s.player.onGround);
  step(s, { jump: true }); const jumps = s.player.jumps; step(s, { jump: true }); assert.equal(s.player.jumps, jumps, 'held jump does not repeat');
  tick(s, 1.5); place(s, 180); step(s, { move: 1 }); assert.ok(s.player.vx > 150 && s.player.vx < s.moveSpeed, 'running accelerates');
  tick(s, .15, { move: 1 }); assert.ok(s.player.vx > s.moveSpeed * .99); tick(s, .15); assert.ok(s.player.vx < 1, 'release stops promptly');
  Object.assign(s.player, { y: FLOOR - s.player.h - 8, vy: 450, onGround: false, jumps: 2, coyote: 0 });
  step(s, { jump: true }); assert.ok(s.player.vy < 0 && s.player.jumps === 1, 'jump buffered just before landing executes on contact');
}
{
  const s = fresh(); quiet(s);
  place(s, 1120, 1280); jump(s); tick(s, .15);
  assert.ok(s.player.y >= 1130, 'a solid ceiling blocks the head'); tick(s, .8); assert.equal(s.player.y + s.player.h, 1280);
  place(s, 430, 1690); step(s, { down: true }); tick(s, .8);
  assert.equal(s.player.y + s.player.h, FLOOR, 'down drops through one-way ledges');
  place(s, 565, 1690); tick(s, .08, { move: 1 }); assert.equal(s.player.onGround, false);
  assert.ok(s.player.coyote > 0 && jump(s), 'walking off a ledge leaves a coyote jump');
  place(s, 828); s.player.facing = 1; assert.ok(dash(s)); tick(s, .2);
  assert.equal(s.player.x, 920 - s.player.w, 'a fast dash cannot tunnel through masonry');
  assert.equal(dash(s), false); tick(s, .4); assert.ok(dash(s), 'dash cooldown recovers');
  const e = target(s, 0, 1120, 999, 1280); e.vy = -680;
  tick(s, .15); assert.ok(e.y >= 1130, 'enemy physics also respects ceilings');
}
{
  const s = fresh(); quiet(s); const e = target(s, 0, 280); place(s, 180);
  assert.ok(attack(s)); assert.equal(e.hp, 999, 'a sword swing has real startup');
  tick(s, .05); assert.equal(e.hp, 999 - s.damage); assert.ok(e.stagger > 0 && e.vx > 0, 'hits stagger and knock back');
  assert.ok(s.hitStop > 0 && s.impacts.length && s.damageTexts[0].value === s.damage);
  const time = s.player.animTime, x = s.player.x; step(s, { attack: true }); assert.equal(s.player.animTime, time); assert.equal(s.player.x, x, 'hit stop holds the contact pose');
  assert.ok(s.player.attackQueued > 0, 'an attack pressed during hit stop is queued');
  tick(s, .45); assert.ok(s.player.combo >= 2, 'the queued swing advances the combo');
  settledAttack(s); s.player.attackQueued = 0; s.player.comboWindow = 0;
  const amounts = [];
  for (let combo = 1; combo <= 3; combo++) {
    target(s, 0, 280); place(s, 180); const before = e.hp;
    assert.ok(attack(s)); assert.equal(s.player.anim, `attack${combo}`); tick(s, .12); amounts.push(before - e.hp); settledAttack(s);
  }
  assert.deepEqual(amounts, [36, 41, 61], 'the finisher is a stronger, distinct third hit');
  target(s, 0, 280); place(s, 180); s.player.comboWindow = 0; attack(s); assert.ok(dash(s)); tick(s, .1);
  assert.equal(e.hp, 999, 'dash cancels a swing before its damage frame'); assert.ok(s.trails.length, 'dash records real afterimage poses');
  s.player.hp = 30; assert.ok(heal(s)); assert.equal(s.player.flask, 1); assert.equal(s.player.hp, 96);
}
{
  const s = fresh(); quiet(s); const first = target(s, 0, 300), second = target(s, 3, 455); place(s, 180);
  assert.ok(skill(s, 0)); assert.equal(skill(s, 0), false); tick(s, .7);
  assert.equal(first.hp, 999 - Math.round(s.damage * 2.7)); assert.equal(second.hp, first.hp, 'crimson wave pierces each target once');
  assert.ok(s.player.skillCooldowns[0] > 3.7); tick(s, SKILLS[0].cooldown); assert.ok(skill(s, 0));
  const storm = fresh(); quiet(storm); const near = target(storm, 0, 300), far = target(storm, 3, 650); place(storm, 180);
  storm.projectiles.push({ x: 250, y: 1800, vx: 0, vy: 0, w: 10, h: 10, life: 3, enemy: true, damage: 12 });
  assert.ok(skill(storm, 1)); assert.equal(near.hp, 999 - Math.round(storm.damage * 3.4)); assert.equal(far.hp, 999);
  assert.equal(storm.projectiles.length, 0, 'storm destroys nearby hostile projectiles'); assert.ok(storm.impacts.some(e => e.kind === 'storm'));
  assert.equal(skill(storm, 1), false);
}
{
  const s = fresh(); quiet(s); const e = target(s, 0, 250); place(s, 180);
  Object.assign(s.player, { y: FLOOR - s.player.h - 250, onGround: false });
  assert.ok(groundSlam(s)); assert.equal(e.hp, 999, 'slam damage waits for contact'); tick(s, .3);
  assert.equal(s.player.y + s.player.h, FLOOR); assert.equal(s.player.slam, false); assert.equal(e.hp, 999 - Math.round(s.damage * 2.5));
  assert.ok(s.impacts.some(e => e.kind === 'slam')); assert.equal(groundSlam(s), false);
}
{
  const s = fresh(); quiet(s); const wall = s.rooms[0].breakables.find(b => b.secret);
  assert.ok(shatterAt(s, wall.x + wall.w / 2, wall.y + wall.h / 2)); assert.ok(wall.broken);
  assert.ok(s.rooms[0].items.some(i => i.kind === 'ember' && i.x > wall.x - 30 && i.x < wall.x + wall.w + 30), 'secret wall drops its authored loot');
  assert.ok(s.particles.some(p => p.kind === 'stone' && Number.isFinite(p.rotation) && Number.isFinite(p.angularVelocity)));
  tick(s, 1); assert.ok(s.particles.some(p => p.kind === 'stone' && p.bounces > 0), 'physical shards bounce on terrain');
  const lootCount = s.rooms[0].items.length; assert.equal(shatterAt(s, wall.x + 10, wall.y + 10), false); assert.equal(s.rooms[0].items.length, lootCount);
  assert.ok(s.impacts.some(e => e.kind === 'touch'), 'empty-space taps still spark');
  for (let i = 0; i < 90; i++) shatterAt(s, 180, 1800); assert.ok(s.particles.length <= 480, 'touch debris is bounded');
  const blade = s.rooms[0].chests.find(c => c.reward === 'blade'); place(s, blade.x, blade.y + blade.h);
  const damage = s.damage; assert.ok(shatterAt(s, blade.x + 20, blade.y + 20)); assert.equal(s.damage, damage + 5);
  const vitality = s.rooms[0].chests.find(c => c.reward === 'vitality'); place(s, vitality.x, vitality.y + vitality.h);
  const hp = s.player.maxHp; assert.ok(interact(s)); assert.equal(s.player.maxHp, hp + 15);
  const tempo = s.rooms[0].chests.find(c => c.reward === 'tempo'); place(s, tempo.x, tempo.y + tempo.h);
  const cooldown = s.attackCooldown; assert.ok(interact(s)); assert.ok(s.attackCooldown < cooldown);
}
{
  const s = fresh(); quiet(s); assert.ok(skill(s, 0)); assert.ok(skill(s, 1));
  s.player.cooldownsBySkill.meteor = 8; s.player.flask = 1;
  const chest = s.rooms[0].chests[0]; chest.relic = 'storm'; place(s, chest.x, chest.y + chest.h);
  assert.ok(interact(s)); assert.equal(s.player.flask, 2);
  assert.deepEqual(s.player.skillCooldowns, [0, 0]);
  assert.equal(skillFor(s, 0).remaining, 0); assert.equal(skillFor(s, 1).remaining, 0);
  assert.equal(s.player.cooldownsBySkill.meteor, 8, 'the recharge relic affects only equipped abilities');
  tick(s, .4); assert.deepEqual(s.player.skillCooldowns, [0, 0], 'recharged skills remain ready after simulation resumes');
  assert.ok(skill(s, 0)); assert.ok(skill(s, 1), 'both equipped abilities can be used again after the relic');
  const cooldown = s.player.cooldownsBySkill.crimson; interact(s);
  assert.equal(s.player.cooldownsBySkill.crimson, cooldown, 'an opened chest cannot recharge abilities repeatedly');
}
{
  const s = fresh(), gate = ROOM_DEFS[0].exits[0], guard = s.rooms[0].enemies.find(e => e.guardian);
  place(s, gate.x, gate.y + gate.h); assert.equal(interact(s), false, 'forward gate requires its sigil and guardian');
  s.rooms[0].keyCollected = true; step(s); assert.equal(s.mode, 'playing'); guard.dead = true; guard.hp = 0; step(s); assert.equal(s.mode, 'boon');
  assert.ok(s.rooms[0].enemies.some(e => !e.dead), 'optional enemies do not block exploration');
  assert.equal(chooseBoon(s, 9), false); assert.ok(chooseBoon(s, 0)); assert.ok(interact(s)); assert.equal(s.room, 1);
  const back = ROOM_DEFS[1].exits.find(e => e.target === 0); place(s, back.x, back.y + back.h);
  assert.ok(interact(s)); assert.equal(s.room, 0); assert.equal(s.player.y + s.player.h, gate.y + gate.h, 'backtracking arrives at the real elevated gate');
}
{
  const s = createRun({ seed: 7, embers: 17, best: 4, runs: 3 }); quiet(s); s.player.hp = 1;
  s.projectiles.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, w: 32, h: 90, life: 1, damage: 10 });
  step(s); assert.equal(s.mode, 'dead'); const reward = s.meta.embers; tick(s, 1); assert.equal(s.meta.embers, reward, 'death rewards are granted once');
  const next = createRun(s.meta); assert.equal(next.meta.embers, reward); assert.equal(next.meta.best, 4); assert.equal(next.meta.runs, 5);
}
{
  const s = fresh(); s.room = 5; place(s, 2040); const e = s.rooms[5].enemies[0];
  s.bossActive = true; e.attacks = 1; e.timer = 0; e.hp = 300;
  step(s); assert.equal(e.stage, 3); assert.equal(e.intent, 'daggers'); assert.equal(e.targets.length, 6);
  tick(s, 1.15); assert.ok(s.projectiles.some(p => p.kind === 'dagger'), 'boss phase creates actual falling blades');
}

// The arsenal has real collision, timing and status differences, beyond names or colors.
{
  assert.deepEqual(WEAPONS.map(w => w.id), ['sword', 'gauntlet', 'spear', 'gun', 'bow', 'harpoon', 'greatsword', 'scythe']);
  assert.equal(SKILLS.length, 8); assert.equal(Object.keys(RARITIES).length, 3);
  const s = fresh(); quiet(s);
  assert.equal(s.player.weapons.length, 2); assert.deepEqual(s.player.weapons.map(w => w.type), ['sword', 'gun']);
  assert.equal(s.player.activeWeapon, 0); assert.ok(switchWeapon(s)); assert.equal(weaponFor(s).type, 'gun'); assert.ok(switchWeapon(s, 0));
  assert.equal(switchWeapon(s, 2), false); attack(s); const duration = s.player.attackTimer;
  assert.ok(switchWeapon(s), 'switching during an attack queues the next weapon');
  assert.equal(s.player.activeWeapon, 0); assert.equal(s.player.attackTimer, duration, 'a switch cannot cancel recovery');
  assert.equal(s.player.attackPending.weaponType, 'sword');
  tick(s, .28, { attack: true }); assert.equal(s.player.activeWeapon, 1, 'queued switching is honored even while attack is held');
  assert.equal(s.player.pendingWeapon, null);
  if (s.player.attackPending) assert.equal(s.player.attackPending.weaponType, 'gun');
  settledAttack(s); assert.ok(skill(s, 0)); const castTime = s.player.castTimer;
  assert.ok(switchWeapon(s, 0)); assert.equal(s.player.activeWeapon, 1); assert.equal(s.player.castTimer, castTime);
  tick(s, .3); assert.equal(s.player.activeWeapon, 0, 'a queued switch waits for the skill cast to end');
}
const armed = type => {
  const s = fresh(); quiet(s); place(s, 180);
  s.player.weapons[0] = { id: `test-${type}`, type, rarity: 'common', level: 1 };
  return s;
};
{
  const s = armed('gauntlet'), close = target(s, 0, 255), far = target(s, 3, 390);
  assert.ok(attack(s)); assert.ok(s.player.attackDuration < .15); tick(s, .08);
  assert.ok(close.hp < 999); assert.equal(far.hp, 999, 'gauntlets trade reach for rapid hits');
}
{
  const s = armed('spear'), e = target(s, 0, 430);
  attack(s); tick(s, .1); assert.ok(e.hp < 999, 'a spear reaches targets outside a sword opening swing');
  assert.ok(s.slashes.some(v => v.weaponType === 'spear'));
}
{
  const s = armed('gun'), e = target(s, 0, 700);
  attack(s); tick(s, .05); assert.equal(e.hp, 999, 'a gun has travel time'); assert.ok(s.projectiles.some(v => v.kind === 'bullet'));
  tick(s, .4); assert.ok(e.hp < 999, 'a fast physical bullet hits a distant body');
  const burst = armed('gun'); burst.player.combo = 2; burst.player.comboWindow = .8; attack(burst); tick(burst, .05);
  assert.equal(burst.projectiles.filter(v => v.kind === 'bullet').length, 3, 'the third gun attack fires a spread burst');
  const wall = armed('gun'), behind = target(wall, 0, 1050); place(wall, 700);
  attack(wall); tick(wall, .4); assert.equal(behind.hp, 999, 'bullets stop on solid masonry before an enemy behind it');
}
{
  const s = armed('bow'), a = target(s, 0, 400), b = target(s, 3, 590);
  attack(s); tick(s, .55); assert.ok(a.hp < 999 && b.hp < 999, 'arrows pierce two aligned enemies');
}
{
  const s = armed('harpoon'), e = target(s, 0, 610);
  attack(s); tick(s, .57); assert.ok(e.hp < 999 && e.pull, 'a harpoon embeds its pull status');
  tick(s, .5); assert.ok(e.x < 370, 'the hooked enemy actually moves toward the player');
}
{
  const s = armed('greatsword'), e = target(s, 0, 390);
  attack(s); tick(s, .1); assert.equal(e.hp, 999, 'a greatsword has a heavy windup'); tick(s, .07);
  assert.ok(999 - e.hp >= 59 && e.stagger > .18, 'the heavy hit has stronger damage and stagger');
}
{
  const s = armed('scythe'), e = target(s, 0, 95);
  attack(s); tick(s, .15); assert.ok(e.hp < 999 && e.bleed > 2, 'a scythe cuts behind the player and inflicts bleeding');
  const hp = e.hp; tick(s, .8); assert.ok(e.hp < hp, 'bleed causes additional damage without another swing');
}
{
  const s = fresh(); quiet(s); const e = target(s, 0, 280, 1); place(s, 180);
  attack(s); tick(s, .55);
  assert.equal(s.kills, 1); const first = s.rooms[0].gearDrops.find(d => d.source === 'enemy');
  assert.equal(first.type, 'gauntlet'); assert.equal(first.kind, 'weapon'); assert.ok(first.onGround, 'first kill drops a physical, reachable weapon');
  place(s, first.x); assert.equal(nearbyDrop(s).id, first.id); assert.equal(equipDrop(s, first.id, 2), false);
  assert.ok(equipDrop(s, first.id, 0)); assert.equal(s.player.weapons.length, 2); assert.equal(weaponFor(s).type, 'gauntlet');
  const discarded = s.rooms[0].gearDrops.find(d => d.source === 'replaced');
  assert.equal(discarded.type, 'sword'); assert.equal(discarded.rarity, 'common'); assert.equal(equipDrop(s, first.id, 1), false, 'a picked drop cannot be duplicated');
  tick(s, .5); place(s, discarded.x); assert.ok(equipDrop(s, discarded.id, 1));
  assert.deepEqual(s.player.weapons.map(w => w.type), ['gauntlet', 'sword'], 'two slots remain after replacing and reclaiming gear');
  place(s, 1600); assert.equal(nearbyDrop(s), null); assert.equal(equipDrop(s, s.rooms[0].gearDrops.find(d => !d.collected).id, 0), false, 'equipment cannot be taken remotely');
  assert.ok(s.rooms[0].enemies[0] === e && e.dead);
}
{
  const s = fresh(); quiet(s);
  for (let i = 0; i < 16; i++) {
    place(s, 180); target(s, 0, 280, 1); s.player.attackTimer = 0; s.player.comboWindow = 0;
    attack(s); tick(s, .4); settledAttack(s);
  }
  const drops = s.rooms[0].gearDrops;
  assert.equal(new Set(drops.filter(d => d.kind === 'weapon').map(d => d.type)).size, 8, 'enemy kills cycle through all eight weapon families');
  assert.equal(new Set(drops.filter(d => d.kind === 'skill').map(d => d.type)).size, 8, 'enemy kills drop all eight abilities');
  assert.ok(drops.some(d => d.rarity !== 'common'));
  const meteor = drops.find(d => d.kind === 'skill' && d.type === 'meteor'); place(s, meteor.x, meteor.y + meteor.h);
  assert.ok(equipDrop(s, meteor.id, 0)); assert.equal(skillFor(s, 0).id, 'meteor'); assert.equal(s.player.skills.length, 2);
  assert.ok(skill(s, 0)); const remaining = s.player.skillCooldowns[0];
  const crimson = drops.find(d => d.source === 'replaced' && d.type === 'crimson'); place(s, crimson.x, crimson.y + crimson.h);
  assert.ok(equipDrop(s, crimson.id, 0));
  const meteorAgain = drops.find(d => d.source === 'replaced' && d.type === 'meteor'); place(s, meteorAgain.x, meteorAgain.y + meteorAgain.h);
  assert.ok(equipDrop(s, meteorAgain.id, 0)); assert.equal(s.player.skillCooldowns[0], remaining);
  assert.equal(skill(s, 0), false, 'swapping abilities does not reset their cooldown');
  const storm = drops.find(d => d.kind === 'skill' && d.type === 'storm'); place(s, storm.x, storm.y + storm.h);
  assert.equal(equipDrop(s, storm.id, 0), false, 'the same ability cannot fill both slots');
  const weapons = structuredClone(s.player.weapons), skills = [...s.player.skills], gate = ROOM_DEFS[0].exits[0];
  s.rooms[0].cleared = true; place(s, gate.x, gate.y + gate.h); assert.ok(interact(s));
  assert.deepEqual(s.player.weapons, weapons); assert.deepEqual(s.player.skills, skills); assert.equal(s.player.cooldownsBySkill.meteor, remaining, 'loadouts and cooldowns survive a portal');
  assert.equal(s.rooms[0].gearDrops, drops, 'unclaimed equipment stays in its original room');
}
const ability = id => { const s = fresh(); quiet(s); place(s, 180); s.player.skills[0] = id; return s; };
{
  const s = ability('meteor'), e = target(s, 0, 400);
  assert.ok(skill(s)); assert.equal(e.hp, 999); assert.ok(s.skillEffects.some(v => v.kind === 'meteor'));
  tick(s, .4); assert.equal(e.hp, 999, 'meteor markers give an actual delay'); tick(s, .3);
  assert.ok(e.hp < 999 && s.impacts.some(v => v.kind === 'meteor'), 'the delayed impact explodes at the marked enemy position');
}
{
  const s = ability('ice'), e = target(s, 0, 400); e.phase = 'windup'; e.intent = 'melee'; e.timer = 2;
  assert.ok(skill(s)); tick(s, .35); assert.ok(e.freeze > 1.5 && e.hp < 999);
  const timer = e.timer; tick(s, .3); assert.equal(e.timer, timer, 'frozen enemies stop their combat timer');
  tick(s, 2); assert.equal(e.freeze, 0, 'freeze is temporary');
}
{
  const s = ability('thunder'); const targets = [300, 580, 850, 1160].map((x, i) => target(s, [0, 3, 4, 5][i], x));
  assert.ok(skill(s)); assert.ok(targets.every(e => e.hp < 999), 'lightning reaches four enemies by chaining beyond its initial cast range');
  assert.equal(s.impacts.filter(v => v.kind === 'thunder' && Number.isFinite(v.fromX)).length, 4);
}
{
  const s = ability('fan'), e = target(s, 0, 430);
  assert.ok(skill(s)); assert.equal(s.projectiles.length, 6); assert.equal(new Set(s.projectiles.map(v => v.vy)).size, 6);
  tick(s, .4); assert.ok(e.hp < 999, 'fan blades have distinct physical trajectories');
}
{
  const s = ability('grapnel'), e = target(s, 0, 600);
  assert.ok(skill(s)); tick(s, .35); assert.ok(e.pull && e.hp < 999); tick(s, .6);
  assert.ok(e.x < 360, 'the chain skill actually pulls a distant enemy');
}
{
  const s = ability('ward'); assert.ok(skill(s)); assert.equal(s.player.wardTimer, 4);
  s.projectiles.push({ x: 240, y: s.player.y + 30, vx: -470, vy: 0, w: 22, h: 7, life: 1, kind: 'arrow', enemy: true, damage: 20 });
  tick(s, .1); assert.equal(s.player.hp, 120); assert.ok(s.player.wardHP < 65 && s.projectiles.length === 0, 'ward intercepts a real incoming projectile');
  tick(s, 4); assert.equal(s.player.wardTimer, 0);
  s.projectiles.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, w: 32, h: 90, life: 1, enemy: true, damage: 10 });
  step(s); assert.equal(s.player.hp, 110, 'expired shields no longer protect the player');
}
{
  const common = armed('sword'), rare = armed('sword'); const a = target(common, 0, 280), b = target(rare, 0, 280);
  Object.assign(rare.player.weapons[0], { rarity: 'rare', level: 4 });
  attack(common); attack(rare); tick(common, .06); tick(rare, .06);
  assert.ok(999 - b.hp > 999 - a.hp && weaponFor(rare).damageMultiplier > weaponFor(common).damageMultiplier, 'rarity and level increase actual weapon damage');
  const shield = ability('ward'); shield.player.skillGear[0] = { type: 'ward', rarity: 'epic', level: 4 };
  assert.equal(skillFor(shield).rarity, 'epic'); assert.equal(skillFor(shield).level, 4); assert.ok(skill(shield));
  assert.ok(shield.player.wardHP > 90, 'epic ability gear grants real shield capacity');
}
{
  const s = fresh(); quiet(s); const chest = s.rooms[0].chests.find(c => c.secret); place(s, chest.x, chest.y + chest.h);
  assert.ok(interact(s)); assert.equal(s.rooms[0].gearDrops.filter(d => d.source === 'chest').length, 2);
  assert.ok(s.rooms[0].gearDrops.filter(d => d.source === 'chest').every(d => d.rarity === 'epic'), 'a hidden chest grants two inspectable epic gear drops');
}

// The full campaign uses live enemies and the same gestures/skills as the browser.
// No teleporting, inflated stats, enemy disabling or direct HP changes on this route.
{
  const s = fresh(); let frames = 0, heals = 0, dodges = 0, stops = 0, recoveries = 0;
  const frame = input => { step(s, input, 1 / 60); assert.notEqual(s.mode, 'dead', `live campaign died in ${ROOM_DEFS[s.room].name}`); assert.ok(++frames < 18000, 'campaign has a finite route'); };
  const collectHealing = () => { if (s.player.hp < s.player.maxHp * .9 && heal(s)) heals++; };
  const navigate = (def, goal) => {
    let budget = 1200, jumpAge = 0, second = false, recovery = null;
    while (!(s.player.onGround && Math.abs(s.player.x - goal.x) < 9 && Math.abs(s.player.y + s.player.h - goal.y) < 2)) {
      const p = s.player, foot = p.y + p.h;
      if (recovery && p.onGround && Math.abs(foot - recovery.y) < 2 && Math.abs(p.x - recovery.x) < 9) recovery = null;
      if (!recovery && p.onGround && foot > goal.y + 230) {
        recovery = def.platforms.map(w => ({ x: w.x + w.w / 2 - p.w / 2, y: w.y }))
          .filter(w => w.y < foot - 5 && w.y >= foot - 220 && !def.solids.some(r => w.x < r.x + r.w && w.x + p.w > r.x && w.y - p.h < r.y + r.h && w.y > r.y))
          .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0] || null;
        if (recovery) recoveries++;
      }
      const target = recovery || goal, dx = target.x - p.x;
      const move = Math.abs(dx) < 3 ? 0 : Math.sign(dx) * Math.min(1, Math.abs(dx) / 16);
      let jumpInput = false;
      if (p.onGround && (target.y < foot - 8 || (Math.abs(target.y - foot) < 3 && Math.abs(dx) > 80))) { jumpInput = true; jumpAge = 0; second = false; }
      else if (!p.onGround && !second && p.jumps === 1 && jumpAge >= 20) { jumpInput = true; second = true; }
      const closeEnemies = s.rooms[s.room].enemies.filter(e => !e.dead && Math.abs(e.y + e.h / 2 - p.y - p.h / 2) < 160 && Math.abs(e.x - p.x) < 270);
      collectHealing(); if (closeEnemies.length) { skill(s, 1); skill(s, 0); }
      const frozen = s.hitStop > 0;
      frame({ move, jump: jumpInput, down: p.onGround && target.y > foot + 8, attack: closeEnemies.length > 0 });
      if (!frozen) jumpAge++;
      if (s.mode === 'boon') assert.ok(chooseBoon(s, 1));
      assert.ok(budget-- > 0, `reachable live waypoint ${s.room}: ${goal.x},${goal.y}`);
    }
    stops++;
  };
  for (let r = 0; r < 5; r++) {
    assert.equal(s.room, r); const def = ROOM_DEFS[r];
    for (const goal of def.waypoints.slice(1)) navigate(def, goal);
    assert.ok(s.rooms[r].keyCollected && s.rooms[r].cleared && s.rooms[r].boonTaken);
    assert.ok(s.rooms[r].enemies.filter(e => e.guardian).every(e => e.dead));
    assert.ok(interact(s), `real elevated exit from room ${r}`);
  }
  const boss = s.rooms[5].enemies[0];
  while (s.mode === 'playing') {
    const p = s.player, dx = boss.x + boss.w / 2 - p.x - p.w / 2, distance = Math.abs(dx);
    collectHealing(); let move = distance > 135 ? Math.sign(dx) : 0;
    if (boss.phase === 'windup' && boss.timer < .16 && p.dashCooldown <= 0) { p.facing = -Math.sign(dx); if (dash(s)) dodges++; move = -Math.sign(dx); }
    if (distance < 270) { skill(s, 1); p.facing = Math.sign(dx); skill(s, 0); }
    frame({ move, attack: distance < 215 });
  }
  assert.equal(s.mode, 'won'); assert.equal(boss.stage, 3); assert.ok(boss.attacks >= 6 && dodges >= 6, 'all boss patterns execute and timed dodges matter');
  assert.ok(heals > 0 && recoveries > 0 && stops >= 110, 'campaign includes healing, recovering after falls and every authored maze waypoint');
  assert.ok(s.kills >= 30 && s.rooms.slice(0, 5).some(r => r.enemies.some(e => !e.dead)), 'the full campaign leaves optional fights available');
  assert.ok(s.rooms.every(r => r.visited)); assert.ok(s.rooms[2].explored.filter(Boolean).length > 100, 'vertical movement reveals an actual exploration map');
  assert.equal(s.meta.best, 6); const reward = s.meta.embers; tick(s, 1); assert.equal(s.meta.embers, reward);
  const next = createRun(s.meta); assert.equal(next.meta.best, 6); assert.equal(next.meta.embers, reward); assert.equal(next.meta.runs, 2);
  console.log(`Live campaign passed: ${stops} maze stops, ${s.kills} kills, ${heals} heals, ${dodges} timed boss dodges, ${recoveries} recoveries, ${(frames / 60).toFixed(1)}s.`);
}
console.log('Arsenal checks passed: eight weapon families, eight abilities, physical drops, two-slot replacement, rarity scaling and persistent cooldowns.');
console.log('Engine checks passed: solid collision, buffered jumps, combos, hit stop, skills, slam, shattering, relics, gates, progression and all boss phases.');
