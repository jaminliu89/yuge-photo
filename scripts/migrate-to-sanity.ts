/**
 * 将 src/content/posts/*.md 迁移到 Sanity
 *
 * 用法:
 *   npx tsx scripts/migrate-to-sanity.ts
 *
 * 环境变量:
 *   SANITY_PROJECT_ID  (必填)
 *   SANITY_DATASET     (默认 production)
 *   SANITY_TOKEN       (必填 — API token, Editor 权限)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@sanity/client';

interface PostFrontmatter {
  title: string;
  description: string;
  date: string;
  category: string;
  level?: string;
  tags?: string[];
  videos?: { platform: string; title: string; url: string }[];
}

interface SanityDocument {
  _type: 'post';
  _id: string;
  title: string;
  slug: { _type: 'slug'; current: string };
  description: string;
  publishedAt: string;
  category: string;
  level?: string;
  tags?: string[];
  heroImage?: { _type: 'image'; asset: { _type: 'reference'; _ref: string } };
  body: SanityBlockContent[];
  videos?: { platform: string; title: string; url: string }[];
}

type SanityBlockContent =
  | { _type: 'block'; children: { _type: 'span'; text: string }[]; style?: string }
  | { _type: 'image'; asset: { _type: 'reference'; _ref: string } };

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID || '',
  dataset: process.env.SANITY_DATASET || 'production',
  token: process.env.SANITY_TOKEN,
  useCdn: false,
  apiVersion: '2024-03-01',
});

const POSTS_DIR = resolve(import.meta.dirname!, '../src/content/posts');

/** Parse frontmatter from markdown content */
function parseFrontmatter(content: string): { data: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Missing frontmatter');

  const frontmatterLines = match[1].split('\n');
  const data: Record<string, unknown> = {};
  let currentKey = '';

  for (const line of frontmatterLines) {
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      let val: unknown = keyMatch[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^\d{4}-\d{2}-\d{2}/.test(val as string)) val = new Date(val as string).toISOString();
      data[currentKey] = val;
    } else if (currentKey && line.startsWith('  ')) {
      // Multi-line value (arrays)
      const arrMatch = line.match(/^\s+-\s+(.*)$/);
      if (arrMatch) {
        if (!Array.isArray(data[currentKey])) data[currentKey] = [];
        (data[currentKey] as string[]).push(arrMatch[1].trim());
      }
    }
  }

  return { data, body: match[2].trim() };
}

/** Convert markdown body to Sanity block content */
function markdownToBlocks(md: string): SanityBlockContent[] {
  const blocks: SanityBlockContent[] = [];
  const lines = md.split('\n');
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          _type: 'block',
          style: 'code',
          children: [{ _type: 'span', text: codeBuffer.join('\n') }],
        });
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      // Add empty line as paragraph break
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push({
        _type: 'block',
        style: level === 2 ? 'h2' : 'h3',
        children: [{ _type: 'span', text: headingMatch[2] }],
      });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      blocks.push({
        _type: 'block',
        style: 'blockquote',
        children: [{ _type: 'span', text: trimmed.slice(2) }],
      });
      continue;
    }

    // Regular paragraph — basic inline formatting
    blocks.push({
      _type: 'block',
      style: 'normal',
      children: [{ _type: 'span', text: trimmed }],
    });
  }

  return blocks;
}

async function main() {
  if (!process.env.SANITY_PROJECT_ID || !process.env.SANITY_TOKEN) {
    console.error('❌ 需要设置 SANITY_PROJECT_ID 和 SANITY_TOKEN 环境变量');
    process.exit(1);
  }

  const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  console.log(`📂 找到 ${files.length} 个 markdown 文件\n`);

  for (const file of files) {
    const content = readFileSync(join(POSTS_DIR, file), 'utf-8');
    const { data, body } = parseFrontmatter(content);
    const fm = data as unknown as PostFrontmatter;

    const slug = file.replace(/\.md$/, '').replace(/^\d+-/, '');

    const doc: SanityDocument = {
      _type: 'post',
      _id: `post-${slug}`,
      title: fm.title,
      slug: { _type: 'slug', current: slug },
      description: fm.description,
      publishedAt: fm.date || new Date().toISOString(),
      category: fm.category,
      level: fm.level,
      tags: fm.tags,
      body: markdownToBlocks(body),
    };

    if (fm.videos?.length) {
      doc.videos = fm.videos;
    }

    try {
      const result = await client.createOrReplace(doc);
      console.log(`✅ ${file} → ${result._id}`);
    } catch (err) {
      console.error(`❌ ${file}:`, (err as Error).message);
    }
  }

  console.log('\n🎉 迁移完成！');
}

main();