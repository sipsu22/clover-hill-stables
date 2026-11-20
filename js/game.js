// Game clock: tick, day/night rules, saving and loading.
import { clamp, esc, now } from './util.js';
import { fullName, phen } from './genetics.js';
import { CROPS, NIGHT, RUG_KINDS, SAVE_KEY, T, WEATHER, clock, outCount, rollWeather, rugOK } from './data.js';
import { decay, discover, makeHorse, refreshMarket, state } from './state.js';
import { updateBonds } from './affinity.js';
import { nameModal, toast } from './ui.js';
import { FARMHAND_NAME, farmhandNewDay, farmhandTick } from './farmhand.js';
import { render, updateLive } from './views.js';

/* ---------- game loop ---------- */
export function tick(){
  const t = now(), sec = Math.max(0, (t - state.last) / 1000);
  state.last = t;
  let changed = false;
  for (const h of state.horses) decay(h, sec);
  changed = dayRules(t, sec) || changed;
  if (farmhandTick(Math.min(sec, 60))) changed = true;   // Sam walks horses out and feeds them
  for (const h of [...state.horses]){
    if (h.adultAt && t >= h.adultAt){ h.adultAt = 0; toast(`🎉 ${h.name} is all grown up!`, 'good'); changed = true; }
    if (h.preg && t >= h.preg.due){
      if (state.horses.length >= state.cap){
        if (!h.preg.warned){ h.preg.warned = true; toast(`${h.name}'s foal is ready, but the stable is full! Build more stalls: press E at a locked stall in the barn.`); }
        continue;
      }
      const f = h.preg.foal, sire = h.preg.sire;
      const baby = makeHorse({...f, adultAt: t + T.grow*1000, hunger: 80, happy: 85});
      state.horses.push(baby); h.preg = null; h.restUntil = t + T.rest*1000;
      discover(baby);
      nameModal(baby, 'A foal is born! 🎉', `${esc(h.name)} and ${esc(sire)} had a <b>${fullName(phen(baby.genes))}</b> ${baby.sex==='F'?'filly':'colt'}! What will you name it?`);
      changed = true;
    }
  }
  let newlyReady = 0;
  for (const p of state.plots) if (p.crop && !p.ready && t - p.at >= CROPS[p.crop].time*1000){ p.ready = true; newlyReady++; }
  if (newlyReady) toast(`🌾 ${newlyReady} field${newlyReady>1?'s are':' is'} ready to harvest!`, 'good');
  for (const p of state.plots) if (!p.crop) delete p.ready;
  if (sec < 5) updateBonds(sec);          // friendships grow while you play
  if (changed) render(); else updateLive();
  save();
}
export let lastHour = null;
export function dayRules(t, sec){
  const c = clock(t), P = state.player;
  let changed = false;
  // a new day begins: everyone wakes up in the barn
  if (c.idx !== state.day){
    state.day = c.idx;
    state.weather = rollWeather();
    refreshMarket();                       // new horses at the dealer every morning
    for (const h of state.horses){ h.out = false; h.outToday = false; delete h.pen; delete h.withHand; }
    P.leading = null; changed = true;
    const working = farmhandNewDay();      // the farmhand gets paid, dresses the horses and plans the day
    if (c.hour < NIGHT){
      const W = WEATHER[state.weather], need = RUG_KINDS[W.needs].name.toLowerCase();
      toast(working ? `${W.icon} Good morning! Day ${c.day}, ${W.name.toLowerCase()} today. ${FARMHAND_NAME} is putting ${need}s on and taking the horses out.`
                    : `${W.icon} Good morning! Day ${c.day}. It's ${W.name.toLowerCase()} today: give every horse some paddock time (with a ${need})!`, 'gold');
    }
  }
  // horses only need SOME time outside during the day (not by a deadline)
  for (const h of state.horses) if (h.out) h.outToday = true;
  // 21:00 — horses that never got outside today are a little sad
  if (lastHour !== null && lastHour < NIGHT && c.hour >= NIGHT && state.horses.length){
    const missed = state.horses.filter(h => !h.outToday);
    for (const h of missed) h.happy = clamp(h.happy - 15, 0, 100);
    if (missed.length) toast(`😢 ${missed.map(h => h.name).join(', ')} didn't get outside today and ${missed.length > 1 ? 'are' : 'is'} a bit sad.`);
    else toast('🌳 Lovely! Every horse had paddock time today.', 'good');
    changed = true;
  }
  // 21:00 — night falls, everyone comes back in
  if (c.hour >= NIGHT && (outCount() || P.leading || state.horses.some(h => h.pen))){
    for (const h of state.horses){ h.out = false; delete h.pen; delete h.withHand; }
    P.leading = null; changed = true;
    toast('🌙 Night falls. Your horses walked back into their stalls to sleep.');
  }
  // while playing: grazing makes horses happy (if they wear the right rug for the weather)
  if (sec < 5){
    for (const h of state.horses){
      if (h.out && rugOK(h)){ h.happy = clamp(h.happy + .09*sec, 0, 100); h.hunger = clamp(h.hunger + .04*sec, 0, 100); }
      else if (h.out){ h.happy = clamp(h.happy - .08*sec, 0, 100); h.hunger = clamp(h.hunger + .04*sec, 0, 100); }
    }
  }
  lastHour = c.hour;
  return changed;
}
export function save(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e){} }
export function load(){
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.v === 1){
      // older saves: add the new stable things
      s.decor = s.decor || [{id:0,type:'hayBale',x:14,y:4}];
      s.saddles = s.saddles || [{id:0,type:'brown'}];
      s.player = s.player || {x:2, y:5, dir:'down', carry:null};
      s.player.map = s.player.map || 'barn';
      s.seed = s.seed || 'hay';
      if (!s.dayEpoch){ s.dayEpoch = Date.now(); s.day = 0; }
      if (s.player.leading === undefined) s.player.leading = null;
      s.weather = s.weather || 'sunny';
      s.unlocked = s.unlocked || {jumping:0, race:0}; s.trophies = s.trophies || [];
      if (s.stableHand){ s.coins += 500; delete s.stableHand; s.handRefund = true; }
      s.rugs = s.rugs || [{id:1, kind:'fly', color:'white'}, {id:2, kind:'rain', color:'navy'}];
      // the tab bar is gone: breeding uses love potions now, so give older farms one to try
      if (s.inv && s.inv.potion === undefined) s.inv.potion = 1;
      s.bonds = s.bonds || {};
      s.farmhand = s.farmhand || {hired: false};
      s.tab = 'stable'; delete s.sel;
      // the Horse Book stand stands at (15,7) in the barn: move any decoration that was there
      for (const d of s.decor || []) if (d.x === 15 && d.y === 7){
        const taken = (x, y) => s.decor.some(o => o !== d && o.x === x && o.y === y) || (x === 15 && y === 7) || x === 0;
        for (let y = 4; y <= 7 && d.x === 15 && d.y === 7; y++) for (let x = 14; x >= 1; x--) if (!taken(x, y)){ d.x = x; d.y = y; break; }
      }
      return s;
    }
  } catch(e){}
  return null;
}

