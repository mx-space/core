import {
  Bold,
  ChevronDown,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  Strikethrough,
  Table,
} from 'lucide-react'
import type { EditorView } from '@codemirror/view'
import type { ComponentType, SVGProps } from 'react'

import { commands, setHeadingLevel } from '../toolbar/markdown-commands'

export type SlashMenuIcon = ComponentType<SVGProps<SVGSVGElement>>

export interface SlashMenuItem {
  id: string
  label: string
  description?: string
  icon?: SlashMenuIcon
  keywords?: string[]
  command: (view: EditorView) => boolean
}

export interface SlashMenuGroup {
  id: string
  label: string
  items: SlashMenuItem[]
}

const insertImage = (view: EditorView): boolean => {
  const { state } = view
  const { from, to } = state.selection.main
  const selectedText = state.sliceDoc(from, to)
  const alt = selectedText || '图片描述'
  const insert = `![${alt}](https://)`

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length - 1 },
  })

  view.focus()
  return true
}

const insertTable = (view: EditorView): boolean => {
  const { state } = view
  const { from } = state.selection.main
  const line = state.doc.lineAt(from)
  const insertPos = line.to
  const needsNewline = line.text.length > 0
  const insert = `${needsNewline ? '\n' : ''}| 列1 | 列2 |\n| --- | --- |\n| 内容1 | 内容2 |\n`
  const cursorOffset = insert.indexOf('列1')

  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert },
    selection: { anchor: insertPos + cursorOffset },
  })

  view.focus()
  return true
}

const insertDetails = (view: EditorView): boolean => {
  const { state } = view
  const { from } = state.selection.main
  const line = state.doc.lineAt(from)
  const insertPos = line.to
  const needsNewline = line.text.length > 0
  const insert = `${needsNewline ? '\n' : ''}<details>\n<summary>摘要</summary>\n\n内容\n\n</details>\n`
  const summaryOffset = insert.indexOf('摘要')

  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert },
    selection: {
      anchor: insertPos + summaryOffset,
      head: insertPos + summaryOffset + 2,
    },
  })

  view.focus()
  return true
}

const insertMathBlock = (view: EditorView): boolean => {
  const { state } = view
  const { from } = state.selection.main
  const line = state.doc.lineAt(from)
  const insertPos = line.to
  const needsNewline = line.text.length > 0
  const insert = `${needsNewline ? '\n' : ''}$$\nE = mc^2\n$$\n`
  const cursorOffset = insert.indexOf('E = mc^2')

  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert },
    selection: { anchor: insertPos + cursorOffset },
  })

  view.focus()
  return true
}

export const slashMenuGroups: SlashMenuGroup[] = [
  {
    id: 'heading',
    label: '标题',
    items: [
      {
        id: 'heading-1',
        label: '标题 1',
        description: '大标题',
        icon: Heading1,
        keywords: ['h1', '一级标题'],
        command: (view) => setHeadingLevel(view, 1),
      },
      {
        id: 'heading-2',
        label: '标题 2',
        description: '中标题',
        icon: Heading2,
        keywords: ['h2', '二级标题'],
        command: (view) => setHeadingLevel(view, 2),
      },
      {
        id: 'heading-3',
        label: '标题 3',
        description: '小标题',
        icon: Heading3,
        keywords: ['h3', '三级标题'],
        command: (view) => setHeadingLevel(view, 3),
      },
      {
        id: 'heading-4',
        label: '标题 4',
        description: '四级标题',
        icon: Heading4,
        keywords: ['h4', '四级标题'],
        command: (view) => setHeadingLevel(view, 4),
      },
      {
        id: 'heading-5',
        label: '标题 5',
        description: '五级标题',
        icon: Heading5,
        keywords: ['h5', '五级标题'],
        command: (view) => setHeadingLevel(view, 5),
      },
      {
        id: 'heading-6',
        label: '标题 6',
        description: '六级标题',
        icon: Heading6,
        keywords: ['h6', '六级标题'],
        command: (view) => setHeadingLevel(view, 6),
      },
    ],
  },
  {
    id: 'text',
    label: '文本格式',
    items: [
      {
        id: 'bold',
        label: '粗体',
        description: '加粗文字',
        icon: Bold,
        keywords: ['bold', 'strong'],
        command: commands.bold,
      },
      {
        id: 'italic',
        label: '斜体',
        description: '倾斜文字',
        icon: Italic,
        keywords: ['italic', 'em'],
        command: commands.italic,
      },
      {
        id: 'strikethrough',
        label: '删除线',
        description: '划掉文字',
        icon: Strikethrough,
        keywords: ['delete', 'strike'],
        command: commands.strikethrough,
      },
      {
        id: 'inline-code',
        label: '行内代码',
        description: '内联代码片段',
        icon: Code,
        keywords: ['code', 'inline'],
        command: commands.inlineCode,
      },
    ],
  },
  {
    id: 'list',
    label: '列表',
    items: [
      {
        id: 'bullet-list',
        label: '无序列表',
        description: '项目符号列表',
        icon: List,
        keywords: ['ul', 'bullet'],
        command: commands.bulletList,
      },
      {
        id: 'ordered-list',
        label: '有序列表',
        description: '编号列表',
        icon: ListOrdered,
        keywords: ['ol', 'number'],
        command: commands.orderedList,
      },
      {
        id: 'task-list',
        label: '任务列表',
        description: '待办事项',
        icon: ListChecks,
        keywords: ['todo', 'task'],
        command: commands.taskList,
      },
    ],
  },
  {
    id: 'block',
    label: '块元素',
    items: [
      {
        id: 'code-block',
        label: '代码块',
        description: '多行代码',
        icon: Code2,
        keywords: ['code', 'block'],
        command: commands.codeBlock,
      },
      {
        id: 'quote',
        label: '引用',
        description: '引用文本',
        icon: Quote,
        keywords: ['blockquote', 'quote'],
        command: commands.quote,
      },
      {
        id: 'divider',
        label: '分隔线',
        description: '水平分隔',
        icon: Minus,
        keywords: ['hr', 'divider'],
        command: commands.horizontalRule,
      },
      {
        id: 'details',
        label: '折叠块',
        description: '可折叠的内容区域',
        icon: ChevronDown,
        keywords: ['details', 'summary', 'collapse', 'toggle', '折叠'],
        command: insertDetails,
      },
    ],
  },
  {
    id: 'media',
    label: '媒体与嵌入',
    items: [
      {
        id: 'link',
        label: '链接',
        description: '添加超链接',
        icon: Link,
        keywords: ['link', 'url'],
        command: commands.link,
      },
      {
        id: 'image',
        label: '图片',
        description: '插入图片',
        icon: Image,
        keywords: ['image', 'img'],
        command: insertImage,
      },
      {
        id: 'table',
        label: '表格',
        description: '插入表格',
        icon: Table,
        keywords: ['table', 'grid'],
        command: insertTable,
      },
      {
        id: 'math',
        label: '数学公式',
        description: 'LaTeX 公式',
        icon: Sigma,
        keywords: ['math', 'formula', 'latex'],
        command: insertMathBlock,
      },
    ],
  },
]

export interface SlashMenuItemWithGroup extends SlashMenuItem {
  groupId: string
  groupLabel: string
  icon?: SlashMenuIcon
}

export const slashMenuItems: SlashMenuItemWithGroup[] = slashMenuGroups.flatMap(
  (group) =>
    group.items.map((item) => ({
      ...item,
      groupId: group.id,
      groupLabel: group.label,
    })),
)
