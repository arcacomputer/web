import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Astro emits a static site for the canonical domain', async () => {
  const config = await read('astro.config.mjs');
  assert.match(config, /site:\s*['"]https:\/\/arca\.computer['"]/);
  assert.match(config, /output:\s*['"]static['"]/);
  assert.match(config, /sitemap\(\)/);
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

test('the Worker redirects www while preserving path and query', async () => {
  const { default: worker } = await import('../src/worker.js');
  const env = { ASSETS: { fetch: async () => new Response('asset', { status: 200 }) } };
  const response = await worker.fetch(new Request('https://www.arca.computer/deck?from=test'), env);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), 'https://arca.computer/deck?from=test');
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
