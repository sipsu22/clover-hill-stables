// Toasts, popups and small HTML helpers.
import { $, esc } from './util.js';
import { horseImg } from './sprites.js';
import { ALLELES, GENES, GENE_NAME, has } from './genetics.js';
import { look } from './state.js';
import { isNarrow, setOpenHorse } from './views.js';

/* ---------- UI helpers ---------- */
export function toast(msg, kind=''){
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
  while ($('#toasts').children.length > (isNarrow() ? 2 : 4)) $('#toasts').firstChild.remove();
}
export function pop(emoji, src){
  const r = src ? src.getBoundingClientRect() : {left:innerWidth/2, top:innerHeight/2, width:0};
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = emoji;
  el.style.left = (r.left + r.width/2 - 11) + 'px'; el.style.top = (r.top - 6) + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 1000);
}
export const modalQueue = [];
// a popup can redraw itself after every action (e.g. a market stall after you buy something)
export let modalRefresh = null;
/** Show a popup. `refresh` (optional) returns fresh HTML for it, or null to close it. */
export function showModal(html, after, refresh){
  if ($('#modal').classList.contains('on')){ modalQueue.push([html, after, refresh]); return; }
  $('#mbox').className = 'mbox';
  $('#mbox').innerHTML = html; $('#modal').classList.add('on');
  modalRefresh = refresh || null;
  if (after) after();
}
export function refreshModal(){
  if (!modalRefresh || !$('#modal').classList.contains('on')) return;
  const html = modalRefresh();
  if (html === null) closeModal(); else $('#mbox').innerHTML = html;
}
export function closeModal(){
  setOpenHorse(null);
  modalRefresh = null;
  $('#modal').classList.remove('on');
  const next = modalQueue.shift();
  if (next) showModal(...next);
}
export function nameModal(h, title, sub){
  showModal(`<div class="mpic">${horseImg(look(h), 6, 'bob')}</div>
    <h2>${title}</h2><p>${sub}</p>
    <input id="nameIn" maxlength="16" value="${esc(h.name)}" data-id="${h.id}">
    <button class="primary" data-act="saveName" data-id="${h.id}">Save name</button>`,
    () => { const i = $('#nameIn'); i.focus(); i.select(); });
}
export function bar(v, kind, id){
  const cls = v < 25 ? 'low' : v < 50 ? 'mid' : '';
  return `<div class="bar"><i class="${cls}" data-live="${kind}" data-id="${id}" style="width:${v}%"></i></div>`;
}
export function statBar(v){ return `<div class="bar stat"><i style="width:${v}%"></i></div>`; }
export function genesHTML(h){
  return `<div class="genes">${GENES.map(k => {
    const a = [...h.genes[k]].sort((x,y) => y-x).map(i => ALLELES[k][i]).join('/');
    return `<span class="gene ${has(h.genes[k])?'on':''}" title="${GENE_NAME[k]}">${GENE_NAME[k]} ${a}</span>`;
  }).join('')}</div>`;
}

