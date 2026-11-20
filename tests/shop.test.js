import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import * as Shop from '../js/shop.js';
import { ACT } from '../js/actions.js';
import { BOOK, BUNDLES, CROPS, RUG_COLORS, SADDLES, SHOP, bundleWorth } from '../js/data.js';
import { freshGame } from './helpers.js';

let st;
const el = () => document.createElement('button');
beforeEach(() => { st = freshGame(); st.tab = 'stable'; });
const DAYS = Array.from({length: 30}, (_, i) => i);

describe('prices change a little every day', () => {
  it('stay between 85% and 120% of the normal price', () => {
    for (const d of DAYS) for (const k of ['potion', 'saddle:gold', 'decor:cat']){
      const m = Shop.priceMult(k, d);
      expect(m).toBeGreaterThanOrEqual(.85);
      expect(m).toBeLessThanOrEqual(1.2);
    }
  });

  it('are the same all day, and different on other days', () => {
    expect(Shop.priceMult('potion', 3)).toBe(Shop.priceMult('potion', 3));
    expect(new Set(DAYS.map(d => Shop.priceMult('potion', d))).size).toBeGreaterThan(5);
  });

  it('bundles are always cheaper than their contents, whatever the day', () => {
    for (const d of DAYS) for (const b of BUNDLES) expect(Shop.priceOf.bundle(b, d), `${b.id} day ${d}`).toBeLessThan(bundleWorth(b));
  });

  it('the produce stand never buys crops for more than it sells them', () => {
    for (const d of DAYS) for (const k of Object.keys(CROPS)) expect(Shop.priceOf.cropSell(k, d)).toBeLessThan(Shop.priceOf.cropBuy(k, d));
  });
});

describe('stock rotates every day', () => {
  it('each stall has a few things today', () => {
    expect(Shop.stock('tack', 1)).toHaveLength(3);
    expect(Shop.stock('decor', 1)).toHaveLength(4);
    expect(Shop.stock('bundles', 1)).toHaveLength(2);
    for (const t of Shop.stock('tack', 1)) expect(SADDLES[t]).toBeDefined();
    for (const t of Shop.stock('decor', 1)) expect(SHOP[t]).toBeDefined();
  });

  it('the rug stall always has one rug of each kind, so you can dress for any weather', () => {
    for (const d of DAYS){
      const s = Shop.stock('rugs', d);
      expect(s.map(([k]) => k).sort()).toEqual(['fleece', 'fly', 'rain']);
      for (const [k, c] of s) expect(RUG_COLORS[k][c]).toBeDefined();
    }
  });

  it('is the same all day, and changes over the days', () => {
    expect(Shop.stock('tack', 4)).toEqual(Shop.stock('tack', 4));
    expect(new Set(DAYS.map(d => Shop.stock('tack', d).join())).size).toBeGreaterThan(3);
  });

  it('the horse dealer gets new horses every morning', async () => {
    const { dayRules } = await import('../js/game.js');
    const before = st.market.map(h => h.id).join();
    st.dayEpoch -= 24 * 60 * 60 * 1000;           // a later day
    dayRules(Date.now(), 0);
    expect(st.market.map(h => h.id).join()).not.toBe(before);
  });

  it('every stall can be shown', () => {
    for (const id of Object.keys(Shop.STALLS)){
      const html = Shop.stallHTML(id);
      expect(html).toContain(Shop.STALLS[id].name);
    }
  });
});

describe('buying at the market', () => {
  it('a new horse follows you home: it is not teleported into the barn', () => {
    st.coins = 5000;
    const h = st.market[0];
    ACT.buyHorse(0);
    expect(st.horses).toContain(h);
    expect(st.player.leading).toBe(h.id);
    expect(h.out).toBeFalsy();
  });

  it('you cannot buy a horse while leading another one, or when the stable is full', () => {
    st.coins = 5000;
    st.player.leading = 1;
    ACT.buyHorse(0);
    expect(st.horses).toHaveLength(2);
    st.player.leading = null; st.cap = 2;
    ACT.buyHorse(0);
    expect(st.horses).toHaveLength(2);
  });

  it('pays today’s price', () => {
    st.coins = 5000;
    for (const [k] of BOOK) st.found[k] = true;   // no Horse Book reward mixed in
    const price = Shop.priceOf.horse(st.market[0]);
    ACT.buyHorse(0);
    expect(st.coins).toBe(5000 - price);
  });

  it('love potions and DNA kits from the apothecary', () => {
    st.coins = 500;
    ACT.buyPotion(null, null, el());
    ACT.buyDNA(null, null, el());
    expect(st.inv.potion).toBe(2);
    expect(st.dnaFree).toBe(1);
    expect(st.coins).toBe(500 - Shop.priceOf.potion() - Shop.priceOf.dna());
  });

  it('the produce stand buys crops and sells food at today’s prices', () => {
    ACT.sellCrop(null, 'hay:1', el());
    expect(st.inv.hay).toBe(11);
    expect(st.coins).toBe(150 + Shop.priceOf.cropSell('hay'));
    ACT.buyFood(null, 'oats', el());
    expect(st.inv.oats).toBe(5);
  });
});
