// The village, south of the fields: Market Hall, Heart Barn (breeding) and the Riding Arena.
//
//   rows 1-4   Market Hall (left, door at 3,4)      Heart Barn (right, door at 12,4)
//   rows 0-6   the road from the farm (x 8-9), and a path along row 5 to both doors
//   rows 7-10  the Riding Arena behind a white fence, gate at (8,7)-(9,7)
import { mulberry } from './util.js';
import { mapCanvas } from './sprites.js';
import { state } from './state.js';
import { toast } from './ui.js';
import { COLS, ROWS, TILE, bfs, facing, goTo, has2, pl, walkAndUse } from './world.js';
import { NATURE_COLORS, TREE_SPR, drawHighlight, drawOverlays, farmerThing, ledThing, px } from './world-draw.js';
import { openRidingMenu } from './riding.js';

export const MARKET_BLD = {x0: 0, y0: 1, x1: 6, y1: 4}, MARKET_DOOR = [3, 4];
export const HEART_BLD = {x0: 10, y0: 1, x1: 15, y1: 4}, HEART_DOOR = [12, 4];
export const ARENA = {x0: 1, y0: 7, x1: 14, y1: 10};
export const ARENA_GATE = [[8, 7], [9, 7]];
export const ROAD_X = [8, 9];
export const V_TREES = [[0, 0], [15, 0], [0, 6], [15, 6]];
export const LAMPS = [[6, 6], [11, 6]];
const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const at = ([a, b], x, y) => a === x && b === y;

export function walk(x, y){
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  if (inRect(MARKET_BLD, x, y) || inRect(HEART_BLD, x, y) || inRect(ARENA, x, y)) return false;
  return !has2(V_TREES, x, y) && !has2(LAMPS, x, y);
}
/** Stepping into a door or off the map. Returns true if we went somewhere. */
export function door(nx, ny){
  if (ny < 0 && ROAD_X.includes(nx)){ goTo('farm', nx, ROWS - 1, 'up'); return true; }
  if (at(MARKET_DOOR, nx, ny)){ goTo('market', 0, 5, 'right'); return true; }
  if (at(HEART_DOOR, nx, ny)){ goTo('heart', 0, 6, 'right'); return true; }
  return false;
}
export function interact(fx, fy, led){
  if (door(fx, fy)) return;
  if (has2(ARENA_GATE, fx, fy)) return openRidingMenu(led);
  toast('Walk to a door, or bring a saddled horse to the arena gate!');
}
export function hint(fx, fy, led){
  if (fy < 0 && ROAD_X.includes(fx)) return '↑ Back to the farm';
  if (at(MARKET_DOOR, fx, fy)) return 'Press E to enter the Market Hall 🏷️';
  if (at(HEART_DOOR, fx, fy)) return 'Press E to enter the Heart Barn 💞';
  if (has2(ARENA_GATE, fx, fy)) return led ? `Press E to ride ${led.name} in the arena 🏇` : '🏇 Riding arena: lead a saddled horse here to ride';
  return led ? `${led.name} is with you. The arena gate is at the bottom 🏇` : 'The village: 🏷️ market, 💞 heart barn and 🏇 riding arena';
}
export function click(tx, ty){
  const P = state.player;
  if (inRect(MARKET_BLD, tx, ty)) return walkAndUse([[MARKET_DOOR[0], MARKET_DOOR[1] + 1, 'up']]);
  if (inRect(HEART_BLD, tx, ty)) return walkAndUse([[HEART_DOOR[0], HEART_DOOR[1] + 1, 'up']]);
  if (inRect(ARENA, tx, ty)) return walkAndUse(ARENA_GATE.map(([x, y]) => [x, y - 1, 'down']));
  if (ty === 0 && ROAD_X.includes(tx)) return walkAndUse([[tx, 0, 'up']]);
  if (walk(tx, ty)){ pl.path = bfs(P.x, P.y, (x, y) => x === tx && y === ty) || []; pl.after = null; }
}

/* ---------- drawing ---------- */
let bg = null;
function building(g, r, wall, wallDark, roof, roofDark){
  const X = r.x0 * TILE, Y = r.y0 * TILE, W = (r.x1 - r.x0 + 1) * TILE, H = (r.y1 - r.y0 + 1) * TILE;
  px(g, 'rgba(0,0,0,.15)', X + 3, Y + H, W - 3, 3);
  px(g, wall, X, Y + 12, W, H - 12);
  for (let x = X + 3; x < X + W; x += 5) px(g, wallDark, x, Y + 14, 1, H - 14);
  px(g, roof, X - 1, Y, W + 2, 14);
  for (let y = Y + 2; y < Y + 14; y += 4) px(g, roofDark, X - 1, y, W + 2, 1);
  px(g, '#f3ece0', X, Y + 12, W, 2);
}
function doorAt(g, [dx, dy], trim){
  const X = dx * TILE, Y = dy * TILE;
  px(g, trim, X - 1, Y + 1, 18, 15); px(g, '#3a2618', X + 2, Y + 3, 12, 13);
  px(g, '#c9a94e', X + 2, Y + 13, 12, 3);
}
function buildVillage(){
  const c = document.createElement('canvas'); c.width = COLS * TILE; c.height = ROWS * TILE;
  const g = c.getContext('2d'), rng = mulberry(21);
  px(g, '#8cc063', 0, 0, c.width, c.height);
  for (let i = 0; i < 450; i++) px(g, rng() < .5 ? '#7fb257' : '#9ccc70', Math.floor(rng() * c.width), Math.floor(rng() * c.height), 1, 2);
  for (let i = 0; i < 30; i++) px(g, ['#ffffff', '#f5d76e', '#ef8fb3'][i % 3], Math.floor(rng() * c.width), Math.floor(rng() * c.height), 1, 1);
  // cobbled road and path
  const cobble = (x, y) => { px(g, '#c8b49a', x * TILE, y * TILE, 16, 16); for (let k = 0; k < 6; k++) px(g, '#b09a7e', x * TILE + Math.floor(rng() * 14), y * TILE + Math.floor(rng() * 14), 3, 2); };
  for (let y = 0; y <= 6; y++) for (const x of ROAD_X) cobble(x, y);
  for (let x = 3; x <= 12; x++) cobble(x, 5);
  // Market Hall: striped awning roof and a coin sign
  building(g, MARKET_BLD, '#e8d3a6', '#d6bd8a', '#c0452f', '#9c3626');
  for (let x = MARKET_BLD.x0 * TILE; x < (MARKET_BLD.x1 + 1) * TILE; x += 8) px(g, '#f4ead0', x, MARKET_BLD.y0 * TILE + 10, 4, 4);
  doorAt(g, MARKET_DOOR, '#8b5a2b');
  px(g, '#8b5a2b', 1 * TILE + 4, 2 * TILE + 4, 20, 12); px(g, '#f2c94c', 1 * TILE + 9, 2 * TILE + 6, 8, 8); px(g, '#b98d2c', 1 * TILE + 12, 2 * TILE + 8, 2, 4);
  px(g, '#bfe3f7', 5 * TILE, 2 * TILE + 4, 12, 10); px(g, '#8b5a2b', 5 * TILE + 5, 2 * TILE + 4, 2, 10);
  // Heart Barn: pink walls, a big heart over the door
  building(g, HEART_BLD, '#f3c6d3', '#e7aabd', '#b4537a', '#93405f');
  doorAt(g, HEART_DOOR, '#f3ece0');
  const hx = 12 * TILE + 2, hy = 2 * TILE - 1;
  [[1,0,3],[6,0,3],[0,1,10],[0,2,10],[1,3,8],[2,4,6],[3,5,4],[4,6,2]].forEach(([x, y, w]) => px(g, '#e8608a', hx + x, hy + y, w, 1));
  px(g, '#bfe3f7', 14 * TILE, 2 * TILE + 4, 12, 10); px(g, '#bfe3f7', 10 * TILE + 4, 2 * TILE + 4, 12, 10);
  // Riding Arena: white fence, sand, a few jumps
  const AX = ARENA.x0 * TILE, AY = ARENA.y0 * TILE, AW = (ARENA.x1 - ARENA.x0 + 1) * TILE, AH = (ARENA.y1 - ARENA.y0 + 1) * TILE;
  px(g, '#e8d3a6', AX, AY, AW, AH);
  for (let i = 0; i < 80; i++) px(g, rng() < .5 ? '#d6bd8a' : '#f2e2bd', AX + Math.floor(rng() * AW), AY + Math.floor(rng() * AH), 2, 1);
  for (let x = AX; x < AX + AW; x += 8){ if (x >= 8 * TILE && x < 10 * TILE) continue; px(g, '#ffffff', x, AY + 2, 2, 10); }
  px(g, '#ffffff', AX, AY + 4, 8 * TILE - AX, 2); px(g, '#ffffff', 10 * TILE, AY + 4, AX + AW - 10 * TILE, 2);
  px(g, '#ffffff', AX, AY + 9, 8 * TILE - AX, 2); px(g, '#ffffff', 10 * TILE, AY + 9, AX + AW - 10 * TILE, 2);
  px(g, '#ffffff', AX, AY, 2, AH); px(g, '#ffffff', AX + AW - 2, AY, 2, AH);
  // open gate posts
  px(g, '#8b5a2b', 8 * TILE - 2, AY, 3, 14); px(g, '#8b5a2b', 10 * TILE - 1, AY, 3, 14);
  const jump = mapCanvas('jump:fence', [".kk..........kk.", ".kk..........kk.", "rrwwrrwwrrwwrrww", ".kk..........kk.", "rrwwrrwwrrwwrrww", "kkkk........kkkk"], {k: '#f2efe6', w: '#ffffff', r: '#d0533f'});
  g.drawImage(jump, 3 * TILE, 8 * TILE + 6); g.drawImage(jump, 11 * TILE, 9 * TILE); g.drawImage(jump, 6 * TILE, 9 * TILE + 8);
  return c;
}
function lamp(g, [x, y]){
  const X = x * TILE + 7, Y = y * TILE;
  px(g, '#3a3330', X, Y - 6, 2, 20); px(g, '#3a3330', X - 2, Y + 13, 6, 2);
  px(g, '#3a3330', X - 3, Y - 10, 8, 6); px(g, '#ffe9a6', X - 2, Y - 9, 6, 4);
}
export function draw(g, time){
  if (!bg) bg = buildVillage();
  g.drawImage(bg, 0, 0);
  const [fx, fy] = facing();
  if (!pl.moving && Math.floor(time / 400) % 2){
    if (has2(ARENA_GATE, fx, fy)) drawHighlight(g, 8 * TILE, 7 * TILE, 2 * TILE, TILE);
    else if (at(MARKET_DOOR, fx, fy) || at(HEART_DOOR, fx, fy)) drawHighlight(g, fx * TILE, fy * TILE, TILE, TILE);
  }
  const things = V_TREES.map(([x, y]) => ({y, draw: () => g.drawImage(mapCanvas('tree', TREE_SPR, NATURE_COLORS), x * TILE, y * TILE - 2)}));
  for (const l of LAMPS) things.push({y: l[1], draw: () => lamp(g, l)});
  things.push(farmerThing(g));
  const lt = ledThing(g, time); if (lt) things.push(lt);
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
  drawOverlays(g);
}
