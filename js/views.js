// What you see: the top bar, the world (or a ride), horse cards and small popups.
import { $, clamp, esc, fmt, now } from './util.js';
import { cropImg, horseImg, saddleImg } from './sprites.js';
import { fullName, phen } from './genetics.js';
import { BOOK, CROPS, DNA_COST, MORNING_END, NIGHT, RUG_COLORS, RUG_KINDS, SADDLES, WEATHER, clock, clockText, isDaytime, rugSwatch } from './data.js';
import { byId, isFoal, look, mood, readiness, sexWord, stableCost, state, status, value } from './state.js';
import { bestFriends, heartsFor } from './affinity.js';
import { bar, genesHTML, refreshModal, showModal, statBar } from './ui.js';
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
    ${state.inv.potion ? `<span class="chip" title="Love potions">🧪 ${state.inv.potion}</span>` : ''}
    <span class="chip">🐴 ${state.horses.length}/${state.cap}</span><span class="chip">📖 ${found}/${BOOK.length}</span>`;
}
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
export function hcardHTML(h, where = null){   // where: 'stall' | 'paddock' (shows the Lead button)
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
        ${friendsRow(h)}
        ${saddleRow(h)}
        ${rugRow(h)}
        ${h.tested ? genesHTML(h) : ''}
        <div class="status" data-live="status" data-id="${h.id}">${status(h)}</div>
        <div class="btns">
          <button data-act="feed" data-id="${h.id}" data-arg="hay">🌿 Hay</button>
          <button data-act="feed" data-id="${h.id}" data-arg="oats">🌾 Oats</button>
          <button data-act="feed" data-id="${h.id}" data-arg="carrot">🥕 Carrot</button>
          <button data-act="brush" data-id="${h.id}">✨ Brush</button>
          ${where && state.player.leading !== h.id && isDaytime() ? `<button class="primary" data-act="lead" data-id="${h.id}">🐴 Lead ${h.sex === 'F' ? 'her' : 'him'}</button>` : ''}
          ${h.tested ? '' : `<button data-act="dna" data-id="${h.id}">🧬 DNA test (${state.dnaFree ? 'free' : DNA_COST + '🪙'})</button>`}
          <button class="danger" data-act="sell" data-id="${h.id}">Sell ${value(h)}🪙</button>
        </div>
      </div></div>`;
}
export let openHorse = null;
export function setOpenHorse(id){ openHorse = id; }
export function horseModalHTML(h, where = 'stall'){
  return `<button class="closex" data-act="closeModal">✕</button>${hcardHTML(h, where)}`;
}
export function horseModal(id, where = 'stall'){
  const h = byId(id); if (!h) return;
  showModal(horseModalHTML(h, where), () => { setOpenHorse(id); $('#mbox').classList.add('wide'); },
    () => byId(id) ? horseModalHTML(byId(id), where) : null);
}
export function friendsRow(h){
  const f = bestFriends(h);
  return `<div class="row"><span class="lbl">Friends</span><span>${f.length ? f.map(([x, v]) => `${esc(x.name)} <b class="hearts">${heartsFor(v)}</b>`).join(' · ') : '<span style="color:var(--muted)">Spend time together in the paddock!</span>'}</span></div>`;
}

export function bookHTML(){
  const found = BOOK.filter(([k]) => state.found[k]).length;
  return `<button class="closex" data-act="closeModal">✕</button><div class="panel"><h2>📖 Horse Book</h2><p>Collect every coat color and pattern! Each new discovery gives you 50 🪙.</p>
    <div class="prog"><i style="width:${found/BOOK.length*100}%"></i></div><b>${found} / ${BOOK.length} found</b>
    ${found === BOOK.length ? '<p>🏆 <b>You found every horse! You are a master breeder!</b></p>' : ''}</div>
    <div class="book">${BOOK.map(([k, hint]) => {
      const got = state.found[k];
      const lk = k === 'Pinto' ? {color:'Bay', pinto:true} : k === 'Appaloosa' ? {color:'Chestnut', appy:true} : {color:k};
      return `<div class="bent ${got?'':'lock'}">${horseImg({...lk, face:'none', socks:0, seed:11, sil:!got}, 4)}
        <span class="bn pix">${got ? k : '???'}</span><span class="bh">${hint}</span></div>`;
    }).join('')}</div>`;
}

export function openBook(){
  showModal(bookHTML(), () => $('#mbox').classList.add('menu'), bookHTML);
}
/** At a locked stall in the barn: build two more stalls. */
export function buildHTML(){
  const full = state.horses.length >= state.cap;
  return `<button class="closex" data-act="closeModal">✕</button><h2>🔨 Build more stalls</h2>
    <p>Your stable has <b>${state.horses.length} horse${state.horses.length === 1 ? '' : 's'}</b> in <b>${state.cap} stalls</b>.${full ? ' <b>It\'s full!</b>' : ''}</p>
    ${state.cap < 16 ? `<p class="center"><button class="primary" data-act="upgradeStable" style="font-size:16px;padding:10px 16px">Build 2 more stalls (${stableCost()}🪙)</button></p>`
                     : '<p><b>Your stable is the biggest it can be! (16 stalls)</b></p>'}`;
}
export function openBuild(){ showModal(buildHTML(), null, () => state.cap >= 16 ? null : buildHTML()); }

export function render(){
  $('#hud').innerHTML = hud();
  $('#view').innerHTML = ride ? rideView() : sceneHTML();
  document.body.classList.toggle('riding', !!ride);
  refreshModal();
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
    }
  });
}

