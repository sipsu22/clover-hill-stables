import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import { dayRules, tick, save, load } from '../js/game.js';
import { SAVE_KEY } from '../js/data.js';
import { freshGame, setHour, genes } from './helpers.js';

let st, daisy, sunny;
beforeEach(() => { st = freshGame(); daisy = S.byId(1); sunny = S.byId(2); });

describe('mornings and the paddock deadline', () => {
  it('horses still inside at 12:00 lose 20 happiness, horses outside do not', () => {
    daisy.out = true; daisy.happy = 60; sunny.happy = 60;
    setHour(11.9); dayRules(Date.now(), 0);
    setHour(12.1); dayRules(Date.now(), 0);
    expect(sunny.happy).toBe(40);
    expect(daisy.happy).toBe(60);
  });

  it('the horse you are leading at 12:00 does not count as forgotten', () => {
    st.player.leading = sunny.id; sunny.happy = 60;
    setHour(11.9); dayRules(Date.now(), 0);
    setHour(12.1); dayRules(Date.now(), 0);
    expect(sunny.happy).toBe(60);
  });

  it('a new day starts with every horse in its stall: nobody is turned out automatically', () => {
    for (const h of st.horses) h.out = true;
    st.player.leading = 1;
    setHour(6.2, 1);                    // next morning
    expect(dayRules(Date.now(), 0)).toBe(true);
    expect(st.horses.every(h => !h.out)).toBe(true);
    expect(st.player.leading).toBeNull();
    expect(st.day).toBe(1);
  });

  it('and stays that way through the morning unless you lead them', () => {
    setHour(6.5); dayRules(Date.now(), 0);
    setHour(11.5); dayRules(Date.now(), 1);
    expect(st.horses.every(h => !h.out)).toBe(true);
  });

  it('a new day rolls new weather', () => {
    st.weather = 'snow';
    const seen = new Set();
    for (let d = 1; d < 40; d++){ setHour(6.1, d); dayRules(Date.now(), 0); seen.add(st.weather); }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('at 21:00 every horse walks back in for the night', () => {
    daisy.out = true; st.player.leading = sunny.id;
    setHour(21.5); dayRules(Date.now(), 0);
    expect(daisy.out).toBe(false);
    expect(st.player.leading).toBeNull();
  });
});

describe('grazing and rugs while you play', () => {
  it('a horse in the paddock with the right rug gets happier', () => {
    setHour(13); st.weather = 'sunny'; daisy.out = true; daisy.rug = 1; daisy.happy = 50;
    dayRules(Date.now(), 0); dayRules(Date.now(), 4);
    expect(daisy.happy).toBeCloseTo(50 + .09 * 4);
  });

  it('without the right rug it gets sadder instead', () => {
    setHour(13); st.weather = 'rain'; daisy.out = true; daisy.rug = 1; daisy.happy = 50;
    dayRules(Date.now(), 0); dayRules(Date.now(), 4);
    expect(daisy.happy).toBeCloseTo(50 - .08 * 4);
  });

  it('a horse stuck inside after 12:00 slowly gets sad; before 12:00 it is fine', () => {
    sunny.happy = 50;
    setHour(9);  dayRules(Date.now(), 0); dayRules(Date.now(), 4);
    expect(sunny.happy).toBe(50);
    setHour(14); dayRules(Date.now(), 0); dayRules(Date.now(), 4);
    expect(sunny.happy).toBeLessThan(50);
  });
});

describe('foals being born', () => {
  const pregnancy = () => ({due: Date.now() - 1, sire: 'Sunny', warned: false,
    foal: {genes: genes({E: 1, A: 1, Cr: 1}), sex: 'F', speed: 50, stamina: 50, temper: 50, face: 'none', socks: 0}});

  it('the foal arrives when it is due and there is room', () => {
    daisy.preg = pregnancy();
    tick();
    expect(st.horses).toHaveLength(3);
    const foal = st.horses[2];
    expect(S.isFoal(foal)).toBe(true);
    expect(daisy.preg).toBeNull();
    expect(st.found.Buckskin).toBe(true);
  });

  it('waits when the stable is full', () => {
    st.cap = 2; daisy.preg = pregnancy();
    tick();
    expect(st.horses).toHaveLength(2);
    expect(daisy.preg.warned).toBe(true);
  });
});

describe('saving and loading', () => {
  it('saves to the browser and loads the same game back', () => {
    st.coins = 777;
    save();
    expect(load().coins).toBe(777);
  });

  it('upgrades an old save with everything newer versions added', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({v: 1, coins: 10, horses: [], plots: [], player: {x: 1, y: 5, dir: 'down'}, stableHand: true}));
    const s = load();
    expect(s.coins).toBe(510);                      // stable hand removed → 500 coins back
    expect(s.stableHand).toBeUndefined();
    expect(s.handRefund).toBe(true);
    expect(s.player.map).toBe('barn');
    expect(s.player.leading).toBeNull();
    expect(s.weather).toBe('sunny');
    expect(s.rugs).toHaveLength(2);
    expect(s.saddles).toHaveLength(1);
    expect(s.unlocked).toEqual({jumping: 0, race: 0});
    expect(s.trophies).toEqual([]);
  });

  it('ignores broken or unknown saves', () => {
    localStorage.setItem(SAVE_KEY, '{not json');
    expect(load()).toBeNull();
    localStorage.setItem(SAVE_KEY, JSON.stringify({v: 99}));
    expect(load()).toBeNull();
  });
});
