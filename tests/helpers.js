import { vi } from 'vitest';
import * as S from '../js/state.js';
import { GENES } from '../js/genetics.js';
import { DAY_MS } from '../js/data.js';
import { closeModal } from '../js/ui.js';

/** Start a brand-new game (Daisy + Sunny) with no welcome popup. */
export function freshGame(){
  localStorage.clear();
  // close any popup a previous test left open (and anything queued behind it)
  for (let i = 0; i < 20 && document.querySelector('#modal.on'); i++) closeModal();
  document.getElementById('mbox').innerHTML = '';
  S.newGame();
  S.state.intro = false;
  return S.state;
}

/**
 * Build a genotype. Pass how many "special" copies (0, 1 or 2) of each gene:
 * genes({E: 1, Cr: 2}) → E/e, a/a, Cr/Cr, everything else plain.
 */
export function genes(copies = {}){
  const g = {};
  for (const k of GENES){
    const n = copies[k] || 0;
    g[k] = n === 2 ? [1, 1] : n === 1 ? [1, 0] : [0, 0];
  }
  return g;
}

/** Make Math.random return these numbers (looping) while fn runs. */
export function withRandom(values, fn){
  let i = 0;
  const spy = vi.spyOn(Math, 'random').mockImplementation(() => values[i++ % values.length]);
  try { return fn(); } finally { spy.mockRestore(); }
}

/** Put the game clock at a given hour of the current day (6 = sunrise, 21 = night). */
export function setHour(hour, dayIndex = 0){
  S.state.dayEpoch = Date.now() - dayIndex * DAY_MS - (hour - 6) / 18 * DAY_MS;
}

/** A pointer event with a finger id, like a phone touch. */
export function pointer(type, pointerId, extra = {}){
  const ev = new Event(type, { bubbles: true, cancelable: true });
  return Object.assign(ev, { pointerId, clientX: 0, clientY: 0, ...extra });
}

/** Read one pixel of a canvas as '#rrggbb' (or null when transparent). */
export function pixel(canvas, x, y){
  const [r, g, b, a] = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
  if (!a) return null;
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
