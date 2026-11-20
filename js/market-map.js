// Inside the Market Hall: walk up to a stall and press E to shop there.
//
//   rows 0-1  back wall with bunting
//   rows 2-3  five stalls: horse dealer, saddlery, rugs, decor, bundles
//   rows 4-7  the aisle (door on the left, rows 5-6)
//   rows 8-9  produce stand and apothecary
import { CROP_COLORS, KID, KID_COLORS, SPR } from './sprite-data.js';
import { mulberry } from './util.js';
import { horseCanvas, itemCanvas, mapCanvas, saddleCanvas } from './sprites.js';
import { RUG_COLORS } from './data.js';
import { look, state } from './state.js';
import { showModal, toast } from './ui.js';
import { STALLS, stallHTML, stock } from './shop.js';
import { COLS, ROWS, TILE, bfs, facing, goTo, pl, walkAndUse } from './world.js';
import { drawHighlight, drawOverlays, farmerThing, ledThing, px } from './world-draw.js';

export const TOP_STALLS = [['horses', 1], ['tack', 4], ['rugs', 7], ['decor', 10], ['bundles', 13]];   // [stall, left x]
export const BOTTOM_STALLS = [['produce', 4], ['potions', 10]];
export const DOOR_ROWS = [5, 6];
const AISLE_TOP = 4, AISLE_BOT = 7;

/** Which stall is at this tile (or null). */
export function stallAt(x, y){
  const row = (y === 2 || y === 3) ? TOP_STALLS : (y === 8 || y === 9) ? BOTTOM_STALLS : null;
  if (!row) return null;
  const s = row.find(([, sx]) => x === sx || x === sx + 1);
  return s ? s[0] : null;
}
export const walk = (x, y) => x >= 0 && x < COLS && y >= AISLE_TOP && y <= AISLE_BOT;
export function door(nx, ny){
  if (nx < 0 && DOOR_ROWS.includes(ny)){ goTo('village', 3, 5, 'down'); return true; }
  return false;
}
export function openStall(id){
  showModal(stallHTML(id), () => document.getElementById('mbox').classList.add('menu'), () => stallHTML(id));
}
export function interact(fx, fy){
  if (door(fx, fy)) return;
  const s = stallAt(fx, fy);
  if (s) return openStall(s);
  toast('Walk up to a stall and press E to see what it sells today!');
}
export function hint(fx, fy){
  if (fx < 0 && DOOR_ROWS.includes(fy)) return '← Back to the village';
  const s = stallAt(fx, fy);
  if (s) return `Press E: ${STALLS[s].icon} ${STALLS[s].name}`;
  return '🏷️ Market Hall: new stock and prices every morning!';
}
export function click(tx, ty){
  const P = state.player;
  if (tx === 0 && DOOR_ROWS.includes(ty)) return walkAndUse([[0, ty, 'left']]);
  const s = stallAt(tx, ty);
  if (s){
    const top = ty <= 3, sx = (top ? TOP_STALLS : BOTTOM_STALLS).find(([id]) => id === s)[1];
    const gy = top ? AISLE_TOP : AISLE_BOT, dir = top ? 'up' : 'down';
    return walkAndUse([[sx, gy, dir], [sx + 1, gy, dir]]);
  }
  if (walk(tx, ty)){ pl.path = bfs(P.x, P.y, (x, y) => x === tx && y === ty) || []; pl.after = null; }
}

/* ---------- drawing ---------- */
let bg = null;
const POTION = ["..cc..", "..ww..", ".pppp.", "pPpppp", "pppppp", ".pppp."];
function buildHall(){
  const c = document.createElement('canvas'); c.width = COLS * TILE; c.height = ROWS * TILE;
  const g = c.getContext('2d'), rng = mulberry(5);
  // back wall with bunting
  px(g, '#e8d3a6', 0, 0, c.width, 2 * TILE); for (let x = 0; x < c.width; x += 6) px(g, '#d6bd8a', x, 0, 1, 2 * TILE);
  px(g, '#8b5a2b', 0, 2 * TILE - 2, c.width, 2);
  for (let x = 0; x < c.width; x += 10) px(g, ['#d0533f', '#4a7fc0', '#e0ad30', '#5f9a3e', '#8a5cb8'][(x / 10) % 5], x + 2, 3, 5, 5 - ((x / 10) % 2));
  px(g, '#6a4424', 0, 2, c.width, 1);
  // stone floor
  for (let y = 2 * TILE; y < c.height; y += 8) for (let x = 0; x < c.width; x += 8)
    px(g, ((x + y) / 8) % 2 ? '#cbbfa8' : '#c2b59c', x, y, 8, 8);
  for (let i = 0; i < 60; i++) px(g, '#b3a68c', Math.floor(rng() * c.width), 2 * TILE + Math.floor(rng() * 9 * TILE), 2, 1);
  // front wall and the open door on the left (sunlight)
  px(g, '#e8d3a6', 0, 10 * TILE, c.width, TILE); px(g, '#8b5a2b', 0, 10 * TILE, c.width, 2);
  for (let x = 0; x < 14; x++){ g.fillStyle = `rgba(255,236,170,${.55 - x * .04})`; g.fillRect(x, DOOR_ROWS[0] * TILE, 1, 32); }
  px(g, '#c8b49a', 0, DOOR_ROWS[0] * TILE + 2, 3, 28);
  return c;
}
function drawStall(g, id, sx, top, time){
  const S = STALLS[id], X = sx * TILE, Y = (top ? 2 : 8) * TILE;
  const [a, b] = S.awning;
  // shopkeeper behind the counter (top stalls) or in front of their table (bottom)
  const keeper = mapCanvas('keeper:' + id, KID.down[0], {...KID_COLORS, r: a, R: a, y: b, Y: a});
  if (top) g.drawImage(keeper, X + 9, Y - 2 + (Math.floor(time / 700 + sx) % 2 ? 0 : 1));
  // counter
  const CY = top ? Y + 18 : Y + 4;
  px(g, '#6a4424', X, CY, 32, 12); px(g, '#9a6a3a', X + 1, CY + 1, 30, 3); px(g, '#8b5a2b', X + 1, CY + 5, 30, 6);
  // striped awning
  const AY = top ? Y - 6 : Y - 4;
  for (let i = 0; i < 8; i++) px(g, i % 2 ? b : a, X + i * 4, AY, 4, 6);
  for (let i = 0; i < 8; i++) px(g, i % 2 ? b : a, X + i * 4 + 1, AY + 6, 2, 2);
  px(g, '#6a4424', X, AY - 1, 32, 1);
  if (!top) g.drawImage(keeper, X + 9, Y + 15);
  // what's for sale today, on the counter
  const on = (cv, dx, dy = 0) => g.drawImage(cv, X + dx, CY - cv.height + 4 + dy);
  const list = stock(id);
  if (id === 'horses' && state.market[0]){ const h = horseCanvas({...look(state.market[0]), foal: true}); g.drawImage(h, X + 3, CY - 20, 26, 24); }
  if (id === 'tack') list.slice(0, 2).forEach((t, i) => on(saddleCanvas(t), i * 14));
  if (id === 'rugs') list.forEach(([k, c], i) => { const R = RUG_COLORS[k][c]; px(g, R.trim, X + 2 + i * 10, CY - 6, 9, 8); px(g, R.main, X + 3 + i * 10, CY - 5, 7, 6); });
  if (id === 'decor') list.slice(0, 2).forEach((t, i) => on(itemCanvas(t), i * 15));
  if (id === 'bundles') for (let i = 0; i < 2; i++){ px(g, ['#d0533f', '#4a7fc0'][i], X + 4 + i * 13, CY - 8, 10, 9); px(g, '#f2c94c', X + 8 + i * 13, CY - 8, 2, 9); px(g, '#f2c94c', X + 4 + i * 13, CY - 5, 10, 2); }
  if (id === 'produce') ['hay', 'carrot', 'oats'].forEach((k, i) => on(mapCanvas('crop14:' + k, SPR[k], CROP_COLORS), i * 10 - 1, -2));
  if (id === 'potions') for (let i = 0; i < 3; i++) on(mapCanvas('potion' + i, POTION, {c: '#8b5a2b', w: '#e8f4ff', p: ['#e8608a', '#8a5cb8', '#5fa7d6'][i], P: '#ffffff'}), 3 + i * 9, -2);
}
export function draw(g, time){
  if (!bg) bg = buildHall();
  g.drawImage(bg, 0, 0);
  for (const [id, sx] of TOP_STALLS) drawStall(g, id, sx, true, time);
  for (const [id, sx] of BOTTOM_STALLS) drawStall(g, id, sx, false, time);
  const [fx, fy] = facing(), s = stallAt(fx, fy);
  if (s && !pl.moving && Math.floor(time / 400) % 2){
    const top = fy <= 3, sx = (top ? TOP_STALLS : BOTTOM_STALLS).find(([id]) => id === s)[1];
    drawHighlight(g, sx * TILE, (top ? 2 : 8) * TILE, 2 * TILE, 2 * TILE);
  }
  const things = [farmerThing(g)];
  const lt = ledThing(g, time); if (lt) things.push(lt);
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
  drawOverlays(g);
}
