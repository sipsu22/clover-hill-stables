import { describe, it, expect, beforeEach } from 'vitest';
import * as D from '../js/data.js';
import * as S from '../js/state.js';
import { freshGame, setHour, withRandom } from './helpers.js';

let st;
beforeEach(() => { st = freshGame(); });

describe('bundles', () => {
  it('every bundle is cheaper than buying its contents one by one', () => {
    for (const b of D.BUNDLES) expect(D.bundlePrice(b), b.name).toBeLessThan(D.bundleWorth(b));
  });

  it('the barn bundle is 25% off and follows the stall price', () => {
    const barn = D.BUNDLES.find(b => b.id === 'barn');
    const before = D.bundlePrice(barn);
    expect(before).toBe(Math.round(D.bundleWorth(barn) * .75 / 5) * 5);
    st.cap = 8;
    expect(D.bundlePrice(barn)).toBeGreaterThan(before);
  });
});

describe('weather and rugs', () => {
  it('each weather needs its own rug', () => {
    expect(D.WEATHER.sunny.needs).toBe('fly');
    expect(D.WEATHER.rain.needs).toBe('rain');
    expect(D.WEATHER.snow.needs).toBe('fleece');
  });

  it('rugOK checks the rug a horse is wearing against today’s weather', () => {
    const daisy = S.byId(1);
    expect(D.rugOK(daisy)).toBe(false);          // no rug
    daisy.rug = 1;                               // white fly sheet
    st.weather = 'sunny'; expect(D.rugOK(daisy)).toBe(true);
    st.weather = 'rain';  expect(D.rugOK(daisy)).toBe(false);
    daisy.rug = 2;                               // navy rain sheet
    expect(D.rugOK(daisy)).toBe(true);
    expect(D.rugOf(daisy)).toEqual({kind: 'rain', color: 'navy'});
  });

  it('weather is mostly sunny, sometimes rainy, sometimes snowy', () => {
    expect(withRandom([.1], D.rollWeather)).toBe('sunny');
    expect(withRandom([.5], D.rollWeather)).toBe('rain');
    expect(withRandom([.9], D.rollWeather)).toBe('snow');
  });
});

describe('the game clock', () => {
  it('a day runs from 6:00 to midnight', () => {
    setHour(6);  expect(D.clock().hour).toBeCloseTo(6, 1);
    setHour(15); expect(D.clock().hour).toBeCloseTo(15, 1);
    expect(D.clock().day).toBe(1);
  });

  it('the next day starts after one full day', () => {
    setHour(7, 1);
    expect(D.clock()).toMatchObject({idx: 1, day: 2});
  });

  it('clockText shows quarter hours', () => {
    expect(D.clockText(12.5)).toBe('12:30');
    expect(D.clockText(6.9)).toBe('06:45');
  });

  it('it is daytime until 21:00', () => {
    setHour(20.5); expect(D.isDaytime()).toBe(true);
    setHour(21.5); expect(D.isDaytime()).toBe(false);
  });
});
