// Turns pixel maps into canvases/images: horses (coat, patterns, rugs, saddles), items, crops.
import { CROP_COLORS, HORSE_FRAMES, ITEM_COLORS, ITEM_COLOR_OVERRIDE, ITEM_SPR, OUTLINE, PALETTE, SADDLE_ON_HORSE, SADDLE_WALL, SIL, SPR, WHITE, WHITE_SH } from './sprite-data.js';
import { mixHex, mulberry, shade } from './util.js';
import { RUG_COLORS, SADDLES } from './data.js';
import { look } from './state.js';

/* ---------- sprite renderer ---------- */
export const sprCache = new Map();
export const urlCache = new Map();
// add a 1-pixel empty border so outlines fit, and make all rows the same width
export function pad(rows){
  const w = Math.max(...rows.map(r => r.length)) + 2;
  const line = '.'.repeat(w);
  return [line, ...rows.map(r => ('.' + r).padEnd(w, '.')), line];
}
export function mapCanvas(key, rows, colors, outline=OUTLINE){
  if (sprCache.has(key)) return sprCache.get(key);
  const grid = pad(rows).map(r => [...r].map(ch => colors[ch] || null));
  const c = gridToCanvas(grid, outline);
  sprCache.set(key, c);
  return c;
}
export function toURL(key, canvas){
  if (!urlCache.has(key)) urlCache.set(key, canvas.toDataURL());
  return urlCache.get(key);
}
export function gridToURL(grid, outline){ return gridToCanvas(grid, outline).toDataURL(); }
export function gridToCanvas(grid, outline){
  const h = grid.length, w = grid[0].length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  for (let y=0; y<h; y++) for (let x=0; x<w; x++){
    let col = grid[y][x];
    if (!col && outline){
      const near = (grid[y-1]&&grid[y-1][x]) || (grid[y+1]&&grid[y+1][x]) || grid[y][x-1] || grid[y][x+1];
      if (near) col = outline;
    }
    if (col){ ctx.fillStyle = col; ctx.fillRect(x,y,1,1); }
  }
  return c;
}
export function itemCanvas(type){
  return mapCanvas('item:'+type, ITEM_SPR[type], {...ITEM_COLORS, ...(ITEM_COLOR_OVERRIDE[type]||{})});
}
export function itemImg(type, scale=3){
  const c = itemCanvas(type);
  return `<img class="spr" src="${toURL('item:'+type, c)}" width="${c.width*scale}" height="${c.height*scale}" alt="${type}">`;
}
export function saddleColors(type){ const s = SADDLES[type]; return {a:s.a, A:s.A, p:s.p, K:'#b8c0c4'}; }
export function saddleCanvas(type){ return mapCanvas('saddle:'+type, SADDLE_WALL, saddleColors(type)); }
export function saddleImg(type, scale=2){
  const c = saddleCanvas(type);
  return `<img class="spr" src="${toURL('saddle:'+type, c)}" width="${c.width*scale}" height="${c.height*scale}" alt="saddle">`;
}
export function cropImg(name, size=48){
  const key = 'crop:'+name;
  if (!sprCache.has(key)){
    const grid = SPR[name].map(r => [...r].map(ch => CROP_COLORS[ch] || null));
    sprCache.set(key, gridToURL(grid, OUTLINE));
  }
  return `<img class="spr" src="${sprCache.get(key)}" width="${size}" height="${size}" alt="${name}">`;
}

// look = {color, pinto, appy, face, socks, seed, foal, sil, saddle}
export function horseURL(look){
  const key = JSON.stringify(look);
  return toURL(key, horseCanvas(look));
}
export function horseCanvas(look){
  const key = JSON.stringify(look);
  if (sprCache.has(key)) return sprCache.get(key);
  const rows = look.foal ? SPR.foal : look.frame ? HORSE_FRAMES[look.frame] : SPR.horse;
  const P = look.sil ? SIL : PALETTE[look.color];
  const rng = mulberry(look.seed || 7);
  const body = P.body, pts = P.points;
  const nSocks = look.sil ? 0 : Math.min(4, (look.socks||0) + (look.pinto ? 2 : 0));
  const sockLegs = ['4','3','2','1'].slice(0, nSocks);
  let firstF = -1;
  const coat = new Set(['B','L','b','S','D','F']);
  const grid = rows.map((row, y) => [...row].map((ch, x) => {
    if (look.sil) return ch === '.' ? null : P.body;
    switch (ch){
      case '.': return null;
      case 'B': return body;
      case 'L': return shade(body, .14);
      case 'b': return shade(body, -.1);
      case 'S': return shade(body, -.22);
      case 'D': return P.stripe || body;
      case 'F':
        if (firstF < 0) firstF = y;
        if (look.face === 'blaze' || (look.face === 'star' && y === firstF)) return WHITE;
        return body;
      case 'M': return P.mane;
      case 'I': return shade(body, -.35);
      case 'E': return P.eye || '#1a1210';
      case 'N': return shade(body, -.45);
      case 'H': return '#4a3b30';
      case '1': case '2':
        if (sockLegs.includes(ch)) return WHITE_SH;
        return pts ? shade(pts, -.12) : shade(body, -.22);
      case '3': case '4':
        if (sockLegs.includes(ch)) return WHITE;
        return pts || body;
    }
    return null;
  }));
  if (!look.sil){
    const isCoat = (x,y) => coat.has(rows[y][x]) && !(rows[y][x]==='F' && grid[y][x]===WHITE);
    const far = (x,y) => rows[y][x] === 'S';
    const W = rows[0].length, H = rows.length;
    // gray dapples
    if (P.dapple) for (let y=0;y<H;y++) for (let x=0;x<W;x++)
      if (isCoat(x,y) && rng() < .18) grid[y][x] = P.dapple;
    // appaloosa blanket over the hips + spots
    if (look.appy){
      const rumpX = look.foal ? 10 : 13, rumpY = look.foal ? 13 : 15;
      const spot = pts ? shade(pts, .05) : shade(body, body === '#2a2423' ? .1 : -.3);
      for (let y=0;y<H;y++) for (let x=0;x<W;x++){
        if (!isCoat(x,y)) continue;
        if (x <= rumpX && y <= rumpY && y >= 9){
          grid[y][x] = rng() < .2 ? spot : (far(x,y) ? WHITE_SH : WHITE);
        } else if (rng() < .05) grid[y][x] = WHITE;
      }
    }
    // pinto (tobiano) white patches
    if (look.pinto){
      const rng = mulberry((look.seed || 7) + 1);   // own dice, so patches match in every animation frame
      const blobs = [];
      const n = 2 + Math.floor(rng()*2);
      for (let i=0;i<n;i++) blobs.push({
        x: (look.foal ? 7 : 7) + rng()*(look.foal ? 11 : 15),
        y: 9 + rng()*(look.foal ? 5 : 7),
        rx: 2.5 + rng()*3, ry: 2 + rng()*3,
      });
      if (rng() < .5) blobs.push({x: look.foal?14:19, y: look.foal?8:9, rx:2.5, ry:3}); // shoulder/neck patch
      for (let y=0;y<H;y++) for (let x=0;x<W;x++){
        if (!isCoat(x,y)) continue;
        if (blobs.some(b => ((x-b.x)/b.rx)**2 + ((y-b.y)/b.ry)**2 <= 1))
          grid[y][x] = far(x,y) ? WHITE_SH : WHITE;
      }
    }
  }
  // horse rug / sheet over the body
  if (look.rug && !look.sil){
    const R = RUG_COLORS[look.rug.kind][look.rug.color], kind = look.rug.kind;
    const maxY = look.foal ? 13 : 15, maxX = look.foal ? 18 : 22;
    const cov = (x, y) => y >= 9 && y <= maxY && x >= 4 && x <= maxX && rows[y] && coat.has(rows[y][x]);
    const before = grid.map(r => r.slice());
    for (let y=9; y<=maxY; y++) for (let x=4; x<=maxX; x++){
      if (!cov(x, y)) continue;
      let col;
      if (kind === 'fly') col = (x + y) % 2 ? R.main : mixHex(before[y][x] || R.main, R.main);   // see-through mesh
      else if (kind === 'fleece') col = (x*7 + y*3) % 5 === 0 ? shade(R.main, .3) : R.main;     // fluffy
      else col = (y === 10 && x % 4 === 0) ? shade(R.main, .35) : R.main;                      // shiny waterproof
      if (!cov(x, y+1) || !cov(x-1, y) || !cov(x+1, y)) col = R.trim;
      grid[y][x] = col;
    }
  }
  // saddle on top (grown-up horses only)
  if (look.saddle && !look.foal && !look.sil){
    const col = saddleColors(look.saddle);
    SADDLE_ON_HORSE.forEach((row, dy) => [...row].forEach((ch, dx) => {
      if (ch !== '.') grid[8+dy][7+dx] = col[ch];
    }));
  }
  const canvas = gridToCanvas(grid, look.sil ? '#b9ae97' : OUTLINE);
  sprCache.set(key, canvas);
  return canvas;
}
export function horseImg(look, scale=5, extra=''){
  const w = (look.foal ? 26 : 32) * scale, h = 24 * scale;
  return `<img class="spr ${extra}" src="${horseURL(look)}" width="${w}" height="${h}" alt="horse">`;
}

