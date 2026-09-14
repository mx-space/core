# Premium Article V2 — 限时公开 · 单篇解锁 · Sponsor

日期：2026-09-14
范围：mx-core（apps/core）、Admin（apps/admin）、api-client（packages/api-client）、Yohaku（../Yohaku/apps/web）
草案来源：用户提供的 MX Space Premium Article V2 draft

## 0. 目标与产品模型

```text
文章发布
   ↓
限时公开 immediately / 24h / 48h / 72h / 7d / custom（默认 72h）
   ↓
进入 Sponsor Archive
   ↓
┌───────────────────────┐
│ 单篇永久解锁 $2.99     │
│ 成为 Sponsor $5/月     │
│              $50/年   │
└───────────────────────┘
```

V2 在现有 Premium Article + Membership 之上增加：

1. 发布后限时公开（free window）
2. 单篇永久解锁（article purchase，一次性支付）
3. Admin 可视化配置与状态
4. Yohaku 新付费墙、限时公开提示、单篇购买流程与 login intent

明确不做（V2.1 或以后）：

- Apple IAP 单篇购买（Apple 一次性商品流程与 StoreKit 客户端改造，V2 仅 web/Dodo）
- Admin「预览付费墙」Drawer（草案 §20）
- 已购读者的弱 Sponsor upsell（草案 §18 末）
- Sponsor Archive 篇数统计文案「+ 42 篇」（草案 §11，需要 count 接口，后续加）
- Note / Page 的付费墙（现状仅 Post 有 `isPremium`）
- 退款后的自动通知、purchases 后台列表页

## 1. 现状（探查结论）

Core：

- `posts.is_premium` 列；`meta.paywall.previewBlocks` 存于 post JSON meta
- `EntitlementService.isEntitledToPremium({isOwner, readerId})`：owner 或有效会员。无逐篇、无时间维度
- `post.controller.ts applyPaywall`：`isPremium && isMembershipPurchasable() && !entitled` → 截断正文并返回 `{locked, previewBlocks}`；`getPaginate` 列表对所有人（含 owner）直接截断，未走 entitlement
- `PaywallMetaSchema = { locked, previewBlocks? }`（`common/response/meta.types.ts:135`），`PostMetaBuilder.paywall()`
- Membership：Dodo 为唯一已注册 provider，订阅 checkout → `checkoutSessions.create({product_cart, metadata:{readerId, plan}})`；webhook `POST /membership/webhook/:provider` 只处理订阅事件；`getPlanPricing(productId)` 通用 product retrieve 已存在（10 分钟缓存）
- 配置 `membership`（`configs.schema.ts:1050`）：enabled/provider/apiKey/webhookSigningKey/monthlyProductId/yearlyProductId/environment + Apple 字段
- 发布路径：`publish.service.ts:443 posts.updateById(refId,{isPublished:true})`、`post.service.ts create/update`
- 消费 `isPremium`/entitlement 的其他点：`comment.controller.ts`、`article-body.service.ts:148`、`ai-insights.adapter.ts:108`、`ai-tts-query.service.ts:137`
- 最新 migration：`0038_enrichment_fetch_state.sql`；billing 表定义在 `packages/db-schema/src/schema/billing.ts`

Admin：

- 编辑器 `WriteRouteViewsContent.tsx` 中 `Switch(isPremium)` + `PremiumPreviewControl`（slider + 截至摘录），`resolvePaywallMeta()` 写 `meta.paywall.previewBlocks`
- Membership 设置 `MembershipConfigEditor.tsx`，schema-driven，`update(key, value)` 模式
- Post 无 scheduled publish；`isPublished`、`createdAt` 可用
- UI 原语：`Switch/Toggle/Slider/SegmentedControl/DateTimePicker/Badge/StatusPill/PanelBlock`，无 RadioGroup

Yohaku：

- `PaywallGate.tsx`：divider + locked card，`meta.paywall.locked`，intent 存 `sessionStorage['yohaku:membership-intent'] = pathname`
- `CheckoutModal.tsx`：monthly/yearly，`apiClient.membership.checkout(plan, returnPath)` → 硬跳转
- `MembershipReturnWatcher.tsx`：`?membership=success` → 轮询 `membership.status()` 2s × 10
- `MembershipContentUnlocker.tsx`：会员态变化时 refetch `queries.post.bySlug` 替换正文
- 文案 `messages/{en,zh,zh-TW,ja,ko}/membership.json`
- 头部提示原语 `NoticeCard/NoticeCardItem`、`BannerNoticeItem`

## 2. Core 权限模型

新增单一入口 `EntitlementService.resolvePostEntitlement()`，所有付费墙判定必须经此，不再各处拼 `isPremium && isMember`。

```ts
type PostEntitlementReason =
  | 'public'       // 非 premium 文章
  | 'owner'
  | 'free-window'  // now < meta.paywall.freeUntil
  | 'purchase'     // article_purchases 命中
  | 'membership'   // 有效会员
  | 'locked'

type PostEntitlement = {
  reason: PostEntitlementReason
  locked: boolean            // reason === 'locked'
}

resolvePostEntitlement(input: {
  post: { id: string; isPremium: boolean; isPublished: boolean; meta?: unknown }
  isOwner: boolean
  readerId?: string
}): Promise<PostEntitlement>
```

判定顺序（短路）：

1. `!post.isPremium` → `public`
2. `isOwner` → `owner`
3. `freeUntil` 存在且 `now < freeUntil` → `free-window`
4. 无任何解锁渠道可购（`!membershipPurchasable && !articlePurchaseEnabled`）→ `public`（沿用现状：未配置支付时不锁）
5. `readerId` 且 purchases 命中（status = `paid`）→ `purchase`
6. `readerId` 且 active member → `membership`
7. 否则 `locked`

保留 `isEntitledToPremium` / `isPremiumLocked` 签名作为薄封装（内部走 `resolvePostEntitlement`），令 comment / article-body / ai-insights / ai-tts 四处调用点自动获得 free-window 与 purchase 语义；调用点需改为传入 post 对象（含 id、meta）而非仅 `isPremium`。

`getPaginate` 列表：改用 `resolvePostEntitlement` 逐篇判定后再截断；owner 与已解锁读者不截断。

## 3. 数据模型

### 3.1 `meta.paywall`（post JSON meta，无 migration）

```ts
meta.paywall = {
  previewBlocks?: number        // 现有
  freeWindowHours?: number      // 发布前意图；0 = 立即进入 Archive；缺省 = 72
  freeUntil?: string            // ISO；发布时由 core 写入；发布后 admin 可直接改
  purchaseEnabled?: boolean     // 缺省 true（全局 articlePurchase 开启时）
}
```

Zod：`PostPaywallMetaSchema` 放在 `post.schema.ts`，`freeWindowHours: z.number().int().min(0).max(24*365)`，`freeUntil: z.string().datetime()`。

### 3.2 `freeUntil` 写入时机

单一 helper `applyFreeWindowOnPublish(meta, now)`（`modules/post/post-paywall.util.ts`）：

- 若 `freeUntil` 已存在 → 不动
- 否则 `hours = meta.paywall.freeWindowHours ?? 72`；`hours === 0` → `freeUntil = now`；否则 `now + hours`

调用点（三处，均为 isPublished 由 false→true 或创建即 published 且 `isPremium`）：

- `post.service.ts create()`
- `post.service.ts update()`（transition）
- `publish.service.ts` 发布 post 分支（:443 附近）

`isPremium` 由 false → true 且文章已发布且无 `freeUntil` → 同样调用（此时 now 起算，作者随后可在 admin 改）。

`isPremium` 关闭不清理 `freeUntil`（再次开启时沿用；admin 可改）。

### 3.3 `article_purchases` 表（新 migration `0039_article_purchases.sql`，expand-only）

`packages/db-schema/src/schema/billing.ts`：

```ts
articlePurchases = pgTable('article_purchases', {
  id: snowflake pk,
  createdAt, updatedAt,
  readerId: bigint FK readers(id) cascade,
  postId:   bigint FK posts(id) cascade,
  provider: text notNull,              // 'dodo'
  providerPaymentId: text notNull,
  providerCustomerId: text,
  amount: integer notNull,             // minor units
  currency: text notNull,
  status: text notNull,                // 'paid' | 'refunded'
}, unique(readerId, postId), unique(provider, providerPaymentId))
```

Repository `ArticlePurchaseRepository extends BaseRepository`，注册 `repository.tokens.ts`。方法：`findByReaderAndPost`、`findPaidPostIds(readerId, postIds[])`、`upsertPaid(...)`、`markRefunded(provider, providerPaymentId)`。

### 3.4 全局配置 `membership`（`configs.schema.ts`）

新增字段：

```ts
articlePurchaseEnabled: z.boolean().optional()      // Single Article Purchase
articleProductId: z.string().optional()             // Dodo one-time product
```

`resolveArticlePurchaseAvailability(config)`：`enabled && provider 已注册 && apiKey && webhookSigningKey && articleProductId`。价格由 `adapter.getPlanPricing(articleProductId)` 读取（Dodo product retrieve 对一次性商品同样返回 price/currency；`interval` 为空时视作一次性）。

V2 所有文章同一单价。

## 4. Membership 模块扩展

### 4.1 Provider 接口

`PaymentProviderAdapter` 新增可选方法：

```ts
createArticleCheckout(input: {
  reader: ReaderIdentity
  postId: string
  productId: string
  returnUrl: string
}): Promise<{ checkoutUrl: string }>
```

Dodo 实现：`checkoutSessions.create({ product_cart:[{product_id, quantity:1}], metadata:{ readerId, postId, kind:'article' }, customer, return_url })`。

`verifyAndParseWebhook` 返回值扩展为可辨识联合：

```ts
type BillingWebhookResult =
  | { kind: 'membership'; event: NormalizedBillingEvent }        // 现有
  | { kind: 'article'; event: NormalizedArticlePurchaseEvent }
  | { kind: 'ignored'; reason: string }

type NormalizedArticlePurchaseEvent = {
  type: 'paid' | 'refunded'
  eventId: string
  occurredAt: Date
  readerId: string
  postId: string
  providerPaymentId: string
  providerCustomerId?: string
  amount: number
  currency: string
}
```

Dodo 事件映射：`payment.succeeded` 且 `metadata.kind === 'article'` → `paid`；`refund.succeeded` 且关联 payment 的 metadata.kind === 'article' → `refunded`。订阅相关 `payment.succeeded`（无 `kind`）继续忽略（现状）。

### 4.2 Service

`MembershipService.applyEvent` 分流：`kind==='article'` → `ArticlePurchaseService.applyEvent`。复用 `billingWebhookEvents` 幂等表（同 `(provider, eventId)` 唯一）。

`ArticlePurchaseService`（`modules/membership/article-purchase.service.ts`）：

- `applyEvent(event)`：`paid` → upsert `status='paid'`；`refunded` → `markRefunded`
- `hasPurchased(readerId, postId)`、`getPurchasedPostIds(readerId, postIds)`

### 4.3 Controller

新增：

```text
POST /membership/article-checkout   @ReaderAuth
  body: { postId: string, returnPath?: string }
  → { checkoutUrl }
  校验：DEMO_MODE 拒绝；articlePurchase 可用；post 存在且 isPremium 且 isPublished；
        meta.paywall.purchaseEnabled !== false；未购买；非 owner
  returnUrl 走 resolveMembershipReturnUrl 变体，追加 ?purchase=success

GET  /membership/article-purchases/:postId   @ReaderAuth
  → { purchased: boolean }
```

`GET /membership/plans` 响应新增：

```ts
articlePurchase: { enabled: boolean; price?: { amount, currency } }
```

Webhook 路由不变，仅分流。

错误码（`app-error-definitions.ts`）：`ARTICLE_PURCHASE_UNAVAILABLE`(400)、`ARTICLE_ALREADY_PURCHASED`(409)、`ARTICLE_NOT_PURCHASABLE`(400)。

## 5. Paywall Meta（API 响应）

`PaywallMetaSchema`：

```ts
{
  locked: boolean
  previewBlocks?: number
  freeUntil?: string
  entitlement: { reason: PostEntitlementReason }
  purchase?: { enabled: boolean; price?: { amount: number; currency: string } }
}
```

规则：

- premium 文章无论是否 locked 都返回 `paywall`（Yohaku 需据 `reason==='free-window'` 显示提示、`reason==='purchase'` 显示已解锁）；非 premium 不返回
- `purchase.price` 来自 `getPlanPricing(articleProductId)`（已缓存）；provider product id 不下发
- `locked` 时 `tts.available=false`；summary 照常下发（售点），但未解锁者不可触发生成
- 列表 `getPaginate` 不下发 entitlement 详情，仅截断

api-client `models/base.ts PaywallMeta` 同步；新增 `membership.articleCheckout(postId, returnPath?)`、`membership.articlePurchased(postId)`；`MembershipPlansResult.articlePurchase`。

## 6. Admin

### 6.1 Membership 设置

`MembershipConfigEditor` 新增分节「Single Article Purchase」：

```text
Enabled            [Toggle]  articlePurchaseEnabled
Product ID         [Text]    articleProductId
Price              只读，来自 GET /membership/plans（已配置时显示 $2.99；未配置显示 —）
```

`getMembershipSetupChecks` 增加 article product 检查（仅 enabled 时）。

### 6.2 文章编辑器 Premium 区（重构 `PremiumPreviewControl` → `PremiumArticlePanel`，独立文件 `features/write/components/premium/PremiumArticlePanel.tsx`，< 300 行，拆子组件）

结构（严格层级，不平铺三个 Switch）：

```text
Premium Article / 赞助者文章                       [Switch]
副文案：公开期结束后，文章将进入 Sponsor Archive。读者可以成为赞助者，或单独解锁这篇文章。

[状态条 StatusPill]   见 6.3

── 免费公开期 ──
SegmentedControl: 立即 | 24h | 48h | 72h | 7d | 自定义
  自定义 → 数字输入（小时）；已发布时 → DateTimePicker（绝对时间）
  预计文案（见 6.3）

── 付费墙位置 ──
副文案：进入 Sponsor Archive 后，未解锁读者可阅读到这里。
Slider 5 / 12 个内容块 · 截止于「…」   （现有逻辑保留）

── 解锁方式 ──
Sponsor              ✓  所有有效 Sponsor 均可阅读全文（只读，取决于全局 membership enabled）
单篇永久解锁         [Switch]  $2.99 · 永久访问
   全局 articlePurchase 未开启 → Switch 禁用 + 提示「在 设置 → Membership 开启」
```

字段映射：

| UI | 存储 |
|---|---|
| 公开期预设 | `meta.paywall.freeWindowHours`（未发布） |
| 绝对时间 / +24h / +72h / 立即结束 / 重新公开 | `meta.paywall.freeUntil`（已发布） |
| 付费墙位置 | `meta.paywall.previewBlocks` |
| 单篇解锁 | `meta.paywall.purchaseEnabled` |

已发布文章操作按钮：`+24h`、`+72h`、`修改时间`、`立即结束公开`（freeUntil = now）；已进入 Archive：`重新公开 24h`、`重新公开 72h`、`自定义结束时间`（freeUntil = now + n）。保存走现有 post 更新（PATCH meta），立即生效，无需重新发布。

`resolvePaywallMeta` 扩展为处理全部四字段；`isPremium=false` 时保留 `paywall` 中已有值不清除（仅停止生效）。改：现状关闭时剥离 `previewBlocks`，V2 改为保留。

### 6.3 状态可视化（`derivePremiumStatus(post, now)` 纯函数，单测）

| 条件 | StatusPill | 文案 |
|---|---|---|
| 未发布 | pending | 等待发布 · 发布后将免费公开 {N} 小时 / 发布后立即进入 Archive |
| 已发布，now < freeUntil | live | 限时公开中 · 剩余 {2 天 13 小时} · Sponsor Archive · {Sep 17, 18:32} |
| 已发布，now ≥ freeUntil（或无 freeUntil） | archived | Sponsor Archive · 未解锁用户只能阅读前 {n} 个内容块 |

解锁方式摘要行：`✓ Sponsor` / `— 单篇购买` 或 `✓ $2.99 单篇永久解锁`。

### 6.4 i18n（en-US / zh-CN）

`write.postFields.premium` → "Premium Article" / "赞助者文章"；新增 `write.premium.*` 命名空间承载 6.2/6.3 全部文案；`settings.membership.articlePurchase.*`。

## 7. Yohaku

### 7.1 类型与数据

`ArticleMetaView.paywall` 使用新 `PaywallMeta`。`useAvailablePlans` 扩展返回 `articlePurchase`。

### 7.2 Free Window 提示

`reason === 'free-window'`：并入 `PostMetaBar` 一项（不另起 NoticeCard）：`● 限时公开 · 剩 {time}`，accent 小圆点 + `text-neutral-7`，`title` 属性给绝对日期 `free_window_until`。`{time}` 相对时长（`2 天` / `13 小时` / `40 分钟`）。

### 7.3 PaywallGate 重写

divider：`Sponsor Archive`。Locked card 保持现有 gradient 卡片形态：

已登录：

```text
♡
继续阅读这篇文章
{locked_subtitle}

[成为赞助者 · $5/月]            主 CTA（accent 实心）
 访问全部 Sponsor Archive
[单篇解锁 · $2.99]              副 CTA（hairline 描边）
 永久访问这篇文章
```

游客：

```text
♡
继续阅读这篇文章
{locked_subtitle_guest}

[登录后继续]                    单一 CTA
单篇 $2.99 · 赞助者 $5/月       弱注 caption-11 neutral-6
```

登录后同一卡片切换为已登录态；intent 记录来源（§7.5），不自动弹 Sponsor modal。

CTA 组合：
- 仅会员可用 → 只显示 Sponsor；游客弱注只写赞助者价
- 仅单篇可用 → 单篇升为主 CTA
- 两者皆无 → 不渲染（core 此时也不会 locked）

`reason === 'purchase'`：不渲染 PaywallGate；文末 hairline 一行（与「最后更新」同级、同样式）`已永久解锁 · 最后更新 {date}`。
`reason === 'membership'`：不渲染 PaywallGate，正文不加任何标记；`badge_member` 仅保留于用户菜单。

### 7.4 Checkout

Sponsor：沿用 `CheckoutModal`，文案改为「成为赞助者 / 支持持续创作，并访问全部 Sponsor Archive」；年付显示「相当于 $4.17/月 · 节省 17%」（现有 `save_percent` 逻辑）；年付默认选中保留。

单篇：不进 Modal。`useArticleCheckout(postId)` → `apiClient.membership.articleCheckout(postId, currentReturnPath())` → `window.location.href = checkoutUrl`。

### 7.5 Login Intent

`sessionStorage['yohaku:paywall-intent']`：

```ts
type PaywallIntent =
  | { type: 'membership'; path: string }
  | { type: 'article-purchase'; path: string; postId: string }
```

替换现有 `yohaku:membership-intent`（string）。游客点「登录后继续」写入 `{type:'paywall', path}`（仅记路径）；登录后回到文章，卡片切为已登录态，由读者自行选择，不自动弹 Sponsor modal 亦不自动跳单篇 checkout。`PaywallIntent` 增 `paywall` 变体；`membership` / `article-purchase` 变体保留给其他入口（如用户菜单「成为赞助者」需登录时）。

### 7.6 支付返回

`MembershipReturnWatcher` 扩展识别 `?purchase=success`：轮询 `apiClient.membership.articlePurchased(postId)` 2s × 10；成功 → refetch `queries.post.bySlug`（复用 `MembershipContentUnlocker` 的 `setPostData` 路径）→ toast「文章已永久解锁」。Sponsor 成功 toast 改为「欢迎成为赞助者，全部 Sponsor Archive 已解锁」。

`shouldUnlockPaywalledContent` 改为依据 `meta.paywall.locked` 与 refetch 结果，不在 client 手改 `locked`。

### 7.7 Free Window 到期 · 无刷新重载

`FreeWindowExpiryWatcher`（挂于 `PostDetailClient`）：`reason === 'free-window'` 且 `freeUntil` 存在时，`setTimeout(freeUntil - now + 1s)`（> 24h 不设）；触发 → refetch `queries.post.bySlug` → `setPostData`；服务端此时返回截断正文 + `locked=true`，PaywallGate 自然出现。`freeUntil` 变化（WS 更新）时重置定时器。

WS `POST_UPDATE` 到达时：
- 若当前 `reason ∈ {owner, purchase, membership}` → 忽略 WS 正文，refetch bySlug（带 auth，拿全文）
- 否则按 WS payload 更新（payload 已按 §8 规则脱敏）

### 7.8 文案

`messages/*/membership.json` 键集（zh / en；zh-TW / ja / ko 由实现者按 en 翻译）：

| key | zh | en |
|---|---|---|
| divider | Sponsor Archive | Sponsor Archive |
| locked_title | 继续阅读这篇文章 | Continue reading |
| locked_subtitle | 这篇文章的限时公开已经结束，现在收录于 Sponsor Archive。你可以单独解锁，或成为赞助者访问全部存档文章。 | This article's free access period has ended and it is now part of the Sponsor Archive. Unlock this article once, or become a sponsor to access the full archive. |
| locked_subtitle_guest | 这篇文章的限时公开已经结束，现在收录于 Sponsor Archive。登录后即可单独解锁，或成为赞助者。 | This article's free access period has ended and it is now part of the Sponsor Archive. Sign in to unlock it, or become a sponsor. |
| cta_login | 登录后继续 | Sign in to continue |
| guest_price_hint | 单篇 {article} · 赞助者 {sponsor}/月 | {article} per article · {sponsor}/month as a sponsor |
| cta_sponsor | 成为赞助者 · {price}/月 | Become a sponsor · {price}/month |
| sponsor_caption | 访问全部 Sponsor Archive | Access the full Sponsor Archive |
| cta_purchase | 单篇解锁 · {price} | Unlock this article · {price} |
| purchase_caption | 永久访问这篇文章 | Permanent access |
| free_window | 限时公开 · 剩 {time} | Free for {time} more |
| free_window_until | {date} 进入 Sponsor Archive | Enters the Sponsor Archive on {date} |
| purchased | 已永久解锁 | Unlocked permanently |
| checkout_title | 成为赞助者 | Become a sponsor |
| checkout_subtitle | 支持持续创作，并访问全部 Sponsor Archive。 | Support ongoing writing and access the full Sponsor Archive. |
| yearly_equivalent | 相当于 {price} / 月 | Equivalent to {price} / month |
| toast_purchased | 文章已永久解锁 | Article unlocked permanently |
| toast_sponsor | 欢迎成为赞助者，全部 Sponsor Archive 已解锁 | Welcome, sponsor. The full Sponsor Archive is unlocked. |
| toast_confirming | 确认支付中 | Confirming payment… |
| badge_member | Sponsor | Sponsor |
| menu_become_member | 成为赞助者 | Become a sponsor |

删除：`cta_subscribe`、`sponsor_unlocked`、`unlocked`。保留：`plan_monthly / plan_yearly / per_* / billed_each / save_percent / checkout_note / checkout_continue / checkout_failed / activating / activating_pending / expire_at`。

视觉对稿：https://claude.ai/code/artifact/7d52f476-fc1a-4704-b333-e60ccd90d7e6

## 8. 安全与边界

### 8.1 WS payload 脱敏（`visitor-event-dispatch.service.ts`）

Socket 无 reader 身份，故按「最保守」广播。`toPublicPostPayload(doc)` 改为：

- `!isPremium` → 原样
- `isPremium` 且 `now < meta.paywall.freeUntil` → 原样（公开期）
- 否则 → `text/content` 截断为 `previewBlocks`（现状 `getPublicText/getPublicContent`）

覆盖 `POST_CREATE / POST_UPDATE / POST_REPUBLISH`；`broadcastWithTranslation` 内每个 lang 分组亦经此函数（现已如此）。`TRANSLATION_UPDATE` 对 premium 非公开期文章剔除 `text/summary`（现状，加 free-window 判断）。已付费读者由 Yohaku 收到事件后自行 refetch（§7.7）。单测：`visitor-event-dispatch` premium 三分支。

### 8.2 其他

- `article-checkout` 仅 `@ReaderAuth`；postId 校验存在 + premium + published；owner 拒绝
- webhook 必须带 `metadata.readerId` + `metadata.postId`，缺失 → ignored 并 log（同订阅现状）
- 幂等：`billingWebhookEvents (provider, eventId)`；purchases `(provider, providerPaymentId)` 唯一
- 退款：`refund.succeeded` → `status='refunded'`，entitlement 立即失效
- `freeUntil` 由服务端写入；admin 修改经 owner `@Auth` 的 post 更新路径
- 缓存：post 详情响应经 `cache.interceptor` 已按 premium 分流（现状）；free-window 过期属时间函数，detail 缓存 TTL 须 ≤ 60s 或 premium 文章绕过缓存（实现时确认现有分流逻辑）

## 9. 测试

Core（vitest）：

- `entitlement.service.spec.ts`：七条分支顺序、free-window 边界（等于 freeUntil 视为过期）
- `post-paywall.util.spec.ts`：`applyFreeWindowOnPublish` 三种输入
- `article-purchase.service.spec.ts`：paid / refunded / 重复事件
- `dodo.provider.spec.ts`：article checkout metadata、`payment.succeeded` 分流、`refund.succeeded`
- `membership.controller` e2e：article-checkout 校验路径（`create-e2e-test` skill）
- `post.controller.spec.ts`：paywall meta 新字段、purchase 读者不截断

Admin（vitest）：`derivePremiumStatus`、`resolvePaywallMeta` 四字段。

api-client：`membership.test.ts` 新方法。

Yohaku：`PaywallGate` CTA 组合渲染快照、intent 读写、`shouldUnlockPaywalledContent`。

## 10. 实施拆分（执行顺序）

Core：

1. schema + migration `0039_article_purchases` + repository + config 字段 + availability
2. `resolvePostEntitlement` + `applyFreeWindowOnPublish` + 三处发布 hook + 四处调用点迁移 + `getPaginate` 修正
3. PaywallMeta 扩展 + post.controller 输出
4. Dodo article checkout + webhook 分流 + `ArticlePurchaseService` + controller 端点 + plans 响应 + 错误码
5. api-client 类型与方法

Admin：

6. Membership 设置 Single Article Purchase 分节
7. `PremiumArticlePanel`（状态、公开期、付费墙位置、解锁方式）+ `derivePremiumStatus` + i18n

Yohaku：

8. 类型 + Free Window 提示 + `FreeWindowExpiryWatcher` + WS 更新分流 + 已购/会员态
9. PaywallGate 重写 + intent + 单篇 checkout + ReturnWatcher + Checkout 文案 + i18n 五语

Core 追加：

2b. WS payload 脱敏（§8.1），并入 Task 2

每步独立可 review；1–5 不依赖 Admin/Yohaku；8–9 依赖 5（api-client 本地 link）。
