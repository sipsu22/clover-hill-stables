#!/usr/bin/env node
// Builds the folder that GitHub Pages publishes.
//
//   node scripts/build-site.mjs [version] [outDir]      (defaults: current git commit, _site)
//
// Why: browsers keep files for a while (GitHub Pages allows 10 minutes). After an update, a player
// could get the NEW index.html with OLD cached JavaScript files, and the game breaks. So every
// version's css/ and js/ go into their own folder, v/<version>/, and index.html points there.
// The modules import each other with relative paths ('./views.js'), so they all stay in that folder.
// Unversioned copies are kept too, for pages that were cached before this existed.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function buildSite(version, outDir){
  if (!/^[\w.-]+$/.test(version)) throw new Error(`bad version "${version}"`);
  fs.rmSync(outDir, {recursive: true, force: true});
  const vdir = path.join(outDir, 'v', version);
  fs.mkdirSync(vdir, {recursive: true});
  for (const dir of ['css', 'js']){
    fs.cpSync(path.join(ROOT, dir), path.join(vdir, dir), {recursive: true});
    fs.cpSync(path.join(ROOT, dir), path.join(outDir, dir), {recursive: true});
  }
  // every import must be relative, or it would escape the version folder
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))){
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    for (const m of src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm))
      if (!m[1].startsWith('./')) throw new Error(`js/${f} imports "${m[1]}": imports must be relative ('./x.js')`);
  }
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const before = html;
  html = html.replace('href="css/style.css"', `href="v/${version}/css/style.css"`)
             .replace('src="js/main.js"', `src="v/${version}/js/main.js"`);
  if (html === before || !html.includes(`v/${version}/js/main.js`) || !html.includes(`v/${version}/css/style.css`))
    throw new Error('index.html must load css/style.css and js/main.js');
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  return {version, outDir};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const version = process.argv[2] || execSync('git rev-parse --short HEAD', {cwd: ROOT}).toString().trim();
  const out = path.resolve(ROOT, process.argv[3] || '_site');
  buildSite(version, out);
  console.log(`built ${path.relative(ROOT, out)}/ (game files in v/${version}/)`);
}
