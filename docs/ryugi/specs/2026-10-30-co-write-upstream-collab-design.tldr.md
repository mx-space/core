# TL;DR — co-write 接入上游 CRDT

完整设计：`2026-10-30-co-write-upstream-collab-design.md`

## 做什么

agent 用 `mxs draft cat` 读、`mxs draft patch`（SEARCH/REPLACE）写线上草稿；人在线上 admin 写作页里同时写。本地 `mxs author` 全删。二期把元数据也接进 Loro。

## 你会看到的

1. 让 agent 开一篇新文章 → 拿到一个线上写作页链接。
2. 在浏览器里写；选中一段，切到终端说“改这段”。
3. 浏览器里出现一个叫 “Claude Code” 的光标，改动实时落下，你继续打字不受影响。
4. 时间线里每次 agent 修改是一行，可撤销。
5. （二期）你改标签、agent 改摘要，同时进行互不覆盖。

## 决策

| 决策 | 谁定的 |
| --- | --- |
| 去掉本地文件 / 编辑器 / CRDT / `mxs author` | 你 |
| 写入用 patch（字面量 SEARCH/REPLACE），不用 VFS / sed | 你定方向，45 次评测选定 |
| 每次调用一次性加入房间，无常驻、无缓存 | 你 |
| 选区走 presence 的 `caret.selection`，失焦保留 | 方向你，放法我 |
| 光标名 = ryugi `detectAgent`，放 `caret.label` | 来源你，放法我 |
| 元数据全部进 Loro；co-author 能读不能写 | 你 |
| 不为 skill 新增字段 | 你 |
| 分两期，本会话都做完 | 你 |

## 请检查这些（我的判断）

- npm 包名 `ryugi-detect-agent`。
- 命令放在 `mxs draft` 组下（`cat` / `patch`）。
- agent 光标停留约 3 秒，命令不等待。
- `--selection` 最多等浏览器重发 presence 约 500 ms。
- patch 拒绝“被 LiteXML 静默丢掉标签”的替换。

## 时间估计

- 一期：约 3–4 小时（core 认证已完成；CLI cat/patch 约 1.5 小时；admin 选区+label 约 40 分钟；detect-agent 包约 30 分钟；删 author + skill 重写约 1 小时；评测复跑 + 浏览器验收约 30 分钟）。
- 二期：约 3–4 小时（Loro fields 结构、core 读写与迁移、admin 表单绑定、co-author 校验、测试）。
