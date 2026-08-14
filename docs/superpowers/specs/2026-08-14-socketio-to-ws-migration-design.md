# socket.io → raw ws 迁移设计

日期：2026-08-14
状态：已与用户逐节确认

## 背景与动机

mx-core 实时层现基于 socket.io（`@nestjs/platform-socket.io` + `@socket.io/redis-adapter` + `@socket.io/redis-emitter`），客户端（Yohaku、admin、mx-tg-bot）皆携 `socket.io-client`。迁移到原生 WebSocket（服务端 `ws`，浏览器原生 API）以：

- Web 端零框架依赖，去除 engine.io 握手与 polling 回退
- 多副本部署（Dokploy 2 replicas）无需 sticky session
- 消灭 socket.io redis-adapter 扇出式 `fetchSockets` 的不可靠性（现有代码已被迫加 800ms 软超时与本地降级）

## 既定决策

| 议题 | 决策 |
|---|---|
| 切换策略 | 一刀切原子切换，无双栈过渡。core/admin/Yohaku/tg-bot 同期改造 |
| 线协议 | 新版本化信封 `{v, event, payload, id?}` |
| ack | 首版即实现（带 id 的上行指令得 ack 应答） |
| 事件命名 | BusinessEvents 枚举值全改 Stripe 式 dot 风格（`post.create`），webhook 直发新值，下一 major 整体 breaking |
| 服务端架构 | 保留 Nest gateway 壳，`@nestjs/platform-ws` + 自定义 `messageParser`；room/broadcast/注册表自建 |
| 范围 | mx-core 全套（core + admin）+ Yohaku + mx-tg-bot；gh-bot/shiroi-deploy-action/obsidian 插件自行升包，不在本次范围 |

## 一、线协议 v1

文本帧，JSON，无二进制。双向同构信封：

```jsonc
// 下行推送（无 id）
{ "v": 1, "event": "post.create", "payload": { ... } }

// 上行指令（要 ack 则带 id）
{ "v": 1, "event": "room.join", "payload": { "room": "post-xxx" }, "id": "c1" }

// ack（应答上行 id）
{ "v": 1, "event": "ack", "id": "c1", "payload": { "ok": true } }
{ "v": 1, "event": "ack", "id": "c1", "payload": { "ok": false, "code": "ROOM_INVALID" } }
```

- 未知 event：静默丢弃；若带 id 则回 `{ ok: false, code: 'UNKNOWN_EVENT' }`
- 信封以 Zod schema 校验，非法帧丢弃

> **实现偏差**：`@nestjs/platform-ws` 的 `WsAdapter` 对未匹配 `@SubscribeMessage` 的事件静默吞没，不产生任何 ack（无 `UNKNOWN_EVENT`）。客户端 `request()` 以固定超时兜底（见「客户端」节），未收到 ack 时按超时失败处理，非协议层显式拒绝。已计入 release note。

### 事件命名

规则：`{resource}.{action}`，小写，resource 段内下划线，action 取现有动词直译（`create/update/delete/apply/online/offline/generated…`）。

| 旧 | 新 |
|---|---|
| `POST_CREATE` 等全部 BusinessEvents 值 | `post.create`、`comment.create`、`visitor.online`、`ai_task.update`… |
| `GATEWAY_CONNECT` / `AUTH_FAILED` | `gateway.connect` / `auth.failed` |
| 上行 `message` + `{type:'join'/'leave'}` | `room.join` / `room.leave` |
| 上行 `UpdateSid` / `UpdateLang` | `session.update` / `lang.update` |
| admin `ai-agent:join` 等具名事件 | `ai_agent.join` / `ai_agent.leave` / `ai_task.subscribe` / `ai_task.unsubscribe` |
| serverless `fn#<name>`（`SERVERLESS_EVENT_PREFIX`） | `fn.<name>` |

TS 枚举键名不动（`POST_CREATE = 'post.create'`），仅改值——core 内所有 `BusinessEvents.POST_CREATE` 引用零改动；字符串字面量硬编码处 grep 排查手改。

### 心跳

- 服务端（已实现语义）：单周期 isAlive 标记法——每 30s 巡检一次；巡检时若连接仍标记存活，则清除标记并 ping，等待下一周期的 pong 重新置位；巡检时若标记已是未存活（上一周期未收到 pong），直接 terminate。即一个失联连接最迟在两个心跳周期内断开，而非「连续两次无 pong 才断」。实现见 `WsGatewayBase.sweepHeartbeat`（`apps/core/src/processors/gateway/ws/ws-gateway.base.ts`）。
- 客户端：30s 上行 `{ event: 'ping', id }` 借 ack 探活，10s 超时自行重连

## 二、服务端架构

### adapter

弃 `RedisIoAdapter`（`src/common/adapters/socket.adapter.ts`）与依赖 `@nestjs/platform-socket.io`、`@socket.io/redis-adapter`、`@socket.io/redis-emitter`、`socket.io`。新增 `@nestjs/platform-ws@11.1.29`（与 `@nestjs/websockets` 同版）。

```ts
app.useWebSocketAdapter(
  new WsAdapter(app, {
    messageParser: (raw) => {
      const msg = envelopeSchema.parse(JSON.parse(raw.toString()))
      return { event: msg.event, data: msg } // handler 得完整信封（payload+id）
    },
  }),
)
```

### gateway 壳

- `@WebSocketGateway({ path: '/ws/web' })` 与 `{ path: '/ws/admin' }`，同端口按 path 分流（WsAdapter noServer + upgrade 路由，Nest 11 支持）
- path 不入 `/api/v*` 前缀域，dev/prod 同路径
- `@SubscribeMessage('room.join')` 等照旧；handler 返回 ack 信封即回发（WsAdapter 序列化返回值）

### 连接身份与注册

- socket.io 的 `socket.id` 不复存在，连接时以 snowflake 自生 id
- 每 gateway 持本地 `ConnectionRegistry: Map<id, WsClient>`（`WsClient = { id, ws }`），close 时清
- `GatewayService` 的 Redis metadata hash（`RedisKeys.Socket`）键改用此 id，读写逻辑不变

### 鉴权

`handleConnection(ws, request: IncomingMessage)` 直读 `request.headers` / query：

- web：sessionId 走 query `socket_session_id`（浏览器 WS 不能自定 header，`x-socket-session-id` 头弃用）、lang query、readerId 经 cookie session 解析，同今
- admin：`createAuthGateway` 逻辑平移——cookie owner 会话 → `x-api-key` 头 → query token 三径；失败发 `auth.failed` 后 `ws.close(4401)`
- `TokenExpired` 事件仍以 token→id map 查 registry 断连

### RoomManager（本地层）

每 gateway 一份：`Map<room, Set<WsClient>>` + 反向 `Map<id, Set<room>>`。join/leave 维护双向表；close 自动 leave 并触发现有 `onLeaveRoom` hooks。发送前置 `ws.readyState === OPEN` 检查。

## 三、跨节点

### 广播总线（替代 redis-emitter）

单 Redis pub/sub 频道 `mx-ws:bus`，帧：

```jsonc
{ "ns": "web", "event": "post.create", "payload": {...},
  "rooms": ["post-xxx"]?, "exclude": ["<socketId>"]? }
```

各节点皆订阅（含发布者自身——本地投递亦走此回路，路径唯一无双发）。收帧后查本地 RoomManager 解目标集：有 `rooms` 取并集，无则取该 ns 全部本地连接，减 `exclude`，逐个 send。三处 `broadcast()`（web/admin/auth gateway）皆改 publish。

### 注册表（替代 fetchSockets 扇出）

| 键 | 类型 | 含义 |
|---|---|---|
| `mx-ws:node:{nodeId}` | string EX 30 | 心跳，10s 续期 |
| `mx-ws:nodes` | set | 节点名录 |
| `mx-ws:conns:{ns}` | hash `id→nodeId` | 全部连接 |
| `mx-ws:room:{ns}:{room}` | hash `id→nodeId` | 房间成员 |
| `mx-ws:rooms:{ns}` | set | 房间名录 |
| `RedisKeys.Socket`（现有） | hash `id→json` | socket metadata，沿用 |

- nodeId 启动生成（hostname+pid+random）
- join/leave/connect/close **先写本地与 Redis，后回 ack**——ack 达则后续广播必及
- 查询改写：
  - 在线数：`HGETALL conns:web` + metadata 批取 → uniq sessionId
  - `getSocketsOfRoom` → `HKEYS room:web:{room}`，签名改返 id+metadata（activity.service 调用处随改）
  - `getAllRooms` → rooms 名录 + 逐房 `HLEN`（值 0 顺手 SREM 懒清）
- `fetchSocketsWithSoftTimeout`、800ms 软超时、降级与 warn 节流机器尽删

### GC

每节点 60s 巡 `mx-ws:nodes`：遇心跳键已失者，扫 `conns:{ns}` 与各 room hash，HDEL 值为死节点的字段并清其 metadata，终 SREM 节点。

现 `GatewayService.initializeSocketStore` 启动时 DEL 整个 metadata hash——多副本下为 bug（甲重启抹乙数据），本次废除，交 GC。

## 四、webhook 与包

- `packages/webhook` 枚举由 `bun scripts/extract-models.ts` 从 core 抽取——core 改值后重跑即得，**发 major**
- webhook egress（`helper.event.service` → `x-webhook-event` 头与 body `type`）自动携新值，无映射层
- 下游：Yohaku 与 mx-tg-bot 升包（本次范围内）；gh-bot、shiroi-deploy-action、obsidian 插件自行升包，release note 载明 breaking 事件名全表

## 五、客户端

### 新共享包 `packages/ws-client`（`@mx-space/ws-client`）

零依赖、同构（浏览器原生 WebSocket / Node≥22 全局 WebSocket）：

```ts
const client = createWsClient({ url, query, pingInterval, backoff })
client.on('post.create', handler)
client.send('lang.update', { lang })
await client.request('room.join', { room }, { timeout: 10_000 })
client.on('$state', handler) // connecting/open/reconnecting/closed
```

内含：指数退避重连（含 jitter）、ping 探活、pending-ack map 与超时、信封编解码。约 200 行，三端共用。

### 各端改造

- **Yohaku**：`src/socket/io.worker.ts` 以 ws-client 重写，SharedWorker 结构与 `worker-client.ts` 页面桥协议不动，连 `/ws/web`；session id 只走 query；cookie 自动携带；事件名随 `@mx-space/webhook` 升包
- **admin**：`SocketBridge.tsx` 换 ws-client 连 `/ws/admin`，cookie 鉴权；`useTaskSubscription` 的 subscribe/unsubscribe 改 `request()`，ack 确认后方标 ready
- **mx-tg-bot**：`src/modules/mx-space/socket.ts`（78 行）以 ws-client 重写，query token 鉴权，连 `/ws/admin`

## 六、测试

- 单测：信封 schema、RoomManager、注册表 GC（死节点清理，redis-memory-server）、总线过滤（rooms/exclude）
- e2e（`createE2EApp`）：原生 WebSocket 直连——鉴权三径、join→ack→定向广播、断线 room 清理、心跳断杀
- 跨节点 e2e：同一 Redis 起双 app 实例，甲 join 乙 broadcast 达，杀甲验 GC
- `ws-client`：以 `ws` 起假服务器测重连/ack 超时/探活
- 删 `test/src/common/adapters/socket.adapter.spec.ts`；admin `useTaskSubscription.spec`、Yohaku transport 测试随迁

## 七、发布

发布前置（在删除本 worktree 前必须逐项完成，否则下游装不到包或连不上）：

- `packages/ws-client`：翻转 `private: true` → 可发布，`license` 字段改 `AGPL-3.0-only`（原 `AGPLv3` 非有效 SPDX 标识，npm publish 前须修正）
- Yohaku、mx-tg-bot 对 `@mx-space/ws-client`（以及本次连带的 `@mx-space/webhook`）的依赖，若当前以 `file:` 本地路径引用，发布前必须换成 npm 版本号（semver range），否则那两个仓库的构建在本 worktree 删除后失效
- web-gateway（反向代理层）需为 `/ws/web` 与 `/ws/admin` 两条路径显式配置 WebSocket upgrade 路由；缺此配置时 HTTP 层握手可通但 upgrade 被拒，割接后客户端表现为连接失败，且不会有 5xx 提示，需专项验证

顺序：

1. `@mx-space/webhook` **1.0.0**、`@mx-space/ws-client` 首版，先于 mx-core v14 发 npm
2. mx-core **major**（v14）：core+admin 同体发布，release note 载 breaking 事件名全表
3. web-gateway 加 `/ws/web`、`/ws/admin` upgrade 路由（先于或随 core 上线生效，不可晚于）
4. Yohaku、tg-bot 升包（改用发布后的 npm 版本号，非 `file:` 依赖）并切换部署

割接窗口：core 上线至 Yohaku 部署间，旧前端 socket.io 连接失败——页面无损，实时功能歇，刷新自愈（一刀切既定代价）。Dokploy 双副本滚动中 upgrade 或落旧 pod 被拒，客户端退避重试即过，无需 sticky。

## 非目标

- 双栈过渡 / socket.io 兼容层
- 二进制帧、压缩
- 消息可靠投递（离线补发、序号重放）——现 socket.io 亦无
- webhook 出口旧名映射
- **`apps/mobile`（Yohaku 仓库内的移动端）**：仍使用 socket.io 客户端，本次迁移范围不含。割接后其实时功能将随旧协议一起失效（连接旧 socket.io 端点已不存在），需在核心割接前单独排期跟进，不可与 Yohaku Web 端同批默认完成。
