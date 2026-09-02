import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Astro emits a static site for the canonical domain', async () => {
  const config = await read('astro.config.mjs');
  assert.match(config, /site:\s*['"]https:\/\/arca\.computer['"]/);
  assert.match(config, /output:\s*['"]static['"]/);
  assert.match(config, /trailingSlash:\s*['"]never['"]/);
  assert.match(config, /sitemap\(\)/);
  assert.match(await read('src/pages/deck.astro'), /canonicalPath="\/deck"/);
});

test('Cloudflare publishes only dist with no provider preview origins', async () => {
  const config = JSON.parse(await read('wrangler.json'));
  assert.equal(config.name, 'arca-computer-web');
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.equal(config.assets.run_worker_first, true);
  assert.deepEqual(config.routes, [
    { pattern: 'arca.computer', custom_domain: true },
    { pattern: 'www.arca.computer', custom_domain: true },
  ]);
});

test('the Worker canonicalizes www and HTTP while preserving path and query', async () => {
  const { default: worker } = await import('../src/worker.js');
  const env = { ASSETS: { fetch: async () => new Response('asset', { status: 200 }) } };
  const response = await worker.fetch(new Request('http://www.arca.computer/deck?from=test'), env);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://arca.computer/deck?from=test');
});

test('the Worker redirects HTTP apex requests to HTTPS', async () => {
  const { default: worker } = await import('../src/worker.js');
  const env = { ASSETS: { fetch: async () => new Response('asset', { status: 200 }) } };
  const response = await worker.fetch(new Request('http://arca.computer/company?from=test'), env);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://arca.computer/company?from=test');
});

test('the Worker serves assets on the canonical host', async () => {
  const { default: worker } = await import('../src/worker.js');
  const env = { ASSETS: { fetch: async (request) => new Response(new URL(request.url).pathname) } };
  const response = await worker.fetch(new Request('https://arca.computer/deck'), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '/deck');
});

test('migration removes Vercel configuration and includes a custom 404', async () => {
  await assert.rejects(read('vercel.json'));
  assert.match(await read('src/pages/404.astro'), /Page not found/);
});

test('the company deck reflects the current August 30 product state', async () => {
  const deck = await read('src/pages/deck.astro');
  const styles = await read('public/deck/styles.css');

  for (const expected of [
    'Agent Launchpad',
    'Private preview',
    'Durable memory',
    'AgentMail',
    'Multi-runtime',
    'Open Hardware Lab',
    'Web3 field index',
    'Hypersnap Doctor',
    '2,051+',
    'Deterministic ClawFix detectors',
    '11 company · 31 agent · 33 founder',
    'August 30, 2026',
  ]) {
    assert.match(deck, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const stale of [
    '1,771+',
    '207+ diagnoses',
    'Metrics verified August 2, 2026',
    'github.com/arcabotai/hypersnap"',
    'SMS · RCS · iMessage integration',
    'clawfix.dev',
    'WarpletScan',
    'Daytona',
    '$10K',
    '$50K',
    '<strong>Live</strong><span>Agent Launchpad',
  ]) {
    assert.doesNotMatch(deck, new RegExp(stale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(styles, /\.deck-header nav a\s*\{[^}]*min-height:\s*24px/s);
});

test('the deck shares the motion layer and keeps print and reduced motion safe', async () => {
  const deck = await read('src/pages/deck.astro');
  const styles = await read('public/deck/styles.css');
  const motion = await read('public/motion.css');

  assert.match(deck, /stylesheet="\/deck\/styles\.css"/);
  assert.match(deck, /class="signal-board" aria-hidden="true"/);
  assert.match(deck, /class="cover-diagram" aria-hidden="true" data-draw/);
  assert.match(deck, /data-count="2051" data-suffix="\+">2,051\+</);
  assert.match(deck, /import \{ initMotion \} from '\.\.\/scripts\/motion'/);
  assert.match(styles, /html\.js \.cover h1 \.line > span/);
  assert.match(styles, /\.signal-board \{ display: none; \}/);
  assert.match(motion, /@media print \{[\s\S]*\[data-reveal\][\s\S]*opacity: 1 !important/);
  assert.match(motion, /@media \(prefers-reduced-motion: reduce\)/);
});

const literal = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('the homepage motion layer is progressive and reduced-motion aware', async () => {
  const layout = await read('src/layouts/BaseLayout.astro');
  const page = await read('src/pages/index.astro');
  const styles = await read('public/styles.css');
  const motion = await read('public/motion.css');

  assert.match(layout, /documentElement\.classList\.add\('js'\)/);
  assert.match(layout, /<link rel="stylesheet" href="\/motion\.css" \/>/);
  assert.match(layout, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com"/);
  assert.match(layout, /fonts\.googleapis\.com\/css2\?family=DM\+Mono/);
  assert.doesNotMatch(styles, /@import/);
  assert.match(styles, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(motion, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(motion, /html\.js \[data-reveal\]/);
  assert.match(page, /class="signal-board" aria-hidden="true"/);
  assert.match(page, /<h1 id="hero-title">[\s\S]*The company[\s\S]*is the computer\.[\s\S]*<\/h1>/);
  assert.match(page, /import \{ initMotion \} from '\.\.\/scripts\/motion'/);
  assert.match(page, /import \{ mountSignalBoard \} from '\.\.\/scripts\/signal-board'/);
});

test('the homepage links to the deck and repeats the deck metrics exactly', async () => {
  const page = await read('src/pages/index.astro');
  const deck = await read('src/pages/deck.astro');

  assert.match(page, /<nav aria-label="Primary navigation">[\s\S]*href="\/deck"[\s\S]*<\/nav>/);
  assert.match(page, /class="button button-secondary" href="\/deck"/);

  for (const figure of ['2,051+', '11 company · 31 agent · 33 founder', 'August 30, 2026']) {
    assert.match(page, literal(figure));
    assert.match(deck, literal(figure));
  }
  assert.match(page, /data-count="75"/);
  assert.match(page, /data-count="2051" data-suffix="\+"/);
  assert.match(page, /data-count="49"/);
});
