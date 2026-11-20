import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import { render } from '../js/views.js';
import { heldDir, padPointers, releaseAllInput, dayBanner } from '../js/controls.js';
import { held } from '../js/world.js';
import { freshGame, pointer, setHour } from './helpers.js';

const btn = dir => document.querySelector(`[data-dir=${dir}]`);
beforeEach(() => {
  freshGame();
  S.state.tab = 'stable';
  render();
  releaseAllInput();
});

describe('on-screen arrows (touch)', () => {
  it('holding an arrow walks that way; letting go stops', () => {
    btn('right').dispatchEvent(pointer('pointerdown', 1));
    expect(heldDir()).toBe('right');
    document.dispatchEvent(pointer('pointerup', 1));
    expect(heldDir()).toBeUndefined();
  });

  it('regression: pressing ← before → is lifted never leaves → stuck', () => {
    btn('right').dispatchEvent(pointer('pointerdown', 7));
    btn('left').dispatchEvent(pointer('pointerdown', 8));
    expect(heldDir()).toBe('left');
    document.dispatchEvent(pointer('pointerup', 7));   // the first finger lifts last... or first
    expect(heldDir()).toBe('left');
    document.dispatchEvent(pointer('pointerup', 8));
    expect(heldDir()).toBeUndefined();
    expect(padPointers.size).toBe(0);
  });

  it('regression: the screen redrawing while you hold an arrow does not lose the release', () => {
    btn('up').dispatchEvent(pointer('pointerdown', 3));
    render();                                          // buttons are replaced
    document.dispatchEvent(pointer('pointerup', 3));
    expect(heldDir()).toBeUndefined();
  });

  it('sliding your thumb onto another arrow changes direction', () => {
    btn('right').dispatchEvent(pointer('pointerdown', 4));
    const original = document.elementFromPoint;
    document.elementFromPoint = () => btn('down');
    document.dispatchEvent(pointer('pointermove', 4));
    document.elementFromPoint = original;
    expect(heldDir()).toBe('down');
  });

  it('keyboard and touch never get mixed up', () => {
    held.push('left');
    expect(heldDir()).toBe('left');
    btn('up').dispatchEvent(pointer('pointerdown', 5));
    expect(heldDir()).toBe('up');
    document.dispatchEvent(pointer('pointerup', 5));
    expect(heldDir()).toBe('left');
    releaseAllInput();
    expect(heldDir()).toBeUndefined();
  });
});

describe('the day banner', () => {
  it('uses short text on phones and long text on computers', () => {
    setHour(7);
    window.innerWidth = 1024;
    const long = dayBanner();
    window.innerWidth = 375;
    const short = dayBanner();
    window.innerWidth = 1024;
    expect(long.kind).toBe('morning');
    expect(short.text.length).toBeLessThan(long.text.length);
    expect(short.text).toContain('12:00');
  });

  it('warns about horses still inside after the deadline', () => {
    setHour(14);
    expect(dayBanner()).toMatchObject({kind: 'sad'});
    expect(dayBanner().text).toMatch(/stuck inside/);
  });
});
