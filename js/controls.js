// Day banner, the animation loop and keyboard/touch controls.
import { $, clamp, fmt } from './util.js';
import { CROPS, DAY_MS, MORNING_END, NIGHT, RUG_KINDS, WEATHER, clock, clockText, outCount, rugOK } from './data.js';
import { state } from './state.js';
import { isNarrow, render, sceneBuf } from './views.js';
import { COLS, ROWS, TILE, clickScene, curMap, held, hintText, interact, pl, updatePlayer } from './world.js';
import { drawScene } from './world-draw.js';
import { RH, RW, drawRide, ride, rideBuf, rideHUD, rideJump, setSprint, startRide, updateRide } from './riding.js';

export let lastFrame = performance.now();
export let camX = 0;          // left edge of the phone camera, in world pixels
export let lastHint = '';
export function dayBanner(){
  const b = dayBannerFull();
  return isNarrow() && b.short ? {...b, text: b.short} : b;
}
export function dayBannerFull(){
  const c = clock(), total = state.horses.length, out = outCount(), inside = total - out;
  const left = (MORNING_END - c.hour) / 18 * DAY_MS / 1000;
  if (c.hour >= NIGHT) return {kind:'night', text:`🌙 Night time — your horses are asleep in the barn. A new day starts at 6:00.`, short:`🌙 Night: horses are asleep. New day at 6:00.`};
  if (!total) return {kind:'', text:`${clockText(c.hour)} · Buy a horse at the 🏷️ Market!`};
  const W0 = WEATHER[state.weather || 'sunny'], bad0 = state.horses.filter(h => h.out && !rugOK(h)).length;
  if (c.hour < MORNING_END){
    if (!inside && bad0) return {kind:'sad', text:`${W0.icon} It's ${W0.name.toLowerCase()}! ${bad0} horse${bad0>1?'s':''} in the paddock need${bad0>1?'':'s'} a ${RUG_KINDS[W0.needs].name.toLowerCase()}. Put one on from the horse cards below.`, short:`${W0.icon} ${bad0} horse${bad0>1?'s need':' needs'} a ${RUG_KINDS[W0.needs].name.toLowerCase()}!`};
    if (!inside) return {kind:'good', text:`🌅 Good morning! All ${total} horses are out in the paddock. 🌳`, short:`🌅 All ${total} horses are out in the paddock! 🌳`};
    const W = WEATHER[state.weather || 'sunny'];
    return {kind:'morning', text:`🌅 Morning! ${W.icon} ${W.name} today, so use ${RUG_KINDS[W.needs].name.toLowerCase()}s. Take your horses to the paddock before ${clockText(MORNING_END)} (${fmt(left)} left): ${out} of ${total} out. Lead them past the fields to the right →`,
      short:`🌅 ${W.icon} Paddock before ${clockText(MORNING_END)} · ${fmt(left)} left · ${out}/${total} out · use ${RUG_KINDS[W.needs].name.toLowerCase()}s`};
  }
  if (inside) return {kind:'sad', text:`😢 ${inside} horse${inside>1?'s are':' is'} stuck inside and getting sad. Take ${inside>1?'them':'it'} to the paddock!`, short:`😢 ${inside} horse${inside>1?'s':''} stuck inside, getting sad!`};
  const W = WEATHER[state.weather || 'sunny'], bad = state.horses.filter(h => h.out && !rugOK(h)).length;
  if (bad) return {kind:'sad', text:`${W.icon} It's ${W.name.toLowerCase()}! ${bad} horse${bad>1?'s':''} in the paddock need${bad>1?'':'s'} a ${RUG_KINDS[W.needs].name.toLowerCase()}. Put one on from the horse cards below.`, short:`${W.icon} ${bad} horse${bad>1?'s need':' needs'} a ${RUG_KINDS[W.needs].name.toLowerCase()}!`};
  return {kind:'good', text:`☀️ ${clockText(c.hour)} · All your horses are happily grazing in the paddock. 🌳`, short:`☀️ All horses are grazing happily. 🌳`};
}
export function frame(time){
  const dt = Math.min(.1, (time - lastFrame) / 1000); lastFrame = time;
  const rc = document.getElementById('ride');
  if (rc && state.tab === 'ride'){
    if (!rc.dataset.bound){ rc.dataset.bound = 1; rc.addEventListener('pointerdown', e => { e.preventDefault(); ride ? rideJump() : startRide(); }); }
    if (!$('#modal').classList.contains('on')) updateRide(dt);
    const rcv = document.getElementById('ride');
    if (rcv){
      if (rideBuf.width !== RW || rideBuf.height !== RH){ rideBuf.width = RW; rideBuf.height = RH; }
      drawRide(rideBuf, time);
      const rg = rcv.getContext('2d'); rg.imageSmoothingEnabled = false;
      rg.drawImage(rideBuf, 0, 0, rcv.width, RH, 0, 0, rcv.width, RH);
    }
    rideHUD();
  }
  const cv = document.getElementById('scene');
  if (cv && state.tab === 'stable'){
    if (!cv.dataset.bound){ cv.dataset.bound = 1; cv.addEventListener('pointerdown', clickScene); }
    if (!$('#modal').classList.contains('on')) updatePlayer(dt);
    if (sceneBuf.width !== COLS*TILE){ sceneBuf.width = COLS*TILE; sceneBuf.height = ROWS*TILE; }
    drawScene(sceneBuf, time);
    const vw = cv.width, sg = cv.getContext('2d'); sg.imageSmoothingEnabled = false;
    camX = clamp(Math.round(pl.px*TILE + 8 - vw/2), 0, COLS*TILE - vw);
    sg.drawImage(sceneBuf, camX, 0, vw, ROWS*TILE, 0, 0, vw, ROWS*TILE);
    const banner = dayBanner();
    const bEl = $('#dayBanner');
    if (bEl && bEl.dataset.t !== banner.text){ bEl.dataset.t = banner.text; bEl.textContent = banner.text; bEl.className = 'daybanner ' + banner.kind; }
    const hint = hintText();
    if (hint !== lastHint || !$('#hint').textContent){ lastHint = hint; $('#hint').textContent = hint; }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

export const KEY_DIR = {ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', w:'up', s:'down', a:'left', d:'right', W:'up', S:'down', A:'left', D:'right'};
export function sceneActive(e){ return state.tab === 'stable' && !$('#modal').classList.contains('on') && !(e.target.matches && e.target.matches('input,textarea')); }
document.addEventListener('keydown', e => {
  if (!sceneActive(e)) return;
  const dir = KEY_DIR[e.key];
  if (dir){ e.preventDefault(); if (!held.includes(dir)) held.push(dir); if (!e.repeat) pl.tap = dir; return; }
  if (e.key === 'e' || e.key === 'E' || e.key === ' '){ e.preventDefault(); if (!e.repeat) interact(); }
  if (curMap() === 'farm' && ['1','2','3'].includes(e.key)){ state.seed = Object.keys(CROPS)[+e.key - 1]; render(); }
});
document.addEventListener('keydown', e => {
  if (state.tab !== 'ride' || $('#modal').classList.contains('on')) return;
  if (e.target.matches && e.target.matches('input,textarea')) return;
  if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)){
    e.preventDefault();
    if (e.repeat) return;
    if (ride) rideJump(); else if (e.key === ' ') startRide();
  }
  if (['ArrowRight', 'd', 'D', 'Shift'].includes(e.key) && ride){ e.preventDefault(); setSprint(true); }
});
document.addEventListener('keyup', e => { if (['ArrowRight', 'd', 'D', 'Shift'].includes(e.key)) setSprint(false); });
document.addEventListener('pointerdown', e => { const b = e.target.closest('[data-act="jump"]'); if (b){ e.preventDefault(); rideJump(); b.dataset.fired = '1'; } });
document.addEventListener('contextmenu', e => { if (e.target.closest('canvas, button, .dpad, .mcard')) e.preventDefault(); });
export let wasNarrow = null;   // phone or desktop layout? set by initControls()
export function initControls(){ wasNarrow = isNarrow(); }
addEventListener('resize', () => { if (isNarrow() !== wasNarrow){ wasNarrow = isNarrow(); render(); } });
export let sprintPointer = null;   // which finger is holding Sprint
document.addEventListener('pointerdown', e => { const b = e.target.closest('#sprintBtn'); if (b){ e.preventDefault(); try { b.releasePointerCapture(e.pointerId); } catch(_){} setSprint(true); sprintPointer = e.pointerId; } });
['pointerup','pointercancel'].forEach(ev => document.addEventListener(ev, e => { if (e.pointerId === sprintPointer){ setSprint(false); sprintPointer = null; } }));
document.addEventListener('keyup', e => {
  const dir = KEY_DIR[e.key];
  if (dir){ const i = held.indexOf(dir); if (i >= 0) held.splice(i, 1); }
});
/* On-screen arrows: every finger is remembered on its own (finger id -> direction).
   The arrows live in a separate list from keyboard keys, so one can never leave the other stuck. */
export const padPointers = new Map();
export const heldDir = () => padPointers.size ? [...padPointers.values()].pop() : held[held.length-1];
export function releaseAllInput(){ held.length = 0; padPointers.clear(); setSprint(false); }
window.addEventListener('blur', releaseAllInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAllInput(); });
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-dir]'); if (!b) return;
  e.preventDefault();
  // touch screens "capture" the finger to the button; if the screen redraws, that button
  // disappears and the release could get lost, so let go of the capture right away
  try { b.releasePointerCapture(e.pointerId); } catch(_){}
  padPointers.set(e.pointerId, b.dataset.dir); pl.tap = b.dataset.dir;
});
// slide your thumb from one arrow to another
document.addEventListener('pointermove', e => {
  if (!padPointers.has(e.pointerId)) return;
  const el = document.elementFromPoint(e.clientX, e.clientY), b = el && el.closest('[data-dir]');
  if (b) padPointers.set(e.pointerId, b.dataset.dir);
});
['pointerup','pointercancel'].forEach(ev => document.addEventListener(ev, e => { padPointers.delete(e.pointerId); }));
