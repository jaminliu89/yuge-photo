import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './sanity/schemas';

export default defineConfig({
  name: 'default',
  title: '羽歌摄影',
  projectId: import.meta.env.SANITY_PROJECT_ID || '',
  dataset: import.meta.env.SANITY_DATASET || 'production',
  plugins: [structureTool()],
  schema: { types: schemaTypes },
});