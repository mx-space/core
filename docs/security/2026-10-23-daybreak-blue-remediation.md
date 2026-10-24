# Daybreak Blue 扫描审查与修复

扫描 ID：`cdb5ad99-2e3f-4c0a-b59e-79eb7cfdf134`。输入为用户提供的 `scan-bundle (1).tar.gz`，冻结版本为 `038657b8c995cff0cd769ef7ed16dd209a4aea2f`。

报告列出的 23 个问题均在当前代码中确认了相应缺口。以下修复保存在本地工作区，尚未发布。扫描本身为静态审查；本次补充了行为测试、真实 PostgreSQL/SQLite 验证、Chromium 请求证据和构建验证。

| #   | 扫描 ruleId                                 | 审查结果及处理                                                                                                                                                                    |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `public-comment-sensitive-data`             | 公开评论改为明确字段投影，覆盖详情、分页、回复和嵌套 reader；去掉邮箱、IP、UA、位置、内部元数据及管理状态。所有者继续收到管理字段，普通已登录读者也走公开投影。SDK 同步可选字段。 |
| 2   | `note-direct-id-visibility-bypass`          | ID 读取补齐定时发布与口令检查；公开导航列表不包含受保护的当前条目。                                                                                                               |
| 3   | `scheduled-note-alternate-representation`   | 定时笔记在公开详情入口提前拒绝，发生在翻译、摘要、TTS、富化和 Lexical 内容处理之前。                                                                                              |
| 4   | `websocket-stale-authorization`             | 所有者转移/撤销触发管理员 socket 失效，并经 Redis bus 通知其他实例；处理中握手也会失效。HTTP 会话使用数据库中的当前角色。                                                         |
| 5   | `websocket-query-credential`                | 管理 WebSocket 删除 query token 回退，保留 cookie 与认证头。                                                                                                                      |
| 6   | `serverless-relative-module-sandbox-escape` | require 禁止相对/绝对路径及包路径穿越，阻断可写资产中的 CommonJS 文件在 VM 外执行。保留已有的受控内置模块与安装包功能。                                                           |
| 7   | `serverless-waiter-queue-exhaustion`        | 限制等候请求数量，等候时间计入执行预算；创建和分配 worker 时预留容量，避免并发超配。                                                                                              |
| 8   | `sandbox-websocket-private-egress`          | WebSocket 与 fetch 都在实际 socket DNS 查询处检查地址；拦截 localhost、私网、映射 IPv6 与私网重绑定。                                                                             |
| 9   | `outbound-url-address-validation-bypass`    | 统一规范化 IPv6 判断；HTTP 使用配套的 Undici fetch/Agent，在连接时检查并使用同一组 DNS 地址，覆盖 OG、oEmbed、图片、头像及 webhook。                                              |
| 10  | `browser-post-navigation-destination-check` | 浏览器所有 HTTP/CONNECT 流量经过本地出站代理，逐连接验证并固定地址，涵盖重定向、脚本、子资源和 WebSocket。关闭 QUIC 与未代理的 WebRTC UDP。                                       |
| 11  | `unbounded-image-response-buffering`        | 图片和头像流式读取，累计上限 8 MiB；图片解码限制 4000 万像素。                                                                                                                    |
| 12  | `safe-fetch-body-timeout-gap`               | 超时覆盖响应正文，所有退出路径中止连接并清理计时器。                                                                                                                              |
| 13  | `reader-upload-quota-race`                  | 每个 reader 使用 PostgreSQL advisory transaction lock，覆盖配额查询、文件接收、存储和记账；剩余字节数也限制单次文件大小。                                                         |
| 14  | `backup-decompression-resource-exhaustion`  | ZIP 限 10000 条目、单条目 256 MiB、展开总量 1 GiB；流式写入，恢复文件逐项复制。保留路径与符号链接检查。                                                                           |
| 15  | `telemetry-unbounded-ingestion`             | 请求体限 1 KiB；Cloudflare 限流、同实例/事件一分钟去重、每日 10000 条和总计 100000 条上限；条件插入由 SQLite 原子执行。                                                           |
| 16  | `subscription-missing-owner-verification`   | 邮箱持有人经 15 分钟有效的签名链接确认后才激活或修改偏好；未验证记录不投递，确认邮件有跨实例冷却和入口限流。                                                                      |
| 17  | `s3-unvalidated-redirect`                   | 所有 S3 请求拒绝重定向。                                                                                                                                                          |
| 18  | `s3-unbounded-transport-response`           | S3 请求及正文共用 60 秒期限，控制/错误响应流式限 1 MiB。                                                                                                                          |
| 19  | `push-owner-binding-authz`                  | Core 从可信请求权限生成所有者声明；Relay 验证 Space 绑定必须带所有者授权及 reader 身份，扇出只选择获授权的 Space 绑定。                                                           |
| 20  | `relay-installation-storage-abuse`          | 设备 token 编码长度受限，拒绝活跃重复 token；设备注册速率、持久化行数、票据数及无绑定设备保留时间均受限。                                                                         |
| 21  | `relay-self-issued-source-amplification`    | 新来源必须携带运营方注册凭证；绑定、事件速率、每日发送量、队列长度及保留时间有硬上限，事务回滚超额扇出。                                                                          |
| 22  | `ios-cross-origin-stale-token`              | Keychain account 按规范化来源隔离；配对请求不发送旧 token。旧的全局 token 不自动迁移。                                                                                            |
| 23  | `ios-plaintext-owner-credentials`           | 所有服务器端点必须 HTTPS，认证中间件也不向 HTTP 发送 bearer。更新本地验证说明。                                                                                                   |

## 升级要求

- Relay 设置 `PUSH_RELAY_ENROLLMENT_TOKEN`，获准接入的 Core 设置相同的 `MX_PUSH_RELAY_ENROLLMENT_TOKEN`（32–256 字符）。未配置时禁止创建新来源，已有来源仍使用自己的凭证。
- Relay 执行新增 SQLite migration 0003。旧 Space 绑定没有所有者标记，需要所有者重新配对并激活推送。请同时更新 Relay 与 Core。
- iOS 旧全局 token 被隔离，升级后重新配对 HTTPS 地址；局域网开发也需要受信任的 TLS 证书或 HTTPS 代理。
- 旧邮箱订阅若没有 verified 标记，将停止收到内容通知，收件人需重新确认订阅。公开订阅调用成功表示确认邮件已请求发送。
- 遥测需随 `wrangler.toml` 一起部署，以提供 `COLLECT_LIMITER` 绑定；本次没有修改线上 Worker、D1 或账户策略。
- 备份、上传、图片、S3 和 Relay 的新资源上限可能拒绝超大输入，具体阈值见上表及 Relay README。

APNs token 使用有上限的可变长度编码，而不是扫描建议的固定长度；Apple 明确要求避免假定 token 大小，见 [Apple 通知请求文档](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns)。

沙箱继续只面向可信所有者脚本；本次封堵报告指出的可写模块入口和网络/排队缺口，未更换 Node VM 运行机制。

## 验证记录

- Core：全量 `pnpm -C apps/core exec vitest run --maxWorkers=4` 有 3090 个测试通过、25 个跳过；唯一未执行文件为 `tts-runtime.adapter.spec.ts`，原因是测试 Redis 的随机端口 52506 冲突。该文件使用单 worker 独立复跑，14 个测试全部通过。合并结果为 3104 通过、11 个按条件跳过。后续订阅冷却、浏览器代理生命周期和网络改动另有针对性复跑。
- `pnpm typecheck`：响应 envelope 检查、AI 校验检查和 Core 类型检查通过。
- 管理端 `pnpm -C apps/admin typecheck` 通过；公共 SDK 的 200 个测试、推送协议的 26 个测试和协议类型检查通过；WebSocket SDK 测试通过。
- Rust Relay：在 `rust:1` 容器运行 `cargo test --locked`，27 个测试通过，包括真实 SQLite 的配额、重复 token、来源注册、Space 所有者授权、幂等重试和事务回滚。
- iOS Core：`swift test --package-path apps/ios/Packages/SpaceCore`，49 个测试通过。覆盖 HTTP 拒绝、配对凭证清理、IPv6 和默认端口的来源规范化。
- iOS App：`xcodebuild -project apps/ios/Space.xcodeproj -scheme Space -destination 'generic/platform=iOS Simulator' -skipPackagePluginValidation CODE_SIGNING_ALLOWED=NO build` 通过。宿主工具使用其默认 SDK；不能全局强制 `-sdk iphonesimulator`，否则 OpenAPI 生成器被错误地编译为 iOS 库。
- Core 的 `pnpm -C apps/core run bundle` 通过；Node 26 容器直接加载沙箱 worker 与运行时 Undici 并成功执行。
- Chromium 实测：私网目标返回代理的 HTTP 403，私网测试服务收到 0 次请求。DNS 重绑定另经真实 Undici 连接器验证。
- 遥测使用真实 SQLite 验证去重及每日预算；Worker 独立类型检查通过。
- 修改范围 ESLint 无错误（raw sandbox JS 按仓库规则忽略），`git diff --check` 通过。

未进行生产部署、线上账号策略检查、APNs 真机发送或 Daybreak Blue 远端重扫；未更改全仓扫描覆盖率结论。
