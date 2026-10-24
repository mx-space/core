# LobeHub Cloud

在后台的「设置 → AI → 添加服务商 → 聚合服务」中选择 **LobeHub Cloud**。
点击「登录 LobeHub」，在独立弹窗中复制验证码、打开授权页并完成授权。
连接成功后自动获取模型列表，选择默认模型，再保存 AI 设置。

账户连接即时保存，供本站的所有 LobeHub provider 共用。关闭授权弹窗会停止轮询；
取消重新登录不会移除已经存在的连接。断开连接会影响所有使用此账户的 AI 功能。

支持文本生成、推理、结构化输出和工具调用。图片生成与语音暂不支持。

模型列表会同步 LobeHub 的输入、输出、缓存读取和写入等价格。点击模型旁的信息
按钮，在 Popover 表格中查看固定价格、输入分档和缓存时长价格；方向键定位模型后，
也可按 `Alt + →` 查看价格详情。切换高亮项、移出选项或列表失焦时自动收起。
价格单位沿用
LobeHub 的币种和计价单位，不把每百万 Token 的费率再次放大。

调用统计使用 LobeHub 返回的 `usage.cost`（美元），不将 credits 当作美元。
缓存读取和写入 Token 单独记录，并从普通输入 Token 中扣除，避免重复累计。
翻译与审校的多次调用都会计入统计。没有返回费用的调用及费用分项保留未知，
汇总会标记「已知部分」及缺失费用的生成次数；明确返回的零费用正常显示为零。

## 服务端配置

服务端需启用现有的密钥加密配置。OAuth access token 和 refresh token 作为加密的
内部 option 保存在 PostgreSQL 中，不会返回浏览器或混入 AI provider 设置。
授权中的设备凭据加密保存在 Redis，随验证码到期；续期使用数据库共享锁，适用于多副本部署。

可选环境变量：

| 变量                      | 默认值                         | 用途                                                        |
| ------------------------- | ------------------------------ | ----------------------------------------------------------- |
| `LOBEHUB_CLOUD_URL`       | `https://app.lobehub.com`      | 可信的 LobeHub 服务地址                                     |
| `LOBEHUB_OAUTH_CLIENT_ID` | `lca_nciA1nZ536BtbF09HiWi2cyJ` | Mix Space 公共 Device Flow 客户端；可覆盖为自行注册的客户端 |

默认内置 Mix Space 的公共客户端，所有连接官方 LobeHub Cloud 的自部署 mx-core 实例均可使用，
无需单独注册客户端、配置回调 URL 或 Client Secret。需要使用其他客户端时，
可通过环境变量覆盖为已在目标 LobeHub 服务上注册且启用 Device Flow 的 Client ID。

LobeHub 连接只向服务端配置的可信地址发送凭据，忽略 provider 中的自定义 endpoint。
聊天使用 LobeHub Web API，不发送额外的 trace 采集头。
