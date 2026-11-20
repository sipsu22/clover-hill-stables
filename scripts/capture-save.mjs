#!/usr/bin/env node
// Capture a REAL saved game from an older version of the game, for the save-migration tests.
//
//   mise exec -- node scripts/capture-save.mjs <git-ref> [name]
//   e.g. mise exec -- node scripts/capture-save.mjs f2fb7ba
//
// It checks out <git-ref> into a temporary folder, starts that version in a pretend browser
// (jsdom), plays a little (saddle, rugs, decorations, crops, breeding, a horse in the paddock...),
// and writes the browser save to tests/fixtures/saves/<name>.json.
//
// Works for the old single-file versions (inline <script>) and the ES-module versions (js/main.js).
// If modules get renamed in the future, update loadModuleGame() below.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [ref, nameArg] = process.argv.slice(2);
if (!ref){ console.error('usage: node scripts/capture-save.mjs <git-ref> [name]'); process.exit(1); }
const sha = execSync(`git rev-parse --short ${ref}`, {cwd: ROOT}).toString().trim();
const outDir = path.join(ROOT, 'tests/fixtures/saves');
fs.mkdirSync(outDir, {recursive: true});
const count = fs.readdirSync(outDir).filter(f => f.endsWith('.json')).length;
const name = nameArg || `${String(count + 1).padStart(2, '0')}-${sha}`;

// the same little play session for every version; steps a version doesn't support are skipped
function play(g){
  const log = [];
  const step = (label, fn) => { try { fn(); log.push('✓ ' + label); } catch (e) { log.push('· ' + label + ' (' + e.message + ')'); } };
  const { ACT, state } = g;
  if (state.intro) step('close welcome', () => ACT.start());
  state.coins = 3000;
  step('buy red saddle', () => ACT.buySaddle(0, 'red'));
  step('saddle Sunny', () => ACT.equip(2, 'red'));
  step('buy fleece rug', () => ACT.buyRug(0, 'fleece:pink'));
  step('fly sheet on Daisy', () => ACT.rug(1, 'fly:white'));
  step('buy barn cat', () => ACT.buyItem(0, 'cat'));
  step('buy feed bundle', () => ACT.buyBundle(0, 'feed'));
  step('DNA test Sunny', () => ACT.dna(2));
  step('plant crops', () => { state.plots[0] = {crop: 'carrot', at: Date.now() - 5000}; state.plots[1] = {crop: 'hay', at: Date.now() - 999999}; });
  step('breed Daisy × Sunny', () => { for (const h of state.horses){ h.happy = 90; h.hunger = 90; } state.sel = {F: 1, M: 2}; ACT.breed(); });
  step('Daisy in the paddock', () => { g.byId(1).out = true; });
  step('hire stable hand', () => { if (typeof ACT.buyHand !== 'function') throw new Error('not in this version'); ACT.buyHand(); });
  step('win a trophy', () => { if (!state.trophies) throw new Error('not in this version'); state.trophies.push({mode: 'jumping', lvl: 0, place: 1, horse: 'Sunny', day: 1}); state.unlocked.jumping = 1; });
  step('walk to the paddock', () => g.goTo('paddock', 6, 5, 'right'));
  step('tick', () => g.tick());
  step('save', () => g.save());
  return {log, save: g.localStorage.getItem(g.SAVE_KEY)};
}

async function loadInlineGame(dir){
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const vc = new VirtualConsole(); vc.on('jsdomError', e => console.error('page error:', e.message));
  const dom = new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc});
  const w = dom.window;
  const g = w.eval('({ACT, state, byId, goTo: typeof goTo === "function" ? goTo : undefined, tick, save, SAVE_KEY})');
  return {g: {...g, localStorage: w.localStorage}, close: () => w.close()};
}

async function loadModuleGame(dir){
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/<script[^>]*src="js\/main.js"[^>]*><\/script>/, '');
  const dom = new JSDOM(html, {pretendToBeVisual: true, url: 'http://localhost/'});
  const w = dom.window;
  // make the pretend browser global, like in a real page
  for (const k of ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'Event', 'getComputedStyle', 'performance'])
    if (!(k in globalThis) || k === 'window' || k === 'document' || k === 'localStorage') globalThis[k] = k === 'window' ? w : w[k];
  globalThis.innerWidth = 1024; globalThis.innerHeight = 800;
  globalThis.addEventListener = w.addEventListener.bind(w);
  globalThis.requestAnimationFrame = () => 0;
  const js = f => pathToFileURL(path.join(dir, 'js', f)).href;
  await import(js('main.js'));
  const [S, A, W, G, D] = await Promise.all(['state.js', 'actions.js', 'world.js', 'game.js', 'data.js'].map(f => import(js(f))));
  return {g: {ACT: A.ACT, state: S.state, byId: S.byId, goTo: W.goTo, tick: G.tick, save: G.save, SAVE_KEY: D.SAVE_KEY, localStorage: w.localStorage}, close: () => w.close()};
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clover-save-'));
try {
  execSync(`git archive ${sha} | tar -x -C "${tmp}"`, {cwd: ROOT});
  const isModule = fs.existsSync(path.join(tmp, 'js', 'main.js'));
  const {g, close} = isModule ? await loadModuleGame(tmp) : await loadInlineGame(tmp);
  const {log, save} = play(g);
  close();
  if (!save) throw new Error('the game did not save anything');
  const file = path.join(outDir, name + '.json');
  fs.writeFileSync(file, JSON.stringify({_captured: {from: sha, at: new Date().toISOString(), steps: log}, save: JSON.parse(save)}, null, 2) + '\n');
  console.log(log.join('\n'));
  console.log(`\nsaved ${path.relative(ROOT, file)} (${isModule ? 'module' : 'single-file'} version ${sha})`);
} finally {
  fs.rmSync(tmp, {recursive: true, force: true});
}
process.exit(0);
