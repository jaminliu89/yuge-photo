import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'post',
  title: '文章',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: '标题',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'URL 别名',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: '描述',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'publishedAt',
      title: '发布日期',
      type: 'datetime',
    }),
    defineField({
      name: 'category',
      title: '分类',
      type: 'string',
      options: {
        list: [
          { title: '构图', value: 'composition' },
          { title: '人像', value: 'portrait' },
          { title: '风景', value: 'landscape' },
          { title: '街拍', value: 'street' },
          { title: '调色', value: 'color' },
          { title: '器材', value: 'gear' },
          { title: '后期', value: 'post' },
          { title: '教程', value: 'tutorial' },
        ],
        layout: 'dropdown',
      },
    }),
    defineField({
      name: 'level',
      title: '难度',
      type: 'string',
      options: {
        list: [
          { title: '入门', value: '入门' },
          { title: '进阶', value: '进阶' },
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'tags',
      title: '标签',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    }),
    defineField({
      name: 'heroImage',
      title: '封面图片',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'body',
      title: '正文',
      type: 'blockContent',
    }),
  ],
});