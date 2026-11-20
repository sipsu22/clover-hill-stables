import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import * as B from '../js/breeding.js';
import * as W from '../js/world.js';
import { ACT } from '../js/actions.js';
import { dayRules } from '../js/game.js';
import { getBond } from '../js/affinity.js';
import { closeModal } from '../js/ui.js';
import { freshGame, withRandom, setHour } from './helpers.js';

let st, daisy, sunny;
const stand = (map, x, y, dir) => Object.assign(st.player, {map, x, y, dir});
const closeAll = () => { for (let i = 0; i < 10 && document.querySelector('#modal.on'); i++) closeModal(); };
function finishCeremony(){ for (let i = 0; i < 60 * 9 && B.ceremony; i++) B.updateCeremony(1/60); closeAll(); }
function readyPair(){
  for (const h of [daisy, sunny]){ h.happy = 90; h.hunger = 90; h.restUntil = 0; }
  daisy.pen = 'A'; sunny.pen = 'B';
}
beforeEach(() => {
  st = freshGame(); st.tab = 'stable';
  daisy = S.byId(1); sunny = S.byId(2);
  finishCeremony();
  W.pl.moving = false;
});

describe('the pens', () => {
  it('know which pen is where', () => {
    expect(B.penAt(3, 2)).toBe('A');
    expect(B.penAt(11, 3)).toBe('B');
    expect(B.penAt(7, 3)).toBeNull();      // the love table
    expect(B.penAt(3, 5)).toBeNull();      // the floor
  });

  it('a horse you lead in waits there; E again leads it back out', () => {
    st.player.leading = 1;
    stand('heart', 3, 4, 'up');
    W.interact();
    expect(daisy.pen).toBe('A');
    expect(st.player.leading).toBeNull();
    W.interact();
    expect(daisy.pen).toBeUndefined();
    expect(st.player.leading).toBe(1);
  });

  it('one horse per pen, and no foals', () => {
    sunny.pen = 'A';
    st.player.leading = 1;
    stand('heart', 3, 4, 'up');
    W.interact();
    expect(daisy.pen).toBeUndefined();
    const foal = S.makeHorse({adultAt: Date.now() + 1e5}); st.horses.push(foal);
    st.player.leading = foal.id;
    stand('heart', 11, 4, 'up');
    W.interact();
    expect(foal.pen).toBeUndefined();
  });

  it('horses in the pens go home to their stalls at night', () => {
    readyPair();
    setHour(21.5); dayRules(Date.now(), 0);
    expect(daisy.pen).toBeUndefined();
    expect(sunny.pen).toBeUndefined();
  });
});

describe('the love potion', () => {
  it('explains what is missing', () => {
    expect(B.whyNot()).toMatch(/Lead a mare and a stallion/);
    daisy.pen = 'A'; const mare2 = S.makeHorse({sex: 'F'}); st.horses.push(mare2); mare2.pen = 'B';
    expect(B.whyNot()).toMatch(/one mare/);
    delete mare2.pen; sunny.pen = 'B';
    daisy.happy = 10; sunny.happy = 90; daisy.hunger = sunny.hunger = 90;
    expect(B.whyNot()).toMatch(/Daisy: Needs to be happier/);
    daisy.happy = 90; st.inv.potion = 0;
    expect(B.whyNot()).toMatch(/love potion/);
    st.inv.potion = 1;
    expect(B.whyNot()).toBeNull();
  });

  it('cannot be used without a potion', () => {
    readyPair(); st.inv.potion = 0;
    ACT.usePotion();
    expect(B.ceremony).toBeNull();
  });

  it('when it works: the curtain closes, and after the magic the mare is expecting', () => {
    readyPair();
    withRandom([0], () => ACT.usePotion());          // a lucky roll
    expect(st.inv.potion).toBe(0);
    expect(B.ceremony).not.toBeNull();
    B.updateCeremony(B.CEREMONY_TIME - .1);
    expect(daisy.preg).toBeFalsy();                  // not yet: the big heart is still growing
    B.updateCeremony(.2);
    expect(daisy.preg).toBeTruthy();
    expect(daisy.preg.sire).toBe('Sunny');
    expect(document.querySelector('#mbox').textContent).toMatch(/It worked/);
    finishCeremony();
    expect(B.ceremony).toBeNull();                   // the curtain opens again
  });

  it('when it does not: no foal, the potion is used up, but they become better friends', () => {
    readyPair();
    const bond = getBond(daisy, sunny);
    withRandom([.999], () => ACT.usePotion());
    finishCeremony();
    expect(daisy.preg).toBeFalsy();
    expect(st.inv.potion).toBe(0);
    expect(getBond(daisy, sunny)).toBeGreaterThan(bond);
  });

  it('nobody can walk around or use things while the magic happens', () => {
    readyPair();
    ACT.usePotion();
    stand('heart', 5, 6, 'up');
    W.pl.tap = 'left';
    W.updatePlayer(1/60);
    expect(W.pl.moving).toBe(false);
    stand('heart', 3, 4, 'up');
    W.interact();
    expect(daisy.pen).toBe('A');                     // E did nothing
  });

  it('the love table shows the chance of a foal', () => {
    readyPair();
    expect(B.tableHTML()).toMatch(/Chance of a foal: <b>\d+%<\/b>/);
  });
});
