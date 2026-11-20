import { describe, it, expect } from 'vitest';
import { clamp, round5, fmt, shade, mixHex, esc, mulberry, randi } from '../js/util.js';
import { withRandom } from './helpers.js';

describe('util', () => {
  it('clamp keeps numbers inside a range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('round5 rounds prices to the nearest 5, never below 5', () => {
    expect(round5(12)).toBe(10);
    expect(round5(13)).toBe(15);
    expect(round5(1)).toBe(5);
  });

  it('fmt shows seconds, or minutes:seconds, rounding up', () => {
    expect(fmt(5)).toBe('5s');
    expect(fmt(4.2)).toBe('5s');
    expect(fmt(65)).toBe('1:05');
    expect(fmt(0)).toBe('0s');
    expect(fmt(-3)).toBe('0s');
  });

  it('shade darkens and lightens colors', () => {
    expect(shade('#808080', -0.5)).toBe('#404040');
    expect(shade('#000000', 1)).toBe('#ffffff');
  });

  it('mixHex averages two colors', () => {
    expect(mixHex('#000000', '#ffffff')).toBe('#808080');
    expect(mixHex('#ff0000', '#0000ff')).toBe('#800080');
  });

  it('esc makes text safe to put in HTML', () => {
    expect(esc(`<b>"Tom & 'Jerry'"</b>`)).toBe('&lt;b&gt;&quot;Tom &amp; &#39;Jerry&#39;&quot;&lt;/b&gt;');
  });

  it('mulberry gives the same numbers for the same seed', () => {
    const a = mulberry(123), b = mulberry(123), c = mulberry(124);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect(c()).not.toBe(seqA[0]);
    for (const v of seqA){ expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });

  it('randi includes both ends', () => {
    expect(withRandom([0], () => randi(3, 7))).toBe(3);
    expect(withRandom([0.9999], () => randi(3, 7))).toBe(7);
  });
});
