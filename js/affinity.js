// Friendship between horses: they like each other more when they spend time together.
// Breeding works best for horses that like each other.
import { clamp } from './util.js';
import { GENES } from './genetics.js';
import { state } from './state.js';

// how fast friendship grows (points per second, 0..100 in total)
export const BOND_RATES = {paddock: .15, pens: .25, neighbors: .03};

export const pairKey = (a, b) => a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
export const getBond = (a, b) => (state.bonds || {})[pairKey(a, b)] || 0;
export function addBond(a, b, n){
  state.bonds = state.bonds || {};
  const k = pairKey(a, b);
  state.bonds[k] = clamp((state.bonds[k] || 0) + n, 0, 100);
}

/** How well two horses suit each other by nature (0..40): a similar temper,
 *  and genes that are different from each other (good for healthy foals). */
export function natureMatch(a, b){
  const temper = Math.max(0, 25 - Math.abs(a.temper - b.temper) / 2);
  const same = g => [...a.genes[g]].sort().join() === [...b.genes[g]].sort().join();
  const different = GENES.filter(g => !same(g)).length;
  return Math.round(temper + different / GENES.length * 15);
}

/** Chance (0.1 .. 0.95) that a love potion works for this pair. */
export const breedChance = (a, b) => clamp(.2 + (natureMatch(a, b) + getBond(a, b) * .6) / 100, .1, .95);

// stalls are numbered by the horse's place in the list: 0-7 top row, 8-15 bottom row
export const stallNeighbors = (i, j) => Math.floor(i / 8) === Math.floor(j / 8) && Math.abs(i - j) === 1;
const inStall = h => !h.out && !h.pen && state.player.leading !== h.id;

/** Called every second while playing: grow friendships. */
export function updateBonds(sec){
  const H = state.horses;
  for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++){
    const a = H[i], b = H[j];
    let rate = 0;
    if (a.out && b.out) rate = BOND_RATES.paddock;
    else if (a.pen && b.pen) rate = BOND_RATES.pens;
    else if (inStall(a) && inStall(b) && stallNeighbors(i, j)) rate = BOND_RATES.neighbors;
    if (rate) addBond(a, b, rate * sec);
  }
}

/** A horse's best friends, best first: [[horse, bond], ...] */
export function bestFriends(h, n = 2){
  return state.horses.filter(x => x !== h).map(x => [x, getBond(h, x)])
    .filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]).slice(0, n);
}
export const heartsFor = v => v >= 75 ? '♥♥♥' : v >= 40 ? '♥♥' : v >= 10 ? '♥' : '♡';
