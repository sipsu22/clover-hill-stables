import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import * as W from '../js/world.js';
import { ACT } from '../js/actions.js';
import { CROPS } from '../js/data.js';
import { freshGame, setHour } from './helpers.js';

let st;
beforeEach(() => {
  st = freshGame();
  st.tab = 'stable';
  W.pl.moving = false; W.pl.path = []; W.pl.after = null;
});
const stand = (map, x, y, dir) => Object.assign(st.player, {map, x, y, dir});

describe('barn layout', () => {
  it('finds the stall in front of you', () => {
    expect(W.stallAt(0, 2)).toBe(0);
    expect(W.stallAt(3, 3)).toBe(1);
    expect(W.stallAt(15, 9)).toBe(15);
    expect(W.stallAt(5, 5)).toBe(-1);
  });

  it('you can walk in the aisle, but not into stalls or onto decorations', () => {
    expect(W.barnWalk(5, 5)).toBe(true);
    expect(W.barnWalk(5, 3)).toBe(false);
    expect(W.barnWalk(14, 4)).toBe(false);   // the starting hay bale
  });

  it('finds the shortest path around things', () => {
    const path = W.bfs(1, 5, (x, y) => x === 5 && y === 5, 'barn');
    expect(path).toHaveLength(4);
    expect(path.at(-1)).toEqual([5, 5]);
    expect(W.bfs(1, 5, (x, y) => x === 5 && y === 2, 'barn')).toBeNull();   // inside a stall
  });

  it('new decorations never block the way or the door', () => {
    stand('barn', 2, 5, 'down');
    for (let i = 0; i < 80; i++){
      const spot = W.freeSpot(); if (!spot) break;
      expect(W.isBarnDoorTile(...spot)).toBe(false);
      st.decor.push({id: 100 + i, type: 'barrel', x: spot[0], y: spot[1]});
      expect(W.stillConnected()).toBe(true);
    }
  });

  it('refuses to put a decoration down where it would wall off part of the aisle', () => {
    st.decor = [{id: 1, type: 'barrel', x: 8, y: 4}, {id: 2, type: 'barrel', x: 8, y: 5}, {id: 3, type: 'barrel', x: 8, y: 6}];
    stand('barn', 7, 7, 'right');
    st.player.carry = {id: 9, type: 'cat'};
    W.interact();
    expect(st.decor).toHaveLength(3);
    expect(st.player.carry).not.toBeNull();
  });
});

describe('farm layout and fields', () => {
  it('plot numbers and positions match both ways', () => {
    for (let i = 0; i < 12; i++) expect(W.plotAt(...W.plotPos(i))).toBe(i);
    expect(W.plotAt(0, 0)).toBe(-1);
  });

  it('the barn, pond, trees and fence block you; the gate and fields do not', () => {
    expect(W.farmWalk(2, 2)).toBe(false);    // barn building
    expect(W.farmWalk(2, 8)).toBe(false);    // pond
    expect(W.farmWalk(6, 3)).toBe(false);    // fence
    expect(W.farmWalk(8, 6)).toBe(true);     // gate
    expect(W.farmWalk(7, 3)).toBe(true);     // a field
  });

  it('plants the chosen seed and harvests it when grown', () => {
    stand('farm', 7, 4, 'up');
    st.seed = 'hay';
    W.interact();
    expect(st.plots[0].crop).toBe('hay');
    expect(st.coins).toBe(150 - CROPS.hay.seed);
    W.interact();                                   // not ready yet: nothing happens
    expect(st.plots[0].crop).toBe('hay');
    st.plots[0].at -= CROPS.hay.time * 1000;
    const hay = st.inv.hay;
    W.interact();
    expect(st.inv.hay).toBe(hay + CROPS.hay.yield);
    expect(st.plots[0].crop).toBeNull();
  });
});

describe('doors between the barn, the farm and the paddock', () => {
  it('walks through every door and back', () => {
    stand('barn', 0, 5, 'left');
    expect(W.tryDoor(-1, 5)).toBe(true);
    expect(st.player).toMatchObject({map: 'farm', x: 2, y: 5});
    expect(W.tryDoor(16, 7)).toBe(true);
    expect(st.player).toMatchObject({map: 'paddock', x: 0, y: 7});
    expect(W.tryDoor(-1, 7)).toBe(true);
    expect(st.player).toMatchObject({map: 'farm', x: 15, y: 7});
    expect(W.tryDoor(2, 4)).toBe(true);
    expect(st.player).toMatchObject({map: 'barn', x: 0, y: 5});
  });

  it('you cannot carry a decoration outside', () => {
    stand('barn', 0, 5, 'left');
    st.player.carry = {id: 5, type: 'cat'};
    W.goTo('farm');
    expect(st.player.map).toBe('barn');
  });
});

describe('leading horses to the paddock (no teleporting!)', () => {
  const daisy = () => S.byId(1);

  it('only works when you stand at the horse’s own stall in the barn', () => {
    stand('paddock', 6, 5, 'right');
    ACT.lead(1);
    expect(st.player.leading).toBeNull();

    stand('barn', 6, 5, 'up');                  // in the barn, but nowhere near Daisy
    ACT.lead(1);
    expect(st.player.leading).toBeNull();

    stand('barn', 2, 4, 'up');                  // at Sunny's stall, not Daisy's
    ACT.lead(1);
    expect(st.player.leading).toBeNull();

    stand('barn', 1, 4, 'up');                  // at Daisy's stall
    ACT.lead(1);
    expect(st.player.leading).toBe(1);
  });

  it('the horse is let go only inside the paddock fence', () => {
    stand('barn', 1, 4, 'up'); ACT.lead(1);
    W.goTo('paddock', 1, 7, 'right');           // outside the fence
    W.interact();
    expect(daisy().out).toBeFalsy();
    W.goTo('paddock', 6, 5, 'right');
    W.interact();
    expect(daisy().out).toBe(true);
    expect(st.player.leading).toBeNull();
  });

  it('one horse at a time, and not at night', () => {
    stand('barn', 1, 4, 'up'); ACT.lead(1);
    stand('barn', 2, 4, 'up'); ACT.lead(2);
    expect(st.player.leading).toBe(1);
    st.player.leading = null;
    setHour(22);
    stand('barn', 1, 4, 'up'); ACT.lead(1);
    expect(st.player.leading).toBeNull();
  });

  it('pressing E in the barn puts the led horse back in its stall', () => {
    stand('barn', 1, 4, 'up'); ACT.lead(1);
    stand('barn', 5, 5, 'down');
    W.interact();
    expect(st.player.leading).toBeNull();
    expect(daisy().out).toBe(false);
  });

  it('the lead button only appears on the card opened at the stall', async () => {
    const { hcardHTML } = await import('../js/views.js');
    expect(hcardHTML(daisy())).not.toContain('data-act="lead"');
    expect(hcardHTML(daisy(), true)).toContain('data-act="lead"');
  });
});
