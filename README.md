# 🍀 Clover Hill Stables

A pixel-art horse farm game: grow crops, care for horses, breed foals with real coat-color
genetics, lead your horses to the paddock every morning, dress them for the weather, and compete
in show jumping and cross-country races.

**Play:** https://sipsu22.github.io/clover-hill-stables/

## Develop

```bash
mise install            # Node 22 (see mise.toml)
mise exec -- npm ci     # dev tools
mise exec -- npm run dev    # http://localhost:5173
mise exec -- npm test       # unit tests
```

Pushing to `main` runs the tests on GitHub Actions and, if they pass, publishes the game to
GitHub Pages. See [AGENTS.md](AGENTS.md) for the code layout and project rules.
