# Apple Sign-in App Review demo 账号

日期：2026-08-15
状态：已与用户确认方案 A

## 背景

iOS App 审核（Guideline 2.1）需要一组可登录的 demo 凭据。站点可以关掉站主邮箱登录（`authSecurity.disablePasswordLogin`），社交登录又要求审核员走 Apple ID。需要一个 **reader 权限** 的固定账号：挂在 Apple Sign-in 配置上作为可选项，审核员用现有邮箱表单登录，且不依赖「开放邮箱登录」。

## 既定决策

| 议题 | 决策 |
|---|---|
| 形态 | Apple OAuth 区块一个开关。打开即系统创建固定 demo reader；关掉即停用 |
| 凭据 | 邮箱固定；密码首次自动生成，后台展示供 App Store Connect 备注 |
| 登录 | 复用 Better Auth `POST /sign-in/email`，不新增登录 API |
| 关邮箱登录时 | `disablePasswordLogin === true` 时 **只放行** 此 demo 账号的 email 登录；其它邮箱一律拒绝 |
| 角色 | 永远 `reader`，禁止升为 owner |
| 停用 | `ban` + 清 session；再打开 unban，凭据不变 |
| 每日重置 | 午夜 cron：清该账号产生的内容，资料恢复默认；id / 邮箱 / 密码 / role 不变；session 不断 |
| 客户端 | Yohaku 登录页已总是露出邮箱入口，本次 **不改 App** |
| 密码轮换 | v1 无「重新生成」按钮。关/开开关不换密。仅当 secrets 里密码缺失时 sync 才补一枚 |

## 一、身份与存储

固定身份（不入配置、不随站点域名变化）：

| 字段 | 值 |
|---|---|
| email | `app-review@users.invalid`（`.invalid` 保留 TLD，不会与真实 Apple/社交邮箱碰撞） |
| handle / username | `app-review` |
| 默认 name | `App Reviewer` |
| 默认 image | `null` |
| role | `reader` |

配置（沿用现有 `oauth.public` / `oauth.secrets` 字符串 map，无 schema 迁移）：

- `oauth.public.apple.reviewDemoEnabled`：`"true"` 或空
- `oauth.secrets.apple.reviewDemoPassword`：明文密码，走现有 oauth secrets 整棵加密；**不**放进 `public`（`getForResponse` 会原样返回 public）

`flattenOauthOptions` 的 `configured` 判断必须 **忽略** `reviewDemoEnabled`，避免「只开了 demo、没填 Apple 密钥」被当成 Apple 已配置。

账号行用邮箱查找，无新列、无 migration。Better Auth `accounts` 上挂 `providerId: 'credential'`，建号方式对齐 owner 初始化（`hashPassword` + `authRepository.createAccount`）。

密码：`crypto.randomBytes(18).toString('base64url')`（约 24 字符）。只在 secrets 里还没有密码时生成；之后保存 Apple 配置不得覆盖。

## 二、开关生命周期

Apple 区块增加独立 Switch（不进现有必填 text fields）。与 Apple 其它字段一起 Save。因此 **第一次打开 demo 时，Apple 配置必须已经能保存**（必填项已齐或 secrets 已存在）。Demo 登录本身不依赖 Apple OAuth 是否 `enabled`。

`ReviewDemoService.sync()` 订阅 `EventBusEvents.ConfigChanged`。该事件对任意配置段都会发，listener **每次自己 `get('oauth')`**，不解读 payload。幂等：

1. `reviewDemoEnabled === "true"`
   - 无账号：创建 reader + credential；必要时写入 `reviewDemoPassword`
   - 已 ban：unban，并把 name / image 恢复默认（再开即干净资料）
   - 已存在且未 ban：不改密码、不改资料
2. 开关关闭且账号存在：`setBanned` + `deleteSessionsForUser`，`banReason` 固定为 `app-review-demo`
3. 开关关闭且无账号：no-op

禁止：

- `AuthService.transferOwnerRole` 若目标是此邮箱 / handle → `INVALID_PARAMETER`
- 已有的 `before` hook（拒 `body.role`）保持不变

## 三、登录

仍走 `signIn.email`。在 `auth.implement.ts` 的 Better Auth `hooks.before` 增加 `/sign-in/email` 分支（现有 `/sign-in/email` bcrypt 升级逻辑在 `after`，不动）：

1. 请求 email 等于 demo 邮箱
   - 开关未开或 reader 已 ban → 与普通错误账号相同的失败（不泄露「这是审核号」）
   - 否则放行（即使 `disablePasswordLogin`）
2. 其它 email 且 `disablePasswordLogin` → 拒绝（这是相对现状的行为收紧：该开关今天只藏后台 UI，并不拦 API）
3. 其它 email 且未关密码登录 → 维持现状（站主 credential 可登）

`emailAndPassword.disableSignUp` 保持 `true`。无人能自助注册成这个邮箱。

Yohaku `LoginSheet` 已总是提供「邮箱登录」二级表单；评论区 inline 社交条不改。审核员从「我的」进入即可。

## 四、凭据展示

`oauth.secrets` 经 `sanitizeConfigForResponse` 被掏空，admin `getOption('oauth')` 读不到密码。

新增 owner-only：

```
GET /auth/review-demo
```

`@Auth()`。响应：

- 未启用：`{ enabled: false }`
- 已启用且凭据可用：`{ enabled: true, email, password }`
- 已启用但账号/密码未就绪：`{ enabled: true, email, error: "provision_failed" }`（无 password 字段）

Admin Apple 区块：开关下方，`enabled` 时展示邮箱/密码 + 复制按钮，文案说明用途（App Store Connect 备注）以及「每日重置评论与资料」。en-US / zh-CN 都要加 key。

## 五、每日重置

新 `CronTaskType.ResetReviewDemo`，调度与 `resetIPAccess` 相同：`CronExpression.EVERY_DAY_AT_MIDNIGHT`。开关未开或找不到账号则立即返回。

对 demo `readerId`：

1. 列出未删除评论，逐条走现有 `CommentService.softDeleteComment`（含评论图 hard-delete）
2. 删除 `voterFingerprint === 'r:' + readerId` 的 poll votes（仓库补 `deleteByFingerprint`；`poll_vote_options` 已 ON DELETE CASCADE）
3. `readers.name` / `image` / `displayUsername` 恢复默认；handle、email、role、密码、id 不动
4. **不**删 session

文章点赞是 IP/Redis，已有全站午夜 `resetLikedOrReadArticleRecord`，不按账号再清。App 本地 `likedRefs` 不在服务端范围。

## 六、错误处理

| 情况 | 行为 |
|---|---|
| 开关开、建号失败（邮箱已被占用且不是本系统号） | Save oauth 仍成功；sync 打日志；`GET /auth/review-demo` 返回 `provision_failed`；admin 显示错误、不展示假密码 |
| 开关开但 secrets 里密码丢了 | sync 再生成一枚，写回 secrets 并更新 credential hash |
| 审核员在重置瞬间仍登着 | session 保留；其评论会在下次列表刷新后消失 |
| 有人用社交登录撞上同一 email | 不可能：邮箱是 `.invalid`，Apple/GitHub/Google 不会签发 |

## 七、范围与非目标

**做：** `apps/core`（provision、hook、cron、GET）+ `apps/admin`（Apple 开关与凭据展示）。

**不做：** Yohaku / 其它客户端改动；密码轮换按钮；评论区邮箱入口；把 demo 做成可自定义邮箱；新的 readers 表字段。

## 八、验证

- 单元：`sync` 开→建、关→ban、再开→unban 且密码不变；`configured` 忽略 `reviewDemoEnabled`；`transferOwnerRole` 拒绝 demo；sign-in before-hook 在 `disablePasswordLogin` 下只放行 demo。
- 单元：cron 软删该 reader 评论、删 poll 票、恢复 name/image，不动其它 reader。
- 手工：admin 打开开关 → 复制凭据 → App 邮箱登录得到 `role: reader` → 关 `disablePasswordLogin` 后 demo 仍可登、站主邮箱不可登 → 关开关后登录失败。
