import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://yuge-photo.com',
  trailingSlash: 'never',
  adapter: cloudflare(),
});