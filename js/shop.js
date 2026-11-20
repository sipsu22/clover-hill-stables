// The Market Hall: stalls whose stock and prices change every game day.
import { esc, mulberry, round5 } from './util.js';
import { cropImg, horseImg, itemImg, saddleImg } from './sprites.js';
import { fullName, phen } from './genetics.js';
import { BUNDLES, CROPS, DNA_COST, RUG_COLORS, RUG_KINDS, SADDLES, SHOP, WEATHER, bundlePrice, bundleWorth, clock, rugSwatch } from './data.js';
import { decorBonus, look, marketPrice, sexWord, state } from './state.js';
import { statBar } from './ui.js';

export const POTION_PRICE = 60;

export const STALLS = {
  horses:  {name: 'Horse dealer',     icon: '🐴', keeper: 'Hilda',       awning: ['#c0452f', '#f4ead0'], line: 'Fine horses! You lead your new friend home yourself.'},
  tack:    {name: 'Saddlery',         icon: '🐎', keeper: 'Otto',        awning: ['#8b5a2b', '#efe6d2'], line: 'Saddles for every rider. New ones every morning!'},
  rugs:    {name: 'Rugs & sheets',    icon: '🧥', keeper: 'Rosa',        awning: ['#4a7fc0', '#f4f0e4'], line: 'Fly sheets, rain sheets and fleece rugs.'},
  decor:   {name: 'Barn decor',       icon: '🏡', keeper: 'Pim',         awning: ['#5f9a3e', '#f6edc9'], line: 'Make your barn cozy. I deliver to your stable!'},
  bundles: {name: 'Bargain bundles',  icon: '🎁', keeper: 'Lou',         awning: ['#e0ad30', '#fff6dc'], line: "Two special deals today. Don't miss them!"},
  produce: {name: 'Produce stand',    icon: '🥕', keeper: 'Farmer Jo',   awning: ['#c4621a', '#fbe6c8'], line: 'I buy your crops, and sell food when you run low.'},
  potions: {name: 'Apothecary',       icon: '🧪', keeper: 'Madame Lune', awning: ['#8a5cb8', '#f3e4ff'], line: 'A love potion for the Heart Barn, dear?'},
};

/* ---------- daily stock and prices ---------- */
const strHash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export const today = () => clock().idx;
/** A random number generator that gives the same numbers all day, and new ones tomorrow. */
export const dayRand = (key, day = today()) => mulberry(strHash(key) + day * 7919);
/** Today's price factor for one item: 0.85 (cheap) … 1.20 (pricey). */
export const priceMult = (key, day = today()) => Math.round((.85 + dayRand('price:' + key, day)() * .35) * 100) / 100;
const shopPrice = (key, base, day) => round5(base * priceMult(key, day));

export const priceOf = {
  saddle:  (t, day) => shopPrice('saddle:' + t, SADDLES[t].price, day),
  rug:     (k, c, day) => shopPrice(`rug:${k}:${c}`, RUG_KINDS[k].price, day),
  decor:   (t, day) => shopPrice('decor:' + t, SHOP[t].price, day),
  bundle:  (b, day) => shopPrice('bundle:' + b.id, bundlePrice(b), day),
  potion:  day => shopPrice('potion', POTION_PRICE, day),
  dna:     day => shopPrice('dna', DNA_COST, day),
  horse:   (h, day) => round5(marketPrice(h) * priceMult('horse:' + h.id, day)),
  cropBuy: (k, day) => Math.max(1, Math.round(CROPS[k].sell * 2 * priceMult('buy:' + k, day))),
  cropSell:(k, day) => Math.max(1, Math.round(CROPS[k].sell * priceMult('sell:' + k, day))),
};

function pickN(list, n, key, day){
  const r = dayRand('stock:' + key, day);
  return [...list].map(x => [r(), x]).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, x]) => x);
}
/** What a stall sells today. */
export function stock(stall, day = today()){
  switch (stall){
    case 'tack':    return pickN(Object.keys(SADDLES), 3, 'tack', day);
    case 'rugs':    return Object.keys(RUG_COLORS).map(kind => [kind, pickN(Object.keys(RUG_COLORS[kind]), 1, 'rugs:' + kind, day)[0]]);
    case 'decor':   return pickN(Object.keys(SHOP), 4, 'decor', day);
    case 'bundles': return pickN(BUNDLES.filter(b => !b.stalls || state.cap + b.stalls <= 16).map(b => b.id), 2, 'bundles', day);
    case 'produce': return Object.keys(CROPS);
    case 'potions': return ['potion', 'dna'];
    case 'horses':  return state.market.map((_, i) => i);
  }
  return [];
}
function dealTag(key){
  const m = priceMult(key);
  return m <= .92 ? '<span class="deal">🔥 Cheap today</span>' : m >= 1.12 ? '<span class="pricey">📈 Pricey today</span>' : '';
}

/* ---------- what you see at each stall ---------- */
export function bundleContents(b){
  const parts = [];
  for (const [k, n] of Object.entries(b.items || {})) parts.push(`<span class="bpart">${cropImg(k, 24)}×${n}</span>`);
  for (const d of b.decor || []) parts.push(`<span class="bpart">${itemImg(d, 2)}</span>`);
  if (b.saddle) parts.push(`<span class="bpart">${saddleImg(b.saddle, 2)}</span>`);
  if (b.dna) parts.push(`<span class="bpart">🧬×${b.dna}</span>`);
  for (const [k, c] of b.rugs || []) parts.push(`<span class="bpart">${RUG_KINDS[k].icon}${rugSwatch(k, c)}</span>`);
  if (b.stalls) parts.push(`<span class="bpart">🏠 +${b.stalls} stalls</span>`);
  return parts.join('');
}
const item = (inner, price, act, arg, tagKey, extra = '') =>
  `<div class="sitem">${inner}${tagKey ? dealTag(tagKey) : ''}${extra}<button class="gold" data-act="${act}" data-arg="${arg}">Buy ${price}🪙</button></div>`;

function goods(stall){
  const s = stock(stall);
  switch (stall){
    case 'horses':
      if (!s.length) return '<p class="empty">Sold out! New horses arrive tomorrow morning.</p>';
      return `<div class="shop">${s.map(i => {
        const h = state.market[i], ph = phen(h.genes);
        const isNew = !state.found[ph.color] || (ph.pinto && !state.found.Pinto) || (ph.appy && !state.found.Appaloosa);
        return `<div class="sitem">${horseImg(look(h), 3)}<span class="sn">${esc(h.name)} <span class="sex ${h.sex}">${h.sex === 'F' ? '♀' : '♂'}</span></span>
          <span class="sd">${fullName(ph)} ${sexWord(h)}${isNew ? ' · <b>📖 New color!</b>' : ''}</span>
          <div class="row"><span class="lbl">Speed</span>${statBar(h.speed)}</div>
          <div class="row"><span class="lbl">Stamina</span>${statBar(h.stamina)}</div>
          <div class="row"><span class="lbl">Gentle</span>${statBar(h.temper)}</div>
          ${dealTag('horse:' + h.id)}<button class="gold" data-act="buyHorse" data-id="${i}">Buy ${priceOf.horse(h)}🪙</button></div>`;
      }).join('')}</div>`;
    case 'tack':
      return `<div class="shop">${s.map(t => item(`<div class="sicon">${saddleImg(t, 3)}</div><span class="sn">${SADDLES[t].name}</span>
        ${horseImg({color: 'Chestnut', face: 'none', socks: 0, seed: 3, saddle: t}, 2)}`, priceOf.saddle(t), 'buySaddle', t, 'saddle:' + t,
        own(state.saddles.filter(x => x.type === t).length))).join('')}</div>`;
    case 'rugs':
      return `<p class="sd">Today it's ${WEATHER[state.weather || 'sunny'].icon} ${WEATHER[state.weather || 'sunny'].name.toLowerCase()}: horses outside need a ${RUG_KINDS[WEATHER[state.weather || 'sunny'].needs].name.toLowerCase()}.</p>
        <div class="shop">${s.map(([k, c]) => item(`<span class="sn">${RUG_KINDS[k].icon} ${RUG_COLORS[k][c].name} ${RUG_KINDS[k].name.toLowerCase()}</span>
        ${horseImg({color: 'Bay', face: 'blaze', socks: 1, seed: 4, rug: {kind: k, color: c}}, 3)}<span class="sd">${RUG_KINDS[k].desc}</span>`,
        priceOf.rug(k, c), 'buyRug', `${k}:${c}`, `rug:${k}:${c}`, own(state.rugs.filter(r => r.kind === k && r.color === c).length))).join('')}</div>`;
    case 'decor':
      return `<p class="sd">Decorations are delivered to your barn aisle. Each one makes your horses' happiness drop a little slower (now ${Math.round(decorBonus() * 100)}% slower).</p>
        <div class="shop">${s.map(t => item(`<div class="sicon">${itemImg(t, 3)}</div><span class="sn">${SHOP[t].name}</span><span class="sd">${SHOP[t].desc}</span>`,
        priceOf.decor(t), 'buyItem', t, 'decor:' + t)).join('')}</div>`;
    case 'bundles':
      return `<div class="shop bundles">${s.map(id => {
        const b = BUNDLES.find(x => x.id === id), worth = bundleWorth(b), price = priceOf.bundle(b);
        return `<div class="sitem bundle"><span class="save">Save ${worth - price}🪙</span><span class="sn">${b.name}</span>
          <div class="bparts">${bundleContents(b)}</div><span class="sd">${b.desc}</span><span class="was">Worth ${worth}🪙</span>
          <button class="gold" data-act="buyBundle" data-arg="${b.id}">Buy ${price}🪙</button></div>`;
      }).join('')}</div>`;
    case 'produce':
      return `<div class="inv">${s.map(k => `<div class="invi">${cropImg(k, 36)}<span class="n">${state.inv[k]}</span>
        <button data-act="sellCrop" data-arg="${k}:1" ${state.inv[k] < 1 ? 'disabled' : ''}>Sell 1 (${priceOf.cropSell(k)}🪙)</button>
        <button data-act="sellCrop" data-arg="${k}:all" ${state.inv[k] < 1 ? 'disabled' : ''}>Sell all</button>
        <button class="gold" data-act="buyFood" data-arg="${k}">Buy 1 (${priceOf.cropBuy(k)}🪙)</button></div>`).join('')}</div>`;
    case 'potions':
      return `<div class="shop">
        ${item(`<div class="sicon potion">🧪</div><span class="sn">Love potion</span><span class="sd">Use it at the love table in the Heart Barn when a mare and a stallion are in the pens.</span>`,
          priceOf.potion(), 'buyPotion', '', 'potion', own(state.inv.potion || 0))}
        ${item(`<div class="sicon potion">🧬</div><span class="sn">DNA test kit</span><span class="sd">Find out a horse's hidden genes. Use it from the horse's card.</span>`,
          priceOf.dna(), 'buyDNA', '', 'dna', own(state.dnaFree || 0))}</div>`;
  }
  return '';
}
const own = n => n ? `<span class="own">You have ${n}</span>` : '';

export function stallHTML(stall){
  const S = STALLS[stall];
  return `<button class="closex" data-act="closeModal">✕</button>
    <h2>${S.icon} ${S.name}</h2>
    <p class="keeper"><b>${S.keeper}:</b> “${S.line}”</p>
    <p class="sd">🪙 You have <b>${state.coins}</b> coins. Stock and prices change every morning.</p>
    ${goods(stall)}`;
}
