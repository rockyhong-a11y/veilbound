import assert from 'node:assert/strict';
import { W, FLOOR, ROOM_DEFS, createRun, step, attack, jump, dash, heal, interact, chooseBoon } from './engine.js';

const tick = (s, seconds, input = {}) => { for (let t = 0; t < seconds; t += 1 / 60) step(s, input, 1 / 60); };
const fresh = () => createRun({ seed: 7 });
const quiet = s => { for (const e of s.rooms[s.room].enemies) e.timer = 999; };

assert.equal(ROOM_DEFS.length, 6);
assert.equal(createRun(null).meta.runs, 1, 'empty stored progression starts safely');
assert.deepEqual(fresh().rooms, fresh().rooms, 'a seed produces the same map');
assert.equal(createRun({ embers: -4, power: Infinity }).meta.power, 0, 'saved progression is validated');

{
  const s = fresh(); quiet(s);
  assert.ok(jump(s)); assert.ok(jump(s)); assert.equal(jump(s), false, 'only two jumps');
  tick(s, 1.5);
  assert.equal(s.player.y + s.player.h, FLOOR); assert.ok(s.player.onGround);
  step(s, { jump: true }); const jumps = s.player.jumps; step(s, { jump: true });
  assert.equal(s.player.jumps, jumps, 'held jump does not repeat');
}
{
  const s = fresh(); quiet(s);
  s.player.x = 380;
  jump(s); tick(s, .12); jump(s); tick(s, .8);
  assert.equal(s.player.y + s.player.h, 610, 'a double jump lands on a one-way exploration platform');
  const x = s.player.x; assert.ok(dash(s)); tick(s, .12);
  assert.ok(s.player.x > x + 70); assert.equal(dash(s), false, 'dash has a cooldown');
  tick(s, .8); assert.ok(dash(s));
}
{
  const s = fresh(), e = s.rooms[0].enemies[0]; quiet(s);
  s.player.x = e.x - 65;
  const hp = e.hp; assert.ok(attack(s)); assert.equal(e.hp, hp - s.damage);
  assert.equal(attack(s), false, 'attack has a cooldown');
  tick(s, .4); attack(s); tick(s, .4); attack(s);
  assert.ok(e.dead); assert.equal(s.kills, 1);
  s.player.hp = 30; assert.ok(heal(s)); assert.equal(s.player.flask, 1); assert.equal(s.player.hp, 96);
}
{
  const s = fresh(), e = s.rooms[0].enemies[0]; quiet(s);
  s.player.x = e.x - 70; e.phase = 'windup'; e.intent = 'melee'; e.facing = -1; e.timer = .08;
  const hp = s.player.hp; dash(s); step(s, {}, .05); step(s, {}, .05);
  assert.equal(s.player.hp, hp, 'dash invulnerability avoids a telegraphed strike');
}
{
  const s = createRun({ seed: 7, embers: 17, best: 4, runs: 3 }), e = s.rooms[0].enemies[0]; quiet(s);
  s.player.x = e.x - 70; e.phase = 'windup'; e.intent = 'melee'; e.facing = -1; e.timer = .01;
  step(s); assert.equal(s.player.hp, 109, 'a completed telegraph deals damage');
  s.player.invulnerable = 0; s.player.hp = 1;
  s.projectiles.push({ x: s.player.x, y: s.player.y, vx: 0, vy: 0, w: 30, h: 70, life: 1, damage: 10 });
  step(s); assert.equal(s.mode, 'dead'); const reward = s.meta.embers;
  tick(s, 1); assert.equal(s.meta.embers, reward, 'death rewards are granted once');
  const next = createRun(s.meta);
  assert.equal(next.meta.embers, reward); assert.equal(next.meta.best, s.meta.best);
  assert.equal(next.meta.runs, s.meta.runs + 1, 'a new life preserves progression');
}
{
  const s = fresh();
  s.player.x = W - 90; assert.equal(interact(s), false, 'an uncleared door is sealed');
  for (let room = 0; room < 5; room++) {
    assert.equal(s.room, room);
    for (const e of s.rooms[room].enemies) { e.dead = true; e.hp = 0; }
    step(s); assert.equal(s.mode, 'boon');
    const before = s.damage;
    assert.equal(chooseBoon(s, 9), false); assert.ok(chooseBoon(s, 0)); assert.ok(s.damage > before);
    s.player.x = W - 90; assert.ok(interact(s)); assert.equal(s.room, room + 1);
  }
  assert.equal(s.room, 5); assert.ok(s.rooms[5].visited);
  s.player.x = 35; assert.ok(interact(s)); assert.equal(s.room, 4, 'backtracking preserves cleared rooms');
  s.player.x = W - 90; assert.ok(interact(s));
  const boss = s.rooms[5].enemies[0]; s.player.x = boss.x - 70; boss.timer = 999;
  while (s.mode === 'playing') { attack(s); tick(s, .4); }
  assert.equal(s.mode, 'won'); assert.ok(s.bossDefeated); assert.equal(s.meta.best, 6);
  const reward = s.meta.embers; tick(s, 1); assert.equal(s.meta.embers, reward);
}
{
  const s = fresh(); s.room = 5; s.player.x = 600;
  const e = s.rooms[5].enemies[0]; s.bossActive = true; e.attacks = 1; e.timer = 0; e.hp = 300;
  step(s); assert.equal(e.stage, 3); assert.equal(e.intent, 'daggers'); assert.equal(e.targets.length, 6);
  tick(s, 1.15); assert.ok(s.projectiles.some(p => p.kind === 'dagger'), 'boss phase creates falling daggers');
}
// Full route uses the same held attacks, movement, jump gestures, healing and gates as the browser.
{
  const s = createRun({ seed: 37 });
  let frames = 0, gestures = 0, heals = 0;
  const frame = (move = 0) => {
    if (s.player.hp < s.player.maxHp * .45 && heal(s)) heals++;
    step(s, { move, attack: true }, 1 / 60);
    assert.notEqual(s.mode, 'dead', `live route died in room ${s.room}`);
    assert.ok(++frames < 12000, 'live route remains traversable');
  };
  const walk = x => {
    while (Math.abs(s.player.x - x) > 8 && s.mode === 'playing') frame(Math.sign(x - s.player.x));
  };
  const land = (x, surface) => {
    assert.ok(jump(s)); gestures++;
    for (let i = 0; i < 16; i++) frame(Math.abs(x - s.player.x) < 6 ? 0 : Math.sign(x - s.player.x));
    assert.ok(jump(s)); gestures++;
    let limit = 180;
    while (!(s.player.onGround && s.player.y + s.player.h === surface) && s.mode === 'playing') {
      frame(Math.abs(x - s.player.x) < 6 ? 0 : Math.sign(x - s.player.x));
      assert.ok(limit-- > 0, `reachable platform in room ${s.room}, height ${surface}`);
    }
  };
  const fight = e => {
    while (!e.dead && s.mode === 'playing') {
      const gap = e.x + e.w / 2 - (s.player.x + s.player.w / 2);
      frame(Math.abs(gap) > 104 ? Math.sign(gap) : 0);
    }
  };
  for (let r = 0; r < 6; r++) {
    assert.equal(s.room, r);
    const room = s.rooms[r];
    for (const e of room.enemies.filter(e => e.kind !== 'archer')) fight(e);
    for (const e of room.enemies.filter(e => !e.dead && e.kind === 'archer')) {
      const surface = e.y + e.h;
      if (surface === 440) { walk(405); land(460, 600); walk(495); land(e.x - 75, 440); }
      else { walk(e.x - 75); land(e.x - 75, surface); }
      fight(e);
    }
    if (s.mode === 'boon') assert.ok(chooseBoon(s, r % 2 ? 1 : 0));
    if (r < 5) { walk(W - 95); assert.ok(interact(s), `open gate ${r}`); }
  }
  assert.equal(s.mode, 'won'); assert.equal(s.kills, 15);
  assert.ok(s.rooms.every(room => room.visited && room.enemies.every(e => e.dead)));
  assert.equal(gestures, 8, 'the high library archer is reached through real double jumps');
  assert.ok(s.rooms[5].enemies[0].attacks >= 6, 'boss lives long enough to execute its attack cycle twice');
  assert.ok(heals > 0, 'the complete route exercises healing');
  const next = createRun(s.meta);
  assert.equal(next.meta.best, 6); assert.equal(next.meta.embers, s.meta.embers); assert.equal(next.meta.runs, 2);
}
console.log('Engine checks passed: physics, combat, dodge, death, exploration, upgrades, boss phases and a complete live route.');
