# Yohaku Note 页精读 companion 实装计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 于 Yohaku 前端 Note 页引入 "余白" 精读 companion —— 双纸并置、`<ref>` 双向跳转、响应式降级。

**Architecture:** 新建 `apps/web/src/components/modules/yohaku/` 模块。Context Provider 管三态（idle / reading / anchored）与 SSE 缓存；外部入口 ribbon 与 NoticeCard chip 皆调 `toggle()`；笔记副纸覆于原文纸之右部；点 `<ref>` 触 z-swap + Range 定位 + springScroll + 高亮。移动端沿 `<lg` 以 Sheet drawer 降级。

**Tech Stack:**
- **Working dir:** `/Users/innei/git/innei-repo/Yohaku/` (前端，非 mx-core)
- React 18 / Next.js App Router
- `motion/react` (既有)
- `markdown-to-jsx` (既有，含 `overrides`)
- `@mx-space/api-client` v11.3+ (`getInsights`, `streamInsightsGenerate`, `AIInsightsStreamEvent`)
- Vitest 4 (既有) + `@testing-library/react` (须本 plan 添加)
- `components/ui/sheet/Sheet.tsx` (既有)
- `lib/scroller#springScrollToElement` (既有)
- `components/modules/note/NoticeCard` (既有，加 `variant="insights"`)

**Spec:** `../specs/2026-04-21-yohaku-note-page-design.md`

**完成后验收：** spec §1 列 5 项。

---

## File Structure

```
apps/web/src/components/modules/yohaku/
├── index.ts                           # barrel export
├── constants.ts                       # YOHAKU_LAYOUT / MOTION / FLASH / SCROLL / REF / LOADING
├── types.ts                           # YohakuState / YohakuMeta / RefTarget / SSEStatus
│
├── YohakuProvider.tsx                 # Context + state machine
├── YohakuRibbon.tsx                   # Desktop 右上书签触发
├── YohakuNoticeChip.tsx               # NoticeCard 内 chip 触发
├── YohakuNotePaper.tsx                # 笔记副纸外壳（desktop）
├── YohakuSheet.tsx                    # 移动端 drawer
├── YohakuContent.tsx                  # Markdown 渲染 + <ref> override
├── YohakuRefAnchor.tsx                # <ref> 上标 chip 组件
├── YohakuLoading.tsx                  # Skeleton 骨架
├── YohakuMetaHeader.tsx               # 笔记顶 meta chips
│
├── hooks/
│   ├── useYohakuLayout.ts             # 响应式算 note 宽/overlap
│   ├── useYohakuInsights.ts           # SSE stream + 缓存
│   ├── useEscapeExit.ts               # ESC 订阅
│   └── useLayoutShift.ts              # 进/退精读态 CSS 协奏
│
├── parser/
│   ├── extractMeta.ts                 # 末尾 <!-- insights-meta --> JSON
│   └── extractRefs.ts                 # quote → DOM Range
│
└── (tests colocated as *.test.ts(x))
```

**Modified files:**

- `apps/web/src/app/[locale]/notes/(note-detail)/detail-page.tsx` — 注入 Provider 与组件
- `apps/web/src/components/modules/note/NoticeCard.tsx`（若需扩 variant 类型）
- `apps/web/src/messages/{zh,en,ja}/common.json` — i18n keys
- `apps/web/package.json` — `@testing-library/react` devDep
- `apps/web/vitest.config.ts`（或 root）— 启 `jsdom`/`happy-dom` environment（若未启）

---

## Task 0: 环境准备

**Files:**
- Modify: `apps/web/package.json`
- Verify: `vitest.config.ts` or root vitest config

- [ ] **Step 1: 切到 Yohaku 工作目录**

```bash
cd /Users/innei/git/innei-repo/Yohaku
```

- [ ] **Step 2: 确认 motion/markdown-to-jsx 版本**

```bash
pnpm --filter web ls motion markdown-to-jsx
```

Expected: `motion >= 11`, `markdown-to-jsx >= 7`. 若缺则 `pnpm --filter web add motion markdown-to-jsx`.

- [ ] **Step 3: 添加 @testing-library/react 与 jsdom 环境**

```bash
pnpm --filter web add -D @testing-library/react @testing-library/dom happy-dom
```

- [ ] **Step 4: 确认 vitest environment**

Check `apps/web/vitest.config.ts`（若不存在则查 root `vitest.config.ts`）。确保含：

```ts
test: {
  environment: 'happy-dom',
}
```

若无，add it. 若用 root config，在 apps/web 单独加一个 `vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '~': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
```

- [ ] **Step 5: Smoke test**

```bash
pnpm --filter web test -- --run --reporter=default apps/web/src/components/modules/note/note-latest-preview-content.test.ts
```

Expected: PASS (既有测试不受影响)

- [ ] **Step 6: Commit**

```bash
cd /Users/innei/git/innei-repo/Yohaku
git add apps/web/package.json apps/web/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(yohaku): add @testing-library/react and happy-dom env for yohaku module"
```

---

## Task 1: constants.ts + types.ts

**Files:**
- Create: `apps/web/src/components/modules/yohaku/constants.ts`
- Create: `apps/web/src/components/modules/yohaku/types.ts`
- Create: `apps/web/src/components/modules/yohaku/index.ts`

- [ ] **Step 1: 创建 `constants.ts`**

```ts
// apps/web/src/components/modules/yohaku/constants.ts
export const YOHAKU_LAYOUT = {
  PAPER_LEFT_PCT: 20,
  NOTE_TARGET_W: 430,
  NOTE_MIN_W: 260,
  OVERLAP_TARGET: 80,
  OVERLAP_MAX: 240,
  RIGHT_PAD: 16,
  NOTE_OFFSET_Y: 16,
  PAPER_TOP: 36,
  PAPER_BOTTOM: 20,
  BREAKPOINT_SHEET_PX: 1024,
} as const

export const YOHAKU_MOTION = {
  ANIM_MS: 450,
  MAIN_SHIFT_DELAY_MS: 100,
  NOTE_SLIDE_DELAY_MS: 200,
  LIFT_Y: 8,
  SIDE_OPACITY_READING: 0.18,
  SIDE_GRAYSCALE: 0.6,
  SIDE_FADE_MS: 200,
  EASE_PAPER: 'cubic-bezier(0.22, 1, 0.36, 1)',
  REDUCED_MOTION_FACTOR: 0.4,
} as const

export const YOHAKU_FLASH = {
  DURATION_MS: 2000,
  ALPHA: 38,
} as const

export const YOHAKU_SCROLL = {
  SPRING_STIFFNESS: 1000,
  SPRING_DAMPING: 250,
  ELEMENT_OFFSET: 40,
} as const

export const YOHAKU_REF = {
  TOAST_NOT_FOUND_MS: 2400,
  QUOTE_WARN_PREVIEW_CHARS: 32,
} as const

export const YOHAKU_LOADING = {
  PULSE_MS: 1200,
  SKELETON_H2_COUNT: 3,
  SKELETON_BULLET_MIN: 3,
  SKELETON_BULLET_MAX: 5,
} as const
```

- [ ] **Step 2: 创建 `types.ts`**

```ts
// apps/web/src/components/modules/yohaku/types.ts
export type YohakuState = 'idle' | 'reading' | 'anchored'

export interface YohakuMeta {
  reading_time_min: number
  difficulty: 'easy' | 'medium' | 'hard'
  genre: string
}

export interface RefTarget {
  quote: string
  section?: string
}

export interface YohakuInsightsData {
  data: string
  meta: YohakuMeta | null
  loading: boolean
  error: Error | null
  hasFetched: boolean
}
```

- [ ] **Step 3: 创建 `index.ts` 占位 barrel**

```ts
// apps/web/src/components/modules/yohaku/index.ts
export * from './types'
export { YOHAKU_LAYOUT, YOHAKU_MOTION, YOHAKU_FLASH, YOHAKU_SCROLL, YOHAKU_REF, YOHAKU_LOADING } from './constants'
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: PASS (no errors for new files)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/constants.ts apps/web/src/components/modules/yohaku/types.ts apps/web/src/components/modules/yohaku/index.ts
git commit -m "feat(yohaku): add constants and type definitions"
```

---

## Task 2: parser/extractMeta.ts

**Files:**
- Create: `apps/web/src/components/modules/yohaku/parser/extractMeta.ts`
- Test: `apps/web/src/components/modules/yohaku/parser/extractMeta.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/web/src/components/modules/yohaku/parser/extractMeta.test.ts
import { describe, expect, it } from 'vitest'
import { extractMeta } from './extractMeta'

describe('extractMeta', () => {
  it('returns null when no trailer comment', () => {
    expect(extractMeta('## TL;DR\n\nBody text.')).toBeNull()
  })

  it('extracts valid JSON from trailer', () => {
    const md = '## TL;DR\n\nBody.\n\n<!-- insights-meta: {"reading_time_min":3,"difficulty":"easy","genre":"essay"} -->'
    expect(extractMeta(md)).toEqual({
      reading_time_min: 3,
      difficulty: 'easy',
      genre: 'essay',
    })
  })

  it('returns null on malformed JSON', () => {
    const md = 'Body.\n<!-- insights-meta: {not valid} -->'
    expect(extractMeta(md)).toBeNull()
  })

  it('tolerates trailing whitespace after -->', () => {
    const md = 'Body.\n<!-- insights-meta: {"reading_time_min":1,"difficulty":"easy","genre":"diary"} -->\n\n   '
    expect(extractMeta(md)).toEqual({
      reading_time_min: 1,
      difficulty: 'easy',
      genre: 'diary',
    })
  })

  it('takes the last occurrence when multiple', () => {
    const md = '<!-- insights-meta: {"reading_time_min":1,"difficulty":"easy","genre":"a"} -->\nBody.\n<!-- insights-meta: {"reading_time_min":9,"difficulty":"hard","genre":"b"} -->'
    expect(extractMeta(md)?.genre).toBe('b')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/parser/extractMeta.test.ts
```

Expected: FAIL ("Cannot find module './extractMeta'")

- [ ] **Step 3: Implement**

```ts
// apps/web/src/components/modules/yohaku/parser/extractMeta.ts
import type { YohakuMeta } from '../types'

const META_RE = /<!--\s*insights-meta:\s*(\{[\s\S]*?\})\s*-->\s*$/

export function extractMeta(markdown: string): YohakuMeta | null {
  const trimmed = markdown.trimEnd()
  // take last occurrence: scan from end using global match
  const globalRe = /<!--\s*insights-meta:\s*(\{[\s\S]*?\})\s*-->/g
  let last: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  while ((m = globalRe.exec(trimmed)) !== null) last = m
  if (!last) return null
  try {
    const parsed = JSON.parse(last[1]) as YohakuMeta
    if (
      typeof parsed?.reading_time_min === 'number' &&
      typeof parsed?.difficulty === 'string' &&
      typeof parsed?.genre === 'string'
    ) return parsed
    return null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/parser/extractMeta.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/parser/extractMeta.ts apps/web/src/components/modules/yohaku/parser/extractMeta.test.ts
git commit -m "feat(yohaku): add insights-meta trailer parser"
```

---

## Task 3: parser/extractRefs.ts

**Files:**
- Create: `apps/web/src/components/modules/yohaku/parser/extractRefs.ts`
- Test: `apps/web/src/components/modules/yohaku/parser/extractRefs.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/web/src/components/modules/yohaku/parser/extractRefs.test.ts
import { describe, expect, it, beforeEach } from 'vitest'
import { locateQuoteRange } from './extractRefs'

describe('locateQuoteRange', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
    root.innerHTML = `
      <p>初中时代，<strong>我曾</strong>答应过同桌买书。</p>
      <p>后来事情没办成，关系也就冷淡了。</p>
    `
  })

  it('returns null for empty quote', () => {
    expect(locateQuoteRange(root, '')).toBeNull()
  })

  it('finds quote inside a single text node', () => {
    const range = locateQuoteRange(root, '同桌买书')
    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('同桌买书')
  })

  it('finds quote spanning multiple text nodes (across <strong>)', () => {
    const range = locateQuoteRange(root, '初中时代，我曾答应')
    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('初中时代，我曾答应')
  })

  it('returns null when not found', () => {
    expect(locateQuoteRange(root, '莫须有')).toBeNull()
  })

  it('returns first occurrence on duplicate', () => {
    root.innerHTML = '<p>回响 回响</p>'
    const range = locateQuoteRange(root, '回响')!
    expect(range.startOffset).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/parser/extractRefs.test.ts
```

Expected: FAIL ("Cannot find module './extractRefs'")

- [ ] **Step 3: Implement**

```ts
// apps/web/src/components/modules/yohaku/parser/extractRefs.ts
/**
 * Walk text nodes under `root`, build a flat offset map, then locate
 * the first contiguous occurrence of `quote` and return a DOM Range.
 * Returns null if not found or quote is empty.
 */
export function locateQuoteRange(root: HTMLElement, quote: string): Range | null {
  if (!quote) return null

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const chunks: { node: Text; start: number; end: number }[] = []
  let flat = ''
  let node: Node | null
  while ((node = walker.nextNode())) {
    const t = node as Text
    const text = t.data
    chunks.push({ node: t, start: flat.length, end: flat.length + text.length })
    flat += text
  }

  const hit = flat.indexOf(quote)
  if (hit < 0) return null
  const hitEnd = hit + quote.length

  const startChunk = chunks.find((c) => c.start <= hit && hit < c.end)
  const endChunk = chunks.find((c) => c.start < hitEnd && hitEnd <= c.end)
  if (!startChunk || !endChunk) return null

  const range = document.createRange()
  range.setStart(startChunk.node, hit - startChunk.start)
  range.setEnd(endChunk.node, hitEnd - endChunk.start)
  return range
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/parser/extractRefs.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/parser/extractRefs.ts apps/web/src/components/modules/yohaku/parser/extractRefs.test.ts
git commit -m "feat(yohaku): add quote-to-Range locator for <ref> anchoring"
```

---

## Task 4: hooks/useYohakuLayout.ts (pure algo first)

**Files:**
- Create: `apps/web/src/components/modules/yohaku/hooks/useYohakuLayout.ts`
- Test: `apps/web/src/components/modules/yohaku/hooks/useYohakuLayout.test.ts`

- [ ] **Step 1: Write failing test for pure function `computeLayout`**

```ts
// apps/web/src/components/modules/yohaku/hooks/useYohakuLayout.test.ts
import { describe, expect, it } from 'vitest'
import { computeLayout } from './useYohakuLayout'

const paperW = 960

describe('computeLayout', () => {
  it('returns target values when viewport is roomy (1700)', () => {
    const r = computeLayout({ viewportW: 1700, paperW })
    expect(r.mode).toBe('split')
    expect(r.noteW).toBe(430)
    expect(r.overlap).toBe(80)
    expect(r.slack).toBeGreaterThanOrEqual(0)
  })

  it('increases overlap when slack turns negative (1600)', () => {
    const r = computeLayout({ viewportW: 1600, paperW })
    expect(r.mode).toBe('split')
    expect(r.overlap).toBeGreaterThan(80)
    expect(r.overlap).toBeLessThanOrEqual(240)
    expect(r.noteW).toBe(430)
  })

  it('shrinks note width when overlap reaches max (1250)', () => {
    const r = computeLayout({ viewportW: 1250, paperW })
    expect(r.mode).toBe('split')
    expect(r.overlap).toBe(240)
    expect(r.noteW).toBeLessThan(430)
    expect(r.noteW).toBeGreaterThanOrEqual(260)
  })

  it('returns sheet mode when <lg (800)', () => {
    const r = computeLayout({ viewportW: 800, paperW })
    expect(r.mode).toBe('sheet')
  })

  it('returns sheet mode when even shrunken note overflows (1060)', () => {
    const r = computeLayout({ viewportW: 1060, paperW })
    expect(r.mode).toBe('sheet')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/hooks/useYohakuLayout.test.ts
```

Expected: FAIL ("Cannot find module './useYohakuLayout'")

- [ ] **Step 3: Implement (pure algo + hook)**

```ts
// apps/web/src/components/modules/yohaku/hooks/useYohakuLayout.ts
'use client'

import { useEffect, useState } from 'react'
import { YOHAKU_LAYOUT } from '../constants'

export type LayoutResult =
  | { mode: 'split'; noteW: number; overlap: number; slack: number }
  | { mode: 'sheet'; noteW: 0; overlap: 0; slack: 0 }

export function computeLayout({ viewportW, paperW }: { viewportW: number; paperW: number }): LayoutResult {
  const {
    PAPER_LEFT_PCT,
    NOTE_TARGET_W,
    NOTE_MIN_W,
    OVERLAP_TARGET,
    OVERLAP_MAX,
    RIGHT_PAD,
    BREAKPOINT_SHEET_PX,
  } = YOHAKU_LAYOUT

  if (viewportW < BREAKPOINT_SHEET_PX) {
    return { mode: 'sheet', noteW: 0, overlap: 0, slack: 0 }
  }

  const leftPx = (viewportW * PAPER_LEFT_PCT) / 100
  let noteW = NOTE_TARGET_W
  let overlap = OVERLAP_TARGET
  const rightAvail = () => viewportW - RIGHT_PAD - (leftPx + paperW - overlap + noteW)

  let slack = rightAvail()
  if (slack < 0) {
    const deficit = -slack
    overlap = Math.min(OVERLAP_MAX, OVERLAP_TARGET + deficit)
    slack = rightAvail()
    if (slack < 0) {
      noteW = Math.max(NOTE_MIN_W, noteW + slack)
      slack = rightAvail()
    }
  }

  if (slack < 0) return { mode: 'sheet', noteW: 0, overlap: 0, slack: 0 }
  if (noteW < NOTE_MIN_W) return { mode: 'sheet', noteW: 0, overlap: 0, slack: 0 }
  return { mode: 'split', noteW, overlap, slack }
}

export function useYohakuLayout(paperW: number): LayoutResult {
  const [vw, setVw] = useState(() => (typeof window === 'undefined' ? 1600 : window.innerWidth))
  useEffect(() => {
    const on = () => setVw(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return computeLayout({ viewportW: vw, paperW })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/hooks/useYohakuLayout.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/hooks/useYohakuLayout.ts apps/web/src/components/modules/yohaku/hooks/useYohakuLayout.test.ts
git commit -m "feat(yohaku): responsive layout algorithm + hook"
```

---

## Task 5: hooks/useYohakuInsights.ts (SSE + cache)

**Files:**
- Create: `apps/web/src/components/modules/yohaku/hooks/useYohakuInsights.ts`
- Test: `apps/web/src/components/modules/yohaku/hooks/useYohakuInsights.test.ts`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/modules/yohaku/hooks/useYohakuInsights.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useYohakuInsights } from './useYohakuInsights'

// mock the api-client
const getInsights = vi.fn()
const streamInsightsGenerate = vi.fn()

vi.mock('~/atoms/hooks/useApiClient', () => ({
  useApiClient: () => ({
    ai: { getInsights, streamInsightsGenerate },
  }),
}))

function sseResponse(events: string[]) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(c) {
      for (const e of events) c.enqueue(encoder.encode(e))
      c.close()
    },
  })
  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
}

describe('useYohakuInsights', () => {
  beforeEach(() => {
    getInsights.mockReset()
    streamInsightsGenerate.mockReset()
  })

  it('returns idle state before open', () => {
    const { result } = renderHook(() => useYohakuInsights('n1', 'zh'))
    expect(result.current.loading).toBe(false)
    expect(result.current.hasFetched).toBe(false)
    expect(result.current.data).toBe('')
  })

  it('uses cached model on open when getInsights returns non-null', async () => {
    getInsights.mockResolvedValue({ content: '## Cached\n\nBody.' })
    const { result } = renderHook(() => useYohakuInsights('n1', 'zh'))
    await act(async () => { await result.current.open() })
    await waitFor(() => expect(result.current.hasFetched).toBe(true))
    expect(result.current.data).toContain('Cached')
    expect(streamInsightsGenerate).not.toHaveBeenCalled()
  })

  it('streams via SSE when no cache', async () => {
    getInsights.mockResolvedValue(null)
    streamInsightsGenerate.mockResolvedValue(sseResponse([
      'data: {"type":"token","data":"## TL;DR\\n"}\n\n',
      'data: {"type":"token","data":"Body."}\n\n',
      'data: {"type":"done"}\n\n',
    ]))
    const { result } = renderHook(() => useYohakuInsights('n1', 'zh'))
    await act(async () => { await result.current.open() })
    await waitFor(() => expect(result.current.hasFetched).toBe(true))
    expect(result.current.data).toBe('## TL;DR\nBody.')
  })

  it('sets error on SSE error event', async () => {
    getInsights.mockResolvedValue(null)
    streamInsightsGenerate.mockResolvedValue(sseResponse([
      'data: {"type":"error","data":"quota exceeded"}\n\n',
    ]))
    const { result } = renderHook(() => useYohakuInsights('n1', 'zh'))
    await act(async () => { await result.current.open() })
    await waitFor(() => expect(result.current.error).not.toBeNull())
  })

  it('reload() clears cache and refetches', async () => {
    getInsights.mockResolvedValue({ content: 'v1' })
    const { result } = renderHook(() => useYohakuInsights('n1', 'zh'))
    await act(async () => { await result.current.open() })
    expect(result.current.data).toBe('v1')

    getInsights.mockResolvedValue({ content: 'v2' })
    await act(async () => { await result.current.reload() })
    await waitFor(() => expect(result.current.data).toBe('v2'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/hooks/useYohakuInsights.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement**

Note: **find the actual api-client hook** in Yohaku (likely `~/atoms/hooks/useApiClient` or `~/lib/client`). If path differs, adjust import below and the mock above.

```ts
// apps/web/src/components/modules/yohaku/hooks/useYohakuInsights.ts
'use client'

import { useCallback, useRef, useState } from 'react'
import { useApiClient } from '~/atoms/hooks/useApiClient'
import { extractMeta } from '../parser/extractMeta'
import type { YohakuMeta } from '../types'

export interface UseYohakuInsightsReturn {
  data: string
  meta: YohakuMeta | null
  loading: boolean
  error: Error | null
  hasFetched: boolean
  open: () => Promise<void>
  reload: () => Promise<void>
}

export function useYohakuInsights(nid: string, lang: string): UseYohakuInsightsReturn {
  const api = useApiClient()
  const [data, setData] = useState('')
  const [meta, setMeta] = useState<YohakuMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hasFetched, setHasFetched] = useState(false)
  const inflight = useRef(false)

  const fetchInsights = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    setLoading(true)
    setError(null)
    try {
      const cached = await api.ai.getInsights({ articleId: nid, lang, onlyDb: true })
      if (cached?.content) {
        setData(cached.content)
        setMeta(extractMeta(cached.content))
        setHasFetched(true)
        setLoading(false)
        return
      }
      const res = await api.ai.streamInsightsGenerate({ articleId: nid, lang })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let acc = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx: number
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const line = chunk.split('\n').find((l) => l.startsWith('data:'))
          if (!line) continue
          try {
            const evt = JSON.parse(line.slice(5).trim()) as
              | { type: 'token'; data: string }
              | { type: 'done' }
              | { type: 'error'; data: string }
            if (evt.type === 'token') {
              acc += evt.data
              setData(acc)
            } else if (evt.type === 'done') {
              setMeta(extractMeta(acc))
            } else if (evt.type === 'error') {
              throw new Error(evt.data)
            }
          } catch (e) {
            throw e instanceof Error ? e : new Error(String(e))
          }
        }
      }
      setHasFetched(true)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
      inflight.current = false
    }
  }, [api, nid, lang])

  const open = useCallback(async () => {
    if (hasFetched) return
    await fetchInsights()
  }, [hasFetched, fetchInsights])

  const reload = useCallback(async () => {
    setData('')
    setMeta(null)
    setHasFetched(false)
    await fetchInsights()
  }, [fetchInsights])

  return { data, meta, loading, error, hasFetched, open, reload }
}
```

- [ ] **Step 4: Verify `useApiClient` path**

```bash
grep -rn "useApiClient" /Users/innei/git/innei-repo/Yohaku/apps/web/src --include="*.ts" --include="*.tsx" | head -5
```

Adjust import path in `useYohakuInsights.ts` and test mock to match (could be `~/lib/api`, `~/providers/api-client`, etc.).

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/hooks/useYohakuInsights.test.tsx
```

Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/modules/yohaku/hooks/useYohakuInsights.ts apps/web/src/components/modules/yohaku/hooks/useYohakuInsights.test.tsx
git commit -m "feat(yohaku): SSE insights fetch hook with cache"
```

---

## Task 6: YohakuProvider (state machine)

**Files:**
- Create: `apps/web/src/components/modules/yohaku/YohakuProvider.tsx`
- Test: `apps/web/src/components/modules/yohaku/YohakuProvider.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/modules/yohaku/YohakuProvider.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { YohakuProvider, useYohaku } from './YohakuProvider'

vi.mock('./hooks/useYohakuInsights', () => ({
  useYohakuInsights: () => ({
    data: '## TL;DR\n\nBody.',
    meta: null,
    loading: false,
    error: null,
    hasFetched: true,
    open: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn(),
  }),
}))

const wrapper = ({ children }: any) => (
  <YohakuProvider nid="n1" lang="zh">{children}</YohakuProvider>
)

describe('YohakuProvider', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useYohaku(), { wrapper })
    expect(result.current.state).toBe('idle')
  })

  it('open() transitions to reading', async () => {
    const { result } = renderHook(() => useYohaku(), { wrapper })
    await act(async () => { await result.current.open() })
    expect(result.current.state).toBe('reading')
  })

  it('anchor() transitions reading -> anchored and exposes target', async () => {
    const { result } = renderHook(() => useYohaku(), { wrapper })
    await act(async () => { await result.current.open() })
    act(() => { result.current.anchor({ quote: 'x', section: '§1' }) })
    expect(result.current.state).toBe('anchored')
    expect(result.current.currentRef?.quote).toBe('x')
  })

  it('liftPaper() from reading -> anchored', async () => {
    const { result } = renderHook(() => useYohaku(), { wrapper })
    await act(async () => { await result.current.open() })
    act(() => { result.current.liftPaper() })
    expect(result.current.state).toBe('anchored')
    expect(result.current.currentRef).toBeNull()
  })

  it('dropPaper() from anchored -> reading', async () => {
    const { result } = renderHook(() => useYohaku(), { wrapper })
    await act(async () => { await result.current.open() })
    act(() => { result.current.liftPaper() })
    act(() => { result.current.dropPaper() })
    expect(result.current.state).toBe('reading')
  })

  it('close() always returns to idle', async () => {
    const { result } = renderHook(() => useYohaku(), { wrapper })
    await act(async () => { await result.current.open() })
    act(() => { result.current.liftPaper() })
    act(() => { result.current.close() })
    expect(result.current.state).toBe('idle')
  })

  it('toggle() opens from idle and closes otherwise', async () => {
    const { result } = renderHook(() => useYohaku(), { wrapper })
    await act(async () => { await result.current.toggle() })
    expect(result.current.state).toBe('reading')
    await act(async () => { await result.current.toggle() })
    expect(result.current.state).toBe('idle')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuProvider.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/modules/yohaku/YohakuProvider.tsx
'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useYohakuInsights } from './hooks/useYohakuInsights'
import type { RefTarget, YohakuMeta, YohakuState } from './types'

interface YohakuContextValue {
  nid: string
  state: YohakuState
  data: string
  meta: YohakuMeta | null
  loading: boolean
  error: Error | null
  currentRef: RefTarget | null
  open: () => Promise<void>
  close: () => void
  toggle: () => Promise<void>
  reload: () => Promise<void>
  anchor: (target: RefTarget) => void
  liftPaper: () => void
  dropPaper: () => void
}

const YohakuCtx = createContext<YohakuContextValue | null>(null)

export function YohakuProvider({
  nid,
  lang,
  children,
}: {
  nid: string
  lang: string
  children: ReactNode
}) {
  const insights = useYohakuInsights(nid, lang)
  const [state, setState] = useState<YohakuState>('idle')
  const [currentRef, setCurrentRef] = useState<RefTarget | null>(null)

  const open = useCallback(async () => {
    setState((prev) => (prev === 'idle' ? 'reading' : prev))
    await insights.open()
  }, [insights])

  const close = useCallback(() => {
    setState('idle')
    setCurrentRef(null)
  }, [])

  const toggle = useCallback(async () => {
    if (state === 'idle') await open()
    else close()
  }, [state, open, close])

  const anchor = useCallback((target: RefTarget) => {
    setCurrentRef(target)
    setState('anchored')
  }, [])

  const liftPaper = useCallback(() => {
    setCurrentRef(null)
    setState('anchored')
  }, [])

  const dropPaper = useCallback(() => {
    setCurrentRef(null)
    setState('reading')
  }, [])

  const value: YohakuContextValue = useMemo(
    () => ({
      nid,
      state,
      data: insights.data,
      meta: insights.meta,
      loading: insights.loading,
      error: insights.error,
      currentRef,
      open,
      close,
      toggle,
      reload: insights.reload,
      anchor,
      liftPaper,
      dropPaper,
    }),
    [nid, state, insights.data, insights.meta, insights.loading, insights.error, currentRef, open, close, toggle, insights.reload, anchor, liftPaper, dropPaper],
  )

  return <YohakuCtx.Provider value={value}>{children}</YohakuCtx.Provider>
}

export function useYohaku(): YohakuContextValue {
  const ctx = useContext(YohakuCtx)
  if (!ctx) throw new Error('useYohaku must be used inside <YohakuProvider>')
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuProvider.test.tsx
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuProvider.tsx apps/web/src/components/modules/yohaku/YohakuProvider.test.tsx
git commit -m "feat(yohaku): state machine Provider with open/close/anchor"
```

---

## Task 7: YohakuLoading (skeleton)

**Files:**
- Create: `apps/web/src/components/modules/yohaku/YohakuLoading.tsx`
- Test: `apps/web/src/components/modules/yohaku/YohakuLoading.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/modules/yohaku/YohakuLoading.test.tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { YohakuLoading } from './YohakuLoading'
import { YOHAKU_LOADING } from './constants'

describe('YohakuLoading', () => {
  it('renders H2 skeleton lines equal to SKELETON_H2_COUNT', () => {
    const { container } = render(<YohakuLoading />)
    const h2s = container.querySelectorAll('[data-yohaku-skel="h2"]')
    expect(h2s.length).toBe(YOHAKU_LOADING.SKELETON_H2_COUNT)
  })

  it('renders between SKELETON_BULLET_MIN and MAX bullets per section', () => {
    const { container } = render(<YohakuLoading />)
    const sections = container.querySelectorAll('[data-yohaku-skel="section"]')
    for (const s of sections) {
      const bullets = s.querySelectorAll('[data-yohaku-skel="bullet"]')
      expect(bullets.length).toBeGreaterThanOrEqual(YOHAKU_LOADING.SKELETON_BULLET_MIN)
      expect(bullets.length).toBeLessThanOrEqual(YOHAKU_LOADING.SKELETON_BULLET_MAX)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuLoading.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/modules/yohaku/YohakuLoading.tsx
import { YOHAKU_LOADING } from './constants'

function deterministicBulletCount(seed: number, min: number, max: number) {
  const range = max - min + 1
  return min + ((seed * 2654435761) % range)
}

export function YohakuLoading() {
  const sections = Array.from({ length: YOHAKU_LOADING.SKELETON_H2_COUNT })
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="yohaku-loading"
      style={{ animation: `yohaku-pulse ${YOHAKU_LOADING.PULSE_MS}ms ease-in-out infinite` }}
    >
      {sections.map((_, i) => (
        <div key={i} data-yohaku-skel="section" className="yohaku-skel-section">
          <div
            data-yohaku-skel="h2"
            className="yohaku-skel-h2"
            style={{ width: '40%', height: 10, background: 'var(--yohaku-skel-bg, #e2d6b8)', borderRadius: 2, margin: '12px 0 6px' }}
          />
          {Array.from({
            length: deterministicBulletCount(
              i + 1,
              YOHAKU_LOADING.SKELETON_BULLET_MIN,
              YOHAKU_LOADING.SKELETON_BULLET_MAX,
            ),
          }).map((__, j) => (
            <div
              key={j}
              data-yohaku-skel="bullet"
              className="yohaku-skel-bullet"
              style={{
                width: `${60 + ((i * 3 + j * 7) % 30)}%`,
                height: 6,
                background: 'var(--yohaku-skel-bg, #e2d6b8)',
                borderRadius: 2,
                margin: '4px 0 4px 8px',
              }}
            />
          ))}
        </div>
      ))}
      <style>{`
        @keyframes yohaku-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuLoading.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuLoading.tsx apps/web/src/components/modules/yohaku/YohakuLoading.test.tsx
git commit -m "feat(yohaku): loading skeleton"
```

---

## Task 8: YohakuMetaHeader

**Files:**
- Create: `apps/web/src/components/modules/yohaku/YohakuMetaHeader.tsx`
- Test: `apps/web/src/components/modules/yohaku/YohakuMetaHeader.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/modules/yohaku/YohakuMetaHeader.test.tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { YohakuMetaHeader } from './YohakuMetaHeader'

describe('YohakuMetaHeader', () => {
  it('returns null when meta is null', () => {
    const { container } = render(<YohakuMetaHeader meta={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders three chips: reading_time, difficulty, genre', () => {
    const { container } = render(
      <YohakuMetaHeader meta={{ reading_time_min: 4, difficulty: 'medium', genre: 'essay' }} />,
    )
    const chips = container.querySelectorAll('[data-yohaku-meta-chip]')
    expect(chips.length).toBe(3)
    const text = container.textContent ?? ''
    expect(text).toContain('4')
    expect(text.toLowerCase()).toContain('medium')
    expect(text.toLowerCase()).toContain('essay')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuMetaHeader.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/modules/yohaku/YohakuMetaHeader.tsx
import type { YohakuMeta } from './types'

export function YohakuMetaHeader({ meta }: { meta: YohakuMeta | null }) {
  if (!meta) return null
  return (
    <div className="yohaku-meta-header flex gap-2 text-xs opacity-70">
      <span data-yohaku-meta-chip="time" className="yohaku-meta-chip">{meta.reading_time_min} min</span>
      <span data-yohaku-meta-chip="difficulty" className="yohaku-meta-chip">{meta.difficulty}</span>
      <span data-yohaku-meta-chip="genre" className="yohaku-meta-chip">{meta.genre}</span>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuMetaHeader.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuMetaHeader.tsx apps/web/src/components/modules/yohaku/YohakuMetaHeader.test.tsx
git commit -m "feat(yohaku): meta header chips"
```

---

## Task 9: YohakuRefAnchor

**Files:**
- Create: `apps/web/src/components/modules/yohaku/YohakuRefAnchor.tsx`
- Test: `apps/web/src/components/modules/yohaku/YohakuRefAnchor.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/modules/yohaku/YohakuRefAnchor.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { YohakuRefAnchor } from './YohakuRefAnchor'
import { YohakuProvider } from './YohakuProvider'

const anchor = vi.fn()
vi.mock('./YohakuProvider', async (orig) => {
  const m = await (orig as any)()
  return {
    ...m,
    useYohaku: () => ({ anchor, state: 'reading' }),
  }
})

describe('YohakuRefAnchor', () => {
  it('renders as a superscript link', () => {
    const { container } = render(
      <YohakuProvider nid="n1" lang="zh">
        <YohakuRefAnchor quote="念念不忘" section="§收束" />
      </YohakuProvider>,
    )
    const el = container.querySelector('[role="link"]')
    expect(el).not.toBeNull()
  })

  it('invokes anchor() on click with the right target', () => {
    const { container } = render(
      <YohakuProvider nid="n1" lang="zh">
        <YohakuRefAnchor quote="念念不忘" section="§收束" />
      </YohakuProvider>,
    )
    fireEvent.click(container.querySelector('[role="link"]')!)
    expect(anchor).toHaveBeenCalledWith({ quote: '念念不忘', section: '§收束' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuRefAnchor.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/modules/yohaku/YohakuRefAnchor.tsx
'use client'

import type { KeyboardEvent } from 'react'
import { useYohaku } from './YohakuProvider'

export function YohakuRefAnchor({ quote, section }: { quote: string; section?: string }) {
  const { anchor } = useYohaku()
  const onActivate = () => anchor({ quote, section })
  const onKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate()
    }
  }
  return (
    <span
      role="link"
      tabIndex={0}
      aria-label={section ? `跳至原文 ${section}` : '跳至原文'}
      onClick={onActivate}
      onKeyDown={onKey}
      className="yohaku-ref-anchor"
      data-yohaku-ref=""
      style={{
        display: 'inline-block',
        verticalAlign: 'super',
        fontSize: '0.7em',
        padding: '0 4px',
        borderRadius: 8,
        background: 'var(--yohaku-ref-bg, var(--accent, #d4a574))',
        color: 'var(--yohaku-ref-fg, #fff)',
        cursor: 'pointer',
        userSelect: 'none',
        lineHeight: 1.2,
      }}
    >
      ref
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuRefAnchor.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuRefAnchor.tsx apps/web/src/components/modules/yohaku/YohakuRefAnchor.test.tsx
git commit -m "feat(yohaku): <ref> anchor component"
```

---

## Task 10: YohakuContent (markdown + overrides)

**Files:**
- Create: `apps/web/src/components/modules/yohaku/YohakuContent.tsx`
- Test: `apps/web/src/components/modules/yohaku/YohakuContent.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/modules/yohaku/YohakuContent.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { YohakuContent } from './YohakuContent'

vi.mock('./YohakuProvider', () => ({
  useYohaku: () => ({ anchor: vi.fn() }),
}))

describe('YohakuContent', () => {
  it('renders markdown headings', () => {
    const md = '## TL;DR\n\nThe gist.'
    const { container } = render(<YohakuContent markdown={md} />)
    expect(container.querySelector('h2')?.textContent).toBe('TL;DR')
  })

  it('strips the trailer insights-meta comment before rendering', () => {
    const md = '## Body\n\nText.\n\n<!-- insights-meta: {"reading_time_min":1,"difficulty":"easy","genre":"x"} -->'
    const { container } = render(<YohakuContent markdown={md} />)
    expect(container.textContent).not.toContain('insights-meta')
  })

  it('renders <ref> as YohakuRefAnchor', () => {
    const md = 'Some text.<ref quote="念念不忘" section="§收束"/>'
    const { container } = render(<YohakuContent markdown={md} />)
    expect(container.querySelector('[data-yohaku-ref]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuContent.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/modules/yohaku/YohakuContent.tsx
import Markdown from 'markdown-to-jsx'
import { YohakuRefAnchor } from './YohakuRefAnchor'

function stripMetaTrailer(md: string): string {
  return md.replace(/<!--\s*insights-meta:[\s\S]*?-->/g, '').trimEnd()
}

export function YohakuContent({ markdown }: { markdown: string }) {
  const clean = stripMetaTrailer(markdown)
  return (
    <Markdown
      options={{
        overrides: {
          ref: { component: YohakuRefAnchor },
        },
      }}
    >
      {clean}
    </Markdown>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuContent.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuContent.tsx apps/web/src/components/modules/yohaku/YohakuContent.test.tsx
git commit -m "feat(yohaku): markdown content with <ref> override"
```

---

## Task 11: YohakuRibbon

**Files:**
- Create: `apps/web/src/components/modules/yohaku/YohakuRibbon.tsx`
- Test: `apps/web/src/components/modules/yohaku/YohakuRibbon.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/modules/yohaku/YohakuRibbon.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { YohakuRibbon } from './YohakuRibbon'

const toggle = vi.fn()

vi.mock('./YohakuProvider', () => ({
  useYohaku: () => ({ toggle, state: 'idle' }),
}))

describe('YohakuRibbon', () => {
  it('renders a button with aria-expanded=false in idle', () => {
    const { container } = render(<YohakuRibbon />)
    const btn = container.querySelector('button[data-yohaku-ribbon]')
    expect(btn).not.toBeNull()
    expect(btn!.getAttribute('aria-expanded')).toBe('false')
  })

  it('calls toggle() on click', () => {
    const { container } = render(<YohakuRibbon />)
    fireEvent.click(container.querySelector('button[data-yohaku-ribbon]')!)
    expect(toggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuRibbon.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/modules/yohaku/YohakuRibbon.tsx
'use client'

import { useYohaku } from './YohakuProvider'

export function YohakuRibbon() {
  const { toggle, state } = useYohaku()
  const active = state !== 'idle'
  return (
    <button
      type="button"
      data-yohaku-ribbon=""
      aria-expanded={active}
      aria-label={active ? '关闭余白' : '展开余白'}
      onClick={toggle}
      className="yohaku-ribbon"
      style={{
        position: 'absolute',
        top: -4,
        right: 24,
        writingMode: 'vertical-rl',
        padding: '14px 8px 10px',
        background: active ? 'var(--yohaku-ribbon-active, #8b6914)' : 'var(--yohaku-ribbon, var(--accent, #d4a574))',
        color: '#fff',
        fontWeight: 600,
        letterSpacing: '0.2em',
        fontSize: 12,
        borderRadius: '0 0 3px 3px',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
        zIndex: 10,
      }}
    >
      {active ? '关闭' : '余白'}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuRibbon.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuRibbon.tsx apps/web/src/components/modules/yohaku/YohakuRibbon.test.tsx
git commit -m "feat(yohaku): ribbon entry button"
```

---

## Task 12: YohakuNoticeChip

**Files:**
- Create: `apps/web/src/components/modules/yohaku/YohakuNoticeChip.tsx`
- Test: `apps/web/src/components/modules/yohaku/YohakuNoticeChip.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/modules/yohaku/YohakuNoticeChip.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { YohakuNoticeChip } from './YohakuNoticeChip'

const toggle = vi.fn()
vi.mock('./YohakuProvider', () => ({
  useYohaku: () => ({ toggle, state: 'idle', loading: false, error: null }),
}))

describe('YohakuNoticeChip', () => {
  it('renders a chip button with insights text', () => {
    const { container } = render(<YohakuNoticeChip />)
    const btn = container.querySelector('button[data-yohaku-chip]')
    expect(btn).not.toBeNull()
    expect(btn!.textContent).toContain('余白')
  })

  it('calls toggle() on click', () => {
    const { container } = render(<YohakuNoticeChip />)
    fireEvent.click(container.querySelector('button[data-yohaku-chip]')!)
    expect(toggle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuNoticeChip.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/modules/yohaku/YohakuNoticeChip.tsx
'use client'

import { useYohaku } from './YohakuProvider'

export function YohakuNoticeChip() {
  const { toggle, state, loading } = useYohaku()
  const active = state !== 'idle'
  return (
    <button
      type="button"
      data-yohaku-chip=""
      aria-expanded={active}
      onClick={toggle}
      disabled={loading}
      className="yohaku-notice-chip"
    >
      <span className="yohaku-notice-chip-dot" aria-hidden>◆</span>
      <span>{active ? '关闭余白' : '此文有余白'}</span>
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuNoticeChip.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuNoticeChip.tsx apps/web/src/components/modules/yohaku/YohakuNoticeChip.test.tsx
git commit -m "feat(yohaku): NoticeCard chip trigger"
```

---

## Task 13: YohakuNotePaper (desktop shell)

**Files:**
- Create: `apps/web/src/components/modules/yohaku/YohakuNotePaper.tsx`
- Test: `apps/web/src/components/modules/yohaku/YohakuNotePaper.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/components/modules/yohaku/YohakuNotePaper.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { YohakuNotePaper } from './YohakuNotePaper'

const close = vi.fn()
const dropPaper = vi.fn()
let state = 'reading'
let loading = false
let error: Error | null = null

vi.mock('./YohakuProvider', () => ({
  useYohaku: () => ({
    state,
    data: '## TL;DR\n\nBody.',
    meta: null,
    loading,
    error,
    close,
    dropPaper,
    reload: vi.fn(),
  }),
}))

vi.mock('./hooks/useYohakuLayout', () => ({
  useYohakuLayout: () => ({ mode: 'split' as const, noteW: 430, overlap: 80, slack: 0 }),
}))

describe('YohakuNotePaper', () => {
  it('renders null in idle state', () => {
    state = 'idle'
    const { container } = render(<YohakuNotePaper paperW={960} />)
    expect(container.firstChild).toBeNull()
    state = 'reading'
  })

  it('renders content when reading', () => {
    state = 'reading'
    loading = false
    error = null
    const { container, getByText } = render(<YohakuNotePaper paperW={960} />)
    expect(container.querySelector('[data-yohaku-note]')).not.toBeNull()
    expect(getByText('TL;DR')).not.toBeNull()
  })

  it('close × button calls close()', () => {
    state = 'reading'
    const { container } = render(<YohakuNotePaper paperW={960} />)
    fireEvent.click(container.querySelector('button[data-yohaku-close]')!)
    expect(close).toHaveBeenCalled()
  })

  it('calls dropPaper() when clicking the paper body in anchored state', () => {
    state = 'anchored'
    const { container } = render(<YohakuNotePaper paperW={960} />)
    const paper = container.querySelector('[data-yohaku-note]')!
    fireEvent.click(paper)
    expect(dropPaper).toHaveBeenCalled()
    state = 'reading'
  })

  it('renders loading skeleton when loading and no content yet', () => {
    state = 'reading'
    loading = true
    const { container } = render(<YohakuNotePaper paperW={960} />)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    loading = false
  })

  it('renders error UI with reload button on error', () => {
    state = 'reading'
    error = new Error('boom')
    const { container } = render(<YohakuNotePaper paperW={960} />)
    expect(container.querySelector('button[data-yohaku-reload]')).not.toBeNull()
    error = null
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuNotePaper.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/components/modules/yohaku/YohakuNotePaper.tsx
'use client'

import { useYohaku } from './YohakuProvider'
import { useYohakuLayout } from './hooks/useYohakuLayout'
import { YohakuContent } from './YohakuContent'
import { YohakuLoading } from './YohakuLoading'
import { YohakuMetaHeader } from './YohakuMetaHeader'
import { YOHAKU_LAYOUT } from './constants'

export function YohakuNotePaper({ paperW }: { paperW: number }) {
  const { state, data, meta, loading, error, close, dropPaper, reload } = useYohaku()
  const layout = useYohakuLayout(paperW)

  if (state === 'idle') return null
  if (layout.mode !== 'split') return null

  const isAnchored = state === 'anchored'
  const onPaperClick = () => {
    if (isAnchored) dropPaper()
  }

  const hasRealContent = data.length >= 20
  const showSkeleton = loading && !hasRealContent

  return (
    <aside
      data-yohaku-note=""
      aria-label="余白 · 精读手记"
      role="complementary"
      onClick={onPaperClick}
      className="yohaku-note-paper"
      style={{
        position: 'absolute',
        top: YOHAKU_LAYOUT.PAPER_TOP + YOHAKU_LAYOUT.NOTE_OFFSET_Y,
        left: `calc(${YOHAKU_LAYOUT.PAPER_LEFT_PCT}% + ${paperW}px - ${layout.overlap}px)`,
        width: layout.noteW,
        bottom: YOHAKU_LAYOUT.PAPER_BOTTOM + YOHAKU_LAYOUT.NOTE_OFFSET_Y,
        zIndex: isAnchored ? 1 : 2,
        cursor: isAnchored ? 'pointer' : 'default',
        overflowY: 'auto',
        padding: '18px 22px',
        background: 'var(--yohaku-note-bg, linear-gradient(180deg, #fffef5 0%, #fdf8e8 100%))',
        boxShadow: '-6px 6px 22px rgba(212,165,116,0.32)',
        borderRadius: 4,
      }}
    >
      <button
        type="button"
        data-yohaku-close=""
        aria-label="收起余白"
        onClick={(e) => { e.stopPropagation(); close() }}
        className="yohaku-close"
        style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: 'rgba(139,105,20,0.15)', color: '#8b6914', border: 'none', cursor: 'pointer' }}
      >×</button>

      <YohakuMetaHeader meta={meta} />

      {showSkeleton && <YohakuLoading />}

      {error && !loading && (
        <div className="yohaku-error">
          <p>余白召唤未果：{error.message}</p>
          <button
            type="button"
            data-yohaku-reload=""
            onClick={(e) => { e.stopPropagation(); reload() }}
          >重试</button>
        </div>
      )}

      {!error && hasRealContent && <YohakuContent markdown={data} />}
    </aside>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuNotePaper.test.tsx
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuNotePaper.tsx apps/web/src/components/modules/yohaku/YohakuNotePaper.test.tsx
git commit -m "feat(yohaku): desktop note paper shell"
```

---

## Task 14: useEscapeExit hook

**Files:**
- Create: `apps/web/src/components/modules/yohaku/hooks/useEscapeExit.ts`
- Test: `apps/web/src/components/modules/yohaku/hooks/useEscapeExit.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/web/src/components/modules/yohaku/hooks/useEscapeExit.test.ts
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEscapeExit } from './useEscapeExit'

describe('useEscapeExit', () => {
  it('calls handler on ESC keydown when active', () => {
    const onExit = vi.fn()
    renderHook(() => useEscapeExit(true, onExit))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('does nothing when inactive', () => {
    const onExit = vi.fn()
    renderHook(() => useEscapeExit(false, onExit))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onExit).not.toHaveBeenCalled()
  })

  it('ignores other keys', () => {
    const onExit = vi.fn()
    renderHook(() => useEscapeExit(true, onExit))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(onExit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/hooks/useEscapeExit.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement**

```ts
// apps/web/src/components/modules/yohaku/hooks/useEscapeExit.ts
'use client'

import { useEffect } from 'react'

export function useEscapeExit(active: boolean, onExit: () => void) {
  useEffect(() => {
    if (!active) return
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [active, onExit])
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/hooks/useEscapeExit.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/hooks/useEscapeExit.ts apps/web/src/components/modules/yohaku/hooks/useEscapeExit.test.ts
git commit -m "feat(yohaku): ESC exit hook"
```

---

## Task 15: useLayoutShift (CSS var bridge + animation orchestration)

**Files:**
- Create: `apps/web/src/components/modules/yohaku/hooks/useLayoutShift.ts`

No dedicated test — verified via visual QA and Provider integration tests. This hook is a thin side-effect wrapper.

- [ ] **Step 1: Implement**

```ts
// apps/web/src/components/modules/yohaku/hooks/useLayoutShift.ts
'use client'

import { useLayoutEffect } from 'react'
import { YOHAKU_FLASH, YOHAKU_LAYOUT, YOHAKU_MOTION } from '../constants'
import type { YohakuState } from '../types'

// Injects yohaku CSS variables onto :root at mount, toggles `yohaku-open`
// class on <body>, and exposes current state via a data attribute.
export function useLayoutShift(state: YohakuState) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const vars: Record<string, string> = {
      '--yohaku-paper-left-pct': `${YOHAKU_LAYOUT.PAPER_LEFT_PCT}%`,
      '--yohaku-anim-ms': `${YOHAKU_MOTION.ANIM_MS}ms`,
      '--yohaku-main-shift-delay-ms': `${YOHAKU_MOTION.MAIN_SHIFT_DELAY_MS}ms`,
      '--yohaku-note-slide-delay-ms': `${YOHAKU_MOTION.NOTE_SLIDE_DELAY_MS}ms`,
      '--yohaku-lift-y': `${YOHAKU_MOTION.LIFT_Y}px`,
      '--yohaku-side-opacity-reading': String(YOHAKU_MOTION.SIDE_OPACITY_READING),
      '--yohaku-side-grayscale': String(YOHAKU_MOTION.SIDE_GRAYSCALE),
      '--yohaku-side-fade-ms': `${YOHAKU_MOTION.SIDE_FADE_MS}ms`,
      '--yohaku-ease-paper': YOHAKU_MOTION.EASE_PAPER,
      '--yohaku-flash-ms': `${YOHAKU_FLASH.DURATION_MS}ms`,
      '--yohaku-flash-alpha': `${YOHAKU_FLASH.ALPHA}%`,
    }
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  }, [])

  useLayoutEffect(() => {
    document.body.dataset.yohakuState = state
    if (state === 'idle') document.body.classList.remove('yohaku-open')
    else document.body.classList.add('yohaku-open')
    return () => {
      delete document.body.dataset.yohakuState
      document.body.classList.remove('yohaku-open')
    }
  }, [state])
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/modules/yohaku/hooks/useLayoutShift.ts
git commit -m "feat(yohaku): layout shift side-effect hook (CSS vars + body class)"
```

---

## Task 16: Range-based flash utility + springScroll integration

**Files:**
- Create: `apps/web/src/components/modules/yohaku/flash.ts`
- Test: `apps/web/src/components/modules/yohaku/flash.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/web/src/components/modules/yohaku/flash.test.ts
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { flashRange } from './flash'

describe('flashRange', () => {
  let root: HTMLElement
  beforeEach(() => {
    vi.useFakeTimers()
    root = document.createElement('div')
    root.innerHTML = '<p>念念不忘，也没有回响。</p>'
    document.body.appendChild(root)
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.removeChild(root)
  })

  it('wraps the range with a .yohaku-flash mark and removes it after duration', () => {
    const range = document.createRange()
    const text = root.querySelector('p')!.firstChild!
    range.setStart(text, 0)
    range.setEnd(text, 4)
    flashRange(range, 1000)
    expect(root.querySelector('mark.yohaku-flash')).not.toBeNull()
    vi.advanceTimersByTime(1100)
    expect(root.querySelector('mark.yohaku-flash')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/flash.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement**

```ts
// apps/web/src/components/modules/yohaku/flash.ts
export function flashRange(range: Range, durationMs: number) {
  try {
    const mark = document.createElement('mark')
    mark.className = 'yohaku-flash'
    range.surroundContents(mark)
    setTimeout(() => {
      // unwrap: replace mark with its child nodes
      const parent = mark.parentNode
      if (!parent) return
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
      parent.removeChild(mark)
    }, durationMs)
  } catch {
    // surroundContents throws if range partially selects non-text — fallback: no-op
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/flash.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/flash.ts apps/web/src/components/modules/yohaku/flash.test.ts
git commit -m "feat(yohaku): Range-based flash mark utility"
```

---

## Task 17: Wire anchor → DOM scroll + flash

**Files:**
- Modify: `apps/web/src/components/modules/yohaku/YohakuProvider.tsx`
- Modify: `apps/web/src/components/modules/yohaku/YohakuProvider.test.tsx` (add test)

- [ ] **Step 1: Write failing test — anchor triggers springScroll + flash**

Append to `YohakuProvider.test.tsx`:

```tsx
import { springScrollToElement } from '~/lib/scroller'
vi.mock('~/lib/scroller', () => ({
  springScrollToElement: vi.fn(),
  springScrollTo: vi.fn(),
}))
vi.mock('./flash', () => ({
  flashRange: vi.fn(),
}))

import { flashRange } from './flash'

// helper: render a fake article root so locateQuoteRange finds content
function makeArticle(html: string) {
  const el = document.createElement('article')
  el.id = 'test-article-root'
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('YohakuProvider.anchor side effects', () => {
  it('calls flashRange and springScrollToElement when quote is found', async () => {
    const article = makeArticle('<p>念念不忘，也没有回响。</p>')
    const wrapperWithRoot = ({ children }: any) => (
      <YohakuProvider nid="n1" lang="zh" articleRootRef={{ current: article }}>{children}</YohakuProvider>
    )
    const { result } = renderHook(() => useYohaku(), { wrapper: wrapperWithRoot })
    await act(async () => { await result.current.open() })
    act(() => { result.current.anchor({ quote: '念念不忘', section: '§收束' }) })
    expect(flashRange).toHaveBeenCalled()
    expect(springScrollToElement).toHaveBeenCalled()
    document.body.removeChild(article)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuProvider.test.tsx
```

Expected: FAIL (Provider API does not yet accept `articleRootRef` nor trigger side effects)

- [ ] **Step 3: Modify `YohakuProvider.tsx`**

Change the Provider signature and `anchor` implementation:

```tsx
// apps/web/src/components/modules/yohaku/YohakuProvider.tsx  (modifications)
import type { ReactNode, RefObject } from 'react'
import { springScrollToElement } from '~/lib/scroller'
import { locateQuoteRange } from './parser/extractRefs'
import { flashRange } from './flash'
import { YOHAKU_FLASH, YOHAKU_REF, YOHAKU_SCROLL } from './constants'

export function YohakuProvider({
  nid,
  lang,
  articleRootRef,
  children,
}: {
  nid: string
  lang: string
  articleRootRef?: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  // … existing state setup …

  const anchor = useCallback((target: RefTarget) => {
    setCurrentRef(target)
    setState('anchored')
    const root = articleRootRef?.current ?? null
    if (!root) return
    const range = locateQuoteRange(root, target.quote)
    if (!range) {
      // eslint-disable-next-line no-console
      console.warn(
        '[yohaku] ref quote not found:',
        target.quote.slice(0, YOHAKU_REF.QUOTE_WARN_PREVIEW_CHARS),
      )
      return
    }
    // Wrap first, then scroll: mark becomes the scroll target element
    flashRange(range, YOHAKU_FLASH.DURATION_MS)
    const mark = root.querySelector('mark.yohaku-flash')
    if (mark instanceof HTMLElement) {
      springScrollToElement(mark, YOHAKU_SCROLL.ELEMENT_OFFSET)
    }
  }, [articleRootRef])
  // … rest unchanged …
}
```

Update the `useYohaku` context type to include `currentRef`, which already exists.

- [ ] **Step 4: Run tests — all Provider tests pass including new one**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuProvider.test.tsx
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuProvider.tsx apps/web/src/components/modules/yohaku/YohakuProvider.test.tsx
git commit -m "feat(yohaku): anchor triggers flash + springScroll on article DOM"
```

---

## Task 18: YohakuSheet (mobile drawer)

**Files:**
- Create: `apps/web/src/components/modules/yohaku/YohakuSheet.tsx`
- Test: `apps/web/src/components/modules/yohaku/YohakuSheet.test.tsx`

- [ ] **Step 1: Inspect Sheet API**

```bash
head -60 /Users/innei/git/innei-repo/Yohaku/apps/web/src/components/ui/sheet/Sheet.tsx
```

Note the exported components and their props. Expected names: `Sheet`, `SheetContent`, `SheetTrigger` (vaul-based). **If the API differs, adapt the implementation below to match.**

- [ ] **Step 2: Write failing test**

```tsx
// apps/web/src/components/modules/yohaku/YohakuSheet.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { YohakuSheet } from './YohakuSheet'

let state = 'idle'
const close = vi.fn()

vi.mock('./YohakuProvider', () => ({
  useYohaku: () => ({
    state,
    data: '## TL;DR\n\nBody.',
    meta: null,
    loading: false,
    error: null,
    close,
    reload: vi.fn(),
  }),
}))

vi.mock('./hooks/useYohakuLayout', () => ({
  useYohakuLayout: () => ({ mode: 'sheet' as const, noteW: 0, overlap: 0, slack: 0 }),
}))

describe('YohakuSheet', () => {
  it('does not render when idle', () => {
    state = 'idle'
    const { container } = render(<YohakuSheet paperW={800} />)
    expect(container.querySelector('[data-yohaku-sheet]')).toBeNull()
  })

  it('renders when reading', () => {
    state = 'reading'
    const { container } = render(<YohakuSheet paperW={800} />)
    expect(container.querySelector('[data-yohaku-sheet]')).not.toBeNull()
    state = 'idle'
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuSheet.test.tsx
```

Expected: FAIL

- [ ] **Step 4: Implement**

Adjust `Sheet` import to match actual exports found in Step 1.

```tsx
// apps/web/src/components/modules/yohaku/YohakuSheet.tsx
'use client'

import { Sheet, SheetContent } from '~/components/ui/sheet'
import { useYohaku } from './YohakuProvider'
import { useYohakuLayout } from './hooks/useYohakuLayout'
import { YohakuContent } from './YohakuContent'
import { YohakuLoading } from './YohakuLoading'
import { YohakuMetaHeader } from './YohakuMetaHeader'

export function YohakuSheet({ paperW }: { paperW: number }) {
  const { state, data, meta, loading, error, close, reload } = useYohaku()
  const layout = useYohakuLayout(paperW)
  if (layout.mode !== 'sheet') return null
  if (state === 'idle') return null

  const hasRealContent = data.length >= 20
  const showSkeleton = loading && !hasRealContent

  return (
    <Sheet open onOpenChange={(o) => { if (!o) close() }}>
      <SheetContent
        side="bottom"
        data-yohaku-sheet=""
        aria-label="余白 · 精读手记"
      >
        <YohakuMetaHeader meta={meta} />
        {showSkeleton && <YohakuLoading />}
        {error && !loading && (
          <div className="yohaku-error">
            <p>余白召唤未果：{error.message}</p>
            <button type="button" onClick={() => reload()}>重试</button>
          </div>
        )}
        {!error && hasRealContent && <YohakuContent markdown={data} />}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuSheet.test.tsx
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuSheet.tsx apps/web/src/components/modules/yohaku/YohakuSheet.test.tsx
git commit -m "feat(yohaku): mobile sheet drawer"
```

---

## Task 19: Sheet-before-scroll behavior on mobile ref tap

**Files:**
- Modify: `apps/web/src/components/modules/yohaku/YohakuProvider.tsx`
- Modify: `apps/web/src/components/modules/yohaku/YohakuProvider.test.tsx`

- [ ] **Step 1: Write failing test**

Append to `YohakuProvider.test.tsx`:

```tsx
describe('YohakuProvider anchor on mobile Sheet mode', () => {
  it('closes sheet before calling springScroll when layoutMode === "sheet"', async () => {
    const article = document.createElement('article')
    article.innerHTML = '<p>念念不忘</p>'
    document.body.appendChild(article)
    const wrapper = ({ children }: any) => (
      <YohakuProvider
        nid="n1" lang="zh"
        articleRootRef={{ current: article }}
        layoutModeRef={{ current: 'sheet' }}
      >{children}</YohakuProvider>
    )
    const { result } = renderHook(() => useYohaku(), { wrapper })
    await act(async () => { await result.current.open() })
    act(() => { result.current.anchor({ quote: '念念不忘' }) })
    // After anchor: state should be 'idle' (sheet closed) before scroll ran
    expect(result.current.state).toBe('idle')
    document.body.removeChild(article)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL (layoutModeRef not accepted; anchor doesn't close)

- [ ] **Step 3: Extend Provider**

```tsx
// apps/web/src/components/modules/yohaku/YohakuProvider.tsx  (modifications)
export function YohakuProvider({
  nid, lang, articleRootRef, layoutModeRef, children,
}: {
  nid: string
  lang: string
  articleRootRef?: RefObject<HTMLElement | null>
  layoutModeRef?: RefObject<'split' | 'sheet'>
  children: ReactNode
}) {
  // … existing …
  const anchor = useCallback((target: RefTarget) => {
    const isSheet = layoutModeRef?.current === 'sheet'
    if (isSheet) {
      // Close sheet first; defer scroll until after unmount frame
      setCurrentRef(null)
      setState('idle')
      requestAnimationFrame(() => {
        const root = articleRootRef?.current
        if (!root) return
        const range = locateQuoteRange(root, target.quote)
        if (!range) return
        flashRange(range, YOHAKU_FLASH.DURATION_MS)
        const mark = root.querySelector('mark.yohaku-flash')
        if (mark instanceof HTMLElement) {
          springScrollToElement(mark, YOHAKU_SCROLL.ELEMENT_OFFSET)
        }
      })
      return
    }
    // desktop split path (existing)
    setCurrentRef(target)
    setState('anchored')
    const root = articleRootRef?.current
    if (!root) return
    const range = locateQuoteRange(root, target.quote)
    if (!range) {
      console.warn('[yohaku] ref quote not found:', target.quote.slice(0, YOHAKU_REF.QUOTE_WARN_PREVIEW_CHARS))
      return
    }
    flashRange(range, YOHAKU_FLASH.DURATION_MS)
    const mark = root.querySelector('mark.yohaku-flash')
    if (mark instanceof HTMLElement) {
      springScrollToElement(mark, YOHAKU_SCROLL.ELEMENT_OFFSET)
    }
  }, [articleRootRef, layoutModeRef])
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku/YohakuProvider.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/YohakuProvider.tsx apps/web/src/components/modules/yohaku/YohakuProvider.test.tsx
git commit -m "feat(yohaku): close Sheet before scroll on mobile ref tap"
```

---

## Task 20: i18n messages

**Files:**
- Modify: `apps/web/src/messages/zh/common.json`
- Modify: `apps/web/src/messages/en/common.json`
- Modify: `apps/web/src/messages/ja/common.json`

- [ ] **Step 1: Add keys to zh**

Append under appropriate section (e.g. `"ai"` or root):

```json
"yohaku_ribbon": "余白",
"yohaku_ribbon_close": "关闭",
"yohaku_chip_open": "此文有余白",
"yohaku_chip_close": "关闭余白",
"yohaku_close_aria": "收起余白",
"yohaku_reload": "重试",
"yohaku_error": "余白召唤未果",
"yohaku_not_found": "原文位置未匹配",
"yohaku_paper_aria": "余白 · 精读手记"
```

- [ ] **Step 2: Add parallel keys to en**

```json
"yohaku_ribbon": "Yohaku",
"yohaku_ribbon_close": "Close",
"yohaku_chip_open": "Insights available",
"yohaku_chip_close": "Close insights",
"yohaku_close_aria": "Close yohaku",
"yohaku_reload": "Retry",
"yohaku_error": "Failed to load insights",
"yohaku_not_found": "Source passage not found",
"yohaku_paper_aria": "Yohaku · deep-reading notes"
```

- [ ] **Step 3: Add parallel keys to ja**

```json
"yohaku_ribbon": "余白",
"yohaku_ribbon_close": "閉じる",
"yohaku_chip_open": "この記事に余白あり",
"yohaku_chip_close": "余白を閉じる",
"yohaku_close_aria": "余白を閉じる",
"yohaku_reload": "再試行",
"yohaku_error": "余白の読み込みに失敗",
"yohaku_not_found": "該当箇所が見つかりません",
"yohaku_paper_aria": "余白 · 精読ノート"
```

- [ ] **Step 4: Wire keys into components**

Modify the four components that currently hardcode 中文 literals. Example for `YohakuRibbon.tsx`:

```tsx
import { useTranslations } from 'next-intl'
// inside component:
const t = useTranslations()
const label = active ? t('yohaku_ribbon_close') : t('yohaku_ribbon')
```

Apply to:
- `YohakuRibbon.tsx` — ribbon text + aria-label
- `YohakuNoticeChip.tsx` — chip text
- `YohakuNotePaper.tsx` — close aria + error message + reload text + aside aria-label
- `YohakuSheet.tsx` — same as above

Also update existing component tests to use `<NextIntlClientProvider>` wrappers (see project convention in other `*.test.tsx` files under `components/modules/note`).

- [ ] **Step 5: Run all yohaku tests**

```bash
pnpm --filter web test -- --run src/components/modules/yohaku
```

Expected: PASS (all)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/messages/ apps/web/src/components/modules/yohaku/
git commit -m "feat(yohaku): i18n messages and wire into components"
```

---

## Task 21: Integrate into Note detail page

**Files:**
- Modify: `apps/web/src/app/[locale]/notes/(note-detail)/detail-page.tsx`
- Modify: `apps/web/src/components/modules/note/NoticeCard.tsx` (only if new variant type needed)

- [ ] **Step 1: Read current detail-page.tsx**

```bash
sed -n '1,180p' /Users/innei/git/innei-repo/Yohaku/apps/web/src/app/[locale]/notes/\(note-detail\)/detail-page.tsx
```

Identify the `<IndentArticleContainer>` / `<NoteContent>` JSX block (around line 145) — the `<ref>` will locate against **that DOM subtree**, so we attach a ref to the article container.

- [ ] **Step 2: Modify detail-page.tsx**

Add imports:

```tsx
import { useRef } from 'react'
import { YohakuProvider, useYohaku } from '~/components/modules/yohaku/YohakuProvider'
import { YohakuRibbon } from '~/components/modules/yohaku/YohakuRibbon'
import { YohakuNoticeChip } from '~/components/modules/yohaku/YohakuNoticeChip'
import { YohakuNotePaper } from '~/components/modules/yohaku/YohakuNotePaper'
import { YohakuSheet } from '~/components/modules/yohaku/YohakuSheet'
import { useYohakuLayout } from '~/components/modules/yohaku/hooks/useYohakuLayout'
import { useEscapeExit } from '~/components/modules/yohaku/hooks/useEscapeExit'
import { useLayoutShift } from '~/components/modules/yohaku/hooks/useLayoutShift'
```

(Adjust barrel import paths — prefer `~/components/modules/yohaku`.)

Wrap the existing JSX. Inside the `PageInner` component body:

```tsx
const articleRef = useRef<HTMLElement | null>(null)
const layoutModeRef = useRef<'split' | 'sheet'>('split')
const PAPER_W = 960  // align with NoteMainContainer max-w
```

Create a small inner child component that calls `useYohakuLayout` + `useLayoutShift` + `useEscapeExit`, then use it:

```tsx
function YohakuIntegrations({
  articleRef,
  layoutModeRef,
  paperW,
}: {
  articleRef: React.RefObject<HTMLElement | null>
  layoutModeRef: React.MutableRefObject<'split' | 'sheet'>
  paperW: number
}) {
  const { state, close } = useYohaku()
  const layout = useYohakuLayout(paperW)
  layoutModeRef.current = layout.mode
  useLayoutShift(state)
  useEscapeExit(state !== 'idle', close)
  return (
    <>
      {layout.mode === 'split' && <YohakuNotePaper paperW={paperW} />}
      {layout.mode === 'sheet' && <YohakuSheet paperW={paperW} />}
    </>
  )
}
```

Wrap the whole page contents:

```tsx
return (
  <YohakuProvider
    nid={data.id!}
    lang={contentLang}
    articleRootRef={articleRef}
    layoutModeRef={layoutModeRef}
  >
    <>
      {/* existing JSX: NoteTitle, NoteMetaBar, NoticeCard, WrappedElementProvider... */}
      <NoticeCard className="my-4">
        {isTranslated && translationMeta && (
          <NoticeCardItem>
            <TranslationNoticeContent translationMeta={translationMeta} />
          </NoticeCardItem>
        )}
        <NoticeCardItem variant="summary">
          <SummarySwitcher articleId={data.id!} lang={contentLang} variant="inline" />
        </NoticeCardItem>
        <NoticeCardItem variant="insights">
          <YohakuNoticeChip />
        </NoticeCardItem>
      </NoticeCard>

      <WrappedElementProvider eoaDetect>
        {/* ... existing children ... */}
        <IndentArticleContainer
          prose={data.contentFormat !== 'lexical'}
          ref={articleRef}
        >
          <YohakuRibbon />
          <header className="sr-only"><NoteTitle /></header>
          <NoteContent contentFormat={data.contentFormat} />
        </IndentArticleContainer>
      </WrappedElementProvider>

      <YohakuIntegrations
        articleRef={articleRef}
        layoutModeRef={layoutModeRef}
        paperW={PAPER_W}
      />
    </>
  </YohakuProvider>
)
```

**Important:** `IndentArticleContainer` must forward refs. If it doesn't, wrap with a `<div ref={articleRef}>` around its instance instead.

- [ ] **Step 3: Add `variant="insights"` support to NoticeCardItem**

```bash
grep -n 'variant' /Users/innei/git/innei-repo/Yohaku/apps/web/src/components/modules/note/NoticeCard.tsx | head -20
```

If the variant is a typed union, extend it to include `'insights'`. If it's already `string`-typed, no change needed.

- [ ] **Step 4: Typecheck + run all yohaku tests**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web test -- --run src/components/modules/yohaku
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/notes/ apps/web/src/components/modules/note/NoticeCard.tsx
git commit -m "feat(yohaku): integrate into Note detail page"
```

---

## Task 22: Global styles + prefers-reduced-motion

**Files:**
- Create: `apps/web/src/components/modules/yohaku/yohaku.css`
- Modify: `apps/web/src/components/modules/yohaku/index.ts` (import css)

- [ ] **Step 1: Create stylesheet**

```css
/* apps/web/src/components/modules/yohaku/yohaku.css */
.yohaku-ref-anchor { transition: transform 0.15s, background 0.15s; }
.yohaku-ref-anchor:hover,
.yohaku-ref-anchor:focus-visible { background: var(--yohaku-ref-bg-hover, #8b6914); transform: translateY(-1px); }

.yohaku-flash {
  background: color-mix(in srgb, var(--accent, #d4a574) var(--yohaku-flash-alpha, 38%), transparent);
  transition: background var(--yohaku-flash-ms, 2000ms) ease-out;
}

.yohaku-note-paper {
  transition:
    left var(--yohaku-anim-ms, 450ms) var(--yohaku-ease-paper),
    width var(--yohaku-anim-ms, 450ms) var(--yohaku-ease-paper),
    transform var(--yohaku-anim-ms, 450ms) var(--yohaku-ease-paper),
    opacity var(--yohaku-anim-ms, 450ms) ease;
}

.yohaku-notice-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid var(--accent, #d4a574);
  border-radius: 999px;
  background: transparent;
  color: var(--accent-deep, #8b6914);
  font-size: 12px;
  cursor: pointer;
}
.yohaku-notice-chip[aria-expanded="true"] {
  background: var(--accent, #d4a574);
  color: #fff;
}

/* Sidebars fade when yohaku is open (scoped via body class) */
body.yohaku-open [data-hide-print] .yohaku-fadeable,
body[data-yohaku-state="reading"] .yohaku-fadeable,
body[data-yohaku-state="anchored"] .yohaku-fadeable {
  opacity: var(--yohaku-side-opacity-reading, 0.18);
  filter: grayscale(var(--yohaku-side-grayscale, 0.6));
  pointer-events: none;
  transition: opacity var(--yohaku-side-fade-ms, 200ms) ease;
}

@media (prefers-reduced-motion: reduce) {
  .yohaku-note-paper,
  .yohaku-flash { transition-duration: calc(var(--yohaku-anim-ms, 450ms) * 0.4); }
  .yohaku-flash { transition-duration: 600ms; }
}

@media print {
  .yohaku-ribbon,
  .yohaku-notice-chip,
  .yohaku-note-paper,
  [data-yohaku-sheet] { display: none !important; }
}
```

- [ ] **Step 2: Import in barrel**

```ts
// apps/web/src/components/modules/yohaku/index.ts
import './yohaku.css'
export * from './types'
export * from './constants'
export * from './YohakuProvider'
export { YohakuRibbon } from './YohakuRibbon'
export { YohakuNoticeChip } from './YohakuNoticeChip'
export { YohakuNotePaper } from './YohakuNotePaper'
export { YohakuSheet } from './YohakuSheet'
```

- [ ] **Step 3: Mark fadeable sidebars**

In detail-page.tsx and `components/modules/note/NoteLeftSidebar.tsx` / the `LayoutRightSidePortal` wrapper, add `className="yohaku-fadeable"` to the outer elements (non-invasive — only a class).

```bash
# find the two sidebars
grep -n 'NoteLeftSidebar\|NoteTocAside\|LayoutRightSidePortal' /Users/innei/git/innei-repo/Yohaku/apps/web/src/app/[locale]/notes/\(note-detail\)/detail-page.tsx
```

Add `yohaku-fadeable` next to existing `className` values. This is a one-line edit per sidebar container.

- [ ] **Step 4: Typecheck + tests**

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web test -- --run src/components/modules/yohaku
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modules/yohaku/yohaku.css apps/web/src/components/modules/yohaku/index.ts apps/web/src/app/[locale]/notes/ apps/web/src/components/modules/note/NoteLeftSidebar.tsx
git commit -m "feat(yohaku): global styles, reduced-motion, sidebar fade hooks"
```

---

## Task 23: Manual QA checklist

**Files:** none — run through the UI.

- [ ] **Step 1: Boot dev server**

```bash
cd /Users/innei/git/innei-repo/Yohaku
pnpm --filter web dev
```

Wait for "ready" in logs.

- [ ] **Step 2: Walk the verification items one by one**

Open a Note detail page and verify:

- (a) 常态下无 yohaku 元素溢出；NoticeCard 内有 "此文有余白" chip
- (b) 点右上 ribbon → 侧栏淡出 → 正文左移 → 笔记纸自右滑入（动画顺序与 §5 一致）
- (c) 点笔记纸 `ref` chip → 正文上浮 + 滚到对应段 + 高亮 ~2s 渐隐
- (d) 点笔记任意可见处 → 正文退回，笔记重登顶
- (e) ESC 键从 reading 或 anchored 态直退至 idle
- (f) × 按钮同上
- (g) Chip 与 ribbon 文案随状态切换（开 ↔ 关）
- (h) 缩浏览器到 `<lg` (1024px)：ribbon 隐，chip 仍在；chip click 开 Sheet；Sheet 内点 ref → Sheet 关 + 原文滚 + 高亮
- (i) `prefers-reduced-motion: reduce`（系统设置切换）下动画明显变快
- (j) Lighthouse a11y 快速扫：无 critical 问题

- [ ] **Step 3: Fix any issues inline via followup commits**

- [ ] **Step 4: Final lint + typecheck**

```bash
pnpm --filter web lint
pnpm --filter web exec tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: Commit any final polish**

```bash
git add -A
git commit -m "chore(yohaku): manual QA polish" --allow-empty
```

---

## Plan complete

23 tasks · Phase 1 foundations · Phase 2 core components · Phase 3 entries · Phase 4 ref jump + animation · Phase 5 mobile + styles · Phase 6 integration & QA.

Each task is independently verifiable (tests + commit). Subagent-driven execution is recommended: one task per subagent turn, review between.
