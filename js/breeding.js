// The Heart Barn: lead a mare and a stallion into the two pens, then use a love potion
// at the love table. A curtain closes, hearts float up, a big heart grows… and maybe a foal is on the way.
// Success depends on how much the two horses like each other (see affinity.js).
//
//   rows 1-3  pen A (x 2-5) · love table (x 7-8, row 3) · pen B (x 10-13)
//   rows 4-9  floor where you walk; door on the left (rows 6-7)
import { BUBBLE, BUBBLE_COLORS } from './sprite-data.js';
import { clamp, esc, now, pick, randi } from './util.js';
import { horseCanvas, horseImg, mapCanvas } from './sprites.js';
import { fullName, inherit, odds, phen } from './genetics.js';
import { DNA_COST, T } from './data.js';
import { byId, isFoal, look, readiness, state } from './state.js';
import { addBond, breedChance, getBond, heartsFor, natureMatch } from './affinity.js';
import { closeModal, showModal, toast } from './ui.js';
import { render } from './views.js';
import { COLS, ROWS, TILE, bfs, facing, goTo, pl, resetLeadPos, walkAndUse } from './world.js';
import { drawHighlight, drawOverlays, farmerThing, ledThing, px } from './world-draw.js';
import { save } from './game.js';

export const PENS = {A: {x0: 2, x1: 5}, B: {x0: 10, x1: 13}};
export const TABLE = [[7, 3], [8, 3]];
export const DOOR_ROWS = [6, 7];
const FLOOR_TOP = 4, FLOOR_BOT = 9;
export const CEREMONY_TIME = 6;          // seconds until the result
export const penAt = (x, y) => y >= 1 && y <= 3 ? Object.keys(PENS).find(p => x >= PENS[p].x0 && x <= PENS[p].x1) || null : null;
export const penHorse = p => state.horses.find(h => h.pen === p) || null;
const isTable = (x, y) => TABLE.some(([a, b]) => a === x && b === y);
const pronoun = h => h.sex === 'F' ? 'her' : 'him';

export const walk = (x, y) => x >= 0 && x < COLS && y >= FLOOR_TOP && y <= FLOOR_BOT;
export function door(nx, ny){
  if (nx < 0 && DOOR_ROWS.includes(ny)){ goTo('village', 12, 5, 'down'); return true; }
  return false;
}

/* ---------- the pair in the pens ---------- */
export function pair(){
  const a = penHorse('A'), b = penHorse('B');
  if (!a || !b) return {a, b, mare: null, stallion: null};
  const mare = [a, b].find(h => h.sex === 'F') || null, stallion = [a, b].find(h => h.sex === 'M') || null;
  return {a, b, mare, stallion};
}
/** Why the potion can't be used right now (or null if it can). */
export function whyNot(){
  const {a, b, mare, stallion} = pair();
  if (ceremony) return 'The magic is already happening!';
  if (!a || !b) return 'Lead a mare and a stallion into the two pens first';
  if (!mare || !stallion) return 'You need one mare ♀ and one stallion ♂';
  for (const h of [mare, stallion]){ const r = readiness(h); if (r) return `${h.name}: ${r}`; }
  if (!(state.inv.potion > 0)) return 'You need a love potion 🧪 (Apothecary at the market)';
  return null;
}

/** Make the mare pregnant with a foal from these two parents. */
export function makePregnancy(m, s){
  const stat = (a, b) => clamp(Math.round((a + b) / 2 + randi(-6, 10)), 1, 100);
  m.preg = {due: now() + T.pregnancy * 1000, sire: s.name, warned: false, foal: {
    genes: inherit(m, s), sex: pick(['F', 'M']),
    speed: stat(m.speed, s.speed), stamina: stat(m.stamina, s.stamina), temper: stat(m.temper, s.temper),
    face: pick([m.face, s.face, pick(['none', 'star', 'blaze'])]),
    socks: clamp(pick([m.socks, s.socks]) + randi(-1, 1), 0, 4),
  }};
  s.restUntil = now() + T.rest * 1000;
}

/* ---------- the ceremony (not saved: it only lasts a few seconds) ---------- */
export let ceremony = null;
export function startCeremony(){
  const why = whyNot(); if (why) return toast(why);
  const {mare, stallion} = pair();
  state.inv.potion--;
  ceremony = {t: 0, mare: mare.id, stallion: stallion.id, success: Math.random() < breedChance(mare, stallion), resolved: false};
  closeModal(); save(); render();
}
export function updateCeremony(dt){
  if (!ceremony) return;
  ceremony.t += dt;
  if (!ceremony.resolved && ceremony.t >= CEREMONY_TIME){ ceremony.resolved = true; resolveCeremony(); }
  if (ceremony && ceremony.t >= CEREMONY_TIME + 2) ceremony = null;      // curtain opens again
}
function resolveCeremony(){
  const m = byId(ceremony.mare), s = byId(ceremony.stallion);
  if (!m || !s){ ceremony = null; return; }
  if (ceremony.success){
    makePregnancy(m, s); addBond(m, s, 10);
    showModal(`<div class="mpic bigheart">💞</div><h2>Magic! It worked!</h2>
      <p><b>${esc(m.name)}</b> and <b>${esc(s.name)}</b> are going to have a foal! It will be born in ${T.pregnancy} seconds.</p>
      <p class="sd">Lead them back to the barn so the foal is born at home.</p><button class="primary" data-act="closeModal">Hooray!</button>`);
  } else {
    addBond(m, s, 5);
    showModal(`<div class="mpic bigheart">💔</div><h2>No spark this time…</h2>
      <p><b>${esc(m.name)}</b> and <b>${esc(s.name)}</b> need to like each other more. They got a little closer, though!</p>
      <p class="sd">Horses become friends by grazing in the paddock together or living in stalls next to each other.</p>
      <button class="primary" data-act="closeModal">OK</button>`);
  }
  save(); render();
}
export const blocked = () => !!ceremony;

/* ---------- the love table popup ---------- */
export function tableHTML(){
  const {a, b, mare, stallion} = pair();
  const slot = (h, label) => h ? `<div class="slot full">${horseImg(look(h), 3)}<b>${esc(h.name)} <span class="sex ${h.sex}">${h.sex === 'F' ? '♀' : '♂'}</span></b><small>${fullName(phen(h.genes))}</small></div>`
                               : `<div class="slot">${label}</div>`;
  let info = '';
  if (mare && stallion){
    const bond = getBond(mare, stallion), chance = Math.round(breedChance(mare, stallion) * 100);
    info = `<div class="lovebox">
      <span>💞 Friendship: <b>${heartsFor(bond)}</b> ${Math.round(bond)}/100</span>
      <span>🌸 Nature match: <b>${natureMatch(mare, stallion)}</b>/40</span>
      <span class="chancebig">✨ Chance of a foal: <b>${chance}%</b></span></div>`;
    if (mare.tested && stallion.tested){
      info += `<h3 class="center">Possible foals</h3><div class="odds">${odds(mare, stallion).map(([n, o]) => {
        const isNew = !state.found[o.ph.color] || (o.ph.pinto && !state.found.Pinto) || (o.ph.appy && !state.found.Appaloosa);
        const pc = o.p * 100;
        return `<div class="odd">${horseImg({...o.ph, face: 'none', socks: 0, seed: 3}, 1.25)} ${n} ${isNew ? '<span class="new">NEW!</span>' : ''}<span class="p">${pc < 1 ? '<1' : Math.round(pc)}%</span></div>`;
      }).join('')}</div>`;
    } else info += `<p class="center sd">🧬 DNA-test both horses (from their cards, ${state.dnaFree ? 'free' : DNA_COST + '🪙'}) to see which colors their foal could have.</p>`;
  }
  const why = whyNot();
  return `<button class="closex" data-act="closeModal">✕</button><h2>💞 The love table</h2>
    <div class="pair">${slot(a, 'Pen A is empty')}<span class="heart">💗</span>${slot(b, 'Pen B is empty')}</div>
    ${info}
    <p class="center">🧪 Love potions: <b>${state.inv.potion || 0}</b></p>
    <p class="center"><button class="primary" data-act="usePotion" ${why ? 'disabled' : ''}>🧪 Use a love potion</button></p>
    ${why ? `<p class="center sd">⚠️ ${why}</p>` : ''}`;
}
export function openTable(){
  showModal(tableHTML(), () => document.getElementById('mbox').classList.add('menu'), tableHTML);
}

/* ---------- walking around inside ---------- */
export function interact(fx, fy, led){
  if (ceremony) return;
  if (door(fx, fy)) return;
  if (isTable(fx, fy)) return openTable();
  const p = penAt(fx, fy);
  if (!p) return toast('Lead horses into the pens, then press E at the love table!');
  const inPen = penHorse(p), P = state.player;
  if (led){
    if (inPen) return toast(`${inPen.name} is already in this pen.`);
    if (isFoal(led)) return toast(`${led.name} is too young for the Heart Barn.`);
    led.pen = p; P.leading = null;
    toast(`💕 ${led.name} is waiting in the pen.`, 'good');
    save(); render(); return;
  }
  if (inPen){
    delete inPen.pen; P.leading = inPen.id; resetLeadPos();
    toast(`🐴 ${inPen.name} is following you again.`);
    save(); render(); return;
  }
  toast('This pen is empty. Lead a horse here and press E.');
}
export function hint(fx, fy, led){
  if (ceremony) return ceremony.t < CEREMONY_TIME ? '✨ Shh… the magic is happening…' : '💞';
  if (fx < 0 && DOOR_ROWS.includes(fy)) return '← Back to the village';
  if (isTable(fx, fy)) return 'Press E at the love table 🧪💞';
  const p = penAt(fx, fy);
  if (p){
    const h = penHorse(p);
    if (h) return led ? `${h.name} is in this pen` : `Press E to lead ${h.name} out`;
    return led ? `Press E to put ${led.name} in this pen 💕` : 'An empty pen';
  }
  const {a, b} = pair();
  if (a && b) return 'Both pens are full. Go to the love table 🧪';
  return led ? `Put ${led.name} in a pen (walk up and press E)` : '💞 Heart Barn: bring a mare and a stallion here';
}
export function click(tx, ty){
  const P = state.player;
  if (tx === 0 && DOOR_ROWS.includes(ty)) return walkAndUse([[0, ty, 'left']]);
  if (isTable(tx, ty) || (ty < FLOOR_TOP && (tx === 7 || tx === 8))) return walkAndUse(TABLE.map(([x]) => [x, FLOOR_TOP, 'up']));
  const p = penAt(tx, ty) || (ty === 0 ? penAt(tx, 1) : null);
  if (p){ const r = []; for (let x = PENS[p].x0; x <= PENS[p].x1; x++) r.push([x, FLOOR_TOP, 'up']); return walkAndUse(r); }
  if (walk(tx, ty)){ pl.path = bfs(P.x, P.y, (x, y) => x === tx && y === ty) || []; pl.after = null; }
}

/* ---------- drawing ---------- */
let bg = null;
function buildHeartBarn(){
  const c = document.createElement('canvas'); c.width = COLS * TILE; c.height = ROWS * TILE;
  const g = c.getContext('2d');
  px(g, '#f3c6d3', 0, 0, c.width, 4 * TILE);                     // pink back wall
  for (let x = 0; x < c.width; x += 6) px(g, '#e9b3c3', x, 0, 1, 4 * TILE);
  for (let x = 4; x < c.width; x += 24){ px(g, '#e8608a', x, 5, 3, 2); px(g, '#e8608a', x + 4, 5, 3, 2); px(g, '#e8608a', x + 1, 7, 5, 2); px(g, '#e8608a', x + 2, 9, 3, 1); }
  for (let y = 4 * TILE; y < c.height; y++) for (let x = 0; x < c.width; x += 16)
    px(g, y % 8 === 0 ? '#c49a6c' : (Math.floor((y - 4 * TILE) / 8) % 2 ? '#d8b183' : '#d1a878'), x, y, 16, 1);
  for (const p of Object.values(PENS)){                          // straw pens with a low fence
    const X = p.x0 * TILE, W = (p.x1 - p.x0 + 1) * TILE;
    px(g, '#e3c76f', X, TILE, W, 3 * TILE);
    for (let i = 0; i < 40; i++) px(g, i % 2 ? '#c9a94e' : '#efd98c', X + (i * 37) % W, TILE + (i * 23) % (3 * TILE), 2, 1);
    px(g, '#8b5a2b', X, 4 * TILE - 6, W, 2); px(g, '#8b5a2b', X, 4 * TILE - 2, W, 2);
    for (let x = X; x <= X + W - 2; x += 10) px(g, '#6a4424', x, 4 * TILE - 8, 2, 8);
  }
  // love table with a lace cloth
  const TX = 7 * TILE, TY = 3 * TILE;
  px(g, '#6a4424', TX + 3, TY + 8, 2, 8); px(g, '#6a4424', TX + 27, TY + 8, 2, 8);
  px(g, '#ffffff', TX, TY + 2, 32, 8); for (let x = TX; x < TX + 32; x += 3) px(g, '#f3c6d3', x, TY + 9, 2, 2);
  // curtain rail and tied-back curtains
  px(g, '#b98d2c', TILE, 2, 14 * TILE, 3);
  px(g, '#a8243a', TILE, 4, 10, 4 * TILE - 10); px(g, '#a8243a', 15 * TILE - 10, 4, 10, 4 * TILE - 10);
  // front wall and door
  px(g, '#f3c6d3', 0, 10 * TILE, c.width, TILE); px(g, '#b4537a', 0, 10 * TILE, c.width, 2);
  for (let x = 0; x < 14; x++){ g.fillStyle = `rgba(255,236,170,${.55 - x * .04})`; g.fillRect(x, DOOR_ROWS[0] * TILE, 1, 32); }
  return c;
}
const POTION = ["..cc..", "..ww..", ".pppp.", "pPpppp", "pppppp", ".pppp."];
function drawCurtain(g, k){          // k: 0 open … 1 closed
  if (k <= 0) return;
  const half = 7 * TILE * k;
  for (const [x0, dir] of [[TILE, 1], [15 * TILE, -1]]){
    const x = dir > 0 ? x0 : x0 - half;
    px(g, '#a8243a', x, 5, half, 4 * TILE - 5);
    for (let i = 0; i < half; i += 6) px(g, '#8a1c2f', x + i, 5, 2, 4 * TILE - 5);
    px(g, '#e0ad30', x, 4 * TILE - 3, half, 2);
  }
}
function bigHeart(g, cx, cy, s, col){
  const rows = [[1,0,3],[6,0,3],[0,1,10],[0,2,10],[0,3,10],[1,4,8],[2,5,6],[3,6,4],[4,7,2]];
  for (const [x, y, w] of rows) px(g, col, Math.round(cx + (x - 5) * s), Math.round(cy + (y - 4) * s), Math.ceil(w * s), Math.ceil(s));
}
export function draw(g, time){
  if (!bg) bg = buildHeartBarn();
  g.drawImage(bg, 0, 0);
  g.drawImage(mapCanvas('potion-table', POTION, {c: '#8b5a2b', w: '#e8f4ff', p: '#e8608a', P: '#ffffff'}), 7 * TILE + 12, 3 * TILE - 4);
  // horses waiting in the pens
  for (const p of Object.keys(PENS)){
    const h = penHorse(p); if (!h) continue;
    const c = horseCanvas(look(h)), X = (PENS[p].x0 + 1) * TILE + (p === 'B' ? 0 : 4);
    const flip = p === 'B';
    const bob = Math.floor(time / 600 + (p === 'A' ? 0 : 1)) % 2 ? -1 : 0;
    if (flip){ g.save(); g.translate(X + c.width, 2 * TILE + 2 + bob); g.scale(-1, 1); g.drawImage(c, 0, 0); g.restore(); }
    else g.drawImage(c, X, 2 * TILE + 2 + bob);
  }
  const {mare, stallion} = pair();
  if (mare && stallion && !ceremony && getBond(mare, stallion) >= 40 && Math.floor(time / 500) % 3)
    g.drawImage(mapCanvas('bubble:heart', BUBBLE.heart, BUBBLE_COLORS), 7 * TILE + 12, TILE);
  // the ceremony
  if (ceremony){
    const t = ceremony.t;
    const k = t < 1 ? t : t > CEREMONY_TIME + 1 ? Math.max(0, CEREMONY_TIME + 2 - t) : 1;
    drawCurtain(g, k);
    if (t > 1 && t < CEREMONY_TIME){                                   // little hearts float up
      for (let i = 0; i < 10; i++){
        const ph = (t * .6 + i / 10) % 1, x = 2 * TILE + ((i * 53) % (12 * TILE)) + Math.sin(t * 3 + i) * 4;
        bigHeart(g, x, 4 * TILE - ph * 4 * TILE, 1, ph < .8 ? '#ff8fb3' : '#ffd1e0');
      }
      for (let i = 0; i < 12; i++) if (Math.floor(time / 120 + i) % 3 === 0) px(g, '#fff6a8', 2 * TILE + (i * 71) % (12 * TILE), 6 + (i * 37) % (3 * TILE), 1, 1);
    }
    if (t > 3.5){                                                       // the big heart: things are getting ready
      const grow = Math.min(1, (t - 3.5) / 2.5), pulse = 1 + Math.sin(time / 120) * .06;
      const ok = !ceremony.resolved || ceremony.success;
      bigHeart(g, 8 * TILE, 2 * TILE + 4, 3.2 * grow * pulse, ok ? '#e8306a' : '#9a8a90');
      if (ceremony.resolved && ceremony.success) for (let i = 0; i < 16; i++){
        const a = i / 16 * Math.PI * 2, r = (t - CEREMONY_TIME) * 60;
        bigHeart(g, 8 * TILE + Math.cos(a) * r, 2 * TILE + 4 + Math.sin(a) * r * .6, .8, '#ff8fb3');
      }
    }
  }
  const [fx, fy] = facing();
  if (!ceremony && !pl.moving && Math.floor(time / 400) % 2){
    const p = penAt(fx, fy);
    if (p) drawHighlight(g, PENS[p].x0 * TILE, TILE, (PENS[p].x1 - PENS[p].x0 + 1) * TILE, 3 * TILE);
    else if (isTable(fx, fy)) drawHighlight(g, 7 * TILE, 3 * TILE, 2 * TILE, TILE);
  }
  const things = [farmerThing(g)];
  const lt = ledThing(g, time); if (lt) things.push(lt);
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
  drawOverlays(g);
}
