// Game data: crops, food, shop, saddles, rugs, weather, bundles, timings, day clock.
import { now, round5 } from './util.js';
import { stableCost, state } from './state.js';

/* ---------- game data ---------- */
export const CROPS = {
  hay:    {name:'Hay',     seed:4,  time:30, yield:3, sell:3},
  carrot: {name:'Carrots', seed:8,  time:60, yield:3, sell:6},
  oats:   {name:'Oats',    seed:12, time:90, yield:3, sell:9},
};
export const FOOD = {
  hay:    {hunger:35, happy:0,  msg:'Munch munch!'},
  oats:   {hunger:30, happy:10, msg:'Yum, oats!'},
  carrot: {hunger:5,  happy:20, msg:'Crunch! A carrot!'},
};
export const COLOR_VALUE = {Chestnut:80,Bay:80,Black:110,Palomino:160,Buckskin:160,'Smoky Black':150,Cremello:240,Perlino:240,'Smoky Cream':260,
  'Red Dun':180,'Bay Dun':180,Grulla:220,Dunalino:280,Dunskin:280,'Smoky Grulla':300,Gray:140};
export const BOOK = [
  ['Chestnut','A red-gold coat. Needs two e genes.'],
  ['Bay','Brown body with black legs, mane and tail. Needs E and A.'],
  ['Black','Needs an E gene and two a genes.'],
  ['Palomino','Chestnut + one Cream gene = golden!'],
  ['Buckskin','Bay + one Cream gene.'],
  ['Smoky Black','Black + one Cream gene. Looks almost black.'],
  ['Cremello','Chestnut + TWO Cream genes. Blue eyes!'],
  ['Perlino','Bay + TWO Cream genes. Blue eyes!'],
  ['Smoky Cream','Black + TWO Cream genes. Blue eyes!'],
  ['Red Dun','Chestnut + Dun gene. Look for the back stripe.'],
  ['Bay Dun','Bay + Dun gene.'],
  ['Grulla','Black + Dun gene. A mousy gray-brown.'],
  ['Dunalino','Palomino + Dun gene.'],
  ['Dunskin','Buckskin + Dun gene.'],
  ['Smoky Grulla','Smoky Black + Dun gene. Super rare!'],
  ['Gray','The Gray gene turns any color silvery.'],
  ['Pinto','Big white patches from the Tobiano gene.'],
  ['Appaloosa','A spotted blanket from the Leopard gene.'],
];
export const NAMES = ['Daisy','Maple','Pippin','Clover','Biscuit','Willow','Hazel','Comet','Juniper','Pepper','Thunder','Luna','Ginger','Misty','Storm','Honey','Bramble','Poppy','Rusty','Nutmeg','Shadow','Sparrow','Toffee','Aspen','Fudge','Blossom','Cinder','Ember','Fern','Olive','Rowan','Saffron','Teddy','Velvet','Ziggy','Acorn','Bluebell','Caramel','Dusty','Pebble','Marble','Button','Dandelion','Moonbeam','Sprinkles','Waffles','Nugget','Cocoa','Jasper','Tulip'];
export const SHOP = {
  hayBale:     {name:'Hay bale',     price:30,  desc:'Cozy! Comes with 10 hay for your horses.'},
  bucket:      {name:'Feed bucket',  price:25,  desc:'A shiny bucket full of oats.'},
  barrel:      {name:'Barrel',       price:35,  desc:'Good old wooden barrel.'},
  flowers:     {name:'Flower pot',   price:40,  desc:'Pretty pink flowers.'},
  lantern:     {name:'Lantern',      price:45,  desc:'A warm glow for the stable.'},
  trough:      {name:'Water trough', price:60,  desc:'Fresh water for thirsty horses.'},
  wheelbarrow: {name:'Wheelbarrow',  price:70,  desc:'For mucking out the stalls.'},
  cat:         {name:'Barn cat',     price:120, desc:'A sleepy, purring friend.'},
};
export const SADDLES = {
  brown: {name:'Classic brown', price:80,  a:'#8b5a2b', A:'#5e3a1a', p:'#efe6d2'},
  black: {name:'Midnight black',price:100, a:'#3a3330', A:'#1a1614', p:'#c94b4b'},
  red:   {name:'Cherry red',    price:120, a:'#c0452f', A:'#7d2619', p:'#f4ead0'},
  blue:  {name:'Sky blue',      price:120, a:'#4a7fc0', A:'#2b5288', p:'#f4f0e4'},
  green: {name:'Clover green',  price:120, a:'#5f9a3e', A:'#3d6a25', p:'#f6edc9'},
  pink:  {name:'Bubblegum pink',price:140, a:'#e581a8', A:'#b4537a', p:'#fff2f7'},
  purple:{name:'Royal purple',  price:160, a:'#8a5cb8', A:'#5c3a80', p:'#f3d97a'},
  gold:  {name:'Champion gold', price:250, a:'#e0ad30', A:'#9c7414', p:'#7b3fa0'},
};
// Bundles: several things together for less than buying them one by one
/* ---------- weather and horse rugs ---------- */
export const WEATHER = {
  sunny: {icon:'☀️', name:'Sunny', needs:'fly',    why:'Flies are bugging me', badIcon:'🪰'},
  rain:  {icon:'🌧️', name:'Rainy', needs:'rain',   why:"I'm all wet",          badIcon:'☔'},
  snow:  {icon:'❄️', name:'Snowy', needs:'fleece', why:"Brrr, I'm cold",       badIcon:'🥶'},
};
export const RUG_KINDS = {
  fly:    {name:'Fly sheet',  icon:'🪰', weather:'sunny', price:50, desc:'A light mesh sheet that keeps flies away on sunny days.'},
  rain:   {name:'Rain sheet', icon:'☔', weather:'rain',  price:60, desc:'A shiny waterproof sheet for rainy days.'},
  fleece: {name:'Fleece rug', icon:'🧣', weather:'snow',  price:70, desc:'A fluffy, warm rug for snowy days.'},
};
export const RUG_COLORS = {
  fly:    {white:{name:'White', main:'#f4f1ea', trim:'#7a9cc6'}, mint:{name:'Mint', main:'#bfe8d4', trim:'#3f8a6a'}, lavender:{name:'Lavender', main:'#d7c8f0', trim:'#7a5cb0'}},
  rain:   {navy:{name:'Navy', main:'#2f4a7a', trim:'#e0ad30'}, red:{name:'Red', main:'#b8402f', trim:'#2a2a2a'}, green:{name:'Forest green', main:'#3f7a46', trim:'#f2efe6'}},
  fleece: {purple:{name:'Purple', main:'#8a5cb8', trim:'#f3d97a'}, blue:{name:'Blue', main:'#5b8fd0', trim:'#ffffff'}, pink:{name:'Pink', main:'#e88fb0', trim:'#ffffff'}},
};
export const rugOf = h => { const r = (state.rugs || []).find(r => r.id === h.rug); return r ? {kind: r.kind, color: r.color} : null; };
export const rugOK = h => { const r = rugOf(h); return !!r && r.kind === WEATHER[state.weather || 'sunny'].needs; };
export function rollWeather(){ const r = Math.random(); return r < .45 ? 'sunny' : r < .8 ? 'rain' : 'snow'; }
export function rugSwatch(kind, color){ const c = RUG_COLORS[kind][color]; return `<span class="rugsw" style="background:${c.main};border-color:${c.trim}"></span>`; }

export const BUNDLES = [
  {id:'feed',    name:'Feed sack bundle',   desc:'A big stack of food for hungry horses.',
   items:{hay:20, oats:10, carrot:10}, price:120},
  {id:'cozy',    name:'Cozy stable bundle', desc:'Three decorations to make your stable homey.',
   decor:['hayBale','flowers','lantern'], price:90},
  {id:'rider',   name:"Rider's bundle",     desc:'A new saddle plus carrot treats for after the ride.',
   saddle:'blue', items:{carrot:10}, price:140},
  {id:'breeder', name:"Breeder's bundle",   desc:'3 free DNA tests and oats for your mares.',
   dna:3, items:{oats:10}, price:80},
  {id:'barn',    name:'Barn raising bundle',desc:'Two new stalls, a hay bale and 10 hay to welcome new horses.',
   stalls:2, decor:['hayBale'], items:{hay:10}},
  {id:'weather', name:'All-weather bundle', desc:'One of each: fly sheet, rain sheet and fleece rug. Ready for anything!',
   rugs:[['fly','white'],['rain','navy'],['fleece','purple']], price:135},
  {id:'deluxe',  name:'Champion bundle',    desc:'The golden saddle, a barn cat, and a feast of oats and carrots!',
   saddle:'gold', decor:['cat'], items:{oats:15, carrot:15}, price:390},
];
export function bundleWorth(b){
  let w = 0;
  for (const [k, n] of Object.entries(b.items || {})) w += n * CROPS[k].sell;
  for (const d of b.decor || []) w += SHOP[d].price;
  if (b.saddle) w += SADDLES[b.saddle].price;
  for (const [k] of b.rugs || []) w += RUG_KINDS[k].price;
  if (b.dna) w += b.dna * DNA_COST;
  if (b.stalls) w += stableCost();
  return w;
}
export const bundlePrice = b => b.price || round5(bundleWorth(b) * .75);
export const T = {pregnancy:45, grow:90, rest:30, brush:15}; // seconds

/* ---------- day & night ----------
   One game day = 12 real minutes, from 6:00 in the morning to midnight.
   Horses must be out in the paddock by 12:00 (about 4 real minutes after
   sunrise), and come back in at 21:00. */
export const DAY_MS = 12 * 60 * 1000, MORNING_END = 12, NIGHT = 21;
export function clock(t = now()){
  const e = Math.max(0, t - state.dayEpoch);
  const idx = Math.floor(e / DAY_MS), hour = 6 + (e % DAY_MS) / DAY_MS * 18;
  return {idx, day: idx + 1, hour};
}
export const clockText = h => `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor((h % 1) * 4) * 15).padStart(2,'0')}`;
export const isDaytime = () => clock().hour < NIGHT;
export const outCount = () => state.horses.filter(h => h.out).length;
export const BREED_COST = 40, DNA_COST = 25, REFRESH_COST = 15;
export const SAVE_KEY = 'cloverHillStables_v1';

