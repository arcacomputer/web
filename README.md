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
