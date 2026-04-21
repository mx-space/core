# Yohaku · Note 页精读 companion 设计稿

- **日期**：2026-04-21
- **范围**：Yohaku 前端项目之 Note 页（`/notes/[id]`）
- **后端契约**：mx-core `ai-insights` SSE API（已落，见前稿 `2026-04-20-ai-insights-design.md` 与 `ai.prompts.ts` `insightsStream`）

---

## §1 目标与范围

### 目标

于 Note 页引入 "Yohaku 余白" 精读 companion。读者阅毕召唤一张 "手记副纸"，与原文纸并置。副纸含 `TL;DR / 情绪弧线 / 盲点 / 可摘句 / 悬而未决` 等骨架；以 `<ref>` 锚点双向互跳原文。

### 范围（in）

- Note 页（`/notes/[id]`）
- Desktop 原生双纸并置；移动端退化至通用 `Sheet` 组件
- 对接 mx-core `ai-insights` SSE API
- 复用项目现件：`components/modules/note/Paper`（若有，或 `NoteMainContainer`）、`components/ui/sheet/Sheet.tsx`、`lib/scroller#springScrollToElement`、`components/modules/note/NoticeCard`、`motion/react`

### 范围（out）

- Post 页（另案）
- Say / Thinking 等轻页
- 编辑器内作者预览
- 多语切换精读目标语（SSE 现单语）
- 离线持久化缓存

### 非目标

- 不替代现 `NoticeCard` 内 `SummarySwitcher`（仅加一 `variant="insights"` 同域）
- 不改 `NoteMainContainer` / `Paper` 既有 API
- 不引新动画库

### 验收

- 2xl 并置无溢出；xl~2xl 响应式压笔记宽 / 加重合；<lg 切 Sheet
- `<ref>` 能定位且高亮 ~2s
- 双纸对称交互：点任一可见处即该纸上浮
- ESC / × / 触发点 toggle 皆可退出
- 移动端以 Sheet 降级，ref click 先关 Sheet 再 scroll

---

## §2 组件层级与职责

新建目录 `apps/web/src/components/modules/yohaku/`。

### Context 层

- `YohakuProvider.tsx`
  - 状态：`'idle' | 'reading' | 'anchored'`
  - 数据：`{ data: string, meta: YohakuMeta | null, loading, error, hasFetched }`
  - 方法：`open() / close() / toggle() / anchor({quote, section}) / reload()`
  - 懒加载：首次 `open()` 触发 SSE fetch

### 呈现层

- `YohakuRibbon.tsx` — 书签触发，贴 `Paper` 右上；desktop only；双形（开/关闭文案）
- `YohakuNoticeChip.tsx` — 注入 `NoticeCard` 新 `NoticeCardItem variant="insights"`，同 toggle
- `YohakuNotePaper.tsx` — 笔记副纸（desktop ≥ `BREAKPOINT_SHEET_PX`）；含 × 关闭按钮；响应式宽度由 `useYohakuLayout` 控
- `YohakuSheet.tsx` — 移动端 drawer（沿 `components/ui/sheet`）
- `YohakuContent.tsx` — 渲染 insights markdown（沿 `components/ui/markdown`），含 `<ref>` override
- `YohakuRefAnchor.tsx` — `<ref>` 之 React 实装（上标 chip，click → `anchor`）
- `YohakuLoading.tsx` — skeleton（沿 `components/ui/loading`）
- `YohakuMetaHeader.tsx` — 笔记顶 chip：`reading_time_min / difficulty / genre`

### Hook 层

- `hooks/useYohakuLayout.ts` — 响应式算 note 宽 / overlap
- `hooks/useYohakuInsights.ts` — SSE stream + 缓存
- `hooks/useEscapeExit.ts` — ESC 订阅（仅 reading/anchored 监听）
- `hooks/useLayoutShift.ts` — Paper 位移 + 侧栏淡出协奏（motion `layout` 或 css vars）

### 辅助

- `parser/extractMeta.ts` — 尾部 `<!-- insights-meta: {...} -->` JSON 抽取
- `parser/extractRefs.ts` — quote → 原文 DOM Range 定位
- `constants.ts` — 所有可调常量集中（详见 §6.5）
- `types.ts` — `YohakuState / YohakuMeta / RefTarget`

### 集成点

- `app/[locale]/notes/(note-detail)/detail-page.tsx`：
  - 顶层包 `<YohakuProvider nid={id}>`
  - `NoticeCard` 内加 `<NoticeCardItem variant="insights"><YohakuNoticeChip /></NoticeCardItem>`
  - `Paper / NoteMainContainer` 内置 `<YohakuRibbon />`
  - 侧置 `<YohakuNotePaper />`（desktop）+ `<YohakuSheet />`（mobile，`OnlyMobile` 包）

---

## §3 状态机与交互 flow

### 三态

```
idle       · 未召唤；单纸居中；两侧栏显
reading    · 两纸并置；笔记上 (z:2)；两侧栏淡出
anchored   · 两纸并置；正文上浮 (z:3 + translateY)；笔记降 (z:1)
```

### 迁移

| 当前 | 事件 | 迁入 | 副作用 |
|---|---|---|---|
| idle | `open()` / ribbon click / chip click | reading | 触发 fetch（若无 `hasFetched`）+ layout shift |
| reading | ribbon "关闭" / chip off / × / ESC | idle | 笔记退场 + Paper 归中 + 侧栏显 |
| reading | click 正文可见处 | anchored | 正文 z 升 + translateY(-lift) |
| reading | click note `<ref>` | anchored | anchor + scroll + flash |
| anchored | click 笔记可见处 | reading | z 反换 |
| anchored | × / ESC | idle | 直退两步 |

### 约束

- 同 nid 再 open：用缓存 data，不重请求
- `<ref>` 点击若当前 idle：自动 `open()` + 待首 chunk 后再 anchor
- ESC / × 一律退到 idle，不保留中间态
- 进 reading：body 加 class `yohaku-open`（可用于阻滚 / 底色调整）；退 idle 清之

---

## §4 布局与响应式

### 断点与策略

| 断点 | 宽度 | 策略 |
|---|---|---|
| `2xl+` | ≥1536 | 原生双纸并置 · 理想参数 |
| `xl` | 1280–1535 | 双纸并置 · 压缩 note 宽 + 加 overlap |
| `lg` | 1024–1279 | 双纸并置 · 极限压缩；若仍溢则降 Sheet |
| `<lg` | <1024 | `YohakuSheet` 接管 |

### 响应式算法（`useYohakuLayout`）

目标参数见 `constants.ts` · `YOHAKU_LAYOUT`。

```
noteLeft = viewport_w * PAPER_LEFT_PCT / 100 + paper_w - overlap
noteRight = noteLeft + note_w
slack = viewport_w - RIGHT_PAD - noteRight

if slack < 0:
    overlap = min(OVERLAP_MAX, OVERLAP_TARGET + |slack|)
    re-calc
    if slack < 0:
        note_w = max(NOTE_MIN_W, note_w + slack)
if note_w < NOTE_MIN_W → 切 Sheet 模式
```

`paper_w` 取常态 Paper 宽（`NoteMainContainer` 实测 `Math.min(960, viewport_w - margins)`）

### 两侧栏淡出

进 reading/anchored 态：
- `NoteLeftSidebar` + `LayoutRightSidePortal` (`NoteTocAside`)：`opacity → SIDE_OPACITY_READING` + `grayscale SIDE_GRAYSCALE` + `pointer-events: none`
- 不拆 DOM，退出恢复

### Paper 位移

精读态：`main Paper` 从 `translateX(-50%) left:50%` 切至 `left: PAPER_LEFT_PCT%` + `translateX: 0`。用 `motion/react` 之 `layout` prop 或 CSS vars + transition。

### Sheet 降级

- `<lg`：不触 Paper 位移；ribbon 隐；`YohakuNoticeChip` 仍在
- Chip click → 开 `<YohakuSheet side="right">`（默认 80vh 可上拉全屏）
- Sheet 内 `<ref>` click → **先 Sheet close → 再 springScrollToElement**

### 打印态

`@media print`：yohaku 全隐，仅原文；不影响 NotePaper。

### z-index 栈

```
0   body / side
1   paper-main (reading)
2   paper-note (reading)
3   paper-main (anchored)
10  ribbon / chip / × 按钮
100 Sheet overlay
```

---

## §5 动画规格

### 协奏 `idle → reading`（总 ~`ANIM_MS`）

| 时序 | 元素 | 属性 | duration | easing |
|---|---|---|---|---|
| T0 | 两侧栏 | `opacity 1→SIDE_OPACITY_READING` + `grayscale 0→SIDE_GRAYSCALE` | `SIDE_FADE_MS` | ease-out |
| T0 + MAIN_SHIFT_DELAY_MS | paper-main | `left 50%→PAPER_LEFT_PCT%`, `translateX -50%→0` | `ANIM_MS - MAIN_SHIFT_DELAY_MS` | `EASE_PAPER` |
| T0 + NOTE_SLIDE_DELAY_MS | paper-note | `translateX(120%)→0` + `opacity 0→1` | `ANIM_MS - NOTE_SLIDE_DELAY_MS` | `EASE_PAPER` |

反向 `reading → idle` 倒放相同 stagger（note 先退、main 归中、侧栏显）。

### `reading ↔ anchored`（z-swap）

| 元素 | 属性 | duration | 备 |
|---|---|---|---|
| paper-main | `z 1→3` + `translateY 0→-LIFT_Y` + box-shadow 加深 | 220ms | ease-out |
| paper-note | `z 2→1` | 即时（无 transition） | |

cursor 同步切换。

### `<ref>` flash

- flash-on：瞬即（加 `.flash` class，无 transition）
- flash-off：`background transition FLASH.DURATION_MS ease-out` → transparent
- 高亮色：`color-mix(in srgb, var(--accent) FLASH.ALPHA%, transparent)`

### Spring scroll

`springScrollToElement(target, ELEMENT_OFFSET)`；沿 `lib/scroller.ts`；wheel/touch 中断。

### Loading skeleton

`opacity 0.3↔0.7` · `PULSE_MS` infinite；骨架 = H2 × `SKELETON_H2_COUNT` + bullets `SKELETON_BULLET_MIN`~`MAX`。

### `prefers-reduced-motion`

- transition duration × `REDUCED_MOTION_FACTOR`
- spring scroll → `window.scrollTo({top, behavior: 'auto'})`
- flash 缩至 600ms
- Paper 位移瞬切

---

## §6 `<ref>` 定位契约

### Tag 语法（后端 prompt 既定）

```xml
<ref quote="<原文逐字片段>" section="<译语位置提示>"/>
```

- `quote` 必选，原文 contiguous substring（XML-escaped）
- `section` 可选
- 自闭合，无 children

### 前端解析

`<YohakuContent>` 复用 `Markdown.tsx`（markdown-to-jsx），通过 `options.overrides`：

```ts
overrides: { ref: { component: YohakuRefAnchor } }
```

`<YohakuRefAnchor quote section />` 渲为上标 chip。click → Provider `anchor({quote, section})`。

### 定位算法

1. 取 `NoteMainContainer` DOM 根
2. `TreeWalker(SHOW_TEXT)` 累积 textNode 之 textContent
3. `indexOf(quote)` 取首现 offset
4. 回溯映射 offset → `Range(startNode, startOffset, endNode, endOffset)`
5. `range.getBoundingClientRect().top + window.scrollY` → y
6. `springScrollToElement` 或扩 `springScrollTo(y)`
7. 用 `range.surroundContents(<mark class="yohaku-flash">)`；FLASH.DURATION_MS 后 unwrap

### Fallback（quote 未命中）

- 记 `console.warn('[yohaku] ref quote not found:', quote.slice(0, QUOTE_WARN_PREVIEW_CHARS))`
- Toast 提示 "原文位置未匹配"（沿 Shiro / Yohaku 现 toast 系统）
- 仍 z-swap 至 anchored；不 scroll / 不 flash
- 不抛错

### XSS 防御

- 只操 textContent 与 Range API，绝不 `innerHTML` 拼接
- quote / section 作属性值由 markdown-to-jsx 默认 escape

### 多重匹配 / 跨段

- 取首现
- quote 跨段（含 newline）：累积串含段间空白，indexOf 可能失败 → fallback。后端 prompt 应约束 "同一段内"

---

## §6.5 常量集中化

单一源：`components/modules/yohaku/constants.ts`。

```ts
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

### CSS 变量桥

`<YohakuProvider>` `useLayoutEffect` 挂载时，`document.documentElement.style.setProperty('--yohaku-xxx', ...)`；CSS 仅读变量，不硬编数值。调参改 `constants.ts` 一处。

### 非常量

- `--accent` 沿 Yohaku 主题系统
- 文案 → i18n messages（`ai_key_insights` 等，新增 `yohaku.ribbon` 等），不在此

---

## §7 数据与加载

### 接口

调 `@mx-space/api-client` 之 `getInsights(nid)` SSE helper。返回：
- `onChunk(delta)` — markdown stream
- `onEnd(fullText)` — 流完
- `onError(err)` — 失败

Hook：`useYohakuInsights(nid): { data, meta, loading, error, reload, hasFetched }`

### 懒加载时序

```
idle ── open() ──► reading (loading=true, fetch)
                   │
                   └─ SSE chunk ──► data += delta (渐进渲)
                   └─ SSE end ──► extractMeta(data); loading=false
                   └─ SSE err ──► error=e; loading=false
```

### 缓存与 reload

| action | 行为 |
|---|---|
| 首次 open | fetch + stream |
| 二次 open（`hasFetched`） | 直用缓存 data |
| close 中途 | **不 abort** 流；后台完成 |
| reload | 强制重 fetch |
| nid 变 | Provider unmount，缓存释放 |

### Meta 解析

流完后正则抽取：

```ts
/<!--\s*insights-meta:\s*(\{[\s\S]*?\})\s*-->\s*$/
```

从末尾取末现 `-->`。`JSON.parse` 失败 → `meta=null`，不影响渲。meta 渲于 `YohakuMetaHeader`。

### 渐进渲染

- `data` 变即 re-render `<Markdown>`
- `<ref>` 在流中出现即渲；click / scroll / flash 自始可用
- 骨架屏条件：`loading && data.length < 20`；超阈即切渐进渲染

### 错误态

- 网络失败：×icon + "余白召唤未果" + 重试按钮（`reload()`）
- 4xx（未配置 AI / 无权限）："此文暂无余白"，无重试
- 超时（30s 无 chunk）：同网络失败路径

---

## §8 测试策略

### 栈

Vitest + React Testing Library（沿项目既定）

### 单元

- `extractMeta.ts`：happy / malformed / 无注释 / 多注释取末
- `extractRefs.ts`：跨 textNode / 含空白 / 未命中 / 多重取首
- `useYohakuLayout.ts`：不同 vw 断言 `{note_w, overlap}` 符预期
- `constants.ts`：型检

### 组件

- `YohakuProvider`：状态迁移 `idle→reading→anchored→reading→idle`；缓存二次 open 不 fetch
- `YohakuRefAnchor`：click 调 `anchor`；props 透传
- `YohakuRibbon` / `YohakuNoticeChip`：toggle click 触 open/close；ARIA
- `YohakuNotePaper`：渲 markdown + overrides；× 触 close
- `YohakuLoading`：条件 render
- `YohakuSheet`：`<lg` 渲；`≥lg` 不渲

### 集成（JSDOM）

- idle 点 ribbon → reading + loading → data 流入 → reading（loading off）
- reading 点正文 → anchored（z-swap，无 scroll/flash）
- reading 点 ref → anchored + `springScrollToElement` called + flash class 加
- ESC → idle
- reload 覆盖缓存
- SSE error → 错态 + 重试可点
- Mobile Sheet 内 ref click：Sheet close 后 scroll called

### Mock

- `@mx-space/api-client getInsights` → EventEmitter-like
- `lib/scroller#springScrollToElement` → spy
- `window.matchMedia` → 按 case 控响应式

### 可访问性

- Ribbon / Chip / × 有 `aria-label`
- Ribbon toggle `aria-expanded`
- `<ref>` `role="link"` + 键盘 focusable
- 笔记纸 `role="complementary" aria-label="余白 · 精读手记"`
- ESC 全局订阅仅 reading/anchored 态
- Focus trap 仅 Sheet 启用

### 不测

- 视觉回归（留）
- 真实 SSE 网络
- 性能压测（文长万字以内）

### 覆盖目标

Provider + parser + hooks 争 90%；组件 70%

---

## §9 开放问题 / YAGNI

### 已决（本稿内敲定）

- i18n 文案：`余白`
- meta chip：显 `reading_time_min / difficulty / genre`（效果不佳用户自删）
- 顶部 AI 容器：`NoticeCard` (Yohaku 项目现有)，chip 作新 `NoticeCardItem variant="insights"`
- Mobile Sheet 内 ref：先 Sheet close → 再 scroll

### 尚待定（实装时议）

- 权限 / rate limit：AI 调用成本；未查 mx-core backend 策略
- 退出态切到 idle 是否保留缓存 data：倾向保留（再次 open 即显）
- ribbon 视觉细节（色、字、书签尾 fold 样式）待视觉迭代
- meta chip 具体 iconography（时钟 / 难度色阶等）

### YAGNI（明确不做）

- 翻面 flip / marginalia 散便签
- 翻页音效 / 触觉反馈
- 笔记可编辑
- 跨 nid 持久缓存 / IndexedDB
- 导出 PDF / 分享图片
- 多语切换精读目标语
- AI 免责 banner（归 NoticeCard 统一）
- Visual regression
- 作者端预览

### 风险与缓解

| 风险 | 缓解 |
|---|---|
| quote 跨段无法定位 | 后端 prompt 约束单段；前端 fallback toast |
| 2xl 以下溢出 | 算法压缩 + Sheet 降级阈值 |
| AI 成本 | 懒加载 + 缓存；必要时加 rate-limit（后续） |
| markdown-to-jsx 不支 `<ref>` override | 已具 override 机制；实装 spike 先试 |
| stream 中断 / 连接断 | 错态 UI + reload；后台继续不 abort |

### 实装顺序（归 writing-plans 细排）

1. `constants.ts` + `YohakuProvider` 骨架
2. API 接入 + `useYohakuInsights` + loading/error
3. `YohakuContent` 渲染 + `<ref>` override
4. `YohakuRibbon` / `YohakuNoticeChip` 入口 + 状态迁移
5. `useYohakuLayout` 响应式
6. 动画协奏（`useLayoutShift`）
7. `YohakuSheet` 降级
8. `<ref>` 定位（`extractRefs` + Range + flash）
9. `YohakuMetaHeader`
10. 测试全套
11. i18n + a11y + `prefers-reduced-motion` 打磨

---

_设计稿终。转 writing-plans 阶段前需用户 review。_
