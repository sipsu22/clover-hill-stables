import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import { freshGame, genes } from './helpers.js';

let st, daisy, sunny;
beforeEach(() => { st = freshGame(); daisy = S.byId(1); sunny = S.byId(2); });

describe('a new game', () => {
  it('starts with 150 coins, Daisy and Sunny, 4 fields and 4 stalls', () => {
    expect(st.coins).toBe(150);
    expect(st.horses.map(h => [h.name, h.sex])).toEqual([['Daisy', 'F'], ['Sunny', 'M']]);
    expect(st.plots).toHaveLength(4);
    expect(st.cap).toBe(4);
    expect(st.market).toHaveLength(3);
  });

  it('starts in the barn in the morning, with no horse being led', () => {
    expect(st.player).toMatchObject({map: 'barn', leading: null, carry: null});
    expect(st.horses.every(h => !h.out)).toBe(true);
  });

  it('already knows the starting coats in the Horse Book (without paying a reward)', () => {
    expect(Object.keys(st.found).sort()).toEqual(['Bay', 'Palomino', 'Pinto']);
  });
});

describe('horse value and prices', () => {
  it('values a horse by coat, pattern and stats', () => {
    expect(S.value(daisy)).toBe(265);   // bay 80 + pinto 120 + stats 62.5 → 265
    expect(S.value(sunny)).toBe(220);   // palomino 160 + stats 60
  });

  it('foals are worth 60%', () => {
    const grown = S.value(sunny);
    sunny.adultAt = Date.now() + 60_000;
    expect(S.value(sunny)).toBe(Math.max(5, Math.round(grown * .6 / 5) * 5));
  });

  it('market horses cost 30% more than they are worth', () => {
    expect(S.marketPrice(daisy)).toBe(345);
  });

  it('new fields and stalls get more expensive', () => {
    expect(S.plotCost()).toBe(50);
    st.plots.push({crop: null, at: 0});
    expect(S.plotCost()).toBe(90);
    expect(S.stableCost()).toBe(150);
    st.cap = 6;
    expect(S.stableCost()).toBe(300);
  });
});

describe('mood and readiness', () => {
  it('mood follows happiness', () => {
    daisy.happy = 80; expect(S.mood(daisy)).toMatch(/Very happy/);
    daisy.happy = 60; expect(S.mood(daisy)).toMatch(/^Happy/);
    daisy.happy = 30; expect(S.mood(daisy)).toMatch(/Grumpy/);
    daisy.happy = 10; expect(S.mood(daisy)).toMatch(/Sad/);
  });

  it('explains why a horse cannot breed', () => {
    daisy.happy = 90; daisy.hunger = 90;
    expect(S.readiness(daisy)).toBeNull();
    daisy.happy = 40; expect(S.readiness(daisy)).toBe('Needs to be happier');
    daisy.hunger = 10; expect(S.readiness(daisy)).toBe('Too hungry');
    daisy.restUntil = Date.now() + 10_000; expect(S.readiness(daisy)).toMatch(/^Resting/);
    daisy.preg = {due: Date.now() + 1000}; expect(S.readiness(daisy)).toBe('Expecting a foal');
    daisy.adultAt = Date.now() + 1000; expect(S.readiness(daisy)).toBe('Too young');
  });

  it('foals are fillies and colts', () => {
    expect(S.sexWord(daisy)).toBe('Mare');
    sunny.adultAt = Date.now() + 1000;
    expect(S.sexWord(sunny)).toBe('Colt');
  });
});

describe('hunger and happiness over time', () => {
  it('food goes down 0.08 per second', () => {
    daisy.hunger = 80;
    S.decay(daisy, 10);
    expect(daisy.hunger).toBeCloseTo(79.2);
  });

  it('decorations slow down sadness (5% each)', () => {
    expect(S.decorBonus()).toBeCloseTo(.05);       // the starting hay bale
    daisy.happy = 70; daisy.hunger = 100;
    S.decay(daisy, 10);
    expect(daisy.happy).toBeCloseTo(70 - .04 * .95 * 10);
  });

  it('decorations help at most 50%', () => {
    st.decor = Array.from({length: 20}, (_, i) => ({id: i, type: 'barrel', x: i % 16, y: 5}));
    expect(S.decorBonus()).toBe(.5);
  });

  it('a very hungry horse gets sad much faster', () => {
    daisy.hunger = 25; daisy.happy = 50;
    S.decay(daisy, 10);
    expect(daisy.happy).toBeCloseTo(50 - .04 * .95 * 10 - .2 * 10);
  });

  it('never goes below zero', () => {
    S.decay(daisy, 100_000);
    expect(daisy.hunger).toBe(0);
    expect(daisy.happy).toBe(0);
  });
});

describe('Horse Book discoveries', () => {
  it('pays 50 coins the first time only', () => {
    const cremello = {genes: genes({Cr: 2})};
    S.discover(cremello);
    expect(st.found.Cremello).toBe(true);
    expect(st.coins).toBe(200);
    S.discover(cremello);
    expect(st.coins).toBe(200);
  });

  it('counts the color and each pattern separately', () => {
    S.discover({genes: genes({E: 1, LP: 1})});   // black appaloosa: two new entries
    expect(st.coins).toBe(250);
  });
});
