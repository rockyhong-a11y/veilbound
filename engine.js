import { W, H, FLOOR, ROOM_DEFS } from './world.js?v=2';
export { W, H, FLOOR, ROOM_DEFS } from './world.js?v=2';

export const MAP_CELL = 128;
export const SKILLS = [
  { id: 'crimson', name: '혈월의 검기', key: 'R', cooldown: 4.5, color: '#ff799a' },
  { id: 'storm', name: '공허의 폭풍', key: 'T', cooldown: 9, color: '#b7a0ff' },
];
const ENEMY_STATS = {
  duelist: { name: '잿빛 검무사', hp: 112, w: 32, h: 90, damage: 11, speed: 154 },
  archer: { name: '침묵의 궁수', hp: 94, w: 32, h: 90, damage: 12, speed: 0 },
  warden: { name: '철의 여감시관', hp: 190, w: 40, h: 106, damage: 16, speed: 98 },
  boss: { name: '공허의 여왕 · 세라', hp: 2800, w: 68, h: 150, damage: 19, speed: 136 },
};
const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const center = e => e.x + e.w / 2;
const alive = s => s.rooms[s.room].enemies.filter(e => !e.dead);
export const roomFor = s => ROOM_DEFS[s.room];
const roomWidth = s => roomFor(s).width || W;
const floorFor = s => roomFor(s).floor ?? FLOOR;

function random(s) {
  s.rng ^= s.rng << 13; s.rng ^= s.rng >>> 17; s.rng ^= s.rng << 5;
  return (s.rng >>> 0) / 4294967296;
}
function emit(s, event) { if (s.events.length < 128) s.events.push(event); }
function tell(s, message, seconds = 3) { s.message = message; s.messageTimer = seconds; }
function anim(p, name) { if (p.anim !== name) { p.anim = name; p.animTime = 0; } }
function particles(s, x, y, color, count = 10, kind = 'spark', force = 1) {
  for (let i = 0; i < count; i++) {
    const life = kind === 'stone' ? 1.2 + random(s) * .9 : .22 + random(s) * .4;
    const angle = random(s) * Math.PI * 2, velocity = (90 + random(s) * 350) * force;
    s.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - (kind === 'stone' ? 210 : 45), life, maxLife: life, color, kind, size: kind === 'stone' ? 4 + random(s) * 8 : 2 + random(s) * 4, rotation: random(s) * 6.28, angularVelocity: (random(s) - .5) * 18, bounces: 0 });
  }
  if (s.particles.length > 480) s.particles.splice(0, s.particles.length - 480);
}
function impact(s, x, y, color = '#f6e2cf', radius = 85, kind = 'hit') {
  s.impacts.push({ x, y, color, radius, kind, life: .28, maxLife: .28 });
  if (s.impacts.length > 30) s.impacts.shift();
}
function enemy(kind, x, surfaceY, extra = {}) {
  const spec = ENEMY_STATS[kind] || ENEMY_STATS.duelist;
  return { ...spec, ...extra, kind, x, y: surfaceY - spec.h, hp: extra.hp || spec.hp, maxHp: extra.hp || spec.hp, facing: -1, phase: 'idle', intent: '', timer: .7, attackTimer: 0, hurt: 0, stagger: 0, dead: false, attacks: 0, stage: 1, vx: 0, vy: 0, onGround: true, homeX: x, homeY: surfaceY - spec.h, jumpCooldown: 0, hitPlayer: false, animTime: 0 };
}
function makeRooms(s) {
  return ROOM_DEFS.map((def, index) => {
    const enemies = (def.enemies || []).map(e => Array.isArray(e) ? enemy(e[0], e[1], e[2] ?? FLOOR) : enemy(e.kind, e.x, e.y ?? e.surfaceY ?? FLOOR, e));
    const items = (def.items || []).map(item => ({ ...item, amount: item.amount ?? 1, collected: false }));
    if (def.key && !items.some(item => item.kind === 'sigil')) items.push({ kind: 'sigil', ...def.key, amount: 1, collected: false });
    return {
      visited: index === 0, cleared: false, boonTaken: false, keyCollected: !items.some(item => item.kind === 'sigil'),
      enemies, items, breakables: (def.breakables || []).map(b => ({ ...b, hp: b.hp ?? (b.kind === 'wall' || b.kind === 'rune' ? 60 : 1), maxHp: b.hp ?? (b.kind === 'wall' || b.kind === 'rune' ? 60 : 1), broken: false })),
      chests: (def.chests || []).map(c => ({ w: 48, h: 35, ...c, opened: false })), explored: [], exploreCols: Math.ceil((def.width || W) / MAP_CELL), exploreRows: Math.ceil(H / MAP_CELL),
    };
  });
}
export function createRun(meta = {}) {
  meta = meta && typeof meta === 'object' ? meta : {};
  const saved = { embers: nonnegative(meta.embers), best: Math.min(6, nonnegative(meta.best)), runs: nonnegative(meta.runs) + 1, power: Math.min(12, nonnegative(meta.power)) };
  const spawn = ROOM_DEFS[0].spawn || { x: ROOM_DEFS[0].spawnX || 160, y: FLOOR };
  const s = {
    room: 0, rooms: [], player: { x: spawn.x, y: spawn.y - 90, w: 32, h: 90, vx: 0, vy: 0, facing: 1, hp: 120, maxHp: 120, onGround: true, jumps: 0, coyote: .1, jumpBuffer: 0, dropTimer: 0, attackTimer: 0, attackDuration: 0, attackPending: null, attackQueued: 0, combo: 0, comboWindow: 0, dashTimer: 0, dashCooldown: 0, invulnerable: 0, flask: 2, maxFlask: 3, skillCooldowns: [0, 0], castTimer: 0, slam: false, landingTimer: 0, hurtTimer: 0, anim: 'idle', animTime: 0, runDistance: 0 },
    time: 0, mode: 'playing', particles: [], slashes: [], projectiles: [], impacts: [], damageTexts: [], trails: [], events: [], meta: saved,
    kills: 0, gold: 0, embers: 0, boons: [], boonChoices: [], message: '높은 길에서 봉인 문양을 찾으세요. 금이 간 벽 너머에는 비밀이 있습니다.', messageTimer: 6,
    bossActive: false, bossDefeated: false, rewardDone: false, damage: 36 + saved.power * 2, attackCooldown: .29, moveSpeed: 390,
    rng: (nonnegative(meta.seed) || ((Date.now() ^ (saved.runs * 2654435761)) >>> 0)) || 1,
    prevInput: {}, shake: 0, hitStop: 0, flash: 0,
  };
  s.rooms = makeRooms(s);
  explore(s);
  return s;
}
function finish(s, won) {
  if (s.rewardDone) return;
  s.rewardDone = true; s.mode = won ? 'won' : 'dead';
  s.meta.embers += s.embers + Math.floor(s.kills / 2) + (won ? 15 : 1);
  s.meta.best = Math.max(s.meta.best, s.room + (won ? 1 : 0));
  if (won) { s.bossDefeated = true; s.bossActive = false; tell(s, '공허가 갈라졌다. 새로운 새벽은 당신의 것이다.', 99); emit(s, 'win'); }
  else { tell(s, '육신은 사라져도 불씨는 남는다.', 99); emit(s, 'dead'); }
}
function hurtPlayer(s, damage, knock = 0) {
  const p = s.player;
  if (s.mode !== 'playing' || p.invulnerable > 0 || p.dashTimer > 0) return false;
  p.hp = Math.max(0, p.hp - damage); p.invulnerable = .9; p.hurtTimer = .2;
  p.attackPending = null; p.attackTimer = 0; p.slam = false;
  p.vx = knock * 300; p.vy = -190; p.onGround = false; anim(p, 'hurt');
  s.shake = .19; s.hitStop = .065; s.flash = .18;
  particles(s, center(p), p.y + 30, '#f29bb1', 18); impact(s, center(p), p.y + 30, '#ff7794', 90); emit(s, 'hurt');
  if (!p.hp) finish(s, false);
  return true;
}
function hurtEnemy(s, e, damage, knock = s.player.facing, force = 1) {
  if (e.dead) return;
  e.hp = Math.max(0, e.hp - Math.round(damage)); e.hurt = .16;
  e.stagger = e.kind === 'boss' ? .025 : .13 + force * .035;
  e.vx = knock * (e.kind === 'boss' ? 60 : 240 + force * 90);
  if (e.kind !== 'boss') { e.vy = -95 - force * 50; e.onGround = false; e.phase = 'recover'; e.timer = .27; }
  const x = center(e), y = e.y + e.h * .45;
  particles(s, x, y, e.kind === 'boss' ? '#dfa3ff' : '#f6ccba', e.kind === 'boss' ? 16 : 12, 'spark', force);
  particles(s, x, y, '#ff6388', 5, 'ember', force);
  impact(s, x, y, force > 1.2 ? '#fff0d1' : '#9affdc', 65 + force * 30);
  s.damageTexts.push({ x, y: e.y, text: String(Math.round(damage)), value: Math.round(damage), critical: force > 1.2, color: force > 1.2 ? '#fff0cf' : '#ecfff9', life: .7, maxLife: .7, vy: -90 });
  if (s.damageTexts.length > 30) s.damageTexts.shift();
  s.hitStop = Math.max(s.hitStop, force > 1.2 ? .058 : .035); s.flash = Math.max(s.flash, .04); s.shake = Math.max(s.shake, .06 + force * .025); emit(s, 'hit');
  if (!e.hp) {
    e.dead = true; e.phase = 'dead'; s.kills++; s.gold += e.kind === 'boss' ? 100 : e.kind === 'warden' ? 15 : 10;
    particles(s, x, e.y + e.h / 2, '#e7c88d', 24, 'ember', 1.35); emit(s, 'kill');
    if (e.kind === 'boss') { impact(s, x, y, '#e9bdff', 520, 'storm'); s.hitStop = .14; s.flash = .3; finish(s, true); }
  }
}
const COMBOS = [
  { duration: .23, delay: .045, range: 145, multiplier: 1, lunge: 250, radius: 112, color: '#a7ffde' },
  { duration: .26, delay: .055, range: 172, multiplier: 1.15, lunge: 300, radius: 139, color: '#f5ebff' },
  { duration: .34, delay: .09, range: 208, multiplier: 1.7, lunge: 390, radius: 169, color: '#ffd69d' },
];
export function attack(s) {
  const p = s.player;
  if (s.mode !== 'playing' || p.dashTimer > 0 || p.castTimer > 0 || p.slam || p.hurtTimer > 0) return false;
  if (p.attackTimer > 0) { if (p.attackTimer < .13 || s.hitStop > 0) p.attackQueued = Math.max(.23, p.attackTimer + .1); return false; }
  if (Math.abs(p.vx) < 35) {
    const nearest = alive(s).filter(e => Math.abs(e.y + e.h / 2 - p.y - p.h / 2) < 90).sort((a, b) => Math.abs(center(a) - center(p)) - Math.abs(center(b) - center(p)))[0];
    if (nearest && Math.abs(center(nearest) - center(p)) < 190) p.facing = center(nearest) > center(p) ? 1 : -1;
  }
  p.combo = p.comboWindow > 0 ? p.combo % 3 + 1 : 1;
  const combo = COMBOS[p.combo - 1], tempo = s.attackCooldown / .29;
  p.attackTimer = combo.duration * tempo; p.attackDuration = p.attackTimer; p.attackPending = { combo: p.combo, delay: combo.delay * tempo }; p.attackQueued = 0; p.comboWindow = .85;
  p.vx = p.facing * combo.lunge; anim(p, `attack${p.combo}`); p.animTime = 0;
  emit(s, 'attack'); return true;
}
function tickAttack(s, dt) {
  const p = s.player;
  if (!p.attackPending) return;
  p.attackPending.delay -= dt;
  if (p.attackPending.delay > 0) return;
  const index = p.attackPending.combo, combo = COMBOS[index - 1]; p.attackPending = null;
  const x = center(p), y = p.y + 34;
  s.slashes.push({ x, y, facing: p.facing, combo: index, radius: combo.radius, color: combo.color, life: .2, maxLife: .2 });
  particles(s, x + p.facing * 50, y, combo.color, 8, 'spark');
  const box = { x: p.facing > 0 ? x - 12 : x - combo.range, y: p.y - (index === 3 ? 35 : 14), w: combo.range + 12, h: p.h + (index === 3 ? 80 : 34) };
  for (const e of alive(s)) if (overlap(box, e)) hurtEnemy(s, e, s.damage * combo.multiplier, p.facing, combo.multiplier);
  for (const b of s.rooms[s.room].breakables) if (!b.broken && overlap(box, b)) breakObject(s, b, s.damage * combo.multiplier, p.facing);
}
export function jump(s) {
  const p = s.player;
  if (s.mode !== 'playing' || p.dashTimer > 0 || p.slam || (!p.onGround && p.coyote <= 0 && p.jumps >= 2)) return false;
  const grounded = p.onGround || p.coyote > 0;
  p.vy = grounded ? -680 : -625; p.jumps = grounded ? 1 : p.jumps + 1; p.onGround = false; p.coyote = 0; p.jumpBuffer = 0;
  if (p.attackTimer <= 0) anim(p, 'jump');
  particles(s, center(p), p.y + p.h, grounded ? '#b0d3d0' : '#b39afa', grounded ? 8 : 14, 'dust');
  if (!grounded) impact(s, center(p), p.y + p.h, '#c3a6ff', 46, 'jump');
  emit(s, 'jump'); return true;
}
export function dash(s) {
  const p = s.player;
  if (s.mode !== 'playing' || p.dashCooldown > 0) return false;
  p.attackTimer = 0; p.attackPending = null; p.attackQueued = 0; p.castTimer = 0; p.hurtTimer = 0; p.slam = false;
  p.dashTimer = .17; p.dashCooldown = .55; p.invulnerable = Math.max(p.invulnerable, .23); p.vy = 0; p.vx = p.facing * 1100;
  anim(p, 'dash'); p.animTime = 0;
  particles(s, center(p), p.y + 35, '#a8a3ff', 12); emit(s, 'dash'); return true;
}
export function skill(s, index = 0) {
  const p = s.player, spec = SKILLS[index];
  if (s.mode !== 'playing' || !spec || p.skillCooldowns[index] > 0 || p.dashTimer > 0 || p.hurtTimer > 0) return false;
  p.skillCooldowns[index] = spec.cooldown; p.attackPending = null; p.attackTimer = 0; p.attackQueued = 0; p.slam = false; p.castTimer = index === 0 ? .19 : .32;
  anim(p, 'cast'); p.animTime = 0;
  const x = center(p), y = p.y + 32;
  if (index === 0) {
    s.projectiles.push({ x: x + p.facing * 18, y: y - 62, vx: p.facing * 1020, vy: 0, w: 52, h: 126, life: .75, kind: 'wave', enemy: false, damage: s.damage * 2.7, color: spec.color, facing: p.facing, hits: [], broken: [] });
    particles(s, x, y, spec.color, 22, 'ember', 1.4); impact(s, x, y, spec.color, 105, 'cast');
    s.shake = .09;
  } else {
    const radius = 270;
    for (const e of alive(s)) if (Math.hypot(center(e) - x, e.y + e.h / 2 - y) < radius + e.w / 2) hurtEnemy(s, e, s.damage * 3.4, Math.sign(center(e) - x) || p.facing, 1.8);
    for (const b of s.rooms[s.room].breakables) if (!b.broken && Math.hypot(center(b) - x, b.y + b.h / 2 - y) < radius) breakObject(s, b, 999, Math.sign(center(b) - x) || 1);
    // Clearing nearby projectiles makes the storm a deliberate defensive counter.
    s.projectiles = s.projectiles.filter(shot => !shot.enemy || Math.hypot(shot.x - x, shot.y - y) > radius);
    p.invulnerable = Math.max(p.invulnerable, .4);
    particles(s, x, y, spec.color, 65, 'ember', 1.65); impact(s, x, y, spec.color, radius, 'storm');
    s.shake = .19; s.hitStop = Math.max(s.hitStop, .075); s.flash = .13;
  }
  emit(s, index === 0 ? 'skill' : 'storm'); return true;
}
export function groundSlam(s) {
  const p = s.player;
  if (s.mode !== 'playing' || p.onGround || p.slam || p.dashTimer > 0) return false;
  p.attackPending = null; p.attackTimer = 0; p.castTimer = 0; p.slam = true; p.vy = 1400; p.vx *= .25;
  anim(p, 'fall'); particles(s, center(p), p.y + 15, '#ffd69d', 14, 'ember'); emit(s, 'slam'); return true;
}
function slamLanding(s) {
  const p = s.player, x = center(p), y = p.y + p.h;
  p.slam = false; p.landingTimer = .18;
  impact(s, x, y, '#ffd9a8', 240, 'slam'); particles(s, x, y, '#dcc5a1', 38, 'stone', 1.3); particles(s, x, y, '#ffa381', 28, 'ember', 1.5);
  for (const e of alive(s)) if (Math.abs(center(e) - x) < 215 && Math.abs(e.y + e.h - y) < 120) hurtEnemy(s, e, s.damage * 2.5, Math.sign(center(e) - x) || 1, 1.7);
  for (const b of s.rooms[s.room].breakables) if (!b.broken && Math.abs(center(b) - x) < 230 && Math.abs(b.y + b.h - y) < 115) breakObject(s, b, 999, Math.sign(center(b) - x) || 1);
  s.shake = .22; s.hitStop = Math.max(s.hitStop, .07); s.flash = .1; emit(s, 'slamHit');
}
export function heal(s) {
  const p = s.player;
  if (s.mode !== 'playing' || !p.flask || p.hp >= p.maxHp) return false;
  p.flask--; p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * .55)); p.invulnerable = Math.max(p.invulnerable, .4);
  particles(s, center(p), p.y + 35, '#b9e49c', 20, 'ember'); impact(s, center(p), p.y + 35, '#b9e49c', 120, 'heal'); tell(s, '회복의 물약 · 체력이 회복됩니다.'); emit(s, 'heal'); return true;
}
function grantLoot(s, loot, x, y) {
  const list = Array.isArray(loot) ? loot : typeof loot === 'object' && loot ? [loot] : [{ kind: typeof loot === 'string' ? loot : 'gold', amount: typeof loot === 'number' ? loot : loot === 'gold' ? 8 : 1 }];
  for (const item of list) s.rooms[s.room].items.push({ ...item, x: x + (random(s) - .5) * 30, y: y - 15, amount: item.amount ?? 1, collected: false });
}
function breakObject(s, b, damage = 999, direction = 1) {
  if (b.broken) return false;
  b.hp = Math.max(0, b.hp - damage);
  particles(s, center(b), b.y + b.h / 2, b.color || '#c3ab86', b.hp ? 6 : 24, 'stone', b.hp ? .6 : 1.3);
  if (b.hp) { emit(s, 'chip'); return true; }
  b.broken = true;
  impact(s, center(b), b.y + b.h / 2, b.color || '#d5bd94', b.kind === 'wall' || b.kind === 'rune' ? 130 : 70, 'shatter');
  s.shake = Math.max(s.shake, .065); s.hitStop = Math.max(s.hitStop, .018);
  grantLoot(s, b.loot, center(b), b.y + b.h - 8);
  if (b.secret) { tell(s, '비밀 통로 발견 · 숨겨진 보상이 기다립니다.', 4); emit(s, 'secret'); }
  emit(s, 'shatter'); return true;
}
export function shatterAt(s, x, y) {
  if (s.mode !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const chest = s.rooms[s.room].chests.find(c => !c.opened && x >= c.x - 8 && x <= c.x + c.w + 8 && y >= c.y - 8 && y <= c.y + c.h + 8 && Math.hypot(center(c) - center(s.player), c.y + c.h / 2 - s.player.y - s.player.h / 2) < 105);
  if (chest) return openChest(s, chest);
  const b = s.rooms[s.room].breakables.find(b => !b.broken && x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y - 8 && y <= b.y + b.h + 8);
  if (b) return breakObject(s, b, 999, Math.sign(x - center(s.player)) || 1);
  particles(s, x, y, '#c6f8ec', 7, 'spark', .55); impact(s, x, y, '#a1eedc', 28, 'touch'); return false;
}
const BOONS = [
  { id: 'blade', name: '핏빛 칼날', description: '검과 스킬 공격력 +20%', color: '#df899a' },
  { id: 'vitality', name: '불멸의 심장', description: '최대 체력 +25 · 체력 회복', color: '#a6cf9d' },
  { id: 'tempo', name: '폭풍의 발걸음', description: '공격 속도 +15% · 이동 속도 +5%', color: '#b0a3eb' },
  { id: 'flask', name: '새벽의 샘', description: '물약 1개 · 체력 35 회복', color: '#d0bb80' },
];
function clearRoom(s) {
  const room = s.rooms[s.room];
  if (room.cleared || s.mode !== 'playing' || s.room === 5) return;
  const guards = room.enemies.filter(e => e.guardian);
  if (!room.keyCollected || guards.some(e => !e.dead)) return;
  room.cleared = true; s.meta.best = Math.max(s.meta.best, s.room + 1); emit(s, 'clear');
  if (!room.boonTaken) {
    s.boonChoices = [BOONS[0], BOONS[1], BOONS[s.room % 2 ? 3 : 2]].map(b => ({ ...b }));
    s.mode = 'boon'; tell(s, '봉인이 풀렸다. 다음 구역을 위한 축복을 선택하세요.', 99); emit(s, 'boon');
  }
}
export function chooseBoon(s, index) {
  if (s.mode !== 'boon' || !Number.isInteger(index) || !s.boonChoices[index]) return false;
  const b = s.boonChoices[index], p = s.player;
  if (b.id === 'blade') s.damage = Math.round(s.damage * 1.2);
  if (b.id === 'vitality') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 50); }
  if (b.id === 'tempo') { s.attackCooldown = Math.max(.16, s.attackCooldown * .85); s.moveSpeed = Math.min(480, s.moveSpeed * 1.05); }
  if (b.id === 'flask') { p.flask = Math.min(p.maxFlask, p.flask + 1); p.hp = Math.min(p.maxHp, p.hp + 35); }
  s.boons.push({ ...b }); s.rooms[s.room].boonTaken = true; s.boonChoices = []; s.mode = 'playing';
  tell(s, `${b.name} 획득 · 열린 문으로 계속 나아가세요.`, 4); emit(s, 'choose'); return true;
}
function openChest(s, chest) {
  chest.opened = true;
  const relic = chest.relic || chest.reward || 'blade';
  chest.relic = relic;
  if (relic === 'heart' || relic === 'vitality') { s.player.maxHp += 15; s.player.hp = Math.min(s.player.maxHp, s.player.hp + 35); }
  else if (relic === 'tempo') { s.attackCooldown = Math.max(.16, s.attackCooldown * .9); s.moveSpeed = Math.min(480, s.moveSpeed * 1.05); }
  else if (relic === 'storm') { s.player.skillCooldowns = [0, 0]; s.player.flask = Math.min(s.player.maxFlask, s.player.flask + 1); }
  else s.damage += 5;
  chest.reward = relic === 'heart' || relic === 'vitality' ? '생명의 유물 · 최대 체력 +15' : relic === 'tempo' ? '발걸음의 유물 · 공격 속도 +10%' : relic === 'storm' ? '폭풍의 유물 · 스킬 충전 · 물약 +1' : '칼날의 유물 · 공격력 +5';
  grantLoot(s, chest.loot || [{ kind: 'gold', amount: 35 }, { kind: 'ember', amount: 2 }], center(chest), chest.y);
  particles(s, center(chest), chest.y, '#ffe4a0', 30, 'ember'); impact(s, center(chest), chest.y, '#ffe4a0', 135, 'chest');
  tell(s, chest.reward, 4); emit(s, 'chest'); return true;
}
function nearExit(p, exit) {
  return overlap({ x: p.x - 65, y: p.y - 30, w: p.w + 130, h: p.h + 65 }, exit);
}
export function interact(s) {
  if (s.mode !== 'playing') return false;
  const def = roomFor(s), p = s.player, room = s.rooms[s.room];
  const chest = room.chests.find(c => !c.opened && Math.hypot(center(c) - center(p), c.y + c.h / 2 - p.y - p.h / 2) < 105);
  if (chest) return openChest(s, chest);
  const exit = (def.exits || []).find(exit => nearExit(p, exit));
  if (!exit || !Number.isInteger(exit.target) || !ROOM_DEFS[exit.target]) return false;
  if (exit.locked && !room.cleared) { tell(s, room.keyCollected ? '문을 지키는 여감시관을 처치하세요.' : '봉인된 문 · 높은 길에서 문양을 찾으세요.'); return false; }
  const from = s.room, next = exit.target, nextDef = ROOM_DEFS[next];
  const backExit = next < from ? nextDef.exits?.find(e => e.target === from) : null;
  const spawn = exit.destination || (backExit ? { x: backExit.x - 75, y: backExit.y + backExit.h } : nextDef.spawn) || { x: nextDef.spawnX || 160, y: FLOOR };
  s.room = next; s.rooms[next].visited = true;
  p.x = clamp(spawn.x, 18, (nextDef.width || W) - p.w - 18); p.y = spawn.y - p.h; p.vx = 0; p.vy = 0; p.onGround = true; p.jumps = 0; p.coyote = .1; p.invulnerable = .7; p.slam = false;
  p.attackPending = null; p.attackTimer = 0; p.attackQueued = 0; p.dashTimer = 0; p.castTimer = 0; p.combo = 0; p.comboWindow = 0; anim(p, 'idle');
  s.projectiles = []; s.slashes = []; s.particles = []; s.impacts = []; s.damageTexts = []; s.trails = []; s.hitStop = 0; s.bossActive = false;
  explore(s);
  tell(s, `${nextDef.name} · ${next === 5 ? '공허의 여왕이 깨어납니다.' : '미로의 높은 길에서 봉인 문양을 찾으세요.'}`, 4); emit(s, 'room'); return true;
}
function solidRects(s) {
  const def = roomFor(s);
  return [...(def.solids || def.walls || []), ...(def.platforms || []).filter(p => p.oneWay === false || p.solid), ...s.rooms[s.room].breakables.filter(b => !b.broken && (b.solid || b.kind === 'wall' || b.kind === 'rune'))];
}
function moveBody(s, body, dt, drop = false) {
  const solids = solidRects(s), oldX = body.x, oldY = body.y, dx = body.vx * dt, dy = body.vy * dt;
  let nextX = clamp(oldX + dx, 18, roomWidth(s) - body.w - 18), wallHit = false;
  for (const r of solids) {
    if (body.y + body.h <= r.y + .1 || body.y >= r.y + r.h - .1) continue;
    if (dx > 0 && oldX + body.w <= r.x + .5 && nextX + body.w > r.x) { nextX = Math.min(nextX, r.x - body.w); wallHit = true; }
    else if (dx < 0 && oldX >= r.x + r.w - .5 && nextX < r.x + r.w) { nextX = Math.max(nextX, r.x + r.w); wallHit = true; }
  }
  body.x = nextX;
  if (wallHit) body.vx = 0;
  const oldBottom = oldY + body.h;
  let nextY = oldY + dy, landed = false;
  if (dy >= 0) {
    let surface = floorFor(s);
    const platforms = drop ? [] : (roomFor(s).platforms || []).filter(p => p.oneWay !== false && !p.solid);
    for (const r of [...solids, ...platforms]) if (body.x + body.w > r.x + .5 && body.x < r.x + r.w - .5 && oldBottom <= r.y + .5 && nextY + body.h >= r.y) surface = Math.min(surface, r.y);
    if (nextY + body.h >= surface && oldBottom <= surface + 2) { nextY = surface - body.h; body.vy = 0; landed = true; }
  } else {
    for (const r of solids) if (body.x + body.w > r.x + .5 && body.x < r.x + r.w - .5 && oldY >= r.y + r.h - .5 && nextY < r.y + r.h) { nextY = Math.max(nextY, r.y + r.h); body.vy = 0; }
  }
  body.y = Math.max(-100, nextY); body.onGround = landed;
  return { wallHit, landed, oldBottom, oldX, oldY };
}
function projectile(s, e) {
  const x = center(e), y = e.y + 25, dx = e.targetX - x, dy = e.targetY - y, distance = Math.max(1, Math.hypot(dx, dy));
  s.projectiles.push({ x, y, vx: dx / distance * 470, vy: dy / distance * 470, w: 22, h: 7, life: 4, kind: 'arrow', enemy: true, damage: e.damage, color: '#dfa0b8' }); emit(s, 'bow');
}
function startWindup(s, e, intent, seconds) {
  e.phase = 'windup'; e.intent = intent; e.timer = seconds; e.hitPlayer = false;
  e.facing = center(s.player) < center(e) ? -1 : 1;
  e.targetX = center(s.player); e.targetY = s.player.y + 30;
  if (intent === 'daggers') e.targets = Array.from({ length: e.stage + 3 }, (_, i) => clamp(e.targetX + (i - (e.stage + 2) / 2) * 140, 130, roomWidth(s) - 130));
  emit(s, 'telegraph');
}
function enemyMelee(s, e, reach) {
  const box = { x: e.facing > 0 ? center(e) : center(e) - reach, y: e.y - 5, w: reach, h: e.h + 16 };
  impact(s, center(e) + e.facing * reach * .5, e.y + e.h * .6, '#f777a0', reach * .5, 'enemy');
  if (overlap(box, s.player)) hurtPlayer(s, e.damage, e.facing);
}
function tickEnemy(s, e, dt) {
  if (e.dead) return;
  const p = s.player;
  e.hurt = Math.max(0, e.hurt - dt); e.attackTimer = Math.max(0, e.attackTimer - dt); e.jumpCooldown = Math.max(0, e.jumpCooldown - dt); e.animTime += dt; e.timer -= dt;
  const dx = center(p) - center(e), distance = Math.abs(dx), vertical = Math.abs(p.y + p.h - e.y - e.h);
  e.vy = Math.min(1100, e.vy + 1850 * dt);
  if (e.stagger > 0) { e.stagger -= dt; e.vx *= Math.exp(-9 * dt); moveBody(s, e, dt); return; }
  e.vx = 0;
  if (e.kind === 'boss') {
    if (!s.bossActive && distance < 1100 && vertical < 350) { s.bossActive = true; tell(s, '공허의 여왕 · 세라', 4); emit(s, 'boss'); }
    if (!s.bossActive) { moveBody(s, e, dt); return; }
    const stage = e.hp < e.maxHp * .33 ? 3 : e.hp < e.maxHp * .66 ? 2 : 1;
    if (stage > e.stage) { e.stage = stage; particles(s, center(e), e.y + 45, '#c293f7', 45, 'ember', 1.5); impact(s, center(e), e.y + 45, '#cc9cff', 240, 'storm'); tell(s, stage === 2 ? '여왕의 분노 · 검은 비가 내립니다.' : '최후의 춤 · 공격이 빨라집니다.'); emit(s, 'phase'); }
  }
  if (e.phase === 'idle') {
    e.facing = dx < 0 ? -1 : 1;
    if (e.kind === 'archer') {
      if (distance < 1100 && vertical < 700 && e.timer <= 0) startWindup(s, e, 'arrow', .75);
    } else if (e.kind === 'boss') {
      if (e.timer <= 0) { const pattern = e.attacks % 3; startWindup(s, e, pattern === 0 ? 'sweep' : pattern === 1 ? 'daggers' : 'lunge', pattern === 1 ? 1.05 : .85 - e.stage * .07); }
      else if (distance > 185) e.vx = e.facing * e.speed;
    } else if (distance < (e.kind === 'warden' ? 180 : 105) && vertical < 75 && e.timer <= 0) startWindup(s, e, 'melee', e.kind === 'warden' ? .66 : .42);
    else if (distance < 900 && distance > 65 && vertical < 240) {
      e.vx = e.facing * e.speed;
      if (p.y < e.y - 90 && e.onGround && e.jumpCooldown <= 0 && e.kind === 'duelist') { e.vy = -640; e.jumpCooldown = 1.4; }
    }
  } else if (e.phase === 'windup' && e.timer <= 0) {
    e.phase = 'attack'; e.timer = e.intent === 'lunge' ? .35 : .19; e.attacks++;
    if (e.intent === 'arrow') projectile(s, e);
    else if (e.intent === 'daggers') {
      for (const x of e.targets) s.projectiles.push({ x: x - 7, y: Math.max(60, p.y - 650), vx: 0, vy: 660 + e.stage * 60, w: 14, h: 40, life: 2.6, kind: 'dagger', enemy: true, damage: e.damage, color: '#d9b2ef' }); emit(s, 'daggers');
    } else if (e.intent !== 'lunge') enemyMelee(s, e, e.intent === 'sweep' ? 330 : e.kind === 'warden' ? 180 : 120);
    emit(s, 'enemyAttack');
  } else if (e.phase === 'attack') {
    if (e.intent === 'lunge') { e.vx = e.facing * (770 + e.stage * 60); if (!e.hitPlayer && overlap(e, p)) e.hitPlayer = hurtPlayer(s, e.damage, e.facing); }
    if (e.timer <= 0) { e.phase = 'recover'; e.timer = e.kind === 'boss' ? .55 - e.stage * .05 : .5; }
  } else if (e.phase === 'recover' && e.timer <= 0) { e.phase = 'idle'; e.intent = ''; e.timer = e.kind === 'boss' ? .65 - e.stage * .08 : e.kind === 'archer' ? 1 : .33; }
  if (e.phase === 'idle' && e.kind !== 'boss') {
    if (e.vx < 0 && Number.isFinite(e.patrolMin)) e.vx = Math.max(e.vx, Math.min(0, (e.patrolMin - e.x) / Math.max(dt, .001)));
    if (e.vx > 0 && Number.isFinite(e.patrolMax)) e.vx = Math.min(e.vx, Math.max(0, (e.patrolMax - e.w - e.x) / Math.max(dt, .001)));
  }
  const moved = moveBody(s, e, dt);
  if (moved.wallHit && e.onGround && e.kind === 'duelist' && e.jumpCooldown <= 0 && distance < 700) { e.vy = -640; e.jumpCooldown = 1.4; }
}
function tickEffects(s, dt) {
  s.shake = Math.max(0, s.shake - dt); s.flash = Math.max(0, s.flash - dt);
  const solids = solidRects(s);
  const surfaces = [...(roomFor(s).platforms || []), ...solids, { x: 0, y: floorFor(s), w: roomWidth(s), h: 160 }];
  for (const p of s.particles) {
    const oldY = p.y, oldX = p.x;
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'stone' ? 1450 : p.kind === 'dust' ? 170 : 560) * dt; p.rotation += p.angularVelocity * dt;
    if (p.kind === 'stone') for (const r of solids) {
      if (p.y + p.size <= r.y || p.y >= r.y + r.h) continue;
      if (p.vx > 0 && oldX + p.size <= r.x && p.x + p.size > r.x) { p.x = r.x - p.size; p.vx *= -.45; }
      else if (p.vx < 0 && oldX >= r.x + r.w && p.x < r.x + r.w) { p.x = r.x + r.w; p.vx *= -.45; }
    }
    if (p.kind === 'stone' && p.vy < 0) for (const r of solids) if (p.x + p.size > r.x && p.x < r.x + r.w && oldY >= r.y + r.h && p.y < r.y + r.h) { p.y = r.y + r.h; p.vy *= -.35; break; }
    if (p.kind === 'stone' && p.vy > 0) for (const r of surfaces) if (p.x >= r.x && p.x <= r.x + r.w && oldY + p.size <= r.y + 1 && p.y + p.size >= r.y) { p.y = r.y - p.size; p.vy = p.bounces > 2 ? 0 : -p.vy * .36; p.vx *= .68; p.angularVelocity *= .7; p.bounces++; break; }
  }
  s.particles = s.particles.filter(p => p.life > 0);
  for (const list of [s.slashes, s.impacts, s.trails]) { for (const effect of list) effect.life -= dt; }
  s.slashes = s.slashes.filter(e => e.life > 0); s.impacts = s.impacts.filter(e => e.life > 0); s.trails = s.trails.filter(e => e.life > 0);
  for (const text of s.damageTexts) { text.life -= dt; text.y += text.vy * dt; text.vy *= Math.exp(-3 * dt); }
  s.damageTexts = s.damageTexts.filter(e => e.life > 0);
}
function collect(s) {
  const p = s.player, room = s.rooms[s.room];
  for (const item of room.items) {
    if (item.collected || Math.hypot(center(p) - item.x, p.y + p.h / 2 - item.y) > 62) continue;
    if (item.kind === 'flask' && p.flask >= p.maxFlask) continue;
    item.collected = true;
    if (item.kind === 'gold') s.gold += item.amount;
    if (item.kind === 'ember') { s.embers += item.amount; tell(s, `불씨 +${item.amount} · 죽어도 사라지지 않는 힘`); }
    if (item.kind === 'flask') { p.flask = Math.min(p.maxFlask, p.flask + item.amount); tell(s, '회복의 물약 +1'); }
    if (item.kind === 'heal') { p.hp = Math.min(p.maxHp, p.hp + item.amount); tell(s, '생명의 샘 · 체력이 회복됩니다.'); }
    if (item.kind === 'sigil' || item.kind === 'key') { room.keyCollected = true; tell(s, '봉인 문양 획득 · 문을 지키는 감시관을 넘어서세요.', 5); impact(s, item.x, item.y, '#92ffe3', 150, 'key'); emit(s, 'key'); }
    particles(s, item.x, item.y, item.kind === 'ember' ? '#bd9ce9' : item.kind === 'sigil' ? '#92ffe3' : '#dfc480', 12, 'ember'); emit(s, 'pickup');
  }
}
function explore(s) {
  const room = s.rooms[s.room], p = s.player, cols = Math.ceil(roomWidth(s) / 128);
  const cx = Math.floor(center(p) / 128), cy = Math.floor((p.y + p.h / 2) / 128);
  for (let y = Math.max(0, cy - 2); y <= Math.min(Math.ceil(H / 128) - 1, cy + 2); y++) for (let x = Math.max(0, cx - 3); x <= Math.min(cols - 1, cx + 3); x++) room.explored[y * cols + x] = true;
}
function tickProjectiles(s, dt) {
  const p = s.player, solids = solidRects(s), enemies = s.rooms[s.room].enemies, breakables = s.rooms[s.room].breakables;
  for (const shot of s.projectiles) {
    const oldX = shot.x;
    shot.life -= dt; shot.x += shot.vx * dt; shot.y += shot.vy * dt;
    if (shot.life <= 0) continue;
    // A swept box keeps fast sword waves from skipping narrow bodies on a slow frame.
    const swept = { ...shot, x: Math.min(oldX, shot.x), w: shot.w + Math.abs(shot.x - oldX) };
    if (shot.enemy !== false) {
      if (overlap(swept, p)) { hurtPlayer(s, shot.damage, shot.vx >= 0 ? 1 : -1); shot.life = 0; }
      if (solids.some(r => overlap(shot, r))) { particles(s, shot.x, shot.y, shot.color || '#efa9ca', 6); shot.life = 0; }
    } else {
      for (let i = 0; i < enemies.length; i++) if (!enemies[i].dead && !shot.hits.includes(i) && overlap(swept, enemies[i])) { shot.hits.push(i); hurtEnemy(s, enemies[i], shot.damage, shot.facing, 1.5); }
      for (let i = 0; i < breakables.length; i++) if (!breakables[i].broken && !shot.broken.includes(i) && overlap(swept, breakables[i])) { shot.broken.push(i); breakObject(s, breakables[i], 999, shot.facing); }
      if (solids.filter(r => !breakables.includes(r)).some(r => overlap(shot, r))) { impact(s, shot.x, shot.y + shot.h / 2, shot.color, 95, 'shatter'); shot.life = 0; }
      if (shot.life > 0) particles(s, shot.x + shot.w / 2, shot.y + shot.h / 2, shot.color, 2, 'ember', .4);
    }
    if (shot.y > floorFor(s) + 60 || shot.x < -100 || shot.x > roomWidth(s) + 100) shot.life = 0;
  }
  s.projectiles = s.projectiles.filter(shot => shot.life > 0);
}
export function step(s, input = {}, dt = 1 / 60) {
  dt = Number.isFinite(dt) ? clamp(dt, 0, .05) : 0;
  tickEffects(s, dt);
  if (s.mode !== 'playing') { s.prevInput = { ...input }; return s; }
  const p = s.player, move = clamp(Number(input.move) || 0, -1, 1);
  s.time += dt; s.messageTimer = Math.max(0, s.messageTimer - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt); p.skillCooldowns = p.skillCooldowns.map(t => Math.max(0, t - dt));
  if (move && p.dashTimer <= 0 && p.attackTimer <= 0) p.facing = move > 0 ? 1 : -1;
  if (input.jump && !s.prevInput.jump) p.jumpBuffer = .13;
  if (input.dash && !s.prevInput.dash) dash(s);
  if (input.heal && !s.prevInput.heal) heal(s);
  if ((input.skill || input.skill1) && !(s.prevInput.skill || s.prevInput.skill1)) skill(s, 0);
  if (input.skill2 && !s.prevInput.skill2) skill(s, 1);
  if (input.slam && !s.prevInput.slam) groundSlam(s);
  if (input.down && !s.prevInput.down && p.onGround && p.y + p.h < floorFor(s) - 2) { p.dropTimer = .26; p.onGround = false; p.y += 3; p.vy = 100; p.coyote = 0; }
  if (input.attack) attack(s);
  if (input.interact && !s.prevInput.interact) p.interactQueued = true;
  if (s.hitStop > 0) { s.hitStop = Math.max(0, s.hitStop - dt); s.prevInput = { ...input }; return s; }
  p.attackTimer = Math.max(0, p.attackTimer - dt); p.attackQueued = Math.max(0, p.attackQueued - dt); p.comboWindow = Math.max(0, p.comboWindow - dt);
  p.dashTimer = Math.max(0, p.dashTimer - dt); p.invulnerable = Math.max(0, p.invulnerable - dt); p.castTimer = Math.max(0, p.castTimer - dt); p.landingTimer = Math.max(0, p.landingTimer - dt); p.hurtTimer = Math.max(0, p.hurtTimer - dt); p.dropTimer = Math.max(0, p.dropTimer - dt);
  p.coyote = p.onGround ? .11 : Math.max(0, p.coyote - dt); p.animTime += dt;
  if (p.jumpBuffer > 0) { if (!jump(s)) p.jumpBuffer = Math.max(0, p.jumpBuffer - dt); }
  if (p.attackQueued > 0 && p.attackTimer <= 0) attack(s);
  tickAttack(s, dt);
  if (p.dashTimer > 0) { p.vx = p.facing * 1100; p.vy = 0; s.trails.push({ x: p.x, y: p.y, w: p.w, h: p.h, facing: p.facing, anim: 'dash', animTime: p.animTime, life: .16, maxLife: .16 }); }
  else {
    if (p.hurtTimer <= 0) {
      const target = p.slam ? move * 95 : move * s.moveSpeed;
      if (p.attackTimer > 0) {
        const combo = COMBOS[Math.max(0, p.combo - 1)];
        p.vx = target * .48 + p.facing * combo.lunge * Math.max(0, p.attackTimer / p.attackDuration - .3);
      } else p.vx += (target - p.vx) * Math.min(1, dt * (move ? 28 : 34));
    }
    p.vy = p.slam ? 1450 : Math.min(1150, p.vy + 1850 * dt);
  }
  const wasGround = p.onGround, landingSpeed = p.vy, moved = moveBody(s, p, dt, p.dropTimer > 0);
  p.runDistance += Math.abs(p.x - moved.oldX);
  if (moved.landed) {
    p.jumps = 0; p.coyote = .11;
    if (!wasGround && landingSpeed > 260) { p.landingTimer = .11; particles(s, center(p), p.y + p.h, '#a6aba7', Math.min(16, Math.floor(landingSpeed / 80)), 'dust', .7); if (p.slam) slamLanding(s); else emit(s, 'land'); }
    if (p.jumpBuffer > 0) jump(s);
  }
  if (p.hurtTimer > 0) anim(p, 'hurt');
  else if (p.dashTimer > 0) anim(p, 'dash');
  else if (p.castTimer > 0) anim(p, 'cast');
  else if (p.attackTimer > 0) anim(p, `attack${p.combo}`);
  else if (!p.onGround) anim(p, p.vy < 0 ? 'jump' : 'fall');
  else if (p.landingTimer > 0) anim(p, 'land');
  else anim(p, Math.abs(p.vx) > 35 ? 'run' : 'idle');
  for (const e of s.rooms[s.room].enemies) { tickEnemy(s, e, dt); if (s.mode !== 'playing') break; }
  if (s.mode === 'playing') tickProjectiles(s, dt);
  if (s.mode === 'playing') { collect(s); explore(s); clearRoom(s); if (p.interactQueued) { p.interactQueued = false; interact(s); } }
  s.prevInput = { ...input }; return s;
}
