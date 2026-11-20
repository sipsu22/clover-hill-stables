// Game clock: tick, day/night rules, saving and loading.
import { clamp, esc, now } from './util.js';
import { fullName, phen } from './genetics.js';
import { CROPS, MORNING_END, NIGHT, RUG_KINDS, SAVE_KEY, T, WEATHER, clock, clockText, outCount, rollWeather, rugOK } from './data.js';
import { decay, discover, makeHorse, refreshMarket, state } from './state.js';
import { nameModal, toast } from './ui.js';
import { render, updateLive } from './views.js';

/* ---------- game loop ---------- */
export function tick(){
  const t = now(), sec = Math.max(0, (t - state.last) / 1000);
  state.last = t;
  let changed = false;
  for (const h of state.horses) decay(h, sec);
  changed = dayRules(t, sec) || changed;
  for (const h of [...state.horses]){
    if (h.adultAt && t >= h.adultAt){ h.adultAt = 0; toast(`🎉 ${h.name} is all grown up!`, 'good'); changed = true; }
    if (h.preg && t >= h.preg.due){
      if (state.horses.length >= state.cap){
        if (!h.preg.warned){ h.preg.warned = true; toast(`${h.name}'s foal is ready, but the stable is full! Build more stalls in the 🏷️ Market.`); }
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
  for (const p of state.plots) if (p.crop && !p.ready && t - p.at >= CROPS[p.crop].time*1000){ p.ready = true; newlyReady++; if (state.tab === 'farm') changed = true; }
  if (newlyReady) toast(`🌾 ${newlyReady} field${newlyReady>1?'s are':' is'} ready to harvest!`, 'good');
  for (const p of state.plots) if (!p.crop) delete p.ready;
  if (t >= state.marketAt){ refreshMarket(); if (state.tab === 'market') changed = true; }
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
    for (const h of state.horses) h.out = false;
    P.leading = null; changed = true;
    if (c.hour < MORNING_END){
      const W = WEATHER[state.weather], need = RUG_KINDS[W.needs].name.toLowerCase();
      toast(`${W.icon} Good morning! Day ${c.day}. It's ${W.name.toLowerCase()} today, so put a ${need} on each horse and take them to the paddock before ${clockText(MORNING_END)}!`, 'gold');
    }
  }
  // 12:00 — anyone still inside gets sad
  if (lastHour !== null && lastHour < MORNING_END && c.hour >= MORNING_END){
    const sad = state.horses.filter(h => !h.out && P.leading !== h.id);
    for (const h of sad) h.happy = clamp(h.happy - 20, 0, 100);
    if (sad.length) toast(`😢 ${sad.map(h => h.name).join(', ')} didn't get to go out this morning and ${sad.length > 1 ? 'are' : 'is'} sad.`);
    else if (state.horses.length) toast('🌳 Great job! Every horse made it to the paddock this morning!', 'good');
    changed = true;
  }
  // 21:00 — night falls, everyone comes back in
  if (c.hour >= NIGHT && (outCount() || P.leading)){
    for (const h of state.horses) h.out = false;
    P.leading = null; changed = true;
    toast('🌙 Night falls. Your horses walked back into their stalls to sleep.');
  }
  // while playing: grazing makes horses happy, being stuck inside makes them sad
  if (sec < 5){
    for (const h of state.horses){
      if (h.out && rugOK(h)){ h.happy = clamp(h.happy + .09*sec, 0, 100); h.hunger = clamp(h.hunger + .04*sec, 0, 100); }
      else if (h.out){ h.happy = clamp(h.happy - .08*sec, 0, 100); h.hunger = clamp(h.hunger + .04*sec, 0, 100); }
      else if (c.hour >= MORNING_END && c.hour < NIGHT && P.leading !== h.id) h.happy = clamp(h.happy - .06*sec, 0, 100);
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
      return s;
    }
  } catch(e){}
  return null;
}

