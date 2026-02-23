// Complex document fixture inspired by diff-samples patterns.
// Covers: banner, alertQuote (nested editor content), details, table,
// code-block, image, mermaid (chunk separators), formatted text.

const t = (text: string, format = 0) => ({
  type: 'text',
  text,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const p = (...children: any[]) => ({
  type: 'paragraph',
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  textFormat: 0,
  textStyle: '',
})

const h = (tag: string, ...children: any[]) => ({
  type: 'heading',
  tag,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

const li = (value: number, ...children: any[]) => ({
  type: 'listitem',
  children,
  value,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

const ul = (...items: any[]) => ({
  type: 'list',
  listType: 'bullet',
  children: items,
  direction: 'ltr',
  format: '',
  indent: 0,
  start: 1,
  tag: 'ul',
  version: 1,
})

const ol = (...items: any[]) => ({
  type: 'list',
  listType: 'number',
  children: items,
  direction: 'ltr',
  format: '',
  indent: 0,
  start: 1,
  tag: 'ol',
  version: 1,
})

const linkNode = (url: string, ...children: any[]) => ({
  type: 'link',
  url,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  rel: 'noopener',
  target: null,
  version: 1,
})

const nestedEditor = (...children: any[]) => ({
  root: {
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

const BOLD = 1
const ITALIC = 2
const STRIKETHROUGH = 4
const CODE = 16

export const complexDocData = {
  root: {
    children: [
      // ── Chunk 0: heading + banner + paragraph + heading + formatted paragraph + list ──
      h('h1', t('Building a Modern Editor')),
      {
        type: 'banner',
        bannerType: 'tip',
        content: nestedEditor(p(t('This guide was updated in December 2025.'))),
        version: 1,
      },
      p(
        t('This guide covers '),
        t('architecture', BOLD),
        t(', '),
        t('performance', ITALIC),
        t(', and '),
        t('deployment', CODE),
        t('.'),
      ),
      h('h2', t('Why Choose Lexical')),
      p(
        t('Compared to '),
        t('ProseMirror', CODE),
        t(' and '),
        t('Slate', CODE),
        t(', Lexical offers a '),
        t('type-safe node system', BOLD),
        t(' with predictable serialization.'),
      ),
      ul(
        li(1, t('Lightweight core (~22KB)')),
        li(2, t('Native collaboration via Yjs')),
        li(3, t('Full accessibility support')),
        li(4, t('TypeScript-first design')),
      ),

      // ── code-block → chunk break ──
      {
        type: 'code-block',
        language: 'typescript',
        code: 'const editor = createHeadlessEditor({ nodes: allHeadlessNodes })',
        version: 1,
      },

      // ── Chunk 1: heading + paragraph + ordered list + quote ──
      h('h2', t('Architecture Overview')),
      p(t('The system is organized into three layers:')),
      ol(
        li(1, t('Core'), t(' — manages the immutable state tree')),
        li(2, t('Nodes'), t(' — define document structure')),
        li(3, t('Plugins'), t(' — implement editor features')),
      ),
      {
        type: 'quote',
        children: [t('Lexical is designed to be framework-agnostic.', ITALIC)],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },

      // ── image → chunk break ──
      {
        type: 'image',
        src: 'https://example.com/architecture-diagram.png',
        altText: 'Architecture diagram',
        caption: 'Three-layer architecture',
        width: 800,
        height: 600,
        version: 1,
      },

      // ── Chunk 2: heading + paragraph + alertQuote ──
      h('h2', t('Performance Tips')),
      p(
        t('Batch DOM updates reduced reconciler overhead by '),
        t('~40%', BOLD),
        t('. Always use '),
        t('EditorState.read()', CODE),
        t(' for read-only operations.'),
      ),
      {
        type: 'alert-quote',
        alertType: 'warning',
        content: nestedEditor(
          p(
            t('Always normalize data before processing. '),
            t('Skipping this step causes gradient issues.', BOLD),
          ),
        ),
        version: 1,
      },

      // ── mermaid → chunk break ──
      {
        type: 'mermaid',
        diagram: 'graph TD\n  A[Input] --> B[Process]\n  B --> C[Output]',
        version: 1,
      },

      // ── Chunk 3: heading + paragraph + list ──
      h('h2', t('Deployment Checklist')),
      p(t('Before deploying to production:')),
      ol(
        li(1, t('Run '), t('pnpm build', CODE)),
        li(2, t('Verify bundle size')),
        li(3, t('Test SSR rendering')),
        li(4, t('Check accessibility score')),
      ),

      // ── details → chunk break (text inside NOT collected) ──
      {
        type: 'details',
        summary: 'Advanced configuration',
        open: false,
        children: [p(t('Hidden advanced config details.'))],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },

      // ── Chunk 4: heading + paragraph + alertQuote ──
      h('h2', t('Migration Guide')),
      p(
        t('To upgrade from v2.x, replace '),
        t('legacyMode', CODE),
        t(' with '),
        t('compatMode', CODE),
        t('. See '),
        linkNode('https://docs.example.com/migration', t('migration docs')),
        t(' for details.'),
      ),
      {
        type: 'alert-quote',
        alertType: 'important',
        content: nestedEditor(
          p(
            t('Test thoroughly after upgrading — '),
            t('breaking changes', STRIKETHROUGH),
            t(' behavioral changes may affect your plugins.'),
          ),
        ),
        version: 1,
      },

      // ── table → chunk break ──
      {
        type: 'table',
        children: [
          {
            type: 'tablerow',
            children: [
              {
                type: 'tablecell',
                children: [p(t('Version', BOLD))],
                headerState: 1,
                colSpan: 1,
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
                width: null,
              },
              {
                type: 'tablecell',
                children: [p(t('Changes', BOLD))],
                headerState: 1,
                colSpan: 1,
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
                width: null,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
          {
            type: 'tablerow',
            children: [
              {
                type: 'tablecell',
                children: [p(t('v3.0'))],
                headerState: 0,
                colSpan: 1,
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
                width: null,
              },
              {
                type: 'tablecell',
                children: [p(t('Node separation'))],
                headerState: 0,
                colSpan: 1,
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
                width: null,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },

      // ── horizontalrule → chunk break ──
      { type: 'horizontalrule', version: 1 },

      // ── Chunk 5: heading + paragraph + list ──
      h('h2', t('Conclusion')),
      p(
        t('Lexical is a '),
        t('production-ready', BOLD),
        t(' framework for building rich text editors.'),
      ),
      ul(
        li(1, linkNode('https://lexical.dev', t('Official Documentation'))),
        li(
          2,
          linkNode(
            'https://github.com/facebook/lexical',
            t('GitHub Repository'),
          ),
        ),
      ),
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
}

export const COMPLEX_EN_TO_ZH: Record<string, string> = {
  // ── Chunk 0 ──
  'Building a Modern Editor': '构建现代编辑器',
  'This guide was updated in December 2025.': '本指南于 2025 年 12 月更新。',
  'This guide covers ': '本指南涵盖',
  architecture: '架构',
  ', ': '，',
  performance: '性能',
  ', and ': '，以及',
  deployment: '部署',
  '.': '。',
  'Why Choose Lexical': '为什么选择 Lexical',
  'Compared to ': '相较于 ',
  ProseMirror: 'ProseMirror',
  ' and ': '和',
  Slate: 'Slate',
  ', Lexical offers a ': '，Lexical 提供了',
  'type-safe node system': '类型安全的节点系统',
  ' with predictable serialization.': '，具有可预测的序列化行为。',
  'Lightweight core (~22KB)': '轻量核心（~22KB）',
  'Native collaboration via Yjs': '通过 Yjs 原生协作',
  'Full accessibility support': '完善的无障碍支持',
  'TypeScript-first design': 'TypeScript 优先设计',

  // ── Chunk 1 ──
  'Architecture Overview': '架构概览',
  'The system is organized into three layers:': '系统分为三层：',
  Core: '核心层',
  ' — manages the immutable state tree': ' — 管理不可变状态树',
  Nodes: '节点层',
  ' — define document structure': ' — 定义文档结构',
  Plugins: '插件层',
  ' — implement editor features': ' — 实现编辑器功能',
  'Lexical is designed to be framework-agnostic.':
    'Lexical 的设计是框架无关的。',

  // ── Chunk 2 ──
  'Performance Tips': '性能建议',
  'Batch DOM updates reduced reconciler overhead by ':
    '批量 DOM 更新将协调器开销减少了 ',
  '~40%': '~40%',
  '. Always use ': '。始终使用 ',
  'EditorState.read()': 'EditorState.read()',
  ' for read-only operations.': ' 进行只读操作。',
  'Always normalize data before processing. ': '处理前务必进行数据归一化。',
  'Skipping this step causes gradient issues.': '跳过此步骤会导致梯度问题。',

  // ── Chunk 3 ──
  'Deployment Checklist': '部署清单',
  'Before deploying to production:': '部署到生产环境前：',
  'Run ': '运行 ',
  'pnpm build': 'pnpm build',
  'Verify bundle size': '验证包体积',
  'Test SSR rendering': '测试 SSR 渲染',
  'Check accessibility score': '检查无障碍评分',

  // ── Details (now collected in chunk before it) ──
  'Hidden advanced config details.': '隐藏的高级配置详情。',

  // ── Chunk 4 ──
  'Migration Guide': '迁移指南',
  'To upgrade from v2.x, replace ': '从 v2.x 升级，请将 ',
  legacyMode: 'legacyMode',
  ' with ': ' 替换为 ',
  compatMode: 'compatMode',
  '. See ': '。参见 ',
  'migration docs': '迁移文档',
  ' for details.': ' 了解详情。',
  'Test thoroughly after upgrading — ': '升级后请全面测试 — ',
  'breaking changes': '破坏性变更',
  ' behavioral changes may affect your plugins.': ' 行为变更可能影响你的插件。',

  // ── Table (now collected in chunk before hr) ──
  Version: '版本',
  Changes: '变更',
  'v3.0': 'v3.0',
  'Node separation': '节点分离',

  // ── Chunk 5 ──
  Conclusion: '总结',
  'Lexical is a ': 'Lexical 是一个',
  'production-ready': '生产就绪的',
  ' framework for building rich text editors.': '富文本编辑器框架。',
  'Official Documentation': '官方文档',
  'GitHub Repository': 'GitHub 仓库',

  // ── Details summary (PropertySegment) ──
  'Advanced configuration': '高级配置',

  // ── Meta fields ──
  'A comprehensive guide to building editors with Lexical':
    '使用 Lexical 构建编辑器的综合指南',
  'editor|||lexical|||guide': '编辑器|||Lexical|||指南',
}
