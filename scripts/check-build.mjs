import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');
const exists = async (path) => { await stat(new URL(`../dist/${path}`, import.meta.url)); };

await Promise.all([
  exists('index.html'),
  exists('404.html'),
  exists('styles.css'),
  exists('robots.txt'),
  exists('sitemap-index.xml'),
  exists('og-image.png'),
  exists('deck/index.html'),
  exists('_headers'),
]);

const html = await read('index.html');
assert.match(html, /<link rel="canonical" href="https:\/\/arca\.computer\/"/);
assert.match(html, /The company[\s\S]*is the computer\./);
assert.match(html, /contact@arca\.computer/);
assert.match(html, /Arca Computer, Inc\./);
assert.equal((html.match(/id="content"/g) ?? []).length, 1);
assert.equal((html.match(/id="top"/g) ?? []).length, 1);

const robots = await read('robots.txt');
assert.match(robots, /Sitemap: https:\/\/arca\.computer\/sitemap-index\.xml/);
console.log('Built-site contract passed.');
