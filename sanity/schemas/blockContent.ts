import { defineType, defineArrayMember } from 'sanity';

export default defineType({
  title: '正文内容',
  name: 'blockContent',
  type: 'array',
  of: [
    defineArrayMember({
      title: '段落',
      type: 'block',
      styles: [
        { title: '正文', value: 'normal' },
        { title: 'H2', value: 'h2' },
        { title: 'H3', value: 'h3' },
        { title: '引用', value: 'blockquote' },
      ],
      lists: [
        { title: '无序列表', value: 'bullet' },
        { title: '有序列表', value: 'number' },
      ],
      marks: {
        decorators: [
          { title: '加粗', value: 'strong' },
          { title: '斜体', value: 'em' },
          { title: '删除线', value: 'strike-through' },
        ],
        annotations: [
          {
            title: '链接',
            name: 'link',
            type: 'object',
            fields: [
              { name: 'href', type: 'url', title: 'URL' },
            ],
          },
        ],
      },
    }),
    defineArrayMember({
      type: 'image',
      options: { hotspot: true },
      fields: [
        { name: 'alt', type: 'string', title: '替代文本' },
        { name: 'caption', type: 'string', title: '图注' },
      ],
    }),
  ],
});