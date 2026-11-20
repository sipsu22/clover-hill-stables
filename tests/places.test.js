import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import * as W from '../js/world.js';
import * as V from '../js/village.js';
import * as M from '../js/market-map.js';
import * as R from '../js/riding.js';
import { closeModal } from '../js/ui.js';
import '../js/actions.js';     // listens for button clicks
import { freshGame } from './helpers.js';

let st;
const stand = (map, x, y, dir) => Object.assign(st.player, {map, x, y, dir});
const closeAll = () => { for (let i = 0; i < 10 && document.querySelector('#modal.on'); i++) closeModal(); };
const popupTitle = () => document.querySelector('#modal.on #mbox h2')?.textContent || null;
beforeEach(() => { st = freshGame(); st.tab = 'stable'; closeAll(); R.clearRide(); W.pl.moving = false; });

describe('no tab bar: everything is a place', () => {
  it('the page has no tab bar any more', async () => {
    const { render } = await import('../js/views.js');
    render();
    expect(document.querySelectorAll('[data-act=tab]')).toHaveLength(0);
    expect(document.getElementById('scene')).not.toBeNull();
  });
});

describe('the road to the village', () => {
  it('goes south from the fields and back', () => {
    stand('farm', 8, 10, 'down');
    expect(W.tryDoor(8, 11)).toBe(true);
    expect(st.player).toMatchObject({map: 'village', x: 8, y: 0});
    expect(W.tryDoor(8, -1)).toBe(true);
    expect(st.player).toMatchObject({map: 'farm', x: 8, y: 10});
  });

  it('the village has doors to the Market Hall and the Heart Barn', () => {
    stand('village', 3, 5, 'up');
    W.interact();
    expect(st.player.map).toBe('market');
    expect(W.tryDoor(-1, 5)).toBe(true);
    expect(st.player).toMatchObject({map: 'village', x: 3, y: 5});
    stand('village', 12, 5, 'up');
    W.interact();
    expect(st.player.map).toBe('heart');
    expect(W.tryDoor(-1, 6)).toBe(true);
    expect(st.player).toMatchObject({map: 'village', x: 12, y: 5});
  });

  it('buildings, the arena and trees block the way; the road does not', () => {
    expect(V.walk(2, 2)).toBe(false);     // Market Hall
    expect(V.walk(12, 2)).toBe(false);    // Heart Barn
    expect(V.walk(5, 9)).toBe(false);     // inside the arena
    expect(V.walk(8, 3)).toBe(true);      // the road
    expect(V.walk(5, 5)).toBe(true);      // the path
  });
});

describe('the riding arena gate', () => {
  it('needs a horse you led there', () => {
    stand('village', 8, 6, 'down');
    W.interact();
    expect(popupTitle()).toBeNull();
  });

  it('opens the riding menu for the horse you brought, and riding starts from there', () => {
    const sunny = S.byId(2); sunny.saddle = 0;
    st.player.leading = 2;
    stand('village', 8, 6, 'down');
    W.interact();
    expect(popupTitle()).toMatch(/Riding arena/);
    expect(st.rideSel).toBe(2);
    document.querySelector('[data-act=startRide]').click();
    expect(R.ride).not.toBeNull();
    expect(R.ride.h).toBe(sunny);
    expect(popupTitle()).toBeNull();
    R.endRide(true); closeAll();
    expect(st.player.leading).toBe(2);           // still holding Sunny afterwards
  });
});

describe('the Market Hall', () => {
  it('knows which stall is which', () => {
    expect(M.stallAt(1, 3)).toBe('horses');
    expect(M.stallAt(14, 2)).toBe('bundles');
    expect(M.stallAt(10, 8)).toBe('potions');
    expect(M.stallAt(6, 5)).toBeNull();
  });

  it('pressing E at a stall opens that shop', () => {
    stand('market', 7, 4, 'up');
    W.interact();
    expect(popupTitle()).toMatch(/Rugs & sheets/);
    closeAll();
    stand('market', 4, 7, 'down');
    W.interact();
    expect(popupTitle()).toMatch(/Produce stand/);
  });

  it('a shop popup updates itself after you buy something', () => {
    st.coins = 500;
    stand('market', 10, 7, 'down');
    W.interact();
    document.querySelector('[data-act=buyPotion]').click();
    expect(document.querySelector('#mbox').textContent).toMatch(/You have 2/);
  });
});

describe('the barn', () => {
  it('the Horse Book is on a stand you walk up to', () => {
    expect(W.barnWalk(...W.BOOK_TILE)).toBe(false);
    stand('barn', 15, 6, 'down');
    W.interact();
    expect(popupTitle()).toMatch(/Horse Book/);
  });

  it('decorations are never delivered onto the book stand', () => {
    stand('barn', 2, 5, 'down');
    for (let i = 0; i < 60; i++){ const s = W.freeSpot(); if (!s) break; expect(W.isBookTile(...s)).toBe(false); st.decor.push({id: 500 + i, type: 'barrel', x: s[0], y: s[1]}); }
  });

  it('a locked stall lets you build more stalls', () => {
    st.coins = 1000;
    stand('barn', 9, 4, 'up');            // stall 4: locked when you have 4 stalls
    W.interact();
    expect(popupTitle()).toMatch(/Build more stalls/);
    document.querySelector('[data-act=upgradeStable]').click();
    expect(st.cap).toBe(6);
  });

  it('a horse away in the paddock or the Heart Barn is not in its stall', () => {
    S.byId(1).pen = 'A';
    stand('barn', 1, 4, 'up');
    W.interact();
    expect(popupTitle()).toBeNull();
  });
});

describe('the paddock', () => {
  it('E next to a horse opens its card, with a button to lead it', () => {
    const daisy = S.byId(1); daisy.out = true;
    W.placeInPaddock(daisy, 6, 5);
    stand('paddock', 5, 5, 'right');
    W.interact();
    expect(document.querySelector('#mbox [data-act=lead]')).not.toBeNull();
    document.querySelector('#mbox [data-act=lead]').click();
    expect(st.player.leading).toBe(1);
    expect(daisy.out).toBe(false);
  });
});
