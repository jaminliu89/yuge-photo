/**
 * 将 src/content/posts/*.md 迁移到 Sanity
 *
 * 环境变量:
 *   SANITY_PROJECT_ID  (必填)
 *   SANITY_DATASET     (默认 production)
 *   SANITY_TOKEN       (必填 — API token, Editor 权限)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@sanity/client';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID || '',
  dataset: process.env.SANITY_DATASET || 'production',
  token: process.env.SANITY_TOKEN,
  useCdn: false,
  apiVersion: '2024-03-01',
});

const POSTS_DIR = join(__dirname, '../src/content/posts');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Missing frontmatter');

  const lines = match[1].split('\n');
  const data = {};
  let currentKey = '';

  for (const line of lines) {
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      let val = keyMatch[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^\d{4}-\d{2}-\d{2}/.test(val)) val = new Date(val).toISOString();
      data[currentKey] = val;
    } else if (currentKey && /^\s+-/.test(line)) {
      const item = line.replace(/^\s+-\s*/, '').trim();
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(item);
    }
  }

  // Handle videos which are structured objects in YAML
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const body = bodyMatch ? bodyMatch[1].trim() : '';

  return { data, body };
}

function markdownToBlocks(md) {
  const blocks = [];
  const lines = md.split('\n');
  let inCodeBlock = false;
  let codeBuf = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          _type: 'block',
          style: 'normal',
          children: [{ _type: 'span', text: codeBuf.join('\n') }],
        });
        codeBuf = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeBuf.push(line); continue; }

    const t = line.trim();
    if (!t) continue;

    const h = t.match(/^(#{2,3})\s+(.+)$/);
    if (h) {
      blocks.push({
        _type: 'block',
        style: h[1].length === 2 ? 'h2' : 'h3',
        children: [{ _type: 'span', text: h[2] }],
      });
      continue;
    }

    if (t.startsWith('> ')) {
      blocks.push({
        _type: 'block',
        style: 'blockquote',
        children: [{ _type: 'span', text: t.slice(2) }],
      });
      continue;
    }

    blocks.push({
      _type: 'block',
      style: 'normal',
      children: [{ _type: 'span', text: t }],
    });
  }

  return blocks;
}

async function main() {
  if (!process.env.SANITY_PROJECT_ID || !process.env.SANITY_TOKEN) {
    console.error('❌ 需要设置 SANITY_PROJECT_ID 和 SANITY_TOKEN');
    process.exit(1);
  }

  const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  console.log(`📂 找到 ${files.length} 个 markdown 文件\n`);

  for (const file of files) {
    const content = readFileSync(join(POSTS_DIR, file), 'utf-8');
    const { data, body } = parseFrontmatter(content);

    const slug = file.replace(/\.md$/, '').replace(/^\d+-/, '');
    const tags = data.tags ? (Array.isArray(data.tags) ? data.tags : [data.tags]) : undefined;

    const doc = {
      _type: 'post',
      _id: `post-${slug}`,
      title: data.title,
      slug: { _type: 'slug', current: slug },
      description: data.description || '',
      publishedAt: data.date || new Date().toISOString(),
      category: data.category || '',
      level: data.level || undefined,
      tags,
      body: markdownToBlocks(body),
    };

    // Handle videos from YAML — they're in the raw frontmatter as nested objects
    const rawYaml = content.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
    const videoRegex = /videos:\n((?:\s+- .*\n?)*)/;
    const vm = rawYaml.match(videoRegex);
    if (vm) {
      const videoLines = vm[1].split('\n').filter(l => l.trim());
      const videos = [];
      let currentVideo = {};
      for (const vl of videoLines) {
        const propMatch = vl.match(/^\s+-\s+(\w+):\s*(.*)$/);
        if (propMatch) {
          if (propMatch[1] === 'platform' && Object.keys(currentVideo).length > 0) {
            videos.push(currentVideo);
            currentVideo = {};
          }
          currentVideo[propMatch[1]] = propMatch[2].replace(/^["']|["']$/g, '');
        }
      }
      if (Object.keys(currentVideo).length > 0) videos.push(currentVideo);
      if (videos.length > 0) doc.videos = videos;
    }

    try {
      const result = await client.createOrReplace(doc);
      console.log(`✅ ${file} → ${result._id}`);
    } catch (err) {
      console.error(`❌ ${file}: ${err.message}`);
    }
  }

  console.log('\n🎉 迁移完成！');
}

main();