import { chromium } from 'playwright';
import AxeBuilder from 'axe-core';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const baseURL = process.env.SITE_URL ?? 'http://127.0.0.1:8787';
const systemChrome = '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath: existsSync(systemChrome) ? systemChrome : undefined, headless: true });
const results = {};

for (const path of ['/', '/deck']) {
for (const [name, viewport] of Object.entries({
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
})) {
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  const label = path === '/' ? name : `${name}-${path.slice(1)}`;
  const response = await page.goto(new URL(path, baseURL).href, { waitUntil: 'networkidle' });
  // Walk the page so scroll-triggered reveals have fired before screenshots and axe run.
  await page.evaluate(async () => {
    const step = Math.max(240, Math.round(window.innerHeight * 0.6));
    const height = document.documentElement.scrollHeight;
    for (let y = 0; y <= height; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `artifacts/${label}.png`, fullPage: true });
  await page.addScriptTag({ content: AxeBuilder.source });
  const axe = await page.evaluate(async () => globalThis.axe.run(document));
  const metrics = await page.evaluate(() => {
    const contact = document.querySelector('.contact-link');
    const contactRange = document.createRange();
    if (contact) contactRange.selectNodeContents(contact);
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
      hasContactLink: Boolean(contact),
      contactLines: contact ? new Set([...contactRange.getClientRects()].map((rect) => Math.round(rect.top))).size : 0,
    };
  });
  results[label] = {
    status: response?.status(),
    consoleErrors,
    metrics,
    axeViolations: axe.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.length })),
  };
  await page.close();
  await context.close();
}
}

await browser.close();
await writeFile('artifacts/qa.json', JSON.stringify(results, null, 2) + '\n');

for (const [name, result] of Object.entries(results)) {
  if (result.status !== 200) throw new Error(`${name}: expected HTTP 200`);
  if (result.consoleErrors.length) throw new Error(`${name}: browser errors: ${result.consoleErrors.join('; ')}`);
  if (result.metrics.scrollWidth !== result.metrics.clientWidth) throw new Error(`${name}: horizontal overflow`);
  if (result.metrics.hasContactLink && result.metrics.contactLines !== 1) throw new Error(`${name}: contact link wraps onto ${result.metrics.contactLines} lines`);
  if (result.axeViolations.length) throw new Error(`${name}: axe violations: ${JSON.stringify(result.axeViolations)}`);
}

console.log(JSON.stringify(results, null, 2));
