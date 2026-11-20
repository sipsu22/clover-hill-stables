# Clover Hill Stables — notes for agents

A pixel-art horse farm and breeding game for the browser (kid-friendly). Plain HTML/CSS and
JavaScript **ES modules** with no build step, published on GitHub Pages:
**https://sipsu22.github.io/clover-hill-stables/** (repo `sipsu22/clover-hill-stables`).

## Tools

- Node is managed with **mise** (`mise.toml` pins Node 22). Prefix commands with `mise exec --`
  (or activate mise in your shell). Do not use a system Node.
- `mise exec -- npm ci` installs the dev tools (Vite, Vitest, jsdom, canvas).
- `mise exec -- npm run dev` starts the dev server on http://localhost:5173
  (also available as the `game` entry in `.claude/launch.json` for the browser preview).
  ES modules do **not** work from `file://` — always use the dev server to run the game.
- `mise exec -- npm test` runs all unit tests once (including the save-migration tests); `npm run test:watch` re-runs on save.
- `mise exec -- npm run capture-save -- <git-ref>` captures a real save from an older version (see below).

## Code layout

```
index.html        page skeleton only; loads css/style.css and js/main.js
css/style.css     all styles (phone layout lives in the @media (max-width:600px) block)
js/
  main.js         starts the game (boot only)
  sprite-data.js  every pixel-art sprite as rows of characters + coat palettes
  sprites.js      turns pixel maps into canvases (horses with coats/patterns/rugs/saddles, items, crops)
  util.js         small pure helpers (clamp, fmt, colors, seeded random)
  genetics.js     coat-color genetics: phenotype, inheritance, foal odds
  data.js         game data and rules tables: crops, shop, saddles, rugs, weather, bundles, day clock
  state.js        the saved game `state`, horse rules (value, mood, readiness, hunger/happiness decay)
  affinity.js     friendships between horses (bonds), nature match, love-potion success chance
  game.js         tick(), day/night + paddock rules (dayRules), save()/load() with save migrations
  ui.js           toasts, popups (showModal(html, after, refresh) / refreshModal / closeModal), HTML helpers
  shop.js         Market Hall stalls: daily rotating stock, daily prices (priceOf), stall popups
  views.js        top bar, the world view (or the ride), horse cards, Horse Book + build popups, render()
  actions.js      ACT: everything a button can do (data-act="…"), click/keyboard dispatch
  world.js        the walkable world: barn / farm / paddock rules, PLACES registry, pathfinding, doors, leading horses
  village.js      place: the village (Market Hall door, Heart Barn door, riding arena gate)
  market-map.js   place: inside the Market Hall (stalls you walk up to)
  breeding.js     place: the Heart Barn (pens, love table, potion ceremony with curtain + big heart)
  world-draw.js   drawing the barn, farm, paddock, weather and sky (places draw themselves)
  controls.js     day banner, animation loop, keyboard + touch controls (per-finger tracking)
  riding.js       riding: arena-gate menu + modes (training, forest trail, show jumping, cross-country race)
tests/            Vitest unit tests (*.test.js), setup.js (fake page), helpers.js
tests/fixtures/saves/  real saved games from every released version (save-migration tests)
scripts/capture-save.mjs  plays an old version in jsdom and captures its save as a fixture
```

### Module rules
- Every file is an ES module with explicit `import`/`export`. Keep files focused; add a new module
  rather than growing a big one.
- **Never assign to a variable exported by another module** (ES modules forbid it). The owning
  module exposes a setter instead, e.g. `setState()`, `setOpenHorse()`, `clearRide()`, `setSprint()`.
- Keep top-level code free of work that depends on other modules being initialised; put such setup
  in an init function called from `main.js` (see `initControls()`).
- Buttons use `data-act="name"` + `data-id`/`data-arg`, handled by `ACT.name(id, arg, el)` in `actions.js`.
- **New places** (a new map you can walk into) get their own module exporting
  `walk(x, y)`, `door(nx, ny)`, `interact(fx, fy, led)`, `hint(fx, fy, led)`, `click(tx, ty)` and `draw(g, time)`,
  and are added to `PLACES` in `world.js` (see `village.js`, `market-map.js`, `breeding.js`).
- Popups that should update after a purchase or a change pass a `refresh` function to `showModal`;
  `render()` calls `refreshModal()`.
- All graphics are **pixel maps written directly in code** (strings of characters → colors), not image files.
- Never use `confirm()`, `alert()` or `prompt()` — the in-app preview blocks them. Use in-game popups (`showModal`).
- Saved games live in `localStorage` under `SAVE_KEY`. Any change to saved data follows the
  "Saved games must survive every update" checklist below.

## Unit tests (required)

- We use **Vitest** with **jsdom** (fake browser) and the **canvas** package (real pixels in sprite tests).
- **Every change to game logic comes with tests**: add or update tests in `tests/` alongside the
  change. Bug fixes get a regression test that fails without the fix.
- Run `mise exec -- npm test` before every commit; all tests must pass, including every save fixture.
- Helpers in `tests/helpers.js`: `freshGame()` (new game, popups closed), `genes({E:1, Cr:2})`,
  `withRandom([...], fn)`, `setHour(h, day)`, `pointer(type, id)` (touch events), `pixel(canvas, x, y)`.
- `tests/setup.js` builds the page elements and disables the animation loop, so nothing moves on its own.
- Tests must be independent: start from `freshGame()` in `beforeEach`.

## Saved games must survive every update (very important)

Players keep their farm in their browser (`localStorage`, key `SAVE_KEY`). **An update must never
lose or break a player's save.** The save-migration tests guard this and must be kept thorough.

- `tests/fixtures/saves/*.json` are **real saves captured from every released version**
  (each file records the commit it came from). Never edit or delete them; only add new ones.
- `tests/save-migration.test.js` loads every fixture with the current game and checks that:
  it loads; nothing the player earned is lost (horses + genes + stats, coins, food, crops, decorations,
  saddles, rugs, trophies, Horse Book); the result has every field the current game needs
  (`expectCurrentShape`); migrating twice equals migrating once; save → load changes nothing; the game
  runs and is playable with it (every tab, all maps, feeding, a ride, a full day/night); removed
  features are cleaned up and compensated (e.g. the stable hand → 500 coins, paid once).
  It also removes each optional field one at a time to check `load()` fills it in, and checks that
  broken saves are refused.
- These tests run in every `npm test` and in CI, so **migrations are tested on every change**.

**Whenever a change touches what is saved** (new field, renamed/removed field, new feature with state,
removed feature):
1. **Before changing anything**, capture a save from the version that is live now:
   `mise exec -- npm run capture-save -- <commit of the current live version>`
   (find it with `git log origin/main -1 --format=%h`). This plays that version in jsdom and writes
   the next `tests/fixtures/saves/NN-<sha>.json`.
2. Add the migration in `load()` (js/game.js): give old saves a sensible default, convert renamed
   fields, and clean up removed features (compensating the player if they paid for it).
3. Extend `expectCurrentShape()` with the new field, add the field to the "each piece an old save
   can be missing" list, and add a specific test for any conversion.
4. Run `npm test`; every fixture must pass. Never "fix" a failing migration test by changing the fixture.

Prefer additive changes (new fields with defaults) over renaming or removing saved fields. Keep
`v: 1` unless a change cannot be migrated in place; if you bump it, `load()` must still accept the old version.
If `scripts/capture-save.mjs` stops working because modules were renamed, update its `loadModuleGame()`.

## Game design rules from the player (keep these!)

- **No tab bar / menu buttons. Everything is a place you walk to** (the player wants the game to feel
  exploratory and adventurous): the Market Hall and Heart Barn in the village, the riding arena gate,
  the Horse Book on a stand in the barn, building stalls at a locked stall, selling crops at the market's
  produce stand. Add new features as places or things in the world, not as new buttons or tabs.
- **Breeding** happens in the Heart Barn: lead a mare and a stallion into the two pens, then use a
  **love potion** (bought at the market's apothecary) at the love table. A curtain closes, hearts float,
  a big heart grows, and success depends on how much the horses like each other (`affinity.js`:
  time together in the paddock or pens, being stall neighbors, matching temper / different genes).
- **The market** stock rotates every game day and prices drift slightly (85%–120%); horses at the dealer
  are new every morning. A bought horse follows you home on foot (it is not teleported into the barn).
- **Riding** starts at the arena gate in the village with the horse you led there.

- **Horses never teleport to the paddock.** Every morning the player must walk each horse from its
  stall, out of the barn, past the fields, to the paddock. Leading can only start at the horse's own
  stall, next to it in the paddock, or at its Heart Barn pen. A horse bought at the market follows you
  home. No auto turn-out helpers. The only automatic move
  allowed is horses walking back to their stalls at 21:00. (Covered by tests in `tests/world.test.js`
  and `tests/game.test.js`.)
- Mornings must not feel stressful: the paddock deadline is 12:00, about 4 real minutes after sunrise.
- Mobile matters: check changes at iPhone size (375×812) — big thumb controls, no layout jumps,
  no text selection on long press.

## Committing, pushing and deploying

- Commit or push only when the user asks. Remote is HTTPS (`gh auth setup-git`); SSH push does not work here.
- `.github/workflows/pages.yml` runs the tests on every push/PR. On `main`, if the tests pass,
  it publishes `index.html`, `css/` and `js/` to GitHub Pages. If the tests fail, nothing is published.
- **After every push, watch the workflow until it is green** so the user is never surprised that
  their update did not go live:
  ```
  gh run list --branch main --limit 1          # find the run for your commit
  gh run watch <run-id> --exit-status           # wait for it; non-zero exit = failed
  ```
  Then confirm the live site serves the new code (e.g. `curl -s https://sipsu22.github.io/clover-hill-stables/js/<file>.js | grep <something new>`).
  If the run fails, read the log (`gh run view <run-id> --log-failed`), fix it, and tell the user
  plainly that the update is **not** live yet.
