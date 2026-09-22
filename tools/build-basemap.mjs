#!/usr/bin/env node
// Regenerates the OFFLINE_BASEMAP_DATA block in ARIA.html.
//
// ARIA's map background (Esri World Street Map tiles) always needs an internet
// connection. When tiles cannot load, ARIA falls back to a simplified vector
// basemap so a polygon's location is still visible: country boundaries plus a
// 30-degree graticule. This script builds the boundary data from Natural
// Earth's 1:110m country boundaries (public domain), redistributed as
// TopoJSON by the world-atlas npm package (ISC licence, see
// https://github.com/topojson/world-atlas), converted to GeoJSON, and rounded
// to two decimal places (about 1 km) since this is a reference basemap, not a
// source of precise coordinates.
//
// Usage:  node tools/build-basemap.mjs
// Needs:  Node 18 or later, npm, and access to the npm registry.
// This rarely needs to be rerun: the source data essentially never changes.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'ARIA.html');
const RESOLUTION = '110m'; // world-atlas scale: 110m | 50m | 10m
const DECIMALS = 2; // ~1 km at the equator

function fail(msg) { console.error('BUILD FAILED: ' + msg); process.exit(1); }
function round(x, d) { const m = 10 ** d; return Math.round(x * m) / m; }
function roundCoords(c, d) { return typeof c[0] === 'number' ? [round(c[0], d), round(c[1], d)] : c.map((x) => roundCoords(x, d)); }

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aria-basemap-'));
fs.writeFileSync(path.join(work, 'package.json'), '{"private":true}');
console.log('Installing world-atlas and topojson-client from npm ...');
execFileSync('npm', ['install', '--no-audit', '--no-fund', '--silent', '--save-exact', 'world-atlas@2.0.2', 'topojson-client@3.1.0'],
  { cwd: work, stdio: 'inherit', shell: process.platform === 'win32' });
const require = createRequire(path.join(work, 'x.js'));
const topojson = require(path.join(work, 'node_modules', 'topojson-client'));

const topoPath = path.join(work, 'node_modules', 'world-atlas', `countries-${RESOLUTION}.json`);
if (!fs.existsSync(topoPath)) fail('world-atlas file missing: ' + topoPath);
const topo = JSON.parse(fs.readFileSync(topoPath, 'utf8'));
const geo = topojson.feature(topo, topo.objects.countries);
if (!geo.features || !geo.features.length) fail('no country features produced');

const out = {
  type: 'FeatureCollection',
  features: geo.features.map((f) => ({
    type: 'Feature',
    properties: { name: (f.properties && f.properties.name) || '' },
    geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates, DECIMALS) },
  })),
};
const json = JSON.stringify(out);
if (/<\/script/i.test(json)) fail('embedded data contains a script end tag');

let html = fs.readFileSync(SRC, 'utf8');
const startMark = '/* OFFLINE_BASEMAP_DATA:START */';
const endMark = '/* OFFLINE_BASEMAP_DATA:END */';
const s = html.indexOf(startMark), e = html.indexOf(endMark);
if (s < 0) fail('start marker not found in ARIA.html');
if (e < 0) fail('end marker not found in ARIA.html');
if (e < s) fail('markers are out of order in ARIA.html');
html = html.slice(0, s + startMark.length) + '\n' + json + '\n' + html.slice(e);
fs.writeFileSync(SRC, html);
fs.rmSync(work, { recursive: true, force: true });
console.log('Embedded ' + out.features.length + ' country boundaries (' + (json.length / 1024).toFixed(0) + ' KB) into ' + path.relative(process.cwd(), SRC));
