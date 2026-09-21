#!/usr/bin/env node
// Builds ARIA-offline.html from ARIA.html.
//
// The standard ARIA.html loads its libraries and fonts from public CDNs.
// This script downloads pinned copies from the npm registry and embeds them,
// so the resulting single file needs no internet to start. The map background,
// AI calls and online sources still need internet.
//
// Usage:   node tools/build-offline.mjs
// Needs:   Node 18 or later, npm, and access to the npm registry.
// Output:  ARIA-offline.html (next to ARIA.html)
//
// Only two functions from Turf are used by ARIA (bbox and booleanIntersects),
// so a small bundle of just those is embedded instead of the full Turf build.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'ARIA.html');
const OUT = path.join(ROOT, 'ARIA-offline.html');

const PACKAGES = {
  'leaflet': '1.9.4',
  'leaflet-draw': '1.0.4',
  '@turf/bbox': '6.5.0',
  '@turf/boolean-intersects': '6.5.0',
  'shpjs': '4.0.4',
  'sql.js': '1.10.2',
  '@fontsource/dm-sans': '5.3.0',
  '@fontsource/dm-mono': '5.3.0',
  'esbuild': '0.28.2',
};

function fail(msg) { console.error('BUILD FAILED: ' + msg); process.exit(1); }

// Replace exactly one occurrence of `find` in `text`, or stop the build.
function swap(text, find, replacement, label) {
  const first = text.indexOf(find);
  if (first < 0) fail('expected text not found in ARIA.html: ' + label);
  if (text.indexOf(find, first + find.length) >= 0) fail('expected text found more than once in ARIA.html: ' + label);
  return text.slice(0, first) + replacement + text.slice(first + find.length);
}

const b64 = (buf) => Buffer.from(buf).toString('base64');
// Keep inline scripts from ending early, and drop source map references.
const safeJs = (s) => s.replace(/\/\/# sourceMappingURL=.*$/gm, '').replace(/<\/script/gi, '<\\/script');

// 1. Install the pinned packages into a temporary folder.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aria-offline-'));
fs.writeFileSync(path.join(work, 'package.json'), '{"private":true}');
console.log('Installing pinned packages from npm ...');
execFileSync('npm', ['install', '--no-audit', '--no-fund', '--silent', '--save-exact',
  ...Object.entries(PACKAGES).map(([n, v]) => n + '@' + v)], { cwd: work, stdio: 'inherit', shell: process.platform === 'win32' });
const nm = (...p) => path.join(work, 'node_modules', ...p);
const read = (...p) => fs.readFileSync(nm(...p), 'utf8');
const require = createRequire(path.join(work, 'x.js'));

// 2. Bundle the two Turf functions that ARIA uses.
const esbuild = require('esbuild');
const bundle = await esbuild.build({
  stdin: {
    contents: "export { default as bbox } from '@turf/bbox';\nexport { default as booleanIntersects } from '@turf/boolean-intersects';",
    resolveDir: work,
  },
  bundle: true, format: 'iife', globalName: 'turf', minify: true, target: 'es2019',
  legalComments: 'inline', write: false, metafile: true, logLevel: 'error',
});
const turfJs = bundle.outputFiles[0].text;

// 3. CSS: Leaflet and Leaflet.draw with their images embedded.
const mime = { '.png': 'image/png', '.svg': 'image/svg+xml' };
function inlineCssImages(css, dir) {
  return css.replace(/url\((['"]?)(images\/[^'")]+)\1\)/g, (all, q, rel) => {
    const file = path.join(dir, rel);
    if (!fs.existsSync(file)) fail('CSS image missing: ' + file);
    return 'url(data:' + mime[path.extname(file)] + ';base64,' + b64(fs.readFileSync(file)) + ')';
  });
}
const leafletCss = inlineCssImages(read('leaflet', 'dist', 'leaflet.css'), nm('leaflet', 'dist'));
const drawCss = inlineCssImages(read('leaflet-draw', 'dist', 'leaflet.draw.css'), nm('leaflet-draw', 'dist'));

// 4. Fonts: Latin and Latin Extended subsets, same weights as the Google Fonts link.
function fontCss(pkg, weights) {
  let out = '';
  for (const w of weights) {
    const css = read('@fontsource', pkg, w + '.css');
    const blocks = css.match(/\/\* [^*]+ \*\/\s*@font-face\s*\{[^}]*\}/g) || [];
    let kept = 0;
    for (const block of blocks) {
      const name = block.match(/\/\* ([^*]+?) \*\//)[1];
      if (!new RegExp('^' + pkg + '-latin(-ext)?-' + w + '-normal$').test(name)) continue;
      const file = nm('@fontsource', pkg, 'files', name + '.woff2');
      if (!fs.existsSync(file)) fail('font file missing: ' + file);
      out += block
        .replace(/src:[^;]+;/, 'src: url(data:font/woff2;base64,' + b64(fs.readFileSync(file)) + ') format("woff2");')
        .replace(/\/\*[^*]+\*\/\s*/, '') + '\n';
      kept++;
    }
    if (kept !== 2) fail('expected 2 font subsets for ' + pkg + ' ' + w + ', found ' + kept);
  }
  return out;
}
const fonts = fontCss('dm-sans', [300, 400, 500, 600]) + fontCss('dm-mono', [400, 500]);

// 5. Third-party licence texts.
const MIT = (holder) => 'The MIT License (MIT)\n\nCopyright (c) ' + holder + '\n\n' +
  'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\n' +
  'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\n' +
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n';

function packageRoot(inputPath) {
  const m = inputPath.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//g);
  if (!m) return null;
  const last = m[m.length - 1];
  return last.replace(/^node_modules\//, '').replace(/\/$/, '');
}
const bundled = new Set();
for (const input of Object.keys(bundle.metafile.inputs)) {
  const pkg = packageRoot(input);
  if (pkg) bundled.add(pkg);
}
const licensed = new Set(['leaflet', 'leaflet-draw', 'shpjs', 'sql.js', '@fontsource/dm-sans', '@fontsource/dm-mono', ...bundled]);
// rbush ships with quickselect (ISC) built into its minified file.
if (bundled.has('rbush')) licensed.add('quickselect');
const overrides = { 'leaflet-draw': 'Jacob Toye, Jon West, Smartrak, Leaflet (2012-2017)' };
let licenses = 'Third-party software included in this file\n' +
  '=========================================\n\n' +
  'ARIA itself is released under the MIT License (see the header of this file).\n' +
  'The following packages are embedded in this offline build, unchanged except for\n' +
  'minification or bundling. Turf modules are bundled: only bbox and booleanIntersects\n' +
  'and their dependencies are included. shpjs is included as distributed by its\n' +
  'authors and contains JSZip (MIT or GPLv3, used here under MIT), lie, proj4js and\n' +
  'other MIT-licensed code; their notices remain inside the shpjs code below.\n\n';
for (const pkg of [...licensed].sort()) {
  const dir = nm(...pkg.split('/'));
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const file = fs.readdirSync(dir).find((f) => /^(licen[sc]e|copying)(\.(md|txt))?$/i.test(f));
  licenses += '-'.repeat(72) + '\n' + meta.name + ' ' + meta.version + ' (' + meta.license + ')\n' + '-'.repeat(72) + '\n\n';
  if (file) licenses += fs.readFileSync(path.join(dir, file), 'utf8').trim() + '\n\n';
  else if (meta.license === 'MIT') {
    const author = typeof meta.author === 'string' ? meta.author : (meta.author && meta.author.name) || 'the authors';
    licenses += MIT(overrides[pkg] || author) + '\n';
  } else licenses += 'License: ' + meta.license + '. See ' + (meta.homepage || 'the package page') + '\n\n';
}
if (licenses.toLowerCase().includes('</script')) fail('licence text contains a script end tag');

// 6. Assemble the HTML.
let html = fs.readFileSync(SRC, 'utf8');

html = swap(html, '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>\n', '', 'leaflet css link');
html = swap(html, '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css"/>\n', '', 'draw css link');
html = swap(html,
  '<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">\n',
  '<style>\n' + leafletCss + '\n' + drawCss + '\n' + fonts + '</style>\n', 'google fonts link');

const wasm = fs.readFileSync(nm('sql.js', 'dist', 'sql-wasm.wasm'));
const scriptBlock = (js) => '<script>\n' + safeJs(js) + '\n</script>\n';
html = swap(html, '<script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js"></script>\n',
  scriptBlock('window.ARIA_SQL_WASM=Uint8Array.from(atob("' + b64(wasm) + '"),function(c){return c.charCodeAt(0);});') +
  scriptBlock(read('sql.js', 'dist', 'sql-wasm.js')), 'sql.js script');
html = swap(html, '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>\n', scriptBlock(read('leaflet', 'dist', 'leaflet.js')), 'leaflet script');
html = swap(html, '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js"></script>\n', scriptBlock(read('leaflet-draw', 'dist', 'leaflet.draw.js')), 'draw script');
html = swap(html, '<script src="https://unpkg.com/@turf/turf@6/turf.min.js"></script>\n', scriptBlock(turfJs), 'turf script');
html = swap(html, '<script src="https://unpkg.com/shpjs@4.0.4/dist/shp.js"></script>\n', scriptBlock(read('shpjs', 'dist', 'shp.min.js')), 'shpjs script');
html = swap(html, "initSqlJs({locateFile:f=>'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/'+f})", 'initSqlJs({wasmBinary:window.ARIA_SQL_WASM})', 'sql.js init');
html = swap(html, '<head>\n', '<head>\n<!-- Offline build. Generated by tools/build-offline.mjs from ARIA.html. Do not edit this file. -->\n', 'head tag');
html = swap(html, '</body>', '<script type="text/plain" id="third-party-licenses">\n' + licenses + '</script>\n</body>', 'body end');

// 7. Final checks: nothing may still load from a CDN.
const markup = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const styles = (html.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
const allowedLinks = new Set(['href="https://lastlarch.com/manual.html"']);
const bad = (markup.match(/(?:src|href)="https?:\/\/[^"]*"/g) || []).filter((x) => !allowedLinks.has(x))
  .concat(styles.match(/@import|url\(\s*['"]?https?:/g) || []);
if (bad.length) fail('external resources remain: ' + bad.join(', '));
if (/unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html.replace(/<script type="text\/plain"[\s\S]*?<\/script>/, ''))) {
  fail('a CDN reference remains in the output');
}

fs.writeFileSync(OUT, html);
fs.rmSync(work, { recursive: true, force: true });
console.log('Wrote ' + path.relative(process.cwd(), OUT) + ' (' + (Buffer.byteLength(html) / 1048576).toFixed(2) + ' MB)');
console.log('Embedded licence notices for: ' + [...licensed].sort().join(', '));
