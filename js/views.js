// HTML for each tab: farm, storage, breeding, market, horse book.
import { $, clamp, esc, fmt, now } from './util.js';
import { cropImg, horseImg, itemImg, saddleImg } from './sprites.js';
import { fullName, odds, phen } from './genetics.js';
import { BOOK, BREED_COST, BUNDLES, CROPS, DNA_COST, MORNING_END, NIGHT, REFRESH_COST, RUG_COLORS, RUG_KINDS, SADDLES, SHOP, WEATHER, bundlePrice, bundleWorth, clock, clockText, isDaytime, rugSwatch } from './data.js';
import { byId, decorBonus, isFoal, look, marketPrice, mood, plotCost, readiness, sexWord, stableCost, state, status, value } from './state.js';
import { bar, closeModal, genesHTML, showModal, statBar } from './ui.js';
import { COLS, ROWS, TILE, curMap } from './world.js';
import { ride, rideView } from './riding.js';

/* ---------- views ---------- */
export function hud(){
  const c = clock(), icon = c.hour < MORNING_END ? '🌅' : c.hour < 18 ? '☀️' : c.hour < NIGHT ? '🌇' : '🌙';
  const W = WEATHER[state.weather || 'sunny'];
  const clockChip = `<span class="chip">${icon} Day ${c.day} · ${clockText(c.hour)}</span><span class="chip" title="Today's weather">${W.icon} ${W.name}</span>`;
  const found = BOOK.filter(([k]) => state.found[k]).length;
  return `${clockChip}<span class="chip">🪙 ${state.coins}</span>
    <span class="chip">🌿 ${state.inv.hay}</span><span class="chip">🥕 ${state.inv.carrot}</span><span class="chip">🌾 ${state.inv.oats}</span>
    <span class="chip">🐴 ${state.horses.length}/${state.cap}</span><span class="chip">📖 ${found}/${BOOK.length}</span>`;
}
export const TABS = [['stable','🏡 Farm'],['farm','🧺 Storage'],['breed','💞 Breeding'],['ride','🏇 Riding'],['market','🏷️ Market'],['book','📖 Horse Book']];
export function tabsHTML(){ return TABS.map(([k,l]) => { const i = l.indexOf(' '), icon = l.slice(0, i), name = l.slice(i + 1);
  return `<button class="${state.tab===k?'on':''}" data-act="tab" data-arg="${k}"><span class="ti">${icon}</span> <span class="tn">${name}</span></button>`; }).join(''); }

export const isNarrow = () => innerWidth < 600;
export const sceneVW = () => isNarrow() ? 11 * TILE : COLS * TILE;   // phones see 11 x 11 tiles, bigger
export const sceneBuf = document.createElement('canvas');
export function sceneHTML(){
  return `<div class="panel scene-wrap">
    <div class="daybanner" id="dayBanner"></div>
    <canvas id="scene" width="${sceneVW()}" height="${ROWS*TILE}"></canvas>
    <div class="scene-ui">
      <div class="dpad">
        <button class="u" data-dir="up">▲</button><button class="l" data-dir="left">◀</button>
        <button class="d" data-dir="down">▼</button><button class="r" data-dir="right">▶</button>
      </div>
      <div class="hint" id="hint"></div>
      <button class="primary actbtn" data-act="interact">E</button>
    </div>
    ${curMap() === 'farm' ? `<div class="seedbar"><b>Seeds to plant:</b>
      ${Object.entries(CROPS).map(([k, c], i) => `<button class="${(state.seed||'hay')===k?'on':''}" data-act="seed" data-arg="${k}">${cropImg(k,22)} ${c.name} <small>${c.seed}🪙 · ${fmt(c.time)}</small> <kbd>${i+1}</kbd></button>`).join('')}
      <span class="sbinv">In storage: 🌿${state.inv.hay} 🥕${state.inv.carrot} 🌾${state.inv.oats}</span></div>` : ''}
    <div class="keys">Walk: <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · Use: <kbd>E</kbd> or <kbd>Space</kbd>${curMap() === 'farm' ? ' · Pick seeds: <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>' : ''} · Or just click where you want to go!</div>
  </div>`;
}
export function rugRow(h){
  const cur = (state.rugs || []).find(r => r.id === h.rug);
  const used = new Set(state.horses.map(x => x.rug));
  const need = WEATHER[state.weather || 'sunny'].needs;
  const free = [...new Map(state.rugs.filter(r => !used.has(r.id)).map(r => [r.kind + ':' + r.color, r])).values()];
  const btns = [];
  if (cur) btns.push(`<button class="on" data-act="rug" data-id="${h.id}" data-arg="none" title="Take off">${RUG_KINDS[cur.kind].icon}${rugSwatch(cur.kind, cur.color)} ✕</button>`);
  for (const r of free) btns.push(`<button class="${r.kind === need ? 'need' : ''}" data-act="rug" data-id="${h.id}" data-arg="${r.kind}:${r.color}" title="${RUG_COLORS[r.kind][r.color].name} ${RUG_KINDS[r.kind].name}${r.kind === need ? ' (right for today!)' : ''}">${RUG_KINDS[r.kind].icon}${rugSwatch(r.kind, r.color)}</button>`);
  return `<div class="row"><span class="lbl">Rug</span><div class="saddles">${btns.join('') || '<span style="color:var(--muted)">Buy rugs at the 🏷️ Market</span>'}</div></div>`;
}
export function saddleRow(h){
  if (isFoal(h)) return `<div class="row"><span class="lbl">Saddle</span><span style="color:var(--muted)">Too young for a saddle</span></div>`;
  const cur = state.saddles.find(s => s.id === h.saddle);
  const used = new Set(state.horses.map(x => x.saddle));
  const freeTypes = [...new Set(state.saddles.filter(s => !used.has(s.id)).map(s => s.type))];
  const btns = [];
  if (cur) btns.push(`<button class="on" data-act="equip" data-id="${h.id}" data-arg="none" title="Take off">${saddleImg(cur.type,1)} ✕</button>`);
  for (const t of freeTypes) btns.push(`<button data-act="equip" data-id="${h.id}" data-arg="${t}" title="${SADDLES[t].name}">${saddleImg(t,1)}</button>`);
  return `<div class="row"><span class="lbl">Saddle</span><div class="saddles">${btns.join('') || '<span style="color:var(--muted)">Buy saddles at the 🏷️ Market</span>'}</div></div>`;
}
export function stableView(){
  if (!state.horses.length) return sceneHTML() + `<div class="panel empty">Your stable is empty! Visit the 🏷️ Market to buy a horse.</div>`;
  return sceneHTML() + `<h2 class="pix">All your horses</h2><div class="grid">${state.horses.map(h => hcardHTML(h)).join('')}</div>`;
}
export function hcardHTML(h, atStall = false){
    const ph = phen(h.genes), foal = isFoal(h);
    return `<div class="hcard">
      <div class="pasture">
        ${foal ? '<span class="badge">🍼 Foal</span>' : ''}
        ${h.preg ? '<span class="badge r">🤰 Expecting</span>' : ''}
        ${horseImg(look(h), 5, h.happy >= 50 ? 'bob' : '')}
      </div>
      <div class="hbody">
        <div class="hname pix" data-act="rename" data-id="${h.id}" title="Click to rename">${esc(h.name)} <span class="sex ${h.sex}">${h.sex==='F'?'♀':'♂'}</span> <small>✏️</small></div>
        <div class="hcolor">${fullName(ph)} ${sexWord(h)} · worth ${value(h)} 🪙</div>
        <div class="row"><span class="lbl">Food</span>${bar(h.hunger,'hunger',h.id)}</div>
        <div class="row"><span class="lbl">Happiness</span>${bar(h.happy,'happy',h.id)}</div>
        <div class="row"><span class="lbl">Mood</span><b data-live="mood" data-id="${h.id}">${mood(h)}</b></div>
        <div class="row"><span class="lbl">Speed</span>${statBar(h.speed)}<b>${h.speed}</b></div>
        <div class="row"><span class="lbl">Stamina</span>${statBar(h.stamina)}<b>${h.stamina}</b></div>
        <div class="row"><span class="lbl">Gentle</span>${statBar(h.temper)}<b>${h.temper}</b></div>
        ${saddleRow(h)}
        ${rugRow(h)}
        ${h.tested ? genesHTML(h) : ''}
        <div class="status" data-live="status" data-id="${h.id}">${status(h)}</div>
        <div class="btns">
          <button data-act="feed" data-id="${h.id}" data-arg="hay">🌿 Hay</button>
          <button data-act="feed" data-id="${h.id}" data-arg="oats">🌾 Oats</button>
          <button data-act="feed" data-id="${h.id}" data-arg="carrot">🥕 Carrot</button>
          <button data-act="brush" data-id="${h.id}">✨ Brush</button>
          ${atStall && !h.out && state.player.leading !== h.id && isDaytime() ? `<button class="primary" data-act="lead" data-id="${h.id}">🌳 Lead to paddock</button>` : ''}
          ${h.tested ? '' : `<button data-act="dna" data-id="${h.id}">🧬 DNA test (${state.dnaFree ? 'free' : DNA_COST + '🪙'})</button>`}
          <button class="danger" data-act="sell" data-id="${h.id}">Sell ${value(h)}🪙</button>
        </div>
      </div></div>`;
}
export let openHorse = null;
export function setOpenHorse(id){ openHorse = id; }
export function horseModalHTML(h){
  return `<button class="closex" data-act="closeModal">✕</button>${hcardHTML(h, true)}`;
}
export function horseModal(id){
  const h = byId(id); if (!h) return;
  showModal(horseModalHTML(h), () => { setOpenHorse(id); $('#mbox').classList.add('wide'); });
}

export function farmView(){
  const ready = state.plots.filter(p => p.crop && now() - p.at >= CROPS[p.crop].time*1000).length;
  const growing = state.plots.filter(p => p.crop).length - ready;
  return `<div class="panel roompanel"><div><h2>🌱 Your fields</h2>
      <p>Your fields are outside! Go to the 🏡 Farm tab and walk out the barn door to plant and harvest.
      You have <b>${state.plots.length}</b> field${state.plots.length>1?'s':''}: <b>${ready}</b> ready to harvest, <b>${growing}</b> growing.</p></div>
      <button class="primary" data-act="goFields" style="font-size:16px;padding:10px 16px">🚪 Go to the fields</button></div>
    <div class="panel"><h2>🧺 Storage</h2><p>Your food storage. Horses eat 🌿 hay, 🌾 oats and 🥕 carrots. Sell what you don't need.</p><div class="inv">
      ${Object.entries(CROPS).map(([k,c]) => `<div class="invi">${cropImg(k,40)}<span class="n">${state.inv[k]}</span>
        <button data-act="sellCrop" data-arg="${k}:1" ${state.inv[k]<1?'disabled':''}>Sell 1 (${c.sell}🪙)</button>
        <button data-act="sellCrop" data-arg="${k}:all" ${state.inv[k]<1?'disabled':''}>All</button></div>`).join('')}
    </div></div>
    <div class="panel"><h2>Upgrades</h2><div class="ups">
      ${state.plots.length < 12 ? `<button class="primary" data-act="buyPlot">➕ New field (${plotCost()}🪙)</button>` : '<span>All fields bought!</span>'}
      ${state.cap < 16 ? `<button class="primary" data-act="upgradeStable">🏠 +2 stable stalls (${stableCost()}🪙)</button>` : '<span>Stable is max size!</span>'}
    </div></div>`;
}

export function miniCard(h, selected){
  const r = readiness(h);
  return `<div class="mcard ${selected?'sel':''}" data-act="select" data-id="${h.id}">
    ${horseImg(look(h), 3)}<span class="nm">${esc(h.name)}</span>
    <span style="font-size:12px;color:var(--muted)">${fullName(phen(h.genes))}</span>
    <span class="rd ${r?'':'ok'}" data-live="ready" data-id="${h.id}">${r || 'Ready ✓'}</span></div>`;
}
export function breedView(){
  const mares = state.horses.filter(h => h.sex==='F'), studs = state.horses.filter(h => h.sex==='M');
  const m = byId(state.sel.F), s = byId(state.sel.M);
  const slot = (h, label) => h ? `<div class="slot full">${horseImg(look(h),4)}<b>${esc(h.name)}</b><small>${fullName(phen(h.genes))}</small></div>`
                                : `<div class="slot">${label}</div>`;
  let oddsHTML = '';
  if (m && s){
    if (m.tested && s.tested){
      oddsHTML = `<h3 class="center">Possible foals</h3><div class="odds">${odds(m, s).map(([n, o]) => {
        const isNew = !state.found[o.ph.color] || (o.ph.pinto && !state.found.Pinto) || (o.ph.appy && !state.found.Appaloosa);
        const pc = o.p*100;
        return `<div class="odd">${horseImg({...o.ph, face:'none', socks:0, seed:3}, 1.25)} ${n} ${isNew?'<span class="new">NEW!</span>':''}<span class="p">${pc<1?'<1':Math.round(pc)}%</span></div>`;
      }).join('')}</div>`;
    } else {
      const need = [m, s].filter(h => !h.tested);
      oddsHTML = `<p class="center">🧬 DNA-test both parents to see which colors their foal could be!</p>
        <p class="center">${need.map(h => `<button data-act="dna" data-id="${h.id}">Test ${esc(h.name)} (${state.dnaFree ? 'free' : DNA_COST + '🪙'})</button>`).join(' ')}</p>`;
    }
  }
  return `<div class="panel"><h2>Breeding barn</h2>
      <p>Pick one mare and one stallion. They must be grown up, fed and happy. The foal gets one copy of each gene from each parent, and its stats can turn out better than its parents' stats!</p>
      <div class="pair">${slot(m,'Pick a mare ♀ below')}<span class="heart">💞</span>${slot(s,'Pick a stallion ♂ below')}</div>
      ${oddsHTML}
      <p class="center"><button class="primary" data-act="breed" ${m&&s?'':'disabled'}>Breed! (${BREED_COST}🪙)</button></p>
    </div>
    <h3>Mares ♀</h3>${mares.length ? `<div class="mini">${mares.map(h => miniCard(h, h.id===state.sel.F)).join('')}</div>` : '<p class="empty">No mares yet.</p>'}
    <h3>Stallions ♂</h3>${studs.length ? `<div class="mini">${studs.map(h => miniCard(h, h.id===state.sel.M)).join('')}</div>` : '<p class="empty">No stallions yet.</p>'}`;
}

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
export function roomPanel(){
  const full = state.horses.length >= state.cap;
  return `<div class="panel roompanel ${full ? 'full' : ''}">
    <div><h2>🏠 More room for horses</h2>
    <p>Your stable has <b>${state.horses.length} horse${state.horses.length===1?'':'s'}</b> in <b>${state.cap} stalls</b>.
    ${full ? '<b>It\'s full!</b> Build more stalls so you can keep everyone, buy new horses and welcome foals.' : 'Build more stalls so you never have to sell a horse you love.'}</p></div>
    ${state.cap < 16 ? `<button class="primary" data-act="upgradeStable" style="font-size:16px;padding:10px 16px">Build 2 more stalls (${stableCost()}🪙)</button>`
                     : '<b>Your stable is the biggest it can be! (16 stalls)</b>'}
  </div>`;
}
export function marketView(){
  return roomPanel() + `<div class="panel"><h2>Horse market</h2>
    <p>New horses arrive in <b data-live="market">${fmt((state.marketAt-now())/1000)}</b>. Their genes are a mystery until you DNA-test them!</p>
    <p><button data-act="refresh">🔄 New horses now (${REFRESH_COST}🪙)</button></p></div>
    <div class="grid">${state.market.map((h, i) => {
      const ph = phen(h.genes);
      const isNew = !state.found[ph.color] || (ph.pinto && !state.found.Pinto) || (ph.appy && !state.found.Appaloosa);
      return `<div class="hcard"><div class="pasture">${isNew?'<span class="badge">📖 New color!</span>':''}${horseImg(look(h),5,'bob')}</div>
        <div class="hbody">
          <div class="hname pix">${esc(h.name)} <span class="sex ${h.sex}">${h.sex==='F'?'♀':'♂'}</span></div>
          <div class="hcolor">${fullName(ph)} ${sexWord(h)}</div>
          <div class="row"><span class="lbl">Speed</span>${statBar(h.speed)}<b>${h.speed}</b></div>
          <div class="row"><span class="lbl">Stamina</span>${statBar(h.stamina)}<b>${h.stamina}</b></div>
          <div class="row"><span class="lbl">Gentle</span>${statBar(h.temper)}<b>${h.temper}</b></div>
          <div class="btns"><button class="gold" data-act="buy" data-id="${i}">Buy for ${marketPrice(h)}🪙</button></div>
        </div></div>`;
    }).join('') || '<div class="panel empty">Sold out! New horses are coming soon.</div>'}</div>
    <div class="panel" style="margin-top:16px"><h2>🎁 Bundles</h2>
      <p>Get several things together for a lower price!${state.dnaFree ? ` You have <b>${state.dnaFree} free DNA test${state.dnaFree>1?'s':''}</b>.` : ''}</p></div>
    <div class="shop bundles">${BUNDLES.map(b => {
      if (b.stalls && state.cap + b.stalls > 16) return '';
      const worth = bundleWorth(b), price = bundlePrice(b);
      return `<div class="sitem bundle"><span class="save">Save ${worth - price}🪙</span>
        <span class="sn">${b.name}</span><div class="bparts">${bundleContents(b)}</div>
        <span class="sd">${b.desc}</span>
        <span class="was">Worth ${worth}🪙</span>
        <button class="gold" data-act="buyBundle" data-arg="${b.id}">Buy ${price}🪙</button></div>`;
    }).join('')}</div>
    <div class="panel" style="margin-top:16px"><h2>🛒 Stable shop</h2>
      <p>Decorations go into your stable aisle. Walk up to one and press <kbd>E</kbd> to pick it up and move it.
      Every decoration makes your horses' happiness drop a little slower! (Now: <b>${Math.round(decorBonus()*100)}% slower</b>)</p></div>
    <div class="shop">${Object.entries(SHOP).map(([k, it]) => {
      const n = state.decor.filter(d => d.type === k).length + (state.player.carry && state.player.carry.type === k ? 1 : 0);
      return `<div class="sitem"><div class="sicon">${itemImg(k, 4)}</div><span class="sn">${it.name}</span><span class="sd">${it.desc}</span>
        ${n ? `<span class="own">You have ${n}</span>` : ''}
        <button class="gold" data-act="buyItem" data-arg="${k}">Buy ${it.price}🪙</button></div>`;
    }).join('')}</div>
    <div class="panel" style="margin-top:16px"><h2>🧥 Horse rugs</h2>
      <p>Horses in the paddock need the right rug for the weather: ☀️ sunny → 🪰 fly sheet, 🌧️ rain → ☔ rain sheet, ❄️ snow → 🧣 fleece rug.
      Today it's <b>${WEATHER[state.weather||'sunny'].icon} ${WEATHER[state.weather||'sunny'].name.toLowerCase()}</b>.</p></div>
    <div class="shop">${Object.entries(RUG_COLORS).flatMap(([kind, cols]) => Object.entries(cols).map(([color, c]) => {
      const n = state.rugs.filter(r => r.kind === kind && r.color === color).length;
      return `<div class="sitem"><span class="sn">${RUG_KINDS[kind].icon} ${c.name} ${RUG_KINDS[kind].name.toLowerCase()}</span>
        ${horseImg({color:'Bay', face:'blaze', socks:1, seed:4, rug:{kind, color}}, 3)}
        <span class="sd">${RUG_KINDS[kind].desc}</span>
        ${n ? `<span class="own">You have ${n}</span>` : ''}
        <button class="gold" data-act="buyRug" data-arg="${kind}:${color}">Buy ${RUG_KINDS[kind].price}🪙</button></div>`;
    })).join('')}</div>
    <div class="panel" style="margin-top:16px"><h2>🐎 Tack shop: saddles</h2>
      <p>Saddles hang on your stable wall. Put one on a grown-up horse from its card in the Stable, or walk up to its stall and press <kbd>E</kbd>.</p></div>
    <div class="shop">${Object.entries(SADDLES).map(([k, s]) => {
      const n = state.saddles.filter(x => x.type === k).length;
      return `<div class="sitem"><div class="sicon">${saddleImg(k, 4)}</div><span class="sn">${s.name}</span>
        ${horseImg({color:'Chestnut', face:'none', socks:0, seed:3, saddle:k}, 2)}
        ${n ? `<span class="own">You have ${n}</span>` : ''}
        <button class="gold" data-act="buySaddle" data-arg="${k}">Buy ${s.price}🪙</button></div>`;
    }).join('')}</div>`;
}

export function bookView(){
  const found = BOOK.filter(([k]) => state.found[k]).length;
  return `<div class="panel"><h2>Horse Book</h2><p>Collect every coat color and pattern! Each new discovery gives you 50 🪙.</p>
    <div class="prog"><i style="width:${found/BOOK.length*100}%"></i></div><b>${found} / ${BOOK.length} found</b>
    ${found === BOOK.length ? '<p>🏆 <b>You found every horse! You are a master breeder!</b></p>' : ''}</div>
    <div class="book">${BOOK.map(([k, hint]) => {
      const got = state.found[k];
      const lk = k === 'Pinto' ? {color:'Bay', pinto:true} : k === 'Appaloosa' ? {color:'Chestnut', appy:true} : {color:k};
      return `<div class="bent ${got?'':'lock'}">${horseImg({...lk, face:'none', socks:0, seed:11, sil:!got}, 4)}
        <span class="bn pix">${got ? k : '???'}</span><span class="bh">${hint}</span></div>`;
    }).join('')}</div>`;
}

export const VIEWS = {stable:stableView, farm:farmView, breed:breedView, ride:() => rideView(), market:marketView, book:bookView};
export function render(){
  $('#hud').innerHTML = hud();
  $('#tabs').innerHTML = tabsHTML();
  $('#view').innerHTML = VIEWS[state.tab]();
  document.body.classList.toggle('riding', !!ride);
  if (openHorse !== null){
    const h = byId(openHorse);
    if (h) $('#mbox').innerHTML = horseModalHTML(h); else closeModal();
  }
}
export function updateLive(){
  const t = now();
  $('#hud').innerHTML = hud();
  document.querySelectorAll('[data-live]').forEach(el => {
    const k = el.dataset.live, id = +el.dataset.id;
    if (k === 'hunger' || k === 'happy'){
      const h = byId(id); if (!h) return; const v = h[k];
      el.style.width = v + '%'; el.className = v < 25 ? 'low' : v < 50 ? 'mid' : '';
    } else if (k === 'mood'){ const h = byId(id); if (h) el.textContent = mood(h); }
    else if (k === 'status'){ const h = byId(id); if (h) el.textContent = status(h); }
    else if (k === 'ready'){ const h = byId(id); if (!h) return; const r = readiness(h); el.textContent = r || 'Ready ✓'; el.classList.toggle('ok', !r); }
    else if (k === 'plot' || k === 'plottime'){
      const p = state.plots[id]; if (!p || !p.crop) return; const c = CROPS[p.crop];
      if (k === 'plot') el.style.width = clamp((t-p.at)/(c.time*1000),0,1)*100 + '%';
      else el.textContent = fmt(c.time - (t-p.at)/1000);
    } else if (k === 'market') el.textContent = fmt((state.marketAt - t)/1000);
  });
}

