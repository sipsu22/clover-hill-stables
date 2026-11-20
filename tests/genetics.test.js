import { describe, it, expect } from 'vitest';
import { phen, fullName, inherit, odds, GENES } from '../js/genetics.js';
import { BOOK } from '../js/data.js';
import { genes } from './helpers.js';

const color = copies => phen(genes(copies)).color;
// add up the chance of every foal whose name starts with `prefix` (e.g. 'Bay' includes 'Bay Pinto')
const chance = (rows, test) => rows.filter(([name]) => test(name)).reduce((s, [, o]) => s + o.p, 0);

describe('coat colors (phenotype)', () => {
  it('base colors come from the E (black) and A (bay) genes', () => {
    expect(color({})).toBe('Chestnut');
    expect(color({E: 1})).toBe('Black');
    expect(color({E: 2, A: 1})).toBe('Bay');
    expect(color({A: 2})).toBe('Chestnut');        // agouti does nothing on a red horse
  });

  it('one cream gene makes palomino / buckskin / smoky black', () => {
    expect(color({Cr: 1})).toBe('Palomino');
    expect(color({E: 1, A: 1, Cr: 1})).toBe('Buckskin');
    expect(color({E: 1, Cr: 1})).toBe('Smoky Black');
  });

  it('two cream genes make the blue-eyed double dilutes', () => {
    expect(color({Cr: 2})).toBe('Cremello');
    expect(color({E: 1, A: 1, Cr: 2})).toBe('Perlino');
    expect(color({E: 1, Cr: 2})).toBe('Smoky Cream');
  });

  it('dun lightens the body, also together with one cream gene', () => {
    expect(color({D: 1})).toBe('Red Dun');
    expect(color({E: 1, A: 1, D: 1})).toBe('Bay Dun');
    expect(color({E: 1, D: 1})).toBe('Grulla');
    expect(color({D: 1, Cr: 1})).toBe('Dunalino');
    expect(color({E: 1, A: 1, D: 1, Cr: 1})).toBe('Dunskin');
    expect(color({E: 1, D: 1, Cr: 1})).toBe('Smoky Grulla');
    expect(color({D: 1, Cr: 2})).toBe('Cremello');  // double cream hides dun
  });

  it('gray covers every other color', () => {
    expect(color({G: 1, E: 1, A: 1, Cr: 1, D: 1})).toBe('Gray');
  });

  it('pinto and appaloosa are patterns on top of the color', () => {
    const p = phen(genes({E: 1, A: 1, TO: 1, LP: 2}));
    expect(p).toEqual({color: 'Bay', pinto: true, appy: true});
    expect(fullName(p)).toBe('Bay Pinto Appaloosa');
    expect(fullName(phen(genes({})))).toBe('Chestnut');
  });

  it('every color in the Horse Book can actually be bred', () => {
    const seen = new Set();
    const n = GENES.length;
    for (let i = 0; i < 3 ** n; i++){
      const copies = {}; let k = i;
      for (const g of GENES){ copies[g] = k % 3; k = Math.floor(k / 3); }
      const p = phen(genes(copies));
      seen.add(p.color); if (p.pinto) seen.add('Pinto'); if (p.appy) seen.add('Appaloosa');
    }
    for (const [name] of BOOK) expect(seen, name).toContain(name);
    expect(seen.size).toBe(BOOK.length);
  });
});

describe('inheritance', () => {
  it('a foal gets one copy of every gene from each parent', () => {
    const mare = {genes: genes({E: 1, Cr: 1, TO: 1})};
    const stallion = {genes: genes({E: 2, A: 1, D: 1})};
    for (let i = 0; i < 200; i++){
      const foal = inherit(mare, stallion);
      for (const g of GENES){
        expect(mare.genes[g]).toContain(foal[g][0]);
        expect(stallion.genes[g]).toContain(foal[g][1]);
      }
    }
  });

  it('two chestnuts can only have chestnut foals', () => {
    const a = {genes: genes({})}, b = {genes: genes({A: 2})};
    for (let i = 0; i < 50; i++) expect(phen(inherit(a, b)).color).toBe('Chestnut');
  });
});

describe('foal odds', () => {
  // the two starting horses: Daisy (bay pinto, E/e A/a TO/n) and Sunny (palomino, e/e A/a Cr/n)
  const daisy = {genes: genes({E: 1, A: 1, TO: 1})};
  const sunny = {genes: genes({A: 1, Cr: 1})};
  const rows = odds(daisy, sunny);

  it('all the chances add up to 100%', () => {
    expect(chance(rows, () => true)).toBeCloseTo(1, 10);
  });

  it('matches the Mendel math for Daisy × Sunny', () => {
    const is = c => name => name === c || name === c + ' Pinto';
    expect(chance(rows, is('Chestnut'))).toBeCloseTo(1/4);
    expect(chance(rows, is('Palomino'))).toBeCloseTo(1/4);
    expect(chance(rows, is('Bay'))).toBeCloseTo(3/16);
    expect(chance(rows, is('Buckskin'))).toBeCloseTo(3/16);
    expect(chance(rows, is('Black'))).toBeCloseTo(1/16);
    expect(chance(rows, is('Smoky Black'))).toBeCloseTo(1/16);
    expect(chance(rows, n => n.endsWith('Pinto'))).toBeCloseTo(1/2);
  });

  it('is sorted from most to least likely', () => {
    const ps = rows.map(([, o]) => o.p);
    expect([...ps].sort((a, b) => b - a)).toEqual(ps);
  });

  it('a gray parent with one gray gene gives a 50% chance of gray', () => {
    const r = odds({genes: genes({G: 1})}, {genes: genes({E: 1})});
    expect(chance(r, n => n.startsWith('Gray'))).toBeCloseTo(1/2);
  });
});
