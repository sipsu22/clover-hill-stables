// Small helpers: random numbers, clamping, colors, formatting.
/* ---------- helpers ---------- */
export const $ = s => document.querySelector(s);
export const now = () => Date.now();
export const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
export const rand = (a,b) => a + Math.random()*(b-a);
export const randi = (a,b) => Math.floor(rand(a, b+1));
export const pick = a => a[Math.floor(Math.random()*a.length)];
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const round5 = v => Math.max(5, Math.round(v/5)*5);
export function mixHex(a, b){
  const p = h => { const n = parseInt(h.slice(1),16); return [n>>16, n>>8&255, n&255]; };
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round((v + y[i]) / 2).toString(16).padStart(2,'0')).join('');
}
export function shade(hex, amt){
  const n = parseInt(hex.slice(1),16); const ch = [n>>16, n>>8&255, n&255];
  return '#' + ch.map(v => Math.round(amt<0 ? v*(1+amt) : v+(255-v)*amt)).map(v => v.toString(16).padStart(2,'0')).join('');
}
export function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
export function fmt(sec){ sec=Math.max(0,Math.ceil(sec)); const m=Math.floor(sec/60), s=sec%60; return m ? `${m}:${String(s).padStart(2,'0')}` : `${s}s`; }

