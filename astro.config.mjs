import { defineConfig } from 'astro/config';
import sanity from '@sanity/astro';

export default defineConfig({
  site: 'https://yuge-photo.com',
  trailingSlash: 'never',
  integrations: [
    sanity({
      projectId: 't91fklrg',
      dataset: 'production',
      apiVersion: '2024-03-01',
      useCdn: true,
    }),
  ],
});