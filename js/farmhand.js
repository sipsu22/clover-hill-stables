// The farmhand, Sam: hire them at the village notice board for a daily wage.
// Every day Sam puts the right sheet on each horse (from the rugs you own), leads the horses
// to the paddock ONE AT A TIME (you can see them walking along the path: no teleporting),
// and feeds hungry horses from your storage (hay first, then oats, then carrots).
// If you can't pay the wage in the morning, Sam goes home.
import { clamp, esc, now } from './util.js';
import { FOOD, RUG_KINDS, WEATHER, isDaytime, rugOK } from './data.js';
import { byId, state } from './state.js';
import { showModal, toast } from './ui.js';
import { placeInPaddock } from './world.js';

export const FARMHAND_NAME = 'Sam';
export const WAGE = 40;              // coins per day
export const TRIP_SECONDS = 6;       // how long Sam takes to walk one horse to the paddock
export const FEED_BELOW = 45;        // Sam feeds horses whose food bar is lower than this
export const FEED_GAP = 30;          // seconds between two feedings of the same horse

const F = () => state.farmhand || (state.farmhand = {hired: false});
export const isHired = () => !!(state.farmhand && state.farmhand.hired);

/** Put the right rug for today's weather on every horse that needs one (using rugs you own). */
export function dressAll(){
  const need = WEATHER[state.weather || 'sunny'].needs;
  let n = 0;
  for (const h of state.horses){
    if (rugOK(h)) continue;
    const used = new Set(state.horses.map(x => x.rug));
    const r = state.rugs.find(r => r.kind === need && !used.has(r.id));
    if (r){ h.rug = r.id; n++; }
  }
  return n;
}

export function hire(){
  const f = F(); if (f.hired) return;
  if (state.coins < WAGE) return toast(`You need ${WAGE} 🪙 to pay ${FARMHAND_NAME}'s first day.`);
  state.coins -= WAGE;
  Object.assign(f, {hired: true, paidDay: state.day, trip: null, fed: {}, noFoodDay: -1});
  dressAll();
  toast(`🧑‍🌾 ${FARMHAND_NAME} works for you now! ${WAGE} 🪙 a day, paid every morning.`, 'good');
}
export function letGo(){
  const f = F(); if (!f.hired) return;
  if (f.trip){ const h = byId(f.trip.id); if (h) delete h.withHand; }
  f.hired = false; f.trip = null;
  toast(`👋 ${FARMHAND_NAME} says goodbye. You can hire ${FARMHAND_NAME} again at the notice board.`);
}

/** Morning: pay the wage and dress the horses. Returns true if Sam works today. */
export function farmhandNewDay(){
  const f = state.farmhand;
  if (!f || !f.hired) return false;
  if (f.paidDay !== state.day){
    if (state.coins < WAGE){
      f.hired = false; f.trip = null;
      toast(`🧑‍🌾 You couldn't pay ${FARMHAND_NAME}'s wage (${WAGE} 🪙), so ${FARMHAND_NAME} went home. Hire again at the village notice board.`);
      return false;
    }
    state.coins -= WAGE; f.paidDay = state.day;
  }
  f.trip = null;
  dressAll();
  return true;
}

// horses Sam still has to take out today
const waiting = h => !h.out && !h.outToday && !h.pen && !h.withHand && state.player.leading !== h.id;

/** Every second while it's daytime: walk horses out, feed hungry ones. Returns true if something changed. */
export function farmhandTick(sec){
  const f = state.farmhand;
  if (!f || !f.hired || !isDaytime()) return false;
  let changed = false;
  if (f.trip){
    const h = byId(f.trip.id);
    if (!h || !h.withHand) f.trip = null;
    else {
      f.trip.t += sec;
      if (f.trip.t >= TRIP_SECONDS){
        delete h.withHand; h.out = true; h.outToday = true;
        placeInPaddock(h, 4.5, 6.5);            // let go just inside the paddock gate
        f.trip = null; changed = true;
      }
    }
  }
  if (!f.trip){
    const h = state.horses.find(waiting);
    if (h){
      if (!rugOK(h)) dressAll();
      h.withHand = true; f.trip = {id: h.id, t: 0}; changed = true;
    }
  }
  f.fed = f.fed || {};
  for (const h of state.horses){
    if (h.hunger >= FEED_BELOW || now() - (f.fed[h.id] || 0) < FEED_GAP * 1000) continue;
    const food = ['hay', 'oats', 'carrot'].find(k => state.inv[k] > 0);
    if (!food){
      if (f.noFoodDay !== state.day){ f.noFoodDay = state.day; toast(`🧑‍🌾 ${FARMHAND_NAME}: “We're out of horse food! Grow some or buy some at the market.”`); }
      break;
    }
    state.inv[food]--;
    h.hunger = clamp(h.hunger + FOOD[food].hunger, 0, 100);
    h.happy = clamp(h.happy + FOOD[food].happy + 3, 0, 100);
    f.fed[h.id] = now(); changed = true;
  }
  return changed;
}

/** Sam's current walk: which horse and how far along (0..1), or null. */
export function tripProgress(){
  const f = state.farmhand;
  if (!f || !f.hired || !f.trip) return null;
  const h = byId(f.trip.id);
  return h ? {h, p: Math.min(1, f.trip.t / TRIP_SECONDS)} : null;
}

/* ---------- the notice board in the village ---------- */
export function hireHTML(){
  const hired = isHired(), W = WEATHER[state.weather || 'sunny'];
  const left = state.horses.filter(waiting).length;
  return `<button class="closex" data-act="closeModal">✕</button>
    <h2>📋 Help wanted</h2>
    <div class="riderline"><span class="bigface">🧑‍🌾</span><span><b>${FARMHAND_NAME}, farmhand</b><br><small>${WAGE} 🪙 a day, paid every morning</small></span></div>
    <p>${esc(FARMHAND_NAME)} helps every day:</p>
    <ul class="duties">
      <li>🧥 puts the right sheet on each horse (today: ${W.icon} ${RUG_KINDS[W.needs].name.toLowerCase()}, from the rugs you own)</li>
      <li>🌳 walks each horse to the paddock, one at a time</li>
      <li>🌿 feeds hungry horses from your storage (hay, oats, carrots)</li>
    </ul>
    ${hired ? `<p class="center"><b>✅ ${FARMHAND_NAME} is working for you.</b> ${left ? `${left} horse${left > 1 ? 's' : ''} still to take out today.` : 'Everyone has been out today!'}</p>
      <p class="center"><button class="danger" data-act="fireHand">Let ${FARMHAND_NAME} go</button></p>`
    : `<p class="center"><button class="primary" data-act="hireHand" style="font-size:16px;padding:10px 16px">Hire ${FARMHAND_NAME} (${WAGE} 🪙 today)</button></p>
      <p class="center sd">You'll still be able to lead, feed and care for horses yourself.</p>`}`;
}
export function openHireBoard(){
  showModal(hireHTML(), () => document.getElementById('mbox').classList.add('menu'), hireHTML);
}
