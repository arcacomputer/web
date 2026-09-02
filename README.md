# Arca Computer web

Canonical source for [arca.computer](https://arca.computer), the company website of Arca Computer, Inc.

## Stack

- Astro static output
- Cloudflare Workers Static Assets
- `www.arca.computer` redirects to the apex domain at the edge

## Development

```bash
npm ci
npm run check
npm run preview
```

## Deployment

Production will deploy from the tested `main` branch to the Arca Computer Cloudflare account after the company zone is attached and the first deployment is verified. The Vercel deployment remains the live rollback target until that cutover passes.

## Motion

The homepage is fully readable without JavaScript. A one-line inline script in `src/layouts/BaseLayout.astro` adds `html.js`, and every hidden-until-revealed rule in `public/styles.css` is scoped to that class and to `prefers-reduced-motion: no-preference`.

- `src/scripts/motion.ts` — scroll reveals, condensed masthead + progress line, active nav, pointer highlights, magnetic buttons, metric counters, and the self-drawing signal map.
- `src/scripts/signal-board.ts` — the hero canvas (procedural traces with travelling pulses). It pauses off-screen and when the tab is hidden, and renders one static frame under reduced motion.

To test the reduced-motion path, emulate `prefers-reduced-motion: reduce` in DevTools (Rendering panel) and reload.
