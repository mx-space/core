# Premium Article V2 — 实施计划

Spec（唯一权威）：`docs/superpowers/specs/2026-09-14-premium-article-v2-design.md`。每个 Task 的需求以 spec 对应章节为准，本文件只列改动面与验收。

## Global Constraints

- 零注释、零 JSDoc（见 `~/.claude/CLAUDE.md`）；文件 ≤ 500 行，React 组件 ≤ 300 行
- 不自动 commit 以外的 git 操作；每 Task 结束 commit 一次，message 用 conventional 前缀（`feat(core):` / `feat(admin):` / `feat(web):`），不加任何 attribution 行
- 只 lint / typecheck 改动过的文件；不跑整仓 build
- Core 响应遵守 `{ data, meta }` envelope（CLAUDE.md「API Response Rules」）；错误用 `AppException` 子类
- Migration 用 `mx-migration-author` skill 规则：expand-only，可与旧 pod 共存
- 不引入新依赖
- Yohaku 仓库：`/Users/innei/git/innei-repo/Yohaku`，分支 main；api-client 使用已发布的 `@mx-space/api-client@5.10.0`（Task 5 后发版）
- Yohaku 设计约束：`Yohaku/DESIGN.md` §3–§5（neutral-N、accent、禁 `shadow-lg`、`rounded-xl` 上限、CJK 字体）

## Task 1: Core — article_purchases 表、配置、可用性

Spec §3.3、§3.4。

- `packages/db-schema/src/schema/billing.ts`：新增 `articlePurchases` pgTable（字段、两个 unique 见 spec）
- `apps/core/src/database/migrations/0039_article_purchases.sql` + `meta/_journal.json`（用 drizzle-kit generate 或手写，格式对齐 0038）；`pnpm -C apps/core run lint:migrations` 通过
- `apps/core/src/modules/membership/article-purchase.repository.ts`：`ArticlePurchaseRepository extends BaseRepository`，方法 `findByReaderAndPost`、`findPaidPostIds(readerId, postIds)`、`upsertPaid(input)`、`markRefunded(provider, providerPaymentId)`；注册 `repository.tokens.ts` 与 membership module providers
- `configs.schema.ts` MembershipSchema 增 `articlePurchaseEnabled`、`articleProductId`（含 UI label/description，样式对齐 `monthlyProductId`）
- `membership.types.ts`：`resolveArticlePurchaseAvailability(config)`；`EntitlementService.isArticlePurchaseAvailable()`
- 测试：`membership.types.spec.ts` 增可用性用例；repository e2e（`membership.repository.pg.e2e.spec.ts` 同款，用 `create-e2e-test` skill 的 pg helper）覆盖 upsert 幂等 + markRefunded

## Task 2: Core — resolvePostEntitlement、free window、WS 脱敏

Spec §2、§3.1、§3.2、§8.1。

- `modules/post/post-paywall.util.ts`：`PostPaywallMetaSchema`（zod）、`readPaywallMeta(meta)`、`isInFreeWindow(meta, now)`、`applyFreeWindowOnPublish(meta, now)`
- `EntitlementService.resolvePostEntitlement(input)` 按 spec 七步短路；`isEntitledToPremium` / `isPremiumLocked` 改为薄封装，签名改为接收 `post: { id, isPremium, isPublished, meta }`
- 迁移四处调用点：`comment.controller.ts`、`article-body.service.ts`、`ai-insights.adapter.ts`、`ai-tts-query.service.ts`
- `post.service.ts create/update` 与 `publish.service.ts` 发布分支：满足条件时写入 `freeUntil`（spec §3.2 四种触发）
- `post.controller.ts getPaginate`：改走 `resolvePostEntitlement` 逐篇判定
- `visitor-event-dispatch.service.ts toPublicPostPayload`、`toPublicTranslationPayload`：premium 且非 free window 才截断
- 测试：`entitlement.service.spec.ts`（七分支 + freeUntil 边界）、`post-paywall.util.spec.ts`、`post.service.spec.ts`（发布写 freeUntil）、新 `visitor-event-dispatch.service.spec.ts`（三分支）

## Task 3: Core — PaywallMeta 扩展与 post 响应

Spec §5。

- `common/response/meta.types.ts PaywallMetaSchema`：`locked`、`previewBlocks?`、`freeUntil?`、`entitlement: { reason }`、`purchase?: { enabled, price? }`
- `post.controller.ts applyPaywall` → 返回完整 paywall meta；premium 文章无论 locked 与否都下发；price 走 `adapter.getPlanPricing(articleProductId)`（Task 4 之前 `purchase.price` 可为 undefined，`enabled` 依 `isArticlePurchaseAvailable() && meta.paywall.purchaseEnabled !== false`）
- `locked` 时 tts / summary 抑制逻辑保留
- 测试：`post.controller.spec.ts` 覆盖 free-window（不截断 + reason）、locked、purchase 读者不截断（mock repository）

## Task 4: Core — Dodo 单篇 checkout、webhook 分流、端点

Spec §4。

- `providers/provider.interface.ts`：`createArticleCheckout?`、`BillingWebhookResult` 可辨识联合、`NormalizedArticlePurchaseEvent`
- `dodo.provider.ts`：实现 `createArticleCheckout`；`verifyAndParseWebhook` 识别 `payment.succeeded`（`metadata.kind==='article'`）→ `paid`，`refund.succeeded` → `refunded`；无 kind 的 payment 事件继续 ignored；订阅事件返回 `{kind:'membership'}`
- `apple.provider.ts` 与 registry：适配新返回类型（Apple 恒返回 membership/ignored）
- `article-purchase.service.ts`：`applyEvent`（复用 `billingWebhookEvents` 幂等）、`hasPurchased`、`getPurchasedPostIds`
- `membership.service.ts applyEvent` / controller webhook：按 `kind` 分流
- `membership.controller.ts`：`POST /membership/article-checkout`、`GET /membership/article-purchases/:postId`；`GET /membership/plans` 增 `articlePurchase`
- 错误码：`ARTICLE_PURCHASE_UNAVAILABLE`、`ARTICLE_ALREADY_PURCHASED`、`ARTICLE_NOT_PURCHASABLE`（`app-error-code.ts` / `app-error-definitions.ts`）
- Task 3 的 `purchase.price` 接上真实 pricing
- 测试：`dodo.provider.spec.ts`（checkout metadata、两类事件分流、refund）、`article-purchase.service.spec.ts`、controller e2e（校验路径：未开启 / 非 premium / owner / 已购）

## Task 5: api-client

Spec §5 末段。

- `packages/api-client/models/base.ts PaywallMeta`；`models/membership.ts` 增 `ArticleCheckoutResult`、`ArticlePurchasedResult`、`MembershipPlansResult.articlePurchase`
- `controllers/membership.ts`：`articleCheckout(postId, returnPath?)`、`articlePurchased(postId)`
- 版本 bump 到 `5.10.0`（仅 package.json，不发布）
- 测试：`__tests__/controllers/membership.test.ts`

## Task 6: Admin — Membership 设置 Single Article Purchase

Spec §6.1。

- `features/settings/utils/membership.ts MembershipConfigValue` + `getMembershipSetupChecks`
- `MembershipConfigEditor.tsx` 新分节（Toggle + TextInput + 只读价格，价格来自 `GET /membership/plans`，新增 `api/membership.ts getMembershipPlans`）
- i18n `settings.membership.articlePurchase.*`（en-US / zh-CN）
- 测试：`membership.test.ts` 增 setup check 用例

## Task 7: Admin — PremiumArticlePanel

Spec §6.2、§6.3、§6.4。

- 新目录 `features/write/components/premium/`：`PremiumArticlePanel.tsx`（≤ 300 行，拆 `FreeWindowSection.tsx`、`PaywallPositionSection.tsx`（迁移现有 `PremiumPreviewControl` 逻辑）、`UnlockMethodsSection.tsx`、`PremiumStatusLine.tsx`）、`premium-status.ts`（`derivePremiumStatus(post, now)` 纯函数）、`paywall-meta.ts`（`resolvePaywallMeta` 四字段版，从 `WriteRouteViewsContent.tsx` 迁出）
- `WriteRouteViewsContent.tsx`：替换 Switch + `PremiumPreviewControl` 为 `PremiumArticlePanel`；form state 增 `freeWindowHours`、`freeUntil`、`purchaseEnabled`
- 全局 articlePurchase 未开启 → 单篇 Switch disabled + 提示
- 已发布文章：`+24h` / `+72h` / `修改时间`（DateTimePicker）/ `立即结束公开`；已归档：`重新公开 24h/72h` / `自定义`
- i18n `write.premium.*`，`write.postFields.premium` 改「Premium Article / 赞助者文章」
- 测试：`premium-status.test.ts`、`paywall-meta.test.ts`

## Task 8: Yohaku — 类型、Free Window、到期重载、WS 分流、已解锁态

Spec §7.1、§7.2、§7.7，§7.3 末两段。

- `lib/api/article-meta.ts` 用新 `PaywallMeta`；`useAvailablePlans` 暴露 `articlePurchase`
- `PostMetaBar` 增 free-window 项（`● 限时公开 · 剩 {time}`，`title` 绝对日期）
- `components/modules/membership/FreeWindowExpiryWatcher.tsx`：定时 refetch（> 24h 不设），`freeUntil` 变化重置
- WS `POST_UPDATE` 处理处：`reason ∈ {owner,purchase,membership}` 时忽略 payload 改 refetch bySlug
- `reason==='purchase'` 文末 hairline 行；`membership` 无标记；PaywallGate 对二者不渲染（改 `shouldUnlockPaywalledContent` 以 reason 为准）
- i18n 五语 `free_window`、`free_window_until`、`purchased`
- 测试：`should-unlock-paywall` 单测更新、`FreeWindowExpiryWatcher` 定时逻辑单测（fake timers）

## Task 9: Yohaku — PaywallGate、intent、单篇 checkout、返回、Checkout 文案、i18n

Spec §7.3、§7.4、§7.5、§7.6、§7.8。

- `PaywallGate.tsx` 重写（已登录双 CTA / 游客单 CTA + 弱注；CTA 组合规则）
- `paywall-intent.ts`：`PaywallIntent` 联合，`sessionStorage['yohaku:paywall-intent']`，替换 `yohaku:membership-intent`
- `useArticleCheckout(postId)` → `apiClient.membership.articleCheckout` → 硬跳转
- `MembershipReturnWatcher.tsx` 识别 `?purchase=success`：轮询 `articlePurchased` → refetch bySlug → `toast_purchased`；sponsor toast 改 `toast_sponsor`
- `CheckoutModal.tsx` 文案 + `yearly_equivalent`
- `messages/{en,zh,zh-TW,ja,ko}/membership.json` 按 spec §7.8 全表；删除废键并 grep 确认无引用
- 测试：`PaywallGate` 渲染组合（vitest + testing-library，若仓库已有同类测试则对齐）、intent 读写
