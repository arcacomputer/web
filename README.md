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

Production is deployed from the tested `main` branch to the Arca Computer Cloudflare account. The Vercel deployment remains a temporary rollback target until the Cloudflare cutover is fully verified.
