# AI Summary 自动生成开关拆分 — 与 Insights 对齐

- 日期：2026-04-21
- 关联：`docs/superpowers/specs/2026-04-20-ai-insights-design.md`
- 作者：Innei

## 背景

当前 AI 摘要（summary）只有一个自动生成开关 `enableAutoGenerateSummary`，同时控制文章 **创建** 与 **更新** 两个时机的触发。
而新落地的 AI Insights 已采用更细粒度的二元开关 `enableAutoGenerateInsightsOnCreate` / `enableAutoGenerateInsightsOnUpdate`。

两者职责类似（均为按文章生命周期触发的派生内容生成任务），但开关粒度不一致。用户界面与心智模型分裂，亦无法单独关闭 "文章修改后重新生成摘要" 这一常见需求。

## 目标

- Summary 自动生成开关拆为 `enableAutoGenerateSummaryOnCreate` / `enableAutoGenerateSummaryOnUpdate`，与 Insights 对齐。
- 旧字段 `enableAutoGenerateSummary` 删除；写 migration 将旧值同时复制到二新字段，保证升级后行为不变。
- 更新行为仍保留现有 "仅当内容 hash 变化的 lang 重新生成" 语义，新开关仅作闸门。

## 非目标

- 不调整 `enableAutoGenerateTranslation` 粒度（翻译当前亦为单开关，日后可另议）。
- 不改 summary 模型、prompt、stream、cache 机制。
- 不改前端 UI 字段命名与排版以外的逻辑。

## 设计

### 配置 schema

`apps/core/src/modules/configs/configs.schema.ts` 中 `AISchema`：

```ts
// 删除
enableAutoGenerateSummary: field.toggle(...)

// 新增
enableAutoGenerateSummaryOnCreate: field.toggle(
  z.boolean().optional(),
  '文章创建时自动生成摘要',
  { description: '需同时启用 enableSummary' },
),
enableAutoGenerateSummaryOnUpdate: field.toggle(
  z.boolean().optional(),
  '文章更新时重新生成摘要',
  { description: '仅在源文本 hash 变化的语言重新生成；需同时启用 enableSummary' },
),
```

### 默认值

`apps/core/src/modules/configs/configs.default.ts`：

```ts
ai: {
  ...
  enableAutoGenerateSummaryOnCreate: false,
  enableAutoGenerateSummaryOnUpdate: false,
  // 删：enableAutoGenerateSummary
}
```

### Service 分支

`apps/core/src/modules/ai/ai-summary/ai-summary.service.ts`：

```ts
@OnEvent(POST_CREATE) @OnEvent(NOTE_CREATE)
async handleCreateArticle(event) {
  if (!aiConfig.enableSummary || !aiConfig.enableAutoGenerateSummaryOnCreate) return
  // ... 原有逻辑不变
}

@OnEvent(POST_UPDATE) @OnEvent(NOTE_UPDATE)
async handleUpdateArticle(event) {
  if (!aiConfig.enableSummary || !aiConfig.enableAutoGenerateSummaryOnUpdate) return
  // ... 原有 hash diff 过滤 outdatedLanguages 逻辑不变
}
```

### Migration

新增 `apps/core/src/migration/version/v11.4.0.ts`（版本号待 bump 时定）：

```ts
import { defineMigration } from '../helper'

export default defineMigration(
  'v11.4.0-split-ai-summary-auto-generate',
  async (db) => {
    const col = db.collection('options')
    const aiConfig = await col.findOne({ name: 'ai' })
    if (!aiConfig?.value) return

    const value = aiConfig.value as Record<string, any>

    // 幂等：若已拆分，则跳过
    const hasNew =
      'enableAutoGenerateSummaryOnCreate' in value ||
      'enableAutoGenerateSummaryOnUpdate' in value
    if (hasNew) return

    const legacy = value.enableAutoGenerateSummary === true
    const next = { ...value }
    next.enableAutoGenerateSummaryOnCreate = legacy
    next.enableAutoGenerateSummaryOnUpdate = legacy
    delete next.enableAutoGenerateSummary

    await col.updateOne({ name: 'ai' }, { $set: { value: next } })
  },
)
```

版本号：项目 package.json 当前 `11.3.1`，取 `v11.4.0` 为本次 bump 目标；若版本另有规划，迁至对应文件。

### 测试

- `apps/core/test/src/modules/ai/ai-summary.service.spec.ts`
  - mock 中 `enableAutoGenerateSummary` → 替换为 `enableAutoGenerateSummaryOnCreate` / `enableAutoGenerateSummaryOnUpdate`
  - 新增用例：
    1. create 事件 + onCreate=false → 不建任务
    2. create 事件 + onCreate=true → 建任务
    3. update 事件 + onUpdate=false → 不建任务
    4. update 事件 + onUpdate=true + hash 变化 → 仅为 outdated lang 建任务
    5. update 事件 + onUpdate=true + 无 hash 变化 → 不建任务
- `apps/core/test/src/migration/v8.5.0.spec.ts` 中 mock 值引用旧字段，无业务影响，按需替换为新字段。
- 新增 `apps/core/test/src/migration/v11.4.0.spec.ts`：覆盖 legacy=true/false/缺失 三场景 + 幂等校验。

### 前端

后台面板字段自动从 schema 派生，无需手改。校验新字段在 "AI 设定" 分区出现，旧字段消失。

## 风险与权衡

- **破坏性变更**：旧字段直接删除，未升级至含本 migration 的版本前写入 config 的客户端会丢失字段；但 migration 幂等且在 startup 自动执行，升级后首次启动即完成转换，属可接受。
- **api-client / webhook 包若引用旧字段**：需搜索确认；预期无直接依赖。
- **向后 API 兼容**：config GET/PATCH 走 schema 校验，旧字段被移除后，未升级的 admin 前端若仍尝试 PATCH 旧字段，会被 schema 拒绝或静默 drop（取决于 schema 的 passthrough 策略）。因 admin 与 core 为同仓或相近版本发布节奏，风险低。

## 验证

- `pnpm lint`（仅改动文件范围）
- `pnpm test -- test/src/modules/ai/ai-summary.service.spec.ts`
- `pnpm test -- test/src/migration/v11.4.0.spec.ts`
