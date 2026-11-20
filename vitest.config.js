import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',          // a pretend browser, so the game's DOM code runs in Node
    setupFiles: ['tests/setup.js'],
    include: ['tests/**/*.test.js'],
  },
});
