// Everything a button can do (ACT) and the click/keyboard dispatch.
import { $, clamp, esc, fmt, now, pick, randi } from './util.js';
import { horseImg } from './sprites.js';
import { inherit } from './genetics.js';
import { BREED_COST, BUNDLES, CROPS, DNA_COST, FOOD, REFRESH_COST, RUG_COLORS, RUG_KINDS, SADDLES, SAVE_KEY, SHOP, T, bundlePrice, isDaytime, rugOK } from './data.js';
import { byId, discover, isFoal, look, marketPrice, newGame, plotCost, readiness, refreshMarket, saddleOf, stableCost, state, value } from './state.js';
import { closeModal, nameModal, pop, showModal, toast } from './ui.js';
import { openHorse, render } from './views.js';
import { curMap, facing, freeSpot, goTo, interact, resetLeadPos, stallAt } from './world.js';
import { RIDE_MODES, clearRide, endRide, ride, rideJump, startRide } from './riding.js';
import { save } from './game.js';

/* ---------- actions ---------- */
export function spend(n){
  if (state.coins < n){ toast(`Not enough coins! You need ${n} 🪙.`); return false; }
  state.coins -= n; return true;
}
export const ACT = {
  tab(_, arg){ if (ride && arg !== 'ride') endRide(true); state.tab = arg; render(); scrollTo(0,0); },
  startRide(){ startRide(); if (ride) scrollTo(0, 0); },
  jump(_, __, b){ if (b && b.dataset.fired){ delete b.dataset.fired; return; } rideJump(); },
  quitRide(){ endRide(true); },
  rideSel(id){ state.rideSel = id; render(); },
  rideMode(_, m){
    state.rideMode = m;
    if (RIDE_MODES[m].comp) state.rideLevel = Math.min(state.rideLevel || 0, (state.unlocked || {})[m] || 0);
    render();
  },
  rideLevel(_, l){ state.rideLevel = +l; render(); },
  trainFocus(_, f){ state.trainFocus = f; render(); },
  plant(i, crop, el){
    const c = CROPS[crop]; if (!spend(c.seed)) return;
    state.plots[i] = {crop, at: now()}; pop('🌱', el); render();
  },
  harvest(i, _, el){
    const p = state.plots[i]; if (!p.crop || now()-p.at < CROPS[p.crop].time*1000) return;
    state.inv[p.crop] += CROPS[p.crop].yield; pop('+' + CROPS[p.crop].yield, el);
    state.plots[i] = {crop:null, at:0}; render();
  },
  harvestAll(){
    let n = 0;
    state.plots.forEach((p, i) => { if (p.crop && now()-p.at >= CROPS[p.crop].time*1000){ state.inv[p.crop] += CROPS[p.crop].yield; state.plots[i] = {crop:null,at:0}; n++; } });
    if (n) toast(`Harvested ${n} field${n>1?'s':''}!`, 'good'); render();
  },
  sellCrop(_, arg, el){
    const [k, amt] = arg.split(':'); const n = amt === 'all' ? state.inv[k] : Math.min(1, state.inv[k]);
    if (!n) return; state.inv[k] -= n; state.coins += n * CROPS[k].sell; pop('+' + n*CROPS[k].sell + '🪙', el); render();
  },
  buyPlot(){ if (state.plots.length < 12 && spend(plotCost())){ state.plots.push({crop:null,at:0}); toast('New field ready to plant!','good'); render(); } },
  buyPlotHere(){ closeModal(); ACT.buyPlot(); },
  seed(_, k){ state.seed = k; render(); },
  goFields(){ state.tab = 'stable'; if (curMap() !== 'farm') goTo('farm'); else render(); scrollTo(0,0); },
  upgradeStable(){ if (spend(stableCost())){ state.cap += 2; toast('Your stable is bigger now! 🏠','good'); render(); } },
  feed(id, food, el){
    const h = byId(id), f = FOOD[food];
    if (state.inv[food] < 1){ toast(`No ${CROPS[food].name.toLowerCase()} left! Plant some in your fields outside the barn.`); return; }
    if (f.hunger > 10 && h.hunger >= 97){ toast(`${h.name} is full! Try a carrot or brushing instead.`); return; }
    state.inv[food]--; h.hunger = clamp(h.hunger + f.hunger, 0, 100); h.happy = clamp(h.happy + f.happy, 0, 100);
    pop(food === 'carrot' ? '🥕' : '😋', el); render();
  },
  brush(id, _, el){
    const h = byId(id), left = (h.brushAt - now())/1000;
    if (left > 0){ toast(`${h.name} is already shiny! Brush again in ${fmt(left)}.`); return; }
    h.happy = clamp(h.happy + 12, 0, 100); h.brushAt = now() + T.brush*1000; pop('✨', el); render();
  },
  dna(id){
    const h = byId(id); if (h.tested) return;
    if (state.dnaFree > 0) state.dnaFree--; else if (!spend(DNA_COST)) return;
    h.tested = true; toast(`🧬 ${h.name}'s genes are revealed!`, 'good'); render();
  },
  sell(id){
    const h = byId(id);
    if (h.preg){ toast(`${h.name} is expecting a foal. Wait until it's born!`); return; }
    if (openHorse !== null) closeModal();
    showModal(`<div class="mpic">${horseImg(look(h), 5)}</div>
      <h2>Sell ${esc(h.name)}?</h2><p>You'll get <b>${value(h)} 🪙</b>. This can't be undone.${saddleOf(h) ? ' The saddle goes back on your wall.' : ''}</p>
      <p><button data-act="closeModal">Keep ${esc(h.name)}</button> <button class="danger" data-act="sellYes" data-id="${h.id}">Yes, sell</button></p>`);
  },
  sellYes(id){
    const h = byId(id); closeModal(); if (!h) return;
    if (state.player.leading === id) state.player.leading = null;
    state.coins += value(h); state.horses = state.horses.filter(x => x !== h);
    if (state.sel.F === id) state.sel.F = null; if (state.sel.M === id) state.sel.M = null;
    toast(`Sold ${h.name} for ${value(h)} 🪙. Goodbye, ${h.name}! 👋`); render();
  },
  buyItem(_, type){
    const spot = freeSpot();
    if (!spot){ toast('Your stable aisle is full! Sell... just kidding, move things around to make room.'); return; }
    if (!spend(SHOP[type].price)) return;
    state.decor.push({id: Date.now(), type, x: spot[0], y: spot[1]});
    if (type === 'hayBale'){ state.inv.hay += 10; toast('Hay bale delivered to your stable! +10 🌿 hay', 'good'); }
    else toast(`${SHOP[type].name} delivered to your stable! 🏠`, 'good');
    render();
  },
  buyBundle(_, bid){
    const b = BUNDLES.find(x => x.id === bid); if (!b) return;
    if (b.stalls && state.cap + b.stalls > 16) return toast('Your stable is already the biggest it can be!');
    // make sure every decoration has a spot before taking any coins
    const spots = [];
    for (const d of b.decor || []){
      const s = freeSpot(); if (!s){ spots.forEach(() => state.decor.pop()); return toast('Not enough room in your stable aisle for the decorations. Move some things around first!'); }
      const tmp = {id: Date.now() + spots.length, type: d, x: s[0], y: s[1]}; state.decor.push(tmp); spots.push(tmp);
    }
    if (!spend(bundlePrice(b))){ spots.forEach(() => state.decor.pop()); return; }
    for (const [k, n] of Object.entries(b.items || {})) state.inv[k] += n;
    if (spots.some(d => d.type === 'hayBale')) state.inv.hay += 10 * spots.filter(d => d.type === 'hayBale').length;
    if (b.saddle) state.saddles.push({id: Date.now(), type: b.saddle});
    (b.rugs || []).forEach(([kind, color], i) => state.rugs.push({id: Date.now() + 10 + i, kind, color}));
    if (b.dna) state.dnaFree = (state.dnaFree || 0) + b.dna;
    if (b.stalls) state.cap += b.stalls;
    toast(`🎁 ${b.name} unpacked! Enjoy!`, 'good'); render();
  },
  buySaddle(_, type){
    if (!spend(SADDLES[type].price)) return;
    state.saddles.push({id: Date.now(), type});
    toast(`New ${SADDLES[type].name} saddle! It's hanging on your stable wall.`, 'good'); render();
  },
  rug(id, arg, el){
    const h = byId(id); if (!h) return;
    if (arg === 'none'){ h.rug = null; render(); return; }
    const [kind, color] = arg.split(':');
    const used = new Set(state.horses.map(x => x.rug));
    const r = state.rugs.find(r => r.kind === kind && r.color === color && !used.has(r.id));
    if (!r) return;
    h.rug = r.id; pop(RUG_KINDS[kind].icon, el);
    if (h.out && rugOK(h)) toast(`${h.name} is cozy now! 🥰`, 'good');
    render();
  },
  buyRug(_, arg){
    const [kind, color] = arg.split(':');
    if (!spend(RUG_KINDS[kind].price)) return;
    state.rugs.push({id: Date.now(), kind, color});
    toast(`New ${RUG_COLORS[kind][color].name.toLowerCase()} ${RUG_KINDS[kind].name.toLowerCase()}! Put it on a horse from its card.`, 'good'); render();
  },
  equip(id, type, el){
    const h = byId(id); if (!h || isFoal(h)) return;
    if (type === 'none'){ h.saddle = null; render(); return; }
    const used = new Set(state.horses.map(x => x.saddle));
    const s = state.saddles.find(s => s.type === type && !used.has(s.id));
    if (!s) return;
    h.saddle = s.id; h.happy = clamp(h.happy + 5, 0, 100); pop('🐎', el);
    render();
  },
  interact(){ interact(); },
  lead(id){
    const h = byId(id), P = state.player; if (!h) return;
    if (!isDaytime()) return toast('🌙 It\'s night. The horses are sleeping!');
    if (P.carry) return toast('Put down what you are carrying first.');
    if (P.leading) return toast(`You're already leading ${byId(P.leading).name}. One horse at a time!`);
    // no teleporting: you have to be standing at this horse's stall in the barn
    const [fx, fy] = facing();
    if (curMap() !== 'barn' || state.horses[stallAt(fx, fy)] !== h)
      return toast(`Walk to ${h.name}'s stall in the barn to lead ${h.sex==='F'?'her':'him'} out.`);
    h.out = false; P.leading = id;
    if (openHorse !== null) closeModal();
    resetLeadPos();
    toast(`🐴 ${h.name} is following you. Walk out of the barn, past the fields, to the paddock on the right!`, 'good');
    render();
  },
  rename(id){ const h = byId(id); if (openHorse !== null) closeModal(); nameModal(h, 'Rename horse', `Give ${esc(h.name)} a new name:`); },
  saveName(id){
    const h = byId(id), v = $('#nameIn').value.trim();
    if (h && v) h.name = v.slice(0,16);
    closeModal(); render();
  },
  closeModal(){ closeModal(); },
  select(id){
    const h = byId(id); const k = h.sex;
    state.sel[k] = state.sel[k] === id ? null : id; render();
  },
  breed(){
    const m = byId(state.sel.F), s = byId(state.sel.M);
    if (!m || !s) return;
    for (const h of [m, s]){ const r = readiness(h); if (r){ toast(`${h.name}: ${r}`); return; } }
    if (!spend(BREED_COST)) return;
    const stat = (a, b) => clamp(Math.round((a+b)/2 + randi(-6, 10)), 1, 100);
    m.preg = {due: now() + T.pregnancy*1000, sire: s.name, warned:false, foal: {
      genes: inherit(m, s), sex: pick(['F','M']),
      speed: stat(m.speed, s.speed), stamina: stat(m.stamina, s.stamina), temper: stat(m.temper, s.temper),
      face: pick([m.face, s.face, pick(['none','star','blaze'])]),
      socks: clamp(pick([m.socks, s.socks]) + randi(-1,1), 0, 4),
    }};
    s.restUntil = now() + T.rest*1000;
    state.sel = {F:null, M:null};
    toast(`💞 ${m.name} is expecting a foal! It will be born in ${T.pregnancy} seconds.`, 'good'); render();
  },
  buy(i){
    const h = state.market[i]; if (!h) return;
    if (state.horses.length >= state.cap){ toast('Your stable is full! Build more stalls at the top of the 🏷️ Market.'); return; }
    if (!spend(marketPrice(h))) return;
    state.market.splice(i, 1); state.horses.push(h); discover(h);
    toast(`Welcome home, ${h.name}! 🐴`, 'good'); render();
  },
  refresh(){ if (spend(REFRESH_COST)){ refreshMarket(); render(); } },
  start(){ state.intro = false; closeModal(); },
  reset(){
    if (openHorse !== null) closeModal();
    showModal(`<h2>Start over?</h2><p>All your horses, coins and progress will be lost. This can't be undone.</p>
      <p><button data-act="closeModal">Keep playing</button> <button class="danger" data-act="resetYes">Yes, start over</button></p>`);
  },
  resetYes(){
    closeModal(); clearRide();
    try { localStorage.removeItem(SAVE_KEY); } catch(e){}
    newGame(); state.intro = false; render(); toast('A fresh start at Clover Hill! 🍀');
  },
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const fn = ACT[b.dataset.act]; if (!fn) return;
  const id = b.dataset.id !== undefined ? +b.dataset.id : undefined;
  fn(id, b.dataset.arg, b); save();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'nameIn') ACT.saveName(+e.target.dataset.id);
});

