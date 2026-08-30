import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Astro emits a static site for the canonical domain', async () => {
  const config = await read('astro.config.mjs');
  assert.match(config, /site:\s*['"]https:\/\/arca\.computer['"]/);
  assert.match(config, /output:\s*['"]static['"]/);
  assert.match(config, /sitemap\(\{\s*customPages:\s*\['https:\/\/arca\.computer\/deck'\]\s*\}\)/);
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
  const deck = await read('public/deck/index.html');

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
  ]) {
    assert.doesNotMatch(deck, new RegExp(stale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
