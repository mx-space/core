import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AiService } from '~/modules/ai/ai.service'
import { AiInFlightService } from '~/modules/ai/ai-inflight/ai-inflight.service'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { AITranslationModel } from '~/modules/ai/ai-translation/ai-translation.model'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { parseLexicalForTranslation } from '~/modules/ai/ai-translation/lexical-translation-parser'
import { LexicalTranslationStrategy } from '~/modules/ai/ai-translation/strategies/lexical-translation.strategy'
import { MarkdownTranslationStrategy } from '~/modules/ai/ai-translation/strategies/markdown-translation.strategy'
import { TranslationConsistencyService } from '~/modules/ai/ai-translation/translation-consistency.service'
import type { ITranslationStrategy } from '~/modules/ai/ai-translation/translation-strategy.interface'
import {
  LEXICAL_TRANSLATION_STRATEGY,
  MARKDOWN_TRANSLATION_STRATEGY,
} from '~/modules/ai/ai-translation/translation-strategy.interface'
import type { IModelRuntime } from '~/modules/ai/runtime'
import { ConfigsService } from '~/modules/configs/configs.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { TaskQueueProcessor } from '~/processors/task-queue'
import { ContentFormat } from '~/shared/types/content-format.type'
import { getModelToken } from '~/transformers/model.transformer'

import { COMPLEX_EN_TO_ZH, complexDocData } from './complex-doc-data'
import { lexicalData } from './real-world-lexical-data'

const EN_TO_ZH: Record<string, string> = {
  'Enhanced Renderers Demo': '增强渲染器演示',
  'This preset showcases the enhanced renderers from standalone packages: ':
    '此预设展示了来自独立包的增强渲染器：',
  '@shiro/rich-renderer-codeblock': '@shiro/rich-renderer-codeblock',
  '@shiro/rich-renderer-image': '@shiro/rich-renderer-image',
  '@shiro/rich-renderer-video': '@shiro/rich-renderer-video',
  '@shiro/rich-renderer-linkcard': '@shiro/rich-renderer-linkcard',
  '@shiro/rich-renderer-gallery': '@shiro/rich-renderer-gallery',
  '@shiro/rich-renderer-mermaid': '@shiro/rich-renderer-mermaid',
  ', ': '，',
  ', and ': '，以及',
  '.': '。',
  'CodeBlock Renderer': '代码块渲染器',
  'Migrated from web code-highlighter: language badge, copy action, Shiki highlight and long-code collapse.':
    '从 web code-highlighter 迁移：语言标签、复制操作、Shiki 高亮和长代码折叠。',
  'Image Renderer': '图片渲染器',
  'Migrated from web zoom-image: blurhash placeholder, loading transition and click-to-zoom viewer.':
    '从 web zoom-image 迁移：blurhash 占位图、加载过渡和点击缩放查看器。',
  'Video Renderer': '视频渲染器',
  'Migrated from web VideoPlayer: click-to-play overlay, seek/volume controls, fullscreen and download.':
    '从 web VideoPlayer 迁移：点击播放遮罩、进度/音量控制、全屏和下载。',
  'LinkCard with Plugin System': '链接卡片与插件系统',
  'The enhanced LinkCard renderer features a plugin system for dynamic fetching, spotlight hover effects, and platform-specific styling.':
    '增强的链接卡片渲染器具有动态获取插件系统、聚光灯悬停效果和平台特定样式。',
  'More LinkCard examples with different platforms:':
    '更多不同平台的链接卡片示例：',
  'Gallery Renderer': '画廊渲染器',
  'The enhanced Gallery renderer supports multiple layouts, carousel mode with autoplay, and photo zoom via ':
    '增强的画廊渲染器支持多种布局、带自动播放的轮播模式以及通过 ',
  'react-photo-view': 'react-photo-view',
  'Grid Layout': '网格布局',
  'Carousel Layout with Autoplay': '带自动播放的轮播布局',
  'Carousel mode features bi-directional autoplay, navigation buttons, and smooth scrolling.':
    '轮播模式具有双向自动播放、导航按钮和平滑滚动。',
  'Masonry Layout': '瀑布流布局',
  'Remote Component': '远程组件',
  'The Component node loads remote React components via DLS descriptors. The default renderer shows parsed metadata; override via ':
    '组件节点通过 DLS 描述符加载远程 React 组件。默认渲染器显示解析后的元数据；通过 ',
  'RendererConfig.Component': 'RendererConfig.Component',
  ' for actual script loading.': ' 实现实际脚本加载。',
  'Mermaid Renderer': 'Mermaid 渲染器',
  'Features Summary': '功能总结',
  'CodeBlock: ': '代码块：',
  'Language badge + copy + collapse': '语言标签 + 复制 + 折叠',
  'Image: ': '图片：',
  'Blurhash placeholder + zoom viewer': 'Blurhash 占位图 + 缩放查看器',
  'Video: ': '视频：',
  'Custom controls with seek/volume/fullscreen': '自定义控制：进度/音量/全屏',
  'LinkCard: ': '链接卡片：',
  'Plugin system for dynamic fetching': '动态获取插件系统',
  'Spotlight hover effects': '聚光灯悬停效果',
  'Platform-specific styling': '平台特定样式',
  'Gallery: ': '画廊：',
  'Carousel with bi-directional autoplay': '双向自动播放轮播',
  'Photo zoom lightbox': '照片缩放灯箱',
  'Grid, Masonry, Carousel layouts': '网格、瀑布流、轮播布局',
  'Mermaid: ': 'Mermaid：',
  'Runtime diagram rendering with theme switch': '运行时图表渲染与主题切换',
  'Click on any gallery image to open the photo viewer!':
    '点击任意画廊图片即可打开照片查看器！',
  'A demo showcasing enhanced renderers': '展示增强渲染器的演示文档',
  'demo|||lexical|||renderer': '演示|||Lexical|||渲染器',
}

// Recursively assert two JSON trees have identical structure.
// Only text node `.text`, details `.summary`, and footnote-section `.definitions` may differ.
function assertShapeMatch(original: any, translated: any, path = 'root'): void {
  if (original === null || original === undefined) {
    expect(translated, `${path}: nullity mismatch`).toEqual(original)
    return
  }
  if (typeof original !== typeof translated) {
    throw new TypeError(
      `${path}: type mismatch ${typeof original} vs ${typeof translated}`,
    )
  }
  if (Array.isArray(original)) {
    expect(Array.isArray(translated), `${path}: array mismatch`).toBe(true)
    expect(translated.length, `${path}: array length`).toBe(original.length)
    for (const [i, origItem] of original.entries()) {
      assertShapeMatch(origItem, translated[i], `${path}[${i}]`)
    }
    return
  }
  if (typeof original === 'object') {
    const origKeys = Object.keys(original).sort()
    const transKeys = Object.keys(translated).sort()
    expect(transKeys, `${path}: keys mismatch`).toEqual(origKeys)
    for (const key of origKeys) {
      if (key === 'text' && original.type === 'text') continue
      if (key === 'summary' && original.type === 'details') continue
      if (key === 'definitions' && original.type === 'footnote-section')
        continue
      assertShapeMatch(original[key], translated[key], `${path}.${key}`)
    }
    return
  }
  expect(translated, `${path}: value mismatch`).toEqual(original)
}

describe('translateLexicalContent (real-world data)', () => {
  let lexicalStrategy: ITranslationStrategy

  beforeEach(async () => {
    const mockLexicalService = {
      lexicalToMarkdown: vi.fn().mockReturnValue('[markdown placeholder]'),
      extractRootBlocks: vi.fn((content: string) => {
        try {
          const parsed = JSON.parse(content)
          const children = parsed?.root?.children ?? []
          return children.map((child: any, index: number) => ({
            id: child?.$?.blockId ?? '',
            type: child?.type ?? 'unknown',
            text: '',
            fingerprint: `fp_${index}`,
            index,
          }))
        } catch {
          return []
        }
      }),
    }

    const module = await Test.createTestingModule({
      providers: [
        AiTranslationService,
        {
          provide: getModelToken(AITranslationModel.name),
          useValue: {
            findOne: vi.fn(),
            find: vi.fn(),
            findById: vi.fn(),
            create: vi.fn(),
            deleteOne: vi.fn(),
            deleteMany: vi.fn(),
            aggregate: vi.fn(),
          },
        },
        { provide: DatabaseService, useValue: { findGlobalById: vi.fn() } },
        {
          provide: ConfigsService,
          useValue: {
            get: vi.fn().mockResolvedValue({
              enableTranslation: true,
              translationTargetLanguages: ['zh'],
            }),
          },
        },
        {
          provide: AiService,
          useValue: { getTranslationModelWithInfo: vi.fn() },
        },
        { provide: AiInFlightService, useValue: { runWithStream: vi.fn() } },
        { provide: EventManagerService, useValue: { emit: vi.fn() } },
        { provide: TaskQueueProcessor, useValue: { registerHandler: vi.fn() } },
        {
          provide: AiTaskService,
          useValue: {
            crud: { createTask: vi.fn() },
            createTranslationTask: vi.fn(),
          },
        },
        { provide: LexicalService, useValue: mockLexicalService },
        {
          provide: TranslationConsistencyService,
          useValue: {
            partitionValidAndStaleTranslations: vi.fn(),
            buildValidationSelect: vi.fn(),
            filterTrulyStaleTranslations: vi.fn(),
          },
        },
        {
          provide: LEXICAL_TRANSLATION_STRATEGY,
          useClass: LexicalTranslationStrategy,
        },
        {
          provide: MARKDOWN_TRANSLATION_STRATEGY,
          useClass: MarkdownTranslationStrategy,
        },
      ],
    }).compile()

    lexicalStrategy = module.get(LEXICAL_TRANSLATION_STRATEGY)
  })

  it('should parse real data into expected segment structure', () => {
    const json = JSON.stringify(lexicalData)
    const { segments } = parseLexicalForTranslation(json)

    // All translatable text collected as flat segments
    expect(segments.length).toBeGreaterThanOrEqual(10)

    // First segment is h1 title
    expect(segments[0].text).toBe('Enhanced Renderers Demo')

    // All text nodes have unique IDs
    const allIds = segments.map((s) => s.id)
    expect(new Set(allIds).size).toBe(allIds.length)

    // Inline code segments marked non-translatable
    const codeSegs = segments.filter((s) => !s.translatable)
    expect(codeSegs.length).toBeGreaterThan(0)
  })

  it('should translate real-world lexical content to Chinese with mocked AI', async () => {
    const editorStateJson = JSON.stringify(lexicalData)
    const content = {
      title: 'Enhanced Renderers Demo',
      text: '',
      summary: 'A demo showcasing enhanced renderers',
      tags: ['demo', 'lexical', 'renderer'],
      contentFormat: ContentFormat.Lexical,
      content: editorStateJson,
    }

    const mockRuntime = {
      generateText: vi.fn(
        async ({
          messages,
        }: {
          messages: Array<{ role: string; content: string }>
        }) => {
          const userPrompt = messages[1].content
          const segmentsSection = userPrompt.split(
            '## Segments to translate\n',
          )[1]
          const segments = JSON.parse(segmentsSection) as Record<string, string>

          const translations: Record<string, string> = {}
          for (const [id, text] of Object.entries(segments)) {
            translations[id] = EN_TO_ZH[text] ?? text
          }

          return {
            text: JSON.stringify({ sourceLang: 'en', translations }),
          }
        },
      ),
    }

    const tokenCount = { value: 0 }
    const onToken = vi.fn(async () => {
      tokenCount.value++
    })

    const result = await lexicalStrategy.translate(
      content,
      'zh',
      mockRuntime as unknown as IModelRuntime,
      { model: 'test-model', provider: 'test-provider' },
      { onToken },
    )

    // ── Verify return shape ──
    expect(result.sourceLang).toBe('en')
    expect(result.title).toBe('增强渲染器演示')
    expect(result.summary).toBe('展示增强渲染器的演示文档')
    expect(result.tags).toEqual(['演示', 'Lexical', '渲染器'])
    expect(result.contentFormat).toBe(ContentFormat.Lexical)
    expect(result.aiModel).toBe('test-model')
    expect(result.aiProvider).toBe('test-provider')

    // ── Verify translated JSON structure ──
    const translated = JSON.parse(result.content)
    const rootChildren = translated.root.children

    // h1: "增强渲染器演示"
    expect(rootChildren[0].type).toBe('heading')
    expect(rootChildren[0].children[0].text).toBe('增强渲染器演示')

    // paragraph with inline code: text translated, code unchanged
    const para1 = rootChildren[1]
    expect(para1.type).toBe('paragraph')
    expect(para1.children[0].text).toBe('此预设展示了来自独立包的增强渲染器：')
    // inline code nodes preserved (non-translatable, original text kept)
    expect(para1.children[1].text).toBe('@shiro/rich-renderer-codeblock')
    expect(para1.children[1].format).toBe(16)

    // h2: "代码块渲染器"
    expect(rootChildren[2].children[0].text).toBe('代码块渲染器')

    // code-block: structure unchanged (skipped entirely)
    const codeBlock = rootChildren.find((n: any) => n.type === 'code-block')
    expect(codeBlock).toBeDefined()
    expect(codeBlock.language).toBe('typescript')

    // image: untouched
    const imageNode = rootChildren.find((n: any) => n.type === 'image')
    expect(imageNode).toBeDefined()
    expect(imageNode.src).toBe('https://picsum.photos/1280/768?random=401')

    // video: untouched
    const videoNode = rootChildren.find((n: any) => n.type === 'video')
    expect(videoNode).toBeDefined()

    // link-card: untouched
    const linkCard = rootChildren.find((n: any) => n.type === 'link-card')
    expect(linkCard).toBeDefined()
    expect(linkCard.url).toBe('https://github.com/facebook/react')

    // gallery: untouched
    const gallery = rootChildren.find(
      (n: any) => n.type === 'gallery' && n.layout === 'grid',
    )
    expect(gallery).toBeDefined()

    // Features Summary heading
    const featuresSummaryIdx = rootChildren.findIndex(
      (n: any) => n.type === 'heading' && n.children?.[0]?.text === '功能总结',
    )
    expect(featuresSummaryIdx).toBeGreaterThan(0)

    // Features list: translated items
    const featuresList = rootChildren[featuresSummaryIdx + 1]
    expect(featuresList.type).toBe('list')
    const firstItem = featuresList.children[0]
    const firstItemPara = firstItem.children[0]
    expect(firstItemPara.children[0].text).toBe('代码块：')
    expect(firstItemPara.children[1].text).toBe('语言标签 + 复制 + 折叠')
    expect(firstItemPara.children[1].format).toBe(1)

    // alert-quote: nested text translated
    const alertQuote = rootChildren.find((n: any) => n.type === 'alert-quote')
    expect(alertQuote).toBeDefined()
    expect(alertQuote.content.root.children[0].children[0].text).toBe(
      '点击任意画廊图片即可打开照片查看器！',
    )

    // ── Verify AI was called (token-budget batching → likely 1 batch) ──
    expect(mockRuntime.generateText).toHaveBeenCalled()

    // ── Verify first call included meta entries ──
    const firstCallPrompt =
      mockRuntime.generateText.mock.calls[0][0].messages[1].content
    expect(firstCallPrompt).toContain('__title__')
    expect(firstCallPrompt).toContain('__summary__')
    expect(firstCallPrompt).toContain('__tags__')

    // ── Verify prompt uses document context format ──
    expect(firstCallPrompt).toContain('## Document context')
    expect(firstCallPrompt).toContain('## Segments to translate')

    // onToken is only called in streaming path; generateText path does not invoke it
    expect(onToken).not.toHaveBeenCalled()

    // ── Verify structural shape identical (only text values differ) ──
    assertShapeMatch(lexicalData, translated)

    expect(rootChildren).toMatchSnapshot()
  })

  it('should handle streaming runtime variant', async () => {
    const editorStateJson = JSON.stringify(lexicalData)
    const content = {
      title: 'Enhanced Renderers Demo',
      text: '',
      summary: null,
      tags: [] as string[],
      contentFormat: ContentFormat.Lexical,
      content: editorStateJson,
    }

    const mockRuntime = {
      generateTextStream: vi.fn(async function* ({
        messages,
      }: {
        messages: Array<{ role: string; content: string }>
      }) {
        const userPrompt = messages[1].content
        const segmentsSection = userPrompt.split(
          '## Segments to translate\n',
        )[1]
        const segments = JSON.parse(segmentsSection) as Record<string, string>

        const translations: Record<string, string> = {}
        for (const [id, text] of Object.entries(segments)) {
          translations[id] = EN_TO_ZH[text] ?? text
        }

        const fullJson = JSON.stringify({
          sourceLang: 'en',
          translations,
        })

        const chunkSize = 50
        for (let i = 0; i < fullJson.length; i += chunkSize) {
          yield { text: fullJson.slice(i, i + chunkSize) }
        }
      }),
    }

    const result = await lexicalStrategy.translate(
      content,
      'zh',
      mockRuntime as unknown as IModelRuntime,
      { model: 'stream-model', provider: 'stream-provider' },
      {},
    )

    expect(result.sourceLang).toBe('en')
    expect(result.title).toBe('增强渲染器演示')
    expect(result.summary).toBeNull()
    expect(result.tags).toEqual([])

    const translated = JSON.parse(result.content)
    expect(translated.root.children[0].children[0].text).toBe('增强渲染器演示')

    assertShapeMatch(lexicalData, translated)
  })

  it('should translate complex doc with banner, alertQuote, details, table, mermaid', async () => {
    const editorStateJson = JSON.stringify(complexDocData)
    const content = {
      title: 'Building a Modern Editor',
      text: '',
      summary: 'A comprehensive guide to building editors with Lexical',
      tags: ['editor', 'lexical', 'guide'],
      contentFormat: ContentFormat.Lexical,
      content: editorStateJson,
    }

    const mockRuntime = {
      generateText: vi.fn(
        async ({
          messages,
        }: {
          messages: Array<{ role: string; content: string }>
        }) => {
          const userPrompt = messages[1].content
          const segmentsSection = userPrompt.split(
            '## Segments to translate\n',
          )[1]
          const segments = JSON.parse(segmentsSection) as Record<string, string>

          const translations: Record<string, string> = {}
          for (const [id, text] of Object.entries(segments)) {
            translations[id] = COMPLEX_EN_TO_ZH[text] ?? text
          }

          return {
            text: JSON.stringify({ sourceLang: 'en', translations }),
          }
        },
      ),
    }

    const result = await lexicalStrategy.translate(
      content,
      'zh',
      mockRuntime as unknown as IModelRuntime,
      { model: 'test-model', provider: 'test-provider' },
      {},
    )

    expect(result.sourceLang).toBe('en')
    expect(result.title).toBe('构建现代编辑器')
    expect(result.summary).toBe('使用 Lexical 构建编辑器的综合指南')
    expect(result.tags).toEqual(['编辑器', 'Lexical', '指南'])
    expect(result.contentFormat).toBe(ContentFormat.Lexical)

    const translated = JSON.parse(result.content)
    const rootChildren = translated.root.children

    // h1 translated
    expect(rootChildren[0].children[0].text).toBe('构建现代编辑器')

    // banner nested content translated
    const bannerNode = rootChildren[1]
    expect(bannerNode.type).toBe('banner')
    expect(bannerNode.content.root.children[0].children[0].text).toBe(
      '本指南于 2025 年 12 月更新。',
    )

    // formatted paragraph: bold text translated, format preserved
    const formattedPara = rootChildren[2]
    expect(formattedPara.children[1].text).toBe('架构')
    expect(formattedPara.children[1].format).toBe(1) // bold

    // code-block unchanged
    const codeBlock = rootChildren.find((n: any) => n.type === 'code-block')
    expect(codeBlock).toBeDefined()
    expect(codeBlock.language).toBe('typescript')
    expect(codeBlock.code).toContain('createHeadlessEditor')

    // image unchanged
    const imageNode = rootChildren.find((n: any) => n.type === 'image')
    expect(imageNode).toBeDefined()
    expect(imageNode.src).toBe('https://example.com/architecture-diagram.png')

    // alert-quote nested content translated
    const alertQuote = rootChildren.find(
      (n: any) => n.type === 'alert-quote' && n.alertType === 'warning',
    )
    expect(alertQuote).toBeDefined()
    expect(alertQuote.content.root.children[0].children[0].text).toBe(
      '处理前务必进行数据归一化。',
    )

    // mermaid unchanged
    const mermaidNode = rootChildren.find((n: any) => n.type === 'mermaid')
    expect(mermaidNode).toBeDefined()
    expect(mermaidNode.diagram).toContain('graph TD')

    // details content translated
    const detailsNode = rootChildren.find((n: any) => n.type === 'details')
    expect(detailsNode).toBeDefined()
    expect(detailsNode.children[0].children[0].text).toBe(
      '隐藏的高级配置详情。',
    )
    // details.summary translated (PropertySegment)
    expect(detailsNode.summary).toBe('高级配置')

    // table content translated
    const tableNode = rootChildren.find((n: any) => n.type === 'table')
    expect(tableNode).toBeDefined()
    const firstHeaderCell =
      tableNode.children[0].children[0].children[0].children[0]
    expect(firstHeaderCell.text).toBe('版本')

    // horizontalrule unchanged
    const hr = rootChildren.find((n: any) => n.type === 'horizontalrule')
    expect(hr).toBeDefined()

    // Conclusion heading translated
    const conclusionIdx = rootChildren.findIndex(
      (n: any) => n.type === 'heading' && n.children?.[0]?.text === '总结',
    )
    expect(conclusionIdx).toBeGreaterThan(0)

    // Links in list: text translated, URL unchanged
    const conclusionList = rootChildren[conclusionIdx + 2]
    expect(conclusionList.type).toBe('list')
    const firstLink = conclusionList.children[0].children[0]
    expect(firstLink.type).toBe('link')
    expect(firstLink.url).toBe('https://lexical.dev')
    expect(firstLink.children[0].text).toBe('官方文档')

    // AI called (token-budget batching)
    expect(mockRuntime.generateText).toHaveBeenCalled()

    // First call includes meta
    const firstCallPrompt =
      mockRuntime.generateText.mock.calls[0][0].messages[1].content
    expect(firstCallPrompt).toContain('__title__')
    expect(firstCallPrompt).toContain('__summary__')
    expect(firstCallPrompt).toContain('__tags__')

    // Structural shape match (allows summary/definitions to differ)
    assertShapeMatch(complexDocData, translated)
  })
})

describe('incremental translation', () => {
  let lexicalStrategy: ITranslationStrategy

  const makeEditorState = (children: any[]) =>
    JSON.stringify({ root: { children, type: 'root', direction: 'ltr' } })

  const textNode = (text: string, format = 0) => ({
    type: 'text',
    text,
    format,
    detail: 0,
    mode: 'normal',
    style: '',
  })

  const paragraph = (blockId: string, ...children: any[]) => ({
    type: 'paragraph',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    $: { blockId },
  })

  const heading = (blockId: string, tag: string, ...children: any[]) => ({
    type: 'heading',
    tag,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    $: { blockId },
  })

  const createMockRuntime = (translations: Record<string, string>) => ({
    generateText: vi.fn(
      async ({
        messages,
      }: {
        messages: Array<{ role: string; content: string }>
      }) => {
        const userPrompt = messages[1].content
        const segmentsSection = userPrompt.split(
          '## Segments to translate\n',
        )[1]
        const segments = JSON.parse(segmentsSection) as Record<string, string>

        const result: Record<string, string> = {}
        for (const [id, text] of Object.entries(segments)) {
          result[id] = translations[text] ?? `[TR]${text}`
        }

        return {
          text: JSON.stringify({ sourceLang: 'zh', translations: result }),
        }
      },
    ),
  })

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiTranslationService,
        {
          provide: getModelToken(AITranslationModel.name),
          useValue: {
            findOne: vi.fn(),
            find: vi.fn(),
            findById: vi.fn(),
            create: vi.fn(),
            deleteOne: vi.fn(),
            deleteMany: vi.fn(),
            aggregate: vi.fn(),
          },
        },
        { provide: DatabaseService, useValue: { findGlobalById: vi.fn() } },
        {
          provide: ConfigsService,
          useValue: {
            get: vi.fn().mockResolvedValue({
              enableTranslation: true,
              translationTargetLanguages: ['en'],
            }),
          },
        },
        {
          provide: AiService,
          useValue: { getTranslationModelWithInfo: vi.fn() },
        },
        { provide: AiInFlightService, useValue: { runWithStream: vi.fn() } },
        { provide: EventManagerService, useValue: { emit: vi.fn() } },
        { provide: TaskQueueProcessor, useValue: { registerHandler: vi.fn() } },
        {
          provide: AiTaskService,
          useValue: {
            crud: { createTask: vi.fn() },
            createTranslationTask: vi.fn(),
          },
        },
        { provide: LexicalService, useClass: LexicalService },
        {
          provide: TranslationConsistencyService,
          useValue: {
            partitionValidAndStaleTranslations: vi.fn(),
            buildValidationSelect: vi.fn(),
            filterTrulyStaleTranslations: vi.fn(),
          },
        },
        {
          provide: LEXICAL_TRANSLATION_STRATEGY,
          useClass: LexicalTranslationStrategy,
        },
        {
          provide: MARKDOWN_TRANSLATION_STRATEGY,
          useClass: MarkdownTranslationStrategy,
        },
      ],
    }).compile()

    lexicalStrategy = module.get(LEXICAL_TRANSLATION_STRATEGY)
  })

  it('second pass with one changed paragraph: only changed block enters AI input', async () => {
    // First pass: full translation
    const originalContent = makeEditorState([
      heading('blk-h1', 'h1', textNode('标题')),
      paragraph('blk-p1', textNode('段落一')),
      paragraph('blk-p2', textNode('段落二')),
    ])

    const mockRuntime = createMockRuntime({})
    const info = { model: 'test', provider: 'test' }

    const firstResult = await lexicalStrategy.translate(
      {
        title: '标题',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: originalContent,
      },
      'en',
      mockRuntime as unknown as IModelRuntime,
      info,
      {},
    )

    // Build snapshots from original content
    const lexicalService = new LexicalService()
    const snapshots = lexicalService
      .extractRootBlocks(originalContent)
      .map((b: any) => ({
        id: b.id ?? '',
        fingerprint: b.fingerprint,
        type: b.type,
        index: b.index,
      }))

    // Second pass: change only paragraph 2
    const modifiedContent = makeEditorState([
      heading('blk-h1', 'h1', textNode('标题')),
      paragraph('blk-p1', textNode('段落一')),
      paragraph('blk-p2', textNode('段落二已修改')),
    ])

    const mockRuntime2 = createMockRuntime({})
    mockRuntime2.generateText.mockClear()

    const existing = {
      sourceLang: 'zh',
      title: firstResult.title,
      text: firstResult.text,
      content: firstResult.content,
      contentFormat: ContentFormat.Lexical,
      summary: undefined,
      tags: undefined,
      sourceBlockSnapshots: snapshots,
      sourceMetaHashes: {
        title: (await import('~/utils/tool.util')).md5('标题'),
      },
    } as any

    const secondResult = await lexicalStrategy.translate(
      {
        title: '标题',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: modifiedContent,
      },
      'en',
      mockRuntime2 as unknown as IModelRuntime,
      info,
      { existing },
    )

    // Only the changed block's text should appear in AI input
    expect(mockRuntime2.generateText).toHaveBeenCalled()
    const aiInput =
      mockRuntime2.generateText.mock.calls[0][0].messages[1].content
    expect(aiInput).toContain('段落二已修改')
    expect(aiInput).not.toContain('__title__')

    // Result should have translated content
    expect(secondResult.content).toBeTruthy()
    const translated = JSON.parse(secondResult.content)
    expect(translated.root.children).toHaveLength(3)
  })

  it('block reorder with no content change: 0 new translations', async () => {
    const originalContent = makeEditorState([
      paragraph('blk-a', textNode('Alpha')),
      paragraph('blk-b', textNode('Beta')),
    ])

    const mockRuntime = createMockRuntime({})
    const info = { model: 'test', provider: 'test' }

    const firstResult = await lexicalStrategy.translate(
      {
        title: 'Title',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: originalContent,
      },
      'en',
      mockRuntime as unknown as IModelRuntime,
      info,
      {},
    )

    const lexicalService = new LexicalService()
    const snapshots = lexicalService
      .extractRootBlocks(originalContent)
      .map((b: any) => ({
        id: b.id ?? '',
        fingerprint: b.fingerprint,
        type: b.type,
        index: b.index,
      }))

    // Reorder: swap blocks
    const reorderedContent = makeEditorState([
      paragraph('blk-b', textNode('Beta')),
      paragraph('blk-a', textNode('Alpha')),
    ])

    const mockRuntime2 = createMockRuntime({})
    mockRuntime2.generateText.mockClear()

    const { md5: md5Fn } = await import('~/utils/tool.util')
    const existing = {
      sourceLang: 'en',
      title: firstResult.title,
      text: firstResult.text,
      content: firstResult.content,
      contentFormat: ContentFormat.Lexical,
      summary: undefined,
      tags: undefined,
      sourceBlockSnapshots: snapshots,
      sourceMetaHashes: { title: md5Fn('Title') },
    } as any

    const secondResult = await lexicalStrategy.translate(
      {
        title: 'Title',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: reorderedContent,
      },
      'en',
      mockRuntime2 as unknown as IModelRuntime,
      info,
      { existing },
    )

    // No AI calls needed — all blocks unchanged
    expect(mockRuntime2.generateText).not.toHaveBeenCalled()

    // Result should have reordered blocks with translated content
    const translated = JSON.parse(secondResult.content)
    expect(translated.root.children).toHaveLength(2)
  })

  it('delete and add blocks: only new block is translated', async () => {
    const originalContent = makeEditorState([
      paragraph('blk-a', textNode('Keep')),
      paragraph('blk-b', textNode('Remove')),
    ])

    const mockRuntime = createMockRuntime({})
    const info = { model: 'test', provider: 'test' }

    const firstResult = await lexicalStrategy.translate(
      {
        title: 'Title',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: originalContent,
      },
      'en',
      mockRuntime as unknown as IModelRuntime,
      info,
      {},
    )

    const lexicalService = new LexicalService()
    const snapshots = lexicalService
      .extractRootBlocks(originalContent)
      .map((b: any) => ({
        id: b.id ?? '',
        fingerprint: b.fingerprint,
        type: b.type,
        index: b.index,
      }))

    // Delete blk-b, add blk-c
    const modifiedContent = makeEditorState([
      paragraph('blk-a', textNode('Keep')),
      paragraph('blk-c', textNode('New block')),
    ])

    const mockRuntime2 = createMockRuntime({})
    mockRuntime2.generateText.mockClear()

    const { md5: md5Fn } = await import('~/utils/tool.util')
    const existing = {
      sourceLang: 'en',
      title: firstResult.title,
      text: firstResult.text,
      content: firstResult.content,
      contentFormat: ContentFormat.Lexical,
      summary: undefined,
      tags: undefined,
      sourceBlockSnapshots: snapshots,
      sourceMetaHashes: { title: md5Fn('Title') },
    } as any

    const secondResult = await lexicalStrategy.translate(
      {
        title: 'Title',
        text: '',
        contentFormat: ContentFormat.Lexical,
        content: modifiedContent,
      },
      'en',
      mockRuntime2 as unknown as IModelRuntime,
      info,
      { existing },
    )

    // AI should be called for the new block only
    expect(mockRuntime2.generateText).toHaveBeenCalled()
    const aiInput =
      mockRuntime2.generateText.mock.calls[0][0].messages[1].content
    const segmentsSection = aiInput.split('## Segments to translate\n')[1]
    expect(segmentsSection).toContain('New block')
    expect(segmentsSection).not.toContain('Keep')

    // Deleted block should not appear
    const translated = JSON.parse(secondResult.content)
    expect(translated.root.children).toHaveLength(2)
  })
})
