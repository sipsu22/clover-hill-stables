// The published site must never mix cached old files with new ones after an update.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSite } from '../scripts/build-site.mjs';

describe('building the site for GitHub Pages', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  buildSite('abc1234', out);
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');

  it('index.html loads the game from a folder named after the version', () => {
    expect(html).toContain('src="v/abc1234/js/main.js"');
    expect(html).toContain('href="v/abc1234/css/style.css"');
    expect(html).not.toMatch(/src="js\/main\.js"/);
  });

  it('that folder has every game file', () => {
    for (const f of fs.readdirSync('js')) expect(fs.existsSync(path.join(out, 'v/abc1234/js', f)), f).toBe(true);
    expect(fs.existsSync(path.join(out, 'v/abc1234/css/style.css'))).toBe(true);
  });

  it('every module imports its neighbours with relative paths, so they stay in the version folder', () => {
    for (const f of fs.readdirSync('js')){
      const src = fs.readFileSync(path.join('js', f), 'utf8');
      for (const m of src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) expect(m[1], `js/${f}`).toMatch(/^\.\//);
    }
  });

  it('tests and tools are not published', () => {
    expect(fs.existsSync(path.join(out, 'tests'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'scripts'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'node_modules'))).toBe(false);
  });

  it('refuses a strange version name', () => {
    expect(() => buildSite('../oops', path.join(out, 'x'))).toThrow();
  });
});
