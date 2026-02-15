import { Test } from '@nestjs/testing'
import { AiInFlightService } from '~/modules/ai/ai-inflight/ai-inflight.service'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { AITranslationModel } from '~/modules/ai/ai-translation/ai-translation.model'
import { AiTranslationService } from '~/modules/ai/ai-translation/ai-translation.service'
import { parseLexicalForTranslation } from '~/modules/ai/ai-translation/lexical-translation-parser'
import { AiService } from '~/modules/ai/ai.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { LexicalService } from '~/processors/helper/helper.lexical.service'
import { TaskQueueProcessor } from '~/processors/task-queue'
import { ContentFormat } from '~/shared/types/content-format.type'
import { getModelToken } from '~/transformers/model.transformer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lexicalData } from './real-world-lexical-data'

// Realistic EN→ZH translation lookup for all text segments in the real-world data.
// Inline-code segments (format=16) are kept unchanged per translation rules.
const EN_TO_ZH: Record<string, string> = {
  // ── Chunk 0: h1 + paragraph + h2 + paragraph ──
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

  // ── Chunk 1: Image Renderer ──
  'Image Renderer': '图片渲染器',
  'Migrated from web zoom-image: blurhash placeholder, loading transition and click-to-zoom viewer.':
    '从 web zoom-image 迁移：blurhash 占位图、加载过渡和点击缩放查看器。',

  // ── Chunk 2: Video Renderer ──
  'Video Renderer': '视频渲染器',
  'Migrated from web VideoPlayer: click-to-play overlay, seek/volume controls, fullscreen and download.':
    '从 web VideoPlayer 迁移：点击播放遮罩、进度/音量控制、全屏和下载。',

  // ── Chunk 3: LinkCard ──
  'LinkCard with Plugin System': '链接卡片与插件系统',
  'The enhanced LinkCard renderer features a plugin system for dynamic fetching, spotlight hover effects, and platform-specific styling.':
    '增强的链接卡片渲染器具有动态获取插件系统、聚光灯悬停效果和平台特定样式。',

  // ── Chunk 4: More LinkCard examples ──
  'More LinkCard examples with different platforms:':
    '更多不同平台的链接卡片示例：',

  // ── Chunk 5: Gallery Renderer + Grid Layout ──
  'Gallery Renderer': '画廊渲染器',
  'The enhanced Gallery renderer supports multiple layouts, carousel mode with autoplay, and photo zoom via ':
    '增强的画廊渲染器支持多种布局、带自动播放的轮播模式以及通过 ',
  'react-photo-view': 'react-photo-view',
  'Grid Layout': '网格布局',

  // ── Chunk 6: Carousel Layout ──
  'Carousel Layout with Autoplay': '带自动播放的轮播布局',
  'Carousel mode features bi-directional autoplay, navigation buttons, and smooth scrolling.':
    '轮播模式具有双向自动播放、导航按钮和平滑滚动。',

  // ── Chunk 7: Masonry Layout ──
  'Masonry Layout': '瀑布流布局',

  // ── Chunk 8: Remote Component ──
  'Remote Component': '远程组件',
  'The Component node loads remote React components via DLS descriptors. The default renderer shows parsed metadata; override via ':
    '组件节点通过 DLS 描述符加载远程 React 组件。默认渲染器显示解析后的元数据；通过 ',
  'RendererConfig.Component': 'RendererConfig.Component',
  ' for actual script loading.': ' 实现实际脚本加载。',

  // ── Chunk 9: Mermaid Renderer ──
  'Mermaid Renderer': 'Mermaid 渲染器',

  // ── Chunk 10: Features Summary (h2 + list) ──
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

  // ── Chunk 11: alert-quote (nested editor content) ──
  'Click on any gallery image to open the photo viewer!':
    '点击任意画廊图片即可打开照片查看器！',

  // ── Meta fields (looked up by their text values, not by key names) ──
  'A demo showcasing enhanced renderers': '展示增强渲染器的演示文档',
  'demo|||lexical|||renderer': '演示|||Lexical|||渲染器',
}

// Recursively assert two JSON trees have identical structure (same keys, types, children count).
// Only text node `.text` values are allowed to differ.
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
      // text node `.text` values may differ — skip value comparison
      if (key === 'text' && original.type === 'text') continue
      assertShapeMatch(original[key], translated[key], `${path}.${key}`)
    }
    return
  }
  // Primitives (number, string, boolean) must be identical except text node text
  expect(translated, `${path}: value mismatch`).toEqual(original)
}

describe('translateLexicalContent (real-world data)', () => {
  let service: AiTranslationService

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
        {
          provide: LexicalService,
          useValue: {
            lexicalToMarkdown: vi
              .fn()
              .mockReturnValue('[markdown placeholder]'),
          },
        },
      ],
    }).compile()

    service = module.get(AiTranslationService)
  })

  it('should parse real data into expected chunk structure', () => {
    const json = JSON.stringify(lexicalData)
    const { chunks } = parseLexicalForTranslation(json)

    // Non-translatable nodes (code-block, image, video, link-card, gallery,
    // component, mermaid, horizontalrule) break continuity.
    // alert-quote has nested editor content and IS translatable.
    expect(chunks.length).toBeGreaterThanOrEqual(10)

    // First chunk: h1 + paragraph(with inline code) + h2 + paragraph
    const chunk0 = chunks[0]
    expect(chunk0.textNodes.length).toBeGreaterThanOrEqual(10)
    expect(chunk0.textNodes[0].originalText).toBe('Enhanced Renderers Demo')

    // All text nodes across all chunks should have unique IDs
    const allIds = chunks.flatMap((c) => c.textNodes.map((n) => n.id))
    expect(new Set(allIds).size).toBe(allIds.length)
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

    // Mock runtime: extract segments from prompt, translate via lookup table
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

    const result = await (service as any).translateLexicalContent(
      content,
      'zh',
      mockRuntime,
      { model: 'test-model', provider: 'test-provider' },
      onToken,
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
    // inline code nodes preserved
    expect(para1.children[1].text).toBe('@shiro/rich-renderer-codeblock')
    expect(para1.children[1].format).toBe(16)

    // h2: "代码块渲染器"
    expect(rootChildren[2].children[0].text).toBe('代码块渲染器')

    // code-block: structure unchanged (not translated)
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
    // First list item: "代码块：" + bold "语言标签 + 复制 + 折叠"
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

    // ── Verify AI was called multiple times (one per chunk) ──
    const { chunks } = parseLexicalForTranslation(editorStateJson)
    expect(mockRuntime.generateText).toHaveBeenCalledTimes(chunks.length)

    // ── Verify first call included meta entries ──
    const firstCallPrompt =
      mockRuntime.generateText.mock.calls[0][0].messages[1].content
    expect(firstCallPrompt).toContain('__title__')
    expect(firstCallPrompt).toContain('__summary__')
    expect(firstCallPrompt).toContain('__tags__')

    // ── Verify subsequent calls did NOT include meta ──
    if (chunks.length > 1) {
      const secondCallPrompt =
        mockRuntime.generateText.mock.calls[1][0].messages[1].content
      expect(secondCallPrompt).not.toContain('__title__')
    }

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

    // Mock streaming runtime
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

        // Simulate chunked streaming
        const chunkSize = 50
        for (let i = 0; i < fullJson.length; i += chunkSize) {
          yield { text: fullJson.slice(i, i + chunkSize) }
        }
      }),
    }

    const result = await (service as any).translateLexicalContent(
      content,
      'zh',
      mockRuntime,
      { model: 'stream-model', provider: 'stream-provider' },
    )

    expect(result.sourceLang).toBe('en')
    expect(result.title).toBe('增强渲染器演示')
    // summary was null, tags was empty → fallback to original
    expect(result.summary).toBeNull()
    expect(result.tags).toEqual([])

    const translated = JSON.parse(result.content)
    expect(translated.root.children[0].children[0].text).toBe('增强渲染器演示')

    // Shape consistency
    assertShapeMatch(lexicalData, translated)
  })
})
