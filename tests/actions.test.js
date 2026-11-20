import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import { ACT } from '../js/actions.js';
import { BUNDLES } from '../js/data.js';
import { priceOf } from '../js/shop.js';
import { freshGame } from './helpers.js';

let st, daisy, sunny;
const el = () => document.createElement('button');
beforeEach(() => {
  st = freshGame(); st.tab = 'stable';
  daisy = S.byId(1); sunny = S.byId(2);
});

describe('feeding and care', () => {
  it('hay fills the horse up and is used from storage', () => {
    daisy.hunger = 40;
    ACT.feed(1, 'hay', el());
    expect(daisy.hunger).toBe(75);
    expect(st.inv.hay).toBe(11);
  });

  it('a full horse refuses hay, but still takes a carrot', () => {
    daisy.hunger = 99; daisy.happy = 50;
    ACT.feed(1, 'hay', el());
    expect(st.inv.hay).toBe(12);
    ACT.feed(1, 'carrot', el());
    expect(daisy.happy).toBe(70);
  });

  it('brushing makes a horse happier, then needs a little break', () => {
    daisy.happy = 50;
    ACT.brush(1, null, el());
    ACT.brush(1, null, el());
    expect(daisy.happy).toBe(62);
  });
});

describe('shop', () => {
  it('a decoration goes into the barn aisle; a hay bale also brings 10 hay', () => {
    const decor = st.decor.length;
    ACT.buyItem(null, 'hayBale');
    expect(st.decor).toHaveLength(decor + 1);
    expect(st.inv.hay).toBe(22);
    expect(st.coins).toBe(150 - priceOf.decor('hayBale'));
  });

  it('bundles add everything inside them', () => {
    const feed = BUNDLES.find(b => b.id === 'feed');
    ACT.buyBundle(null, 'feed');
    expect(st.inv).toMatchObject({hay: 32, oats: 14, carrot: 14});
    expect(st.coins).toBe(150 - priceOf.bundle(feed));
  });

  it('nothing is bought without enough coins', () => {
    st.coins = 10;
    ACT.buyBundle(null, 'deluxe');
    ACT.buyRug(null, 'fleece:pink');
    expect(st.coins).toBe(10);
    expect(st.rugs).toHaveLength(2);
  });

  it('fields stop at 12', () => {
    st.coins = 99999;
    for (let i = 0; i < 20; i++) ACT.buyPlot();
    expect(st.plots).toHaveLength(12);
  });
});

describe('rugs and saddles', () => {
  it('puts a rug on and takes it off', () => {
    ACT.rug(1, 'fly:white', el());
    expect(daisy.rug).toBe(1);
    ACT.rug(1, 'none', el());
    expect(daisy.rug).toBeNull();
  });

  it('a rug or saddle can only be worn by one horse at a time', () => {
    ACT.rug(1, 'fly:white', el());
    ACT.rug(2, 'fly:white', el());
    expect(sunny.rug).toBeUndefined();
    ACT.equip(1, 'brown', el());
    ACT.equip(2, 'brown', el());
    expect(daisy.saddle).toBe(0);
    expect(sunny.saddle).toBeUndefined();
  });
});

describe('selling', () => {
  it('selling asks first, then pays the horse’s value', () => {
    const worth = S.value(sunny);
    ACT.sell(2);
    expect(st.horses).toHaveLength(2);                 // only asked so far
    ACT.sellYes(2);
    expect(st.horses).toHaveLength(1);
    expect(st.coins).toBe(150 + worth);
  });

  it('a mare expecting a foal cannot be sold', () => {
    daisy.preg = {due: Date.now() + 1e5};
    ACT.sell(1);
    expect(document.querySelector('#mbox [data-act=sellYes]')).toBeNull();
  });
});
