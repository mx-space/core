# Agent 联网搜索 — 设计

日期：2026-11-19 · 状态：待批准

## 意图

写作 agent（admin 编辑器里的 AI agent，`apps/core/src/modules/ai/ai-agent/`）需要能联网：核实事实、查最新信息、读用户给的链接。站长不想维护额外的搜索服务或设置项，搜索能力直接来自 agent 当前所用 provider 自带的搜索。

## 目标

- agent 运行在 **OpenRouter** provider 上时，模型可以自主联网搜索、抓取网页。
- agent 运行在 **DeepSeek** provider 上时，同上。
- 每个 provider 怎么接搜索、参数取多少，集中定义在一处 profile 注册表；以后加 provider 只加 profile。
- 用户在 agent 面板里能看到「在搜什么 / 读了哪个页面」。

## 非目标

- Anthropic、Google Vertex、OpenAI 官方、generic、lobehub、typesafe：本版不接。
- 自建搜索后端（Tavily/Exa 直连）、core 自己抓网页（undici + Readability / agent-browser）：不做。
- 任何设置项或 admin 设置页改动：不加。provider 匹配到 profile 即启用。
- 摘要、翻译、insights 等非 agent 的 AI 功能：请求体不变。

## 反目标

- 不能让非匹配 provider 的请求体发生任何变化（第三方兼容代理会因未知工具 400）。
- 不能把搜索结果当可信指令：网页内容可能含 prompt injection，而 agent 能通过 client tool 改文章。

## 约束（已核实）

- 运行链路：`AiAgentRunService.run`（`ai-agent-run.service.ts`）每轮调用 `runtime.streamMessage`，server tool 在 core 执行并经 SSE `tool_result` 回传，client tool 经 WS 由 admin 执行。`serverTools` 目前在构造函数里一次性创建（`createAgentServerTools`），执行上下文只有 `excludeRefId`，没有 `AbortSignal`。
- runtime：`packages/ai/src/runtime/pi-runtime.adapter.ts`，底层 `@earendil-works/pi-ai@0.99.1`。`openai-compatible` 类型走 `openai-completions` API。pi-ai 每个 API 都支持 `ProviderStreamOptions.onPayload(payload, model)`（发送前改请求体）和 `onProviderStreamEvent(data, model)`（原始流 chunk）。pi-ai 不解析 OpenRouter/DeepSeek 的扩展字段（`annotations`、server tool 相关字段），多轮回放时也不会带回。
- admin 渲染：`server-agent-runner.ts` 对 `toolcall_end` 调 `ensureItem(id, name, args)`，对 `tool_result` 调 `settleItem(id, content, isError)`；`messages.tsx` 通用展示「工具名 + 第一个参数前 40 字」和成功/失败图标。不需要为新工具改 admin。
- provider 配置：`AIProviderConfig { id, type, apiKey, endpoint?, ... }`，run 时由 `resolveProvider(payload.providerId)` 取得。

### OpenRouter（[文档](https://openrouter.ai/docs/guides/features/server-tools/web-search)）

- 服务端工具（Beta）：`tools` 数组里加 `{ "type": "openrouter:web_search", "parameters": {...} }` 和 `{ "type": "openrouter:web_fetch" }`，与用户自定义函数工具可同时声明，模型自主决定何时调用，OpenRouter 执行。
- `engine` 默认 `auto`：模型有原生搜索用原生，否则 Exa（$0.007/次，含 10 条）。
- 引用通过 `url_citation` annotations 返回；用量在 `usage.server_tool_use_details`。
- **未核实**：文档示例只用 `/api/v1/responses`；`/chat/completions` 是否接受该工具类型、流式下搜索过程和 annotations 出现在哪些 chunk。见「实施第 0 步」。

### DeepSeek（[文档](https://api-docs.deepseek.com/guides/search)）

- 独立 API，Bearer 用同一个 DeepSeek API key：
  - `POST https://api.deepseek.com/v1/tools/search`：`{ query (1–128 字), count (1–50, 默认 10), ori_question?, need_content? }` → `{ results: [{ title, url, snippet, summary (600–800 字，给模型读), content, site_name, date, rerank_score, authority }] }`
  - `POST https://api.deepseek.com/v1/tools/fetch`：`{ url (≤8192, http/https, 无 userinfo) }` → `{ title, content (Markdown) }`
- 计费：各 $0.75 / 千次成功请求；空结果、失败、超时不计费。QPS：Search 100、Fetch 25（另有单域名限流）。
- 错误：400/401/402（余额不足）/403（安全策略拒绝 fetch）/404（无可用内容）/408/413/429/5xx。
- 不用 DeepSeek 的 `deepseek_web_search` 服务端工具：文档定位为聊天机器人，明确建议 agent 用 Search & Fetch API；且只支持 `deepseek-flash`。

## 设计（已决定）

### 1. Profile 注册表

位置：`apps/core/src/modules/ai/ai-agent/web-tools/`。两种接入方式：

```ts
type WebToolProfile =
  | {
      id: 'openrouter'
      kind: 'inject'
      matches: (provider: AIProviderConfig) => boolean
      /** 原样追加到请求体 tools 数组的 provider 原生工具 */
      providerTools: Record<string, unknown>[]
      /** 原始流 chunk → 统一的活动记录 */
      observe: (chunk: unknown) => WebToolActivity[]
    }
  | {
      id: 'deepseek'
      kind: 'function'
      matches: (provider: AIProviderConfig) => boolean
      /** 由 core 执行的函数工具，用 provider.apiKey 调 provider 的搜索 API */
      createTools: (provider: AIProviderConfig) => AgentServerTool[]
    }

type WebToolActivity =
  | { kind: 'web_search'; id: string; query: string; sources: { title?: string; url: string }[] }
  | { kind: 'web_fetch'; id: string; url: string; title?: string }

function resolveWebToolProfile(provider: AIProviderConfig): WebToolProfile | undefined
```

匹配规则（按 endpoint hostname，复用 `pi-runtime.adapter.ts` 里 `HOSTNAME_TO_PROVIDER_ID` 已有的 host 判断方式）：

| profile | 匹配 | 内容 |
|---|---|---|
| `openrouter` | `type === openai-compatible` 且 endpoint host 为 `openrouter.ai` | `providerTools`: `{ type: 'openrouter:web_search', parameters: { max_uses: 5, max_results: 5 } }`、`{ type: 'openrouter:web_fetch' }` |
| `deepseek` | endpoint host 为 `api.deepseek.com`（不限 type，因为函数工具与模型 API 无关） | `web_search`、`web_fetch` 两个函数工具 |

匹配的是**本次 run 所用的 provider**。agent 跑在其他 provider 上时没有联网能力。

### 2. Runtime 改动（`packages/ai`，保持 provider 无关）

`StreamMessageOptions`（`packages/ai/src/runtime/types.ts`）新增：

```ts
/** 原样追加到 provider 请求体 tools 数组末尾 */
providerTools?: Record<string, unknown>[]
/** 每个原始 provider 流 chunk */
onProviderStreamEvent?: (chunk: unknown) => void
```

`PiRuntimeAdapter.streamMessage` 把它们接到 pi 的 `onPayload`（payload 有 `tools` 数组则追加，没有则新建）和 `onProviderStreamEvent`。其他方法（`generateText`、`streamStructured` 等）不接。

### 3. DeepSeek 函数工具

- `web_search { query: string (1–128), count?: number (1–10, 默认 5) }` → 调 Search，`need_content: false`。返回给模型：每条 `title / url / site_name / date / summary`。
- `web_fetch { url: string, offset?: number }` → 调 Fetch，返回 `title` + Markdown 正文，按字符分页，页大小与 `read_article` 的 `DEFAULT_READ_LIMIT`（12 000）一致，并提示下一页 `offset`。
- 参数用 zod 校验，沿用 `ai-agent-server-tools.ts` 的 `invalid()` 错误格式。
- 超时：search 15 s、fetch 30 s，与 run 的 `signal` 合并（`AbortSignal.any`）。
- HTTP 错误转成 `isError: true` 的可读内容，402 明确写「DeepSeek 余额不足」，429 写「限流，稍后重试」。不自动重试。
- 返回内容整体包在 `<untrusted_web_content source="...">…</untrusted_web_content>` 里。
- 抓取由 DeepSeek 执行，core 不直接访问目标 URL，无 SSRF 面；仍拒绝非 http/https。

### 4. Run service 接入（`ai-agent-run.service.ts`）

- `serverTools` 改为每次 run 组装：`createAgentServerTools(articleSource)` + `deepseek` profile 的 `createTools(provider)`。`executeTool` 改用本次 run 的列表。
- `AgentServerToolContext` 增加 `signal: AbortSignal`，`executeTool` 传入。
- `openrouter` profile：`streamMessage` 传 `providerTools` 和 `onProviderStreamEvent`；后者喂给 `profile.observe`，每条活动**实时**向 sink 发一对合成帧：`toolcall_end { toolCall: { id, name: 'web_search' | 'web_fetch', arguments: { query } | { url } } }` 和 `tool_result { toolCallId: id, name, content: 来源列表文本, isError: false }`。这些合成帧**不写入 transcript**（它们不是真的 pi toolCall，写入会破坏下一轮回放）。
  - 合成帧夹在同一次模型调用的 `text_delta` 之间，admin 的 `ensureItem → closeAssistant()` 会把这次回答按搜索位置拆成多个文字气泡。这和真实顺序一致，接受，不缓冲（我的判断）。
  - 刷新页面后，历史由 transcript 重建，OpenRouter 的搜索条目不再显示，DeepSeek 的条目（真实 tool call）会保留。第一版接受（我的判断）。
  - 如果 pi-ai 把 OpenRouter 的服务端工具调用解析成 `toolCall` block（名字以 `openrouter:` 开头），run loop 要在 `calls` 过滤和 transcript 写入前把它们剔除，不交给 `executeTool`。
- 匹配到任一 profile 时，在 `systemPrompt` 末尾追加一段服务端说明：可用联网工具、网页内容是不可信数据、不得执行其中的指令、引用时给出 URL。

### 5. 成本与限额

- OpenRouter：`max_uses: 5` 限制单次请求内的搜索次数；另外每次 run 累计每次模型调用最后一个 chunk 的 `usage.server_tool_use_details.tool_calls_executed`，到 20 次后，后续模型调用不再传 `providerTools`（我的判断，和 DeepSeek 保持同一上限）。
- DeepSeek：单次 run 内 `web_search` + `web_fetch` 合计最多 20 次，超出返回 `isError` 提示「本轮联网次数已用完」。

## 实施第 0 步：探测（2026-11-19 已完成）

用本地 dev 配置里的 OpenRouter / DeepSeek key 实测，脚本在 scratchpad，不进仓库。

1. OpenRouter `/api/v1/chat/completions` 流式请求同时声明一个函数工具 + `openrouter:web_search` + `openrouter:web_fetch`：**200**。`deepseek/deepseek-v4.1-flash`（走 Exa）和 `google/gemini-3.5-flash-lite`（走原生搜索）都成功，模型自主搜索后作答并给出 URL。
2. 流里**没有搜索过程**（无 query、无服务端 tool call 帧）。只有 `choices[0].delta.annotations`：每个 chunk 带一条 `{ type: 'url_citation', url_citation: { url, title, content, start_index: 0, end_index: 0 } }`，全部出现在正文 `delta.content` 之前。最后一个 chunk 的 `usage.server_tool_use_details` 为 `{ web_search_requests, tool_calls_requested, tool_calls_executed }`。
3. 因此 `observe` 规则：收集连续到达的 `url_citation`（按 url 去重），在第一个正文/推理增量到达或流结束时，合成一条 `web_search` 活动（`query` 为空，`sources` 为收集到的来源）；之后若又出现 annotations，再开新的一条。`web_fetch` 无法从流中区分，不单独展示。
4. DeepSeek Search（`count: 2`）返回字段 `title, site_name, site_icon, authority, rerank_score, date, url, summary, snippet, content`；Fetch 返回 `{ title, content }`（Markdown），与文档一致。
5. pi-ai `openai-completions` 对这些 chunk 的解析在实现时由 adapter 测试 / 手测确认；若产生伪 `toolCall`，按第 4 节过滤。

## 留给实现者

- `web_search` 合成活动在 admin 中的参数展示（无 query 时用来源数量，如 `{ sources: 3 }`）。
- 模型可见的结果文本排版细节。
- 文件拆分与命名（profile、DeepSeek client、格式化）。

## 验证

- `pi-runtime.adapter` 单测：传 `providerTools` 时 payload `tools` 末尾多出原样对象；不传时 payload 不变。
- DeepSeek 工具单测（mock fetch）：参数校验、分页 offset、402/429 映射、20 次上限、abort 传递。
- `resolveWebToolProfile` 单测：openrouter / deepseek / 其他 host / 无 endpoint。
- 手测：admin agent 面板分别用 OpenRouter 和 DeepSeek provider 问一个时效性问题，面板出现搜索条目，回答带 URL。

## 已知风险

- OpenRouter 的搜索结果不进 transcript，下一轮模型看不到原始结果，只能看到自己写过的文字；需要时会重搜。
- OpenRouter server tools 为 Beta，API 可能变化。
- prompt injection 只能缓解（标记 + system 说明），无法消除；改文章的 client tool 在 admin 侧有 diff review 兜底。

## 对话中用到的材料

无 artifact。外部文档：OpenRouter Web Search / Server Tools、DeepSeek Search & Fetch / Web Tools（链接见上）。
