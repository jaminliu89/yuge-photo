// Use @sanity/astro's built-in client (injected via Astro integration)
// The sanity integration automatically provides env vars in Astro context
import { createClient } from '@sanity/client'

const projectId = import.meta.env.SANITY_PROJECT_ID || import.meta.env.PUBLIC_SANITY_PROJECT_ID
const dataset = import.meta.env.SANITY_DATASET || import.meta.env.PUBLIC_SANITY_DATASET || 'production'

export const client = createClient({
  projectId,
  dataset,
  useCdn: true,
  apiVersion: '2024-03-01',
  perspective: 'published',
})

/** Query all posts, newest first */
export async function getAllPosts() {
  return client.fetch(`*[_type == "post"] | order(publishedAt desc) {
    _id,
    title,
    slug,
    description,
    publishedAt,
    category,
    level,
    tags,
    "heroImageUrl": heroImage.asset->url,
    videos
  }`)
}

/** Query a single post by slug */
export async function getPostBySlug(slug) {
  return client.fetch(`*[_type == "post" && slug.current == $slug][0]`, { slug })
}