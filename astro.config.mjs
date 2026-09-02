import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://arca.computer',
  output: 'static',
  trailingSlash: 'never',
  integrations: [sitemap()],
});
