# AI 翻译语言码统一（BCP 47）

> 设计讨论与审批：Claude Doc <https://claude.ai/artifact/2tvuhz4XSHN2U1mE2tXmdb>（2026-10-29 批准）。本文件是其定稿副本。

mx-core 的所有语言码统一为 BCP 47 的「语言-地区」形式（`zh-CN`、`zh-TW`、`en-US`），由运行时自带的 `Intl.Locale` 负责生成与匹配；历史数据由一次 release 阶段的 SQL 迁移改写完毕；`packages/ai/src/lang.ts` 里的手写别名表全部删除。

## 动机

现在 `zh-TW`、`zh-Hant` 都被折叠成 `zh`，繁体没法成为独立的翻译目标。Yohaku 已经有简繁切换，但繁体访客拿到的是简体原文。根源是一套手写的折叠表，加上 `zLang` 的 `length(2)` 限制，连 admin 里填带连字符的码都不行。要求是一次定好规范、迁移完数据，不再有「硬塞来硬塞去」的映射。

## 目标

- `zh-CN` 与 `zh-TW` 成为两个独立的翻译目标，繁体访客拿到繁体译本。
- 存储、配置、API 输出只出现一种写法。
- 代码里不再有语言别名表，不再写死 `'zh'`。

## 非目标

- 不改 Yohaku 的路由与 locale 名。
- 不新增站点级「默认源语言」配置。
- 不支持同一地区内按文字区分的变体（如 `sr-Latn` 与 `sr-Cyrl`）；它们会归并为 `sr-RS`。
- 繁体译本缺失时，不用 OpenCC 等工具自动转换补位。

## 反目标

- 只是把一张别名表换成另一张。
- 滚动发布期间访客看到报错，或已有译本丢失。

## 规范码规则

任何语言标签都用同一个函数规范化：先把 `_` 换成 `-`，再取 `new Intl.Locale(tag).maximize()`，输出 `${language}-${region}`。构造失败或 maximize 后没有地区，就是非法标签。Node v24.18.0 实测：

| 输入 | 规范码 | 备注 |
| --- | --- | --- |
| `zh`、`zh-Hans`、`zho`、`chi` | `zh-CN` | |
| `zh-Hant` | `zh-TW` | |
| `zh-HK`、`zh-Hant-HK` | `zh-HK` | 当作独立目标保留 |
| `en`、`EN-us`、`eng` | `en-US` | |
| `ja` / `ko` / `pt` | `ja-JP` / `ko-KR` / `pt-BR` | |
| `es-419` | `es-419` | 数字地区码保留 |
| `iw` / `in` | `he-IL` / `id-ID` | 废弃码由 Intl 自动替换 |
| `jp`、`cn`、`english` | 非法 | 不再当作别名 |
| `tw` | `ak-GH` | 标准里是阿坎语，不再表示台湾 |

全部存储、配置、任务 payload 与 API 输出只使用规范码。函数放在 `@mx-space/ai` 的 `lang.ts`，core 与 admin 共用。

## 请求匹配

访客语言与译本的语言、文字（script）都相同即可命中，地区相同只是优先。新增 `matchLanguage(requested, candidates)`，放在 `lang.ts`：

1. 请求侧按优先级取标签：`?lang=` > `x-lang` > `NEXT_LOCALE` cookie > `Accept-Language` 中第一个合法标签；`original` 仍表示要原文。非法标签不报错，视为未指定语言。
2. 候选集：单篇文章用该文的可用译本加源语言；列表类接口（标题缓存、`translation_entries`、搜索）用配置里的 `translationTargetLanguages` 加默认源语言。候选先经过规范化。
3. 对请求和候选都取 `maximize()`。语言与文字都相同才算合格；在合格候选里，地区相同者优先，否则取候选集中的第一个。
4. 命中的是源语言，或无一合格，就返回原文；否则用命中的规范码做精确查询。

例：只有 `zh-TW` 译本时，`zh-HK` 访客命中 `zh-TW`；`zh-SG` 命中源语言 `zh-CN`，返回原文；`en-GB` 命中 `en-US`。

**摘要、insights、TTS 同样走这套规则。** 候选集为该文章已有的行，加上对应的 `summaryTargetLanguages` / `insightsTargetLanguages`。未命中需要即时生成时，生成目标取请求语言的「语言 + 文字」再规范化：`en-GB` 生成 `en-US`，`zh-HK` 生成 `zh-TW`。这样与现在「折叠后生成」的行为等价，不会因地区不同而生成重复的行。

## 改动清单

| 模块 | 文件 | 改法 |
| --- | --- | --- |
| ai | `packages/ai/src/lang.ts` | 删除 `REGIONAL_ALIAS_TO_CODE`、`REGIONAL_SHORTHAND_TO_TAG`、`LANGUAGE_ALIAS_TO_CODE`、`ISO_639_2_TO_1` 与 `foldRegion`。导出 `canonicalizeLanguageTag`（宽松，非法返回 `undefined`）、`assertLanguageTag`（严格，另用 `Intl.DisplayNames` 且 `fallback: 'none'` 校验）、`matchLanguage`。删除 `normalizeLanguageCode` 与 `normalizeTargetLang`，调用方改用新函数。包做破坏性大版本升级。 |
| ai | `packages/ai/src/prompts/constants.ts` | `DEFAULT_SUMMARY_LANG` 改为 `'zh-CN'`。删除 `LANGUAGE_CODE_TO_NAME` 与 `REGIONAL_LANGUAGE_CODE_TO_NAME`；`resolveLanguageName` 改用 `Intl.DisplayNames` 生成并附上文字，如 `Chinese (Taiwan), Traditional script`。`resolveBaseLanguageCode` 改为取 `Intl.Locale#language`。 |
| ai | `packages/ai/src/prompts/ai-prompts.ts` | 标题 / slug 生成里让模型输出的 `lang` 改为要求 BCP 47「语言-地区」，并明确繁体用 `zh-TW`；结果再经过 `canonicalizeLanguageTag`。 |
| core | `apps/core/src/common/zod/custom.ts` | `zLang` 去掉 `.length(2)`，改为校验规范码。 |
| core | `utils/lang.util.ts`、`common/middlewares/request-context.middleware.ts`、`common/decorators/lang.decorator.ts` | 改用 `canonicalizeLanguageTag`；`Accept-Language` 取第一个合法标签。 |
| core | `modules/ai/ai-language.util.ts` | `parseLanguageCode` 与 `normalizeTargetLangs` 改用新函数；删除「取小写基码」的兜底分支。 |
| core | `processors/helper/helper.translation.service.ts` | 各查询入口先走 `matchLanguage`，再用命中的规范码精确查询。 |
| core | ai-summary / ai-insights / ai-tts 的 service 与 controller | 读取走 `matchLanguage`；未命中时按「请求匹配」的规则决定生成目标。 |
| core | `modules/configs/configs.schema.ts` | 三个 `*TargetLanguages` 写入时用 `assertLanguageTag` 校验并规范化；说明改为 BCP 47，示例 `["en-US", "ja-JP", "zh-TW"]`。 |
| core | post / note / page / draft 的 DTO，以及 AI 标题 / slug 结果写入 `meta.lang` 处 | 写入时规范化：DTO 对非法值报错，AI 输出非法时丢弃该字段。读取方（`resolveArticleSourceLang`、搜索源语言）仍经过 `canonicalizeLanguageTag` 兜底。 |
| core | `modules/aggregate/resolve-seo.util.ts`、`modules/search/search-document.util.ts`、`utils/text-summary.util.ts`、`modules/ai/ai-tts/tts-language-strategy.ts` | 写死的 `'zh'` 改为默认源语言常量；TTS 的 Mandarin 判断改为比较 `Intl.Locale#language`。 |
| core | `modules/enrichment/providers/*` | `supportedLocales` 是外部服务自己的参数，进入 provider 前用 `Intl.Locale#language` 换算。 |
| admin | `features/ai/utils/ai.ts`、`CoverageMatrix.tsx`、`AiInsightsRouteView.tsx` | `parseLangInput` 改用 `canonicalizeLanguageTag`，非法输入提示错误；`QUICK_LANGS` 改为 `['zh-CN', 'zh-TW', 'en-US', 'ja-JP']`；写死的 `'zh'` / `'en'` 改为规范码。 |
| api-client | `packages/api-client/controllers/ai.ts` | 默认参数 `lang = 'zh'` 改为 `'zh-CN'`。 |
| Yohaku web | 与 `availableTranslations`、`translationMeta.targetLang` 比对 locale 的地方 | 改为按「请求匹配」规则比较（或由 locale 算出规范码再比较）。与 core 同次发布。 |
| Yohaku mobile | `yohaku-oss/apps/mobile` 发送 `lang` 与比对 `availableTranslations` / `targetLang` 处 | 同 web；已安装的旧版本不做兼容。 |

## 数据迁移与发布

一个只含 UPDATE / DELETE、不含 DDL 的 Drizzle SQL 迁移，跟新代码一起发布，在 release 阶段由 `mx-migrate` 执行；可重复运行。

**映射表。** SQL 里调不了 `Intl`，迁移文件内嵌一份 `VALUES` 映射：编写迁移时用 `canonicalizeLanguageTag` 对旧代码可能写入的所有值（旧 `LANGUAGE_CODE_TO_NAME` 的 47 个两字母码、各别名）跑一遍生成，另加人工规则：`cn` → `zh-CN`，`tw` / `zh-tw` / `zh-hant` → `zh-TW`，`zh` → `zh-CN`。表只存在于迁移里，运行时代码不引用。不在表里的值保持不动，并 `RAISE NOTICE` 列出。NULL 保持 NULL。

**覆盖范围。**

- `ai_translations.lang` / `source_lang`、`ai_summaries.lang` / `source_lang`、`ai_insights.lang` / `source_lang`、`ai_tts.lang` / `source_lang`
- `translation_entries.lang`、`ai_generation_metrics.lang`、`search_documents.lang`
- `posts` / `notes` / `pages` / `drafts` 的 `meta->>'lang'`（`jsonb_set`）
- `options` 中 `name = 'ai'` 的 `summaryTargetLanguages`、`translationTargetLanguages`、`insightsTargetLanguages`（映射后去重）

**唯一索引冲突。** 本地 dev 库已有 3 篇文章的 `ai_summaries` 同时存在 `zh` 与 `zh-CN`、`en` 与 `en-US`，映射后会撞上 `(ref_id, lang)` 唯一索引。冲突组里保留最近写入的一行，其余先删除再 UPDATE。`ai_translations` 会就地重译，按 `COALESCE(updated_at, created_at)` 判断；其余表无 `updated_at`，按 `created_at`。N+1 收尾迁移用同一规则。

**滚动发布。**

1. 版本 N：新代码与迁移一起发布。迁移先跑完，新 pod 才启动。
2. 切换的几十秒内，旧 pod 仍用 `zh` / `en` 查询：翻译查不到时回退原文；摘要、insights 可能被重新生成一份旧码行。不报错，符合「N 的迁移兼容 N-1 代码」。
3. 新代码对单篇文章的候选集先规范化再匹配，窗口内写入的旧码行仍读得到。
4. 版本 N+1：用新编号再跑一次同一份幂等迁移，收拾散落旧码。

**回滚。** 反向映射会丢信息（`zh-CN` 与 `zh-TW` 都变回 `zh`），不写 down 迁移；代码回滚后，旧代码读到规范码只会回退原文，不会出错。

## 数据分布（本地 dev 库，2026-10-29）

| 位置 | 取值（行数） |
| --- | --- |
| `ai_translations.lang` | en 372, ja 372, ko 7 |
| `ai_translations.source_lang` | zh 751 |
| `ai_summaries.lang` | zh 347, en 344, ja 189, ko 19, zh-CN 2, en-US 1 |
| `ai_summaries.source_lang` | 全为 NULL（902） |
| `ai_insights.lang` / `source_lang` | zh 20, ja 18, en 18, ko 8 / zh 64 |
| `ai_tts.lang` / `source_lang` | ja 2, zh 1 / zh 2, NULL 1 |
| `translation_entries.lang` | en 59, ja 59, ko 51 |
| `search_documents.lang` | zh 376, ja 372, en 372, ko 7 |
| `ai_generation_metrics.lang` | ja 371, en 370, ko 7, zh 1 |
| `meta.lang`（posts / notes / pages / drafts） | 全为 NULL |
| `options`（ai） | `summaryTargetLanguages`、`insightsTargetLanguages` 为空数组，`translationTargetLanguages` 未存储 |

生产库尚未查；发布前对生产快照跑一遍同样的 `GROUP BY`。

## 测试与验收

验收路径：配置 `translationTargetLanguages = ["zh-TW", "en-US"]`，对一篇简体文章生成译本，带 `x-lang: zh-TW` 请求时返回繁体译文，`translationMeta.targetLang` 为 `zh-TW`。

- [ ] `packages/ai/test/lang.test.ts` 重写：规范化示例表逐行覆盖；`matchLanguage` 覆盖 `zh-HK` → `zh-TW`、`zh-SG` → 源语言、`en-GB` → `en-US`、无合格候选返回 `undefined`。
- [ ] `resolveLanguageName` 对 `zh-CN` / `zh-TW` 分别给出 Simplified / Traditional。
- [ ] core e2e（`create-e2e-test` skill）：上述验收路径；`?lang=jp` 与 `x-lang: zh_TW` 各一条。
- [ ] 迁移测试：testcontainer 写入旧码数据（含 `zh`、`en`、`zh`+`zh-CN` 冲突、meta 与 options），跑迁移两次，断言结果相同且无重复行。
- [ ] admin：`parseLangInput` 单测改为新规则，非法输入报错。
- [ ] `pnpm -C apps/core run lint:migrations` 通过。

## 决策记录

| 决策 | 谁定的 |
| --- | --- |
| 全面统一并迁移数据，不做 `zh` + `zh-Hant` 的补丁方案 | 用户 |
| 采用 ISO/IETF 体系的规范码，不再用简写码 | 用户 |
| 中文用 `zh-CN` / `zh-TW` 的「语言-地区」形式 | 用户 |
| Yohaku 前端 UI 不改 | 用户 |
| 所有语言一律「语言-地区」，地区由 `maximize()` 补全 | 第一轮推荐，用户同意 |
| 按语言 + 文字匹配译本，地区相同优先 | 第一轮推荐，用户同意 |
| 写入从严、请求从宽；`tw` 不再表示台湾 | 第一轮推荐，用户同意 |
| 单版本迁移 + N+1 幂等收尾 | 第一轮推荐，用户同意 |
| 默认源语言 `zh-CN`，不加站点配置 | 第一轮推荐，用户同意 |
| Yohaku 比对逻辑与 core 同次发布 | 第一轮推荐，用户同意 |
| `@mx-space/ai` 直接破坏性大版本升级，不保留旧导出 | 用户 |
| Yohaku mobile 一并改，已安装旧版本不兼容 | 用户 |
| 提示词语言名由 `Intl.DisplayNames` 生成，删除名称表 | Claude |
| 迁移映射以 `VALUES` 内嵌于 SQL，运行时不引用 | Claude |
| 唯一索引冲突时保留最新一行 | Claude |
| 不写 down 迁移 | Claude |
| 摘要 / insights / TTS 也走 `matchLanguage`；即时生成按语言 + 文字取规范码 | Claude |
| `meta.lang` 写入时校验并规范化，读取时兜底规范化 | Claude |

## 留给实现者

- 新函数的具体命名与签名。
- Redis 里若有以 `lang` 为 key 的缓存或任务去重键，判断是等其过期还是发布后清理一次。
- 映射表覆盖不到的存量值（`RAISE NOTICE` 列出的）按情况处理。
