import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import * as A from '../js/affinity.js';
import { freshGame, genes } from './helpers.js';

let st, daisy, sunny;
beforeEach(() => { st = freshGame(); daisy = S.byId(1); sunny = S.byId(2); });

describe('friendship between horses', () => {
  it('is the same whichever horse you ask about', () => {
    A.addBond(daisy, sunny, 12);
    expect(A.getBond(daisy, sunny)).toBe(12);
    expect(A.getBond(sunny, daisy)).toBe(12);
    expect(A.pairKey(daisy, sunny)).toBe(A.pairKey(sunny, daisy));
  });

  it('stays between 0 and 100', () => {
    A.addBond(daisy, sunny, 500); expect(A.getBond(daisy, sunny)).toBe(100);
    A.addBond(daisy, sunny, -900); expect(A.getBond(daisy, sunny)).toBe(0);
  });

  it('grows fastest grazing together in the paddock', () => {
    daisy.out = sunny.out = true;
    A.updateBonds(10);
    expect(A.getBond(daisy, sunny)).toBeCloseTo(A.BOND_RATES.paddock * 10);
  });

  it('grows slowly for stall neighbors, not for horses far apart', () => {
    const far = S.makeHorse({name: 'Far'});
    st.horses.push(S.makeHorse({name: 'Middle'}), far);   // stalls 0 Daisy, 1 Sunny, 2 Middle, 3 Far
    A.updateBonds(100);
    expect(A.getBond(daisy, sunny)).toBeCloseTo(A.BOND_RATES.neighbors * 100);
    expect(A.getBond(daisy, far)).toBe(0);
  });

  it('stalls in different rows are not neighbors', () => {
    expect(A.stallNeighbors(0, 1)).toBe(true);
    expect(A.stallNeighbors(7, 8)).toBe(false);
    expect(A.stallNeighbors(8, 9)).toBe(true);
  });

  it('grows while both wait in the Heart Barn pens', () => {
    daisy.pen = 'A'; sunny.pen = 'B';
    A.updateBonds(4);
    expect(A.getBond(daisy, sunny)).toBeCloseTo(A.BOND_RATES.pens * 4);
  });

  it('lists a horse’s best friends, best first', () => {
    const c = S.makeHorse({name: 'Comet'}); st.horses.push(c);
    A.addBond(daisy, sunny, 20); A.addBond(daisy, c, 60);
    expect(A.bestFriends(daisy).map(([h]) => h.name)).toEqual(['Comet', 'Sunny']);
    expect(A.heartsFor(60)).toBe('♥♥');
  });
});

describe('how well two horses match', () => {
  it('nature match likes similar tempers and different genes', () => {
    const calm = {temper: 50, genes: genes({E: 1})}, calm2 = {temper: 50, genes: genes({E: 1})};
    const wild = {temper: 100, genes: genes({E: 1})}, different = {temper: 50, genes: genes({E: 2, Cr: 1, D: 1, G: 1})};
    expect(A.natureMatch(calm, calm2)).toBe(25);                       // same temper, same genes
    expect(A.natureMatch(calm, wild)).toBe(0);                         // very different tempers
    expect(A.natureMatch(calm, different)).toBeGreaterThan(A.natureMatch(calm, calm2));
    for (const [a, b] of [[calm, wild], [calm, different], [daisy, sunny]]){
      expect(A.natureMatch(a, b)).toBeGreaterThanOrEqual(0);
      expect(A.natureMatch(a, b)).toBeLessThanOrEqual(40);
    }
  });

  it('friendship raises the chance that a love potion works', () => {
    const before = A.breedChance(daisy, sunny);
    A.addBond(daisy, sunny, 60);
    expect(A.breedChance(daisy, sunny)).toBeGreaterThan(before);
  });

  it('the chance is always between 10% and 95%', () => {
    A.addBond(daisy, sunny, 100);
    expect(A.breedChance(daisy, sunny)).toBeLessThanOrEqual(.95);
    expect(A.breedChance({temper: 0, genes: genes({})}, {id: 99, temper: 100, genes: genes({})})).toBeGreaterThanOrEqual(.1);
  });
});
