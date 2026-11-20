// The walkable world: barn, farm and paddock rules, movement, leading horses.
import { $, clamp, fmt, now } from './util.js';
import { cropImg } from './sprites.js';
import { CROPS, RUG_KINDS, SHOP, WEATHER, isDaytime, rugOK } from './data.js';
import { byId, plotCost, state } from './state.js';
import { showModal, toast } from './ui.js';
import { horseModal, hud, render } from './views.js';
import { camX, heldDir } from './controls.js';
import { save } from './game.js';

/* =========================================================
   THE WORLD — two maps you can walk between (16 x 11 tiles, 16px each)

   BARN (inside):                    FARM (outside):
     rows 0-1  back wall               barn building top-left (door at the bottom)
     rows 2-3  top stalls              fenced field with 12 plots in the middle
     rows 4-7  aisle (door on the      pond, trees and a scarecrow around it
               left, rows 5-6)
     rows 8-9  bottom stalls
     row 10    front wall
   ========================================================= */
export const TILE = 16, COLS = 16, ROWS = 11, AISLE_TOP = 4, AISLE_BOT = 7;
export const DIRS = {up:[0,-1], down:[0,1], left:[-1,0], right:[1,0]};
export const WINDOWS = [3, 8, 12];
export const HOOKS = [0,1,2,4,5,6,7,9,10,11,13,14,15];
export const BARN_DOOR_ROWS = [5, 6];                 // inside: walk out to the left here
export const FARM_DOOR_X = [1, 2, 3], FARM_DOOR_Y = 4; // outside: the big barn door
export const PLOT_X0 = 7, PLOT_Y0 = 3, PLOT_W = 4;    // 4 x 3 field tiles
export const FENCE = {x0:6, y0:2, x1:11, y1:6};
export const GATE = [[8,6],[9,6]];
export const POND = [[1,8],[2,8],[3,8],[1,9],[2,9],[3,9]];
export const TREES = [[14,1],[15,4],[14,9],[6,10],[11,10]];
export const SCARECROW = [12, 4];
export const PATH = [[2,5],[2,6],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[8,7],[9,7],[10,7],[11,7],[12,7],[13,7],[14,7],[15,7]];
export const FARM_EXIT_ROWS = [6, 7, 8];   // walk off the right edge here to reach the paddock
export const pl = {px:2, py:5, moving:false, fx:0, fy:0, tx:0, ty:0, t:0, path:[], after:null, walkT:0, fade:0, fx2:[]};
export const held = [];   // directions being held down, newest last
export const has2 = (list, x, y) => list.some(([a,b]) => a === x && b === y);
export const curMap = () => state.player.map || 'barn';

/* ----- barn rules ----- */
export function stallAt(x, y){
  if (x < 0 || x >= COLS) return -1;
  if (y === 2 || y === 3) return Math.floor(x/2);
  if (y === 8 || y === 9) return 8 + Math.floor(x/2);
  return -1;
}
export const decorAt = (x, y) => state.decor.find(d => d.x === x && d.y === y);
export const inAisle = (x, y) => x >= 0 && x < COLS && y >= AISLE_TOP && y <= AISLE_BOT;
export const isBarnDoorTile = (x, y) => x === 0 && BARN_DOOR_ROWS.includes(y);
export const barnWalk = (x, y) => inAisle(x, y) && !decorAt(x, y);

/* ----- farm rules ----- */
export function plotAt(x, y){
  if (x < PLOT_X0 || x >= PLOT_X0 + PLOT_W || y < PLOT_Y0 || y >= PLOT_Y0 + 3) return -1;
  return (y - PLOT_Y0) * PLOT_W + (x - PLOT_X0);
}
export const plotPos = i => [PLOT_X0 + i % PLOT_W, PLOT_Y0 + Math.floor(i / PLOT_W)];
export const isFarmDoor = (x, y) => y === FARM_DOOR_Y && FARM_DOOR_X.includes(x);
export function isFence(x, y){
  if (has2(GATE, x, y)) return false;
  const onH = (y === FENCE.y0 || y === FENCE.y1) && x >= FENCE.x0 && x <= FENCE.x1;
  const onV = (x === FENCE.x0 || x === FENCE.x1) && y >= FENCE.y0 && y <= FENCE.y1;
  return onH || onV;
}
export function farmWalk(x, y){
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  if (x <= 4 && y <= 4) return false;           // the barn building
  if (has2(POND, x, y) || has2(TREES, x, y)) return false;
  if (x === SCARECROW[0] && y === SCARECROW[1]) return false;
  return !isFence(x, y);
}
/* ----- paddock rules ----- */
export const PADDOCK = {x0:3, y0:1, x1:15, y1:10};
export const PADDOCK_GATE = [[3,6],[3,7]];
export const PADDOCK_ENTRY_ROWS = [6, 7, 8];       // walk off the left edge here to go back to the fields
export const PADDOCK_TREES = [[1,2],[0,10],[1,4]];
export const TROUGH = [[13,2],[14,2]];
export const inPaddock = (x, y) => x > PADDOCK.x0 && x < PADDOCK.x1 && y > PADDOCK.y0 && y < PADDOCK.y1;
export function isPaddockFence(x, y){
  if (has2(PADDOCK_GATE, x, y)) return false;
  const onH = (y === PADDOCK.y0 || y === PADDOCK.y1) && x >= PADDOCK.x0 && x <= PADDOCK.x1;
  const onV = (x === PADDOCK.x0 || x === PADDOCK.x1) && y >= PADDOCK.y0 && y <= PADDOCK.y1;
  return onH || onV;
}
export function paddockWalk(x, y){
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  if (has2(PADDOCK_TREES, x, y) || has2(TROUGH, x, y)) return false;
  return !isPaddockFence(x, y);
}
export const walkable = (x, y, map = curMap()) => map === 'barn' ? barnWalk(x, y) : map === 'farm' ? farmWalk(x, y) : paddockWalk(x, y);

/* ----- horses wandering in the paddock (positions are not saved) ----- */
export const pdk = {};
export function placeInPaddock(h, x, y){
  const rx = x ?? 5 + Math.random()*8, ry = y ?? 3 + Math.random()*6;
  pdk[h.id] = {x: rx, y: ry, tx: rx, ty: ry, wait: 1 + Math.random()*3, flip: Math.random() < .5, moving: false};
}
export function updatePaddock(dt){
  for (const h of state.horses){
    if (!h.out) continue;
    const p = pdk[h.id] || (placeInPaddock(h), pdk[h.id]);
    if (p.wait > 0){ p.wait -= dt; p.moving = false; continue; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (d < .05){
      p.tx = 5 + Math.random()*8; p.ty = 3 + Math.random()*6; p.wait = 2 + Math.random()*5; p.moving = false;
    } else {
      const step = Math.min(d, 1.3 * dt);
      p.x += dx/d*step; p.y += dy/d*step; p.moving = true;
      if (Math.abs(dx) > .05) p.flip = dx < 0;
    }
  }
}
export function horseNear(fx, fy){
  let best = null, bd = 1.3;
  for (const h of state.horses){
    if (!h.out || !pdk[h.id]) continue;
    const d = Math.hypot(pdk[h.id].x - fx, pdk[h.id].y - fy);
    if (d < bd){ bd = d; best = h; }
  }
  return best;
}
/* ----- the horse you are leading follows one step behind ----- */
export const lead = {x:0, y:0, tx:0, ty:0, flip:false, moving:false};
export function resetLeadPos(){
  const P = state.player, [dx, dy] = DIRS[P.dir];
  const bx = P.x - dx, by = P.y - dy;
  const ok = walkable(bx, by);
  lead.x = lead.tx = ok ? bx : P.x; lead.y = lead.ty = ok ? by : P.y;
}
export function updateLead(dt){
  const dx = lead.tx - lead.x, dy = lead.ty - lead.y, d = Math.hypot(dx, dy);
  if (d < .02){ lead.moving = false; return; }
  const step = Math.min(d, 7 * dt);
  lead.x += dx/d*step; lead.y += dy/d*step; lead.moving = true;
  if (Math.abs(dx) > .02) lead.flip = dx < 0;
}

export function bfs(sx, sy, isGoal, map = curMap()){
  const prev = new Map(), key = (x,y) => x+','+y, q = [[sx,sy]];
  prev.set(key(sx,sy), null);
  while (q.length){
    const [x,y] = q.shift();
    if (isGoal(x,y)){
      const path = []; let k = key(x,y), c = [x,y];
      while (prev.get(k)){ path.unshift(c); c = prev.get(k); k = key(...c); }
      return path;
    }
    for (const [dx,dy] of Object.values(DIRS)){
      const nx = x+dx, ny = y+dy;
      if (walkable(nx,ny,map) && !prev.has(key(nx,ny))){ prev.set(key(nx,ny), [x,y]); q.push([nx,ny]); }
    }
  }
  return null;
}
// would every aisle tile in the barn still be reachable?
export function stillConnected(){
  const P = state.player;
  const [sx, sy] = curMap() === 'barn' ? [P.x, P.y] : [0, 5];
  let total = 0;
  for (let y=AISLE_TOP; y<=AISLE_BOT; y++) for (let x=0; x<COLS; x++) if (barnWalk(x,y)) total++;
  let seen = 0; bfs(sx, sy, () => { seen++; return false; }, 'barn');
  return seen === total;
}
export function freeSpot(){
  const P = state.player, inBarn = curMap() === 'barn', spots = [];
  for (let y=AISLE_TOP; y<=AISLE_BOT; y++) for (let x=0; x<COLS; x++)
    if (barnWalk(x,y) && !isBarnDoorTile(x,y) && x > 0 && !(inBarn && x === P.x && y === P.y)) spots.push([x,y]);
  spots.sort(() => Math.random() - .5);
  // prefer spots along the walls so the middle stays open
  spots.sort((a,b) => (a[1]===AISLE_TOP||a[1]===AISLE_BOT ? 0 : 1) - (b[1]===AISLE_TOP||b[1]===AISLE_BOT ? 0 : 1));
  for (const s of spots){
    const tmp = {type:'tmp', x:s[0], y:s[1]}; state.decor.push(tmp);
    const ok = stillConnected(); state.decor.pop();
    if (ok) return s;
  }
  return null;
}
export function facing(){
  const P = state.player, [dx,dy] = DIRS[P.dir];
  return [P.x+dx, P.y+dy];
}

/* ----- going in and out ----- */
export function goTo(map, x, y, dir){
  const P = state.player;
  if (P.carry && map !== 'barn') return toast(`Put the ${SHOP[P.carry.type].name.toLowerCase()} down before you go outside.`);
  P.map = map;
  if (map === 'farm'){ P.x = x ?? 2; P.y = y ?? 5; P.dir = dir || 'down'; }
  else if (map === 'paddock'){ P.x = x ?? 0; P.y = y ?? 7; P.dir = dir || 'right'; }
  else {
    P.x = 0; P.y = 5; P.dir = 'right';
    const d = decorAt(0, 5);
    if (d){ const s = freeSpot(); if (s){ d.x = s[0]; d.y = s[1]; } }
  }
  pl.moving = false; pl.path = []; pl.after = null; pl.px = P.x; pl.py = P.y; pl.fade = 1; pl.fx2 = [];
  if (P.leading){ lead.x = lead.tx = P.x; lead.y = lead.ty = P.y; }
  save(); render();
}
// stepping off the map through a door?
export function tryDoor(nx, ny){
  const m = curMap();
  if (m === 'barn' && nx < 0 && BARN_DOOR_ROWS.includes(ny)){ goTo('farm'); return true; }
  if (m === 'farm' && isFarmDoor(nx, ny)){ goTo('barn'); return true; }
  if (m === 'farm' && nx >= COLS && FARM_EXIT_ROWS.includes(ny)){ goTo('paddock', 0, ny, 'right'); return true; }
  if (m === 'paddock' && nx < 0 && PADDOCK_ENTRY_ROWS.includes(ny)){ goTo('farm', COLS-1, ny, 'left'); return true; }
  return false;
}

/* ----- fields: planting and harvesting ----- */
export const cropReady = p => p.crop && now() - p.at >= CROPS[p.crop].time * 1000;
export function worldFx(text, x, y, col='#fff'){ pl.fx2.push({text, x: x*TILE + 8, y: y*TILE, t: 1, col}); }
export function plantPlot(i){
  const seed = state.seed || 'hay', c = CROPS[seed], [x, y] = plotPos(i);
  if (state.coins < c.seed) return toast(`Not enough coins for ${c.name.toLowerCase()} seeds (${c.seed} 🪙).`);
  state.coins -= c.seed;
  state.plots[i] = {crop: seed, at: now()};
  worldFx(`-${c.seed}🪙`, x, y, '#ffe9a6');
  $('#hud').innerHTML = hud(); save();
}
export function harvestPlot(i){
  const p = state.plots[i], c = CROPS[p.crop], [x, y] = plotPos(i);
  state.inv[p.crop] += c.yield;
  worldFx(`+${c.yield} ${c.name}`, x, y, '#d6f5b0');
  state.plots[i] = {crop:null, at:0};
  $('#hud').innerHTML = hud(); save();
}
export function buyFieldModal(){
  if (state.plots.length >= 12) return;
  showModal(`<div class="mpic" style="padding:20px">${cropImg('sprout', 72)}</div>
    <h2>Buy a new field?</h2><p>Dig up a new field to grow more crops for <b>${plotCost()} 🪙</b>.</p>
    <p><button data-act="closeModal">Not now</button> <button class="primary" data-act="buyPlotHere">Yes, dig it!</button></p>`);
}

export function interact(){
  if (state.tab !== 'stable' || pl.moving) return;
  const P = state.player, [fx, fy] = facing();
  const led = P.leading ? byId(P.leading) : null;
  if (curMap() === 'paddock'){
    if (fx < 0 && PADDOCK_ENTRY_ROWS.includes(fy)) return goTo('farm', COLS-1, fy, 'left');
    if (led){
      if (!inPaddock(P.x, P.y)) return toast(`Walk through the gate into the paddock to let ${led.name} go.`);
      led.out = true; P.leading = null; placeInPaddock(led, lead.x, lead.y);
      if (!rugOK(led)){ const W = WEATHER[state.weather || 'sunny']; toast(`${W.badIcon} ${led.name} needs a ${RUG_KINDS[W.needs].name.toLowerCase()} today! Put one on from ${led.sex==='F'?'her':'his'} card, or ${led.sex==='F'?'she':'he'} will get sad.`); save(); render(); return; }
      led.happy = clamp(led.happy + 5, 0, 100);
      const left = state.horses.filter(h => !h.out).length;
      toast(left ? `🌳 ${led.name} is out in the paddock! ${left} more to go.` : `🌳 ${led.name} is out! All your horses are in the paddock! 🎉`, 'good');
      save(); render(); return;
    }
    const h = horseNear(fx, fy) || horseNear(P.x, P.y);
    if (h){
      if (!isDaytime()) return;
      h.out = false; P.leading = h.id; resetLeadPos();
      toast(`🐴 ${h.name} is following you. Press E in the barn to put ${h.sex==='F'?'her':'him'} back in the stall.`);
      render(); return;
    }
    return toast('Walk up to a horse to lead it, or bring horses here from the barn!');
  }
  if (curMap() === 'farm'){
    if (isFarmDoor(fx, fy)) return goTo('barn');
    if (fx >= COLS && FARM_EXIT_ROWS.includes(fy)) return goTo('paddock', 0, fy, 'right');
    const i = plotAt(fx, fy);
    if (i >= 0){
      if (i >= state.plots.length) return buyFieldModal();
      const p = state.plots[i];
      if (!p.crop) return plantPlot(i);
      if (cropReady(p)) return harvestPlot(i);
      return toast(`🌱 ${CROPS[p.crop].name} will be ready in ${fmt(CROPS[p.crop].time - (now()-p.at)/1000)}.`);
    }
    return toast('Walk up to a field and press E to plant or harvest!');
  }
  if (fx < 0 && BARN_DOOR_ROWS.includes(fy)) return goTo('farm');
  if (led){
    P.leading = null; led.out = false;
    toast(`🐴 ${led.name} is back in ${led.sex==='F'?'her':'his'} stall.`);
    render(); return;
  }
  const st = stallAt(fx, fy);
  if (st >= 0){
    if (st >= state.cap) return toast('🔒 This stall is locked. Build more stalls in the 🏷️ Market!');
    const h = state.horses[st];
    if (!h) return toast('This stall is empty. Buy a horse at the 🏷️ Market!');
    return horseModal(h.id);
  }
  if (P.carry){
    if (!barnWalk(fx, fy) || isBarnDoorTile(fx, fy)) return toast("You can't put that there.");
    const d = {...P.carry, x:fx, y:fy};
    state.decor.push(d);
    if (!stillConnected()){ state.decor.pop(); return toast("That would block the way! Try another spot."); }
    P.carry = null; save(); return;
  }
  const d = decorAt(fx, fy);
  if (d){
    state.decor = state.decor.filter(x => x !== d);
    P.carry = {id:d.id, type:d.type}; save(); return;
  }
  toast('Walk up to a stall and press E to visit a horse!');
}
export function hintText(){
  const P = state.player, [fx, fy] = facing();
  const led = P.leading ? byId(P.leading) : null;
  if (curMap() === 'paddock'){
    if (fx < 0 && PADDOCK_ENTRY_ROWS.includes(fy)) return '← Back to the fields';
    if (led) return inPaddock(P.x, P.y) ? `Press E to let ${led.name} run free! 🌳` : `Lead ${led.name} through the gate into the paddock`;
    const h = horseNear(fx, fy) || horseNear(P.x, P.y);
    if (h) return isDaytime() ? `Press E to lead ${h.name}` : `${h.name} is sleepy`;
    const inside = state.horses.filter(x => !x.out).length;
    return inside ? `${inside} horse${inside>1?'s are':' is'} still in the barn` : '🌳 All your horses are out grazing!';
  }
  if (curMap() === 'farm'){
    if (isFarmDoor(fx, fy)) return led ? `Press E to take ${led.name} back into the barn` : 'Press E to go into the barn 🐴';
    if (fx >= COLS && FARM_EXIT_ROWS.includes(fy)) return 'Press E (or keep walking) to go to the paddock →';
    if (led) return `${led.name} is following you. The paddock is to the right →`;
    const i = plotAt(fx, fy);
    if (i >= 0){
      if (i >= state.plots.length) return `Press E to buy this field (${plotCost()}🪙)`;
      const p = state.plots[i];
      if (!p.crop){ const c = CROPS[state.seed || 'hay']; return `Press E to plant ${c.name.toLowerCase()} (${c.seed}🪙)`; }
      if (cropReady(p)) return `Press E to harvest the ${CROPS[p.crop].name.toLowerCase()}! ✨`;
      return `${CROPS[p.crop].name}: ready in ${fmt(CROPS[p.crop].time - (now()-p.at)/1000)}`;
    }
    const ready = state.plots.filter(cropReady).length;
    return ready ? `🌾 ${ready} field${ready>1?'s are':' is'} ready to harvest!` : 'Walk to your fields to plant and harvest 🌱';
  }
  if (fx < 0 && BARN_DOOR_ROWS.includes(fy)) return led ? `Take ${led.name} outside — the paddock is past the fields` : 'Press E to go outside to the fields 🌾';
  if (led) return `${led.name} is following you. Walk out the door on the left, or press E to put ${led.sex==='F'?'her':'him'} back`;
  const st = stallAt(fx, fy);
  if (st >= 0){
    if (st >= state.cap) return '🔒 Locked stall';
    const h = state.horses[st];
    return h ? `Press E to visit ${h.name}` : 'An empty stall';
  }
  if (P.carry) return barnWalk(fx, fy) ? `Press E to put down the ${SHOP[P.carry.type].name.toLowerCase()}` : `Carrying: ${SHOP[P.carry.type].name}`;
  const d = decorAt(fx, fy);
  if (d) return `Press E to pick up the ${SHOP[d.type].name.toLowerCase()}`;
  return 'Visit your horses, or walk out the door on the left to the fields 🌾';
}
export function startMove(nx, ny){
  const P = state.player;
  if (P.leading){ lead.tx = P.x; lead.ty = P.y; }
  pl.moving = true; pl.fx = P.x; pl.fy = P.y; pl.tx = nx; pl.ty = ny; pl.t = 0;
}
export function updatePlayer(dt){
  const P = state.player;
  if (pl.fade > 0) pl.fade = Math.max(0, pl.fade - dt*3);
  if (P.leading) updateLead(dt);
  updatePaddock(dt);
  for (const f of pl.fx2){ f.t -= dt; f.y -= 14*dt; }
  pl.fx2 = pl.fx2.filter(f => f.t > 0);
  if (pl.moving){
    pl.t += dt * 7;   // tiles per second
    pl.walkT += dt;
    if (pl.t >= 1){ pl.moving = false; P.x = pl.tx; P.y = pl.ty; }
  }
  if (!pl.moving){
    const dir = heldDir() || pl.tap; pl.tap = null;
    if (dir){
      pl.path = []; pl.after = null; P.dir = dir;
      const [dx,dy] = DIRS[dir];
      if (walkable(P.x+dx, P.y+dy)) startMove(P.x+dx, P.y+dy);
      else if (tryDoor(P.x+dx, P.y+dy)) return;
    } else if (pl.path.length){
      const [nx, ny] = pl.path.shift();
      P.dir = nx > P.x ? 'right' : nx < P.x ? 'left' : ny > P.y ? 'down' : 'up';
      if (walkable(nx, ny)) startMove(nx, ny); else { pl.path = []; pl.after = null; }
    } else if (pl.after){
      const a = pl.after; pl.after = null; P.dir = a.dir;
      if (a.interact) interact();
    }
  }
  const k = pl.moving ? pl.t : 1;
  pl.px = pl.moving ? pl.fx + (pl.tx - pl.fx)*k : P.x;
  pl.py = pl.moving ? pl.fy + (pl.ty - pl.fy)*k : P.y;
}
// walk next to (tx,ty), face it and use it
export function walkAndUse(goals){
  const P = state.player;
  const path = bfs(P.x, P.y, (x, y) => goals.some(g => g[0]===x && g[1]===y));
  if (!path) return toast("Can't get there!");
  const end = path.length ? path[path.length-1] : [P.x, P.y];
  const g = goals.find(g => g[0]===end[0] && g[1]===end[1]);
  pl.path = path; pl.after = {dir: g[2], interact: true};
}
export const around = (tx, ty) => Object.entries(DIRS).map(([d, [dx,dy]]) => [tx-dx, ty-dy, d]);
export function clickScene(e){
  const cv = e.currentTarget, r = cv.getBoundingClientRect();
  const tx = Math.floor(((e.clientX - r.left) / r.width * cv.width + camX) / TILE);
  let ty = Math.floor((e.clientY - r.top) / r.height * ROWS);
  const P = state.player;
  if (curMap() === 'paddock'){
    if (tx === 0 && PADDOCK_ENTRY_ROWS.includes(ty)) return walkAndUse([[0, ty, 'left']]);
    const h = horseNear(tx + .5, ty + .5);
    if (h && !state.player.leading) return walkAndUse(around(Math.round(pdk[h.id].x), Math.round(pdk[h.id].y)).filter(g => paddockWalk(g[0], g[1])));
    if (paddockWalk(tx, ty)){ pl.path = bfs(P.x, P.y, (x,y) => x===tx && y===ty) || []; pl.after = null; }
    return;
  }
  if (curMap() === 'farm'){
    if (tx === COLS-1 && FARM_EXIT_ROWS.includes(ty)) return walkAndUse([[COLS-1, ty, 'right']]);
    if (tx <= 4 && ty <= 4) return walkAndUse(FARM_DOOR_X.map(x => [x, FARM_DOOR_Y + 1, 'up']));
    if (plotAt(tx, ty) >= 0) return walkAndUse(around(tx, ty));
    if (farmWalk(tx, ty)){ pl.path = bfs(P.x, P.y, (x,y) => x===tx && y===ty) || []; pl.after = null; }
    return;
  }
  if (isBarnDoorTile(tx, ty)) return walkAndUse([[0, ty, 'left']]);
  if (barnWalk(tx, ty)){ pl.path = bfs(P.x, P.y, (x,y) => x===tx && y===ty) || []; pl.after = null; return; }
  // clicked a stall or a decoration: walk next to it, face it, and use it
  if (ty === 2) ty = 3; if (ty === 9) ty = 8;
  const st = stallAt(tx, ty);
  if (st >= 0){
    const x0 = (st % 8) * 2, gy = ty === 3 ? AISLE_TOP : AISLE_BOT, dir = ty === 3 ? 'up' : 'down';
    return walkAndUse([[x0, gy, dir], [x0+1, gy, dir]]);
  }
  if (inAisle(tx, ty) && decorAt(tx, ty)) walkAndUse(around(tx, ty));
}

