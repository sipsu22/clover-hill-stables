// The saved game state and rules about horses (value, mood, readiness, hunger...).
import { clamp, fmt, now, pick, randi, round5 } from './util.js';
import { phen, randomGenes } from './genetics.js';
import { COLOR_VALUE, MORNING_END, NAMES, NIGHT, RUG_KINDS, WEATHER, clock, rugOK, rugOf } from './data.js';
import { toast } from './ui.js';

/* ---------- state ---------- */
export let state;
export function setState(s){ state = s; }
export function makeHorse(o={}){
  return Object.assign({
    id: state.nextId++, name: pickName(), sex: pick(['F','M']), genes: randomGenes(),
    speed: randi(15,55), stamina: randi(15,55), temper: randi(15,55),
    hunger: 80, happy: 70, adultAt: 0, preg: null, restUntil: 0, brushAt: 0,
    face: pick(['none','none','star','blaze']), socks: randi(0,2), tested: false,
    seed: Math.floor(Math.random()*1e9),
  }, o);
}
export function newGame(){
  state = {v:1, coins:150, inv:{hay:12,carrot:4,oats:4,potion:1}, bonds:{},
    plots: Array.from({length:4}, () => ({crop:null, at:0})),
    cap:4, horses:[], market:[], marketAt:0, found:{}, nextId:1, last:now(),
    tab:'stable', intro:true,
    decor:[{id:0,type:'hayBale',x:14,y:4}], saddles:[{id:0,type:'brown'}],
    player:{x:2, y:5, dir:'down', carry:null, map:'barn', leading:null}, seed:'hay',
    dayEpoch: now(), day: 0,
    rideMode: 'training', rideLevel: 0, trainFocus: 'speed', unlocked: {jumping:0, race:0}, trophies: [],
    weather: 'sunny', rugs: [{id:1, kind:'fly', color:'white'}, {id:2, kind:'rain', color:'navy'}]};
  state.horses.push(makeHorse({name:'Daisy', sex:'F', face:'blaze', socks:1, speed:40, stamina:35, temper:50,
    genes:{E:[1,0],A:[1,0],Cr:[0,0],D:[0,0],G:[0,0],TO:[1,0],LP:[0,0]}}));
  state.horses.push(makeHorse({name:'Sunny', sex:'M', face:'star', socks:2, speed:35, stamina:45, temper:40,
    genes:{E:[0,0],A:[1,0],Cr:[1,0],D:[0,0],G:[0,0],TO:[0,0],LP:[0,0]}}));
  state.horses.forEach(h => discover(h, false));
  refreshMarket(true);
}
export function pickName(){
  const used = new Set([...(state.horses||[]), ...(state.market||[])].map(h => h.name));
  const free = NAMES.filter(n => !used.has(n));
  return pick(free.length ? free : NAMES);
}
export const byId = id => state.horses.find(h => h.id === id);
export const isFoal = h => h.adultAt > now();
export const saddleOf = h => { const s = state.saddles.find(s => s.id === h.saddle); return s ? s.type : null; };
export const look = h => ({...phen(h.genes), face:h.face, socks:h.socks, seed:h.seed, foal:isFoal(h), saddle: isFoal(h) ? null : saddleOf(h), rug: rugOf(h)});
export const sexWord = h => h.sex === 'F' ? (isFoal(h) ? 'Filly' : 'Mare') : (isFoal(h) ? 'Colt' : 'Stallion');
export function value(h){
  const p = phen(h.genes);
  let v = COLOR_VALUE[p.color] + (p.pinto?120:0) + (p.appy?150:0) + (h.speed+h.stamina+h.temper)/3*1.5;
  if (isFoal(h)) v *= .6;
  return round5(v);
}
export function mood(h){
  if (h.happy >= 75) return 'Very happy 😄';
  if (h.happy >= 50) return 'Happy 🙂';
  if (h.happy >= 25) return 'Grumpy 😐';
  return 'Sad 😢';
}
export function readiness(h){
  if (isFoal(h)) return 'Too young';
  if (h.preg) return 'Expecting a foal';
  if (h.restUntil > now()) return `Resting ${fmt((h.restUntil-now())/1000)}`;
  if (h.hunger < 30) return 'Too hungry';
  if (h.happy < 50) return 'Needs to be happier';
  return null;
}
export function status(h){
  const t = now();
  if (h.preg){
    if (h.preg.due <= t) return '🍼 Foal is ready! Make room in the stable!';
    return `🤰 Foal due in ${fmt((h.preg.due-t)/1000)}`;
  }
  if (isFoal(h)) return `🌱 Grows up in ${fmt((h.adultAt-t)/1000)}`;
  if (state.player.leading === h.id) return '🐴 Following you';
  if (h.pen) return '💕 Waiting in the Heart Barn';
  if (h.out && !rugOK(h)){ const W = WEATHER[state.weather || 'sunny']; return `${W.badIcon} ${W.why}! I need a ${RUG_KINDS[W.needs].name.toLowerCase()}.`; }
  if (h.out) return '🌳 Out in the paddock';
  if (h.restUntil > t) return `💤 Resting ${fmt((h.restUntil-t)/1000)}`;
  if (clock().hour >= MORNING_END && clock().hour < NIGHT) return '😢 Stuck inside — take me to the paddock!';
  if (h.hunger < 25) return '😟 Very hungry!';
  return '';
}
export function discover(h, reward=true){
  const p = phen(h.genes);
  const keys = [p.color]; if (p.pinto) keys.push('Pinto'); if (p.appy) keys.push('Appaloosa');
  for (const k of keys) if (!state.found[k]){
    state.found[k] = true;
    if (reward){ state.coins += 50; toast(`📖 New in your Horse Book: ${k}! +50 🪙`, 'gold'); }
  }
}
export function decay(h, sec){
  const HR = .08, HAP = .04, HUNGRY = .2;
  const tLow = Math.max(0, (h.hunger - 25) / HR);
  const lowSec = Math.max(0, sec - tLow);
  h.hunger = clamp(h.hunger - HR*sec, 0, 100);
  const cozy = 1 - decorBonus();
  h.happy = clamp(h.happy - HAP*cozy*sec - HUNGRY*lowSec, 0, 100);
}
// each decoration makes happiness drop 5% slower (up to 50%)
export const decorBonus = () => Math.min(.5, (state.decor ? state.decor.length + (state.player.carry ? 1 : 0) : 0) * .05);
export function refreshMarket(free){
  state.market = [];
  for (let i=0; i<3; i++) state.market.push(makeHorse({hunger:90, happy:70}));
  state.marketAt = now() + 180000;
}
export const marketPrice = h => round5(value(h) * 1.3);
export const plotCost = () => 50 + (state.plots.length - 4) * 40;
export const stableCost = () => 150 * (state.cap - 2) / 2;

