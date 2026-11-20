import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../js/state.js';
import * as R from '../js/riding.js';
import { clock } from '../js/data.js';
import { freshGame } from './helpers.js';

let st, sunny;
beforeEach(() => {
  st = freshGame();
  R.clearRide();
  sunny = S.byId(2);
  sunny.saddle = 0;                 // the brown saddle
  st.rideSel = sunny.id;
  st.coins = 1000;
});
const start = (mode, lvl = 0) => { st.rideMode = mode; st.rideLevel = lvl; R.startRide(); R.ride.ready = 0; return R.ride; };
const step = (n = 1, dt = 1/60) => { for (let i = 0; i < n && R.ride; i++) R.updateRide(dt); };

describe('who can ride', () => {
  it('needs a grown-up, fed horse with a saddle', () => {
    expect(R.canRide(null)).toBe('Pick a horse');
    sunny.saddle = null;            expect(R.canRide(sunny)).toBe('Needs a saddle');
    sunny.saddle = 0;               expect(R.canRide(sunny)).toBeNull();
    sunny.hunger = 10;              expect(R.canRide(sunny)).toBe('Too hungry');
    sunny.adultAt = Date.now() + 1e5; expect(R.canRide(sunny)).toBe('Too young to ride');
  });

  it('competitions: one per horse per day, entry fee, and locked levels', () => {
    st.rideMode = 'jumping';
    st.rideLevel = 1;                         expect(R.canRide(sunny)).toBe('Level locked');
    st.rideLevel = 0; st.coins = 5;           expect(R.canRide(sunny)).toMatch(/Entry fee/);
    st.coins = 1000; sunny.compDay = clock().idx; expect(R.canRide(sunny)).toBe('Already competed today');
  });

  it('rates a horse by the average of its stats', () => {
    expect(R.horseRating({speed: 30, stamina: 40, temper: 51})).toBe(40);
    expect(R.chanceLabel({speed: 90, stamina: 90, temper: 90}, 0)[0]).toMatch(/Great chance/);
    expect(R.chanceLabel({speed: 10, stamina: 10, temper: 10}, 3)[0]).toMatch(/Very hard/);
  });

  it('ordinal numbers', () => {
    expect([1, 2, 3, 4].map(R.ordinal)).toEqual(['1st', '2nd', '3rd', '4th']);
  });
});

describe('courses', () => {
  it('show jumping has 12 fences, a finish line, a time limit and 5 rivals; the fee is paid', () => {
    const r = start('jumping');
    expect(r.obstacles).toHaveLength(12);
    expect(r.finishWX).toBeGreaterThan(Math.max(...r.obstacles.map(o => o.wx)));
    expect(r.timeAllowed).toBeGreaterThan(0);
    expect(r.rivals).toHaveLength(5);
    for (const rv of r.rivals) expect(rv.faults).toBeGreaterThanOrEqual(0);
    expect(st.coins).toBe(1000 - 20);
    expect(sunny.compDay).toBe(clock().idx);
  });

  it('the race is 500 m against 5 rivals, and stamina gives more sprint energy', () => {
    const r = start('race');
    expect(r.finishWX).toBe(500 * R.PX_M);
    expect(r.rivals).toHaveLength(5);
    expect(r.maxEnergy).toBeCloseTo(40 + sunny.stamina * .9);
  });

  it('the forest trail has only logs, streams and branches', () => {
    const r = start('trail');
    expect(new Set(r.obstacles.map(o => o.type))).toEqual(new Set(['log', 'stream', 'branch']));
    expect(r.finishWX).toBe(520 * R.PX_M);
  });
});

describe('jumping and hitting things', () => {
  it('riding into a show jumping fence gives 4 faults', () => {
    const r = start('jumping');
    r.obstacles = []; R.addObstacle(r, 'fence', R.RIDE_X + 30);
    step(60);
    expect(r.faults).toBe(4);
  });

  it('jumping clears the fence', () => {
    const r = start('jumping');
    r.obstacles = []; R.addObstacle(r, 'fence', R.RIDE_X + 40);
    R.rideJump();
    step(60);
    expect(r.faults).toBe(0);
    expect(r.cleared).toBe(1);
  });

  it('low branches only hurt if you jump into them', () => {
    const r = start('trail');
    r.obstacles = []; R.addObstacle(r, 'branch', R.RIDE_X + 10);
    R.updateRide(0.001);
    expect(r.spooks).toBe(0);                 // riding underneath is fine
    r.obstacles[0].hit = false; r.y = -20; r.vy = 0;
    R.updateRide(0.001);
    expect(r.spooks).toBe(1);                 // jumping into it is not
  });

  it('a hoof at the very edge of a stream does not count, but a log does', () => {
    const r = start('trail');
    r.obstacles = []; R.addObstacle(r, 'stream', 34);
    R.updateRide(0.001);
    expect(r.spooks).toBe(0);
    r.obstacles = []; R.addObstacle(r, 'log', 34);
    R.updateRide(0.001);
    expect(r.spooks).toBe(1);
  });

  it('a tired horse with low stamina jumps lower late in a course', () => {
    const r = start('jumping');
    r.h = {...sunny, stamina: 10};
    r.scroll = 0;                       expect(R.currentJumpV(r)).toBe(r.jumpV);
    r.scroll = r.finishWX;              expect(R.currentJumpV(r)).toBeLessThan(r.jumpV);
  });
});

describe('results and prizes', () => {
  it('winning a Beginner show jumping pays 100, gives a trophy and unlocks Novice', () => {
    const r = start('jumping');
    r.rivals.forEach(rv => rv.faults = 99);
    r.t = 1; r.faults = 0;
    const coins = st.coins;
    R.endRide();
    expect(st.coins).toBe(coins + 100);
    expect(st.trophies).toEqual([expect.objectContaining({mode: 'jumping', lvl: 0, place: 1, horse: 'Sunny'})]);
    expect(st.unlocked.jumping).toBe(1);
    expect(R.ride).toBeNull();
  });

  it('giving up means last place and no prize', () => {
    start('race');
    const coins = st.coins;
    R.endRide(true);
    expect(st.coins).toBe(coins);
    expect(st.trophies).toHaveLength(0);
  });

  it('training improves the chosen stat by 1 per 100 m (up to 5)', () => {
    st.trainFocus = 'temper';
    const r = start('training');
    const before = sunny.temper;
    r.scroll = 250 * R.PX_M;
    R.endRide(true);
    expect(sunny.temper).toBe(before + 2);
  });

  it('a finished trail ride makes the horse much happier', () => {
    const r = start('trail');
    sunny.happy = 40; r.spooks = 0;
    R.endRide();
    expect(sunny.happy).toBe(75);
  });
});
