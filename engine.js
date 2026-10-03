export const W = 1600, H = 900, FLOOR = 760;

const platform = (x, y, w) => ({ x, y, w, h: 22 });
export const ROOM_DEFS = [
  { name: '잿빛 감옥', subtitle: 'THE ASHEN CELLS', color: '#426376', decor: 'prison', spawnX: 160, platforms: [platform(340, 610, 240), platform(750, 540, 260), platform(1220, 620, 210)], doors: { right: 1 } },
  { name: '가라앉은 수로', subtitle: 'THE DROWNED AQUEDUCT', color: '#2d797e', decor: 'aqueduct', spawnX: 110, platforms: [platform(220, 620, 250), platform(590, 470, 220), platform(1010, 600, 260)], doors: { left: 0, right: 2 } },
  { name: '금서의 서고', subtitle: 'THE FORBIDDEN ARCHIVE', color: '#655b8e', decor: 'library', spawnX: 110, platforms: [platform(270, 600, 260), platform(650, 440, 270), platform(1100, 600, 250)], doors: { left: 1, right: 3 } },
  { name: '유리 정원', subtitle: 'THE GLASS GARDEN', color: '#608773', decor: 'garden', spawnX: 110, platforms: [platform(260, 620, 230), platform(620, 510, 280), platform(1070, 610, 230)], doors: { left: 2, right: 4 } },
  { name: '붉은 대장간', subtitle: 'THE CRIMSON FORGE', color: '#a46555', decor: 'forge', spawnX: 110, platforms: [platform(210, 620, 250), platform(600, 490, 260), platform(1050, 620, 260)], doors: { left: 3, right: 5 } },
  { name: '공허의 대성당', subtitle: 'THE HOLLOW CATHEDRAL', color: '#8d6fa1', decor: 'cathedral', spawnX: 110, platforms: [platform(320, 590, 180), platform(1090, 590, 180)], doors: { left: 4 } },
];

const ENEMY_STATS = {
  duelist: { name: '잿빛 검무사', hp: 88, w: 32, h: 68, damage: 11, speed: 112 },
  archer: { name: '침묵의 궁수', hp: 80, w: 30, h: 68, damage: 12, speed: 0 },
  warden: { name: '철의 여감시관', hp: 132, w: 40, h: 78, damage: 16, speed: 72 },
  boss: { name: '공허의 여왕 · 세라', hp: 2200, w: 68, h: 108, damage: 19, speed: 94 },
};
const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const center = e => e.x + e.w / 2;
const alive = s => s.rooms[s.room].enemies.filter(e => !e.dead);
export const roomFor = state => ROOM_DEFS[state.room];

function random(s) {
  s.rng ^= s.rng << 13; s.rng ^= s.rng >>> 17; s.rng ^= s.rng << 5;
  return (s.rng >>> 0) / 4294967296;
}
function emit(s, event) { if (s.events.length < 128) s.events.push(event); }
function tell(s, message, seconds = 3) { s.message = message; s.messageTimer = seconds; }
function particles(s, x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const life = .3 + random(s) * .45;
    s.particles.push({ x, y, vx: (random(s) - .5) * 300, vy: -30 - random(s) * 230, life, maxLife: life, color, size: 2 + random(s) * 4 });
  }
  if (s.particles.length > 260) s.particles.splice(0, s.particles.length - 260);
}
function enemy(kind, x, surfaceY = FLOOR) {
  const spec = ENEMY_STATS[kind];
  return { ...spec, kind, x, y: surfaceY - spec.h, hp: spec.hp, maxHp: spec.hp, facing: -1, phase: 'idle', intent: '', timer: .8, attackTimer: 0, hurt: 0, dead: false, attacks: 0, stage: 1, vx: 0, homeY: surfaceY - spec.h, hitPlayer: false };
}
function makeRooms(s) {
  const formations = [
    [['duelist', 940], ['duelist', 1270]],
    [['duelist', 600], ['archer', 1100, 600], ['duelist', 1350]],
    [['duelist', 520], ['archer', 760, 440], ['duelist', 1210]],
    [['duelist', 570], ['warden', 1010], ['duelist', 1350]],
    [['warden', 630], ['archer', 1140, 620], ['warden', 1370]],
    [['boss', 1160]],
  ];
  return formations.map((formation, index) => ({
    visited: index === 0, cleared: false, boonTaken: false,
    enemies: formation.map(([kind, x, floor]) => enemy(kind, x + Math.floor(random(s) * 30 - 15), floor)),
    items: [
      ...ROOM_DEFS[index].platforms.flatMap((p, j) => [{ kind: 'gold', x: p.x + p.w / 2, y: p.y - 18, amount: 8 + index * 2, collected: false }, ...(j === 1 && index !== 5 ? [{ kind: 'ember', x: p.x + p.w / 2 + 45, y: p.y - 18, amount: 1, collected: false }] : [])]),
      ...(index === 1 || index === 4 ? [{ kind: 'flask', x: 420, y: FLOOR - 18, amount: 1, collected: false }] : []),
    ],
  }));
}

export function createRun(meta = {}) {
  meta = meta && typeof meta === 'object' ? meta : {};
  const saved = { embers: nonnegative(meta.embers), best: Math.min(6, nonnegative(meta.best)), runs: nonnegative(meta.runs) + 1, power: Math.min(12, nonnegative(meta.power)) };
  const s = {
    room: 0, rooms: [], player: { x: 160, y: FLOOR - 68, w: 28, h: 68, vx: 0, vy: 0, facing: 1, hp: 120, maxHp: 120, onGround: true, jumps: 0, coyote: .1, attackTimer: 0, dashTimer: 0, dashCooldown: 0, invulnerable: 0, flask: 2, maxFlask: 3 },
    time: 0, mode: 'playing', particles: [], slashes: [], projectiles: [], events: [], meta: saved,
    kills: 0, gold: 0, embers: 0, boons: [], boonChoices: [], message: '오른쪽으로 향하세요. 검은 문 너머에 여왕이 기다립니다.', messageTimer: 6,
    bossActive: false, bossDefeated: false, rewardDone: false, damage: 34 + saved.power * 2, attackCooldown: .38, moveSpeed: 280,
    rng: (nonnegative(meta.seed) || ((Date.now() ^ (saved.runs * 2654435761)) >>> 0)) || 1,
    prevInput: {}, shake: 0,
  };
  s.rooms = makeRooms(s);
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
  p.hp = Math.max(0, p.hp - damage); p.invulnerable = .9;
  p.vx = knock * 180; p.vy = -150; p.onGround = false;
  s.shake = .18; particles(s, center(p), p.y + 30, '#f29bb1'); emit(s, 'hurt');
  if (!p.hp) finish(s, false);
  return true;
}
function hurtEnemy(s, e, damage) {
  if (e.dead) return;
  e.hp = Math.max(0, e.hp - damage); e.hurt = .16;
  particles(s, center(e), e.y + e.h * .45, e.kind === 'boss' ? '#dfa3ff' : '#f3cbba', e.kind === 'boss' ? 14 : 8);
  emit(s, 'hit'); s.shake = .065;
  if (!e.hp) {
    e.dead = true; e.phase = 'dead'; s.kills++; s.gold += e.kind === 'boss' ? 100 : 10;
    particles(s, center(e), e.y + e.h / 2, '#d8b578', 16); emit(s, 'kill');
    if (e.kind === 'boss') finish(s, true);
  }
}

export function attack(s) {
  const p = s.player;
  if (s.mode !== 'playing' || p.attackTimer > 0 || p.dashTimer > 0) return false;
  if (Math.abs(p.vx) < 20) {
    const nearest = alive(s).filter(e => Math.abs(e.y - p.y) < 100).sort((a, b) => Math.abs(center(a) - center(p)) - Math.abs(center(b) - center(p)))[0];
    if (nearest && Math.abs(center(nearest) - center(p)) < 145) p.facing = center(nearest) > center(p) ? 1 : -1;
  }
  p.attackTimer = s.attackCooldown;
  s.slashes.push({ x: center(p), y: p.y + 34, facing: p.facing, life: .22, maxLife: .22 });
  const box = { x: p.facing > 0 ? center(p) - 8 : center(p) - 130, y: p.y - 9, w: 138, h: p.h + 23 };
  for (const e of alive(s)) if (overlap(box, e)) hurtEnemy(s, e, s.damage);
  emit(s, 'attack');
  return true;
}
export function jump(s) {
  const p = s.player;
  if (s.mode !== 'playing' || p.dashTimer > 0 || (!p.onGround && p.coyote <= 0 && p.jumps >= 2)) return false;
  const grounded = p.onGround || p.coyote > 0;
  p.vy = grounded ? -590 : -525; p.jumps = grounded ? 1 : p.jumps + 1; p.onGround = false; p.coyote = 0;
  particles(s, center(p), p.y + p.h, '#c9c2eb', 6); emit(s, 'jump'); return true;
}
export function dash(s) {
  const p = s.player;
  if (s.mode !== 'playing' || p.dashCooldown > 0) return false;
  p.dashTimer = .2; p.dashCooldown = .75; p.invulnerable = Math.max(p.invulnerable, .25); p.vy = 0; p.vx = p.facing * 850;
  particles(s, center(p), p.y + 35, '#a8a3ff', 8); emit(s, 'dash'); return true;
}
export function heal(s) {
  const p = s.player;
  if (s.mode !== 'playing' || !p.flask || p.hp >= p.maxHp) return false;
  p.flask--; p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * .55)); p.invulnerable = Math.max(p.invulnerable, .4);
  particles(s, center(p), p.y + 35, '#b9e49c', 16); tell(s, '회복의 물약 · 체력이 회복됩니다.'); emit(s, 'heal'); return true;
}

const BOONS = [
  { id: 'blade', name: '핏빛 칼날', description: '검 공격력 +20%', color: '#df899a' },
  { id: 'vitality', name: '불멸의 심장', description: '최대 체력 +25 · 체력 회복', color: '#a6cf9d' },
  { id: 'tempo', name: '폭풍의 발걸음', description: '공격 속도 +15% · 이동 속도 +5%', color: '#b0a3eb' },
  { id: 'flask', name: '새벽의 샘', description: '물약 1개 · 체력 35 회복', color: '#d0bb80' },
];
function clearRoom(s) {
  const room = s.rooms[s.room];
  if (room.cleared || alive(s).length || s.mode !== 'playing') return;
  room.cleared = true; s.meta.best = Math.max(s.meta.best, s.room + 1); emit(s, 'clear');
  if (s.room === 5) return;
  if (!room.boonTaken) {
    s.boonChoices = [BOONS[0], BOONS[1], BOONS[s.room % 2 ? 3 : 2]].map(b => ({ ...b }));
    s.mode = 'boon'; tell(s, '문이 열렸다. 다음 전투를 위한 축복을 선택하세요.', 99); emit(s, 'boon');
  }
}
export function chooseBoon(s, index) {
  if (s.mode !== 'boon' || !Number.isInteger(index) || !s.boonChoices[index]) return false;
  const b = s.boonChoices[index], p = s.player;
  if (b.id === 'blade') s.damage = Math.round(s.damage * 1.2);
  if (b.id === 'vitality') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 50); }
  if (b.id === 'tempo') { s.attackCooldown = Math.max(.18, s.attackCooldown * .85); s.moveSpeed = Math.min(390, s.moveSpeed * 1.05); }
  if (b.id === 'flask') { p.flask = Math.min(p.maxFlask, p.flask + 1); p.hp = Math.min(p.maxHp, p.hp + 35); }
  s.boons.push({ ...b }); s.rooms[s.room].boonTaken = true; s.boonChoices = []; s.mode = 'playing';
  tell(s, `${b.name} 획득 · 열린 문으로 계속 나아가세요.`, 4); emit(s, 'choose'); return true;
}
export function interact(s) {
  if (s.mode !== 'playing') return false;
  const def = roomFor(s), p = s.player;
  let next;
  if (p.x > W - 155 && def.doors.right !== undefined) {
    if (!s.rooms[s.room].cleared) { tell(s, '봉인된 문 · 이 구역의 적을 모두 처치하세요.'); return false; }
    next = def.doors.right;
  } else if (p.x < 125 && def.doors.left !== undefined) next = def.doors.left;
  if (next === undefined) return false;
  const goingRight = next > s.room;
  s.room = next; s.rooms[next].visited = true;
  p.x = goingRight ? ROOM_DEFS[next].spawnX : W - 150; p.y = FLOOR - p.h; p.vx = 0; p.vy = 0; p.onGround = true; p.jumps = 0; p.coyote = .1; p.invulnerable = .7;
  s.projectiles = []; s.slashes = []; s.particles = [];
  tell(s, `${ROOM_DEFS[next].name} · ${next === 5 ? '공허의 여왕이 깨어납니다.' : '위로 이어지는 발판에는 불씨가 숨겨져 있습니다.'}`, 4); emit(s, 'room');
  return true;
}

function projectile(s, e) {
  const p = s.player, x = center(e), y = e.y + 25;
  const dx = e.targetX - x, dy = e.targetY - y, distance = Math.max(1, Math.hypot(dx, dy));
  s.projectiles.push({ x, y, vx: dx / distance * 390, vy: dy / distance * 390, w: 22, h: 7, life: 4, kind: 'arrow', enemy: true, damage: e.damage, color: '#dfa0b8' });
  emit(s, 'bow');
}
function startWindup(s, e, intent, seconds) {
  e.phase = 'windup'; e.intent = intent; e.timer = seconds; e.hitPlayer = false;
  e.facing = center(s.player) < center(e) ? -1 : 1;
  e.targetX = center(s.player); e.targetY = s.player.y + 30;
  if (intent === 'daggers') {
    e.targets = Array.from({ length: e.stage + 3 }, (_, i) => clamp(e.targetX + (i - (e.stage + 2) / 2) * 140, 130, W - 130));
  }
  emit(s, 'telegraph');
}
function enemyMelee(s, e, reach) {
  const box = { x: e.facing > 0 ? center(e) : center(e) - reach, y: e.y - 5, w: reach, h: e.h + 16 };
  if (overlap(box, s.player)) hurtPlayer(s, e.damage, e.facing);
}
function tickEnemy(s, e, dt) {
  if (e.dead) return;
  const p = s.player;
  e.hurt = Math.max(0, e.hurt - dt); e.attackTimer = Math.max(0, e.attackTimer - dt); e.timer -= dt;
  const dx = center(p) - center(e), distance = Math.abs(dx), vertical = Math.abs(p.y + p.h - (e.y + e.h));
  if (e.kind === 'boss') {
    if (!s.bossActive && distance < 920) { s.bossActive = true; tell(s, '공허의 여왕 · 세라', 4); emit(s, 'boss'); }
    if (!s.bossActive) return;
    const stage = e.hp < e.maxHp * .33 ? 3 : e.hp < e.maxHp * .66 ? 2 : 1;
    if (stage > e.stage) { e.stage = stage; particles(s, center(e), e.y + 45, '#c293f7', 30); tell(s, stage === 2 ? '여왕의 분노 · 검은 비가 내립니다.' : '최후의 춤 · 공격이 빨라집니다.'); emit(s, 'phase'); }
  }
  if (e.phase === 'idle') {
    e.facing = dx < 0 ? -1 : 1;
    if (e.kind === 'archer') {
      if (distance < 1050 && e.timer <= 0) startWindup(s, e, 'arrow', .85);
    } else if (e.kind === 'boss') {
      if (e.timer <= 0) {
        const pattern = e.attacks % 3;
        startWindup(s, e, pattern === 0 ? 'sweep' : pattern === 1 ? 'daggers' : 'lunge', pattern === 1 ? 1.1 : 1 - e.stage * .08);
      } else if (distance > 180) e.x = clamp(e.x + e.facing * e.speed * dt, 130, W - e.w - 130);
    } else if (distance < (e.kind === 'warden' ? 175 : 95) && vertical < 85 && e.timer <= 0) {
      startWindup(s, e, 'melee', e.kind === 'warden' ? .8 : .55);
    } else if (distance < 760 && distance > 60 && vertical < 160) {
      e.x = clamp(e.x + e.facing * e.speed * dt, 85, W - e.w - 85);
    }
  } else if (e.phase === 'windup' && e.timer <= 0) {
    e.phase = 'attack'; e.timer = e.intent === 'lunge' ? .42 : .22; e.attacks++;
    if (e.intent === 'arrow') projectile(s, e);
    else if (e.intent === 'daggers') {
      for (const x of e.targets) s.projectiles.push({ x: x - 7, y: 70, vx: 0, vy: 600 + e.stage * 45, w: 14, h: 40, life: 2, kind: 'dagger', enemy: true, damage: e.damage, color: '#d9b2ef' });
      emit(s, 'daggers');
    } else if (e.intent !== 'lunge') enemyMelee(s, e, e.intent === 'sweep' ? 315 : e.kind === 'warden' ? 180 : 110);
    emit(s, 'enemyAttack');
  } else if (e.phase === 'attack') {
    if (e.intent === 'lunge') {
      e.x = clamp(e.x + e.facing * (680 + e.stage * 50) * dt, 85, W - e.w - 85);
      if (!e.hitPlayer && overlap(e, p)) e.hitPlayer = hurtPlayer(s, e.damage, e.facing);
    }
    if (e.timer <= 0) { e.phase = 'recover'; e.timer = e.kind === 'boss' ? .72 - e.stage * .06 : .7; }
  } else if (e.phase === 'recover' && e.timer <= 0) {
    e.phase = 'idle'; e.intent = ''; e.timer = e.kind === 'boss' ? .72 - e.stage * .08 : e.kind === 'archer' ? 1.15 : .45;
  }
}

function tickEffects(s, dt) {
  s.shake = Math.max(0, s.shake - dt);
  for (const p of s.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 450 * dt; }
  s.particles = s.particles.filter(p => p.life > 0);
  for (const slash of s.slashes) slash.life -= dt;
  s.slashes = s.slashes.filter(p => p.life > 0);
}
function collect(s) {
  const p = s.player;
  for (const item of s.rooms[s.room].items) {
    if (item.collected || Math.hypot(center(p) - item.x, p.y + p.h / 2 - item.y) > 65) continue;
    if (item.kind === 'flask' && p.flask >= p.maxFlask) continue;
    item.collected = true;
    if (item.kind === 'gold') s.gold += item.amount;
    if (item.kind === 'ember') { s.embers += item.amount; tell(s, '불씨 +1 · 죽어도 사라지지 않는 힘'); }
    if (item.kind === 'flask') { p.flask++; tell(s, '회복의 물약 +1'); }
    particles(s, item.x, item.y, item.kind === 'ember' ? '#bd9ce9' : '#dfc480', 7); emit(s, 'pickup');
  }
}

export function step(s, input = {}, dt = 1 / 60) {
  dt = Number.isFinite(dt) ? clamp(dt, 0, .05) : 0;
  tickEffects(s, dt);
  if (s.mode !== 'playing') { s.prevInput = { ...input }; return s; }
  s.time += dt; s.messageTimer = Math.max(0, s.messageTimer - dt);
  const p = s.player;
  p.attackTimer = Math.max(0, p.attackTimer - dt); p.dashTimer = Math.max(0, p.dashTimer - dt); p.dashCooldown = Math.max(0, p.dashCooldown - dt); p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.coyote = p.onGround ? .1 : Math.max(0, p.coyote - dt);
  const move = clamp(Number(input.move) || 0, -1, 1);
  if (move && p.dashTimer <= 0) p.facing = move > 0 ? 1 : -1;
  if (input.jump && !s.prevInput.jump) jump(s);
  if (input.dash && !s.prevInput.dash) dash(s);
  if (input.heal && !s.prevInput.heal) heal(s);
  if (input.attack) attack(s);
  if (p.dashTimer > 0) { p.vx = p.facing * 850; p.vy = 0; }
  else { p.vx = move * s.moveSpeed; p.vy = Math.min(900, p.vy + 1450 * dt); }
  const oldBottom = p.y + p.h;
  p.x = clamp(p.x + p.vx * dt, 18, W - p.w - 18); p.y += p.vy * dt; p.onGround = false;
  if (p.vy >= 0) {
    let landing = FLOOR;
    for (const plat of roomFor(s).platforms) if (p.x + p.w > plat.x + 2 && p.x < plat.x + plat.w - 2 && oldBottom <= plat.y + 5 && p.y + p.h >= plat.y) landing = Math.min(landing, plat.y);
    if (p.y + p.h >= landing) { p.y = landing - p.h; p.vy = 0; p.onGround = true; p.jumps = 0; }
  }
  p.y = Math.max(-160, p.y);
  for (const e of s.rooms[s.room].enemies) { tickEnemy(s, e, dt); if (s.mode !== 'playing') break; }
  for (const shot of s.projectiles) {
    shot.life -= dt; shot.x += shot.vx * dt; shot.y += shot.vy * dt;
    if (shot.life > 0 && overlap(shot, p)) { hurtPlayer(s, shot.damage, shot.vx >= 0 ? 1 : -1); shot.life = 0; }
    if (shot.y > FLOOR || shot.x < -50 || shot.x > W + 50) shot.life = 0;
  }
  s.projectiles = s.projectiles.filter(shot => shot.life > 0);
  if (s.mode === 'playing') {
    collect(s); clearRoom(s);
    if (input.interact && !s.prevInput.interact) interact(s);
  }
  s.prevInput = { ...input };
  return s;
}
