import { describe, it, expect } from 'vitest';
import { pad, mapCanvas, horseCanvas } from '../js/sprites.js';
import { KID, OUTLINE, SPR, HORSE_FRAMES, PALETTE } from '../js/sprite-data.js';
import { SADDLES, RUG_COLORS } from '../js/data.js';
import { pixel } from './helpers.js';

const base = {color: 'Chestnut', face: 'none', socks: 0, seed: 1};

describe('pixel maps', () => {
  it('pad adds an empty border and evens out row lengths', () => {
    expect(pad(['ab', 'c'])).toEqual(['....', '.ab.', '.c..', '....']);
  });

  it('mapCanvas colors pixels and draws an outline around the shape', () => {
    const c = mapCanvas('test:dot', ['x'], {x: '#ff0000'});
    expect([c.width, c.height]).toEqual([3, 3]);
    expect(pixel(c, 1, 1)).toBe('#ff0000');
    expect(pixel(c, 1, 0)).toBe(OUTLINE);
    expect(pixel(c, 0, 0)).toBeNull();          // corners stay see-through
  });

  it('every horse sprite row has the same width', () => {
    for (const rows of [SPR.horse, SPR.foal, HORSE_FRAMES.b, HORSE_FRAMES.c])
      expect(new Set(rows.map(r => r.length)).size).toBe(1);
  });

  it('the farmer facing left is the mirror image of facing right', () => {
    expect(KID.left[0][3]).toBe([...KID.right[0][3]].reverse().join(''));
  });
});

describe('horse sprites', () => {
  it('adults are 32×24 pixels and foals 26×24', () => {
    const adult = horseCanvas(base), foal = horseCanvas({...base, foal: true});
    expect([adult.width, adult.height]).toEqual([32, 24]);
    expect([foal.width, foal.height]).toEqual([26, 24]);
  });

  it('the body is painted in the coat color', () => {
    expect(pixel(horseCanvas(base), 10, 12)).toBe(PALETTE.Chestnut.body);
    expect(pixel(horseCanvas({...base, color: 'Grulla'}), 10, 12)).toBe(PALETTE.Grulla.body);
  });

  it('a saddle shows on the back', () => {
    expect(pixel(horseCanvas({...base, saddle: 'brown'}), 10, 9)).toBe(SADDLES.brown.a);
  });

  it('rugs cover the body: a rain sheet is solid, a fly sheet is see-through mesh', () => {
    const rain = horseCanvas({...base, rug: {kind: 'rain', color: 'navy'}});
    expect(pixel(rain, 10, 12)).toBe(RUG_COLORS.rain.navy.main);
    const fly = horseCanvas({...base, rug: {kind: 'fly', color: 'white'}});
    const mesh = [pixel(fly, 10, 12), pixel(fly, 11, 12)];
    expect(mesh).toContain(RUG_COLORS.fly.white.main);
    expect(new Set(mesh).size).toBe(2);
  });

  it('pinto horses get white patches', () => {
    const plain = horseCanvas({...base, seed: 5}), pinto = horseCanvas({...base, seed: 5, pinto: true});
    let white = 0;
    for (let y = 9; y < 16; y++) for (let x = 5; x < 23; x++)
      if (pixel(pinto, x, y) === '#fbf8f0' && pixel(plain, x, y) !== '#fbf8f0') white++;
    expect(white).toBeGreaterThan(5);
  });

  it('the same look gives the very same canvas (cached)', () => {
    expect(horseCanvas({...base, seed: 9})).toBe(horseCanvas({...base, seed: 9}));
  });
});
