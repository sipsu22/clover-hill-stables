// Riding modes: training, forest trail, show jumping and the cross-country race.
import { CROP_COLORS, JUMP_COLORS, JUMP_SPR, KID, KID_COLORS, SPR } from './sprite-data.js';
import { $, clamp, esc, pick, rand, randi } from './util.js';
import { horseCanvas, horseImg, itemCanvas, mapCanvas, sprCache } from './sprites.js';
import { phen, randomGenes } from './genetics.js';
import { NAMES, SADDLES, clock } from './data.js';
import { byId, isFoal, look, saddleOf, state } from './state.js';
import { showModal, toast } from './ui.js';
import { isNarrow, render } from './views.js';
import { NATURE_COLORS, TREE_SPR, drawWeather, px } from './world-draw.js';
import { frame } from './controls.js';
import { save } from './game.js';

/* =========================================================
   RIDING — four ways to ride
     🏋️ Training ring  endless practice, trains the stat you pick
     🌲 Forest trail    calm ride: logs, streams, low branches, mushrooms
     🏆 Show jumping    competition: 12 fences, faults + time vs AI riders
     🏁 Cross-country   competition: race 5 AI horses, sprint uses energy
   Positions are in "world pixels": 16 px = 1 meter.
   Speed   → how fast you gallop
   Stamina → hearts (training), energy (race), staying strong late in a course
   Gentle  → how high your horse jumps
   ========================================================= */
export const RW = 256, RIDE_X = 44, PX_M = 16;
export let RH = 128, GROUND = 112;   // on phones the picture grows taller to fill the screen
export function setRideSize(){
  if (ride) return;           // never change size in the middle of a ride
  if (isNarrow()){
    const free = innerHeight - 300;                       // room left after the top bar, buttons and tabs
    RH = clamp(Math.round(free * rideVW() / (innerWidth + 12)), 128, 232);
  } else RH = 128;
  GROUND = RH - 16;
}
export let ride = null;          // the ride in progress
export let rideBuffer = 0;       // a jump pressed just before landing still counts
export let sprintHeld = false;
export function setSprint(v){ sprintHeld = v; }
export function clearRide(){ ride = null; }
export const rideBuf = document.createElement('canvas');
export const rideVW = () => isNarrow() ? 176 : RW;   // phones: zoomed in, still ~130 px of look-ahead

export const RIDE_MODES = {
  training: {name:'Training ring', icon:'🏋️', desc:'Endless practice jumps. Pick what to train: your horse gets better at it the farther you ride!'},
  trail:    {name:'Forest trail', icon:'🌲', desc:"A calm ride through the woods. Jump logs and streams, but DON'T jump into low branches! Collect mushrooms. Makes your horse very happy."},
  jumping:  {name:'Show jumping', icon:'🏆', comp:true, desc:'Competition! Ride a 12-fence course in front of a crowd. A knocked fence = 4 faults, and going over the time allowed adds faults too. Fewest faults wins; fastest time breaks a tie.'},
  race:     {name:'Cross-country race', icon:'🏁', comp:true, desc:'Competition! Race 5 other horses over hedges and logs. Hold Sprint to go faster, but it uses energy (more Stamina = more energy).'},
};
export const LEVELS = [
  {name:'Beginner', fee:20,  ai:[22,42], prizes:[100,60,30]},
  {name:'Novice',   fee:50,  ai:[38,58], prizes:[250,150,80]},
  {name:'Advanced', fee:100, ai:[52,74], prizes:[500,300,150]},
  {name:'Champion', fee:200, ai:[68,92], prizes:[1000,600,300]},
];
export const TRAIN_FOCUS = {speed:'⚡ Speed', stamina:'❤️ Stamina', temper:'🕊️ Jumping (Gentle)'};
export const AI_RIDERS = ['Emma','Oliver','Aino','Leo','Mia','Noah','Ella','Eetu','Sofia','Hugo','Ava','Onni','Lily','Elias','Nella','Ville'];
export const AI_SHIRTS = [['#4f86b8','#3a6a99'],['#5f9a3e','#3d6a25'],['#8a5cb8','#5c3a80'],['#e07fa3','#b4537a'],['#e0ad30','#9c7414'],['#3a3330','#1a1614']];
export const PLACE = ['🥇','🥈','🥉'];
export const horseRating = h => Math.round((h.speed + h.stamina + h.temper) / 3);
export const ordinal = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

/* ---------- more pixel art for the courses ---------- */
Object.assign(JUMP_SPR, {
  wall: [
    "cccccccccccccccc",
    "RRRmRRRRmRRRRmRR",
    "qqqmqqqqmqqqqmqq",
    "mmmmmmmmmmmmmmmm",
    "RmRRRRmRRRRmRRRR",
    "qmqqqqmqqqqmqqqq",
    "mmmmmmmmmmmmmmmm",
    "RRRmRRRRmRRRRmRR",
    "qqqmqqqqmqqqqmqq",
    "mmmmmmmmmmmmmmmm",
    "RmRRRRmRRRRmRRRR",
    "qmqqqqmqqqqmqqqq",
  ],
  log: [
    "..TTTTTTTTTTTTTTTT..",
    ".TttttttttttttttttO.",
    "TtttTtttttttTtttttOo",
    "TttttttttTtttttttOoO",
    "TtttttTttttttttttOoo",
    ".TttttttttttttTttOO.",
    "..TTTTTTTTTTTTTTTT..",
  ],
  branch: [
    "WWWWWWWWWWWWWWWWWWWWWW",
    "..WWW....WWWW...WWW...",
    ".gGgg...gggGg..ggGgg..",
    "gggGgg.gGggggg.gggggg.",
    ".ggggg..gggGg...gGgg..",
    "..gGg....ggg.....gg...",
  ],
  mushroom: [
    "..rrrr..",
    ".rwrrwr.",
    "rrrrrrrr",
    "rwrrrrwr",
    "..ssss..",
    "..ssss..",
    "..ssss..",
  ],
});
Object.assign(JUMP_COLORS, {R:'#b8432f', q:'#9c3626', m:'#e8dcc8', c:'#f6f1e6', T:'#5a3a22', t:'#7a5232', O:'#d9b47a', o:'#b08850', s:'#f2ead8'});
export function procCanvas(key, w, h, fn){
  if (sprCache.has(key)) return sprCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d')); sprCache.set(key, c); return c;
}
// returns [canvas, empty rows on top]
export function jumpCanvas(type){
  const fence = () => mapCanvas('jump:fence', JUMP_SPR.fence, JUMP_COLORS);
  switch (type){
    case 'hay': return [itemCanvas('hayBale'), 4];
    case 'oxer': return [procCanvas('jump:oxer', 30, 13, g => { g.drawImage(fence(), 0, 1); g.drawImage(fence(), 12, 0); }), 0];
    case 'triple': return [procCanvas('jump:triple', 32, 14, g => { g.drawImage(fence(), 0, 4, 18, 8, 0, 6, 18, 8); g.drawImage(fence(), 7, 2); g.drawImage(fence(), 14, 0); }), 0];
    case 'water': return [procCanvas('jump:water', 38, 5, g => {
      px(g, '#4a8cbd', 4, 1, 34, 4); px(g, '#6fb3e0', 5, 2, 32, 2); px(g, '#c9e6f7', 9, 2, 8, 1); px(g, '#c9e6f7', 24, 3, 6, 1);
      px(g, '#4f8a2b', 0, 0, 4, 5); px(g, '#7bbf4a', 1, 0, 2, 4); }), 0];
    case 'stream': return [procCanvas('jump:stream', 22, 4, g => {
      px(g, '#3f7fae', 0, 1, 22, 3); px(g, '#5fa7d6', 2, 1, 18, 2); px(g, '#c9e6f7', 5, 1, 4, 1); px(g, '#c9e6f7', 13, 2, 4, 1);
      px(g, '#4f8a2b', 0, 0, 2, 2); px(g, '#4f8a2b', 20, 0, 2, 2); }), 0];
    default: return [mapCanvas('jump:' + type, JUMP_SPR[type], JUMP_COLORS), 1];
  }
}
export function addObstacle(r, type, wx){
  const [c, top] = jumpCanvas(type);
  r.obstacles.push({type, c, wx, w: c.width, h: c.height - top, hit:false, passed:false, branch: type === 'branch'});
}

/* ---------- who can ride ---------- */
export function canRide(h){
  if (!h) return 'Pick a horse';
  if (isFoal(h)) return 'Too young to ride';
  if (h.preg) return 'Expecting a foal';
  if (!saddleOf(h)) return 'Needs a saddle';
  if (h.hunger < 30) return 'Too hungry';
  if (RIDE_MODES[state.rideMode || 'training'].comp){
    if (h.compDay === clock().idx) return 'Already competed today';
    if (state.coins < LEVELS[state.rideLevel || 0].fee) return `Entry fee is ${LEVELS[state.rideLevel || 0].fee} 🪙`;
    if ((state.rideLevel || 0) > (state.unlocked || {})[state.rideMode] ) return 'Level locked';
  }
  return null;
}
export function chanceLabel(h, lvl){
  const L = LEVELS[lvl], mid = (L.ai[0] + L.ai[1]) / 2, d = horseRating(h) - mid;
  if (d > 12) return ['😎 Great chance to win', 'ok'];
  if (d > 2) return ['🙂 Good chance', 'ok'];
  if (d > -8) return ['😬 Tough but possible', ''];
  return ['😰 Very hard: train more first!', 'bad'];
}

/* ---------- AI riders ---------- */
export function makeRival(i, lvl){
  const L = LEVELS[lvl], skill = Math.round(rand(L.ai[0], L.ai[1]));
  const genes = randomGenes();
  return {
    name: AI_RIDERS[(i * 5 + Math.floor(Math.random()*AI_RIDERS.length)) % AI_RIDERS.length],
    horse: pick(NAMES), skill, shirt: AI_SHIRTS[i % AI_SHIRTS.length],
    look: {...phen(genes), face: pick(['none','star','blaze']), socks: randi(0,3), seed: Math.floor(Math.random()*1e9), saddle: pick(Object.keys(SADDLES))},
    phase: Math.random()*6, wx: RIDE_X, slow: 0, crossed: new Set(), done: false, time: 0, y: 0,
  };
}

/* ---------- start a ride ---------- */
export function startRide(){
  const h = byId(state.rideSel);
  const why = canRide(h); if (why) return toast(`${h ? h.name + ': ' : ''}${why}`);
  const mode = state.rideMode || 'training', lvl = state.rideLevel || 0;
  const comp = RIDE_MODES[mode].comp;
  if (comp){ state.coins -= LEVELS[lvl].fee; h.compDay = clock().idx; }
  const r = ride = {
    mode, lvl, comp, h, running:true, t:0, ready:1.4, scroll:0, y:0, vy:0, slow:0, hurt:0,
    speed: 95 + h.speed*.55, jumpV: 290 + h.temper*.9,
    hearts: 2 + Math.floor(h.stamina/34), maxHearts: 2 + Math.floor(h.stamina/34),
    energy: 100, maxEnergy: 100, coins:0, carrots:0, mushrooms:0, cleared:0, faults:0, spooks:0,
    obstacles:[], items:[], fx:[], nextWX: 300, finishWX: 0, rivals:[], focus: state.trainFocus || 'speed',
  };
  if (mode === 'jumping'){
    const L = LEVELS[lvl];
    const types = lvl === 0 ? ['fence','fence','oxer','hay'] : lvl === 1 ? ['fence','oxer','triple','wall'] : ['fence','oxer','triple','wall','tall','tall'];
    let x = 280;
    for (let i=0; i<12; i++){
      addObstacle(r, (i === 6 && lvl > 0) ? 'water' : pick(types), x);
      x += 165 + Math.random()*45;
    }
    r.finishWX = x + 20;
    r.speed = 100 + h.speed*.5;
    const parSpeed = 100 + (L.ai[0] + L.ai[1]) / 2 * .5;
    r.timeAllowed = Math.ceil(r.finishWX / parSpeed * 1.06);
    // the other riders' rounds (they ride before you)
    for (let i=0; i<5; i++){
      const rv = makeRival(i, lvl), p = clamp(.3 - rv.skill*.0032, .02, .3);
      let f = 0; for (let k=0; k<12; k++) if (Math.random() < p) f += 4;
      rv.time = Math.round(r.finishWX / (100 + rv.skill*.5) * rand(.98, 1.05) * 10) / 10;
      f += Math.max(0, Math.ceil(rv.time - r.timeAllowed));
      rv.faults = f; r.rivals.push(rv);
    }
  } else if (mode === 'race'){
    let x = 380;
    const types = lvl === 0 ? ['hedge','log','hay'] : lvl === 1 ? ['hedge','log','fence','hay'] : ['hedge','log','fence','oxer','wall'];
    r.finishWX = 500 * PX_M;
    while (x < r.finishWX - 200){ addObstacle(r, pick(types), x); x += 300 + Math.random()*180; }
    r.maxEnergy = r.energy = 40 + h.stamina * .9;
    for (let i=0; i<5; i++) r.rivals.push(makeRival(i, lvl));
  } else if (mode === 'trail'){
    r.speed = (95 + h.speed*.55) * .9;
    r.finishWX = 520 * PX_M;
    let x = 300;
    while (x < r.finishWX - 150){
      const roll = Math.random();
      const type = roll < .3 ? 'branch' : roll < .55 ? 'stream' : 'log';
      addObstacle(r, type, x);
      if (Math.random() < .7) r.items.push({type: Math.random() < .75 ? 'mushroom' : 'carrot', wx: x + 90 + Math.random()*40, y: GROUND - 10 - (Math.random() < .4 ? 30 : 0)});
      x += 190 + Math.random()*110;
    }
  }
  render();
}
export function rideJump(){
  if (!ride || !ride.running) return;
  if (ride.y === 0 && ride.ready <= 0) ride.vy = -currentJumpV(ride);
  else rideBuffer = .14;
}
// in a long course, a horse with low stamina gets tired and jumps lower
export function currentJumpV(r){
  if (!r.finishWX) return r.jumpV;
  const prog = (r.scroll + RIDE_X) / r.finishWX;
  const tired = Math.max(0, prog - .5) * (1 - r.h.stamina/100) * .3;
  return r.jumpV * (1 - tired);
}
export function spawnTraining(r){
  const roll = Math.random(), dist = r.scroll / PX_M;
  let type = 'fence';
  if (dist > 60 && roll < .3) type = 'hedge';
  else if (dist > 120 && roll < .5) type = 'tall';
  else if (dist > 200 && roll < .6) type = 'oxer';
  else if (roll < .75) type = 'hay';
  addObstacle(r, type, r.nextWX);
  const ob = r.obstacles[r.obstacles.length - 1];
  if (Math.random() < .6){
    for (let i=0; i<3; i++) r.items.push({type:'coin', wx: ob.wx + ob.w/2 - 14 + i*14, y: GROUND - ob.h - 18 - (i===1 ? 8 : 0)});
  } else if (Math.random() < .5) r.items.push({type:'carrot', wx: ob.wx + ob.w + 50, y: GROUND - 16});
  r.nextWX += 150 + Math.random()*130 + r.speed*.35;
}

/* ---------- each frame ---------- */
export function rivalSpeed(rv, t){ return (95 + rv.skill*.6) * (1 + .06*Math.sin(t*.8 + rv.phase)); }
export function updateRide(dt){
  const r = ride; if (!r || !r.running) return;
  r.t += dt;
  if (r.ready > 0){ r.ready -= dt; if (r.ready <= 0) r.t = 0; return; }
  // how fast are we going?
  let v = r.speed;
  if (r.mode === 'training'){ r.speed += dt * 2.2; v = r.speed; }
  if (r.mode === 'race'){
    const sprinting = sprintHeld && r.energy > 0;
    if (sprinting){ v *= 1.22; r.energy = Math.max(0, r.energy - 28*dt); }
    else r.energy = Math.min(r.maxEnergy, r.energy + 9*dt);
    r.sprinting = sprinting;
  }
  if (r.slow > 0){ r.slow -= dt; v *= .55; }
  const move = v * dt;
  r.scroll += move;
  const me = r.scroll + RIDE_X;
  // jumping
  if (rideBuffer > 0){ rideBuffer -= dt; if (r.y === 0){ r.vy = -currentJumpV(r); rideBuffer = 0; } }
  r.vy += 1100 * dt; r.y = Math.min(0, r.y + r.vy * dt);
  if (r.y === 0) r.vy = 0;
  if (r.hurt > 0) r.hurt -= dt;
  if (r.mode === 'training' && r.nextWX - r.scroll < RW + 40) spawnTraining(r);
  for (const f of r.fx){ f.t -= dt; f.y -= 20*dt; }
  r.fx = r.fx.filter(f => f.t > 0);
  if (r.mode === 'training'){
    r.obstacles = r.obstacles.filter(o => o.wx + o.w > r.scroll - 20);
    r.items = r.items.filter(it => it.wx > r.scroll - 20 && !it.got);
  }
  // the horse's body, a little smaller than the picture to be fair
  const hx1 = me + 6, hx2 = me + 27, hBottom = GROUND + r.y, hTop = hBottom - 26;
  for (const o of r.obstacles){
    if (o.hit || o.passed || o.wx > me + 40) continue;
    const edge = (o.type === 'stream' || o.type === 'water') ? 6 : 2;
    const overlap = hx2 > o.wx + edge && hx1 < o.wx + o.w - edge;
    const hitIt = o.branch ? (overlap && r.y < -8) : (overlap && hBottom > GROUND - o.h + 2);
    if (hitIt){
      o.hit = true;
      const sx = o.wx - r.scroll;
      if (r.mode === 'training'){ r.hearts--; r.hurt = 1; r.fx.push({text:'Oops!', x:sx, y:GROUND - o.h - 6, t:1, col:'#d43d2a'}); if (r.hearts <= 0) return endRide(); }
      else if (r.mode === 'jumping'){ r.faults += 4; r.hurt = .6; r.fx.push({text:'4 faults', x:sx, y:GROUND - o.h - 6, t:1, col:'#d43d2a'}); }
      else if (r.mode === 'race'){ r.slow = .8; r.hurt = .6; r.fx.push({text:'Stumble!', x:sx, y:GROUND - o.h - 6, t:1, col:'#d43d2a'}); }
      else { r.slow = .8; r.spooks++; r.hurt = .6; r.fx.push({text: o.branch ? 'Ouch, a branch!' : 'Whoa!', x:sx, y: o.branch ? GROUND - 40 : GROUND - o.h - 6, t:1, col:'#d43d2a'}); }
    }
    if (!o.hit && !o.passed && o.wx + o.w < hx1){
      o.passed = true;
      if (!o.branch){ r.cleared++; if (r.mode !== 'race') r.fx.push({text:'Clear!', x: RIDE_X + 8, y: hTop - 4, t:.8, col:'#4a7330'}); }
    }
  }
  for (const it of r.items){
    if (it.got) continue;
    if (it.wx + 8 > hx1 && it.wx < hx2 && it.y + 8 > hTop - 6 && it.y < hBottom){
      it.got = true;
      const sx = it.wx - r.scroll;
      if (it.type === 'coin'){ r.coins++; r.fx.push({text:'+2', x:sx, y:it.y, t:.6, col:'#b5861a'}); }
      else if (it.type === 'mushroom'){ r.mushrooms++; r.fx.push({text:'+3🪙', x:sx, y:it.y, t:.6, col:'#b5861a'}); }
      else { r.carrots++; r.fx.push({text:'+🥕', x:sx, y:it.y, t:.6, col:'#c4621a'}); }
    }
  }
  // rivals in the race
  if (r.mode === 'race'){
    for (const rv of r.rivals){
      if (rv.done) continue;
      let rvV = rivalSpeed(rv, r.t);
      if (rv.slow > 0){ rv.slow -= dt; rvV *= .5; }
      rv.wx += rvV * dt;
      for (let k=0; k<r.obstacles.length; k++){
        const o = r.obstacles[k];
        if (!rv.crossed.has(k) && rv.wx + 16 > o.wx + o.w/2){
          rv.crossed.add(k);
          if (Math.random() < clamp(.32 - rv.skill*.0032, .03, .3)) rv.slow = .8;
        }
      }
      if (rv.wx >= r.finishWX){ rv.done = true; rv.time = r.t; }
    }
  }
  if (r.finishWX && me >= r.finishWX) endRide();
}

/* ---------- the end of a ride ---------- */
export function endRide(quit = false){
  const r = ride; if (!r || !r.running) return;
  r.running = false; sprintHeld = false;
  const h = r.h, m = Math.floor(r.scroll / PX_M);
  let html = '', title = 'Good ride!';
  const statNames = {speed:'Speed', stamina:'Stamina', temper:'Gentle'};
  const train = (k, n) => { let got = 0; for (let i=0; i<n; i++) if (h[k] < 100){ h[k]++; got++; } return got; };

  if (r.mode === 'training'){
    const coins = Math.floor(m/6) + r.coins*2 + r.cleared*2;
    state.coins += coins; state.inv.carrot += r.carrots;
    const gained = train(r.focus, Math.min(5, Math.floor(m/100)));
    h.hunger = clamp(h.hunger - 15, 0, 100); h.happy = clamp(h.happy + 5, 0, 100);
    const best = !h.best || m > h.best; if (best) h.best = m;
    title = best && m > 0 ? '🏆 New training record!' : 'Training done!';
    html = `<p><b>${esc(h.name)}</b> rode <b>${m} m</b> and cleared <b>${r.cleared}</b> jumps.</p>
      <p>🪙 +${coins} coins${r.carrots ? ` · 🥕 +${r.carrots}` : ''}</p>
      <p>💪 ${gained ? `+${gained} ${statNames[r.focus]}! (now ${h[r.focus]})` : 'Ride at least 100 m to improve ' + statNames[r.focus] + '.'}</p>`;
  } else if (r.mode === 'trail'){
    const finished = !quit;
    const coins = r.mushrooms * 3;
    state.coins += coins; state.inv.carrot += r.carrots;
    const joy = finished ? (r.spooks ? 25 : 35) : 10;
    h.happy = clamp(h.happy + joy, 0, 100); h.hunger = clamp(h.hunger - 15, 0, 100);
    const st = finished ? train('stamina', 1) : 0;
    title = finished ? (r.spooks ? '🌲 Lovely trail ride!' : '🌲 Perfect trail ride!') : 'Back home early';
    html = `<p><b>${esc(h.name)}</b> ${finished ? 'finished the forest trail' : `rode ${m} m of the trail`}${r.spooks ? ` (spooked ${r.spooks}×)` : ' without a single spook'}.</p>
      <p>🍄 ${r.mushrooms} mushrooms = +${coins} 🪙${r.carrots ? ` · 🥕 +${r.carrots}` : ''}</p>
      <p>😊 Happiness +${joy}${st ? ' · 💪 +1 Stamina' : ''}</p>`;
  } else {
    // competitions: rank everybody
    let rows, place;
    if (r.mode === 'jumping'){
      const time = Math.round(r.t * 10) / 10;
      const timeF = quit ? 99 : Math.max(0, Math.ceil(time - r.timeAllowed));
      const me = {you:true, name:'You', horse:h.name, faults: quit ? 99 : r.faults + timeF, time: quit ? 999 : time, timeF};
      rows = [...r.rivals.map(rv => ({name:rv.name, horse:rv.horse, faults:rv.faults, time:rv.time})), me];
      rows.sort((a, b) => a.faults - b.faults || a.time - b.time);
      place = rows.indexOf(me) + 1;
      html = `<table class="results"><tr><th></th><th>Rider</th><th>Horse</th><th>Faults</th><th>Time</th></tr>
        ${rows.map((x, i) => `<tr class="${x.you ? 'me' : ''}"><td>${PLACE[i] || ordinal(i+1)}</td><td>${esc(x.name)}</td><td>${esc(x.horse)}</td><td>${x.faults >= 99 ? '—' : x.faults}</td><td>${x.time >= 999 ? 'gave up' : x.time + 's'}</td></tr>`).join('')}</table>
        <p style="font-size:13px">Time allowed: ${r.timeAllowed}s${!quit && timeF ? ` · you were ${timeF}s over (+${timeF} faults)` : ''}</p>`;
      if (!quit) train('temper', 1);
    } else {
      const myTime = quit ? 9999 : r.t;
      const all = r.rivals.map(rv => ({name:rv.name, horse:rv.horse, time: rv.done ? rv.time : r.t + (r.finishWX - rv.wx) / rivalSpeed(rv, r.t)}));
      const me = {you:true, name:'You', horse:h.name, time: myTime};
      rows = [...all, me].sort((a, b) => a.time - b.time);
      place = rows.indexOf(me) + 1;
      html = `<table class="results"><tr><th></th><th>Rider</th><th>Horse</th><th>Time</th></tr>
        ${rows.map((x, i) => `<tr class="${x.you ? 'me' : ''}"><td>${PLACE[i] || ordinal(i+1)}</td><td>${esc(x.name)}</td><td>${esc(x.horse)}</td><td>${x.time >= 9999 ? 'gave up' : x.time.toFixed(1) + 's'}</td></tr>`).join('')}</table>`;
      if (!quit) train(Math.random() < .5 ? 'speed' : 'stamina', 1);
    }
    const L = LEVELS[r.lvl], prize = place <= 3 ? L.prizes[place - 1] : 0;
    state.coins += prize;
    h.hunger = clamp(h.hunger - 25, 0, 100); h.happy = clamp(h.happy + (place <= 3 ? 12 : 3), 0, 100);
    let unlockMsg = '';
    if (place <= 3){
      state.trophies = state.trophies || [];
      state.trophies.push({mode: r.mode, lvl: r.lvl, place, horse: h.name, day: clock().day});
      state.unlocked = state.unlocked || {jumping:0, race:0};
      if (r.lvl === state.unlocked[r.mode] && r.lvl < LEVELS.length - 1){
        state.unlocked[r.mode]++;
        unlockMsg = `<p>🔓 <b>${LEVELS[r.lvl + 1].name}</b> ${RIDE_MODES[r.mode].name.toLowerCase()} is now unlocked!</p>`;
      }
    }
    title = quit ? 'You gave up' : place <= 3 ? `${PLACE[place-1]} ${ordinal(place)} place!` : `${ordinal(place)} place`;
    html = `<p>${L.name} ${RIDE_MODES[r.mode].name.toLowerCase()} with <b>${esc(h.name)}</b></p>` + html +
      `<p>${prize ? `🪙 Prize money: <b>+${prize}</b>` : quit ? 'No prize this time.' : 'No prize this time. Train your horse and try again!'}</p>` + unlockMsg +
      (!quit ? `<p style="font-size:13px">💪 Competing made ${esc(h.name)} a little better (+1 ${r.mode === 'jumping' ? 'Gentle' : 'Speed or Stamina'}).</p>` : '');
  }
  save();
  showModal(`<div class="mpic">${horseImg(look(h), 5, 'bob')}</div><h2>${title}</h2>${html}<button class="primary" data-act="closeModal">OK</button>`);
  ride = null;
  render();
}

/* ---------- drawing ---------- */
export const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; };
export function drawBackdrop(g, mode, scroll, time){
  if (mode === 'trail'){
    // a deep green forest
    px(g, '#a9d3c4', 0, 0, RW, RH); px(g, '#c3e2d6', 0, 0, RW, 30);
    for (let x=0; x<RW; x++){                       // far tree line
      const wx = Math.floor(x + scroll*.2);
      const hgt = 40 + Math.round(Math.sin(wx/9)*6 + Math.sin(wx/23)*8 + hash(Math.floor(wx/7))*6);
      px(g, '#4f8a5a', x, GROUND - 22 - hgt, 1, hgt + 22);
    }
    for (let i=-1; i<9; i++){                       // nearer trunks
      const base = Math.floor(scroll*.5/40) + i, x = Math.round(base*40 - scroll*.5 + hash(base)*20);
      px(g, '#5a3a22', x, 0, 6, GROUND - 14); px(g, '#7a5232', x+1, 0, 2, GROUND - 14);
      const leaves = 10 + Math.round(hash(base+7)*10) + Math.round((RH - 128) * .45);
      px(g, '#3f7a26', x - 10, 0, 26, leaves); px(g, '#4f8a2b', x - 6, leaves, 18, 4); px(g, '#4f8a2b', x - 12, Math.round(leaves*.5), 6, 6);
    }
    px(g, '#5e9c3a', 0, GROUND - 16, RW, 16);
    for (let x = -((scroll) % 14); x < RW; x += 14) px(g, '#3f7a26', Math.round(x), GROUND - 12, 2, 4);
    px(g, '#8b6a44', 0, GROUND, RW, RH - GROUND); px(g, '#6e5235', 0, GROUND, RW, 2);
    for (let x = -((scroll) % 18); x < RW; x += 18){ px(g, '#7a5c3a', Math.round(x)+4, GROUND+6, 3, 1); px(g, '#a0815a', Math.round(x)+12, GROUND+11, 2, 1); }
    return;
  }
  // sky
  px(g, '#bfe3f7', 0, 0, RW, RH); px(g, '#d6eefa', 0, GROUND - 62, RW, 30);
  const tallRace = mode === 'race' && RH >= 170, trackTop = GROUND - (tallRace ? 74 : 26);
  const cloud = mapCanvas('jump:cloud', JUMP_SPR.cloud, JUMP_COLORS, null);
  for (let i=0; i<4; i++){ const x = ((i*110 - scroll*.1) % 440 + 440) % 440 - 40; g.drawImage(cloud, Math.round(x), 10 + (i%2)*14); }
  if (mode === 'jumping'){
    // grandstand full of fans
    const top = GROUND - 66 - Math.round((RH - 128) * .55), bot = GROUND - 26;   // a bigger crowd on tall screens
    px(g, '#8a5a3a', 0, top - 6, RW, bot - top + 6); px(g, '#c0453a', 0, top - 8, RW, 3);
    for (let y = top; y < bot; y += 5){
      px(g, '#6e4a30', 0, y + 3, RW, 1);
      for (let x=0; x<RW; x+=3){
        const wx = Math.floor((x + scroll*.3) / 3);
        const c = ['#f2c39b','#d9a47a','#8d5a3b','#f5d76e','#6b3e1f'][Math.floor(hash(wx*31 + y)*5)];
        const shirt = ['#4f86b8','#d0533f','#5f9a3e','#e0ad30','#8a5cb8','#ffffff'][Math.floor(hash(wx*17 + y*3)*6)];
        if (hash(wx*7 + y*13) > .7) continue;      // some empty seats
        const bounce = hash(wx + y) < .15 && Math.floor(time/250 + wx) % 2 ? -1 : 0;
        px(g, c, x, y + bounce, 2, 2); px(g, shirt, x, y + 2 + bounce, 2, 1);
      }
    }
    for (let i=-1; i<6; i++){ const x = Math.round(i*60 - (scroll*.3) % 60); px(g, '#ffffff', x, top - 20, 1, 14); px(g, ['#d0533f','#4f86b8','#e0ad30'][((i % 3) + 3) % 3], x + 1, top - 20, 8, 5); }
    px(g, '#f6f1e6', 0, bot, RW, 3);
    for (let x = -((scroll) % 20); x < RW; x += 20) px(g, '#5f9a3e', Math.round(x), bot + 3, 8, 3);
    px(g, '#9cc56a', 0, bot + 6, RW, GROUND - bot - 6);
    px(g, '#e8d3a6', 0, GROUND - 14, RW, RH - GROUND + 14);   // sand arena
    for (let x = -((scroll) % 16); x < RW; x += 16){ px(g, '#d6bd8a', Math.round(x)+3, GROUND+4, 3, 1); px(g, '#f2e2bd', Math.round(x)+10, GROUND+10, 2, 1); }
    return;
  }
  // hills for training and the race
  const hillBase = mode === 'race' ? trackTop - 2 : GROUND - 28;
  for (let x=0; x<RW; x++){
    const wx = x + scroll*.25;
    const hgt = 22 + Math.round(Math.sin(wx/37)*8 + Math.sin(wx/13)*3);
    px(g, '#8fbf62', x, hillBase - hgt, 1, hgt + 30);
  }
  if (mode === 'race'){
    for (let i=-1; i<8; i++){ const base = Math.floor(scroll*.4/38) + i, x = Math.round(base*38 - scroll*.4); g.drawImage(mapCanvas('tree', TREE_SPR, NATURE_COLORS), x, trackTop - 26 + Math.round(hash(base)*6)); }
    px(g, '#7fb257', 0, trackTop, RW, RH);
    for (let x = -((scroll) % 32); x < RW; x += 32) px(g, '#8cc063', Math.round(x), trackTop, 16, RH);
    for (let x = -((scroll*1) % 24); x < RW; x += 24) px(g, '#f1ebdc', Math.round(x), trackTop - 8, 2, 10);
    px(g, '#f1ebdc', 0, trackTop - 6, RW, 2);
    return;
  }
  for (let x = -((scroll*.5) % 24); x < RW; x += 24) px(g, '#f1ebdc', Math.round(x), GROUND - 30, 2, 14);
  px(g, '#f1ebdc', 0, GROUND - 27, RW, 2); px(g, '#f1ebdc', 0, GROUND - 21, RW, 2);
  px(g, '#9cc56a', 0, GROUND - 16, RW, 16);
  for (let x = -((scroll) % 12); x < RW; x += 12) px(g, '#7fae4f', Math.round(x), GROUND - 12, 1, 2);
  px(g, '#d9b97f', 0, GROUND, RW, RH - GROUND); px(g, '#c9a36b', 0, GROUND, RW, 2);
  for (let x = -((scroll) % 20); x < RW; x += 20){ px(g, '#c49c63', Math.round(x)+3, GROUND+6, 3, 1); px(g, '#e6cb98', Math.round(x)+12, GROUND+12, 2, 1); }
}
export function drawObstacle(g, o, sx, lane){
  if (o.branch){
    const by = GROUND - 34 - o.c.height;
    px(g, '#5a3a22', sx + o.w - 6, 0, 5, by + 3); px(g, '#7a5232', sx + o.w - 5, 0, 2, by + 3);
    g.drawImage(o.c, sx, by);
    return;
  }
  const y = GROUND - o.c.height + 1 + lane;
  if (o.hit && ['fence','tall','oxer','triple'].includes(o.type)){
    // knocked-down poles lying on the ground
    g.drawImage(o.c, 0, 2, o.w, 1, sx, GROUND - 2 + lane, o.w, 1);
    g.drawImage(o.c, 0, 2, o.w, 1, sx + 2, GROUND + lane, o.w, 1);
    g.drawImage(o.c, 0, 0, 3, o.c.height, sx, y, 3, o.c.height);
    g.drawImage(o.c, o.w - 4, 0, 4, o.c.height, sx + o.w - 4, y, 4, o.c.height);
  } else g.drawImage(o.c, sx, y);
}
export function drawFinish(g, sx, topLane){
  if (sx < -10 || sx > RW + 10) return;
  const top = GROUND - 44 + Math.min(0, topLane);
  px(g, '#f6f1e6', sx, top, 2, RH - top); px(g, '#f6f1e6', sx + 22, top, 2, RH - top);
  for (let i=0; i<12; i++) for (let j=0; j<2; j++) px(g, (i + j) % 2 ? '#222' : '#fff', sx + 2 + i*2 - 2, top + j*3, 2, 3);
  for (let y = GROUND - 2 + Math.min(0, topLane); y < RH; y += 4) px(g, '#ffffff', sx + 10, y, 3, 2);
}
export function drawRider(g, look_, shirt, x, y, frame, blink){
  const hc = horseCanvas({...look_, rug: null, frame});
  g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 6, GROUND - 1 + (look_.laneShadow || 0), 22, 2);
  if (blink) return;
  g.drawImage(hc, x, y);
  const kid = shirt ? mapCanvas('kid:ride:' + shirt[0], KID.ride, {...KID_COLORS, r: shirt[0], R: shirt[1], Y: shirt[1], y: shirt[0]}) : mapCanvas('kid:ride', KID.ride, KID_COLORS);
  g.drawImage(kid, x + 5, y - 3 + (frame === 'c' ? 1 : 0));
}
export function drawRide(cv, time){
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const r = ride, mode = r ? r.mode : (state.rideMode || 'training');
  const scroll = r ? r.scroll : (time * .01) % 100000;
  drawBackdrop(g, mode, scroll, time);
  if (mode !== 'trail') drawWeather(g, RW, GROUND - 26, r ? r.t*1000 : time, false);
  const h = r ? r.h : byId(state.rideSel);
  const running = r && r.running && r.ready <= 0;
  const gallop = t => (Math.floor(t * 10) % 2 ? 'b' : 'c');
  // lanes: the race has six riders side by side, everything else has one
  const tall = RH >= 170;
  const rivalLane = tall ? [-60, -48, -36, -24, -12] : [-21, -14, -7, 7, 14];
  const lanes = r && r.mode === 'race' ? [...rivalLane, 0].sort((a, b) => a - b) : [0];
  if (r && r.finishWX) drawFinish(g, Math.round(r.finishWX - r.scroll + RIDE_X + 16), lanes[0]);
  for (const lane of lanes){
    // obstacles stretch across every lane
    if (r) for (const o of r.obstacles){
      const sx = Math.round(o.wx - r.scroll);
      if (sx > RW + 10 || sx + o.w < -10) continue;
      if (o.branch && lane !== 0) continue;
      drawObstacle(g, lane === 0 ? o : {...o, hit:false}, sx, lane);
    }
    if (lane === 0 && r){
      const coin = mapCanvas('jump:coin', JUMP_SPR.coin, JUMP_COLORS);
      const carrot = mapCanvas('crop:carrot2', SPR.carrot, CROP_COLORS);
      const mush = mapCanvas('jump:mushroom', JUMP_SPR.mushroom, JUMP_COLORS);
      for (const it of r.items){
        if (it.got) continue;
        const sx = Math.round(it.wx - r.scroll); if (sx < -10 || sx > RW + 10) continue;
        const bob = it.type === 'mushroom' ? 0 : Math.round(Math.sin(time/150 + it.wx/20));
        g.drawImage(it.type === 'coin' ? coin : it.type === 'mushroom' ? mush : carrot, sx, Math.round(it.y) + bob);
      }
    }
    // rival horses in this lane
    if (r && r.mode === 'race') r.rivals.forEach((rv, i) => {
      if (rivalLane[i] !== lane) return;
      const sx = Math.round(rv.wx - r.scroll);
      if (sx < -40 || sx > RW + 10) return;
      let jy = 0;
      for (const o of r.obstacles){
        const d = (o.wx + o.w/2) - (rv.wx + 16);
        if (Math.abs(d) < 40){ jy = -Math.sin((1 - (d + 40)/80) * Math.PI) * 26; break; }
      }
      const fr = !running ? null : jy < 0 ? 'b' : gallop(r.t + rv.phase);
      drawRider(g, {...rv.look, laneShadow: lane}, rv.shirt, sx, Math.round(GROUND - 23 + lane + jy), fr, false);
    });
    // you
    if (lane === 0 && h){
      const fr = !running ? null : r.y < 0 ? 'b' : gallop(r.t);
      const blink = r && r.hurt > 0 && Math.floor(r.t*12) % 2;
      drawRider(g, look(h), null, RIDE_X, Math.round(GROUND - 23 + (r ? r.y : 0)), fr, blink);
      if (r && r.sprinting && running){ px(g, '#ffffff', RIDE_X - 4, GROUND - 14, 4, 1); px(g, '#ffffff', RIDE_X - 8, GROUND - 10, 5, 1); px(g, '#ffffff', RIDE_X - 3, GROUND - 6, 3, 1); }
    }
  }
  if (r){
    g.font = 'bold 9px "Pixelify Sans", monospace'; g.textAlign = 'center';
    for (const f of r.fx){ g.fillStyle = f.col; g.fillText(f.text, Math.round(f.x + 8), Math.round(f.y)); }
    if (r.ready > 0){
      g.font = 'bold 22px "Pixelify Sans", monospace'; g.fillStyle = '#fff'; g.strokeStyle = '#4f3520'; g.lineWidth = 3;
      const txt = r.ready > .5 ? 'Ready...' : 'GO!';
      g.strokeText(txt, RW/2, GROUND - 62); g.fillText(txt, RW/2, GROUND - 62);
    }
  }
}
export function rideHUD(){
  const el = $('#rideHud'); if (!el) return;
  const r = ride;
  if (!r){ el.innerHTML = ''; return; }
  const me = r.scroll + RIDE_X;
  let parts;
  if (r.mode === 'training') parts = [`${'❤️'.repeat(Math.max(0,r.hearts))}${'🤍'.repeat(Math.max(0, r.maxHearts - r.hearts))}`, `📏 ${Math.floor(r.scroll/PX_M)} m`, `🪙 ${r.coins*2}`, `🥕 ${r.carrots}`, `💪 ${TRAIN_FOCUS[r.focus]}`];
  else if (r.mode === 'trail') parts = [`🌲 ${Math.min(100, Math.floor(me / r.finishWX * 100))}%`, `🍄 ${r.mushrooms}`, `🥕 ${r.carrots}`, `😱 ${r.spooks} spooks`];
  else if (r.mode === 'jumping') parts = [`🏆 Fence ${Math.min(12, r.cleared + r.faults/4 + 1)}/12`, `❌ ${r.faults} faults`, `⏱️ ${Math.max(0, r.t).toFixed(1)}s / ${r.timeAllowed}s`];
  else {
    const pos = r.rivals.filter(rv => rv.wx > me).length + 1;
    const e = Math.round(r.energy / r.maxEnergy * 10);
    parts = [`🏁 ${ordinal(pos)} of 6`, `📏 ${Math.max(0, Math.ceil((r.finishWX - me)/PX_M))} m to go`, `⚡ <span class="ebar">${'▮'.repeat(e)}${'▯'.repeat(10 - e)}</span>`];
  }
  const txt = parts.map(p => `<span>${p}</span>`).join('');
  if (el.dataset.t !== txt){ el.dataset.t = txt; el.innerHTML = txt; }
}

/* ---------- the Riding tab ---------- */
export function trophyShelf(){
  const t = state.trophies || [];
  if (!t.length) return `<div class="panel"><h2>🏆 Trophy shelf</h2><p>No trophies yet. Finish in the top 3 of a competition to win one!</p></div>`;
  return `<div class="panel"><h2>🏆 Trophy shelf</h2><div class="trophies">${t.slice().reverse().map(x =>
    `<div class="trophy"><span class="tbig">${PLACE[x.place-1]}</span><b>${LEVELS[x.lvl].name}</b><span>${RIDE_MODES[x.mode].icon} ${RIDE_MODES[x.mode].name}</span><small>${esc(x.horse)} · Day ${x.day}</small></div>`).join('')}</div></div>`;
}
export function rideView(){
  setRideSize();
  const riders = state.horses.filter(h => !isFoal(h));
  if (!state.rideSel || !byId(state.rideSel) || isFoal(byId(state.rideSel))){
    const first = riders.find(h => !canRide(h)) || riders[0];
    state.rideSel = first ? first.id : null;
  }
  const mode = state.rideMode || 'training', M = RIDE_MODES[mode], lvl = state.rideLevel || 0;
  const unlocked = (state.unlocked || {})[mode] || 0;
  const h = byId(state.rideSel), why = canRide(h);
  if (ride){
    return `<div class="panel scene-wrap">
      <div class="ridehud" id="rideHud"></div>
      <canvas id="ride" width="${rideVW()}" height="${RH}"></canvas>
      <div class="scene-ui ridectl">
        ${ride.mode === 'race' ? `<button class="gold actbtn sprint" id="sprintBtn" style="width:auto;padding:0 24px;border-radius:32px">⚡ Sprint</button>` : ''}
        <button class="danger" data-act="quitRide">${ride.comp ? 'Give up' : 'Stop'}</button>
        <button class="primary actbtn bigjump" data-act="jump" style="width:auto;padding:0 28px;border-radius:32px">⤴ Jump</button>
      </div>
      <div class="keys">Jump: <kbd>Space</kbd> <kbd>↑</kbd> <kbd>W</kbd> or tap the picture${ride.mode === 'race' ? ' · Sprint: hold <kbd>→</kbd> <kbd>D</kbd> or <kbd>Shift</kbd>' : ''}${ride.mode === 'trail' ? " · Don't jump under low branches!" : ''}</div>
    </div>`;
  }
  let options = '';
  if (mode === 'training'){
    options = `<div class="optrow"><b>Train:</b> ${Object.entries(TRAIN_FOCUS).map(([k, l]) =>
      `<button class="${(state.trainFocus||'speed')===k?'on':''}" data-act="trainFocus" data-arg="${k}">${l}</button>`).join('')}</div>
      <p class="center" style="font-size:13px">+1 to that stat for every 100 m you ride (up to +5 per ride).</p>`;
  } else if (M.comp){
    const L = LEVELS[lvl];
    const [chance, cls] = h ? chanceLabel(h, lvl) : ['', ''];
    options = `<div class="optrow"><b>Level:</b> ${LEVELS.map((x, i) =>
      `<button class="${i===lvl?'on':''}" data-act="rideLevel" data-arg="${i}" ${i > unlocked ? 'disabled title="Finish top 3 in the level before to unlock"' : ''}>${i > unlocked ? '🔒 ' : ''}${x.name}</button>`).join('')}</div>
      <div class="compinfo">
        <span>🎟️ Entry: <b>${L.fee} 🪙</b></span>
        <span>🏅 Prizes: 🥇 ${L.prizes[0]} · 🥈 ${L.prizes[1]} · 🥉 ${L.prizes[2]}</span>
        <span>🤺 Rivals' rating: ${L.ai[0]}–${L.ai[1]}</span>
        ${h ? `<span class="chance ${cls}">Your horse: ${horseRating(h)} → ${chance}</span>` : ''}
      </div>
      <p class="center" style="font-size:13px">Each horse can enter one competition per day. Top 3 unlocks the next level.</p>`;
  }
  return `<div class="panel"><h2>🏇 Riding</h2>
      <div class="modes">${Object.entries(RIDE_MODES).map(([k, x]) =>
        `<button class="modecard ${k===mode?'on':''}" data-act="rideMode" data-arg="${k}"><span class="micon">${x.icon}</span><b>${x.name}</b>${x.comp ? '<small>Competition</small>' : '<small>Practice</small>'}</button>`).join('')}</div>
      <p>${M.desc}</p>${options}</div>
    <div class="panel scene-wrap">
      <canvas id="ride" width="${rideVW()}" height="${RH}"></canvas>
      <div class="scene-ui">
        <button class="primary" data-act="startRide" ${why ? 'disabled' : ''} style="font-size:18px;padding:10px 22px">${M.icon} ${M.comp ? 'Enter' : 'Start'}${h ? ' with ' + esc(h.name) : ''}${M.comp ? ` (${LEVELS[lvl].fee}🪙)` : ''}</button>
        <span class="hint">${why ? '⚠️ ' + why + (why === 'Needs a saddle' ? ' (buy one at the 🏷️ Market, then put it on from the horse card)' : '') : 'Ready to go!'}</span>
      </div>
    </div>
    <h3>Choose a horse</h3>${riders.length ? `<div class="mini">${riders.map(x => {
      const w = canRide(x);
      return `<div class="mcard ${x.id===state.rideSel?'sel':''}" data-act="rideSel" data-id="${x.id}">
        ${horseImg(look(x), 3)}<span class="nm">${esc(x.name)}</span>
        <span style="font-size:12px;color:var(--muted)">⚡${x.speed} ❤️${x.stamina} 🕊️${x.temper} · ⭐ ${horseRating(x)}</span>
        <span class="rd ${w?'':'ok'}">${w || 'Ready ✓'}</span></div>`;
    }).join('')}</div>` : '<p class="empty">No grown-up horses yet!</p>'}
    ${trophyShelf()}`;
}

