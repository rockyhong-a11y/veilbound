// Native pixel sprite animation. Simulation timers drive contact poses.
const ROOT = 'assets/remake/characters/';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
async function sheet(name) {
  const res = await fetch(`${ROOT}${name}.json?v=5`);
  if (!res.ok) throw new Error(`Missing animation: ${name}`);
  const data = await res.json();
  const image = await new Promise((resolve, reject) => {
    const im = new Image(); im.onload = () => resolve(im); im.onerror = reject;
    im.src = `${ROOT}${data.image || name + '.png'}?v=5`;
  });
  return { image, data };
}
function loopFrame(clip, time) {
  const n = Math.floor(Math.max(0, time) * (clip.fps || 12));
  return clip.loop ? n % clip.frames : Math.min(clip.frames - 1, n);
}
export async function createSprites() {
  const enemies = new Map(), weapons = new Map(), loading = new Map();
  const phases = new WeakMap(), deaths = new WeakMap();
  await Promise.all(['duelist', 'archer', 'warden', 'boss', 'lancer'].map(async kind => enemies.set(kind, await sheet(kind))));
  let title = null;
  const im = new Image(); im.onload = () => { title = im; }; im.src = `${ROOT}title-heroine.png?v=5`;
  async function loadWeapon(type) {
    if (weapons.has(type)) return weapons.get(type);
    if (loading.has(type)) return loading.get(type);
    const promise = sheet(`heroine-${type}`).then(asset => { weapons.set(type, asset); return asset; }).finally(() => loading.delete(type));
    loading.set(type, promise); return promise;
  }
  await Promise.all(['sword', 'gun'].map(loadWeapon));
  function draw(ctx, kind, e, state, time, opacity = 1) {
    const player = kind === 'player';
    const type = e.weaponType || state.player.weapons[state.player.activeWeapon].type;
    const variant = kind === 'duelist' && !e.horde && !e.guardian ? 'lancer' : kind;
    const asset = player ? weapons.get(type) : enemies.get(variant);
    if (!asset) return;
    const { image, data } = asset, clips = data.states || data.animations;
    let name = player ? e.anim : Math.abs(e.vx || 0) > 25 ? 'walk' : 'idle', frame = 0;
    if (player) {
      if (name === 'dash') name = 'dodge';
      if (name === 'jump' && e.jumps > 1 && state.time - (e.jumpStartedAt ?? 0) < .4) name = 'double_jump';
      if (e.slam && clips.slam) name = 'slam';
      const clip = clips[name] || clips.idle;
      if (name.startsWith('attack') && clip) {
        const progress = clamp(1 - e.attackTimer / Math.max(.01, e.attackDuration), 0, 1);
        const contact = e.attackContact ?? clip.damageAt ?? .25;
        const windup = clip.windup ?? Math.max(1, Math.floor(clip.frames * contact));
        frame = progress < contact ? Math.min(windup - 1, Math.floor(progress / contact * windup)) : Math.min(clip.frames - 1, windup + Math.floor((progress - contact) / Math.max(.01, 1 - contact) * (clip.frames - windup)));
      } else if (name === 'dodge') frame = Math.min(clip.frames - 1, Math.floor(clamp(e.dashTimer !== undefined ? 1-e.dashTimer/.17 : e.animTime/.17,0,1)*clip.frames));
      else if (name === 'land') frame = Math.min(clip.frames - 1, Math.floor(clamp(1-(e.landingTimer||0)/.11,0,1)*clip.frames));
      else if (name === 'double_jump') frame = loopFrame(clip, state.time-(e.jumpStartedAt ?? state.time));
      else if (name === 'run') frame = Math.floor((e.runDistance || 0) / 24) % clip.frames;
      else frame = loopFrame(clip, e.animTime || 0);
    } else if (e.dead) {
      name = 'death';
      if (!deaths.has(e)) deaths.set(e, state.time);
      const age = (state.mode === 'won' ? time : state.time) - (e.deathAt ?? deaths.get(e)), clip = clips.death || clips.hurt;
      const lifetime = kind === 'boss' && clip ? clip.frames / clip.fps + .3 : 1.1;
      if (age > lifetime || !clip) return;
      frame = loopFrame(clip, age); opacity *= clamp((lifetime - age) / .35, 0, 1);
    } else if (e.hurt > .025 && clips.hurt) {
      name = 'hurt'; frame = loopFrame(clips.hurt, .16 - e.hurt);
    } else if (['windup', 'attack', 'recover'].includes(e.phase)) {
      if (kind === 'boss') {
        name = e.intent === 'lunge' ? e.phase === 'windup' ? 'charge_windup' : e.phase === 'attack' ? 'charge' : 'crash' : e.intent === 'daggers' ? 'summon' : e.intent === 'melee' ? 'slam' : 'sweep';
      } else name = kind === 'archer' ? 'shoot' : variant === 'lancer' ? 'thrust' : 'attack';
      const clip = clips[name] || clips.attack || clips.idle;
      let phase = phases.get(e);
      if (!phase || phase.key !== `${e.phase}/${e.intent}`) { phase = { key: `${e.phase}/${e.intent}`, duration: Math.max(.001, e.timer) }; phases.set(e, phase); }
      const progress = clamp(1 - e.timer / phase.duration, 0, .9999);
      if (clip.windup !== undefined) {
        const begin = e.phase === 'windup' ? 0 : e.phase === 'attack' ? clip.windup : clip.windup + (clip.active || 1);
        const count = e.phase === 'windup' ? clip.windup : e.phase === 'attack' ? clip.active : clip.recover;
        frame = Math.min(clip.frames - 1, begin + Math.floor(progress * Math.max(1, count)));
      } else frame = Math.floor(progress * clip.frames);
    } else { const clip = clips[name] || clips.idle; frame = loopFrame(clip, e.animTime || time); }
    const clip = clips[name] || clips.idle;
    const fw = data.frameW, fh = data.frameH;
    const index = (clip.start || 0) + frame;
    const sx = clip.row !== undefined ? frame * fw : (index % data.columns) * fw;
    const sy = clip.row !== undefined ? clip.row * fh : Math.floor(index / data.columns) * fh;
    const anchor = Array.isArray(data.anchor) ? data.anchor : [data.anchor.x, data.anchor.y];
    const scale = e.h / (data.bodyHeightPx || (kind === 'boss' ? 134 : 56));
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha *= opacity;
    ctx.translate(Math.round(e.x + e.w / 2), Math.round(e.y + e.h)); ctx.scale(e.facing || 1, 1);
    if (!e.dead && (e.hurt > 0 || e.hurtTimer > 0)) ctx.filter = 'brightness(2.5) saturate(.45)';
    if (e.invulnerable > 0 && Math.floor(time * 24) % 2 === 0) ctx.globalAlpha *= .65;
    ctx.drawImage(image, sx, sy, fw, fh, -anchor[0] * scale, -anchor[1] * scale, fw * scale, fh * scale);
    ctx.restore();
  }
  return {
    loadWeapon,
    trim(types) { for (const type of weapons.keys()) if (!types.has(type)) weapons.delete(type); },
    draw,
    drawTitle(ctx, width, height, time) {
      if (!title) return;
      const h = height * .98, w = title.width / title.height * h;
      const x = width < height ? width * .65 : width * .73;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(title, Math.round(x - w / 2), Math.round(height - h + Math.sin(time * 1.2) * 2), Math.round(w), Math.round(h));
    },
  };
}
