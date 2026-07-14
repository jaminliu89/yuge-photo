import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    category: z.string(),
    level: z.enum(['入门', '进阶']),
    tags: z.array(z.string()),
    videos: z.array(z.object({
      platform: z.enum(['bilibili', 'douyin', 'youtube']),
      title: z.string(),
      url: z.string(),
    })).optional(),
  }),
});

export const collections = { posts };
