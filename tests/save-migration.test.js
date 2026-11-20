// SAVE MIGRATION TESTS — players must never lose their farm when the game updates.
//
// tests/fixtures/saves/*.json are REAL saves captured from every released version of the game
// (made with `node scripts/capture-save.mjs <git-ref>`). Each one is loaded by the current game
// and checked: nothing the player earned is lost, every field the current game needs exists,
// and the game can actually be played with it.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as S from '../js/state.js';
import { load, save, tick, dayRules } from '../js/game.js';
import { SAVE_KEY, WEATHER, CROPS, DAY_MS } from '../js/data.js';
import { GENES, phen } from '../js/genetics.js';
import { render, openBook, openBuild, horseModal } from '../js/views.js';
import { openStall, TOP_STALLS, BOTTOM_STALLS } from '../js/market-map.js';
import { openTable } from '../js/breeding.js';
import { ACT } from '../js/actions.js';
import * as W from '../js/world.js';
import * as R from '../js/riding.js';
import { horseCanvas } from '../js/sprites.js';
import { closeModal } from '../js/ui.js';

const DIR = path.join(import.meta.dirname, 'fixtures/saves');
const FIXTURES = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()
  .map(file => ({file, ...JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'))}));

const clone = x => JSON.parse(JSON.stringify(x));
function loadSave(raw){
  localStorage.setItem(SAVE_KEY, typeof raw === 'string' ? raw : JSON.stringify(raw));
  return load();
}
function closeAllPopups(){ for (let i = 0; i < 20 && document.querySelector('#modal.on'); i++) closeModal(); }

/** Everything the current game expects a save to have. */
function expectCurrentShape(s){
  expect(s.v).toBe(1);
  expect(typeof s.coins).toBe('number');
  for (const k of ['hay', 'carrot', 'oats']) expect(typeof s.inv[k]).toBe('number');
  expect(Array.isArray(s.plots)).toBe(true);
  for (const p of s.plots) expect(p.crop === null || p.crop in CROPS).toBe(true);
  expect(Array.isArray(s.horses)).toBe(true);
  for (const h of s.horses){
    for (const g of GENES) expect(h.genes[g]).toHaveLength(2);
    for (const k of ['speed', 'stamina', 'temper', 'hunger', 'happy']) expect(typeof h[k]).toBe('number');
  }
  expect(Array.isArray(s.decor)).toBe(true);
  expect(Array.isArray(s.saddles)).toBe(true);
  expect(Array.isArray(s.rugs)).toBe(true);
  expect(['barn', 'farm', 'paddock']).toContain(s.player.map);
  expect(s.player.leading === null || typeof s.player.leading === 'number').toBe(true);
  expect(Object.keys(WEATHER)).toContain(s.weather);
  expect(typeof s.dayEpoch).toBe('number');
  expect(s.unlocked).toEqual({jumping: expect.any(Number), race: expect.any(Number)});
  expect(Array.isArray(s.trophies)).toBe(true);
  expect(s.seed in CROPS).toBe(true);
  expect(s.stableHand).toBeUndefined();          // removed feature: must be cleaned up
  expect(typeof s.inv.potion).toBe('number');    // love potions (breeding in the Heart Barn)
  expect(typeof s.bonds).toBe('object');         // friendships between horses
  expect(s.farmhand).toMatchObject({hired: expect.any(Boolean)});   // the farmhand (not hired in old saves)
  expect(s.sel).toBeUndefined();                 // old breeding-tab selection is gone
  expect(s.decor.some(d => d.x === 15 && d.y === 7)).toBe(false);   // the Horse Book stand's tile is free
}

beforeEach(() => { localStorage.clear(); R.clearRide(); closeAllPopups(); });

it('has a real save from every released version', () => {
  expect(FIXTURES.length).toBeGreaterThanOrEqual(4);
  for (const f of FIXTURES) expect(f._captured.from, f.file).toMatch(/^[0-9a-f]{7,}$/);
});

describe.each(FIXTURES)('save from $file', ({save: original}) => {
  it('loads', () => {
    expect(loadSave(original)).not.toBeNull();
  });

  it('keeps everything the player earned', () => {
    const s = loadSave(original);
    const refund = original.stableHand ? 500 : 0;
    expect(s.coins).toBe(original.coins + refund);
    expect(s.inv).toMatchObject(original.inv);
    expect(s.inv.potion).toBe(original.inv.potion ?? 1);   // farms from before love potions get one to try
    expect(s.cap).toBe(original.cap);
    expect(s.plots).toEqual(original.plots);
    expect(s.found).toEqual(original.found);
    expect(s.horses.map(h => [h.id, h.name, h.sex, h.genes, h.speed, h.stamina, h.temper, h.saddle, h.rug ?? null]))
      .toEqual(original.horses.map(h => [h.id, h.name, h.sex, h.genes, h.speed, h.stamina, h.temper, h.saddle, h.rug ?? null]));
    expect(s.horses.map(h => phen(h.genes))).toEqual(original.horses.map(h => phen(h.genes)));
    for (const k of ['saddles', 'rugs', 'trophies', 'unlocked']) if (original[k] !== undefined) expect(s[k], k).toEqual(original[k]);
    if (original.decor) expect(s.decor.map(d => d.type).sort()).toEqual(original.decor.map(d => d.type).sort());   // same decorations (one may have moved off the book stand)
    const preg = original.horses.find(h => h.preg);
    if (preg) expect(s.horses.find(h => h.id === preg.id).preg).toEqual(preg.preg);
  });

  it('has every field the current game needs', () => {
    expectCurrentShape(loadSave(original));
  });

  it('removed features give the player something back (stable hand → 500 coins, once)', () => {
    const s = loadSave(original);
    if (original.stableHand) expect(s.handRefund).toBe(true);
    S.setState(s); delete s.handRefund; save();
    expect(load().coins).toBe(s.coins);               // loading again does not pay again
  });

  it('migrating twice is the same as migrating once', () => {
    const once = loadSave(original);
    const twice = loadSave(clone(once));
    expect(twice).toEqual(once);
  });

  it('save → load after migrating changes nothing', () => {
    const s = loadSave(original);
    S.setState(s);
    save();
    expect(load()).toEqual(clone(s));
  });

  it('the game runs with it: ticks, every place, every popup, every horse sprite', () => {
    S.setState(loadSave(original));
    expect(() => tick()).not.toThrow();
    for (const map of ['barn', 'farm', 'paddock', 'village', 'market', 'heart']){
      S.state.player.map = map;
      expect(() => render(), map).not.toThrow();
    }
    const popups = [openBook, openBuild, openTable, () => horseModal(S.state.horses[0].id, 'stall'),
      ...[...TOP_STALLS, ...BOTTOM_STALLS].map(([id]) => () => openStall(id))];
    for (const open of popups){ expect(() => open()).not.toThrow(); closeAllPopups(); }
    for (const h of [...S.state.horses, ...S.state.market]) expect(() => horseCanvas(S.look(h))).not.toThrow();
  });

  it('the game is playable with it: walk the maps, feed, ride, live a full day', () => {
    S.setState(loadSave(original));
    const st = S.state;
    st.tab = 'stable'; st.intro = false;
    for (const map of ['barn', 'farm', 'paddock', 'village', 'market', 'heart']){ W.goTo(map); expect(st.player.map).toBe(map); W.interact(); closeAllPopups(); }
    W.goTo('barn');
    const h = st.horses.find(x => !S.isFoal(x) && !x.preg);   // pregnant mares can't be ridden
    st.inv.hay = Math.max(1, st.inv.hay); h.hunger = 10;
    ACT.feed(h.id, 'hay', document.createElement('button'));
    expect(h.hunger).toBeGreaterThan(10);
    // ride (training) with any adult horse
    h.saddle = st.saddles[0].id; h.hunger = 100; st.rideSel = h.id; st.rideMode = 'training';
    R.startRide(); expect(R.ride).not.toBeNull();
    R.ride.ready = 0; for (let i = 0; i < 60; i++) R.updateRide(1/60);
    R.endRide(true); closeAllPopups();
    // a whole day: morning → deadline → night → next morning
    for (const hour of [6.5, 11.9, 12.1, 18, 21.5]){ st.dayEpoch = Date.now() - (hour - 6) / 18 * DAY_MS; expect(() => dayRules(Date.now(), 1)).not.toThrow(); }
    st.dayEpoch -= DAY_MS; expect(() => dayRules(Date.now(), 1)).not.toThrow();
    expect(st.horses.every(x => !x.out)).toBe(true);
  });
});

describe('each piece an old save can be missing is filled in', () => {
  const base = FIXTURES[0].save;
  const cases = [
    ['decor',    s => delete s.decor,          s => expect(s.decor.length).toBeGreaterThan(0)],
    ['saddles',  s => delete s.saddles,        s => expect(s.saddles.length).toBeGreaterThan(0)],
    ['player',   s => delete s.player,         s => expect(s.player).toMatchObject({map: 'barn', leading: null})],
    ['player.map', s => delete s.player.map,   s => expect(s.player.map).toBe('barn')],
    ['player.leading', s => delete s.player.leading, s => expect(s.player.leading).toBeNull()],
    ['seed',     s => delete s.seed,           s => expect(s.seed).toBe('hay')],
    ['dayEpoch', s => delete s.dayEpoch,       s => expect(typeof s.dayEpoch).toBe('number')],
    ['weather',  s => delete s.weather,        s => expect(s.weather).toBe('sunny')],
    ['rugs',     s => delete s.rugs,           s => expect(s.rugs.length).toBe(2)],
    ['unlocked', s => delete s.unlocked,       s => expect(s.unlocked).toEqual({jumping: 0, race: 0})],
    ['trophies', s => delete s.trophies,       s => expect(s.trophies).toEqual([])],
    ['inv.potion', s => delete s.inv.potion,   s => expect(s.inv.potion).toBe(1)],
    ['bonds',    s => delete s.bonds,          s => expect(s.bonds).toEqual({})],
    ['farmhand', s => delete s.farmhand,       s => expect(s.farmhand).toEqual({hired: false})],
    ['decor on the book stand tile', s => s.decor.push({id: 77, type: 'cat', x: 15, y: 7}), s => expect(s.decor.find(d => d.id === 77)).toMatchObject({type: 'cat'})],
  ];
  it.each(cases)('%s', (_, remove, check) => {
    const old = clone(base);
    remove(old);
    const s = loadSave(old);
    check(s);
    expectCurrentShape(s);
  });
});

describe('saves the game must refuse (and start a new farm instead)', () => {
  it.each([
    ['broken JSON', '{"v":1,'],
    ['unknown version', JSON.stringify({v: 2})],
    ['not an object', '"hello"'],
    ['empty', ''],
  ])('%s', (_, raw) => {
    expect(loadSave(raw)).toBeNull();
  });
});
