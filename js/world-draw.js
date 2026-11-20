// Drawing the barn, the farm, the paddock, weather and the sky.
import { BUBBLE, BUBBLE_COLORS, CROP_COLORS, KID, KID_COLORS, SPR } from './sprite-data.js';
import { clamp, mulberry, now } from './util.js';
import { horseCanvas, itemCanvas, mapCanvas, saddleCanvas } from './sprites.js';
import { CROPS, NIGHT, clock, rugOK } from './data.js';
import { byId, isFoal, look, state } from './state.js';
import { AISLE_BOT, AISLE_TOP, BARN_DOOR_ROWS, COLS, FENCE, HOOKS, PADDOCK, PADDOCK_TREES, PATH, POND, ROWS, SCARECROW, TILE, TREES, TROUGH, WINDOWS, barnWalk, curMap, decorAt, facing, horseNear, isFarmDoor, isFence, isPaddockFence, lead, pdk, pl, placeInPaddock, plotAt, plotPos, stallAt } from './world.js';
import { frame } from './controls.js';

/* ---------- drawing the barn ---------- */
export let bgCanvas = null, bgKey = '';
export function px(ctx, col, x, y, w=1, h=1){ ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
export function buildBackground(){
  const c = document.createElement('canvas'); c.width = COLS*TILE; c.height = ROWS*TILE;
  const g = c.getContext('2d'), rng = mulberry(42);
  // back wall: wooden planks
  px(g, '#7a5232', 0, 0, c.width, 32);
  for (let x=0; x<c.width; x+=5) px(g, '#6a4529', x, 0, 1, 32);
  for (let i=0; i<40; i++) px(g, '#8a6040', Math.floor(rng()*c.width), Math.floor(rng()*30), 1, 2);
  px(g, '#5a3a22', 0, 0, c.width, 2);
  px(g, '#4f331f', 0, 30, c.width, 2);
  for (const wx of WINDOWS){
    const x = wx*TILE + 1, y = 4;
    px(g, '#4f331f', x, y, 14, 13);
    px(g, '#bfe3f7', x+2, y+2, 10, 9);
    px(g, '#e4f4fc', x+3, y+3, 3, 2);
    px(g, '#9fd0ea', x+8, y+7, 3, 3);
    px(g, '#4f331f', x+6, y+2, 2, 9); px(g, '#4f331f', x+2, y+6, 10, 1);
    px(g, '#9a6a3a', x-1, y+13, 16, 2);
  }
  for (const hx of HOOKS) px(g, '#3a2a1a', hx*TILE + 7, 6, 2, 2);
  // aisle floor: wide boards
  for (let y=AISLE_TOP*TILE; y<(AISLE_BOT+1)*TILE; y++){
    for (let x=0; x<c.width; x++){
      const board = Math.floor((y - AISLE_TOP*TILE) / 8);
      const shadeA = board % 2 ? '#b8956a' : '#b08d63';
      px(g, (y % 8 === 0) ? '#957247' : shadeA, x, y);
    }
  }
  for (let i=0; i<70; i++) px(g, '#a07f56', Math.floor(rng()*c.width), AISLE_TOP*TILE + Math.floor(rng()*64), 2, 1);
  for (let i=0; i<25; i++) px(g, '#e3c76f', Math.floor(rng()*c.width), AISLE_TOP*TILE + Math.floor(rng()*64), 1, 1);
  // the open door on the left: sunshine and grass peeking in
  const dy = BARN_DOOR_ROWS[0]*TILE;
  for (let x=0; x<14; x++){ g.fillStyle = `rgba(255,236,170,${.55 - x*.04})`; g.fillRect(x, dy, 1, 32); }
  px(g, '#8cc063', 0, dy+2, 3, 28); px(g, '#7fb257', 0, dy+8, 2, 3); px(g, '#7fb257', 0, dy+20, 2, 4);
  px(g, '#5e3a1a', 0, dy-2, 6, 2); px(g, '#5e3a1a', 0, dy+32, 6, 2);
  // a little arrow on the floor pointing outside
  [[9,0],[8,1],[7,2],[8,3],[9,4]].forEach(([ax, ay]) => px(g, '#ffffff', ax+2, dy+13+ay, 2, 1));
  // stalls
  for (let i=0; i<16; i++){
    const sx = (i % 8) * 32, sy = i < 8 ? 32 : 128;
    if (i < state.cap){
      px(g, '#dcbf66', sx, sy, 32, 32);
      for (let k=0; k<60; k++){
        const col = rng() < .5 ? '#c9a94e' : '#efd98c';
        px(g, col, sx + Math.floor(rng()*31), sy + Math.floor(rng()*31), 2, 1);
      }
    } else {
      px(g, '#5a4632', sx, sy, 32, 32);
      for (let k=0; k<30; k++) { px(g, '#6e5338', sx+k, sy+k, 2, 2); px(g, '#6e5338', sx+30-k, sy+k, 2, 2); }
    }
    // dividers between stalls
    px(g, '#5e3a1a', sx, sy, 2, 32); px(g, '#7a4e28', sx+2, sy, 1, 32);
    px(g, '#5e3a1a', sx+30, sy, 2, 32);
    // bottom-row gates sit behind the horse (we look down at them)
    if (i >= 8) drawGate(g, sx, sy, i < state.cap);
  }
  // front wall
  px(g, '#7a5232', 0, 160, c.width, 16);
  for (let x=0; x<c.width; x+=5) px(g, '#6a4529', x, 160, 1, 16);
  px(g, '#4f331f', 0, 160, c.width, 2);
  return c;
}
export function drawGate(g, sx, sy, open){
  const y = sy < 64 ? sy + 24 : sy;   // top stalls: gate on the bottom edge; bottom stalls: on the top edge
  px(g, '#5e3a1a', sx, y, 32, 8);
  px(g, open ? '#9a6a3a' : '#6e5338', sx+1, y+1, 30, 2);
  px(g, open ? '#8b5a2b' : '#62492f', sx+1, y+4, 30, 3);
  px(g, '#5e3a1a', sx+15, y, 2, 8);
  px(g, '#c9c0b0', sx+13, y+3, 2, 2);
}
export function drawHighlight(g, hx, hy, hw, hh){
  g.fillStyle = '#fff6a8';
  for (const [cx, cy, w, h] of [[hx,hy,4,1],[hx,hy,1,4],[hx+hw-4,hy,4,1],[hx+hw-1,hy,1,4],[hx,hy+hh-1,4,1],[hx,hy+hh-4,1,4],[hx+hw-4,hy+hh-1,4,1],[hx+hw-1,hy+hh-4,1,4]])
    g.fillRect(cx, cy, w, h);
}
export function farmerThing(g){
  return {y: pl.py + .01, draw: () => {
    const P = state.player;
    const frame = pl.moving ? Math.floor(pl.walkT * 8) % 2 : 0;
    const spr = mapCanvas(`kid:${P.dir}:${frame}`, KID[P.dir][frame], KID_COLORS);
    const x = Math.round(pl.px*TILE + 1), y = Math.round(pl.py*TILE - 3);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x+3, y+16, 8, 2);
    g.drawImage(spr, x, y);
    if (P.carry) g.drawImage(itemCanvas(P.carry.type), x - 1, y - 13);
  }};
}
// draw a horse standing on tile (x, y), flipped to face left if needed
export function drawHorseAt(g, h, x, y, flip, moving, time, label){
  const fr = moving ? (Math.floor(time/110) % 2 ? 'b' : 'c') : null;
  const c = horseCanvas({...look(h), frame: isFoal(h) ? null : fr});
  const dx = Math.round(x*TILE + 8 - c.width/2), dy = Math.round(y*TILE + 16 - c.height);
  g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(dx + 6, dy + c.height - 2, c.width - 12, 2);
  if (flip){ g.save(); g.translate(dx + c.width, dy); g.scale(-1, 1); g.drawImage(c, 0, 0); g.restore(); }
  else g.drawImage(c, dx, dy);
  if (label){
    g.font = 'bold 7px "Pixelify Sans", monospace'; g.textAlign = 'center';
    g.fillStyle = 'rgba(40,28,18,.65)'; const w = g.measureText(h.name).width + 6;
    g.fillRect(Math.round(x*TILE + 8 - w/2), dy - 8, Math.round(w), 9);
    g.fillStyle = '#fff'; g.fillText(h.name, Math.round(x*TILE + 8), dy - 1);
  }
}
export function ledThing(g, time){
  const h = state.player.leading ? byId(state.player.leading) : null;
  if (!h) return null;
  return {y: lead.y, draw: () => drawHorseAt(g, h, lead.x, lead.y, lead.flip, lead.moving, time, false)};
}
// sunrise, evening and night light
export function drawSky(g, indoor){
  const hr = clock().hour; let col = null, a = 0;
  if (hr < 7){ col = '255,170,90'; a = .22 * (7 - hr); }
  else if (hr >= 18 && hr < NIGHT){ col = '255,120,60'; a = .25 * (hr - 18) / 3; }
  else if (hr >= NIGHT){ col = '20,24,70'; a = .45; }
  if (!col) return;
  g.fillStyle = `rgba(${col},${indoor ? a*.5 : a})`; g.fillRect(0, 0, COLS*TILE, ROWS*TILE);
  if (hr >= NIGHT && !indoor){
    const rng = mulberry(5);
    for (let i=0; i<30; i++){ const sx = Math.floor(rng()*COLS*TILE), sy = Math.floor(rng()*ROWS*TILE); if (Math.floor(performance.now()/500 + i) % 5) px(g, '#fff8d0', sx, sy, 1, 1); }
  }
}
// rain streaks, falling snow and a warm sunny glow
export function drawWeather(g, W, H, time, groundSnow=true){
  const w = state.weather || 'sunny';
  if (w === 'rain'){
    g.fillStyle = 'rgba(40,60,90,.18)'; g.fillRect(0, 0, W, H);
    for (let i=0; i<80; i++){
      const sx = (i * 53.7) % W, sp = .22 + (i % 5) * .03;
      const y = ((i * 97.3) + time * sp) % (H + 10) - 10, x = (sx - (time * sp * .25)) % W;
      const xx = Math.round(x < 0 ? x + W : x), yy = Math.round(y);
      px(g, 'rgba(200,225,250,.75)', xx, yy, 1, 3); px(g, 'rgba(200,225,250,.5)', xx - 1, yy + 3, 1, 2);
    }
  } else if (w === 'snow'){
    g.fillStyle = 'rgba(235,242,255,.16)'; g.fillRect(0, 0, W, H);
    if (groundSnow){ const r = mulberry(3); for (let i=0; i<260; i++) px(g, 'rgba(255,255,255,.85)', Math.floor(r()*W), Math.floor(r()*H), 2, 1); }
    for (let i=0; i<70; i++){
      const base = (i * 61.3) % W, sp = .018 + (i % 4) * .006;
      const y = ((i * 37.7) + time * sp) % (H + 4) - 4, x = base + Math.sin(time / 700 + i) * 5;
      px(g, '#ffffff', Math.round(x), Math.round(y), (i % 3) ? 1 : 2, (i % 3) ? 1 : 2);
    }
  } else {
    g.fillStyle = 'rgba(255,230,150,.07)'; g.fillRect(0, 0, W, H);
  }
}
export function drawOverlays(g){
  g.font = 'bold 8px "Pixelify Sans", monospace'; g.textAlign = 'center';
  for (const f of pl.fx2){
    g.globalAlpha = Math.min(1, f.t * 2);
    g.fillStyle = '#3a2a1a'; g.fillText(f.text, Math.round(f.x)+1, Math.round(f.y)+1);
    g.fillStyle = f.col; g.fillText(f.text, Math.round(f.x), Math.round(f.y));
  }
  g.globalAlpha = 1;
  if (curMap() !== 'barn') drawWeather(g, COLS*TILE, ROWS*TILE, performance.now());
  drawSky(g, curMap() === 'barn');
  if (pl.fade > 0){ g.fillStyle = `rgba(20,12,6,${pl.fade})`; g.fillRect(0, 0, COLS*TILE, ROWS*TILE); }
}
export function drawScene(cv, time){
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (curMap() === 'farm') return drawFarm(g, time);
  if (curMap() === 'paddock') return drawPaddock(g, time);
  const key = state.cap;
  if (!bgCanvas || bgKey !== key){ bgCanvas = buildBackground(); bgKey = key; }
  g.drawImage(bgCanvas, 0, 0);
  // saddles hanging on the wall
  const used = new Set(state.horses.map(h => h.saddle));
  state.saddles.filter(s => !used.has(s.id)).slice(0, HOOKS.length).forEach((s, i) => {
    g.drawImage(saddleCanvas(s.type), HOOKS[i]*TILE, 7);
  });
  // horses in their stalls
  state.horses.slice(0, state.cap).forEach((h, i) => {
    const sx = (i % 8) * 32, sy = i < 8 ? 32 : 128;
    if (h.out || state.player.leading === h.id){
      // an empty stall with a little sun sign: "out in the paddock"
      if (h.out){ px(g, '#f5d76e', sx + 13, sy + 10, 6, 6); px(g, '#f5d76e', sx + 15, sy + 7, 2, 12); px(g, '#f5d76e', sx + 10, sy + 12, 12, 2); }
      return;
    }
    const c = horseCanvas(look(h));
    const bob = h.happy >= 50 && Math.floor(time/600 + i) % 2 ? -1 : 0;
    g.drawImage(c, sx + Math.floor((32 - c.width)/2), sy + (i < 8 ? 4 : 6) + bob);
    let bub = null;
    if (h.hunger < 30 || h.happy < 25) bub = 'alert';
    else if (h.preg) bub = 'heart';
    if (bub && Math.floor(time/500) % 3) g.drawImage(mapCanvas('bubble:'+bub, BUBBLE[bub], BUBBLE_COLORS), sx + 20, sy - 2);
  });
  // top-row gates in front of the horses
  for (let i=0; i<8; i++) drawGate(g, i*32, 32, i < state.cap);
  // facing highlight
  const [fx, fy] = facing(), st = stallAt(fx, fy);
  if (!pl.moving && Math.floor(time/400) % 2){
    if (st >= 0) drawHighlight(g, (st%8)*32, st < 8 ? 32 : 128, 32, 32);
    else if (decorAt(fx, fy) || (state.player.carry && barnWalk(fx, fy))) drawHighlight(g, fx*TILE, fy*TILE, TILE, TILE);
  }
  // decorations and the farmer, drawn from back to front
  const things = state.decor.map(d => ({y: d.y, draw: () => g.drawImage(itemCanvas(d.type), d.x*TILE, d.y*TILE)}));
  things.push(farmerThing(g));
  const lt = ledThing(g, time); if (lt) things.push(lt);
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
  drawOverlays(g);
}

/* ---------- drawing the farm outside ---------- */
export let farmBg = null, farmBgKey = '';
export function buildFarm(){
  const c = document.createElement('canvas'); c.width = COLS*TILE; c.height = ROWS*TILE;
  const g = c.getContext('2d'), rng = mulberry(7);
  // grass with little flowers
  px(g, '#8cc063', 0, 0, c.width, c.height);
  for (let i=0; i<500; i++) px(g, rng() < .5 ? '#7fb257' : '#9ccc70', Math.floor(rng()*c.width), Math.floor(rng()*c.height), 1, 2);
  for (let i=0; i<40; i++){
    const fx = Math.floor(rng()*c.width), fy = Math.floor(rng()*c.height);
    px(g, ['#ffffff','#f5d76e','#ef8fb3'][i%3], fx, fy, 1, 1);
  }
  // dirt path from the barn door to the field gate
  for (const [x, y] of PATH){
    px(g, '#cfae7a', x*TILE+1, y*TILE+1, 14, 14);
    px(g, '#cfae7a', x*TILE+3, y*TILE, 10, 16); px(g, '#cfae7a', x*TILE, y*TILE+3, 16, 10);
    for (let k=0; k<4; k++) px(g, '#b8955f', x*TILE + 2 + Math.floor(rng()*12), y*TILE + 2 + Math.floor(rng()*12), 2, 1);
  }
  // the barn building (top-left, 5 x 5 tiles)
  const bw = 5*TILE, bh = 5*TILE;
  px(g, '#6e9a4c', 2, bh, bw - 2, 3);                        // shadow on the grass
  px(g, '#b8432f', 0, 14, bw, bh - 14);                       // red walls
  for (let x=3; x<bw; x+=5) px(g, '#a03a28', x, 16, 1, bh - 16);
  px(g, '#6b2f24', 0, 0, bw, 16);                             // roof
  for (let y=2; y<16; y+=4) px(g, '#5a271e', 0, y, bw, 1);
  for (let x=0; x<bw; x+=6) px(g, '#7d3a2c', x, 0, 3, 16);
  px(g, '#f3ece0', 0, 14, bw, 2);                             // white trim
  px(g, '#f3ece0', 0, 14, 2, bh - 14); px(g, '#f3ece0', bw - 2, 14, 2, bh - 14);
  px(g, '#f3ece0', 31, 19, 18, 14); px(g, '#3a2618', 33, 21, 14, 10); px(g, '#e3c76f', 33, 27, 14, 4);   // hayloft
  px(g, '#f3ece0', 14, 44, 52, 36);                           // big door frame
  px(g, '#3a2618', 17, 47, 46, 33);                           // open doorway
  px(g, '#c9a94e', 17, 72, 46, 8); px(g, '#e3c76f', 22, 75, 8, 2); px(g, '#e3c76f', 44, 73, 10, 2);
  for (let k=0; k<14; k++){ px(g, '#f3ece0', 3+k*0.7, 47+k*2.3, 2, 2); }  // door swung open (left)
  px(g, '#a03a28', 3, 46, 11, 34); px(g, '#f3ece0', 3, 46, 11, 2); px(g, '#f3ece0', 3, 78, 11, 2);
  for (let k=0; k<10; k++){ px(g, '#f3ece0', 4+k, 48+k*3, 2, 2); }
  px(g, '#a03a28', 66, 46, 11, 34); px(g, '#f3ece0', 66, 46, 11, 2); px(g, '#f3ece0', 66, 78, 11, 2);
  for (let k=0; k<10; k++){ px(g, '#f3ece0', 75-k, 48+k*3, 2, 2); }
  // pond
  const [pxl, pyl] = [POND[0][0]*TILE, POND[0][1]*TILE];
  for (let y=0; y<32; y++){
    const inset = y < 4 ? 6 - y : y > 27 ? y - 25 : 2;
    px(g, '#4a8cbd', pxl + inset, pyl + y, 48 - inset*2, 1);
    if (y > 1 && y < 30) px(g, '#5fa7d6', pxl + inset + 2, pyl + y, 44 - inset*2, 1);
  }
  px(g, '#a9d8f2', pxl+10, pyl+8, 8, 1); px(g, '#a9d8f2', pxl+28, pyl+18, 10, 1); px(g, '#a9d8f2', pxl+16, pyl+24, 5, 1);
  px(g, '#5e9c3a', pxl+40, pyl+2, 2, 6); px(g, '#5e9c3a', pxl+43, pyl+4, 2, 5); px(g, '#7a5232', pxl+40, pyl+1, 2, 2);
  // field soil (owned) or wild grass (not bought yet)
  for (let i=0; i<12; i++){
    const [x, y] = plotPos(i), X = x*TILE, Y = y*TILE;
    if (i < state.plots.length){
      px(g, '#6a4a2e', X, Y, 16, 16);
      px(g, '#7a5536', X+1, Y+1, 14, 14);
      for (const fy of [4, 9, 14]) px(g, '#5e3f26', X+1, Y+fy, 14, 1);
    } else {
      px(g, '#80b35a', X+1, Y+1, 14, 14);
      for (let k=1; k<15; k+=3){ px(g, '#6a9a48', X+k, Y+1, 2, 1); px(g, '#6a9a48', X+k, Y+14, 2, 1); px(g, '#6a9a48', X+1, Y+k, 1, 2); px(g, '#6a9a48', X+14, Y+k, 1, 2); }
    }
  }
  // fence around the field
  for (let y=FENCE.y0; y<=FENCE.y1; y++) for (let x=FENCE.x0; x<=FENCE.x1; x++){
    if (!isFence(x, y)) continue;
    const X = x*TILE, Y = y*TILE;
    const horiz = y === FENCE.y0 || y === FENCE.y1;
    if (horiz){
      px(g, '#5e3a1a', X, Y+5, 16, 3); px(g, '#9a6a3a', X, Y+5, 16, 2);
      px(g, '#5e3a1a', X, Y+10, 16, 3); px(g, '#9a6a3a', X, Y+10, 16, 2);
    } else {
      px(g, '#5e3a1a', X+6, Y, 4, 16); px(g, '#9a6a3a', X+6, Y, 3, 16);
    }
    px(g, '#5e3a1a', X+5, Y+2, 6, 13); px(g, '#b07a46', X+6, Y+2, 4, 12); px(g, '#c48c55', X+6, Y+2, 4, 2);
  }
  // signpost: "paddock this way →"
  const SX = 13*TILE, SY = 8*TILE;
  px(g, '#5e3a1a', SX+7, SY+4, 2, 11);
  px(g, '#5e3a1a', SX, SY-1, 16, 9); px(g, '#c48c55', SX+1, SY, 13, 7); px(g, '#c48c55', SX+14, SY+2, 1, 3);
  [[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[8,2],[8,4],[7,1],[7,5]].forEach(([ax, ay]) => px(g, '#5e3a1a', SX+ax+1, SY+ay, 1, 1));
  return c;
}
export const TREE_SPR = [
  "....gggggg....",
  "..gggGggggg...",
  ".ggggggggGggg.",
  "gggGggggggggGg",
  "ggggggGggggggg",
  "gGgggggggGgggg",
  "gggggGgggggggg",
  "ggGggggggggGgg",
  ".gggggggGgggg.",
  "..gggGgggggg..",
  "....gggggg....",
  "......tt......",
  "......tt......",
  "......Tt......",
  ".....tTtt.....",
];
export const SCARECROW_SPR = [
  "....YYYY......",
  "...YyyyyY.....",
  "..YYYYYYYY....",
  "....ssss......",
  "....sese......",
  "....ssss......",
  ".rrrrrrrrrr...",
  "....rrrr......",
  "....rRrr......",
  "....bbbb......",
  "......t.......",
  "......t.......",
  "......t.......",
  ".....ttt......",
];
export const NATURE_COLORS = {g:'#5e9c3a', G:'#3f7a26', t:'#7a5232', T:'#5a3a22', Y:'#b98d2c', y:'#ecc75e', s:'#d9c08a', e:'#3a2a1a', r:'#4f86b8', R:'#3a6a99', b:'#8a6040'};
export let paddockBg = null;
export function buildPaddock(){
  const c = document.createElement('canvas'); c.width = COLS*TILE; c.height = ROWS*TILE;
  const g = c.getContext('2d'), rng = mulberry(11);
  px(g, '#8cc063', 0, 0, c.width, c.height);
  // lush meadow inside the fence
  px(g, '#96c96a', (PADDOCK.x0+1)*TILE, (PADDOCK.y0+1)*TILE, (PADDOCK.x1-PADDOCK.x0-1)*TILE, (PADDOCK.y1-PADDOCK.y0-1)*TILE);
  for (let i=0; i<700; i++) px(g, rng() < .5 ? '#7fb257' : '#a6d47a', Math.floor(rng()*c.width), Math.floor(rng()*c.height), 1, 2);
  for (let i=0; i<60; i++) px(g, ['#ffffff','#f5d76e','#ef8fb3','#c9a8f0'][i%4], Math.floor(rng()*c.width), Math.floor(rng()*c.height), 1, 1);
  // path from the fields to the gate
  for (let x=0; x<=PADDOCK.x0; x++) for (const y of [6, 7]){
    px(g, '#cfae7a', x*TILE, y*TILE + 2, 16, 12); px(g, '#cfae7a', x*TILE, y*TILE, 16, 16);
  }
  px(g, '#8cc063', 0, 6*TILE, 4*TILE, 1); px(g, '#8cc063', 0, 8*TILE - 1, 4*TILE, 1);
  for (let k=0; k<10; k++) px(g, '#b8955f', Math.floor(rng()*4*TILE), 6*TILE + 2 + Math.floor(rng()*28), 2, 1);
  // fence
  for (let y=PADDOCK.y0; y<=PADDOCK.y1; y++) for (let x=PADDOCK.x0; x<=PADDOCK.x1; x++){
    if (!isPaddockFence(x, y)) continue;
    const X = x*TILE, Y = y*TILE, horiz = y === PADDOCK.y0 || y === PADDOCK.y1;
    if (horiz){ px(g, '#5e3a1a', X, Y+5, 16, 3); px(g, '#f1ebdc', X, Y+5, 16, 2); px(g, '#5e3a1a', X, Y+10, 16, 3); px(g, '#f1ebdc', X, Y+10, 16, 2); }
    else { px(g, '#5e3a1a', X+6, Y, 4, 16); px(g, '#f1ebdc', X+6, Y, 3, 16); }
    px(g, '#5e3a1a', X+5, Y+2, 6, 13); px(g, '#ffffff', X+6, Y+2, 4, 12);
  }
  // open gate swung back
  px(g, '#5e3a1a', PADDOCK.x0*TILE + 4, 6*TILE - 6, 8, 3); px(g, '#f1ebdc', PADDOCK.x0*TILE + 4, 6*TILE - 6, 8, 2);
  // a sign: "PADDOCK" (a little horseshoe)
  px(g, '#5e3a1a', 1*TILE+7, 5*TILE+6, 2, 10); px(g, '#5e3a1a', 1*TILE, 5*TILE, 16, 8); px(g, '#c48c55', 1*TILE+1, 5*TILE+1, 14, 6);
  [[5,2],[5,3],[5,4],[6,5],[7,5],[8,5],[9,5],[10,4],[10,3],[10,2]].forEach(([a,b]) => px(g, '#5e3a1a', 1*TILE+a, 5*TILE+b, 1, 1));
  return c;
}
export function drawPaddock(g, time){
  if (!paddockBg) paddockBg = buildPaddock();
  g.drawImage(paddockBg, 0, 0);
  const P = state.player;
  const things = PADDOCK_TREES.map(([x, y]) => ({y, draw: () => g.drawImage(mapCanvas('tree', TREE_SPR, NATURE_COLORS), x*TILE, y*TILE - 2)}));
  things.push({y: TROUGH[0][1], draw: () => { const t = itemCanvas('trough'); g.drawImage(t, TROUGH[0][0]*TILE, TROUGH[0][1]*TILE); g.drawImage(t, TROUGH[1][0]*TILE, TROUGH[1][1]*TILE); }});
  for (const h of state.horses){
    if (!h.out) continue;
    const p = pdk[h.id] || (placeInPaddock(h), pdk[h.id]);
    const near = Math.hypot(p.x - pl.px, p.y - pl.py) < 2.2;
    things.push({y: p.y, draw: () => {
      drawHorseAt(g, h, p.x, p.y, p.flip, p.moving, time + h.id*97, near);
      if (rugOK(h)) return;
      const cx = p.x*TILE + 8, cy = p.y*TILE + 2;
      if ((state.weather || 'sunny') === 'sunny'){
        for (let k=0; k<4; k++){ const a = time/180 + k*1.7 + h.id; px(g, '#1a1a1a', Math.round(cx + Math.cos(a)*9), Math.round(cy - 4 + Math.sin(a*1.3)*5), 1, 1); }
      } else if (Math.floor(time/500) % 3) g.drawImage(mapCanvas('bubble:alert', BUBBLE.alert, BUBBLE_COLORS), Math.round(cx + 4), Math.round(cy - 18));
    }});
  }
  things.push(farmerThing(g));
  const lt = ledThing(g, time); if (lt) things.push(lt);
  // highlight a horse you can lead
  if (!P.leading && !pl.moving){
    const [fx, fy] = facing(), h = horseNear(fx, fy) || horseNear(P.x, P.y);
    if (h && Math.floor(time/400) % 2){ const q = pdk[h.id]; drawHighlight(g, Math.round(q.x*TILE - 8), Math.round(q.y*TILE - 8), 32, 24); }
  }
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
  drawOverlays(g);
}
export function drawFarm(g, time){
  const key = state.plots.length;
  if (!farmBg || farmBgKey !== key){ farmBg = buildFarm(); farmBgKey = key; }
  g.drawImage(farmBg, 0, 0);
  // crops growing in the fields
  state.plots.forEach((p, i) => {
    if (!p.crop) return;
    const [x, y] = plotPos(i), X = x*TILE, Y = y*TILE;
    const c = CROPS[p.crop], prog = clamp((now() - p.at) / (c.time*1000), 0, 1);
    const spr = mapCanvas('crop14:'+p.crop, SPR[p.crop], CROP_COLORS);
    if (prog >= 1){
      const bob = Math.floor(time/400 + i) % 2 ? -1 : 0;
      g.drawImage(spr, X+1, Y + bob);
      if (Math.floor(time/300 + i*2) % 4 === 0){ px(g, '#ffffff', X+13, Y+2, 1, 3); px(g, '#ffffff', X+12, Y+3, 3, 1); }
    } else {
      if (prog < .34){ px(g, '#7bbf4a', X+7, Y+9, 2, 2); px(g, '#4f8a2b', X+7, Y+11, 2, 1); }
      else if (prog < .67) g.drawImage(mapCanvas('crop14:sprout', SPR.sprout, CROP_COLORS), X+1, Y+1);
      else g.drawImage(spr, 0, 6, spr.width, spr.height - 6, X+1, Y+6, spr.width, spr.height - 6);
      px(g, '#3a2a1a', X+1, Y+15, 14, 1); px(g, '#9fdc6a', X+1, Y+15, Math.max(1, Math.round(14*prog)), 1);
    }
  });
  // facing highlight
  const [fx, fy] = facing();
  if (!pl.moving && Math.floor(time/400) % 2){
    if (plotAt(fx, fy) >= 0) drawHighlight(g, fx*TILE, fy*TILE, TILE, TILE);
    else if (isFarmDoor(fx, fy)) drawHighlight(g, 1*TILE, 3*TILE, 3*TILE, 2*TILE);
  }
  // trees, scarecrow and the farmer, back to front
  const things = TREES.map(([x, y]) => ({y, draw: () => g.drawImage(mapCanvas('tree', TREE_SPR, NATURE_COLORS), x*TILE, y*TILE - 2)}));
  things.push({y: SCARECROW[1], draw: () => g.drawImage(mapCanvas('scarecrow', SCARECROW_SPR, NATURE_COLORS), SCARECROW[0]*TILE + 1, SCARECROW[1]*TILE - 1)});
  things.push(farmerThing(g));
  const lt = ledThing(g, time); if (lt) things.push(lt);
  things.sort((a, b) => a.y - b.y).forEach(t => t.draw());
  drawOverlays(g);
}

