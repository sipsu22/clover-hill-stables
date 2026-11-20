import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import * as F from '../js/farmhand.js';
import * as W from '../js/world.js';
import { ACT } from '../js/actions.js';
import { dayRules, tick } from '../js/game.js';
import { rugOK } from '../js/data.js';
import { closeModal } from '../js/ui.js';
import { freshGame, setHour } from './helpers.js';

let st, daisy, sunny;
const closeAll = () => { for (let i = 0; i < 10 && document.querySelector('#modal.on'); i++) closeModal(); };
const work = (seconds, step = 1) => { for (let t = 0; t < seconds; t += step) F.farmhandTick(step); };
beforeEach(() => {
  st = freshGame(); st.tab = 'stable'; closeAll();
  daisy = S.byId(1); sunny = S.byId(2);
  st.coins = 500; setHour(7);
});

describe('hiring the farmhand', () => {
  it('costs the first day’s wage', () => {
    F.hire();
    expect(F.isHired()).toBe(true);
    expect(st.coins).toBe(500 - F.WAGE);
  });

  it('needs enough coins', () => {
    st.coins = 10;
    F.hire();
    expect(F.isHired()).toBe(false);
    expect(st.coins).toBe(10);
  });

  it('is done at the village notice board', () => {
    Object.assign(st.player, {map: 'village', x: 5, y: 6, dir: 'left'});
    W.pl.moving = false;
    W.interact();
    expect(document.querySelector('#modal.on #mbox h2').textContent).toMatch(/Help wanted/);
    document.querySelector('[data-act=hireHand]').click();
    expect(F.isHired()).toBe(true);
  });

  it('takes a wage every morning, and goes home if you cannot pay', () => {
    F.hire();
    setHour(6.1, 1); dayRules(Date.now(), 0);
    expect(st.coins).toBe(500 - 2 * F.WAGE);
    expect(F.isHired()).toBe(true);
    st.coins = 5;
    setHour(6.1, 2); dayRules(Date.now(), 0);
    expect(F.isHired()).toBe(false);
    expect(st.coins).toBe(5);
  });

  it('can be let go', () => {
    F.hire(); work(2);
    F.letGo();
    expect(F.isHired()).toBe(false);
    expect(st.horses.some(h => h.withHand)).toBe(false);   // the horse Sam was walking goes back to its stall
    work(30);
    expect(daisy.out || sunny.out).toBeFalsy();
  });
});

describe('what the farmhand does', () => {
  it('puts the right sheet on for today’s weather, using rugs you own', () => {
    st.weather = 'rain';
    F.hire();
    expect(rugOK(daisy)).toBe(true);                // you own one rain sheet: it goes on the first horse
    expect(rugOK(sunny)).toBe(false);               // …and there isn't a second one
  });

  it('walks horses out one at a time — no teleporting', () => {
    F.hire();
    work(1);
    expect(daisy.withHand).toBe(true);              // on the way
    expect(daisy.out).toBeFalsy();
    expect(sunny.withHand).toBeFalsy();             // waiting for Sam to come back
    work(F.TRIP_SECONDS);
    expect(daisy.out).toBe(true);
    expect(daisy.outToday).toBe(true);
    expect(sunny.withHand).toBe(true);
    work(F.TRIP_SECONDS);
    expect(sunny.out).toBe(true);
    expect(F.tripProgress()).toBeNull();
  });

  it('skips horses you are leading, horses in the Heart Barn, and horses that were out already', () => {
    st.player.leading = 1;
    sunny.pen = 'B';
    const c = S.makeHorse({name: 'Comet', outToday: true}); st.horses.push(c);
    F.hire();
    work(20);
    expect(daisy.out || sunny.out || c.out).toBeFalsy();
  });

  it('you cannot take a horse away from the farmhand mid-walk', () => {
    F.hire(); work(1);
    Object.assign(st.player, {map: 'barn', x: 1, y: 4, dir: 'up'});
    ACT.lead(1);
    expect(st.player.leading).toBeNull();
  });

  it('feeds hungry horses from storage: hay first', () => {
    F.hire();
    daisy.hunger = 20;
    work(1);
    expect(daisy.hunger).toBe(55);
    expect(st.inv.hay).toBe(11);
  });

  it('waits a little before feeding the same horse again', () => {
    F.hire();
    daisy.hunger = 0;
    work(1); work(1);
    expect(st.inv.hay).toBe(11);
  });

  it('uses oats and carrots when the hay is gone, and says so when there is no food at all', () => {
    F.hire();
    st.inv = {hay: 0, oats: 1, carrot: 0, potion: 0};
    daisy.hunger = 20; sunny.hunger = 20;
    work(1);
    expect(st.inv.oats).toBe(0);
    expect(daisy.hunger).toBe(50);
    expect(sunny.hunger).toBe(20);                  // nothing left for Sunny
    expect([...document.querySelectorAll('.toast')].some(t => /out of horse food/.test(t.textContent))).toBe(true);
  });

  it('does not work at night', () => {
    F.hire();
    setHour(22);
    work(20);
    expect(daisy.withHand || daisy.out).toBeFalsy();
  });

  it('runs on its own as the game ticks', () => {
    F.hire();
    st.last = Date.now() - 1000; tick();
    expect(daisy.withHand).toBe(true);
  });
});
