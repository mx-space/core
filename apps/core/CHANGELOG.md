## [13.11.8](https://github.com/mx-space/core/compare/v13.11.7...v13.11.8) (2026-06-28)


### Bug Fixes

* **stock:** switch bars source from Twelve Data to Polygon.io ([c72cd47](https://github.com/mx-space/core/commit/c72cd47bdebdf29f75efc728135f77ca117d3c2d))

## [13.11.7](https://github.com/mx-space/core/compare/v13.11.6...v13.11.7) (2026-06-28)


### Bug Fixes

* **serverless:** drop fake axios stub, switch built-ins to native fetch ([b34034e](https://github.com/mx-space/core/commit/b34034e3a5ab892b0b6edc6b29f170af54d4b4e2))

## [13.11.6](https://github.com/mx-space/core/compare/v13.11.5...v13.11.6) (2026-06-28)


### Bug Fixes

* **stock:** trim Twelve Data apiKey + propagate built-in updates on boot ([888af60](https://github.com/mx-space/core/commit/888af6029759ea353cf1887983dbed742b20567b))

## [13.11.5](https://github.com/mx-space/core/compare/v13.11.4...v13.11.5) (2026-06-28)


### Bug Fixes

* **test:** align translation-entry note mock with findDistinctMoodsAndWeathers ([57a623d](https://github.com/mx-space/core/commit/57a623d87419bf568f5cd0513ce1e4cf7b062374))

## [13.11.4](https://github.com/mx-space/core/compare/v13.11.3...v13.11.4) (2026-06-28)


### Features

* **stock:** built-in serverless stock_quote + stock_bars + admin Lexical node ([00a8f86](https://github.com/mx-space/core/commit/00a8f86fc1b4cb9a760d94b3df23abc692ba69ab))

## [13.11.3](https://github.com/mx-space/core/compare/v13.11.2...v13.11.3) (2026-06-28)

## [13.11.2](https://github.com/mx-space/core/compare/v13.11.1...v13.11.2) (2026-06-27)


### Bug Fixes

* **ai:** honor custom provider endpoints ([29e082a](https://github.com/mx-space/core/commit/29e082ad7ad9092603b8b5c1ead4c4c46c6236fe))
* **ai:** seed translation glossary from every visible note, not just the last 100 ([49aa04f](https://github.com/mx-space/core/commit/49aa04f17120596f1e29582695a6c9b1aa209cdf)), closes [#2758](https://github.com/mx-space/core/issues/2758)
* **ai:** surface orphan articles in summary/insights/translation grouped lists ([e51621a](https://github.com/mx-space/core/commit/e51621afd535c8b4c337d00e0ef82b061ed45c91)), closes [#2758](https://github.com/mx-space/core/issues/2758)
* **recently:** hydrate enrichments on create/update so link cards survive the write path ([0c62e08](https://github.com/mx-space/core/commit/0c62e080680a8442194ea01d61178dba9e397cb4))

## [13.11.1](https://github.com/mx-space/core/compare/v13.11.0...v13.11.1) (2026-06-19)


### Bug Fixes

* **translation:** honor empty-source signal so truncated list snapshots re-verify from DB ([d5f322b](https://github.com/mx-space/core/commit/d5f322b18eb5b91d662489c015f7fb6dbb495b9c))

# [13.11.0](https://github.com/mx-space/core/compare/v13.10.10...v13.11.0) (2026-06-19)


### Features

* **snippet,response:** skill bundle distribution + per-resource meta builders ([af4b771](https://github.com/mx-space/core/commit/af4b7717cc26967b8c5261c1187b89e9c62e0144))
* **snippet:** vfs refactor — folder hierarchy, move endpoint, cli pull/push ([54326e2](https://github.com/mx-space/core/commit/54326e25d9ebdbbd098ec562de0d07518b351c2a))

## [13.10.10](https://github.com/mx-space/core/compare/v13.10.9...v13.10.10) (2026-06-18)


### Bug Fixes

* **snippet:** trust serverUrl as the API base for rawUrl ([8fdfe5e](https://github.com/mx-space/core/commit/8fdfe5efddc5dc9725be169be68fdc80edb37c8a))

## [13.10.9](https://github.com/mx-space/core/compare/v13.10.8...v13.10.9) (2026-06-17)


### Features

* attach AI skills to blog posts (post.meta.skillIds) ([#2754](https://github.com/mx-space/core/issues/2754)) ([7ec6904](https://github.com/mx-space/core/commit/7ec6904a79e7b84e85608e706e292c0c7fe866fb))

## [13.10.8](https://github.com/mx-space/core/compare/v13.10.7...v13.10.8) (2026-06-14)

## [13.10.7](https://github.com/mx-space/core/compare/v13.10.6...v13.10.7) (2026-06-14)


### Bug Fixes

* **core:** honor search query on grouped AI translations endpoint ([d0d9f8c](https://github.com/mx-space/core/commit/d0d9f8cb8785ffbe351ca7c3dc9688509cbef2aa))

## [13.10.6](https://github.com/mx-space/core/compare/v13.10.5...v13.10.6) (2026-06-13)

## [13.10.5](https://github.com/mx-space/core/compare/v13.10.4...v13.10.5) (2026-06-12)


### Bug Fixes

* restore package versions clobbered by autostash merge ([70fa7bd](https://github.com/mx-space/core/commit/70fa7bd8baae55a5c1a2ca58d081d9e425663ff8))
* **snippet,admin:** strip query string in snippet route; catalog-membership allowlist ([532a2b7](https://github.com/mx-space/core/commit/532a2b727edfe539a4451662c67e731dc27e7651))


### Features

* **admin:** dynamic external component node integration ([bccca95](https://github.com/mx-space/core/commit/bccca95da69b0fbee521ceacf59eb7f7cfa970c7))

## [13.10.4](https://github.com/mx-space/core/compare/v13.10.3...v13.10.4) (2026-06-11)


### Bug Fixes

* **ai-translation:** include rich-quote in inline translation flow grouping ([9b79e28](https://github.com/mx-space/core/commit/9b79e284a9c53df834573c238f0b4967a3d190b2))

## [13.10.3](https://github.com/mx-space/core/compare/v13.10.2...v13.10.3) (2026-06-11)


### Bug Fixes

* **s3:** slice multipart stream parts to a fixed size ([a39b24f](https://github.com/mx-space/core/commit/a39b24f57c0bb0d593f9bac7a6ddbb438218ee79))

## [13.10.2](https://github.com/mx-space/core/compare/v13.10.1...v13.10.2) (2026-06-11)


### Bug Fixes

* **core:** security and performance audit — SSRF guards, IP handling, hot-path cleanups ([915d0e3](https://github.com/mx-space/core/commit/915d0e320333231c62c7f13a5e089f4a3c70b80d))


### Performance Improvements

* **api:** project article bodies out of hot list endpoints ([64cb110](https://github.com/mx-space/core/commit/64cb110ab844f06f471a40125e3e54f8290753cc))

## [13.10.1](https://github.com/mx-space/core/compare/v13.10.0...v13.10.1) (2026-06-11)

# [13.10.0](https://github.com/mx-space/core/compare/v13.9.0...v13.10.0) (2026-06-10)


### Bug Fixes

* **ai-summary:** attach stored summary to public meta regardless of content hash ([17a511e](https://github.com/mx-space/core/commit/17a511e0c2277e7ab40682e66148e5cc816f5dc0))
* **ai-translation:** never reuse block translations identical to source ([b4c8640](https://github.com/mx-space/core/commit/b4c8640855a5aede3665e4443c267d4308c7c099))
* **ai:** populate article list in translation-all task ([240dae7](https://github.com/mx-space/core/commit/240dae7395895b0138222057263477efdd0e1a1f)), closes [#2745](https://github.com/mx-space/core/issues/2745) [#2744](https://github.com/mx-space/core/issues/2744)


### Features

* unified task queue ([#2746](https://github.com/mx-space/core/issues/2746)) ([57a19c8](https://github.com/mx-space/core/commit/57a19c872058d60d0acf7597a427a1134cd518a1))

# [13.9.0](https://github.com/mx-space/core/compare/v13.8.0...v13.9.0) (2026-06-10)


### Features

* video upload in the admin rich editor ([4d0194c](https://github.com/mx-space/core/commit/4d0194c5fb4042ea0f0e2ade348041cc7aec0dfb))

# [13.8.0](https://github.com/mx-space/core/compare/v13.7.0...v13.8.0) (2026-06-10)


### Features

* **cli:** mxs project management surface ([cc7a38d](https://github.com/mx-space/core/commit/cc7a38d438e9cc75b372857a16ee0eafd24a5b29))

# [13.7.0](https://github.com/mx-space/core/compare/v13.6.0...v13.7.0) (2026-06-08)


### Features

* **core:** migrate admin updater to R2 latest.json manifest ([31b6e33](https://github.com/mx-space/core/commit/31b6e33c7a5249ea8d3b3ddda12144f07672a9f0)), closes [#release](https://github.com/mx-space/core/issues/release)

# [13.6.0](https://github.com/mx-space/core/compare/v13.5.2...v13.6.0) (2026-06-08)


### Features

* add mx editor litexml integration ([#2743](https://github.com/mx-space/core/issues/2743)) ([8b9cf34](https://github.com/mx-space/core/commit/8b9cf34a3dc2d936566c7a60fd6d66aea11255a8))

## [13.5.2](https://github.com/mx-space/core/compare/v13.5.1...v13.5.2) (2026-06-06)

## [13.5.1](https://github.com/mx-space/core/compare/v13.5.0...v13.5.1) (2026-06-05)

# [13.5.0](https://github.com/mx-space/core/compare/v13.4.0...v13.5.0) (2026-06-05)

# [13.4.0](https://github.com/mx-space/core/compare/v13.3.1...v13.4.0) (2026-06-05)


### Bug Fixes

* **ai:** inline Value.Check in callWriterStreaming done branch ([587903e](https://github.com/mx-space/core/commit/587903ec90d845ad897a9eb6b5e4e7bac93bac61))
* **core:** resolve stale conflict markers in migration journal ([19e2517](https://github.com/mx-space/core/commit/19e25178357fa0f4921632312b80f655841749e0))


### Features

* add Map Lexical node and S3 file uploads ([45b4a47](https://github.com/mx-space/core/commit/45b4a4760f76d8be008a6e0cbe055be27f6b6f24))
* **admin:** /comments redesign — inbox tabs, R3 rows, thread stream, meta sidebar ([9c2345b](https://github.com/mx-space/core/commit/9c2345bda3a5d700ebb32f0f2a6bfb9143b8ccfa))
* **admin:** URL-driven master-detail with iOS push nav stack ([a5b9dff](https://github.com/mx-space/core/commit/a5b9dff3a40d450b253bfc00c814d1d5d7067954))
* **ai-agent:** conversation title + admin panel refactor ([ccddc78](https://github.com/mx-space/core/commit/ccddc78432da776f128bdc89f7a907926130ab34))
* **packages:** extract @mx-space/ai for shared AiAgentSseEvent + finish haklex 0.16.1 bump ([108ccd9](https://github.com/mx-space/core/commit/108ccd95d3830d155dfc6284abc3bd3d77c04fdf))
* **spec1:** step-1 — add @earendil-works/pi-ai dependency ([969c36a](https://github.com/mx-space/core/commit/969c36adc09fe1549767a9c8f5eb8985745eca8f))
* **spec1:** step-11 — migrate AiAgentChatService to streamMessage with accumulator + abort persistence ([676041b](https://github.com/mx-space/core/commit/676041bf30b6dd00a0e8e93157e1bf860280b842))
* **spec1:** step-12 — rewrite ai-agent SSE controller with JSON-frame protocol ([4f83662](https://github.com/mx-space/core/commit/4f836620fd94ca5e2458be4bf9a91f8405caa978))
* **spec1:** step-13 — wire AiInFlightService leader source from pi streamMessage ([d3b064b](https://github.com/mx-space/core/commit/d3b064b68491aad2f5a47aa554e3d0e9b9490020))
* **spec1:** step-14 — GET /api/ai/registry/models endpoint with cache + auth + pinned wire shape ([815de31](https://github.com/mx-space/core/commit/815de31c45e8af6a759fc6787d0e3905faf41f87))
* **spec1:** step-15 — faux-ai helper + pi-runtime adapter spec + per-service faux e2e ([17acc4c](https://github.com/mx-space/core/commit/17acc4c53f78c9db9da0865fb4702fd396c67bc2))
* **spec1:** step-16 — byte-exact SSE envelope + leader/follower parity regression ([6786dee](https://github.com/mx-space/core/commit/6786deebc262b3033386629c5b291dde69390689))
* **spec1:** step-17 — rewrite AI provider factory spec; drop legacy OpenAI runtime spec ([93431f8](https://github.com/mx-space/core/commit/93431f8df9185a51be1467e43b0c5a0bbc1b9396))
* **spec1:** step-2 — expand IModelRuntime additively for pi-ai migration ([c8013f2](https://github.com/mx-space/core/commit/c8013f22df96b7f0c9d82846d869635c47d8ce32))
* **spec1:** step-20 — final sweep: docs, type drift, consumer smoke ([d3c00a4](https://github.com/mx-space/core/commit/d3c00a4b9832d6bb91c180a2d0d03b1d96ec9122))
* **spec1:** step-3a — reduce AIProviderType to 3 values + jsonb config migration ([501ff20](https://github.com/mx-space/core/commit/501ff207e14480706040c87af398003d973c51fd))
* **spec1:** step-4 — port ai.prompts.ts structured schemas to TypeBox ([98c44f3](https://github.com/mx-space/core/commit/98c44f3e3e28e0e626cc038b7103b8a3f1f7f37c))
* **spec1:** step-5 — implement PiRuntimeAdapter (model resolve, generate/stream/message, usage mapping) ([25586d2](https://github.com/mx-space/core/commit/25586d2e9728cd8cfbab6c70941646cb724a3ff4))
* **spec1:** step-6 — JSON-Schema -> TypeBox converter for chat tools ([711badc](https://github.com/mx-space/core/commit/711badc1fd589c063a1566f6c1088e7301459d28))
* **spec1:** step-7 — collapse runtime factory to PiRuntimeAdapter; drop legacy ai-sdk + openai/anthropic deps ([c7a0e9b](https://github.com/mx-space/core/commit/c7a0e9b16f4df6ad80cd6c9607a81e1a5f475b3c))
* **spec1:** step-8 — migrate structured-output call sites to TypeBox Value.Check ([aa126ce](https://github.com/mx-space/core/commit/aa126ce86c16c9d4e0d84b8ab45c0b66067fbaca))
* **spec1:** step-9 — rewrite ai_agent_conversations to session-scoped pi schema ([1189565](https://github.com/mx-space/core/commit/1189565c7419ff74c557ba96371ef7e4cfacd11e))
* **spec2:** step-1 — add AI_TASK_UPDATE BusinessEvent + payload type ([bf5ea39](https://github.com/mx-space/core/commit/bf5ea3941d35f8930a74f1dcf9405172ec131178))
* **spec2:** step-10 — rewrite executeTranslationTask with p-limit + abort cancels orphans ([73ecf36](https://github.com/mx-space/core/commit/73ecf36a248360f1e1673bdadbb45b2e40a444a0))
* **spec2:** step-11 — implement PiRuntimeAdapter.streamStructured ([a441231](https://github.com/mx-space/core/commit/a441231265127e67b530c75293bbd214031d56d4))
* **spec2:** step-12 — widen AiStreamEvent + filter partial at public SSE controllers ([948c827](https://github.com/mx-space/core/commit/948c8278286ed7458d06c8d6228afc167f220960))
* **spec2:** step-13 — thread push callback to strategy.translate site (markdown wiring) ([79408f9](https://github.com/mx-space/core/commit/79408f948023a9573630f2d95e56bf3401b07712))
* **spec2:** step-14 — callWriterStreaming + lexical strategy push wiring ([727c140](https://github.com/mx-space/core/commit/727c1401725360b6345cb77166d51196a65f67f3))
* **spec2:** step-15 — widen langPush to forward partial events to streamPusher ([ba3f0c4](https://github.com/mx-space/core/commit/ba3f0c4c632ff25bdeb5378934fe8fd9f132cf3f))
* **spec2:** step-16 — task cost capture via incrementCost helper (HINCRBY cents) ([ceaa49c](https://github.com/mx-space/core/commit/ceaa49c820f963c6fcf1b3bf72edfabf8598e873))
* **spec2:** step-17 — adapter usage type: add cost to result.usage shapes ([ced2297](https://github.com/mx-space/core/commit/ced2297841721a23c0c3bc0133726741d78ed945))
* **spec2:** step-18a — cost forwarding through translation strategies + service ([c922764](https://github.com/mx-space/core/commit/c922764172792ad44ba89081248bd7e7b66116df))
* **spec2:** step-18b — cost forwarding through summary + insights services ([ff5974c](https://github.com/mx-space/core/commit/ff5974cd7596e964525021d1583b617cc9dee701))
* **spec2:** step-19 — totalCost + parent group recompute in emits ([bec39a0](https://github.com/mx-space/core/commit/bec39a088cc615d91c54c427bfd5ec4fb36840e9))
* **spec2:** step-2 — RoomSubsService (Redis SET + heartbeat + TTL gate) ([7875a62](https://github.com/mx-space/core/commit/7875a62e3d800217769a4666849a7dfd556f6800))
* **spec2:** step-26a — backend pure-logic specs (emitter / stream-buffer / cost) ([eecadc4](https://github.com/mx-space/core/commit/eecadc489aee481662fc90b6f4233949fb84dcde))
* **spec2:** step-26b — executeTranslationTask concurrency + cancellation spec ([b451d78](https://github.com/mx-space/core/commit/b451d7811adb6e8b7521760cc55b66ece8b42271))
* **spec2:** step-26c — cross-pod Redis SET subscriber gate test ([3892c16](https://github.com/mx-space/core/commit/3892c16dd7d299c190babeeb80c2f2f9e3807750))
* **spec2:** step-26d — augment public SSE controllers spec with data-line partial-payload guards ([375d2b8](https://github.com/mx-space/core/commit/375d2b83f007d2e4d1edef07fc6e9af3d0ccace5))
* **spec2:** step-3 — add emitToAdminRoom helper on EventManagerService ([f450887](https://github.com/mx-space/core/commit/f45088705543cdc72661679153bcfdd703d8bed5))
* **spec2:** step-4 — ai-task subscribe/unsubscribe + disconnect cleanup ([5b8a11e](https://github.com/mx-space/core/commit/5b8a11e1299aae26ed40bd4cff46b7dec276bf61))
* **spec2:** step-5 — TaskQueueEmitter (throttled progress) + TaskStreamBuffer ([b30f093](https://github.com/mx-space/core/commit/b30f093d6b5851fe2f65359b6560397ec619f8b0))
* **spec2:** step-6 — wire TaskQueueEmitter into TaskQueueService ([f98eb17](https://github.com/mx-space/core/commit/f98eb172feb3d0d5ccfd8142308d8cf69523f484))
* **spec2:** step-6a — LUA_RECOVER_STALE returns { count, ...ids } with dual-shape handler ([190ff39](https://github.com/mx-space/core/commit/190ff39ab10491632eff638e780e54569e4001dc))
* **spec2:** step-7 — wire recoverStaleTasks per-task emits ([d8a4a65](https://github.com/mx-space/core/commit/d8a4a65a8c89c0fea82d0b2a35b686b81a454b6c))
* **spec2:** step-8 — wire streamPusher + TaskStreamBuffer into processor ([65c59cb](https://github.com/mx-space/core/commit/65c59cb2e2bcfd20d8317ae9526a945fc6ffe5b1))
* **spec2:** step-9 — add p-limit + jsonrepair deps and translationLangConcurrency config ([bc0a3ce](https://github.com/mx-space/core/commit/bc0a3ce2a3c18184cc40d040d71275a0f4edc9e1))

## [13.3.1](https://github.com/mx-space/core/compare/v13.3.0...v13.3.1) (2026-05-29)

# [13.3.0](https://github.com/mx-space/core/compare/v13.2.0...v13.3.0) (2026-05-29)


### Bug Fixes

* **comment:** keep reader replies as unread instead of inheriting read state ([7332443](https://github.com/mx-space/core/commit/733244313259bb6b6b3c9e8c1a84902f28542e47))


### Features

* **admin:** integrate admin SPA into the monorepo ([#2740](https://github.com/mx-space/core/issues/2740)) ([76ca444](https://github.com/mx-space/core/commit/76ca444547323bca63306cc0e59f0f4986773793))
* **reader:** add ban support and role-filtered pagination ([91acc5d](https://github.com/mx-space/core/commit/91acc5d3018222a60fd68fc6e1ae5e1180a5afeb))

# [13.2.0](https://github.com/mx-space/core/compare/v13.1.2...v13.2.0) (2026-05-27)


### Features

* **ai-translation:** add writer → reviewer → editor pipeline ([#2739](https://github.com/mx-space/core/issues/2739)) ([4518edb](https://github.com/mx-space/core/commit/4518edbdf5c9199efe49058426d53880201dc192))
* **core:** swap blurhash encoder for thumbhash in image pipeline ([88a0bca](https://github.com/mx-space/core/commit/88a0bcacabd8a7062c87d06813d7bf0d64821edc))
* **db:** rename enrichment_captures.blurhash → thumbhash + JSONB cleanup ([339ac4f](https://github.com/mx-space/core/commit/339ac4fd74e6b7ff3ba88bad6780a237f039d20e))

## [13.1.2](https://github.com/mx-space/core/compare/v13.1.1...v13.1.2) (2026-05-26)

## [13.1.1](https://github.com/mx-space/core/compare/v13.1.0...v13.1.1) (2026-05-26)

# [13.1.0](https://github.com/mx-space/core/compare/v13.0.3...v13.1.0) (2026-05-26)


### Bug Fixes

* **activity:** lowercase identity on presence update ([3798d14](https://github.com/mx-space/core/commit/3798d14c06c7e5cc4514a4879ca55e1858af28e0))
* **gateway:** localize article update payloads ([cd71e1a](https://github.com/mx-space/core/commit/cd71e1a613b540b898636b8420d2965dce1c59e9))


### Features

* **ai:** support partial lexical block translations ([#2737](https://github.com/mx-space/core/issues/2737)) ([40dfd26](https://github.com/mx-space/core/commit/40dfd26ec88748d59101ce3dc0f190b76fadac04))
* **core:** expose ai summary on public article detail meta ([d78967d](https://github.com/mx-space/core/commit/d78967d4d352fb3c0e1a861cd1f84b229dc20509))
* **core:** order reader list by most recent session ([dc826bb](https://github.com/mx-space/core/commit/dc826bbe4d24521bab7be9425c70d94b832457f5))

## [13.0.3](https://github.com/mx-space/core/compare/v13.0.2...v13.0.3) (2026-05-23)


### Bug Fixes

* **core:** surface field errors in zod pipe and tolerate null images ([ae0ab41](https://github.com/mx-space/core/commit/ae0ab41d558158ad3a3d3f1fe613ed5b72d6e861))

## [13.0.2](https://github.com/mx-space/core/compare/v13.0.1...v13.0.2) (2026-05-23)


### Bug Fixes

* **auth:** align device verify schema with camelCase pipe ([f5703a2](https://github.com/mx-space/core/commit/f5703a23419a5328059ecfe559801d10c0274ac0))

## [13.0.1](https://github.com/mx-space/core/compare/v13.0.0...v13.0.1) (2026-05-23)


### Bug Fixes

* **dev:** force-kill nodemon child with SIGKILL to prevent duplicate cores ([e3cd8da](https://github.com/mx-space/core/commit/e3cd8daa835f1f3f23a2762e41d528150d3898f6))


### Features

* **aggregate:** support theme fallback chain via pipe separator ([e2118f5](https://github.com/mx-space/core/commit/e2118f51c0d23465b8388d400d91aeb4d74a4a75))
* **snippet:** allow dots and hyphens in snippet name ([1fb180f](https://github.com/mx-space/core/commit/1fb180fd6d2d9574e59f4b00166dac26671a7a8b))

# [13.0.0](https://github.com/mx-space/core/compare/v12.10.0...v13.0.0) (2026-05-22)


### Bug Fixes

* **deps:** dedupe drizzle-orm peer variants and restore EntryMaps import ([cf03b14](https://github.com/mx-space/core/commit/cf03b14ab9fe47734f5f965194a1923f7e3c7f32))

# [12.10.0](https://github.com/mx-space/core/compare/v12.9.5...v12.10.0) (2026-05-20)


### Features

* **enrichment:** rename image/screenshot schema and add previewImage OG URLs ([#2734](https://github.com/mx-space/core/issues/2734)) ([975eb59](https://github.com/mx-space/core/commit/975eb598de496e26d89a5eb91195da441e374eb7))

## [12.9.5](https://github.com/mx-space/core/compare/v12.9.4...v12.9.5) (2026-05-19)


### Bug Fixes

* **core:** keep article bodies out of homepage & post-list payloads ([4e3a11e](https://github.com/mx-space/core/commit/4e3a11ee585409cfab50e04a7408a9dab6e7d341))

## [12.9.4](https://github.com/mx-space/core/compare/v12.9.3...v12.9.4) (2026-05-19)


### Bug Fixes

* **auth:** derive device verification URI from request host ([d591655](https://github.com/mx-space/core/commit/d5916554e5eb2cbc64c563dd37bb951964312355))
* **core:** coerce non-numeric exception status to a valid HTTP code ([f24c9f9](https://github.com/mx-space/core/commit/f24c9f9c2c6c8f22d74f1e6b22cede3a8eb887ca))

## [12.9.3](https://github.com/mx-space/core/compare/v12.9.2...v12.9.3) (2026-05-19)


### Bug Fixes

* **auth:** revert dynamic baseURL device verification ([12828bf](https://github.com/mx-space/core/commit/12828bf4cf97661e3adc628b9524bc082f5b0d1e))

## [12.9.2](https://github.com/mx-space/core/compare/v12.9.1...v12.9.2) (2026-05-19)


### Bug Fixes

* **auth:** derive device verification URI host from request ([a904013](https://github.com/mx-space/core/commit/a904013a1a1b468551af4451ed575ef214981647))
* **core:** key schema migration idempotency on content hash ([d1668db](https://github.com/mx-space/core/commit/d1668db9384b06efa3426db780a538dcb97a32fc))

## [12.9.1](https://github.com/mx-space/core/compare/v12.9.0...v12.9.1) (2026-05-18)


### Bug Fixes

* **note:** add outer ORDER BY to default visible note list query ([11c22a0](https://github.com/mx-space/core/commit/11c22a0dcf1407411ba23e576bd4dab8332ebe79))

# [12.9.0](https://github.com/mx-space/core/compare/v12.8.0...v12.9.0) (2026-05-18)


### Bug Fixes

* **cli,core:** allow authenticated requests through spider guard ([c4ab9c5](https://github.com/mx-space/core/commit/c4ab9c584fc79254fc0eb76be917c5871cc1b508))


### Features

* **cli:** environment profile system ([#2733](https://github.com/mx-space/core/issues/2733)) ([49d5d22](https://github.com/mx-space/core/commit/49d5d229b0783cf8d12637f7166a2ce28a27a113))
* **core,cli:** spider guard fast-path + cli User-Agent ([28cb17d](https://github.com/mx-space/core/commit/28cb17d5c99c40457f9e727812c9415df59770d0))

# [12.8.0](https://github.com/mx-space/core/compare/v12.7.1...v12.8.0) (2026-05-17)


### Features

* @mx-space/cli (mxs) v1 — OIDC device auth + content/config commands ([#2723](https://github.com/mx-space/core/issues/2723)) ([d103b26](https://github.com/mx-space/core/commit/d103b26351d085fb2f7a5255da820ffa21704bb3))


### Performance Improvements

* **db:** optimize hot content queries ([#2732](https://github.com/mx-space/core/issues/2732)) ([c5fda4c](https://github.com/mx-space/core/commit/c5fda4c07e14d0f168b33be7959e4d9fdef746af))


### BREAKING CHANGES

* The apiKey plugin's customAPIKeyGetter and
AuthService.getApiKeyFromRequest no longer accept API keys via
`Authorization: Bearer <key>`. The Bearer header is now reserved for
Better Auth session/OIDC access tokens. Existing clients must migrate
to `x-api-key: <key>`.

Tests:
- auth-device.e2e-spec.ts (6) — device code, verify+approve happy path, deny, expired, unauthorized
- device-controller.e2e-spec.ts (8) — render, redirects, approve/deny/401 paths
- auth-bearer-narrowing.e2e-spec.ts (3) — Bearer rejected, x-api-key works

Note: requires the deviceCodes table from packages/db-schema (next commit)
and an assets/render/device.ejs template (separate PR in mx-space/assets).

* feat(db): add device_codes table for Better Auth device flow

The deviceAuthorization plugin persists pending device-code / user-code
pairs in a `deviceCode` model that did not exist in our schema. Without
this table, `mxs auth login` would fail at runtime with
`BetterAuthError: model "deviceCode" not found`.

Expand-only migration: CREATE TABLE + three indexes (device_code unique,
user_code unique, expires_at idx for cleanup), FK user_id → readers.id
ON DELETE CASCADE. Empty new table — safe for rolling deploy.

Migration file: 0012_device_codes_table.sql. lint:migrations ok.

* feat(cli): add @mx-space/cli (binary mxs) v1

A self-host-oriented CLI for mx-core. Authenticates via OIDC device flow
against the Better Auth deviceAuthorization plugin, then drives content,
config, and metadata operations through the server's REST API.

v1 scope:
- auth: login (device flow), logout, whoami, status
- post / note / page: list, get, create, edit, update, delete (+publish for post/note)
- category / topic: list, get, create, update, delete
- config: list, get, set, edit
- All write paths accept either a single .xml envelope (--file) or per-field
  flags, including --content=file=<path> for AI-driven authoring. LiteXML
  content is round-tripped through @haklex/rich-litexml.

v2/v3 items captured in packages/cli/ROADMAP.md.

Tests: 54/54 vitest passing, typecheck clean.

Spec: docs/superpowers/specs/2026-05-14-mx-core-cli-design.md

* fix(cli): repair authenticated content commands

* feat(cli): add readable document output

* feat(auth): enhance auth middleware and device controller with better bypass logic and verification

Signed-off-by: Innei <tukon479@gmail.com>

* chore: regenerate lockfile after merge with origin/master

* refactor(render): redesign device + download-admin pages with flat line style

- Add embed/render/device.ejs (1px stroke, radius 0, monochrome auto, mono DEVICE badge)
- Register device.ejs in embed/index.ts EMBED_FILES map
- Drop 60-line INLINE_DEVICE_TEMPLATE; loadTemplate now throws when missing
- Rewrite download-admin.ejs to match (drop Inter/Geist Mono, shadows, radius, colored badges); preserve i18n, theme toggle, ANSI log, progress, action DOM hooks

* fix(cli): resolve category/note ids correctly for slug-based commands

- Extract resolveCategoryId helper; unwrap the double envelope returned by
  GET /categories/:slug (was reading res.data?.id, always undefined) so
  category update/delete by slug stop throwing "category not found"
- Extract resolveNoteId helper; reject non-snowflake non-numeric input with
  a clear validation error instead of silently falling through to a 404 on
  GET /notes/:slug (no such server route)
- Cover both resolvers with unit tests

## [12.7.1](https://github.com/mx-space/core/compare/v12.7.0...v12.7.1) (2026-05-16)


### Bug Fixes

* **comment:** restore email type enum values to match template filenames ([a549765](https://github.com/mx-space/core/commit/a5497655b9e0d6a2ef880e077022ed2c3f9a4d3c))

# [12.7.0](https://github.com/mx-space/core/compare/v12.6.0...v12.7.0) (2026-05-15)


### Features

* **recently:** URL-keyed enrichment map, drop typed entries ([#2726](https://github.com/mx-space/core/issues/2726)) ([91b8a47](https://github.com/mx-space/core/commit/91b8a47469e9b9f96016b7aa3651a2ffa6669719))

# [12.6.0](https://github.com/mx-space/core/compare/v0.7.0...v12.6.0) (2026-05-15)


### Features

* **enrichment:** harden Open Graph browser mode against anti-bot pages ([#2724](https://github.com/mx-space/core/issues/2724)) ([383e0e4](https://github.com/mx-space/core/commit/383e0e4e1977873025f1385c81eeb3927b91246f))
* **enrichment:** keep og-parser image OG-strict with dimensions ([8651e5c](https://github.com/mx-space/core/commit/8651e5c24e73c0459625e069d3e0a3c56b8e4153))

## [12.5.4](https://github.com/mx-space/core/compare/v12.5.3...v12.5.4) (2026-05-14)


### Bug Fixes

* **deps:** update dependency @anthropic-ai/sdk to ^0.96.0 ([#2684](https://github.com/mx-space/core/issues/2684)) ([baeb77b](https://github.com/mx-space/core/commit/baeb77bb73ad2266790c34ec2ccce69412c5ad11))
* **deps:** update nest monorepo to v11.1.21 ([#2712](https://github.com/mx-space/core/issues/2712)) ([daf9a9a](https://github.com/mx-space/core/commit/daf9a9a7c51c13d576bbf0afad542748af072cdc))
* **translation:** align TranslateFields path to data[] key ([65c73e7](https://github.com/mx-space/core/commit/65c73e71d9f5414a23525914cb7e9c83665038ac))


### Features

* **ai:** preserve mermaid diagrams during translation ([849c435](https://github.com/mx-space/core/commit/849c435eeb3a5f6aa5572716bc7647a50b8bd3cd))

## [12.5.3](https://github.com/mx-space/core/compare/v12.5.2...v12.5.3) (2026-05-14)

## [12.5.2](https://github.com/mx-space/core/compare/v12.5.1...v12.5.2) (2026-05-13)


### Features

* **enrichment:** screenshot only as og:image fallback in browser mode ([9ca84a5](https://github.com/mx-space/core/commit/9ca84a59e596bc23a87d11c1fe5095fcc26e1e69))

## [12.5.1](https://github.com/mx-space/core/compare/v12.5.0...v12.5.1) (2026-05-13)

# [12.5.0](https://github.com/mx-space/core/compare/v12.4.1...v12.5.0) (2026-05-13)


### Features

* **enrichment:** admin endpoints for cache detail, screenshots, and probe ([f61203c](https://github.com/mx-space/core/commit/f61203c8bb4090f057c122c5a0e1ec7e5ec65186))

## [12.4.1](https://github.com/mx-space/core/compare/v12.4.0...v12.4.1) (2026-05-13)


### Bug Fixes

* **enrichment:** parse nested agent-browser eval result shape ([2d3f693](https://github.com/mx-space/core/commit/2d3f693c3c7d28b0df9c9b63fdc1aa5cbbed0f33))
* **enrichment:** query GitHub Discussions via GraphQL ([7606ab5](https://github.com/mx-space/core/commit/7606ab5a69def007bb9a49e286995db44553ef43))
* **gateway:** remove spurious forwardRef breaking @WebSocketServer injection ([9831804](https://github.com/mx-space/core/commit/98318042d92458b480e22a20c96e5efb665d24a6))

# [12.4.0](https://github.com/mx-space/core/compare/v12.3.5...v12.4.0) (2026-05-13)


### Features

* **enrichment:** add screenshot pipeline with browser fetch and storage ([#2708](https://github.com/mx-space/core/issues/2708)) ([417a153](https://github.com/mx-space/core/commit/417a1536addc58883d3243b0c88258ba5308349f))

## [12.3.5](https://github.com/mx-space/core/compare/v12.3.4...v12.3.5) (2026-05-13)


### Bug Fixes

* **activity:** resolve presence readerId from HTTP session cookie ([181da63](https://github.com/mx-space/core/commit/181da6312d96c4e3b3836bec4eca8a1c3fb54d2b))

## [12.3.4](https://github.com/mx-space/core/compare/v12.3.3...v12.3.4) (2026-05-12)


### Bug Fixes

* **activity:** bind reader to socket at ws handshake ([c2a709c](https://github.com/mx-space/core/commit/c2a709cb7c8b4171ac5f4a7c5a4c200cad02ba65))
* **enrichment:** preserve open graph refresh url context ([fb87132](https://github.com/mx-space/core/commit/fb87132329518306ea2222cc3aacc1b502d73600))


### Features

* **ai-translation:** translate Lexical Poll node ([#2709](https://github.com/mx-space/core/issues/2709)) ([9e5cdf6](https://github.com/mx-space/core/commit/9e5cdf691e318622da72e9db62d1987e3f10d511))
* **enrichment:** origin guard + throttle on public endpoints ([40f7514](https://github.com/mx-space/core/commit/40f75142450fe8d21f8c4788f2136a3da2a765f8))

## [12.3.3](https://github.com/mx-space/core/compare/v12.3.2...v12.3.3) (2026-05-11)


### Bug Fixes

* **auth:** accept Better Auth keys without txo prefix in x-api-key ([a5be497](https://github.com/mx-space/core/commit/a5be497e9991aac5c8b83f6a6405a8c3d59cc556)), closes [#2705](https://github.com/mx-space/core/issues/2705)
* **auth:** add missing isCustomToken method and fix test deadlock ([176bb6f](https://github.com/mx-space/core/commit/176bb6f44b9d482f4faa16a2ed38aa3c269cb0a3))
* **auth:** remove stale isCustomToken test case ([e476439](https://github.com/mx-space/core/commit/e476439e6bdf77b2e69c1e3aa47fb1ac9b765504))
* **data-jobs:** change run method to a property for DataJob interface ([4ef68ed](https://github.com/mx-space/core/commit/4ef68ed87b962eec1213a7b43bbb31276734f665))

## [12.3.2](https://github.com/mx-space/core/compare/v12.3.1...v12.3.2) (2026-05-11)


### Bug Fixes

* **poll:** bypass response key transform to preserve option ids ([728d797](https://github.com/mx-space/core/commit/728d797ba586d3068ef9f0b258be6f5256a2234c))
* **poll:** restrict vote definitions to lexical nodes ([0a12537](https://github.com/mx-space/core/commit/0a125375852abffc46d6b1ed1b78b768dd4eb56c))
* **poll:** validate public vote eligibility ([a386b21](https://github.com/mx-space/core/commit/a386b2143d17ac1dc0aa55030253c96174618d5b))

## [12.3.1](https://github.com/mx-space/core/compare/v12.3.0...v12.3.1) (2026-05-10)


### Bug Fixes

* **note:** use database-generated nid ([c3fefe2](https://github.com/mx-space/core/commit/c3fefe24d22159942c33a397c723f2a3f8897734))

# [12.3.0](https://github.com/mx-space/core/compare/v12.2.6...v12.3.0) (2026-05-10)


### Bug Fixes

* **ai-summary:** scope findByHash by lang to return correct locale ([25d7768](https://github.com/mx-space/core/commit/25d776808e071ccc536d5ff1bc9b4a8043f17c14))


### Features

* **note:** add excludeId option to filter notes by created window ([ddc586a](https://github.com/mx-space/core/commit/ddc586ab6f5dbdb42195652480a88dd1f8dd946e))
* **search:** multilingual BM25 with translation + fallback ([#2698](https://github.com/mx-space/core/issues/2698)) ([bb77cde](https://github.com/mx-space/core/commit/bb77cdeb84422dcd2393f6080f4cd2831ecc08e9))

## [12.2.6](https://github.com/mx-space/core/compare/v12.2.5...v12.2.6) (2026-05-09)


### Bug Fixes

* **enrichment:** synthesize merged state for github pr ([c1065af](https://github.com/mx-space/core/commit/c1065affa8639b3ce21a9197c7ff11566f5a3028))


### Features

* **enrichment:** hydrate recently by ref, share batch primitive ([c5dde29](https://github.com/mx-space/core/commit/c5dde294bacba819d9041b9a40391c2483fed343))
* **enrichment:** skip og SSRF guards in development ([36ac82a](https://github.com/mx-space/core/commit/36ac82afed0ad72e6738f64e52843e9501a7f612))

## [12.2.5](https://github.com/mx-space/core/compare/v12.2.4...v12.2.5) (2026-05-08)


### Bug Fixes

* **comment:** auto mark parent as read when owner replies ([d29c509](https://github.com/mx-space/core/commit/d29c5090d77ddd8cd44d1faf6a938942943f8b53))


### Features

* **enrichment:** add open-graph fallback provider ([fa76daa](https://github.com/mx-space/core/commit/fa76daa6ae0f01e0c0c8a00ef6886e9a34063f94))

## [12.2.4](https://github.com/mx-space/core/compare/v12.2.3...v12.2.4) (2026-05-08)

## [12.2.3](https://github.com/mx-space/core/compare/v12.2.2...v12.2.3) (2026-05-08)


### Features

* **enrichment:** enhance language handling and AI integration in MxSpaceProvider ([dfcaee6](https://github.com/mx-space/core/commit/dfcaee6d5716a9693e69e5b81c279c0ec261f2fd))

## [12.2.2](https://github.com/mx-space/core/compare/v12.2.1...v12.2.2) (2026-05-07)


### Features

* add new database constants and methods for post and note retrieval ([509de8f](https://github.com/mx-space/core/commit/509de8f6ce540268eb98d81c33e45b9132b59fdf))
* **enrichment:** localize MxSpaceProvider, fix lexical link extraction ([f4e6b18](https://github.com/mx-space/core/commit/f4e6b1880362f6b2debaaf662a5ab9e2b82e9a14))

## [12.2.1](https://github.com/mx-space/core/compare/v12.2.0...v12.2.1) (2026-05-07)


### Features

* **enrichment:** add per-locale cache with TMDB en-US backfill ([5c68e81](https://github.com/mx-space/core/commit/5c68e813b938ac5e392969726139d4919e53fe9a))

# [12.2.0](https://github.com/mx-space/core/compare/v12.1.1...v12.2.0) (2026-05-07)


### Bug Fixes

* **deps:** update dependency isbot to v5.1.40 ([#2687](https://github.com/mx-space/core/issues/2687)) ([5786b62](https://github.com/mx-space/core/commit/5786b62df2889712f781ca7975bef7aa044603e3))
* **migrate:** force process.exit after success to unblock mx-migrate ([680944a](https://github.com/mx-space/core/commit/680944adf6ad642eddf88f7709cd09622243340a))
* **test:** provide EnrichmentService in contract test fixtures ([b5ead1b](https://github.com/mx-space/core/commit/b5ead1b7aa1929231be473eb59f23c9c554f2ca1))


### Features

* enrichment integration with recently module + graceful shutdown ([c5c371a](https://github.com/mx-space/core/commit/c5c371a0406876909a1d43a4f3068d0913646e66))
* enrichment module — third-party URL resolver ([#2689](https://github.com/mx-space/core/issues/2689)) ([6a8cb8e](https://github.com/mx-space/core/commit/6a8cb8ed537b2ff4eadf42bea0df37856bb65998))
* **enrichment:** app migration framework + provider readiness + tmdb v4 ([b9b657d](https://github.com/mx-space/core/commit/b9b657d7e6f81386972572e1638ae7ed6a0a2152))
* **enrichment:** implement enrichment refresh task handling and image metadata enrichment ([debbd2b](https://github.com/mx-space/core/commit/debbd2ba8bf066684029f8f2e2e830aa4cc4ff04))
* **enrichment:** integrate URL extraction and hydration in enrichment module ([b40e50d](https://github.com/mx-space/core/commit/b40e50d151f2013e017292ce490dbc4a38ace500))
* **enrichment:** prefetch on doc write, preserve url keys in hydrated map ([91ccf82](https://github.com/mx-space/core/commit/91ccf823a2a58ca777102de4d81ba7bb2a5b0ab9))

## [12.1.1](https://github.com/mx-space/core/compare/v12.1.0...v12.1.1) (2026-05-05)


### Bug Fixes

* **build:** produce real dist for db-schema and stop emitting through tsconfig ([aa5db1e](https://github.com/mx-space/core/commit/aa5db1e996ccfb3161f138f076d412ecc199d3e7))

# [12.1.0](https://github.com/mx-space/core/compare/v12.0.3...v12.1.0) (2026-05-05)


### Bug Fixes

* **auth:** store passkey transports as text not array ([271bbb3](https://github.com/mx-space/core/commit/271bbb3400f30554ad1f675c5086f31a250c5bc8))
* **migrate:** read PG env directly to avoid app.config snowflake check ([cca3a97](https://github.com/mx-space/core/commit/cca3a97b3f6642deabd5e81fb852059f08318149))
* **snippet:** allow null for metatype, schema, path, secret fields ([64297c2](https://github.com/mx-space/core/commit/64297c26568c6bcc9f26f451f72c91f8404a5677))
* **snippet:** allow null for method field, default to GET ([6a7ecdc](https://github.com/mx-space/core/commit/6a7ecdceaf62d750b1323a2a367e9aebf175560a))
* **snippet:** allow null value for comment field in schema ([f3e6c0e](https://github.com/mx-space/core/commit/f3e6c0e60a8d4dbae5af6fdaf9157986874c6b20))
* **snippet:** allow null values for all nullable fields in schema ([f85400c](https://github.com/mx-space/core/commit/f85400c396a3874c272c66a3e6bba8ade3f9372b))


### Features

* **db:** run schema migrations as a release-phase step ([b74d182](https://github.com/mx-space/core/commit/b74d182df38debf3c83a2b680b9cc520c8dd6057))

## [12.0.3](https://github.com/mx-space/core/compare/v12.0.2...v12.0.3) (2026-05-05)

## [12.0.2](https://github.com/mx-space/core/compare/v12.0.1...v12.0.2) (2026-05-05)


### Bug Fixes

* **deps:** update dependency @anthropic-ai/sdk to ^0.93.0 ([#2670](https://github.com/mx-space/core/issues/2670)) ([5a56908](https://github.com/mx-space/core/commit/5a56908f733f3a64efc0d51bd70d3f71e2e684d0))
* **deps:** update dependency drizzle-orm to ^0.45.0 [security] ([#2663](https://github.com/mx-space/core/issues/2663)) ([d02df4c](https://github.com/mx-space/core/commit/d02df4cfdadf952af988e4f6b73b3590769a95c3))
* **deps:** update dependency openai to v6.36.0 ([#2671](https://github.com/mx-space/core/issues/2671)) ([614419c](https://github.com/mx-space/core/commit/614419c77eca2dc236408d4dae4ded9ad085b606))
* **deps:** update dependency zod to v4.4.3 ([#2672](https://github.com/mx-space/core/issues/2672)) ([14e7496](https://github.com/mx-space/core/commit/14e749686fccd3bbda2048b23bf0556a75c81058))
* **pageproxy:** prefer bundled admin when newer than local download ([951752a](https://github.com/mx-space/core/commit/951752ab49f77ddfa471c18ea7251c41f94aeb5a))

## [12.0.1](https://github.com/mx-space/core/compare/v12.0.0...v12.0.1) (2026-05-04)

# [12.0.0](https://github.com/mx-space/core/compare/v11.5.1...v12.0.0) (2026-05-04)


### Bug Fixes

* **deps:** update dependency lru-cache to v11.3.6 ([#2664](https://github.com/mx-space/core/issues/2664)) ([05ff63f](https://github.com/mx-space/core/commit/05ff63fdb92bae07b86c63d54f8a0a3a92f89f20))
* **migration:** skip transient collections (analyzes, webhook_events, serverless_logs) ([b3286c9](https://github.com/mx-space/core/commit/b3286c9964385fbf2a2c06fbd3b6b69c4076152a))


### Features

* **v12:** migrate backend from MongoDB to PostgreSQL + Snowflake IDs ([#2659](https://github.com/mx-space/core/issues/2659)) ([3dd35b0](https://github.com/mx-space/core/commit/3dd35b0e63e75b7e79c18cb807053be217421ca6))

## [11.5.1](https://github.com/mx-space/core/compare/v11.5.0...v11.5.1) (2026-05-02)


### Bug Fixes

* **deps:** update dependency marked to v18.0.3 ([#2654](https://github.com/mx-space/core/issues/2654)) ([3c86d7e](https://github.com/mx-space/core/commit/3c86d7e9fa0318759d6f13ba1a80e5f98deb9ed4))

# [11.5.0](https://github.com/mx-space/core/compare/v11.4.8...v11.5.0) (2026-05-01)


### Bug Fixes

* **deps:** update dependency nanoid to v5.1.11 ([#2651](https://github.com/mx-space/core/issues/2651)) ([02fd3ec](https://github.com/mx-space/core/commit/02fd3ecf8b924a84660862a6575b182317c21d6e))


### Features

* **comment:** reader image upload, quotas, ttl cleanup, admin mgmt ([bce602f](https://github.com/mx-space/core/commit/bce602fc2b6f9fe78cd13d67410f75e31c196b01))

## [11.4.8](https://github.com/mx-space/core/compare/v11.4.7...v11.4.8) (2026-04-30)


### Bug Fixes

* **post:** surface hasInsightsInLocale on detail response ([78d142c](https://github.com/mx-space/core/commit/78d142cacff32c59634bcb031f29d85673a058da))

## [11.4.7](https://github.com/mx-space/core/compare/v11.4.6...v11.4.7) (2026-04-30)


### Bug Fixes

* **category:** include category total post count in detail response ([82e4aa9](https://github.com/mx-space/core/commit/82e4aa9fa87b3c451ce21d4810acdd0dd0d71ef2))


### Features

* **category:** enrich detail responses with summary/tags/pin/count and tagsSum ([ff7d9cd](https://github.com/mx-space/core/commit/ff7d9cd55651f17f89225e7773422838cf996231))

## [11.4.6](https://github.com/mx-space/core/compare/v11.4.5...v11.4.6) (2026-04-29)


### Bug Fixes

* **post,slug-tracker:** correct ObjectId vs string comparisons ([e86be85](https://github.com/mx-space/core/commit/e86be8563c48b1a6ad0d204b0866f741b62b4eec))


### Features

* **ai-translation:** add topic.description as translatable field ([27734a9](https://github.com/mx-space/core/commit/27734a9044e1726ab5734ec2e188dbd2394609d6))
* **poll:** add poll vote module backing [@haklex](https://github.com/haklex) poll node ([3aa1848](https://github.com/mx-space/core/commit/3aa18487e8eb3a5d0df40ad9a39ec046002c9cd1))

## [11.4.5](https://github.com/mx-space/core/compare/v11.4.4...v11.4.5) (2026-04-29)


### Features

* **note:** add topic recent-update endpoint and api-client method ([d72cb29](https://github.com/mx-space/core/commit/d72cb29f82a009697af59469fb339382a9df218e))

## [11.4.4](https://github.com/mx-space/core/compare/v11.4.3...v11.4.4) (2026-04-29)

## [11.4.3](https://github.com/mx-space/core/compare/v11.4.2...v11.4.3) (2026-04-28)


### Features

* **ai:** add min text length threshold for auto summary/insights ([b2444ad](https://github.com/mx-space/core/commit/b2444ad41940006a5c3b167bd842ced092569005))

## [11.4.2](https://github.com/mx-space/core/compare/v11.4.1...v11.4.2) (2026-04-26)


### Features

* **translation:** expose sourceLang in article responses regardless of translation match ([54ae846](https://github.com/mx-space/core/commit/54ae8460f5ed2f669175a6f5ee6e129cd241a6de))

## [11.4.1](https://github.com/mx-space/core/compare/v11.4.0...v11.4.1) (2026-04-25)

# [11.4.0](https://github.com/mx-space/core/compare/v11.3.1...v11.4.0) (2026-04-21)


### Features

* **ai-summary:** split auto-generate flag into create/update ([097d27d](https://github.com/mx-space/core/commit/097d27db4f10a5f7015c51796a1e48760c3a97be))

## [11.3.1](https://github.com/mx-space/core/compare/v11.3.0...v11.3.1) (2026-04-21)


### Bug Fixes

* **ai-insights:** use plain markdown output for translation ([2da0060](https://github.com/mx-space/core/commit/2da006078a7bb13dc54afdb708069cf68f2f6e26))

# [11.3.0](https://github.com/mx-space/core/compare/v11.2.1...v11.3.0) (2026-04-21)


### Bug Fixes

* **ai-insights:** upsert source row and reject same-lang translation ([2c7b2b1](https://github.com/mx-space/core/commit/2c7b2b1baa3e2310e8906ecdaf05b1ad2b37d938))
* **test:** add AiInsightsService mock to note e2e tests ([9f30506](https://github.com/mx-space/core/commit/9f3050622791e846ba7ae0aa1d0ac46f5cd1dd70))
* **test:** mock findOneAndUpdate instead of create in ai-insights spec ([7bfbe85](https://github.com/mx-space/core/commit/7bfbe852bb3b0c214c0a72f60759f836a5272ba8))


### Features

* **ai-insights:** add AIInsightsModel with indexes ([6d7df91](https://github.com/mx-space/core/commit/6d7df9132b96cdeff635db281976ecc01006a8bc))
* **ai-insights:** add collection constant and business events ([c04f437](https://github.com/mx-space/core/commit/c04f437da0ee5490fc4296a149b10eeaff870936))
* **ai-insights:** add config fields and defaults ([a907d06](https://github.com/mx-space/core/commit/a907d060c578221e5c705a854c4ede4af71bf112))
* **ai-insights:** add insights DTOs ([039c551](https://github.com/mx-space/core/commit/039c551cb728464e187655a5224853afb21c44f4))
* **ai-insights:** add insights system prompt and builders ([c2497bc](https://github.com/mx-space/core/commit/c2497bc1f0907e884390e4d2ddddacfcd40e167b))
* **ai-insights:** add insights task types and service helpers ([2a832af](https://github.com/mx-space/core/commit/2a832af4f90275510fede85206aef51189a09510))
* **ai-insights:** add service skeleton with cache lookup ([a2f6681](https://github.com/mx-space/core/commit/a2f66817afe95267de218a8834d3a31d543ba685))
* **ai-insights:** admin listing, CRUD, and event hooks ([5627da9](https://github.com/mx-space/core/commit/5627da9654ebeb962908fb70e5edf56277e446f0))
* **ai-insights:** HTTP and SSE controller ([3686cf4](https://github.com/mx-space/core/commit/3686cf449a2a51b81deb72d4da729eba747a187e))
* **ai-insights:** implement streaming generation and public getters ([cf954f8](https://github.com/mx-space/core/commit/cf954f81fb461460c33eed509fcb2c4ab16e824f))
* **ai-insights:** register services and controller in AiModule ([58a1b8a](https://github.com/mx-space/core/commit/58a1b8a1420bc2716b3b6a8223b5c05fc6a1bb6d))
* **ai-insights:** translation service with auto-dispatch ([19e4d5c](https://github.com/mx-space/core/commit/19e4d5c80caff505e1667f63bc82f59046e7a09d))
* **ai-insights:** wire AiService model getters ([39a7053](https://github.com/mx-space/core/commit/39a70531bb87500e3e97888e7e4b9e9b0c72a2d1))
* **email:** add in-memory send queue with configurable rate limit ([#2640](https://github.com/mx-space/core/issues/2640)) ([f77ae20](https://github.com/mx-space/core/commit/f77ae20131ccb8bda843dc3701e5b5ca7c184d8b))
* **note:** expose hasInsightsInLocale on public note responses ([c279c31](https://github.com/mx-space/core/commit/c279c3146c5f6b4af486c48d48174f6062bd0073))

## [11.2.1](https://github.com/mx-space/core/compare/v11.2.0...v11.2.1) (2026-04-19)

# [11.2.0](https://github.com/mx-space/core/compare/v11.1.4...v11.2.0) (2026-04-18)


### Features

* add comment sort ([9726f45](https://github.com/mx-space/core/commit/9726f45f72416710bd94b50e8fc48d2628f321a4))

## [11.1.4](https://github.com/mx-space/core/compare/v11.1.3...v11.1.4) (2026-04-17)


### Bug Fixes

* **ai-summary:** allow on-demand generation when auto-generate is disabled ([#2639](https://github.com/mx-space/core/issues/2639)) ([db53f0f](https://github.com/mx-space/core/commit/db53f0fa115c1b1163f7e88b37bd2e6456ffe495)), closes [#2627](https://github.com/mx-space/core/issues/2627)
* related post transltion ([0094dda](https://github.com/mx-space/core/commit/0094ddaf773d45f1b54d5e82db636a6cf41aed2a))

## [11.1.3](https://github.com/mx-space/core/compare/v11.1.2...v11.1.3) (2026-04-17)


### Bug Fixes

* **deps:** update dependency @fastify/static to v9.1.1 [security] ([#2633](https://github.com/mx-space/core/issues/2633)) ([0a4027a](https://github.com/mx-space/core/commit/0a4027a9b422f5c3abb40c79f6775e119fc9ea10))
* **note:** translate adjacent note titles via cached translations ([a53a2b6](https://github.com/mx-space/core/commit/a53a2b6d89497450d210259ee6729b08b1b8f09e))

## [11.1.2](https://github.com/mx-space/core/compare/v11.1.1...v11.1.2) (2026-04-07)


### Bug Fixes

* **comment:** only mark owner comments as read on creation ([eaea177](https://github.com/mx-space/core/commit/eaea177777d42be644cd0fdb3b90041d8d54d698))


### Features

* add AI image generation service and controller ([fd3c0b0](https://github.com/mx-space/core/commit/fd3c0b0b425dc84c7d3b941e2f8db6b94625767c))

## [11.1.1](https://github.com/mx-space/core/compare/v11.1.0...v11.1.1) (2026-04-07)


### Bug Fixes

* bug ([9976922](https://github.com/mx-space/core/commit/9976922d092c02d9242b713a7a504ef2b087d819))


### Features

* **aggregate:** support i18n for theme config via lang suffix snippets ([7e89b46](https://github.com/mx-space/core/commit/7e89b46c528151be90707947f9719ef923f77bfc))

# [11.1.0](https://github.com/mx-space/core/compare/v11.0.14...v11.1.0) (2026-04-05)


### Bug Fixes

* MongooseModel is global type, z.record needs key+value args for Zod v4 ([4efc0e2](https://github.com/mx-space/core/commit/4efc0e2ed062bdc530c919d9cc7a62d021590730))


### Features

* **ai-agent:** add multi-session support with metadata fields and endpoints ([6dbee13](https://github.com/mx-space/core/commit/6dbee13c8583386e54c691019354bc215e3f2400))
* **ai:** add agent chat proxy service with format transformation ([645a534](https://github.com/mx-space/core/commit/645a534f5793105619fade36d1bad692cccc82cd))
* **ai:** add agent controller and register in AI module ([96d314f](https://github.com/mx-space/core/commit/96d314f420ab1aa63a04b37c96b67204ea6dd833))
* **ai:** add agent conversation and chat proxy DTOs ([902be67](https://github.com/mx-space/core/commit/902be6745e791995a0a8a4df004159698d77797b))
* **ai:** add agent conversation CRUD service ([31c8756](https://github.com/mx-space/core/commit/31c875686c6c1eea9572398d48b88c3dae3db030))
* **ai:** add agent conversation model and collection constant ([60a4374](https://github.com/mx-space/core/commit/60a4374e592e7bfb898d30429ea4d19e2271c778))

## [11.0.14](https://github.com/mx-space/core/compare/v11.0.13...v11.0.14) (2026-04-02)


### Bug Fixes

* **page:** translate page titles even when text field is not selected ([2182452](https://github.com/mx-space/core/commit/218245219ed47cff4b3f3a73f707b008b2f380f4))

## [11.0.13](https://github.com/mx-space/core/compare/v11.0.12...v11.0.13) (2026-04-02)


### Bug Fixes

* key verfiy ([1a34088](https://github.com/mx-space/core/commit/1a3408894c5e6c7f30e2525ff15c172240a7cd3e))

## [11.0.12](https://github.com/mx-space/core/compare/v11.0.11...v11.0.12) (2026-04-02)


### Bug Fixes

* **comment:** dedupe bark notifications ([9bf08e8](https://github.com/mx-space/core/commit/9bf08e835fe2c8fe9b3717e7db8408e5c0b7120d)), closes [#2624](https://github.com/mx-space/core/issues/2624)


### Features

* **auth:** implement createAccessToken method and enhance API key handling ([34c1f0d](https://github.com/mx-space/core/commit/34c1f0d4491f8cd8420435643f0f753625435925))

## [11.0.11](https://github.com/mx-space/core/compare/v11.0.10...v11.0.11) (2026-04-01)


### Bug Fixes

* **activity:** filter null refs in getRecentComment ([f6ed0c8](https://github.com/mx-space/core/commit/f6ed0c8733e50acc82448b4971c656177da7cfdb))

## [11.0.10](https://github.com/mx-space/core/compare/v11.0.9...v11.0.10) (2026-04-01)


### Features

* add owner-reply endpoint for comment replies with API key auth ([f2ef0cb](https://github.com/mx-space/core/commit/f2ef0cb2e480dfb0748abf50a6cbf867df535db2))

## [11.0.9](https://github.com/mx-space/core/compare/v11.0.8...v11.0.9) (2026-04-01)


### Bug Fixes

* **test:** update translation interceptor test to match plain object conversion behavior ([990d83b](https://github.com/mx-space/core/commit/990d83b3af1dd9d1fd3dd232da4b7c39d6416715))

## [11.0.8](https://github.com/mx-space/core/compare/v11.0.7...v11.0.8) (2026-04-01)

## [11.0.7](https://github.com/mx-space/core/compare/v11.0.6...v11.0.7) (2026-03-31)


### Bug Fixes

* comment api ([2153077](https://github.com/mx-space/core/commit/21530770ea09550b8d023847e311b5c47ed0a7de))
* update scripe ([25fdde6](https://github.com/mx-space/core/commit/25fdde6020d72fcc07780167ae2c425276da728c))

## [11.0.6](https://github.com/mx-space/core/compare/v11.0.5...v11.0.6) (2026-03-28)


### Bug Fixes

* **deps:** update dependency nodemailer to v8.0.4 [security] ([#2622](https://github.com/mx-space/core/issues/2622)) ([29bf581](https://github.com/mx-space/core/commit/29bf58191d43473adc6c603f5ac73acacbed7155))
* **file:** fallback image upload to local storage when S3 is disabled ([32ce773](https://github.com/mx-space/core/commit/32ce77320061f14c9c07e60c9e0c43ba0a258aaf))

## [11.0.5](https://github.com/mx-space/core/compare/v11.0.4...v11.0.5) (2026-03-26)


### Features

* **event:** add AGGREGATE_UPDATE event and enhance config update notifications ([26896fe](https://github.com/mx-space/core/commit/26896fe6860c37a01eb76f678c1570cdfb296ff1))

## [11.0.4](https://github.com/mx-space/core/compare/v11.0.3...v11.0.4) (2026-03-24)


### Bug Fixes

* **activity:** add strictPopulate false for polymorphic ref category populate ([bf20aa5](https://github.com/mx-space/core/commit/bf20aa5c727608fb18613480731e925a1e85e149))
* **activity:** enrich recent posts with category in getRecentPublish ([e60169a](https://github.com/mx-space/core/commit/e60169a57405d3ea87379fd3c3d2bd5f86e10081))
* **activity:** manually look up category for post refs in getRecentComment ([2961214](https://github.com/mx-space/core/commit/29612141a90e6f21e4524c281627ae8aef729e61))

## [11.0.3](https://github.com/mx-space/core/compare/v11.0.2...v11.0.3) (2026-03-24)


### Bug Fixes

* **activity:** populate category in getRecentComment and expose in response ([7dadc81](https://github.com/mx-space/core/commit/7dadc8167f257f41ed4a3b306a449a778568c83c))


### Features

* **ai:** harden lexical translation structured output ([25ca95d](https://github.com/mx-space/core/commit/25ca95dfb9944fbdd424e805c8d689981dc4c34c))
* **ai:** implement Vercel AI Gateway prompt caching in OpenAICompatibleRuntime ([8c2afef](https://github.com/mx-space/core/commit/8c2afefa7a71d8ce3c30dcd00078b4a26855cbdc))

## [11.0.2](https://github.com/mx-space/core/compare/v11.0.1...v11.0.2) (2026-03-23)


### Bug Fixes

* **webhook:** enrich comment payload author and avatar ([2833c38](https://github.com/mx-space/core/commit/2833c38957c670b494065f863b3f21867623a28d))

## [11.0.1](https://github.com/mx-space/core/compare/v11.0.0...v11.0.1) (2026-03-22)


### Bug Fixes

* **file:** orphan cleanup idempotency; remove orphan cleanup cron ([2b4e946](https://github.com/mx-space/core/commit/2b4e946a49b46b24e97af6f737c9969add130cac))

# [11.0.0](https://github.com/mx-space/core/compare/v11.0.0-alpha.1...v11.0.0) (2026-03-22)


### Bug Fixes

* **category:** handle null category in category service ([71f4f91](https://github.com/mx-space/core/commit/71f4f91f41fe662003f22325fef80dccad723d39))
* **deps:** update dependency @nestjs/platform-fastify to v11.1.16 [security] ([#2620](https://github.com/mx-space/core/issues/2620)) ([1d3da45](https://github.com/mx-space/core/commit/1d3da453debe5c64bf8acacd843d84de5c7b6788))
* **post:** add Types import from mongoose ([9cdb244](https://github.com/mx-space/core/commit/9cdb244e600ba08d52fed6652a922ed3504e956a))


### Features

* replace Algolia with local CJK search ([#2621](https://github.com/mx-space/core/issues/2621)) ([2095087](https://github.com/mx-space/core/commit/209508791dd0c71af3845583560ae414110b276f))

# [11.0.0-alpha.1](https://github.com/mx-space/core/compare/v11.0.0-alpha.0...v11.0.0-alpha.1) (2026-03-16)


### Bug Fixes

* **gateway:** send online count directly to connecting socket ([386b8c3](https://github.com/mx-space/core/commit/386b8c3ca42a4836086dbd8cbd8b51786b0662c1))

# [11.0.0-alpha.0](https://github.com/mx-space/core/compare/v10.5.3...v11.0.0-alpha.0) (2026-03-15)

## [10.5.3](https://github.com/mx-space/core/compare/v10.5.2...v10.5.3) (2026-03-15)


### Bug Fixes

* **ai-translation:** translate page subtitles ([c20bf6e](https://github.com/mx-space/core/commit/c20bf6ee6627f07ebe142e63914953fb79b4f9ef))
* **core:** prevent slugged notes from breaking url builder ([6731c88](https://github.com/mx-space/core/commit/6731c88de6e2c3004ad1666752fa42020dd8c38b))

## [10.5.2](https://github.com/mx-space/core/compare/v10.5.1...v10.5.2) (2026-03-15)


### Features

* **aggregate:** add comment options to aggregate response ([a31db1f](https://github.com/mx-space/core/commit/a31db1f8622b5bdd8345a388c8898676c5e4eed9))
* **aggregate:** add public /aggregate/site_info endpoint ([88bd758](https://github.com/mx-space/core/commit/88bd75860d1f5b669ed92b4a3b7bb15cb6e6feaf))
* **aggregate:** update aggregate service and models to include summary and mood/weather fields ([ab426b1](https://github.com/mx-space/core/commit/ab426b107a7672f3c9aacc1ca8d7533e7f03c293))
* **comment:** use authProvider for comment auth channel ([0b9da3b](https://github.com/mx-space/core/commit/0b9da3b724578288cc848f6634ac84afd7da8d28))

## [10.5.1](https://github.com/mx-space/core/compare/v10.5.0...v10.5.1) (2026-03-14)


### Bug Fixes

* **ai-translation:** normalize tags in translation events ([61d9fb5](https://github.com/mx-space/core/commit/61d9fb5c5d8641d59aeb3f78f6b1e04d82a19eb7))
* **recently:** resolve type compatibility issue in RecentlyDto ([3566ac6](https://github.com/mx-space/core/commit/3566ac6f6dadad991b42fb08bd2e9fea02bc507a))


### Features

* **comment:** add reader ref support and migration ([135868b](https://github.com/mx-space/core/commit/135868b3562a89d4ba3929e83a3132c69ca2c4c1))
* **recently:** add typed metadata schema and model fields ([46a8ae5](https://github.com/mx-space/core/commit/46a8ae562e2e413f56783b0571b9b786ddf10fd8))
* **recently:** pass type/metadata in service create/update ([c6c8b2b](https://github.com/mx-space/core/commit/c6c8b2bb56ed662fb759bded881ae3d67170025b))

# [10.5.0](https://github.com/mx-space/core/compare/v10.4.0...v10.5.0) (2026-03-14)


### Bug Fixes

* **note:** translate list results by request locale ([5c44178](https://github.com/mx-space/core/commit/5c44178386ff0817b82c78921d1c1d2aa8688bd0))


### Features

* **ai:** add slug backfill task for notes without slug ([0835863](https://github.com/mx-space/core/commit/083586358adcb4d32321b68d0ca9f38486fb6960))
* flatten comment threads ([70385d9](https://github.com/mx-space/core/commit/70385d9e104106cb20ca8bc54f2f750e5ae0f121))
* **note:** add withSummary option to note list API ([6e56df9](https://github.com/mx-space/core/commit/6e56df901b17f38cb7788844d3abc9f71304bb0f))
* **note:** enhance note pagination with summary retrieval ([855ef99](https://github.com/mx-space/core/commit/855ef99e8591d340d1d1c8efb7093f27b955e27a))

# [10.4.0](https://github.com/mx-space/core/compare/v10.3.3...v10.4.0) (2026-03-13)


### Bug Fixes

* **note:** expose slug in note timeline list ([5b2f7b5](https://github.com/mx-space/core/commit/5b2f7b5fd6c60f585600c0229265bbcd3cfc1f07))
* **topic:** validate slug params with zod ([2de6b2b](https://github.com/mx-space/core/commit/2de6b2b6baa152e28dffef3ce5e185cf29da8c51))


### Features

* **note:** add seo slug route and sdk updates ([0203692](https://github.com/mx-space/core/commit/02036928760e3d4093fa93ee2d547a896b1dce95))

## [10.3.3](https://github.com/mx-space/core/compare/v10.3.2...v10.3.3) (2026-03-13)


### Bug Fixes

* **core:** degrade redis bootstrap paths ([976b6cb](https://github.com/mx-space/core/commit/976b6cb5d3fa746ab191e4c5f581a1797bc706e2))

## [10.3.2](https://github.com/mx-space/core/compare/v10.3.1...v10.3.2) (2026-03-10)


### Bug Fixes

* add Redis timeout and error handling to prevent request hanging ([46206e8](https://github.com/mx-space/core/commit/46206e88a79e167bfaa6654095c980c927c163eb))


### Features

* enhance admin asset update process and introduce event broadcasting ([e2868c2](https://github.com/mx-space/core/commit/e2868c25f33a0d9d389a3978b1f76c164e7f412a))
* enhance feed content rendering with lexical format support ([a6bbd75](https://github.com/mx-space/core/commit/a6bbd7573da20f3eab5bc0054ca8ad73ce8662e0))
* translate text within excalidraw nodes during AI translation ([4b2c938](https://github.com/mx-space/core/commit/4b2c9380d0b5c598abe32f4a9ef27fc6135f28fb))

## [10.3.1](https://github.com/mx-space/core/compare/v10.3.0...v10.3.1) (2026-03-09)


### Bug Fixes

* include lang in cache key and support NEXT_LOCALE cookie for request context ([bcef061](https://github.com/mx-space/core/commit/bcef0612ba27177c733ff6d9cfcfd5fb1b8dd26a))
* translation entry interceptor ([ac8009d](https://github.com/mx-space/core/commit/ac8009d0056ae76d9c17c82fa3448f8f12fbf10c))


### Features

* translation entry interceptor, topic controller e2e, object-scan types, image/tool utils ([c33157c](https://github.com/mx-space/core/commit/c33157c25ee37b1bfb60b81f03f25ccd2c59ab90))

# [10.3.0](https://github.com/mx-space/core/compare/v10.2.0...v10.3.0) (2026-03-08)


### Bug Fixes

* **ai-summary:** normalize lang query param with parseLanguageCode ([3dc7492](https://github.com/mx-space/core/commit/3dc74923ecff10255fc03fe6772c330b2842d144))


### Features

* **ai:** add auto-generation of translation entries for categories, topics, and notes ([65711aa](https://github.com/mx-space/core/commit/65711aa64380eb011f3f8faa9819bc312acb7b50))
* **ai:** translation entry model, service, controller and translate-fields interceptor ([a55fc7a](https://github.com/mx-space/core/commit/a55fc7a654c8f1e8610b24a71ad8e671231d4168))
* **schema:** enhance partial schemas for notes, pages, and posts with new fields ([f66c9ed](https://github.com/mx-space/core/commit/f66c9ed9cca1091730985813334adccb9462affd))
* 更新文件上传前缀支持模板占位符，增强灵活性 ([#2584](https://github.com/mx-space/core/issues/2584)) ([2b5354a](https://github.com/mx-space/core/commit/2b5354a6f907947993dda64733e8bbd62c6cc62d))

# [10.2.0](https://github.com/mx-space/core/compare/v10.1.10...v10.2.0) (2026-03-08)


### Features

* **webhook:** add X-Webhook-Source header to indicate event origin ([899a5f1](https://github.com/mx-space/core/commit/899a5f16495eb88ed9181f344a3956cfa9dc8bee))

## [10.1.10](https://github.com/mx-space/core/compare/v10.1.9...v10.1.10) (2026-03-07)

## [10.1.9](https://github.com/mx-space/core/compare/v10.1.8...v10.1.9) (2026-03-03)


### Bug Fixes

* **telemetry:** harden telemetry module robustness and security ([515c0e7](https://github.com/mx-space/core/commit/515c0e7dbe9ee1c1bc5a5d16a7ad4883d7e83437))

## [10.1.8](https://github.com/mx-space/core/compare/v10.1.7...v10.1.8) (2026-03-03)


### Bug Fixes

* **deps:** update dependency @haklex/rich-headless to v0.0.50 ([#2608](https://github.com/mx-space/core/issues/2608)) ([4258242](https://github.com/mx-space/core/commit/42582429982db7fe108a8a0db3a4bdf1e2c281e9))
* **deps:** update dependency @haklex/rich-headless to v0.0.54 ([#2610](https://github.com/mx-space/core/issues/2610)) ([027f62f](https://github.com/mx-space/core/commit/027f62f126d55fa812ff066907764ccf832a2959))
* **deps:** update dependency @nestjs/schedule to v6.1.1 ([#2604](https://github.com/mx-space/core/issues/2604)) ([45a297a](https://github.com/mx-space/core/commit/45a297a95788b7c563a9e075ce1c8444142d5cd7))

## [10.1.7](https://github.com/mx-space/core/compare/v10.1.6...v10.1.7) (2026-03-02)


### Features

* **gateway:** implement broadcast method for admin events ([ff3cf68](https://github.com/mx-space/core/commit/ff3cf68c742e2928bf249e641bfb9584f0c6956e))

## [10.1.6](https://github.com/mx-space/core/compare/v10.1.5...v10.1.6) (2026-03-02)


### Features

* **webhook:** introduce EventPayloadEnricherService for payload enrichment ([a5a2b79](https://github.com/mx-space/core/commit/a5a2b79bd6e406375c04aeb0d259907d131fa4d5))

## [10.1.5](https://github.com/mx-space/core/compare/v10.1.4...v10.1.5) (2026-03-02)


### Bug Fixes

* **webhook:** update pagination logic in getEventsByHookId method ([2450f9d](https://github.com/mx-space/core/commit/2450f9d08b2b36e8c71dd12c20ccc5983542e10c))

## [10.1.4](https://github.com/mx-space/core/compare/v10.1.3...v10.1.4) (2026-03-01)


### Features

* **translation:** introduce TranslationConsistencyService for improved translation validation ([341cfd2](https://github.com/mx-space/core/commit/341cfd2f3829505b75df421a375a29348c3fbea5))

## [10.1.3](https://github.com/mx-space/core/compare/v10.1.2...v10.1.3) (2026-03-01)


### Features

* **socket:** optimize socket fetching and configuration ([13eb074](https://github.com/mx-space/core/commit/13eb0747f19a0bb957cfb90e0fafd7a0af1221f1))
* **translation:** add content fields to translation and controller services ([6526893](https://github.com/mx-space/core/commit/6526893f0c0db0a7607053d5ebe2e67a605201b8))

## [10.1.2](https://github.com/mx-space/core/compare/v10.1.1...v10.1.2) (2026-03-01)


### Features

* **content:** enhance content hashing for Lexical format ([3b5e177](https://github.com/mx-space/core/commit/3b5e17726c8002ca42e4516578fb4ebc0460ac91))

## [10.1.1](https://github.com/mx-space/core/compare/v10.1.0...v10.1.1) (2026-03-01)


### Bug Fixes

* **ai:** improve error handling and cleanup in AiInFlightService ([2267810](https://github.com/mx-space/core/commit/22678104ec185b73fc47bb5fbc487e75ba332150))


### Features

* **ai-task:** add smart retry for partial-failed translation tasks ([ecdbf50](https://github.com/mx-space/core/commit/ecdbf50879f8313b739172d54fc1a71b16b6d24f))
* **ai:** enhance JSON extraction utilities and update translation strategy ([f673630](https://github.com/mx-space/core/commit/f67363036c6da979ac71ffe16bfd8c8a7ff3412e))
* **visitor-event:** enhance visitor event dispatch with additional content fields ([74d9398](https://github.com/mx-space/core/commit/74d939820195a7fdfb608c61c37c749284a23c89))

# [10.1.0](https://github.com/mx-space/core/compare/v10.0.4...v10.1.0) (2026-02-28)


### Bug Fixes

* **test:** add missing scheduleRegenerationForStaleTranslations mock in translation service spec ([4e701a2](https://github.com/mx-space/core/commit/4e701a2580f4cd389fac72b88a080b2d76da0db5))
* **test:** remove unnecessary whitespace in lexical-translation-e2e.spec.ts ([c623a20](https://github.com/mx-space/core/commit/c623a20097aa0b09564b872c125b9bac931738e3))


### Features

* add v10.0.5 migration for Lexical root block ID backfill ([66c3650](https://github.com/mx-space/core/commit/66c365061364fa64a2792cb9950aadfcb8350a33))
* **aggregate:** add /latest endpoint for top content per type ([563a716](https://github.com/mx-space/core/commit/563a716ac8fe7d584a182f5dc94d74edd753d653))
* **ai:** enhance translation service with new lexical features and dependencies ([534b0f7](https://github.com/mx-space/core/commit/534b0f71c697f96216bf6c61c19173cdc9367cd4))
* **ai:** enhance translation strategies and introduce new event handler ([426dc07](https://github.com/mx-space/core/commit/426dc07cc4d9ff24f9cfc09d626d6234a7d45619))
* **ai:** improve lexical translation and update utilities ([7475a8d](https://github.com/mx-space/core/commit/7475a8d49ec95c0105f111af047c86d8fc52419f))
* **ai:** refine AI translation, runtime, and add json util ([481beeb](https://github.com/mx-space/core/commit/481beeb49b44c0891194b2461bbe1d89903d3d10))
* **ai:** update translation prompts with enhanced safety and structure rules ([4f035f2](https://github.com/mx-space/core/commit/4f035f2bbbb9095dae35702d28210c7c9f8a0ea6))
* **comment:** add language support for comment anchors and enhance anchor resolution ([2218ae2](https://github.com/mx-space/core/commit/2218ae2bc5cdddfc0afd7220ef88e66af1be81c5))
* **content:** introduce content preference handling for notes and pages ([14ed55b](https://github.com/mx-space/core/commit/14ed55b9a4c61fdf4f3fa47d18f3824e86ff006d))
* **draft:** implement draft history service with diff strategies ([5171707](https://github.com/mx-space/core/commit/5171707e6b32a7d0d115f0624a9860d5814ca2a9))

## [10.0.4](https://github.com/mx-space/core/compare/v10.0.3...v10.0.4) (2026-02-18)


### Bug Fixes

* **auth:** allow hyphen in better-auth username validation ([6ae65a8](https://github.com/mx-space/core/commit/6ae65a8234625ea6b4f7eed4b186d96e8c2768df))


### Features

* **comment:** auto-approve owner comments and enhance spam check ([63b62dc](https://github.com/mx-space/core/commit/63b62dc0d9e368a6d71d5b8e1d68e9f729a3065f))
* **update:** add Redis-based multi-instance sync and split into modules ([a742698](https://github.com/mx-space/core/commit/a74269843da8d6da1ed9235565635ddc086bfe43))
* **visitor-events:** implement visitor event dispatch service and related decorators ([165b74d](https://github.com/mx-space/core/commit/165b74df0fce79392339be1b38ac19aaf5c17ef2))

## [10.0.3](https://github.com/mx-space/core/compare/v10.0.2...v10.0.3) (2026-02-15)

## [10.0.2](https://github.com/mx-space/core/compare/v10.0.1...v10.0.2) (2026-02-14)


### Bug Fixes

* **zod:** zLang should convert 'original' to undefined instead of passing through ([2b58461](https://github.com/mx-space/core/commit/2b584615ab32c2cab68f44289ff2b51501b754c7))

## [10.0.1](https://github.com/mx-space/core/compare/v10.0.0...v10.0.1) (2026-02-14)


### Bug Fixes

* **deps:** update dependency qs to v6.14.2 [security] ([#2581](https://github.com/mx-space/core/issues/2581)) ([868f0eb](https://github.com/mx-space/core/commit/868f0eb3995845b8ba3f3336b8e4b928524362e8))
* **lang.decorator:** handle 'original' language query parameter ([91be732](https://github.com/mx-space/core/commit/91be73254d084aec8d0b99ba5dcc55a348b31937))


### Features

* **translation:** implement lexical content translation support ([dd8bdde](https://github.com/mx-space/core/commit/dd8bdde5b65232d82af73aac4a210e33c1e10c57))

# [10.0.0](https://github.com/mx-space/core/compare/v10.0.0-alpha.3...v10.0.0) (2026-02-08)

# [10.0.0-alpha.3](https://github.com/mx-space/core/compare/v10.0.0-alpha.2...v10.0.0-alpha.3) (2026-02-08)


### Bug Fixes

* add missing imports for HeadingNode, QuoteNode, TRANSFORMERS in LexicalService ([5072036](https://github.com/mx-space/core/commit/50720360ee067b68d6d82d1de505670c53cb9c04))
* remove CodeHighlightNode to eliminate PrismJS dependency in server bundle ([d3289f6](https://github.com/mx-space/core/commit/d3289f6a3624fe42227c4b9570c1923dddba1b71))
* replace @lexical/code and @lexical/markdown with custom nodes to eliminate PrismJS ([3e791d6](https://github.com/mx-space/core/commit/3e791d6aa78d23861b608059012b325f7a2a1aaf))


### Features

* add Lexical block editor content format support ([8fe2508](https://github.com/mx-space/core/commit/8fe2508605ed3658c56ca13079366b6f1b0373e8))
* **cron:** add syncPublishedImagesToS3 functionality and scheduling ([5be2dfa](https://github.com/mx-space/core/commit/5be2dfa4c37d07738dd662649c079a35655d1aea))
* **snippet:** add custom path support for snippets ([04a1bfc](https://github.com/mx-space/core/commit/04a1bfcb433275207cc626b680b1884a28facd70))

# [10.0.0-alpha.2](https://github.com/mx-space/core/compare/v10.0.0-alpha.1...v10.0.0-alpha.2) (2026-02-07)


### Bug Fixes

* **auth:** add role validation in CreateAuth middleware ([1aa9549](https://github.com/mx-space/core/commit/1aa954962a72e0b198fe4c1f3a106c934f110bd1))


### Features

* **serverless:** implement logging for serverless function invocations ([59e9d4d](https://github.com/mx-space/core/commit/59e9d4d031cb497cb1ad38d821e53738272ee50a))

# [10.0.0-alpha.1](https://github.com/mx-space/core/compare/v10.0.0-alpha.0...v10.0.0-alpha.1) (2026-02-06)


### Features

* **i18n:** add translation support to activity, aggregate, and category controllers ([e33d214](https://github.com/mx-space/core/commit/e33d2142eb03f7c32ff531ffd59ccb9cefff33ef))

# [10.0.0-alpha.0](https://github.com/mx-space/core/compare/v9.7.0...v10.0.0-alpha.0) (2026-02-06)


### Bug Fixes

* **ip-query:** update IP API endpoint and response handling ([fa641a5](https://github.com/mx-space/core/commit/fa641a5e31d59a9bfbf6fdaac354ba010dd422c1))
* **migration:** skip v9.7.5 migration when readers collection does not exist ([db4de1f](https://github.com/mx-space/core/commit/db4de1ff04f02f945b85723095d859ad5588c7ad))


### Features

* add lightweight /reading/top endpoint and optimize /reading/rank ([50fb01d](https://github.com/mx-space/core/commit/50fb01d69e72224dcc1e3e37de65752ae5168f46))

# [9.7.0](https://github.com/mx-space/core/compare/v9.6.3...v9.7.0) (2026-02-04)


### Features

* **cron-task:** implement cron task module with business logic and scheduling ([6926e77](https://github.com/mx-space/core/commit/6926e7745c8ec9d470d7a6fd17990cf35be96e34))

## [9.6.3](https://github.com/mx-space/core/compare/v9.6.2...v9.6.3) (2026-02-03)


### Bug Fixes

* **ai:** use Tool Calling instead of response_format for structured output ([3c09a82](https://github.com/mx-space/core/commit/3c09a82e118ad1c4a8b4623627e90f7b5c95f76f)), closes [#2575](https://github.com/mx-space/core/issues/2575)


### Features

* **ai-translation:** extend article handling to include PageModel ([e8166b6](https://github.com/mx-space/core/commit/e8166b6f1d812f96f8f306124b88ae1cb5cd1395))
* **ai:** add comment review endpoint and enhance AI configuration options ([6101bc9](https://github.com/mx-space/core/commit/6101bc944fa092c224dffd84e55596a698020a19))
* **migration:** add v9.6.3 migration and enhance SMTP options handling ([a1a0b30](https://github.com/mx-space/core/commit/a1a0b302a2906ef79d82ea96aa9bafd7586304cb))
* **page:** enhance language handling and translation integration in PageController ([5a749ba](https://github.com/mx-space/core/commit/5a749ba51b19cab058df589e15abf6b1131daf44))

## [9.6.2](https://github.com/mx-space/core/compare/v9.6.1...v9.6.2) (2026-02-02)


### Features

* **mongo:** enhance custom MongoDB connection string handling ([e0e4f24](https://github.com/mx-space/core/commit/e0e4f2498e793b8716424608ed6f49de3c8f0261))

## [9.6.1](https://github.com/mx-space/core/compare/v9.6.0...v9.6.1) (2026-02-02)

# [9.6.0](https://github.com/mx-space/core/compare/v9.5.0...v9.6.0) (2026-02-02)


### Features

* **ai:** update translation prompts to enforce strict JSON output requirements ([810aaac](https://github.com/mx-space/core/commit/810aaac8ce530fff598c61bc70b0553540a14b6d))
* **redis:** enhance Redis configuration and email service integration ([634297c](https://github.com/mx-space/core/commit/634297cb2a14ee651e3a254c0454a5ed99315a17))

# [9.5.0](https://github.com/mx-space/core/compare/v9.4.0...v9.5.0) (2026-02-01)


### Bug Fixes

* **tests:** update snapshots for NoteController e2e tests to reflect published status ([49d08e6](https://github.com/mx-space/core/commit/49d08e683076d97d6102196f2a9219f4b29f18c7))


### Features

* **ai:** add retry functionality for AI tasks and enhance error handling ([5770839](https://github.com/mx-space/core/commit/577083925cec434ca9fbb516762670a3f7175ff1))
* **ai:** add task cancellation and deletion endpoints in AiTaskController ([1975b58](https://github.com/mx-space/core/commit/1975b58c68fab94aa0be2a91dcdefe3685bca0cb))
* **lang:** implement language handling in request context and enhance translation capabilities ([9ca8291](https://github.com/mx-space/core/commit/9ca82919f16c0f3ab04d4a8064e85aa26d73abbf))

# [9.4.0](https://github.com/mx-space/core/compare/v9.3.4...v9.4.0) (2026-01-31)


### Features

* **ai:** implement language utilities for AI processing ([82ed676](https://github.com/mx-space/core/commit/82ed676edda8fbd734bb0bd4d3a2a7bb1de16e9c))
* **ai:** introduce task queue for AI operations and enhance streaming capabilities ([2005c3d](https://github.com/mx-space/core/commit/2005c3d911fdfbe782ed44cfb2695c236c81298e))

## [9.3.4](https://github.com/mx-space/core/compare/v9.3.3...v9.3.4) (2026-01-30)

## [9.3.3](https://github.com/mx-space/core/compare/v9.3.2...v9.3.3) (2026-01-30)


### Features

* **note:** enhance note retrieval with translation support ([a378cd3](https://github.com/mx-space/core/commit/a378cd35c178792e97832e4c045ebd81e12042ed))

## [9.3.2](https://github.com/mx-space/core/compare/v9.3.1...v9.3.2) (2026-01-30)


### Bug Fixes

* **deps:** update dependency ai to v6.0.62 ([#2569](https://github.com/mx-space/core/issues/2569)) ([1cdac56](https://github.com/mx-space/core/commit/1cdac56f6a940b7993d1b3de8dc03de788941ed8))
* **deps:** update dependency better-auth to v1.4.18 ([#2570](https://github.com/mx-space/core/issues/2570)) ([ea0070a](https://github.com/mx-space/core/commit/ea0070a39312058ab14ae66464a639e1187b3e51))


### Features

* **translation:** enhance translation capabilities for articles ([038d728](https://github.com/mx-space/core/commit/038d72840534c15a5c3ea8bee9a3b04035a6a6a3))

## [9.3.1](https://github.com/mx-space/core/compare/v9.3.0...v9.3.1) (2026-01-29)


### Bug Fixes

* **deps:** update dependency @ai-sdk/openai to v3.0.21 ([#2566](https://github.com/mx-space/core/issues/2566)) ([2be3e07](https://github.com/mx-space/core/commit/2be3e07d64f5b4c978dc48ac06d305bb955fa6e2))
* **migration:** better auth login issue ([f19a49b](https://github.com/mx-space/core/commit/f19a49bb2c227874f558587cdabda29ef50addc4))

# [9.3.0](https://github.com/mx-space/core/compare/v9.2.0...v9.3.0) (2026-01-28)


### Features

* **ai-summary, ai-translation:** enhance summary and translation functionalities ([c15cc55](https://github.com/mx-space/core/commit/c15cc5544d59b248ec6772d762e709135ef5cf37))
* **deps, ai:** update dependencies and enhance AI functionalities ([f32f744](https://github.com/mx-space/core/commit/f32f744431e85fd6ffec1a0b2cc78398ea464c9a))

# [9.2.0](https://github.com/mx-space/core/compare/v9.1.1...v9.2.0) (2026-01-28)


### Features

* **ai-translation:** implement AI translation module with controller, service, model, and schema; add translation error codes and prompts ([19652ae](https://github.com/mx-space/core/commit/19652ae5b0011ab426efa7f2d4040d356bca489c))
* **draft:** enhance draft history management with refVersion and baseVersion properties; implement deleteByRef method for draft cleanup ([924dd3b](https://github.com/mx-space/core/commit/924dd3b4bcd98fba6c6a426a83ffce3da6f771fc))
* **draft:** improve draft history trimming logic and add canTrimHistory method for better snapshot management ([3a1487d](https://github.com/mx-space/core/commit/3a1487d12a408b4a236d767b2e9987582836c6c3))
* **translation:** add translation event handling and enhance note/post retrieval with translation support ([ab78738](https://github.com/mx-space/core/commit/ab7873873df4b7886bf4c6ae9b0161559f08505b))

## [9.1.1](https://github.com/mx-space/core/compare/v9.1.0...v9.1.1) (2026-01-27)


### Features

* add ai config in aggregation ([f814267](https://github.com/mx-space/core/commit/f81426799ffe21f9cfc3b2dcab8799317618a101))

# [9.1.0](https://github.com/mx-space/core/compare/v9.0.7...v9.1.0) (2026-01-27)


### Bug Fixes

* **draft:** migrate and simplify full snapshot handling ([c8c226f](https://github.com/mx-space/core/commit/c8c226ff63a97bc678d3086362785ace59e3e40c))
* tsdown config ([e95962e](https://github.com/mx-space/core/commit/e95962e1313372fe0d36d950488e91706a0b03a1))


### Features

* **analyze:** implement caching for analysis endpoints and enhance data aggregation ([74e910b](https://github.com/mx-space/core/commit/74e910b27c7565e7d9147eb578ab79de8705fec2))
* **telemetry:** implement telemetry data collection and dashboard ([871705f](https://github.com/mx-space/core/commit/871705fe64a35556824841552d8dce142377f707))

## [9.0.7](https://github.com/mx-space/core/compare/v9.0.6...v9.0.7) (2026-01-26)

## [9.0.6](https://github.com/mx-space/core/compare/v9.0.5...v9.0.6) (2026-01-25)

## [9.0.5](https://github.com/mx-space/core/compare/v9.0.4...v9.0.5) (2026-01-25)


### Bug Fixes

* **config:** restore encryption logic for sensitive config fields ([043d7aa](https://github.com/mx-space/core/commit/043d7aa36da832f1e291e15456c9e92593a1da8e)), closes [#2556](https://github.com/mx-space/core/issues/2556)

## [9.0.4](https://github.com/mx-space/core/compare/v9.0.3...v9.0.4) (2026-01-25)


### Features

* **config:** enhance encryption utilities and schema integration ([817ec74](https://github.com/mx-space/core/commit/817ec7468405580d7db1b75f5e62fe99b8be08fc))

## [9.0.3](https://github.com/mx-space/core/compare/v9.0.2...v9.0.3) (2026-01-25)


### Features

* **comment:** add batch update and delete functionality for comments ([deeb057](https://github.com/mx-space/core/commit/deeb05777e26d7156098b9bfdf4fbc27eaa81180))
* **file:** add batch delete and S3 upload functionality ([9e6cfe5](https://github.com/mx-space/core/commit/9e6cfe5fac617faebe07d33aacf5fa954476a21f))

## [9.0.2](https://github.com/mx-space/core/compare/v9.0.1...v9.0.2) (2026-01-24)


### Bug Fixes

* **file.type:** update FileTypeEnum to replace 'photo' with 'image' ([9d1be6c](https://github.com/mx-space/core/commit/9d1be6cae2753fd1841c067a3f36b93b36001a36))
* **file:** add type: String for enum props in FileReferenceModel ([35cdbdd](https://github.com/mx-space/core/commit/35cdbdd2b9bc0ebc726517b73aa6ee9eeb4a6d8a))
* **file:** remove duplicate index on fileUrl field ([bd6eec6](https://github.com/mx-space/core/commit/bd6eec679f12357a075ae07d4d7dba26ee4b9747))


### Features

* **file:** implement file reference management and image migration service ([7b22129](https://github.com/mx-space/core/commit/7b22129b0890a1875ff73564034cf5ae74628ace))

## [9.0.1](https://github.com/mx-space/core/compare/v9.0.0...v9.0.1) (2026-01-23)


### Bug Fixes

* **aggregate:** rename wordCount field from length to count ([9c883c9](https://github.com/mx-space/core/commit/9c883c9cbea94d82b2822c4b3534e2a7c7e0504d))
* **note.schema:** allow nullable fields and set default for images ([74f0aed](https://github.com/mx-space/core/commit/74f0aedc4f13a28627a2a0d5597c2f8454159bff))

# [9.0.0](https://github.com/mx-space/core/compare/v9.0.0-alpha.9...v9.0.0) (2026-01-22)


### Features

* add analyze apis ([3f51a95](https://github.com/mx-space/core/commit/3f51a95ad0d9dc85e624056fa9d871d432b0cf38))

# [9.0.0-alpha.9](https://github.com/mx-space/core/compare/v9.0.0-alpha.8...v9.0.0-alpha.9) (2026-01-22)

# [9.0.0-alpha.8](https://github.com/mx-space/core/compare/v9.0.0-alpha.7...v9.0.0-alpha.8) (2026-01-22)

# [9.0.0-alpha.7](https://github.com/mx-space/core/compare/v9.0.0-alpha.6...v9.0.0-alpha.7) (2026-01-22)

# [9.0.0-alpha.6](https://github.com/mx-space/core/compare/v9.0.0-alpha.5...v9.0.0-alpha.6) (2026-01-22)

# [9.0.0-alpha.5](https://github.com/mx-space/core/compare/v9.0.0-alpha.4...v9.0.0-alpha.5) (2026-01-22)

# [9.0.0-alpha.4](https://github.com/mx-space/core/compare/v9.0.0-alpha.3...v9.0.0-alpha.4) (2026-01-22)

# [9.0.0-alpha.3](https://github.com/mx-space/core/compare/v9.0.0-alpha.2...v9.0.0-alpha.3) (2026-01-21)

# [9.0.0-alpha.2](https://github.com/mx-space/core/compare/v9.0.0-alpha.1...v9.0.0-alpha.2) (2026-01-21)


### Bug Fixes

* enhance OpenAI-compatible provider handling ([fab4d9d](https://github.com/mx-space/core/commit/fab4d9dfda1b5e976ac505001630b09d82b4ca2b))

# [9.0.0-alpha.1](https://github.com/mx-space/core/compare/v9.0.0-alpha.0...v9.0.0-alpha.1) (2026-01-21)

# [9.0.0-alpha.0](https://github.com/mx-space/core/compare/v8.8.0...v9.0.0-alpha.0) (2026-01-21)


### Bug Fixes

* **comment:** 邮件通知速记跳转前端路由 ([#2541](https://github.com/mx-space/core/issues/2541)) ([3c12235](https://github.com/mx-space/core/commit/3c1223569ef9caf3480183eb4e922d2719b27925))
* **deps:** update dependency @ai-sdk/openai to v3.0.13 ([#2546](https://github.com/mx-space/core/issues/2546)) ([7213840](https://github.com/mx-space/core/commit/721384031a02b951958debc14b3fdf6d0131f95a))
* **deps:** update dependency @keyv/redis to v5.1.6 ([#2547](https://github.com/mx-space/core/issues/2547)) ([5a00a9b](https://github.com/mx-space/core/commit/5a00a9b0272faede2c082eebb978fb4572d56cc4))
* replace zx with native Node.js APIs in download script ([b93d6d9](https://github.com/mx-space/core/commit/b93d6d9959f7b79ec7611191f016c93f7da3657e))

# [8.8.0](https://github.com/mx-space/core/compare/v8.7.1...v8.8.0) (2026-01-20)


### Features

* **meta-preset:** add MetaPreset module with CRUD operations and built-in presets ([d03a881](https://github.com/mx-space/core/commit/d03a8818da546b8fffa1771e856cf4207255e67e))

## [8.7.1](https://github.com/mx-space/core/compare/v8.7.0...v8.7.1) (2026-01-19)

# [8.7.0](https://github.com/mx-space/core/compare/v8.6.0...v8.7.0) (2026-01-18)


### Bug Fixes

* **deps:** update babel monorepo to v7.28.6 ([#2527](https://github.com/mx-space/core/issues/2527)) ([7711eb9](https://github.com/mx-space/core/commit/7711eb9b0a89589a1737b1a036a39f86aab36d72))
* **deps:** update dependency @ai-sdk/openai to v3.0.12 ([#2532](https://github.com/mx-space/core/issues/2532)) ([d3e1a32](https://github.com/mx-space/core/commit/d3e1a32eec9e5d86032214468fc987d33035fad6))
* **deps:** update dependency ai to v6.0.39 ([#2534](https://github.com/mx-space/core/issues/2534)) ([6a2db5f](https://github.com/mx-space/core/commit/6a2db5fa5327150d6fe0871f698c9044892fa861))
* **deps:** update dependency cache-manager to v7.2.8 ([#2535](https://github.com/mx-space/core/issues/2535)) ([cb8c287](https://github.com/mx-space/core/commit/cb8c28760601748e0e24421cfe273a21a82347c9))
* **deps:** update dependency remove-markdown to v0.6.3 ([#2536](https://github.com/mx-space/core/issues/2536)) ([222d8f2](https://github.com/mx-space/core/commit/222d8f2a4ff3398ed0f75608511e5c506a21cb81))
* **deps:** update nest monorepo ([#2538](https://github.com/mx-space/core/issues/2538)) ([8ceae42](https://github.com/mx-space/core/commit/8ceae42162c54f59870334472b7de625c71fd4bb))


### Features

* **aggregate:** add new statistical endpoints for category distribution, tag cloud, publication trend, top articles, comment activity, and traffic source ([1eb5dd7](https://github.com/mx-space/core/commit/1eb5dd7090bdc080535edef443a371f5610c96f2))
* **draft:** implement draft module with CRUD operations and history management ([8adf43e](https://github.com/mx-space/core/commit/8adf43e702213638b1de45febecfdd29dd495b57))

# [8.6.0](https://github.com/mx-space/core/compare/v8.5.1...v8.6.0) (2026-01-15)


### Bug Fixes

* **backup:** 修复 S3 备份上传错误 ([#2524](https://github.com/mx-space/core/issues/2524)) ([43cbdc8](https://github.com/mx-space/core/commit/43cbdc8729083778f70321d69bcbb2839f0f746b))
* **render:** 修复渲染预览类型路由匹配 ([#2523](https://github.com/mx-space/core/issues/2523)) ([d82f8ff](https://github.com/mx-space/core/commit/d82f8ff8f4d67577b025eff7304f3f06a7b8f96d))


### Features

* **core:** refactor admin asset download logic with multi-mirror support and improved reliability ([d77a152](https://github.com/mx-space/core/commit/d77a152bc8a60a185ab8a1f2ad2269bfc03ce986))

## [8.5.1](https://github.com/mx-space/core/compare/v8.5.0...v8.5.1) (2026-01-14)


### Bug Fixes

* **deps:** update dependency ua-parser-js to v2.0.7 ([#2509](https://github.com/mx-space/core/issues/2509)) ([d021823](https://github.com/mx-space/core/commit/d021823d0700f5a9e58b3d893bc28fc546ac0adf))


### Features

* **auth:** add profile mapping function to GitHub authentication ([f7d96c3](https://github.com/mx-space/core/commit/f7d96c3152074507f0d4da4704d38c5ceda7caf4))
* **recently:** 新增速记编辑功能 ([#2521](https://github.com/mx-space/core/issues/2521)) ([99043bd](https://github.com/mx-space/core/commit/99043bd94c07a7a1c1b96dbad21b1f8f4e58a430))

# [8.5.0](https://github.com/mx-space/core/compare/v8.4.5...v8.5.0) (2026-01-12)


### Bug Fixes

* **deps:** update dependency ai to v5.0.118 ([#2511](https://github.com/mx-space/core/issues/2511)) ([2b4f31e](https://github.com/mx-space/core/commit/2b4f31e1e533b9ecb9bd956d3e87534256d5b51b))


### Features

* **ai:** implement multi-provider support and migration for AI configuration ([b55916d](https://github.com/mx-space/core/commit/b55916d9d03ada0447f7671ca6058764b9c89728))

## [8.4.5](https://github.com/mx-space/core/compare/v8.4.4...v8.4.5) (2026-01-08)


### Bug Fixes

* ignore eslint rule ([bac4736](https://github.com/mx-space/core/commit/bac473693252a8cbc20807545205a27222b1fe91))

## [8.4.4](https://github.com/mx-space/core/compare/v8.4.3...v8.4.4) (2026-01-08)


### Bug Fixes

* **deps:** update dependency @ai-sdk/openai to v2.0.89 ([#2506](https://github.com/mx-space/core/issues/2506)) ([d71bd54](https://github.com/mx-space/core/commit/d71bd545a995d26ea12a78a6fc178c741db09974))
* **deps:** update dependency @typegoose/typegoose to v12.20.1 ([#2500](https://github.com/mx-space/core/issues/2500)) ([d84a71f](https://github.com/mx-space/core/commit/d84a71fae68c035cfd2e633cc60492d4d67fccc5))
* **deps:** update dependency ai to v5.0.117 ([#2501](https://github.com/mx-space/core/issues/2501)) ([b47a482](https://github.com/mx-space/core/commit/b47a482429f6ccce4c449049bbd05bba54790a28))
* **deps:** update dependency mongoose to v8.19.4 ([#2507](https://github.com/mx-space/core/issues/2507)) ([7f56be4](https://github.com/mx-space/core/commit/7f56be4684a094bdd298a66e0b4011f07724ba86))
* **deps:** update dependency openai to v5.23.2 ([#2508](https://github.com/mx-space/core/issues/2508)) ([d2ae37d](https://github.com/mx-space/core/commit/d2ae37d3a8e331b1050dcd5ddbdc413afc554e44))
* **deps:** update dependency qs to v6.14.1 [security] ([#2504](https://github.com/mx-space/core/issues/2504)) ([6cb3d36](https://github.com/mx-space/core/commit/6cb3d3603611ec9fdbf49a25d64b3c6e432f49ca))
* **markdown:** export markdown permalink ([3bc74e7](https://github.com/mx-space/core/commit/3bc74e76a2935ccfb30b3357052ddfafb29d26cc))

## [8.4.3](https://github.com/mx-space/core/compare/v8.4.2...v8.4.3) (2025-12-27)


### Bug Fixes

* **aggregate:** update post query to only retrieve published posts ([c65eead](https://github.com/mx-space/core/commit/c65eeadfb6b946c8ce19fd8ab1c2d9db775e6c50))
* **deps:** update dependency @ai-sdk/openai to v2.0.88 ([#2498](https://github.com/mx-space/core/issues/2498)) ([378f68b](https://github.com/mx-space/core/commit/378f68b1ba417e35b294f2096661c18a3a56497d))
* **deps:** update dependency @typegoose/auto-increment to v4.13.2 ([#2499](https://github.com/mx-space/core/issues/2499)) ([9e6872a](https://github.com/mx-space/core/commit/9e6872af0b86e84b790982875e68005965eb895a))
* **deps:** update dependency nodemailer to v7.0.11 [security] ([#2487](https://github.com/mx-space/core/issues/2487)) ([9329cbd](https://github.com/mx-space/core/commit/9329cbd716d1a2ff81a4392c15f1e54771f774d2))


### Features

* **markdown:** 为Markdown 导入导出添加标签字段 ([5ca66b6](https://github.com/mx-space/core/commit/5ca66b6912c953a1ade1a1ccfeef2131359b9e42))
* **note:** add validation for note updates to check for existing documents and track field changes ([70fb1b2](https://github.com/mx-space/core/commit/70fb1b2ad34a6a0a6001d93099703b47fc0f58b4))

## [8.4.2](https://github.com/mx-space/core/compare/v8.4.1...v8.4.2) (2025-11-30)


### Bug Fixes

* **ai-summary:** log error details in AI summary service ([049e6a5](https://github.com/mx-space/core/commit/049e6a5cb6d6187f7f703bd4d2b2f9e024cf57fb))

## [8.4.1](https://github.com/mx-space/core/compare/v8.4.0...v8.4.1) (2025-11-24)


### Bug Fixes

* **deps:** update dependency @ai-sdk/openai to v2.0.42 ([#2464](https://github.com/mx-space/core/issues/2464)) ([9c0ac35](https://github.com/mx-space/core/commit/9c0ac355643bd6b654efb817aa168007bab947c8))
* **deps:** update dependency ai to v5.0.52 [security] ([#2470](https://github.com/mx-space/core/issues/2470)) ([5cdc4f6](https://github.com/mx-space/core/commit/5cdc4f6b4954ead231dedb4cbf9ce008fc26bd8f))
* **deps:** update dependency dayjs to v1.11.18 ([#2459](https://github.com/mx-space/core/issues/2459)) ([2afa730](https://github.com/mx-space/core/commit/2afa730d5845a86d10a8fb56fbdb0555ce6497a4))
* **deps:** update dependency form-data to v4.0.4 [security] ([#2454](https://github.com/mx-space/core/issues/2454)) ([81b875d](https://github.com/mx-space/core/commit/81b875d9c99969162bd0b5105a84452286522552))
* **deps:** update dependency nodemailer to v7.0.7 [security] ([#2467](https://github.com/mx-space/core/issues/2467)) ([2d10df6](https://github.com/mx-space/core/commit/2d10df66026a0aab637e27ef6f93662867984f2c))


### Features

* **link:** convert external friend avatar links to internal links ([#2480](https://github.com/mx-space/core/issues/2480)) ([ca1e328](https://github.com/mx-space/core/commit/ca1e3285db298e4a9eb4b9efd1c4ec316d9c7308))

# [8.4.0](https://github.com/mx-space/core/compare/v8.3.2...v8.4.0) (2025-07-10)


### Bug Fixes

* remove patch ([14fe84c](https://github.com/mx-space/core/commit/14fe84c0bf20209d0a05f3d8f68903c67ca3b690))


### Features

* **ai:** integrate new AI SDK and refactor AI services ([3e12044](https://github.com/mx-space/core/commit/3e12044fcebdf8b13aa6a7d28f7b4ba3037d7353))
* **core:** 实现文章的发布/取消发布功能 ([#2443](https://github.com/mx-space/core/issues/2443)) ([00b66be](https://github.com/mx-space/core/commit/00b66bef7ea49d7fa7097362dabfcc12cc2db6e9))
* **server-time:** enhance middleware configuration and import context ([a463551](https://github.com/mx-space/core/commit/a4635519b8846bc32d42611835c40d6d9ddc4819))

## [8.3.2](https://github.com/mx-space/core/compare/v8.3.1...v8.3.2) (2025-05-26)


### Bug Fixes

* **auth:** enhance CORS support in CreateAuth handler ([bf6021a](https://github.com/mx-space/core/commit/bf6021a0b4e9d55e85a44eedf2b2cb8c5e07eec6))

## [8.3.1](https://github.com/mx-space/core/compare/v8.3.0...v8.3.1) (2025-05-20)


### Bug Fixes

* **ai:** ensure proper task cleanup in AiDeepReadingService ([f7cd8c7](https://github.com/mx-space/core/commit/f7cd8c7035b00ab0fc338c3f8f7947dccb1ff6bd))
* bundle ([7e616ee](https://github.com/mx-space/core/commit/7e616eeb8873587a76235f254d6b9b998268bac9))
* **deps:** complie `@antfu/install-pkg` ([89013ed](https://github.com/mx-space/core/commit/89013ed3482c7e8f0faabcfe61cccbf856b77bab))
* **markdown:** refine tokenizer and code handling in markdown utility ([e80b776](https://github.com/mx-space/core/commit/e80b77662b3ecf7b7b5e75bbb7566612781920c7))


### Features

* **ai:** enhance OpenAI configuration with additional headers ([9b46a60](https://github.com/mx-space/core/commit/9b46a6075048ec870edc814ee159c9847b1d1b11))
* **s3:** implement S3Uploader for file uploads ([c527591](https://github.com/mx-space/core/commit/c52759181ba04d0286d4dbbc6d67f12953865ded))

# [8.3.0](https://github.com/mx-space/core/compare/v8.2.0...v8.3.0) (2025-05-06)


### Features

* **ai:** introduce deep reading functionality and refactor AI module ([c385c58](https://github.com/mx-space/core/commit/c385c5894357bde8ee1083526ef74dacdb4eb811))
* **ci:** add custom action for MongoDB and Redis setup ([c657e9a](https://github.com/mx-space/core/commit/c657e9a80aa8eb49b54482c82ff70a869385386a))

# [8.2.0](https://github.com/mx-space/core/compare/v8.1.2...v8.2.0) (2025-05-05)


### Bug Fixes

* **comment:** refine AI evaluation method and update comment options ([f855521](https://github.com/mx-space/core/commit/f8555216b6bc2260b913328821511e0688fbede3))


### Features

* implement AI-based comment evaluation in CommentService ([d2956f3](https://github.com/mx-space/core/commit/d2956f33981ca58659f153393c1b304548233b31))
* update ai integration ([#2422](https://github.com/mx-space/core/issues/2422)) ([46704d2](https://github.com/mx-space/core/commit/46704d24986181009271c8fda5fb93e4b21ac01c))

## [8.1.2](https://github.com/mx-space/core/compare/v8.1.1...v8.1.2) (2025-05-05)

## [8.1.1](https://github.com/mx-space/core/compare/v8.1.0...v8.1.1) (2025-04-06)


### Bug Fixes

* **gateway/auth:** broadcast failure ([#2413](https://github.com/mx-space/core/issues/2413)) ([128b92c](https://github.com/mx-space/core/commit/128b92cbee08e0d1d6797ad185057665cc814e4b))
* lint and fix cache service ([9626378](https://github.com/mx-space/core/commit/96263782d0997f3e6f86f88f9d61854cebf5a1b7))

# [8.1.0](https://github.com/mx-space/core/compare/v8.0.3...v8.1.0) (2025-03-25)


### Features

* AI antispam ([#2406](https://github.com/mx-space/core/issues/2406)) ([4ec4814](https://github.com/mx-space/core/commit/4ec4814959ee9034381910e06b6cd84fd2899768))

## [8.0.3](https://github.com/mx-space/core/compare/v8.0.2...v8.0.3) (2025-03-23)


### Bug Fixes

* ai summary prompt ([5b9952c](https://github.com/mx-space/core/commit/5b9952c18ab45b949bc86067ed05406109dedab2))
* **deps:** update dependency @langchain/openai to v0.4.5 ([#2395](https://github.com/mx-space/core/issues/2395)) ([fc028a4](https://github.com/mx-space/core/commit/fc028a4989620e9e15950c35d54dd43b2ad1d069))
* **deps:** update dependency openai to v4.87.4 ([#2396](https://github.com/mx-space/core/issues/2396)) ([f6d7f0b](https://github.com/mx-space/core/commit/f6d7f0b6d83340a7264ba85f10f72ff8886ed0f4))
* **deps:** update nest monorepo to v11.0.12 ([#2397](https://github.com/mx-space/core/issues/2397)) ([511587a](https://github.com/mx-space/core/commit/511587a617aad507e3965619c8c60a310f042184))

## [8.0.2](https://github.com/mx-space/core/compare/v8.0.1...v8.0.2) (2025-03-17)


### Bug Fixes

* cravatar frontend cannot be displayed ([#2385](https://github.com/mx-space/core/issues/2385)) ([490320e](https://github.com/mx-space/core/commit/490320ee4f0cdf958335c8c805796f641a7e41ae))


### Features

* 添加推送到Bing支持 ([#2379](https://github.com/mx-space/core/issues/2379)) ([400d217](https://github.com/mx-space/core/commit/400d217aac2872f75ee84bf83f4c2988801b9c7f))

## [8.0.1](https://github.com/mx-space/core/compare/v8.0.0...v8.0.1) (2025-02-19)


### Bug Fixes

* **deps:** update babel monorepo to v7.26.8 ([#2340](https://github.com/mx-space/core/issues/2340)) ([3b64af7](https://github.com/mx-space/core/commit/3b64af70d274aa62aba00c4c39a56d4cf5816917))
* **deps:** update babel monorepo to v7.26.9 ([#2362](https://github.com/mx-space/core/issues/2362)) ([feacfaf](https://github.com/mx-space/core/commit/feacfaf12077311e878edb579d593b9ed08aa644))
* **deps:** update dependency @fastify/static to v8.1.1 ([#2364](https://github.com/mx-space/core/issues/2364)) ([28cc927](https://github.com/mx-space/core/commit/28cc927d3316e6534768e5f4cc640f0f45583e41))
* **deps:** update dependency @langchain/openai to v0.4.3 ([#2341](https://github.com/mx-space/core/issues/2341)) ([0d6eda2](https://github.com/mx-space/core/commit/0d6eda23e640aaad1cae54c3029c29d2b00af29f))
* **deps:** update dependency @langchain/openai to v0.4.4 ([#2349](https://github.com/mx-space/core/issues/2349)) ([38d1a31](https://github.com/mx-space/core/commit/38d1a317e62e9d72a82739200af3fbdfb9b3c287))
* **deps:** update dependency @typegoose/auto-increment to v4.9.1 ([#2342](https://github.com/mx-space/core/issues/2342)) ([71c3ef8](https://github.com/mx-space/core/commit/71c3ef8ed6941221d31df144b560aa8c20e1c988))
* **deps:** update dependency form-data to v4.0.2 ([#2365](https://github.com/mx-space/core/issues/2365)) ([f4e9fad](https://github.com/mx-space/core/commit/f4e9fad753dfe55c133313932b538f5f373acb12))
* **deps:** update dependency langchain to v0.3.18 ([#2366](https://github.com/mx-space/core/issues/2366)) ([72b1488](https://github.com/mx-space/core/commit/72b1488a390c42be061c9075f570324037e78e0f))
* **deps:** update dependency linkedom to v0.18.9 ([#2343](https://github.com/mx-space/core/issues/2343)) ([46b6b8e](https://github.com/mx-space/core/commit/46b6b8e4388c565a319afd224e0de44d32e151d6))
* **deps:** update dependency marked to v15.0.7 ([#2350](https://github.com/mx-space/core/issues/2350)) ([347ea08](https://github.com/mx-space/core/commit/347ea08ef097d493d13063df9273710b966700c9))
* **deps:** update dependency mongoose-aggregate-paginate-v2 to v1.1.4 ([#2367](https://github.com/mx-space/core/issues/2367)) ([b2b4233](https://github.com/mx-space/core/commit/b2b423361fa78ca7b4e6589160a009d09a3b75cb))
* **deps:** update dependency ua-parser-js to v2.0.2 ([#2346](https://github.com/mx-space/core/issues/2346)) ([3203b4a](https://github.com/mx-space/core/commit/3203b4a392c1f3027a788e0763b6a02fcfd42cf3))
* **deps:** update nest monorepo to v11.0.9 ([#2344](https://github.com/mx-space/core/issues/2344)) ([58947c0](https://github.com/mx-space/core/commit/58947c0c832619363a4709c8bddc56b0ca17c89a))

# [8.0.0](https://github.com/mx-space/core/compare/v7.2.8...v8.0.0) (2025-02-08)


### Bug Fixes

* **deps:** update dependency @fastify/static to v8.0.4 ([#2318](https://github.com/mx-space/core/issues/2318)) ([02c98e1](https://github.com/mx-space/core/commit/02c98e1aae88807af39f8b3a85eec723316424ef))
* **deps:** update dependency @langchain/openai to v0.3.17 ([#2319](https://github.com/mx-space/core/issues/2319)) ([d846a6c](https://github.com/mx-space/core/commit/d846a6ce39b55600e2d19d5d30c58dfcd7f17c87))
* **deps:** update dependency langchain to v0.3.12 ([#2322](https://github.com/mx-space/core/issues/2322)) ([bba535c](https://github.com/mx-space/core/commit/bba535c7ce6361804c86237a379a120331298a7f))

## [7.2.8](https://github.com/mx-space/core/compare/v7.2.7...v7.2.8) (2025-01-19)


### Bug Fixes

* **deps:** update babel monorepo to v7.26.5 ([#2307](https://github.com/mx-space/core/issues/2307)) ([ac3f16b](https://github.com/mx-space/core/commit/ac3f16b9944b911bb1eaf6887b35f1cd5d4b62cc))
* **deps:** update dependency @aws-sdk/client-s3 to v3.731.1 ([#2303](https://github.com/mx-space/core/issues/2303)) ([f5abb1a](https://github.com/mx-space/core/commit/f5abb1a428ce7d7cb1dcad01ab76285fde536a6f))
* **deps:** update dependency isbot to v5.1.21 ([#2298](https://github.com/mx-space/core/issues/2298)) ([b1ea871](https://github.com/mx-space/core/commit/b1ea87194eec04e65431a69ed7066df4ee22981f))
* **deps:** update dependency langchain to v0.3.10 ([#2299](https://github.com/mx-space/core/issues/2299)) ([7182cb2](https://github.com/mx-space/core/commit/7182cb21faa96ede55fe4b4741ce88ca048fc3ee))
* **deps:** update dependency langchain to v0.3.11 ([#2310](https://github.com/mx-space/core/issues/2310)) ([a542807](https://github.com/mx-space/core/commit/a542807fa8fa539ce4f3b8a8890e8fd457031dbb))
* **deps:** update dependency mongoose-paginate-v2 to v1.9.0 ([#2306](https://github.com/mx-space/core/issues/2306)) ([7834acb](https://github.com/mx-space/core/commit/7834acb0dac5925294592e9e7368a546aff467c7))
* **deps:** update dependency openai to v4.77.4 ([#2300](https://github.com/mx-space/core/issues/2300)) ([eb3a568](https://github.com/mx-space/core/commit/eb3a5686bdf21e5cb681244759435fe300932b43))
* **deps:** update dependency openai to v4.79.1 ([#2308](https://github.com/mx-space/core/issues/2308)) ([69481df](https://github.com/mx-space/core/commit/69481df6691ade4026034b3fec13102ed2ef9481))

## [7.2.7](https://github.com/mx-space/core/compare/v7.2.6...v7.2.7) (2025-01-09)


### Bug Fixes

* **deps:** update dependency @aws-sdk/client-s3 to v3.723.0 ([#2258](https://github.com/mx-space/core/issues/2258)) ([d0e7832](https://github.com/mx-space/core/commit/d0e7832be34780e7953499d402b90c739e5d6505))
* **deps:** update dependency @langchain/openai to v0.3.16 ([#2269](https://github.com/mx-space/core/issues/2269)) ([5342665](https://github.com/mx-space/core/commit/5342665bad184c43545ef19275a10904e8371f3d))
* **deps:** update dependency @typegoose/auto-increment to v4.9.0 ([#2250](https://github.com/mx-space/core/issues/2250)) ([a278685](https://github.com/mx-space/core/commit/a278685b402380f77f5a13179d7ad3fc7e3ddf3a))
* **deps:** update dependency isbot to v5.1.19 ([#2286](https://github.com/mx-space/core/issues/2286)) ([c4e871d](https://github.com/mx-space/core/commit/c4e871d198fcc6e05c65925128f851dbed6b885f))
* **deps:** update dependency langchain to v0.3.8 ([#2277](https://github.com/mx-space/core/issues/2277)) ([793dee2](https://github.com/mx-space/core/commit/793dee294230bc10af7c534cd5fdf6557c8e33fd))
* **deps:** update dependency remove-markdown to v0.6.0 ([#2278](https://github.com/mx-space/core/issues/2278)) ([b3f2d50](https://github.com/mx-space/core/commit/b3f2d5042d68342656fe6ca1be0ebd46f73829d8))
* **deps:** update dependency ua-parser-js to v1.0.40 ([#2274](https://github.com/mx-space/core/issues/2274)) ([85cccd2](https://github.com/mx-space/core/commit/85cccd261548dd9f791bb03ebe77a721c0380b9c))

## [7.2.6](https://github.com/mx-space/core/compare/v7.2.5...v7.2.6) (2024-12-21)

## [7.2.5](https://github.com/mx-space/core/compare/v7.2.4...v7.2.5) (2024-12-20)


### Features

* support algolia search custom truncate size, closed [#2271](https://github.com/mx-space/core/issues/2271) ([6da1c13](https://github.com/mx-space/core/commit/6da1c13799174e746708844d0b149b4607e8f276))

## [7.2.4](https://github.com/mx-space/core/compare/v7.2.3...v7.2.4) (2024-12-03)


### Bug Fixes

* add auth baseURL ([635e27d](https://github.com/mx-space/core/commit/635e27df8da51cae33e5f0abf35ad491998b3de6))
* complied better auth typing export ([49cc5b6](https://github.com/mx-space/core/commit/49cc5b628fd6e4b8cd5c2adf35c40bf982621b28))
* remove baseURL ([b3e10d4](https://github.com/mx-space/core/commit/b3e10d417b7a125367efd8ff9a5e124d84e97895))
* reset oauth instance when app url changed ([54d9021](https://github.com/mx-space/core/commit/54d90214ec18e754c0e6a78f32d9eedf23056b2d))

## [7.2.3](https://github.com/mx-space/core/compare/v7.2.2...v7.2.3) (2024-11-29)


### Bug Fixes

* get sessionId ([ca18882](https://github.com/mx-space/core/commit/ca18882c87066ac05db76c27aae74e82079e2576))

## [7.2.2](https://github.com/mx-space/core/compare/v7.2.1...v7.2.2) (2024-11-28)


### Bug Fixes

* table migration ([84ddd7c](https://github.com/mx-space/core/commit/84ddd7c432c1bc027ddfcded9ac0debdf0cc3ddd))
* update migration ([ec43ff2](https://github.com/mx-space/core/commit/ec43ff2965c0f800da4a1a7aaa52ac5b419a03be))


### Features

* add accountId to session ([1e674bd](https://github.com/mx-space/core/commit/1e674bdd2d2008e5804a142f3eab4d0e8dedc266))
* add provider on session ([a031c32](https://github.com/mx-space/core/commit/a031c325327bd7eff3e7cda819eee1e6ee5ffc82))

## [7.2.1](https://github.com/mx-space/core/compare/v7.2.0...v7.2.1) (2024-11-26)


### Bug Fixes

* userId ([2143a8c](https://github.com/mx-space/core/commit/2143a8c6fc3b44fbcd94362fe34a15cb1612d6b0))

# [7.2.0](https://github.com/mx-space/core/compare/v7.1.9...v7.2.0) (2024-11-26)


### Bug Fixes

* **deps:** update dependency @aws-sdk/client-s3 to v3.685.0 ([#2157](https://github.com/mx-space/core/issues/2157)) ([fad4464](https://github.com/mx-space/core/commit/fad44647417624a6dc71b0d62eba6981ae2c87f8))
* **deps:** update dependency @fastify/static to v8.0.3 ([#2228](https://github.com/mx-space/core/issues/2228)) ([bb11879](https://github.com/mx-space/core/commit/bb118796debe6115fa595d2b5750b69012ebe29f))
* **deps:** update dependency @langchain/openai to v0.3.11 ([835ba5a](https://github.com/mx-space/core/commit/835ba5a1892478763b0a548481feca6afcd586ba))
* **deps:** update dependency @langchain/openai to v0.3.12 ([c7056d6](https://github.com/mx-space/core/commit/c7056d6559e03b7535b3b671557929cc32c2d2cd))
* **deps:** update dependency @langchain/openai to v0.3.14 ([#2229](https://github.com/mx-space/core/issues/2229)) ([3692c40](https://github.com/mx-space/core/commit/3692c40366f9e4cbe56245ab4cf7c322ef5537dd))
* **deps:** update dependency @nestjs/event-emitter to v2.1.1 ([#2203](https://github.com/mx-space/core/issues/2203)) ([abe3a95](https://github.com/mx-space/core/commit/abe3a95034a6d6488a845348b600052e890e28e1))
* **deps:** update dependency langchain to v0.3.5 ([#2215](https://github.com/mx-space/core/issues/2215)) ([e6ef191](https://github.com/mx-space/core/commit/e6ef191523e6c2f3af157b79c648b0b6604dabf2))
* **deps:** update dependency langchain to v0.3.6 ([#2231](https://github.com/mx-space/core/issues/2231)) ([17ce3e8](https://github.com/mx-space/core/commit/17ce3e8f864ad2074804f7142a65e7fbebcfa7bb))
* **deps:** update dependency marked to v14.1.4 ([#2232](https://github.com/mx-space/core/issues/2232)) ([c3ab2ce](https://github.com/mx-space/core/commit/c3ab2ce3a5a5d02cb33dac157f1185b8a6d6d8af))
* **deps:** update dependency openai to v4.68.1 ([7d96211](https://github.com/mx-space/core/commit/7d96211b06332263564571d0e4ebf8d555c4010e))
* **deps:** update dependency qs to v6.13.1 ([#2234](https://github.com/mx-space/core/issues/2234)) ([69403ca](https://github.com/mx-space/core/commit/69403cac2e57839e02683ad52770ef950a74264a))
* **deps:** update nest monorepo to v10.4.9 ([#2237](https://github.com/mx-space/core/issues/2237)) ([43a4488](https://github.com/mx-space/core/commit/43a44881a174e0034ce0f422f363a974cd7e0e60))

## [7.1.9](https://github.com/mx-space/core/compare/v7.1.8...v7.1.9) (2024-10-18)


### Bug Fixes

* downgrade mongoose ([70301af](https://github.com/mx-space/core/commit/70301af599a0cd9591ba78e952b1224c7ea28844))

## [7.1.8](https://github.com/mx-space/core/compare/v7.1.7...v7.1.8) (2024-10-07)


### Bug Fixes

* allow cors interceptor ([fa207ea](https://github.com/mx-space/core/commit/fa207ea4e3a92ff5c93d05ff1632965efbef9c83))
* **deps:** update babel monorepo to v7.25.7 ([9249adb](https://github.com/mx-space/core/commit/9249adbf66fdfc419cece0d243d680635c4808e2))
* **deps:** update dependency @aws-sdk/client-s3 to v3.657.0 ([#2154](https://github.com/mx-space/core/issues/2154)) ([e29b356](https://github.com/mx-space/core/commit/e29b356f87a60fa30ef35eece1a7dc32fc450fb3))
* **deps:** update dependency @fastify/static to v8 ([#2142](https://github.com/mx-space/core/issues/2142)) ([e2c8bdc](https://github.com/mx-space/core/commit/e2c8bdcc42080da5b4c624c57b1fae6cf0817ef1))
* **deps:** update dependency @langchain/openai to v0.3.1 ([57b8200](https://github.com/mx-space/core/commit/57b8200f228227f10450f42edc04b94f3220da69))
* **deps:** update dependency @langchain/openai to v0.3.2 ([6bf8aa5](https://github.com/mx-space/core/commit/6bf8aa5a3b39ac5018f0091c21c47764cb88f18f))
* **deps:** update dependency @langchain/openai to v0.3.4 ([5fd7f14](https://github.com/mx-space/core/commit/5fd7f14ac4f572dc8c3edac6fb65cc7f12822317))
* **deps:** update dependency @langchain/openai to v0.3.5 ([#2181](https://github.com/mx-space/core/issues/2181)) ([5487e2c](https://github.com/mx-space/core/commit/5487e2c48d28c4d95730b23668af660229d5576d))
* **deps:** update dependency @typegoose/auto-increment to v4.7.0 ([#2172](https://github.com/mx-space/core/issues/2172)) ([384e2e2](https://github.com/mx-space/core/commit/384e2e2f28b46c7dbbc5e6dd34958d7dd55eabf6))
* **deps:** update dependency cache-manager-ioredis-yet to v2.1.2 ([8bb15c3](https://github.com/mx-space/core/commit/8bb15c378a8e6a8412987cd34428595ed0cbbc83))
* **deps:** update dependency mongoose to v8.6.4 ([e70d70b](https://github.com/mx-space/core/commit/e70d70ba51b9d53a8e3cba7bc8b0133fb7a4bb32))
* **deps:** update dependency mongoose to v8.7.0 ([#2171](https://github.com/mx-space/core/issues/2171)) ([c1bb5e6](https://github.com/mx-space/core/commit/c1bb5e6d53aa9b91b2f455d2fec30924db1a6042))
* **deps:** update dependency mongoose-paginate-v2 to v1.8.4 ([a659ed2](https://github.com/mx-space/core/commit/a659ed2f793cdbe0370d96adaf137341e1acf186))
* **deps:** update dependency mongoose-paginate-v2 to v1.8.5 ([1ac42ef](https://github.com/mx-space/core/commit/1ac42ef0fe39cdf00b23f945bb4c48bf238bf9f6))
* **deps:** update dependency openai to v4.63.0 ([#2097](https://github.com/mx-space/core/issues/2097)) ([a1f84dc](https://github.com/mx-space/core/commit/a1f84dc40762f37753539c148d94e4342fbe2eff))
* **deps:** update dependency openai to v4.65.0 ([#2163](https://github.com/mx-space/core/issues/2163)) ([e450946](https://github.com/mx-space/core/commit/e450946de58b70904ab42dceb821661b01b3bd2c))
* **deps:** update nest monorepo to v10.4.4 ([bbdef0c](https://github.com/mx-space/core/commit/bbdef0c2745643436bdb21d68947c53863320a32))

## [7.1.7](https://github.com/mx-space/core/compare/v7.1.6...v7.1.7) (2024-09-19)


### Bug Fixes

* **deps:** update dependency @aws-sdk/client-s3 to v3.654.0 ([#2109](https://github.com/mx-space/core/issues/2109)) ([f5dfe67](https://github.com/mx-space/core/commit/f5dfe6745c336e55507fdebfccf707fc0f7aabfa))
* **deps:** update dependency @types/jsonwebtoken to v9.0.7 ([171491e](https://github.com/mx-space/core/commit/171491e47d7eae6a7ae88fb6737fe3a184553cc3))
* **deps:** update dependency langchain to v0.2.20 ([b7aaa91](https://github.com/mx-space/core/commit/b7aaa91d983038d66a4db6e5d945bfb24903ede6))
* **deps:** update dependency linkedom to v0.18.5 ([fa4138f](https://github.com/mx-space/core/commit/fa4138fbf669ab0811704249e721753b04ab2cd2))
* **deps:** update dependency mongoose to v8.6.3 ([25f2905](https://github.com/mx-space/core/commit/25f290537513eb4813dca503539680423586198c))
* **deps:** update nest monorepo to v10.4.3 ([3187b98](https://github.com/mx-space/core/commit/3187b98d3314878bb369dcf5b5fd538548118eca))

## [7.1.6](https://github.com/mx-space/core/compare/v7.1.5...v7.1.6) (2024-09-17)


### Features

* add comment `editedAt` ([2f1a973](https://github.com/mx-space/core/commit/2f1a973e5e374fbe456bfd62f38897448fe003af))

## [7.1.5](https://github.com/mx-space/core/compare/v7.1.4...v7.1.5) (2024-09-17)


### Bug Fixes

* reader assgin ([a0e37aa](https://github.com/mx-space/core/commit/a0e37aa41729faf3edd9fd6c6923ba6c30ed54b9))


### Features

* edit comment ([ed7b33e](https://github.com/mx-space/core/commit/ed7b33e3a90c782bb7c3092140645fd4390f620a))

## [7.1.4](https://github.com/mx-space/core/compare/v7.1.3...v7.1.4) (2024-09-16)


### Bug Fixes

* **reader:** assign to comment dto ([764e30f](https://github.com/mx-space/core/commit/764e30fb948a5fb94deab740fdc702f96003e4a0))

## [7.1.3](https://github.com/mx-space/core/compare/v7.1.2...v7.1.3) (2024-09-16)


### Bug Fixes

* reader handle projection ([c8b2eab](https://github.com/mx-space/core/commit/c8b2eabe1f97f33cb7042d2394c6bbf659161710))

## [7.1.2](https://github.com/mx-space/core/compare/v7.1.1...v7.1.2) (2024-09-16)


### Bug Fixes

* **deps:** update dependency ua-parser-js to v1.0.39 ([f54f721](https://github.com/mx-space/core/commit/f54f721c1f8f2caf11e8ce36a6251f7dc3e6edc3))
* disable cache for auth session ([6a7a7c8](https://github.com/mx-space/core/commit/6a7a7c831c8b5ef5dbe533d2d52cf5b433c5d78f))

## [7.1.1](https://github.com/mx-space/core/compare/v7.1.0...v7.1.1) (2024-09-14)


### Bug Fixes

* add `handle` to query ([85d4a14](https://github.com/mx-space/core/commit/85d4a140220fe0163a2efd8267a87836a4fb6df5))

# [7.1.0](https://github.com/mx-space/core/compare/v7.0.7...v7.1.0) (2024-09-14)


### Bug Fixes

* **deps:** update dependency @langchain/openai to v0.2.11 ([3e9e36a](https://github.com/mx-space/core/commit/3e9e36a248ca607979a56270602c8193fef6fedd))
* **deps:** update dependency langchain to v0.2.19 ([0285b93](https://github.com/mx-space/core/commit/0285b935ff6a46a072b7deffade2427ab22c44c5))
* **deps:** update dependency marked to v14.1.2 ([77af705](https://github.com/mx-space/core/commit/77af70590dd4a4c7cccf79995cebed7cc8f54013))
* **deps:** update dependency mongoose to v8.6.2 ([25b16cf](https://github.com/mx-space/core/commit/25b16cf2ad0c4cd866eb9ea1bf596834ea35c649))


### Features

* reader for comment and like action ([#2122](https://github.com/mx-space/core/issues/2122)) ([26b2b4f](https://github.com/mx-space/core/commit/26b2b4f13451b22d3e242f5ef52b31e4fa95a60a))

## [7.0.7](https://github.com/mx-space/core/compare/v7.0.6...v7.0.7) (2024-09-07)


### Bug Fixes

* **deps:** update dependency @aws-sdk/client-s3 to v3.645.0 ([#2091](https://github.com/mx-space/core/issues/2091)) ([aec8694](https://github.com/mx-space/core/commit/aec869457334b7fca271d5d112480c29c88755ca))
* **deps:** update dependency @langchain/openai to v0.2.10 ([6f038e1](https://github.com/mx-space/core/commit/6f038e196221cfb3ab89abd491d5d54bcf52a52b))
* **deps:** update dependency langchain to v0.2.18 ([fbd7436](https://github.com/mx-space/core/commit/fbd743648a99364fd41ee22b8e03305d7fbec182))
* **deps:** update dependency lru-cache to v11.0.1 ([26d3fd3](https://github.com/mx-space/core/commit/26d3fd3039afa9ddeb788d4d529ae76e9224e530))
* **deps:** update dependency mongoose-lean-virtuals to v1 ([#2085](https://github.com/mx-space/core/issues/2085)) ([26e2385](https://github.com/mx-space/core/commit/26e23852191f9fe270021accec63cf25abde12b1))
* **deps:** update dependency openai to v4.57.3 ([7984436](https://github.com/mx-space/core/commit/7984436d4dcd90c8be36e789892923871fc1d873))
* **oauth:** can not disable oauth ([8fc72f1](https://github.com/mx-space/core/commit/8fc72f1795390187d0437d6db1e9ba05eb862fe5))

## [7.0.6](https://github.com/mx-space/core/compare/v7.0.5...v7.0.6) (2024-09-05)


### Bug Fixes

* bark service push ([daa499e](https://github.com/mx-space/core/commit/daa499e6920d22ed008457f97e1ec36bc5896135))
* **deps:** update dependency openai to v4.57.2 ([ebeed58](https://github.com/mx-space/core/commit/ebeed58cb55b3e78c81476740d71feecbf06b9df))
* ip query function ([06a1963](https://github.com/mx-space/core/commit/06a196360f61aba89e02c6f2e93b62cf5bd2c9b4))

## [7.0.5](https://github.com/mx-space/core/compare/v7.0.4...v7.0.5) (2024-09-04)


### Bug Fixes

* **auth:** append user id for session ([b41a35f](https://github.com/mx-space/core/commit/b41a35f67542d700d384460f1e5ab23acca76296))

## [7.0.4](https://github.com/mx-space/core/compare/v7.0.3...v7.0.4) (2024-09-04)


### Bug Fixes

* auth jwt ([bba36c2](https://github.com/mx-space/core/commit/bba36c2d1aa532a5f4ccc8401f565fb89f8691c6))

## [7.0.3](https://github.com/mx-space/core/compare/v7.0.2...v7.0.3) (2024-09-04)


### Bug Fixes

* auth ([311f2de](https://github.com/mx-space/core/commit/311f2de80cc56aa7a55963a86217fb65bf405528))

## [7.0.2](https://github.com/mx-space/core/compare/v7.0.2-alpha.0...v7.0.2) (2024-09-04)


### Bug Fixes

* 0day auth ([3451d2f](https://github.com/mx-space/core/commit/3451d2f0652e24e0d58f1ff2742be35985fcbc7f))
* **deps:** update dependency marked to v14.1.1 ([54307a0](https://github.com/mx-space/core/commit/54307a0897e0238d0dffd91a1fa27fe49094135f))
* **deps:** update dependency mongoose to v8.6.1 ([cd391a4](https://github.com/mx-space/core/commit/cd391a4195b38173818a092a07d7c9a0bcab118a))
* **deps:** update dependency nodemailer to v6.9.15 ([2a7fa37](https://github.com/mx-space/core/commit/2a7fa3726175eace801d58de85c730fac41dc2ad))
* **deps:** update dependency openai to v4.57.1 ([74d2cd8](https://github.com/mx-space/core/commit/74d2cd8fb6b95517282b5689bd585dea871d25b7))

## [7.0.2-alpha.0](https://github.com/mx-space/core/compare/v7.0.1...v7.0.2-alpha.0) (2024-09-03)


### Bug Fixes

* try debug fn error ([df9a164](https://github.com/mx-space/core/commit/df9a1646e6e02bedd4d9deb9dc1a7d8ea9c41602))

## [7.0.1](https://github.com/mx-space/core/compare/v7.0.0...v7.0.1) (2024-09-03)


### Bug Fixes

* merge oauth and google support ([23f6acb](https://github.com/mx-space/core/commit/23f6acb1f01122264f18b049faca86903615b444))
* server time cors ([ca63592](https://github.com/mx-space/core/commit/ca63592bd81c65e9d775e861dabaf1ceb7b8ab06))

# [7.0.0](https://github.com/mx-space/core/compare/v7.0.0-alpha.3...v7.0.0) (2024-09-02)


### Bug Fixes

* **deps:** update dependency @typegoose/auto-increment to v4.6.0 ([#2073](https://github.com/mx-space/core/issues/2073)) ([504f9eb](https://github.com/mx-space/core/commit/504f9ebfce9e890780e6e92046d3d7a1abcd2f27))
* **deps:** update dependency @typegoose/typegoose to v12.7.0 ([#2074](https://github.com/mx-space/core/issues/2074)) ([d900c52](https://github.com/mx-space/core/commit/d900c52e54b0b794d1f0ee42c353f8b641ca0a5b))
* **deps:** update dependency marked to v14.1.0 ([#2048](https://github.com/mx-space/core/issues/2048)) ([159ee56](https://github.com/mx-space/core/commit/159ee56b59a3f94626d9bbb81900023fa0f1cc73))
* **deps:** update dependency mongoose to v8.6.0 ([#2064](https://github.com/mx-space/core/issues/2064)) ([778b706](https://github.com/mx-space/core/commit/778b70677490f9d92072f169344409f4319f8a8b))
* **deps:** update dependency openai to v4.57.0 ([#2067](https://github.com/mx-space/core/issues/2067)) ([b4930db](https://github.com/mx-space/core/commit/b4930db778769ac742995710bbc2675d8bb76c9c))
* **deps:** update dependency remove-markdown to v0.5.5 ([#2079](https://github.com/mx-space/core/issues/2079)) ([7726449](https://github.com/mx-space/core/commit/77264496e887375876619e0f8440229cb041f54e))

# [7.0.0-alpha.3](https://github.com/mx-space/core/compare/v7.0.0-alpha.2...v7.0.0-alpha.3) (2024-09-02)


### Bug Fixes

* server time cors ([34613e5](https://github.com/mx-space/core/commit/34613e5dff745e6f59674e72dfc308d2ad5a3a6b))

# [7.0.0-alpha.2](https://github.com/mx-space/core/compare/v7.0.0-alpha.1...v7.0.0-alpha.2) (2024-09-02)


### Bug Fixes

* trust host for auth ([d4c4337](https://github.com/mx-space/core/commit/d4c43375d9a0d3676d1ff6a87b402f39c0695d5e))

# [7.0.0-alpha.1](https://github.com/mx-space/core/compare/v7.0.0-alpha.0...v7.0.0-alpha.1) (2024-09-02)

# [7.0.0-alpha.0](https://github.com/mx-space/core/compare/v6.1.5...v7.0.0-alpha.0) (2024-09-02)


### Bug Fixes

* `localhost` for dev ([4b756f2](https://github.com/mx-space/core/commit/4b756f2b1ad27de102bf906699e1df6d2232ef86))
* add handle for reader query ([02c213a](https://github.com/mx-space/core/commit/02c213a1761c48d309073774deb8e017b22aef70))
* **auth:** add account for session ([29661e7](https://github.com/mx-space/core/commit/29661e75e64fa1e6ff6e1720e4991e780f08e2fa))
* camcasekey ([5038c4d](https://github.com/mx-space/core/commit/5038c4d0423839b8a918dc61d1d2bbb01716eade))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.32 ([9dd3999](https://github.com/mx-space/core/commit/9dd3999ca9feead34601f60108819b4ea68a4675))
* **deps:** update dependency mongoose to v8.5.5 ([46c04e8](https://github.com/mx-space/core/commit/46c04e841da7755c0c84c10e78ae6b8e75955bc6))
* **deps:** update dependency openai to v4.56.2 ([c4df9c5](https://github.com/mx-space/core/commit/c4df9c59978e68371215566df7d94a8072d2b56b))
* **deps:** update dependency remove-markdown to v0.5.3 ([e27e27b](https://github.com/mx-space/core/commit/e27e27b3b5a34209085895ea45cd500b0148c77d))
* mongo agg query ([da283b4](https://github.com/mx-space/core/commit/da283b4730bf067b0ec2ede615e0197f844cca7a))
* oauth profile for github ([19d1030](https://github.com/mx-space/core/commit/19d10300d11e6926e7d7279db0d8a29a2f1e4907))
* transform case and export client type ([f7bce02](https://github.com/mx-space/core/commit/f7bce0279a01f5173f2c09c2624d883124db4b76))


### Features

* add reader id for presence ([33c48f7](https://github.com/mx-space/core/commit/33c48f743f8c0ddb2ddfa249d39c08eec3e3416c))
* Auth.js integration ([#2054](https://github.com/mx-space/core/issues/2054)) ([6e50bee](https://github.com/mx-space/core/commit/6e50bee8dafbd7e56742b711d01a167c70f96f9a))

## [6.1.5](https://github.com/mx-space/core/compare/v6.1.4...v6.1.5) (2024-08-28)


### Bug Fixes

* **deps:** update dependency @antfu/install-pkg to v0.4.1 ([fc9eef9](https://github.com/mx-space/core/commit/fc9eef989e26d6f7574fafbbfc5054beb024a0eb))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.30 ([79b9c84](https://github.com/mx-space/core/commit/79b9c84797f23635e9fca26f46f3b96fea00a99b))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.31 ([0f8ae33](https://github.com/mx-space/core/commit/0f8ae3341baf39d319a92acfcec79278aa3426f7))
* **deps:** update dependency @langchain/openai to v0.2.8 ([f2d247b](https://github.com/mx-space/core/commit/f2d247ba8c8d7118b1d23b52697963dcb41c0269))
* **deps:** update dependency mongoose to v8.5.4 ([3b19040](https://github.com/mx-space/core/commit/3b190405652741d35c4b741a1df21eac08ef3cf0))
* **deps:** update dependency openai to v4.56.1 ([b935ee5](https://github.com/mx-space/core/commit/b935ee5fe5211d36eb48db0d5e5008818acfb0cc))


### Features

* add ai target language ([638deb3](https://github.com/mx-space/core/commit/638deb30100c79ecb023a5e586f2960ed620e51c))

## [6.1.4](https://github.com/mx-space/core/compare/v6.1.3...v6.1.4) (2024-08-23)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.28 ([6bfe818](https://github.com/mx-space/core/commit/6bfe8181981c5510b3a9861b4af2cd3705f1a58b))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.29 ([845fea5](https://github.com/mx-space/core/commit/845fea599e6672fe6eb6508cc81e49840ef3a42f))
* **deps:** update dependency @langchain/openai to v0.2.7 ([34383a9](https://github.com/mx-space/core/commit/34383a99cdc5444f4c8283e6e58a12f633c1137a))
* **deps:** update dependency dayjs to v1.11.13 ([5c6fef3](https://github.com/mx-space/core/commit/5c6fef3d0bd70e82bbc7efbb417cd68a0e84c9b7))
* **deps:** update dependency isbot to v5.1.17 ([4d86f4c](https://github.com/mx-space/core/commit/4d86f4c52ed14ff6240bd2c0046ba4e2e4fc7a40))
* **deps:** update dependency langchain to v0.2.17 ([cddd3d9](https://github.com/mx-space/core/commit/cddd3d91c847ecaeccfb7c71470a738b0fdbe862))
* **deps:** update dependency openai to v4.56.0 ([#2013](https://github.com/mx-space/core/issues/2013)) ([4cc5d07](https://github.com/mx-space/core/commit/4cc5d07a41ad9f5099d4ad319def791c1b3b3f6d))

## [6.1.3](https://github.com/mx-space/core/compare/v6.1.2...v6.1.3) (2024-08-16)


### Bug Fixes

* cloned object ([9a585a1](https://github.com/mx-space/core/commit/9a585a1fa0cb565958eec1b469646bcc8885f337))

## [6.1.2](https://github.com/mx-space/core/compare/v6.1.1...v6.1.2) (2024-08-16)


### Bug Fixes

* create module json first ([d466036](https://github.com/mx-space/core/commit/d4660361d8c92716ffe451467e739b59201f7a01))

## [6.1.1](https://github.com/mx-space/core/compare/v6.1.0...v6.1.1) (2024-08-16)


### Bug Fixes

* import type of sharp ([32954a7](https://github.com/mx-space/core/commit/32954a709d838cc82e4a3a845f1b9c6cbc7cd2de))

# [6.1.0](https://github.com/mx-space/core/compare/v6.0.3...v6.1.0) (2024-08-16)


### Bug Fixes

* **deps:** update dependency @aws-sdk/client-s3 to v3.632.0 ([#1977](https://github.com/mx-space/core/issues/1977)) ([81c6af6](https://github.com/mx-space/core/commit/81c6af6a9ca2982cb06b56de15c41c300e69beb3))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.26 ([2d78a04](https://github.com/mx-space/core/commit/2d78a042ac295153c931cd6428c1e5b1f5b309cd))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.27 ([4392ad3](https://github.com/mx-space/core/commit/4392ad39f02450358006b4d7e39c7ebcb48fbc94))
* **deps:** update dependency isbot to v5.1.15 ([08e8f2f](https://github.com/mx-space/core/commit/08e8f2f6a59fd8aea6b1d6826946fbca8a2583fa))
* **deps:** update dependency isbot to v5.1.16 ([423a2ab](https://github.com/mx-space/core/commit/423a2ab009be43e5af51309f0d67613de5648d13))
* **deps:** update dependency langchain to v0.2.14 ([b1f6a3d](https://github.com/mx-space/core/commit/b1f6a3df67516f58ac55b0075cfab9f7c8e854d3))
* **deps:** update dependency langchain to v0.2.15 ([819727c](https://github.com/mx-space/core/commit/819727c1cc813e52cefe1f1b2320361d8f2ec202))
* **deps:** update dependency langchain to v0.2.16 ([41d6974](https://github.com/mx-space/core/commit/41d697417efb604da3c36dd4c7b777d6fc51ae90))
* **deps:** update dependency openai to v4.55.7 ([#1968](https://github.com/mx-space/core/issues/1968)) ([831d87c](https://github.com/mx-space/core/commit/831d87c9650bb44eede74c7739f5529c464f3f54))
* **deps:** update dependency openai to v4.55.9 ([5d335fc](https://github.com/mx-space/core/commit/5d335fcf3f1f727e5436c8dd334e715f4bae898c))
* **deps:** update nest monorepo to v10.4.1 (minor) ([#1994](https://github.com/mx-space/core/issues/1994)) ([3ee55a7](https://github.com/mx-space/core/commit/3ee55a778e1fcee59f2881f696268501b5e82785))
* import circular ([a8a21d9](https://github.com/mx-space/core/commit/a8a21d99d3272c634167bec65757d1d3fbdefe44))
* migrate db first ([b923c7f](https://github.com/mx-space/core/commit/b923c7f438a28ca19e30fb44788a9a4f09c2aaa2))


### Features

* image blur hash ([#2010](https://github.com/mx-space/core/issues/2010)) ([c27ee8c](https://github.com/mx-space/core/commit/c27ee8c28d19a65f7cedcd5874eae10b9417dcdb))

## [6.0.3](https://github.com/mx-space/core/compare/v6.0.2...v6.0.3) (2024-08-08)


### Bug Fixes

* **deps:** update babel monorepo to v7.25.2 (minor) ([#1928](https://github.com/mx-space/core/issues/1928)) ([075365b](https://github.com/mx-space/core/commit/075365bc4c469e01906b55ecfc3b51d86c7306c9))
* **deps:** update dependency @aws-sdk/client-s3 to v3.624.0 ([#1921](https://github.com/mx-space/core/issues/1921)) ([b8bc581](https://github.com/mx-space/core/commit/b8bc581b6d10fd85276ef073608291a35f8e4189))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.23 ([0523626](https://github.com/mx-space/core/commit/0523626b5910e3ab4c68d72181d9c4820a933ab7))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.24 ([b6e7a54](https://github.com/mx-space/core/commit/b6e7a54bde27a69849e74185871db8f39004f3c3))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.25 ([d61b5be](https://github.com/mx-space/core/commit/d61b5be060dd240c97137396feb69697645c18ae))
* **deps:** update dependency @langchain/openai to v0.2.6 ([9afa15d](https://github.com/mx-space/core/commit/9afa15dd74e58ed173aabf107976ba6064e44cc5))
* **deps:** update dependency axios-retry to v4.5.0 ([#1954](https://github.com/mx-space/core/issues/1954)) ([7fc6768](https://github.com/mx-space/core/commit/7fc6768d3cae5432ef9b76d7e212e8fa5b4aeac6))
* **deps:** update dependency cache-manager to v5.7.5 ([ccbf2ea](https://github.com/mx-space/core/commit/ccbf2ea9c86950e43f1009212659b7814323fb75))
* **deps:** update dependency cache-manager to v5.7.6 ([45bd1cc](https://github.com/mx-space/core/commit/45bd1cc055598773163340e8fe23cdb81b66f3b8))
* **deps:** update dependency isbot to v5.1.14 ([313fe80](https://github.com/mx-space/core/commit/313fe8015e0d498f44530ebb435e9a9d3250479b))
* **deps:** update dependency langchain to v0.2.13 ([32a65cf](https://github.com/mx-space/core/commit/32a65cfb4871710212e143a6709f05622e96af67))
* **deps:** update dependency mongoose-lean-getters to v2.1.1 ([492381d](https://github.com/mx-space/core/commit/492381d3f682e8adcd2eeec8c1c295860a46e06b))
* **deps:** update dependency openai to v4.54.0 ([#1949](https://github.com/mx-space/core/issues/1949)) ([4647155](https://github.com/mx-space/core/commit/46471552d8022ede6987f0f9a0626e5858592ffb))
* **deps:** update dependency qs to v6.13.0 ([#1946](https://github.com/mx-space/core/issues/1946)) ([967d2e2](https://github.com/mx-space/core/commit/967d2e27e15b3dd330a122e7c3ce71906916f54f))
* **deps:** update dependency remove-markdown to v0.5.2 ([#1948](https://github.com/mx-space/core/issues/1948)) ([8ff229f](https://github.com/mx-space/core/commit/8ff229fbee7d19307ad24f3d97263a061fb66171))
* lint ([ccdf213](https://github.com/mx-space/core/commit/ccdf213748f2a9f49cdb7e2663c1defc1a359395))
* lint ([c46ce87](https://github.com/mx-space/core/commit/c46ce87c8f7507889e2c0e843f6291360b5273b2))


### Features

* link allow subpath option ([327d30d](https://github.com/mx-space/core/commit/327d30d6756d6e172e4682428a1ca5b254852022))

## [6.0.2](https://github.com/mx-space/core/compare/v6.0.1...v6.0.2) (2024-08-01)


### Bug Fixes

* **db:** use process.env as the default value of command option ([#1941](https://github.com/mx-space/core/issues/1941)) ([b19493a](https://github.com/mx-space/core/commit/b19493af0e16a115de7079b0ddd048e66f53746b))
* **deps:** update babel monorepo to v7.24.8 ([d8ee22f](https://github.com/mx-space/core/commit/d8ee22ffd382dcd7217df62d5cadfcee076d827a))
* **deps:** update babel monorepo to v7.24.9 ([a49e3b9](https://github.com/mx-space/core/commit/a49e3b980e4eba3fb1ac587cb3139b929634d151))
* **deps:** update dependency @aws-sdk/client-s3 to v3.614.0 ([#1874](https://github.com/mx-space/core/issues/1874)) ([2039a3d](https://github.com/mx-space/core/commit/2039a3d5f0d6eed78ad8f18f15e5dfc8038ef410))
* **deps:** update dependency @aws-sdk/client-s3 to v3.617.0 ([#1909](https://github.com/mx-space/core/issues/1909)) ([3d409e8](https://github.com/mx-space/core/commit/3d409e8acfbdf3a3f3b6e7b7324b75b0271d3bf9))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.15 ([43fdd8e](https://github.com/mx-space/core/commit/43fdd8efe9ebfaacd062ff2f232b7feac5f0cf5d))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.16 ([cdbc517](https://github.com/mx-space/core/commit/cdbc51740c760299c6efc5c90e1ec12f6062f65e))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.18 ([abcae1f](https://github.com/mx-space/core/commit/abcae1fc4bac6d9f0520cc2767ab4977716e57b5))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.20 ([e7dbd6c](https://github.com/mx-space/core/commit/e7dbd6c8edf75ce1031e891983c01b3bf0d5c02f))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.21 ([ede03ed](https://github.com/mx-space/core/commit/ede03ed281c8ef9cdac8f362e1418a513686501a))
* **deps:** update dependency @innei/pretty-logger-nestjs to v0.3.3 ([ad67cb1](https://github.com/mx-space/core/commit/ad67cb10a4e359a56d5973934603a294bc715eca))
* **deps:** update dependency @langchain/openai to v0.2.4 ([#1829](https://github.com/mx-space/core/issues/1829)) ([72c4120](https://github.com/mx-space/core/commit/72c412001afa51cb5f66fa61dff6a7f79ac513e2))
* **deps:** update dependency @langchain/openai to v0.2.5 ([10ae0c5](https://github.com/mx-space/core/commit/10ae0c5d23817fb4019a75e16e990f528282c5f1))
* **deps:** update dependency @nestjs/schedule to v4.1.0 ([#1855](https://github.com/mx-space/core/issues/1855)) ([b0603b9](https://github.com/mx-space/core/commit/b0603b95047d2b751a2874adb6000f5525710c73))
* **deps:** update dependency @nestjs/throttler to v6 ([#1914](https://github.com/mx-space/core/issues/1914)) ([e2f0e57](https://github.com/mx-space/core/commit/e2f0e57062f696e7a591da123a3b515d576aac22))
* **deps:** update dependency @simplewebauthn/server to v10.0.1 ([#1902](https://github.com/mx-space/core/issues/1902)) ([84dce71](https://github.com/mx-space/core/commit/84dce71f42a5c9a092e3c713cac22a74c86ce109))
* **deps:** update dependency @typegoose/auto-increment to v4.5.0 ([#1877](https://github.com/mx-space/core/issues/1877)) ([d486ab8](https://github.com/mx-space/core/commit/d486ab85cd6b5c7ed5ab3ae2f8e2e953f1293b9c))
* **deps:** update dependency @typegoose/typegoose to v12.6.0 ([#1878](https://github.com/mx-space/core/issues/1878)) ([06592df](https://github.com/mx-space/core/commit/06592dffd0d56fae2780b12102fd0231d1f80388))
* **deps:** update dependency axios-retry to v4.4.2 ([#1903](https://github.com/mx-space/core/issues/1903)) ([8ca0d0f](https://github.com/mx-space/core/commit/8ca0d0fc11397b5ba35f63699de6f00ef98341b9))
* **deps:** update dependency cache-manager to v5.7.2 ([#1856](https://github.com/mx-space/core/issues/1856)) ([3d1be30](https://github.com/mx-space/core/commit/3d1be30f8b6b0cf57b7f8c9167c6e45c459a7a00))
* **deps:** update dependency cache-manager to v5.7.3 ([bdfe9c6](https://github.com/mx-space/core/commit/bdfe9c60cc8558f90892f0ea000c68a137608cb0))
* **deps:** update dependency cache-manager to v5.7.4 ([5790182](https://github.com/mx-space/core/commit/5790182c74b2adcb3660299a9a32b4297a5e96e0))
* **deps:** update dependency dayjs to v1.11.12 ([99bf0a9](https://github.com/mx-space/core/commit/99bf0a97e29f5f75905fed77acabea8fc0172a5c))
* **deps:** update dependency inquirer to v10 ([#1861](https://github.com/mx-space/core/issues/1861)) ([1e7ab05](https://github.com/mx-space/core/commit/1e7ab055b28a393d188ac204c55364c509ee1a00))
* **deps:** update dependency isbot to v5.1.12 ([b72b9d3](https://github.com/mx-space/core/commit/b72b9d3c1cdcc71843d6a18efc825cb1ad8ce41c))
* **deps:** update dependency isbot to v5.1.13 ([68bbdfa](https://github.com/mx-space/core/commit/68bbdfa88486077c34ffc70b22be360f937b2a8c))
* **deps:** update dependency langchain to v0.2.10 ([9855e24](https://github.com/mx-space/core/commit/9855e24534f606d0ccd80731223532b98b3edfe6))
* **deps:** update dependency langchain to v0.2.11 ([d0bc8cf](https://github.com/mx-space/core/commit/d0bc8cfb6ce65da70c804f7c15efe50a624b2ccd))
* **deps:** update dependency langchain to v0.2.12 ([36200bf](https://github.com/mx-space/core/commit/36200bf762fffae65cbf53a08ffe510335d68c8c))
* **deps:** update dependency langchain to v0.2.9 ([84f5985](https://github.com/mx-space/core/commit/84f5985546ec7e4262a22880490695a280365f05))
* **deps:** update dependency lru-cache to v10.4.3 ([#1858](https://github.com/mx-space/core/issues/1858)) ([14a6a5c](https://github.com/mx-space/core/commit/14a6a5ce5cccd3a95cc591548d4c19e1e7a6c6b5))
* **deps:** update dependency lru-cache to v11 ([#1915](https://github.com/mx-space/core/issues/1915)) ([d5dbd1a](https://github.com/mx-space/core/commit/d5dbd1adfdac6a97424a9642f3b54e18cc4f736f))
* **deps:** update dependency marked to v13.0.3 ([edd2b0c](https://github.com/mx-space/core/commit/edd2b0cd9573e601e0f0ba6eed14b9db84e76772))
* **deps:** update dependency mongoose to v8.5.1 ([#1879](https://github.com/mx-space/core/issues/1879)) ([31ec980](https://github.com/mx-space/core/commit/31ec980cca954b87e6be7b1130f535c68d23eebb))
* **deps:** update dependency mongoose to v8.5.2 ([9347595](https://github.com/mx-space/core/commit/93475953afd96568501fce56fbe97a7ab2d7a5b7))
* **deps:** update dependency mongoose-aggregate-paginate-v2 to v1.1.1 ([#1859](https://github.com/mx-space/core/issues/1859)) ([0321bcd](https://github.com/mx-space/core/commit/0321bcd031b3ba842cb462f97d01db0985395385))
* **deps:** update dependency mongoose-aggregate-paginate-v2 to v1.1.2 ([#1905](https://github.com/mx-space/core/issues/1905)) ([ee4a6e3](https://github.com/mx-space/core/commit/ee4a6e3ddf23665393666e80d25198c965b6ec06))
* **deps:** update dependency mongoose-paginate-v2 to v1.8.3 ([#1906](https://github.com/mx-space/core/issues/1906)) ([8bfd5c8](https://github.com/mx-space/core/commit/8bfd5c817e4f726b55c916184d070cc0ba72c57f))
* **deps:** update dependency openai to v4.52.7 ([4e42bee](https://github.com/mx-space/core/commit/4e42bee48ba37f5695a1db98142891e126f4a003))
* **deps:** update dependency openai to v4.53.1 ([#1911](https://github.com/mx-space/core/issues/1911)) ([07061b8](https://github.com/mx-space/core/commit/07061b80ca47d327c4285c9e904b2eef8ff9bf45))
* **deps:** update dependency openai to v4.53.2 ([ae47390](https://github.com/mx-space/core/commit/ae47390c55176979957313321a8a117d83613981))
* **deps:** update dependency qs to v6.12.3 ([b66726d](https://github.com/mx-space/core/commit/b66726d5ed8f21bcd23b563d9fd33592a285f3f5))
* update clerk auth ([2fd444d](https://github.com/mx-space/core/commit/2fd444d7009e1b8cd598d68bd5b3127027fd80d4))

## [6.0.1](https://github.com/mx-space/core/compare/v6.0.0...v6.0.1) (2024-07-07)


### Bug Fixes

* **deps:** update algoliasearch-client-javascript monorepo to v4.24.0 ([#1853](https://github.com/mx-space/core/issues/1853)) ([7478e9d](https://github.com/mx-space/core/commit/7478e9d0fa8cb245468cb3a1e074de069927f2a8))
* **deps:** update dependency @aws-sdk/client-s3 to v3.609.0 ([#1854](https://github.com/mx-space/core/issues/1854)) ([204f855](https://github.com/mx-space/core/commit/204f855c06a5986897595565c55fefb068caf79b))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.14 ([a383dc2](https://github.com/mx-space/core/commit/a383dc21c23f06f2b27501430f17bc6bce0b8ae9))
* **deps:** update dependency isbot to v5.1.11 ([0fca0d3](https://github.com/mx-space/core/commit/0fca0d33bc506d7da45297c01f467a25652fe5d3))
* **deps:** update dependency langchain to v0.2.8 ([cc155ab](https://github.com/mx-space/core/commit/cc155ab78582111b0ae2fbaa9ea551fb4739b35d))
* **deps:** update dependency linkedom to v0.18.4 ([d7bf117](https://github.com/mx-space/core/commit/d7bf117a8b4ac6108a9dd32cedfce114dcbbaa00))
* **deps:** update dependency marked to v13.0.2 ([#1832](https://github.com/mx-space/core/issues/1832)) ([efd3cc5](https://github.com/mx-space/core/commit/efd3cc505498d9f9d5ca2c50856a7be1ab5a4f28))
* **deps:** update dependency mongoose to v8.4.5 ([61e1f06](https://github.com/mx-space/core/commit/61e1f06b9e12f1dff8996aa56090da135d4243b3))
* **deps:** update dependency mongoose-aggregate-paginate-v2 to v1.0.42 ([6a4e502](https://github.com/mx-space/core/commit/6a4e5027c4ad6af26628702cc191645913f26628))
* **deps:** update dependency openai to v4.52.3 ([1febace](https://github.com/mx-space/core/commit/1febace72501f917c648731766e683506fb1458c))
* **deps:** update dependency qs to v6.12.2 ([4f737a9](https://github.com/mx-space/core/commit/4f737a983490dca874d0b3f546b05f8c8da25313))
* **deps:** update nest monorepo ([c30b6c1](https://github.com/mx-space/core/commit/c30b6c1486a8734e26054372ab5a3d29c154227d))
* **update:** bad credentials when requesting with empty github token ([#1847](https://github.com/mx-space/core/issues/1847)) ([63f4551](https://github.com/mx-space/core/commit/63f4551da9c5a2b25c2db102a70e988ff3808a1e))

# [6.0.0](https://github.com/mx-space/core/compare/v5.8.4...v6.0.0) (2024-06-22)


### Bug Fixes

* cleanTempDirectory not remake trash directory ([#1824](https://github.com/mx-space/core/issues/1824)) ([4877459](https://github.com/mx-space/core/commit/4877459edbdeba975ddd57874856f8a869001d28))
* crypto compatible ([503f079](https://github.com/mx-space/core/commit/503f0798e6a6ba44b11d0826b2886565c7944c19))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.12 ([772f6f7](https://github.com/mx-space/core/commit/772f6f79653272ba19608cc765c48c27c8b4209b))
* **deps:** update dependency @nestjs/throttler to v5.2.0 ([#1806](https://github.com/mx-space/core/issues/1806)) ([bfa25c0](https://github.com/mx-space/core/commit/bfa25c0d06e084a413990d4400e1b8e6121ded32))
* **deps:** update dependency axios-retry to v4.4.1 ([#1825](https://github.com/mx-space/core/issues/1825)) ([0585033](https://github.com/mx-space/core/commit/05850331effd5d5e0341db8c507bed3c269cf7f8))
* **deps:** update dependency mongoose to v8.4.3 ([79c7585](https://github.com/mx-space/core/commit/79c7585ba7b5c156af0ba94024572f68e18d7a6e))
* **deps:** update dependency nodemailer to v6.9.14 ([416f933](https://github.com/mx-space/core/commit/416f9331621ac92169acd11459f35cb975306225))

## [5.8.4](https://github.com/mx-space/core/compare/v5.8.3...v5.8.4) (2024-06-14)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.11 ([b88b7bf](https://github.com/mx-space/core/commit/b88b7bf8a1df9081e3a1db0e042a424c7e917753))
* **deps:** update dependency openai to v4.51.0 ([#1791](https://github.com/mx-space/core/issues/1791)) ([78c03e3](https://github.com/mx-space/core/commit/78c03e3a76c0419c79c4da0bd81be84cfc052f2e))


### Features

* support `gh_token` closes 1758 ([39e10ef](https://github.com/mx-space/core/commit/39e10efcd1113e475b03cb055321a1b58f9306b3))

## [5.8.3](https://github.com/mx-space/core/compare/v5.8.2...v5.8.3) (2024-06-12)


### Bug Fixes

* **deps:** update babel monorepo to v7.24.7 ([37e1a83](https://github.com/mx-space/core/commit/37e1a83d98c50f0dbe7d66f415097e2458a8f857))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.10 ([f2eb9c9](https://github.com/mx-space/core/commit/f2eb9c93f453dddb7f0c4371e80edfccf27b88f4))
* **deps:** update dependency @fastify/multipart to v8.3.0 ([#1786](https://github.com/mx-space/core/issues/1786)) ([0c40479](https://github.com/mx-space/core/commit/0c40479502e89085ad67dbf720aef2c5f016452a))
* **deps:** update dependency @langchain/openai to v0.1.2 ([#1754](https://github.com/mx-space/core/issues/1754)) ([e0a6fcf](https://github.com/mx-space/core/commit/e0a6fcf309b6183f3a1c72e718ad805e53641569))
* **deps:** update dependency @langchain/openai to v0.1.3 ([ca985b9](https://github.com/mx-space/core/commit/ca985b9cf2bb1886885f68957bb3ec91a1cf96b6))
* **deps:** update dependency axios-retry to v4.4.0 ([#1772](https://github.com/mx-space/core/issues/1772)) ([66bbe14](https://github.com/mx-space/core/commit/66bbe14da48eee6dd7ac8b6a0f7e21618639a85f))
* **deps:** update dependency cache-manager to v5.6.1 ([#1784](https://github.com/mx-space/core/issues/1784)) ([c90dafa](https://github.com/mx-space/core/commit/c90dafae12d1cc452947cabdf538c789326cd9b2))
* **deps:** update dependency cache-manager-ioredis-yet to v2.1.1 ([#1785](https://github.com/mx-space/core/issues/1785)) ([462a6a8](https://github.com/mx-space/core/commit/462a6a87fcbd63e44cb0d5b57bac7723be59a266))
* **deps:** update dependency isbot to v5.1.9 ([514bb52](https://github.com/mx-space/core/commit/514bb52f352d32b4b133cee98679b59f691bee1a))
* **deps:** update dependency langchain to v0.2.5 ([2930d0c](https://github.com/mx-space/core/commit/2930d0c812a4df67d05c6df9655b376c85d33398))
* **deps:** update dependency linkedom to v0.18.3 ([098d726](https://github.com/mx-space/core/commit/098d72640e52dc7a79187294581a5e0bc95d8a8d))
* **deps:** update dependency openai to v4.49.0 ([#1774](https://github.com/mx-space/core/issues/1774)) ([89b034b](https://github.com/mx-space/core/commit/89b034b8d2091fd49e89896ddaf091d2ff1f2c5e))
* **deps:** update dependency openai to v4.49.1 ([e8f66d2](https://github.com/mx-space/core/commit/e8f66d28f2a618d0ffa6e483300e17942a620c62))
* master avatar in recent activity comments cannot be displayed ([#1794](https://github.com/mx-space/core/issues/1794)) ([1750340](https://github.com/mx-space/core/commit/175034031f00591631ffae0edcabedddeddfea2d))

## [5.8.2](https://github.com/mx-space/core/compare/v5.8.1...v5.8.2) (2024-06-04)


### Bug Fixes

* delete file with EXDEV issue ([#1770](https://github.com/mx-space/core/issues/1770)) ([b3dfbdf](https://github.com/mx-space/core/commit/b3dfbdf99628ae685855ecf20cf1782ddc8d9b25))
* **deps:** update nest monorepo to v10.3.9 ([#1768](https://github.com/mx-space/core/issues/1768)) ([d627d38](https://github.com/mx-space/core/commit/d627d38b69cb4d88d3497c05c50602c4b8f9dfa2))

## [5.8.1](https://github.com/mx-space/core/compare/v5.8.0...v5.8.1) (2024-06-02)


### Bug Fixes

* ai summary language detect ([8764815](https://github.com/mx-space/core/commit/876481529b2badf0adeb192c6c69b5a3216ea072))
* check slug length ([6a58262](https://github.com/mx-space/core/commit/6a5826248caff1458e7cb09b933d28d5f798fc55))
* **deps:** update dependency langchain to v0.2.4 ([08f30b5](https://github.com/mx-space/core/commit/08f30b53ac4e7807c43c3ba2f2ef668dd8119ae9))
* **deps:** update dependency linkedom to v0.18.2 ([d24818a](https://github.com/mx-space/core/commit/d24818a62c8c96c15181639be446011c7a9205d6))
* **deps:** update dependency mongoose to v8.4.1 ([e37c986](https://github.com/mx-space/core/commit/e37c9869ee91ccecbee4b406bd837a8ec5ab5736))
* **deps:** update dependency openai to v4.47.3 ([7996928](https://github.com/mx-space/core/commit/79969280277f91b493f86d6eab365b95bd1a987f))

# [5.8.0](https://github.com/mx-space/core/compare/v5.7.12...v5.8.0) (2024-05-30)


### Bug Fixes

* **deps:** update dependency @langchain/openai to v0.0.34 ([#1734](https://github.com/mx-space/core/issues/1734)) ([98ac7c0](https://github.com/mx-space/core/commit/98ac7c04130d15464dd394bb025db4e8430818be))
* **deps:** update dependency isbot to v5.1.8 ([d83ad94](https://github.com/mx-space/core/commit/d83ad9473c3fabac3664c55ff14a8e3ce41af871))
* **deps:** update dependency langchain to v0.2.2 ([f9e1f57](https://github.com/mx-space/core/commit/f9e1f57041ae0d06f73c574c99acc2d32c896f25))
* **deps:** update dependency langchain to v0.2.3 ([a574cb0](https://github.com/mx-space/core/commit/a574cb00af73ae688bb261aeeb811e71f332bc49))
* **deps:** update dependency mongoose-paginate-v2 to v1.8.2 ([e2f1e49](https://github.com/mx-space/core/commit/e2f1e4957f125c797591b18e29368f53210fdf93))
* **deps:** update dependency openai to v4.47.2 ([b4f7857](https://github.com/mx-space/core/commit/b4f785722b74e7fff50e12b2f0190afc9f9d0022))
* **deps:** update dependency ua-parser-js to v1.0.38 ([254ee4c](https://github.com/mx-space/core/commit/254ee4cb4791964ee4d3a65bb8f0ebc7fcbf48fb))

## [5.7.12](https://github.com/mx-space/core/compare/v5.7.11...v5.7.12) (2024-05-28)


### Bug Fixes

* cache aggregate query with querykey ([32230bc](https://github.com/mx-space/core/commit/32230bc7da296ccf539c34e4a66d083ca2cf6a3b))
* **deps:** update babel monorepo to v7.24.6 ([6881179](https://github.com/mx-space/core/commit/68811793186dc13e99229ae50dec3bb8576cc38f))
* **deps:** update dependency @aws-sdk/client-s3 to v3.583.0 ([#1727](https://github.com/mx-space/core/issues/1727)) ([2874eca](https://github.com/mx-space/core/commit/2874eca3ef4091597fe1e5877c95a588ca4b17e5))

## [5.7.11](https://github.com/mx-space/core/compare/v5.7.10...v5.7.11) (2024-05-24)


### Bug Fixes

* **deps:** update dependency @aws-sdk/client-s3 to v3.582.0 ([#1723](https://github.com/mx-space/core/issues/1723)) ([2efcbe8](https://github.com/mx-space/core/commit/2efcbe85f0bac5ae61b8458cd8116dd983d3ac74))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.8 ([fc0d978](https://github.com/mx-space/core/commit/fc0d978e2dd76a53e0f4354937054de7495d9704))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.9 ([4cc19c2](https://github.com/mx-space/core/commit/4cc19c2f36b927161263f5888b3061b2f55b6ac2))
* **deps:** update dependency cache-manager to v5.5.3 ([d1b0097](https://github.com/mx-space/core/commit/d1b00977d2ec1c3e6c9468bee09d50c34ba3a395))
* **deps:** update dependency isbot to v5.1.7 ([b6efc7b](https://github.com/mx-space/core/commit/b6efc7ba26f48fd965afd16448eb1e3d6181c874))
* get all link ([dbf7c24](https://github.com/mx-space/core/commit/dbf7c2460706919c9282a54744ec4d42bdb479e2))

## [5.7.10](https://github.com/mx-space/core/compare/v5.7.9...v5.7.10) (2024-05-22)


### Bug Fixes

* asset push script ([f433ae7](https://github.com/mx-space/core/commit/f433ae7a455d517e7317e2545d51118198740ce3))
* **deps:** update dependency axios-retry to v4.3.0 ([#1718](https://github.com/mx-space/core/issues/1718)) ([df4fc28](https://github.com/mx-space/core/commit/df4fc280a98e6b1cf64eaecdc7a5acf5d79fcd04))

## [5.7.9](https://github.com/mx-space/core/compare/v5.7.8...v5.7.9) (2024-05-21)


### Bug Fixes

* comment model url setter ([16b919c](https://github.com/mx-space/core/commit/16b919cf900f708280e1fe9c806aa054d5a11268))

## [5.7.8](https://github.com/mx-space/core/compare/v5.7.7...v5.7.8) (2024-05-20)


### Bug Fixes

* **deps:** update dependency @typegoose/auto-increment to v4.4.0 ([#1714](https://github.com/mx-space/core/issues/1714)) ([a10dd5b](https://github.com/mx-space/core/commit/a10dd5b7e85f756b7691355f964ff709118831cf))
* downgrade snakecase deps ([66a07e6](https://github.com/mx-space/core/commit/66a07e625210fdd30f6f217b9bb530861660454c))

## [5.7.7](https://github.com/mx-space/core/compare/v5.7.6...v5.7.7) (2024-05-20)


### Bug Fixes

* **deps:** update dependency @aws-sdk/client-s3 to v3.577.0 ([#1688](https://github.com/mx-space/core/issues/1688)) ([4d883ee](https://github.com/mx-space/core/commit/4d883ee3e439bdde131ebab09139046be8e4105e))
* **deps:** update dependency commander to v12.1.0 ([#1713](https://github.com/mx-space/core/issues/1713)) ([3c30c1f](https://github.com/mx-space/core/commit/3c30c1f82be2f764c43f8257a0600b214026d22c))
* **deps:** update dependency linkedom to v0.18.0 ([#1696](https://github.com/mx-space/core/issues/1696)) ([1d4ced1](https://github.com/mx-space/core/commit/1d4ced10429d4c739fd84e2b7589dab1182dab91))
* **deps:** update dependency mongoose to v8.4.0 ([#1709](https://github.com/mx-space/core/issues/1709)) ([abb912b](https://github.com/mx-space/core/commit/abb912b22ed8c42b4c26ae119236cfb86906e0fc))
* throw error when delete file exception ([5da084d](https://github.com/mx-space/core/commit/5da084d6a0ead1ef4ecddf6a24c06cd10e923a07))

## [5.7.6](https://github.com/mx-space/core/compare/v5.7.5...v5.7.6) (2024-05-17)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.6 ([289e3cd](https://github.com/mx-space/core/commit/289e3cd673c973da018dfcba802d79f0810cb93d))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.7 ([06c0050](https://github.com/mx-space/core/commit/06c00502d3e4642daee86bdade84d007bd3fabd3))
* **deps:** update dependency axios-retry to v4.2.0 ([#1705](https://github.com/mx-space/core/issues/1705)) ([9f20ba2](https://github.com/mx-space/core/commit/9f20ba2ff10629ee28a3c44726416b644da8473f))
* **deps:** update dependency mongoose to v8.3.5 ([eea7608](https://github.com/mx-space/core/commit/eea7608102df46131a507de9409d3da1076cb489))
* **deps:** update dependency mongoose-paginate-v2 to v1.8.1 ([#1708](https://github.com/mx-space/core/issues/1708)) ([0aef6e0](https://github.com/mx-space/core/commit/0aef6e025a886a1ab1cd8a9f84f35fcfee5a8191))
* **deps:** update dependency openai to v4.47.1 ([#1676](https://github.com/mx-space/core/issues/1676)) ([8892442](https://github.com/mx-space/core/commit/88924422a85945c33a6b68f2af51b28cf5611e8a))

## [5.7.5](https://github.com/mx-space/core/compare/v5.7.4...v5.7.5) (2024-05-13)

## [5.7.4](https://github.com/mx-space/core/compare/v5.7.3...v5.7.4) (2024-05-11)


### Bug Fixes

* passkey origin ([b2fc18d](https://github.com/mx-space/core/commit/b2fc18d91b7fd6873694a34ce3ae6d94562a067e))

## [5.7.3](https://github.com/mx-space/core/compare/v5.7.2...v5.7.3) (2024-05-11)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.4 ([0e69856](https://github.com/mx-space/core/commit/0e698569b3ad4225f048a4967cf0b3ac877a21ea))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.5 ([30a8548](https://github.com/mx-space/core/commit/30a8548705514c3981ad29f7c9091abd6b28c237))
* **deps:** update dependency @fastify/static to v7.0.4 ([30e72f1](https://github.com/mx-space/core/commit/30e72f1043c7c7dad18a2377d01eb510125b364d))
* **deps:** update dependency mongoose to v8.3.4 ([b50e7ef](https://github.com/mx-space/core/commit/b50e7efa217b6537c3109d4bc31c6a85e2242287))
* lru cache set ([6125030](https://github.com/mx-space/core/commit/61250304c7348a453e745dc2bdef770ddd1f2157))


### Features

* add bark push settings ([784c6cd](https://github.com/mx-space/core/commit/784c6cd780f366bc60182c5c3eca0069f80d7b7a))
* add prod to dump memory ([5fc7fcd](https://github.com/mx-space/core/commit/5fc7fcdf648dd51a211314e63f88880d1eebc8be))

## [5.7.2](https://github.com/mx-space/core/compare/v5.7.1...v5.7.2) (2024-05-07)


### Bug Fixes

* bypass `OPTIONS` ([1a85d54](https://github.com/mx-space/core/commit/1a85d5400aca266f3d542f12fc735f6a23b9ccf5))
* **deps:** update dependency @aws-sdk/client-s3 to v3.569.0 ([#1651](https://github.com/mx-space/core/issues/1651)) ([7c56488](https://github.com/mx-space/core/commit/7c564886aa77b384057beb688a61ce60e7215f5f))
* **deps:** update dependency openai to v4.40.2 ([#1667](https://github.com/mx-space/core/issues/1667)) ([ed153a8](https://github.com/mx-space/core/commit/ed153a80ce7886ae8161f26f8502edc81939bb04))

## [5.7.1](https://github.com/mx-space/core/compare/v5.7.0...v5.7.1) (2024-05-04)


### Bug Fixes

* need auth to generate ai content ([ef85afe](https://github.com/mx-space/core/commit/ef85afed522589bf8b3d9b9ae1792ec1dd4483f5))

# [5.7.0](https://github.com/mx-space/core/compare/v5.6.7...v5.7.0) (2024-05-04)


### Features

* ai writer helper module ([f8909bd](https://github.com/mx-space/core/commit/f8909bd8c95eb90d995f848210c784be18ce9053))

## [5.6.7](https://github.com/mx-space/core/compare/v5.6.6...v5.6.7) (2024-05-03)


### Bug Fixes

* handle deleted content in get like data ([911640b](https://github.com/mx-space/core/commit/911640b32b26711670b68fd0b87bd0884c53df2a))

## [5.6.6](https://github.com/mx-space/core/compare/v5.6.5...v5.6.6) (2024-05-03)


### Bug Fixes

* add logger info ([bed1997](https://github.com/mx-space/core/commit/bed19977ed433b5661d2123615c2a1b51c471654))
* ai summarize ([1707c01](https://github.com/mx-space/core/commit/1707c019de028078905d93737fa13c89fb7e51b3))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.3 ([0b63c0b](https://github.com/mx-space/core/commit/0b63c0bb1babe7b545f8609927f07c1cdbac488b))

## [5.6.5](https://github.com/mx-space/core/compare/v5.6.4...v5.6.5) (2024-05-01)


### Bug Fixes

* **deps:** update dependency cache-manager to v5.5.2 ([#1659](https://github.com/mx-space/core/issues/1659)) ([88a80b0](https://github.com/mx-space/core/commit/88a80b024e41c7a36e64d31c37cd83d6cb0891c9))
* **deps:** update dependency mongoose-lean-getters to v2.1.0 ([#1656](https://github.com/mx-space/core/issues/1656)) ([f1190e2](https://github.com/mx-space/core/commit/f1190e2ae4d7357723e8c720607acebea0c0d236))
* **deps:** update dependency openai to v4.39.1 ([7bc272e](https://github.com/mx-space/core/commit/7bc272ead03c3f9c3d184b0fd7413204930c6f6c))
* make throttle config ([4543459](https://github.com/mx-space/core/commit/4543459336dff68510637d624c7b8bfece56eb28))
* summary language detect logic ([90e5a6b](https://github.com/mx-space/core/commit/90e5a6b594cc8101f6417b735c35a7008b0d34ea))

## [5.6.4](https://github.com/mx-space/core/compare/v5.6.3...v5.6.4) (2024-04-30)


### Bug Fixes

* **deps:** update babel monorepo to v7.24.5 ([#1661](https://github.com/mx-space/core/issues/1661)) ([6a4a2dc](https://github.com/mx-space/core/commit/6a4a2dc0e80d767b210f4e217ea60a6c4debce53))
* **deps:** update dependency cache-manager-ioredis-yet to v2.0.4 ([#1660](https://github.com/mx-space/core/issues/1660)) ([cb4d2f0](https://github.com/mx-space/core/commit/cb4d2f057a9d075148ec28b9925e36126a2f1b59))
* **deps:** update dependency dayjs to v1.11.11 ([bd6cec5](https://github.com/mx-space/core/commit/bd6cec573c71c9b83318e9afb731f8ed89f3e014))
* **deps:** update dependency isbot to v5.1.6 ([#1662](https://github.com/mx-space/core/issues/1662)) ([2b5a901](https://github.com/mx-space/core/commit/2b5a901755b7f7000ae9a6f56092edcb7ebaedc2))
* **deps:** update dependency lru-cache to v10.2.2 ([0adbd37](https://github.com/mx-space/core/commit/0adbd37b661eb455a5cb62270c0556f6c52faf23))
* **deps:** update dependency mongoose to v8.3.3 ([#1663](https://github.com/mx-space/core/issues/1663)) ([dcff2bd](https://github.com/mx-space/core/commit/dcff2bd483629dfb9ae8ba40dd4fd8cc23f4614c))
* **deps:** update dependency openai to v4.39.0 ([#1664](https://github.com/mx-space/core/issues/1664)) ([13c26c1](https://github.com/mx-space/core/commit/13c26c194a8ba4cd3486b518f07ca41b6b247a35))
* increase throttler ([eb95be1](https://github.com/mx-space/core/commit/eb95be1c69c30af30388180f6da1811d8f12616c))
* lint ([1ff8015](https://github.com/mx-space/core/commit/1ff80156f0cf66eb9997a49875bfc31ce2c2cb13))
* lint ([358a5e6](https://github.com/mx-space/core/commit/358a5e613546d004b8c0cde1ad954a38ea5a62d0))
* lint error ([c6980f9](https://github.com/mx-space/core/commit/c6980f98c2f32f6b9ab8d9ab60d07f1e07b8ced6))
* testing ([f74ef93](https://github.com/mx-space/core/commit/f74ef93dc3f58bc7490cc33bd2b6a7a4cda21a89))

## [5.6.3](https://github.com/mx-space/core/compare/v5.6.2...v5.6.3) (2024-04-27)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.2 ([608e470](https://github.com/mx-space/core/commit/608e470a3c6cf799a06e845a9ed5cb676ee6deb9))
* **deps:** update dependency isbot to v5.1.5 ([0e741f6](https://github.com/mx-space/core/commit/0e741f670cd5e2be3b90e901218b68ffe4588bcf))
* **deps:** update dependency lru-cache to v10.2.1 ([53fef99](https://github.com/mx-space/core/commit/53fef99df78b35798012e5dfd580498823e799d1))


### Features

* add `getLastYearPublication` api ([5a028c8](https://github.com/mx-space/core/commit/5a028c82e37f910320e1c33a63e52045986d580f))

## [5.6.2](https://github.com/mx-space/core/compare/v5.6.1...v5.6.2) (2024-04-26)


### Bug Fixes

* ai throw ([afdb6b7](https://github.com/mx-space/core/commit/afdb6b71d094326ff9be72a2a6efbf11274ae750))

## [5.6.1](https://github.com/mx-space/core/compare/v5.6.0...v5.6.1) (2024-04-26)

# [5.6.0](https://github.com/mx-space/core/compare/v5.5.7...v5.6.0) (2024-04-26)


### Bug Fixes

* throw error when ai disabled ([786a399](https://github.com/mx-space/core/commit/786a3994cd98f3840bcfbca46ebe9723b0e564f8))


### Features

* ai module ([#1649](https://github.com/mx-space/core/issues/1649)) ([c989a2a](https://github.com/mx-space/core/commit/c989a2a7b0977d3ebbdc72771f4965e7927ffb96))

## [5.5.7](https://github.com/mx-space/core/compare/v5.5.6...v5.5.7) (2024-04-25)


### Bug Fixes

* custom mongo connection string ([62243e8](https://github.com/mx-space/core/commit/62243e8482f8327e511c1a86cdd60f3e3cd2d771))
* delete regexp cache key ([f25f618](https://github.com/mx-space/core/commit/f25f6185caeadb50616c42437fe7f05cb21ecf95))
* **deps:** update dependency @clerk/clerk-sdk-node to v5.0.1 ([03c5bab](https://github.com/mx-space/core/commit/03c5bab11d763447723b422688ce6da405d5ca34))
* extends parent `isWhispers` ([d11382b](https://github.com/mx-space/core/commit/d11382b5533f03d01d9e57bfb05598f7d45bd694))
* file trash ([9c3394c](https://github.com/mx-space/core/commit/9c3394c6c8b31538fbb780966f65173574c146a2))
* filter markdown video href ([52c344d](https://github.com/mx-space/core/commit/52c344d132a81c725378cb46cf86bf29f2a3abd7))


### Features

* add `truncate` for post list ([45e7cf8](https://github.com/mx-space/core/commit/45e7cf83a8084ba34f62370a7c176cb761616eee))

## [5.5.6](https://github.com/mx-space/core/compare/v5.5.5...v5.5.6) (2024-04-22)


### Bug Fixes

* bypass options preflight ([845b307](https://github.com/mx-space/core/commit/845b3074437a042f6b1d0c0d2bcddf20e759d71d))
* comment email link url ([0fd8fbf](https://github.com/mx-space/core/commit/0fd8fbf4f5d2a0f0200a0b22e4dd9d83f1f04121))

## [5.5.5](https://github.com/mx-space/core/compare/v5.5.4...v5.5.5) (2024-04-20)


### Bug Fixes

* **deps:** update dependency @typegoose/auto-increment to v4.3.0 ([#1614](https://github.com/mx-space/core/issues/1614)) ([ab4cf31](https://github.com/mx-space/core/commit/ab4cf3123981d6f1c7709710131e644042adde67))
* logger ([e66e49a](https://github.com/mx-space/core/commit/e66e49a72fe02b4344d7dc107ec82c57e526e184))
* s3 region ([e18ce0d](https://github.com/mx-space/core/commit/e18ce0d5a597bc835b5716bf499f087ff8e86c52))


### Features

* backup support s3 ([9dc3fbd](https://github.com/mx-space/core/commit/9dc3fbd15a338a0ff7166b81c702cf33cfa72dcc))

## [5.5.4](https://github.com/mx-space/core/compare/v5.5.3...v5.5.4) (2024-04-20)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.15 ([c9971a9](https://github.com/mx-space/core/commit/c9971a990a1ec9c9460f9458011b588e27422c92))
* **deps:** update dependency marked to v12.0.2 ([abe48df](https://github.com/mx-space/core/commit/abe48dfb6c4dc76dd0c85e5895f5d65970650686))
* **deps:** update nest monorepo to v10.3.8 ([8e56dcd](https://github.com/mx-space/core/commit/8e56dcd8e96af30b325db64be2ad710adaf16fd3))
* setup route jump [#1619](https://github.com/mx-space/core/issues/1619) ([e24b70d](https://github.com/mx-space/core/commit/e24b70dd04b8f85d9492526d53c293a35a0258e1))

## [5.5.3](https://github.com/mx-space/core/compare/v5.5.2...v5.5.3) (2024-04-17)


### Bug Fixes

* **activity:** filter comment state ([73abe9c](https://github.com/mx-space/core/commit/73abe9c1afec625605a227c614e55cff5cdee6d3))
* check activity ref type ([9c89987](https://github.com/mx-space/core/commit/9c899870fd81aa2041019d91e52eaf6bf210e25a))
* comment filter ([ec58221](https://github.com/mx-space/core/commit/ec58221ee66d8b2595c5dd9b1c65fbc8cd75782d))

## [5.5.2](https://github.com/mx-space/core/compare/v5.5.1...v5.5.2) (2024-04-17)


### Bug Fixes

* **deps:** update dependency @nestjs/schedule to v4.0.2 ([debacce](https://github.com/mx-space/core/commit/debacce20abf941341ac6b1b680b1d97da31236b))
* **deps:** update dependency @typegoose/typegoose to v12.3.1 ([fb39902](https://github.com/mx-space/core/commit/fb39902096d509484e72e96578ad7de65d799b39))
* **deps:** update dependency mongoose to v8.3.2 ([17e796f](https://github.com/mx-space/core/commit/17e796f7bafb41008735458c820df035d900f4c7))
* filter hide note ([29e3ba5](https://github.com/mx-space/core/commit/29e3ba595256b9676e7fe3ade8be406e6dacd203))
* user collection name ([85ca2f6](https://github.com/mx-space/core/commit/85ca2f64b4deccc7f2ac86e6e69c6a6d49b864fc))

## [5.5.1](https://github.com/mx-space/core/compare/v5.5.0...v5.5.1) (2024-04-14)


### Features

* add recent notification api ([1111b96](https://github.com/mx-space/core/commit/1111b96013124d637d3e5c9524f2dc2b19032675))

# [5.5.0](https://github.com/mx-space/core/compare/v5.4.10...v5.5.0) (2024-04-13)


### Bug Fixes

* add some field ([903aa30](https://github.com/mx-space/core/commit/903aa3012231b9445692688ac259e9d4ec5f02c6))
* **deps:** update dependency ejs to v3.1.10 ([0963d50](https://github.com/mx-space/core/commit/0963d50b9ec5fdf814866913cd3ad8874fc55b37))
* **deps:** update dependency qs to v6.12.1 ([8d170ed](https://github.com/mx-space/core/commit/8d170ed13e393766c10ec22fdf66bb22b6a6c6bb))


### Features

* add recent activity api ([b4726ad](https://github.com/mx-space/core/commit/b4726adfd80a9b229d48d027bc0a1ba3b69c80ee))

## [5.4.10](https://github.com/mx-space/core/compare/v5.4.9...v5.4.10) (2024-04-11)


### Bug Fixes

* add `hide` for note list api ([5a2b2de](https://github.com/mx-space/core/commit/5a2b2debc433051ad7b9d646b368450bdee59560))

## [5.4.9](https://github.com/mx-space/core/compare/v5.4.8...v5.4.9) (2024-04-11)


### Bug Fixes

* **deps:** update algoliasearch-client-javascript monorepo to v4.23.3 ([39bb8ce](https://github.com/mx-space/core/commit/39bb8ce5b90bb44b43fa07a5fb390b1c2d5c691c))
* **deps:** update dependency @typegoose/typegoose to v12.3.0 ([#1601](https://github.com/mx-space/core/issues/1601)) ([a77bb04](https://github.com/mx-space/core/commit/a77bb045c665c264202395f6d8c0871f68fc7aa8))
* skip cache if request is authenticated ([70d9b69](https://github.com/mx-space/core/commit/70d9b6916b53f613a1f639e6b40b819594c4dc41))

## [5.4.8](https://github.com/mx-space/core/compare/v5.4.7...v5.4.8) (2024-04-11)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.14 ([70b76c7](https://github.com/mx-space/core/commit/70b76c7c6f7f61a2adceb4501f3daca41cb15854))
* **deps:** update dependency mongoose to v8.3.1 ([a433fc5](https://github.com/mx-space/core/commit/a433fc5ec8d1c5cc1bb3c285935ef5a769f793a2))
* server time response ([ac918dc](https://github.com/mx-space/core/commit/ac918dc8e71b677c02aa804d49cb75e634556004))

## [5.4.7](https://github.com/mx-space/core/compare/v5.4.6...v5.4.7) (2024-04-06)


### Bug Fixes

* downgrade snakecase ([f3a0d06](https://github.com/mx-space/core/commit/f3a0d063ad4ed44e5fb443aa8d5f52a6450652d2))

## [5.4.6](https://github.com/mx-space/core/compare/v5.4.5...v5.4.6) (2024-04-06)


### Bug Fixes

* **deps:** update babel monorepo to v7.24.4 ([6a9e78b](https://github.com/mx-space/core/commit/6a9e78b6e63e90cb6bf5d5ad074833541dc5333b))
* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.13 ([0288c79](https://github.com/mx-space/core/commit/0288c79d2afac1ada8646abfa6c979e6f379a1ed))
* **deps:** update dependency @fastify/static to v7.0.3 ([12da98f](https://github.com/mx-space/core/commit/12da98f55ed3dbc53ec6e4b87926154a548e2710))
* **deps:** update dependency cache-manager to v5.5.0 ([#1594](https://github.com/mx-space/core/issues/1594)) ([e1e6cdb](https://github.com/mx-space/core/commit/e1e6cdb38b929daaa91fceeb6a4b83128dd8fa08))
* **deps:** update dependency cache-manager to v5.5.1 ([9bdce4b](https://github.com/mx-space/core/commit/9bdce4b7721665cad56f7649fc5fb1808693fa05))
* **deps:** update dependency cache-manager-ioredis-yet to v2.0.3 ([0e41674](https://github.com/mx-space/core/commit/0e416743fa6535fdf7c2316477df1c53a494bb35))
* **deps:** update dependency mongoose to v8.3.0 ([#1588](https://github.com/mx-space/core/issues/1588)) ([2207510](https://github.com/mx-space/core/commit/2207510590b34a3156d4f92222579e8f9e3b54fb))
* **deps:** update dependency snakecase-keys to v7 ([#1566](https://github.com/mx-space/core/issues/1566)) ([69cd144](https://github.com/mx-space/core/commit/69cd144b1d09c7abd8c574d007df2623954a814f))
* update test snap ([45ae1f8](https://github.com/mx-space/core/commit/45ae1f88e86a547619cd8b2743ac1b6e9a5248f7))


### Features

* **markdown:** export with meta json ([ef4d639](https://github.com/mx-space/core/commit/ef4d639d2fcd62fc050ce0c021f18bb4bc50cfca))

## [5.4.5](https://github.com/mx-space/core/compare/v5.4.4...v5.4.5) (2024-04-03)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.12 ([f2e9a5b](https://github.com/mx-space/core/commit/f2e9a5b9f8a404b93c4f5b401f63ce34811db552))
* **deps:** update dependency @fastify/static to v7.0.2 ([0ad5a14](https://github.com/mx-space/core/commit/0ad5a1437699a66686e96ffa9fbbf06b91da79e1))
* **deps:** update dependency isbot to v5.1.3 ([d9f92b8](https://github.com/mx-space/core/commit/d9f92b85dea7044b81aad6118a27e8f6902bcf6a))
* **deps:** update dependency isbot to v5.1.4 ([ec8c62a](https://github.com/mx-space/core/commit/ec8c62ad35863451408ddcd46714bcdda14ff4f6))


### Features

* add get one recently api ([97f10b4](https://github.com/mx-space/core/commit/97f10b4a1d1e4cd5072cd4529afbec56f8fdba27))

## [5.4.4](https://github.com/mx-space/core/compare/v5.4.3...v5.4.4) (2024-03-29)


### Bug Fixes

* server time cors ([fd121cc](https://github.com/mx-space/core/commit/fd121cccc6743275f4aa541c05f85824cca95263))

## [5.4.3](https://github.com/mx-space/core/compare/v5.4.2...v5.4.3) (2024-03-29)


### Bug Fixes

* **deps:** update dependency mongoose to v8.2.4 ([ef58bcf](https://github.com/mx-space/core/commit/ef58bcfd93ea7b6d1369bc588e622d0dbbdbfd8a))
* **deps:** update dependency reflect-metadata to v0.2.2 ([6c174f5](https://github.com/mx-space/core/commit/6c174f5da6fd4ae9c6a1905db62eed1e1e4afe33))

## [5.4.2](https://github.com/mx-space/core/compare/v5.4.1...v5.4.2) (2024-03-28)


### Bug Fixes

* bypass presence data morph ([04264c1](https://github.com/mx-space/core/commit/04264c13f25f11eeb31a6de6431b2e0ae896a838))
* **deps:** update algoliasearch-client-javascript monorepo to v4.23.2 ([#1568](https://github.com/mx-space/core/issues/1568)) ([0b06eb6](https://github.com/mx-space/core/commit/0b06eb6ad576afc0046b7cf05f3d8946a46ec225))
* **deps:** update nest monorepo to v10.3.6 (patch) ([#1569](https://github.com/mx-space/core/issues/1569)) ([9d602ce](https://github.com/mx-space/core/commit/9d602ce13023e731eeb905bd3343312e85b11ba0))
* **deps:** update nest monorepo to v10.3.7 (patch) ([#1570](https://github.com/mx-space/core/issues/1570)) ([91693d1](https://github.com/mx-space/core/commit/91693d15c56f79f45d06e277fe08d54e450a1709))

## [5.4.1](https://github.com/mx-space/core/compare/v5.4.0...v5.4.1) (2024-03-27)


### Bug Fixes

* **deps:** update dependency @nestjs/cache-manager to v2.2.2 ([ba0c673](https://github.com/mx-space/core/commit/ba0c673aa23bcf04be3f00b1d0aa699631bb78b8))
* **deps:** update dependency linkedom to v0.16.11 ([30a425e](https://github.com/mx-space/core/commit/30a425e135ba37718b958ec5ce17b641fca00024))
* join room at ([4917076](https://github.com/mx-space/core/commit/49170766ad4969bae33d6ead3a01fbb4f20172a8))

# [5.4.0](https://github.com/mx-space/core/compare/v5.3.4...v5.4.0) (2024-03-24)


### Features

* pass `isAuthenticated` to function call ([74ddc15](https://github.com/mx-space/core/commit/74ddc1504e99c107eb167dce259ba843d0a061cf))

## [5.3.4](https://github.com/mx-space/core/compare/v5.3.3...v5.3.4) (2024-03-24)

## [5.3.3](https://github.com/mx-space/core/compare/v5.3.2...v5.3.3) (2024-03-23)


### Bug Fixes

* **deps:** update dependency @babel/core to v7.24.3 ([05c5736](https://github.com/mx-space/core/commit/05c5736345a2825c5f7257eaa91efbe95596f0a1))
* **deps:** update dependency @fastify/multipart to v8.2.0 ([#1556](https://github.com/mx-space/core/issues/1556)) ([cae212f](https://github.com/mx-space/core/commit/cae212f24a9f271792df5ac02a0aa681bf75eac6))
* **deps:** update dependency axios-retry to v4.1.0 ([#1550](https://github.com/mx-space/core/issues/1550)) ([a25e02a](https://github.com/mx-space/core/commit/a25e02ac6ae5aa933750c94a343ce7d66bfa7b70))
* **deps:** update dependency mongoose to v8.2.3 ([9537402](https://github.com/mx-space/core/commit/953740202a8cb339e75a6d056ae353271f2d98cc))
* **deps:** update dependency nodemailer to v6.9.13 ([fddb6e8](https://github.com/mx-space/core/commit/fddb6e89a542dd7830b6cd8c111cab0a8d7decaa))
* **deps:** update nest monorepo to v10.3.5 ([3f0a330](https://github.com/mx-space/core/commit/3f0a3301124362af4c829626a14bb340caf93820))
* serverless update ([4776de6](https://github.com/mx-space/core/commit/4776de6bbea13debfa87f5ba16b25550fddd333f))


### Features

* add other filed for search service ([8cc2d8f](https://github.com/mx-space/core/commit/8cc2d8fdf50251dee15a3a4c7a04edb18bca54db))

## [5.3.2](https://github.com/mx-space/core/compare/v5.3.1...v5.3.2) (2024-03-19)


### Bug Fixes

* **deps:** update dependency isbot to v5.1.2 ([10aed09](https://github.com/mx-space/core/commit/10aed095bae17bea0f8e45762a911a29c151fbd9))
* **deps:** update nest monorepo to v10.3.4 (patch) ([#1544](https://github.com/mx-space/core/issues/1544)) ([c37ca86](https://github.com/mx-space/core/commit/c37ca86e9ae477d712843bb7fb2713860d6c3ab7))
* remove only boardcast gateway room in post and note ([2e0c919](https://github.com/mx-space/core/commit/2e0c919de4e8fd6d8de664ed951c27d7680fe133))

## [5.3.1](https://github.com/mx-space/core/compare/v5.3.0...v5.3.1) (2024-03-18)


### Bug Fixes

* downgrade vitest ([46a098c](https://github.com/mx-space/core/commit/46a098c7bff09780b4da323004624b372198d981))

# [5.3.0](https://github.com/mx-space/core/compare/v5.2.2...v5.3.0) (2024-03-18)


### Bug Fixes

* **deps:** update dependency linkedom to v0.16.10 ([50a9ca1](https://github.com/mx-space/core/commit/50a9ca1f0a902d4a88273a81d8be3f58afe56292))
* **deps:** update dependency mongoose to v8.2.2 ([6795295](https://github.com/mx-space/core/commit/6795295fec14522589dcc2154d6be6fd2bae4fa1))


### Features

* ws type read cunt ([310480f](https://github.com/mx-space/core/commit/310480f7b48d6460728a12a847575edd350c10c5))

## [5.2.2](https://github.com/mx-space/core/compare/v5.2.1...v5.2.2) (2024-03-14)


### Bug Fixes

* **deps:** update dependency cache-manager-ioredis-yet to v2.0.2 ([52066c1](https://github.com/mx-space/core/commit/52066c1c6d518dd6e69560995088da2a497e8183))
* **deps:** update dependency linkedom to v0.16.9 ([11b74be](https://github.com/mx-space/core/commit/11b74be56a847c4fa55105a28bcaf6dc5a7444d5))

## [5.2.1](https://github.com/mx-space/core/compare/v5.2.0...v5.2.1) (2024-03-12)

# [5.2.0](https://github.com/mx-space/core/compare/v5.1.6...v5.2.0) (2024-03-10)


### Bug Fixes

* add cache header ([f0640cd](https://github.com/mx-space/core/commit/f0640cd97157004f17e35fa4c341596be314739d))
* **deps:** update dependency cache-manager-ioredis-yet to v2.0.1 ([747a12a](https://github.com/mx-space/core/commit/747a12a8796964ee815cb6750ae5caf2f74793d6))
* **deps:** update dependency marked to v12.0.1 ([12bd435](https://github.com/mx-space/core/commit/12bd4355c17b06366cf48694d1b8815f83396ffb))
* **deps:** update dependency mongoose-lean-getters to v2 ([#1517](https://github.com/mx-space/core/issues/1517)) ([34db0a6](https://github.com/mx-space/core/commit/34db0a6abba6e425bf3e83d62639843ff3756a3a))
* **deps:** update dependency nodemailer to v6.9.12 ([4d4df4c](https://github.com/mx-space/core/commit/4d4df4ccceb7652567b368e0c7637622ca568771))
* **deps:** update dependency qs to v6.12.0 ([#1514](https://github.com/mx-space/core/issues/1514)) ([401f650](https://github.com/mx-space/core/commit/401f650288e1a22b8b021121d4cb2135e86827e4))

## [5.1.6](https://github.com/mx-space/core/compare/v5.1.5...v5.1.6) (2024-03-05)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.11 ([dcdfb59](https://github.com/mx-space/core/commit/dcdfb595d86b8f84ce1506bbc8fab696d3149897))
* **deps:** update dependency @typegoose/auto-increment to v4.2.0 ([#1484](https://github.com/mx-space/core/issues/1484)) ([40b2100](https://github.com/mx-space/core/commit/40b2100befbd9a87dc29472dd28964b03f39a139))
* **deps:** update dependency @typegoose/typegoose to v12.2.0 ([#1485](https://github.com/mx-space/core/issues/1485)) ([e3334ef](https://github.com/mx-space/core/commit/e3334ef674eb10067a5acd2332cbea964b135eab))
* **deps:** update dependency cache-manager-ioredis-yet to v2 ([#1504](https://github.com/mx-space/core/issues/1504)) ([f64dff0](https://github.com/mx-space/core/commit/f64dff013a98f1b48db063bce0ce161a04583c60))
* **deps:** update dependency mongoose to v8.2.1 ([ca344a8](https://github.com/mx-space/core/commit/ca344a8f5288807525e1c605cc413555a71eb033))
* **deps:** update dependency nodemailer to v6.9.11 ([dae4ef7](https://github.com/mx-space/core/commit/dae4ef7cc1423dc9d5aa76aca8e865355661fd14))
* **deps:** update dependency xss to v1.0.15 ([959c4aa](https://github.com/mx-space/core/commit/959c4aa75c0805786c6133d21a2d7899aa7753f4))

## [5.1.5](https://github.com/mx-space/core/compare/v5.1.4...v5.1.5) (2024-02-29)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.10 ([e55797c](https://github.com/mx-space/core/commit/e55797c9819dc678dee4d8f7c1834e4e360808f5))
* **deps:** update dependency @types/jsonwebtoken to v9.0.6 ([3481b50](https://github.com/mx-space/core/commit/3481b5008ee9e0bcd1da179c908f23e3ba3dd92a))
* **deps:** update dependency isbot to v5.1.1 ([db3ab52](https://github.com/mx-space/core/commit/db3ab5204c6a78eaeac0c078aea8f2375cb695f8))
* **deps:** update dependency mongoose to v8.2.0 ([#1483](https://github.com/mx-space/core/issues/1483)) ([62c6855](https://github.com/mx-space/core/commit/62c6855a2a180a0731819fde90357f2c3216fd7e))
* **deps:** update dependency nodemailer to v6.9.10 ([b9b5119](https://github.com/mx-space/core/commit/b9b511919ba17350e05ce2cd770c0a84603ee61a))
* **deps:** update dependency wildcard-match to v5.1.3 ([1218d7a](https://github.com/mx-space/core/commit/1218d7ab131aee1f0e638bbeee884ac11f0cfaee))
* log ([a142e8b](https://github.com/mx-space/core/commit/a142e8b2011c1e097cefd76f92f11d1a3242d183))

## [5.1.4](https://github.com/mx-space/core/compare/v5.1.3...v5.1.4) (2024-02-22)


### Bug Fixes

* remove ws guard ([147441c](https://github.com/mx-space/core/commit/147441c2c99b163106c5fd02f0433510d1cea1b9))

## [5.1.3](https://github.com/mx-space/core/compare/v5.1.2...v5.1.3) (2024-02-22)


### Bug Fixes

* activity ref type transform to lower case ([6342257](https://github.com/mx-space/core/commit/634225775bcdb8ae7281be2ca6005f2a2e6efa63))

## [5.1.2](https://github.com/mx-space/core/compare/v5.1.1...v5.1.2) (2024-02-21)


### Bug Fixes

* api injection ([9d095fb](https://github.com/mx-space/core/commit/9d095fbbd1b6f16faf8fa54c7832a1daa6fe1bbe))
* throttle ip tracker ([c82cb8f](https://github.com/mx-space/core/commit/c82cb8ff54dc7b98bc411e03de81ede932aa612b))

## [5.1.1](https://github.com/mx-space/core/compare/v5.1.0...v5.1.1) (2024-02-21)


### Bug Fixes

* refType of recentlies fixes [#1478](https://github.com/mx-space/core/issues/1478) ([b487b3a](https://github.com/mx-space/core/commit/b487b3af87dc5ed06ba2958a94d52be728671a93))

# [5.1.0](https://github.com/mx-space/core/compare/v5.0.1...v5.1.0) (2024-02-20)


### Bug Fixes

* **deps:** update dependency mongoose to v8.1.3 ([e84be0c](https://github.com/mx-space/core/commit/e84be0c6f764246ba041b3a9a470e1abe084102f))
* remove wating if 427 and add query parameters to getReadingRangeRank ([2ce68aa](https://github.com/mx-space/core/commit/2ce68aa99d995814efec1b7eadf4bbddcd5cae37))
* test ([4b3c858](https://github.com/mx-space/core/commit/4b3c858739e80d51fb01eb05737fbd68bccfda97))
* test case ([6ed5e40](https://github.com/mx-space/core/commit/6ed5e40fa197c74dc4c8295cd5afb08cf32fb1c8))
* un-limit upload size for backup service ([601a3dd](https://github.com/mx-space/core/commit/601a3dd69151336f715ab05e5948d4fe5dfc6b3f))


### Features

* reading rank ([029b47c](https://github.com/mx-space/core/commit/029b47c988e77941937d336a751ec8be4ee8520b))

## [5.0.1](https://github.com/mx-space/core/compare/v5.0.0...v5.0.1) (2024-02-17)


### Bug Fixes

* comment model with ip fixes [#1473](https://github.com/mx-space/core/issues/1473) ([f11ccb9](https://github.com/mx-space/core/commit/f11ccb9a3694fcbb511f88d7061da46f06de87e5))
* **deps:** update dependency @simplewebauthn/server to v9.0.3 ([84f9b2b](https://github.com/mx-space/core/commit/84f9b2b477ccea7124f1305b1fcda0a90197782d))

# [5.0.0](https://github.com/mx-space/core/compare/v5.0.0-beta.2...v5.0.0) (2024-02-16)

# [5.0.0-beta.2](https://github.com/mx-space/core/compare/v5.0.0-beta.1...v5.0.0-beta.2) (2024-02-16)


### Bug Fixes

* activity duration calculation ([ced3852](https://github.com/mx-space/core/commit/ced3852d3e0a25df6d78b0454f4c1ad542c34c87))
* broadcast event add `joinedAt` ([d1704d8](https://github.com/mx-space/core/commit/d1704d8450462ef9645c6f4f19a4f69d9e5d5cd0))

# [5.0.0-beta.1](https://github.com/mx-space/core/compare/v5.0.0-beta.0...v5.0.0-beta.1) (2024-02-15)

# [5.0.0-beta.0](https://github.com/mx-space/core/compare/v5.0.0-alpha.4...v5.0.0-beta.0) (2024-02-15)


### Bug Fixes

* ipv6 ([3dff3df](https://github.com/mx-space/core/commit/3dff3df74b8c3e15b6766b5fab3ba929cefff786))
* migration ([6d4254d](https://github.com/mx-space/core/commit/6d4254dd5bdfa56c350a39eda580711e106fa5c0))

# [5.0.0-alpha.4](https://github.com/mx-space/core/compare/v5.0.0-alpha.3...v5.0.0-alpha.4) (2024-02-14)


### Features

* add api sdk for this ([4683b69](https://github.com/mx-space/core/commit/4683b697ce41c287736b007d653f1b13dd783e7f))
* add get rooms ([cf71fc4](https://github.com/mx-space/core/commit/cf71fc4f43d75557109c7672d801e4eb0602e5b6))

# [5.0.0-alpha.3](https://github.com/mx-space/core/compare/v5.0.0-alpha.2...v5.0.0-alpha.3) (2024-02-13)


### Bug Fixes

* add real ip for cf ([057a232](https://github.com/mx-space/core/commit/057a23291580dd895d32a1155052c42e34e6a8b4))

# [5.0.0-alpha.2](https://github.com/mx-space/core/compare/v5.0.0-alpha.1...v5.0.0-alpha.2) (2024-02-13)


### Bug Fixes

* **deps:** update dependency mongoose to v8.1.2 ([6844bd7](https://github.com/mx-space/core/commit/6844bd78276e3cf1c29c3cf77d79d8f1ca5b77bc))
* **deps:** update nest monorepo to v10.3.3 ([a913599](https://github.com/mx-space/core/commit/a9135993e1634d06ace5f99212ba64d54bf0d224))


### Features

* add bark push for cc ([76002c3](https://github.com/mx-space/core/commit/76002c3f24a396faa035128e92fcee122d62f261))

# [5.0.0-alpha.1](https://github.com/mx-space/core/compare/v5.0.0-alpha.0...v5.0.0-alpha.1) (2024-02-12)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.9 ([10865eb](https://github.com/mx-space/core/commit/10865ebc0d1b5fe0b587e0d3f31e0c9e209afa46))
* **deps:** update dependency @fastify/static to v7.0.1 ([6c4d182](https://github.com/mx-space/core/commit/6c4d182b580ca31f123ce322ee8166de3d2fd86a))
* **deps:** update dependency @nestjs/cache-manager to v2.2.1 ([d84282a](https://github.com/mx-space/core/commit/d84282adfe7dcff846ccecce455df2f9b9eec7fb))
* **deps:** update dependency @nestjs/event-emitter to v2.0.4 ([5af713b](https://github.com/mx-space/core/commit/5af713b8fd6cadd4d56a9021e8dab2af9c30db46))
* **deps:** update dependency @nestjs/schedule to v4.0.1 ([f7d5ed6](https://github.com/mx-space/core/commit/f7d5ed617537ff059ffe8dca8e488afae0b5a3c7))
* **deps:** update dependency @nestjs/throttler to v5.1.2 ([6812c20](https://github.com/mx-space/core/commit/6812c205a84c47126cac5ebc544daf777daa2dbc))
* **deps:** update dependency @simplewebauthn/server to v9.0.2 ([dc169f1](https://github.com/mx-space/core/commit/dc169f15b1bd4dac0ded887bc8b6f1c8c52a8639))
* **deps:** update nest monorepo ([6f32af9](https://github.com/mx-space/core/commit/6f32af9ba4a69e41c2cd7a445ed0a66f5ef144d0))
* init project script ([83441f1](https://github.com/mx-space/core/commit/83441f1d3ea330235814f08376b15fd1446d1980))


### Features

* add activity type ([0cd84e7](https://github.com/mx-space/core/commit/0cd84e7f9c5d314bedcaa64d3c7bb391f7734828))
* file trash ([ed6eeb2](https://github.com/mx-space/core/commit/ed6eeb2b3762a59872b6a1f128a55d9d4137a5a3))
* support socket room and add activity presence ([#1445](https://github.com/mx-space/core/issues/1445)) ([267632b](https://github.com/mx-space/core/commit/267632be94df24a07c0b64dbcd85a53569866225))

# [5.0.0-alpha.0](https://github.com/mx-space/core/compare/v4.11.8...v5.0.0-alpha.0) (2024-02-07)


### Bug Fixes

* **deps:** update dependency nestjs-pretty-logger to v0.2.1 ([9addf45](https://github.com/mx-space/core/commit/9addf450c4d91a7e3236580bbe5956992a4a6984))


### Performance Improvements

* reduce memory usage ([#1436](https://github.com/mx-space/core/issues/1436)) ([ed11374](https://github.com/mx-space/core/commit/ed11374a975d26bb680eb9a8069cd97c1f6325a1))

## [4.11.8](https://github.com/mx-space/core/compare/v4.11.7...v4.11.8) (2024-02-06)


### Bug Fixes

* remove `env` expose ([a36d488](https://github.com/mx-space/core/commit/a36d4885c60b9b2a03a09fe1769b59bda4f32177))

## [4.11.7](https://github.com/mx-space/core/compare/v4.11.6...v4.11.7) (2024-02-06)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.8 ([#1428](https://github.com/mx-space/core/issues/1428)) ([9d3fe47](https://github.com/mx-space/core/commit/9d3fe47da5fcba1f2eb2af7076f33d9fb0c9e846))
* secret getter ([351cbfd](https://github.com/mx-space/core/commit/351cbfdb098a667f8ddce73ba5a34eb3de8af422))
* skip throttler guard if authed ([0dbe9c2](https://github.com/mx-space/core/commit/0dbe9c25d6449361084d8107fb7b227c25fe72f3))

## [4.11.6](https://github.com/mx-space/core/compare/v4.11.5...v4.11.6) (2024-02-04)


### Bug Fixes

* compress search index data size keep less than 100K ([6718f8e](https://github.com/mx-space/core/commit/6718f8edd0d3e0f99f7225cb1972b2586e93d11b))
* update ([f055fea](https://github.com/mx-space/core/commit/f055fea95704f1127447ace832f9aab31d532202))


### Features

* adjustObjectSizeEfficiently function to accept a generic type ([8491ebd](https://github.com/mx-space/core/commit/8491ebdab1f019fd6364c4d4136c27c259f13cca))
* use EJS rendering for local-dev page ([bbb0e22](https://github.com/mx-space/core/commit/bbb0e22ca89180e7268dd9f5631c480fae1557f0))

## [4.11.5](https://github.com/mx-space/core/compare/v4.11.4...v4.11.5) (2024-02-04)


### Bug Fixes

* **deps:** update dependency @fastify/static to v7 ([#1422](https://github.com/mx-space/core/issues/1422)) ([b0a65ca](https://github.com/mx-space/core/commit/b0a65cac22c303782569f95bddd9ff59c4dbf79f))
* **deps:** update dependency marked to v12 ([#1424](https://github.com/mx-space/core/issues/1424)) ([97c1e6e](https://github.com/mx-space/core/commit/97c1e6eae2734a3e01d4085c02c288c4e6fd52c1))


### Features

* Add SlugTrackerModule to support if the post slug changes, redirect to original data to keep their permalink ([#1425](https://github.com/mx-space/core/issues/1425)) ([00e7508](https://github.com/mx-space/core/commit/00e7508fe51e171d15001075f815f0807c93ab12))

## [4.11.4](https://github.com/mx-space/core/compare/v4.11.3...v4.11.4) (2024-02-03)


### Features

* manually trigger algolia search index update ([d094272](https://github.com/mx-space/core/commit/d0942725bdab9fd8d5ddbdc29ddaa19501d25518))

## [4.11.3](https://github.com/mx-space/core/compare/v4.11.2...v4.11.3) (2024-02-02)

## [4.11.2](https://github.com/mx-space/core/compare/v4.11.1...v4.11.2) (2024-02-02)


### Bug Fixes

* add validation for encrypt key length ([ed40949](https://github.com/mx-space/core/commit/ed40949e3c3e45002967672c7e067ce30f4ea163))
* **deps:** update dependency nodemailer to v6.9.9 ([0eb09ef](https://github.com/mx-space/core/commit/0eb09efa2d1d6897fb7b726daaa1c04e341a6569))


### Features

* add Algolia search functionality and event listeners ([31b1ba8](https://github.com/mx-space/core/commit/31b1ba8a678e5015a934efcfff2c4bcbc91918ae))
* add local dev dashboard debug option ([64cddf1](https://github.com/mx-space/core/commit/64cddf127a0180ce31977c7fadc2967adb499344))

## [4.11.1](https://github.com/mx-space/core/compare/v4.11.0...v4.11.1) (2024-01-31)


### Bug Fixes

* add Logger instance to the global scope ([c4a27cc](https://github.com/mx-space/core/commit/c4a27cc25a9126cfc74b11a49e539cae9b469880))
* search service to use replaceAllObjects method ([00964c3](https://github.com/mx-space/core/commit/00964c3822daef29de5a97f0ed0a43e639735dc8))

# [4.11.0](https://github.com/mx-space/core/compare/v4.10.9...v4.11.0) (2024-01-31)


### Bug Fixes

* Remove unused code and update create method in PostController ([5f9e69f](https://github.com/mx-space/core/commit/5f9e69fabbdf5fb20a2027f9e9fbb38ff55f1ef2))
* session revoke ([2bfc745](https://github.com/mx-space/core/commit/2bfc745bf5f2e07f74d59b58f0ca136ec7ea49a1))

## [4.10.9](https://github.com/mx-space/core/compare/v4.10.8...v4.10.9) (2024-01-29)


### Bug Fixes

* **deps:** update babel monorepo to v7.23.9 ([e61459f](https://github.com/mx-space/core/commit/e61459f7655153facc2a29965e27131dfef3ea05))
* **deps:** update dependency @simplewebauthn/server to v9 ([#1387](https://github.com/mx-space/core/issues/1387)) ([54fbfe1](https://github.com/mx-space/core/commit/54fbfe15018b0f4914c2891353f96dc942c4e3dc))
* **deps:** update dependency linkedom to v0.16.8 ([130d110](https://github.com/mx-space/core/commit/130d110aa221247e46c01720967dd5c6aef3ecbb))
* **deps:** update dependency lru-cache to v10.2.0 ([#1397](https://github.com/mx-space/core/issues/1397)) ([6ae866d](https://github.com/mx-space/core/commit/6ae866dcf648b70d9ae3f5993e1647e74e076be4))
* **deps:** update dependency marked to v11.2.0 ([#1399](https://github.com/mx-space/core/issues/1399)) ([ea6e60e](https://github.com/mx-space/core/commit/ea6e60e8bf2e41ef1a382bc8a326211f06ba5a14))
* **deps:** update dependency mongoose to v8.1.1 ([73cf344](https://github.com/mx-space/core/commit/73cf344c8dae6bb98b0a8c2046bd4fce18baada6))
* **deps:** update nest monorepo to v10.3.1 ([c33941e](https://github.com/mx-space/core/commit/c33941e7fceace1c10a748053ba78656a72e56d8))
* set `CBOR_NATIVE_ACCELERATION_DISABLED` to `true` ([e1163cd](https://github.com/mx-space/core/commit/e1163cdac0e2a56e7b9b9886c60e3a7b069d1c2e))

## [4.10.8](https://github.com/mx-space/core/compare/v4.10.7...v4.10.8) (2024-01-21)


### Bug Fixes

* **deps:** update dependency @simplewebauthn/server to v8.3.7 ([63f7978](https://github.com/mx-space/core/commit/63f797877fced35872fc188b44e2996102379f45))
* **deps:** update dependency cache-manager to v5.4.0 ([#1382](https://github.com/mx-space/core/issues/1382)) ([5eb49de](https://github.com/mx-space/core/commit/5eb49de19a888d3dadabd9e788561e2184a65b59))
* ip function error "[object Object]" ([#1385](https://github.com/mx-space/core/issues/1385)) ([28d3239](https://github.com/mx-space/core/commit/28d3239bf2570e8f81420e44bff25b3c567af1a1))

## [4.10.7](https://github.com/mx-space/core/compare/v4.10.6...v4.10.7) (2024-01-19)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.7 ([8a544b9](https://github.com/mx-space/core/commit/8a544b9bdb7e53baee4f3d49653f89d46fc0ca64))
* **deps:** update dependency @fastify/cookie to v9.3.1 ([550d4ec](https://github.com/mx-space/core/commit/550d4ec3da5071cbb13d31afffebababaea2ebd7))
* **deps:** update dependency @typegoose/auto-increment to v4.1.0 ([#1373](https://github.com/mx-space/core/issues/1373)) ([b5c5520](https://github.com/mx-space/core/commit/b5c552086a96a599e08a305d656e1feb334a7443))
* **deps:** update dependency snakecase-keys to v6 ([#1377](https://github.com/mx-space/core/issues/1377)) ([9af88a3](https://github.com/mx-space/core/commit/9af88a38b141f3e2e32befc55304448ed6e0d8c3))

## [4.10.6](https://github.com/mx-space/core/compare/v4.10.5...v4.10.6) (2024-01-18)


### Bug Fixes

* **deps:** update dependency @fastify/cookie to v9.3.0 ([#1363](https://github.com/mx-space/core/issues/1363)) ([2b100cd](https://github.com/mx-space/core/commit/2b100cd0379a74ce97a93fdb67ae4ab49a3c70b1))
* sitemap data ([c10f089](https://github.com/mx-space/core/commit/c10f0899f96ddf61e4614ae3bfa97e600961191c))


### Features

* unsubscribe header for mail ([b28de23](https://github.com/mx-space/core/commit/b28de239739369c1d4475ba7df8235e900bbf31a))

## [4.10.5](https://github.com/mx-space/core/compare/v4.10.4...v4.10.5) (2024-01-14)

## [4.10.4](https://github.com/mx-space/core/compare/v4.10.3...v4.10.4) (2024-01-14)


### Bug Fixes

* axios http ([0c18317](https://github.com/mx-space/core/commit/0c18317fc1ed6bc9ae2623081d8b68ee4e314f52))
* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.6 ([cd61cdb](https://github.com/mx-space/core/commit/cd61cdbbf6afa81efe3538cd4631edfc4aaeda36))
* **deps:** update dependency @nestjs/cache-manager to v2.2.0 ([#1351](https://github.com/mx-space/core/issues/1351)) ([b91263a](https://github.com/mx-space/core/commit/b91263a1fb1f6bd245cb4f2297579cc3539775b6))

## [4.10.3](https://github.com/mx-space/core/compare/v4.10.2...v4.10.3) (2024-01-10)


### Bug Fixes

* add 301 status when redirect ([775835f](https://github.com/mx-space/core/commit/775835f20bbad491245a5e63b9eedfc168e4c11b))

## [4.10.2](https://github.com/mx-space/core/compare/v4.10.1...v4.10.2) (2024-01-10)


### Bug Fixes

* **deps:** update algoliasearch-client-javascript monorepo to v4.22.1 ([b5040da](https://github.com/mx-space/core/commit/b5040daa38de7ee1325e9f2ebd1274d6473ae363))
* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.5 ([ef6e04b](https://github.com/mx-space/core/commit/ef6e04b7169479a623c5418360418ffa4dd5461a))
* **deps:** update dependency mongoose to v8.0.4 ([#1355](https://github.com/mx-space/core/issues/1355)) ([d03f413](https://github.com/mx-space/core/commit/d03f413f5b7283dba884ad0da48e2c08e84d082c))


### Features

* add `redirect` on url builder ([bdd6de5](https://github.com/mx-space/core/commit/bdd6de5913eae1cefc439c56f17b9714ff96324a))

## [4.10.1](https://github.com/mx-space/core/compare/v4.10.0...v4.10.1) (2024-01-07)


### Bug Fixes

* **deps:** update dependency @fastify/multipart to v8.1.0 ([#1343](https://github.com/mx-space/core/issues/1343)) ([17d3286](https://github.com/mx-space/core/commit/17d32862d32a9311f1891032bdc768ed0c8a1c1a))
* **deps:** update dependency isbot to v3.8.0 ([#1338](https://github.com/mx-space/core/issues/1338)) ([2e5d13d](https://github.com/mx-space/core/commit/2e5d13da7558919056b9de491cf85a4ba803a8ed))
* **deps:** update dependency mongoose-paginate-v2 to v1.8.0 ([#1341](https://github.com/mx-space/core/issues/1341)) ([3e1d065](https://github.com/mx-space/core/commit/3e1d065629bf5716e27163402f22ad581d99662a))

# [4.10.0](https://github.com/mx-space/core/compare/v4.9.1...v4.10.0) (2024-01-07)


### Bug Fixes

* always create new require instance ([97526ce](https://github.com/mx-space/core/commit/97526ce6301836cd2e2bf153f1042dbb5fef0e63))
* bark url desc ([92651b1](https://github.com/mx-space/core/commit/92651b1e7b89720140964f14d2ea4501a8edc46b))
* **comment:** add type guard on `source` ([e31b98a](https://github.com/mx-space/core/commit/e31b98a37f5d4123186d7a57b2b16e877b87f294))
* **deps:** update dependency @babel/core to v7.23.7 ([03368c5](https://github.com/mx-space/core/commit/03368c5292cdd119641b80252c872a5ff3d9ef77))
* **deps:** update dependency @simplewebauthn/server to v8.3.6 ([97d1ab7](https://github.com/mx-space/core/commit/97d1ab79bbdee90f98bd91483189a4c69a96f18f))
* **deps:** update dependency image-size to v1.1.0 ([#1321](https://github.com/mx-space/core/issues/1321)) ([2fb8cec](https://github.com/mx-space/core/commit/2fb8cecac096b4fd45bbe10d87271df7d38ce446))
* **deps:** update dependency image-size to v1.1.1 ([5e52b80](https://github.com/mx-space/core/commit/5e52b80cc06861dfb1d8d87d516b1fa2f1fe09df))
* **deps:** update dependency linkedom to v0.16.6 ([668a9af](https://github.com/mx-space/core/commit/668a9af136345808562c3535da1d90cb9fed1c92))
* **deps:** update dependency marked to v11.1.1 ([c0788f1](https://github.com/mx-space/core/commit/c0788f1f9fc98658b32bddae140e2d545560df2d))
* **deps:** update dependency mongoose-aggregate-paginate-v2 to v1.0.7 ([#1326](https://github.com/mx-space/core/issues/1326)) ([9f51058](https://github.com/mx-space/core/commit/9f510585040c04522880230b5f6b90e86e350f58))
* **deps:** update dependency nodemailer to v6.9.8 ([03c0eab](https://github.com/mx-space/core/commit/03c0eab13851e746b0227266e186b3735010eac7))
* ingore migration collection backup ([813aa35](https://github.com/mx-space/core/commit/813aa351b1fc98e30cb2f21e908851f6655c6320))
* remove uptime in info ([f3e46e7](https://github.com/mx-space/core/commit/f3e46e7f56105d21db7e57349016b22e2fcc4aeb))
* remove xlog api proxy ([91aa771](https://github.com/mx-space/core/commit/91aa77181a17cb99e4380ef02b3adbc57717bc3f))
* typo ([19bb8cc](https://github.com/mx-space/core/commit/19bb8cce8ffea21736ddcfbc80409a2d919a0553))


### Features

* add clearDispatchEvents method to WebhookController and WebhookService ([bf2e753](https://github.com/mx-space/core/commit/bf2e7530114734195387fa3af063e2157aab793a))

## [4.9.1](https://github.com/mx-space/core/compare/v4.9.0...v4.9.1) (2023-12-25)


### Bug Fixes

* webhok scope filter ([6176065](https://github.com/mx-space/core/commit/6176065c60e20ac6b754e2a1c9098b09e8dbfeb5))


### Features

* add health_check ([889b0b0](https://github.com/mx-space/core/commit/889b0b0b7db13483dfe35af87ecd4a1fde04e9a9))

# [4.9.0](https://github.com/mx-space/core/compare/v4.8.6...v4.9.0) (2023-12-24)


### Bug Fixes

* add field for algolia search ([c613bf7](https://github.com/mx-space/core/commit/c613bf77f52521ae2820d7aa7c46aa37a1216e53))
* ci ([d947eee](https://github.com/mx-space/core/commit/d947eeeb3d87ae71c9e4be24d71e0513ea20baca))
* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.3 ([84645c1](https://github.com/mx-space/core/commit/84645c1a984e763ece068b84b9e5fe55873cb9f6))
* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.4 ([309184c](https://github.com/mx-space/core/commit/309184c5c6a4a19e82b072a5321a730fc93e1994))
* **deps:** update dependency @nestjs/throttler to v5.1.1 ([76e5422](https://github.com/mx-space/core/commit/76e542270fe0b486a1759b5c3205b424893ca7e9))
* **deps:** update dependency cache-manager to v5.3.2 ([6efb1ef](https://github.com/mx-space/core/commit/6efb1ef17eae0caa001cbf6e5d22215652e7f948))


### Features

* support webhook ([#1298](https://github.com/mx-space/core/issues/1298)) ([c6d037d](https://github.com/mx-space/core/commit/c6d037db1d0aabb445672c518b6a82e6beb58956))

## [4.8.6](https://github.com/mx-space/core/compare/v4.8.4...v4.8.6) (2023-12-18)


### Bug Fixes

* **deps:** update algoliasearch-client-javascript monorepo to v4.22.0 ([#1294](https://github.com/mx-space/core/issues/1294)) ([e4fbeae](https://github.com/mx-space/core/commit/e4fbeae2bfad0174402c517274ede13ee33aaf18))
* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.2 ([62b7fef](https://github.com/mx-space/core/commit/62b7fef9f26d01c9cdaecffab87fe555413daafd))
* **deps:** update dependency algoliasearch to v4.21.1 ([3b7b98b](https://github.com/mx-space/core/commit/3b7b98bf19188fe8ae3ac6b42a524889bf5590e8))
* **deps:** update dependency linkedom to v0.16.5 ([97a9435](https://github.com/mx-space/core/commit/97a9435a1d014a0092bdc36f9602483649835738))
* **deps:** update dependency reflect-metadata to v0.2.1 ([#1300](https://github.com/mx-space/core/issues/1300)) ([cc20933](https://github.com/mx-space/core/commit/cc2093300de4ce23d3409d68b1b34785bbbe8153))
* **deps:** update nest monorepo to v10.3.0 (minor) ([#1307](https://github.com/mx-space/core/issues/1307)) ([3cbb081](https://github.com/mx-space/core/commit/3cbb081e000708602334d21369a20bf827232123))
* run prebuild before test ([1ce1824](https://github.com/mx-space/core/commit/1ce1824ef0ee69b8016e89ec0c6b41e200978c7b))
* some `env` move to runtime inject ([a3510d2](https://github.com/mx-space/core/commit/a3510d252626048c0c3cd271ca366e5b689833e5))


### Features

* request context ([c643094](https://github.com/mx-space/core/commit/c64309446e83df911e65da796cecca22f8d2c6c8))

## [4.8.4](https://github.com/mx-space/core/compare/v4.8.3...v4.8.4) (2023-12-12)


### Bug Fixes

* **deps:** update algoliasearch-client-javascript monorepo to v4.21.0 (minor) ([#1288](https://github.com/mx-space/core/issues/1288)) ([46c2d1f](https://github.com/mx-space/core/commit/46c2d1fe18733d7dc42844bd1774d3044f9dd32a))
* **deps:** update babel monorepo to v7.23.6 (patch) ([#1287](https://github.com/mx-space/core/issues/1287)) ([237adc5](https://github.com/mx-space/core/commit/237adc51a4ddc5cc22f28b40f260284f0b7d688d))
* test case ([09db9c9](https://github.com/mx-space/core/commit/09db9c9133cac095fbac53e5942f1ea86ad16640))

## [4.8.3](https://github.com/mx-space/core/compare/v4.8.2...v4.8.3) (2023-12-11)


### Bug Fixes

* test case ([ec37bd1](https://github.com/mx-space/core/commit/ec37bd111b17177cff611f188ef921df79c9226c))

## [4.8.2](https://github.com/mx-space/core/compare/v4.8.1...v4.8.2) (2023-12-10)


### Bug Fixes

* disable pre requirement validation for auth security ([2444e39](https://github.com/mx-space/core/commit/2444e393b37027be0c3915fc7bd755be618cfef8))
* guard if not passkey ([1cc940d](https://github.com/mx-space/core/commit/1cc940deeddf8200d78e103be350b8f6062907b9))

## [4.8.1](https://github.com/mx-space/core/compare/v4.8.0...v4.8.1) (2023-12-10)


### Bug Fixes

* remove hard code ([956d2d6](https://github.com/mx-space/core/commit/956d2d66e667b6a23a1171756be856f5338e9daa))

# [4.8.0](https://github.com/mx-space/core/compare/v4.8.0-alpha.2...v4.8.0) (2023-12-10)

# [4.8.0-alpha.2](https://github.com/mx-space/core/compare/v4.8.0-alpha.1...v4.8.0-alpha.2) (2023-12-10)


### Bug Fixes

* add env ([6a7cfbd](https://github.com/mx-space/core/commit/6a7cfbd2497c868378e5a6220ab0073bccb33294))

# [4.8.0-alpha.1](https://github.com/mx-space/core/compare/v4.8.0-alpha.0...v4.8.0-alpha.1) (2023-12-10)


### Bug Fixes

* logger module ([b49faaf](https://github.com/mx-space/core/commit/b49faaff0b58e5484380dc7b725a8c25267df752))

# [4.8.0-alpha.0](https://github.com/mx-space/core/compare/v4.7.2...v4.8.0-alpha.0) (2023-12-10)


### Bug Fixes

* **deps:** update dependency @clerk/clerk-sdk-node to v4.12.23 ([6d213ee](https://github.com/mx-space/core/commit/6d213ee29b65749afbc81efdf49509281fb8ed0b))
* **deps:** update dependency @clerk/clerk-sdk-node to v4.13.0 ([#1278](https://github.com/mx-space/core/issues/1278)) ([20142ea](https://github.com/mx-space/core/commit/20142eace0beb6a33dce8794f486c1432a24a17c))
* **deps:** update dependency mongoose to v8.0.3 ([74e5c83](https://github.com/mx-space/core/commit/74e5c83efe1fffde7f6b537cef256d8785c8a0f1))
* **deps:** update dependency reflect-metadata to v0.1.14 ([b7d5811](https://github.com/mx-space/core/commit/b7d58111b0e48d47e34a1c132de0db57a7689a1b))


### Features

* support user login by passkey ([#1285](https://github.com/mx-space/core/issues/1285)) ([03cc449](https://github.com/mx-space/core/commit/03cc449bd6761371357d6b86f2e8d592d15c9a5b))

## [4.7.2](https://github.com/mx-space/core/compare/v4.7.1...v4.7.2) (2023-12-03)


### Bug Fixes

* windows zip minetype detection ([1e9105a](https://github.com/mx-space/core/commit/1e9105a481ba670683d041695ab82bdaa246b44d))

## [4.7.1](https://github.com/mx-space/core/compare/v4.7.0...v4.7.1) (2023-12-02)


### Bug Fixes

* change clerk auth verify ([1c10b47](https://github.com/mx-space/core/commit/1c10b47e6c956aa1f6e069326de09e4a05c372d6))

# [4.7.0](https://github.com/mx-space/core/compare/v4.6.3...v4.7.0) (2023-12-02)


### Bug Fixes

* pass test case ([0e5eb09](https://github.com/mx-space/core/commit/0e5eb09f483d71f81604147b4bc63c81ac243509))


### Features

* support clerk auth ([18b9cbb](https://github.com/mx-space/core/commit/18b9cbb90fb5f6c6e0813cabff7a49ba9df07f43))

## [4.6.3](https://github.com/mx-space/core/compare/v4.6.2...v4.6.3) (2023-11-30)


### Bug Fixes

* **deps:** update babel monorepo to v7.23.5 ([64f6bb5](https://github.com/mx-space/core/commit/64f6bb5267034d8bc14229f1d2e364efeb2899ba))
* **deps:** update dependency @typegoose/auto-increment to v4 ([#1255](https://github.com/mx-space/core/issues/1255)) ([4dff159](https://github.com/mx-space/core/commit/4dff1597934fadfb8ca016bcac19668dd74c8d47))
* **deps:** update dependency @typegoose/typegoose to v12 ([#1254](https://github.com/mx-space/core/issues/1254)) ([033395a](https://github.com/mx-space/core/commit/033395a43092d4d68479c74287cfe6fa6b0315f9))
* **deps:** update dependency axios-retry to v4 ([#1253](https://github.com/mx-space/core/issues/1253)) ([8d63c76](https://github.com/mx-space/core/commit/8d63c763279396153ff4ba03b94d9100839c1fc7))
* **deps:** update dependency lru-cache to v10.1.0 ([#1247](https://github.com/mx-space/core/issues/1247)) ([c0b193e](https://github.com/mx-space/core/commit/c0b193e29c5dda0f3a3fa9185c1dbc9612df5c21))
* **deps:** update dependency nestjs-pretty-logger to v0.1.1 ([90ac17e](https://github.com/mx-space/core/commit/90ac17ebe541dd41cc7e4e793d5465c76c0996c0))
* **deps:** update dependency nestjs-pretty-logger to v0.2.0 ([#1257](https://github.com/mx-space/core/issues/1257)) ([4dee3b2](https://github.com/mx-space/core/commit/4dee3b2792e7f03da1ec6788e5a5ab1ad65411eb))
* in test ([69b1c5f](https://github.com/mx-space/core/commit/69b1c5fab9bbe084d52f373a33993184decd1276))
* typings ([221bf5f](https://github.com/mx-space/core/commit/221bf5f5b5a766a9e5a243fbd56baf3399986334))
* update error throw ([2a97fbe](https://github.com/mx-space/core/commit/2a97fbe24adce37643d3baa112e3f38c18d2d692))

## [4.6.2](https://github.com/mx-space/core/compare/v4.6.1...v4.6.2) (2023-11-21)


### Bug Fixes

* ci ([557c3ce](https://github.com/mx-space/core/commit/557c3ce58430b5bb1dd2c502bed5e7c86aef7232))
* comment model `refType` type ([1ad151a](https://github.com/mx-space/core/commit/1ad151af09d1fd4b3d1ebe8277a83eb67824861b))
* comment ref not found statud code ([3a0f67a](https://github.com/mx-space/core/commit/3a0f67ad40bbb2f21240952fc307362ac3e7cdf4))
* comment refType ([c8039ed](https://github.com/mx-space/core/commit/c8039ed32ec5f426416a532c24f9e1221e6c3c62))
* **deps:** update babel monorepo to v7.23.4 ([1e8859f](https://github.com/mx-space/core/commit/1e8859ff78cc62f76650f17d5795aa140654bb65))
* **deps:** update dependency lru-cache to v10.0.3 ([083c427](https://github.com/mx-space/core/commit/083c4276de673280a8c5a6993777d16dcd303e60))
* **deps:** update nest monorepo to v10.2.10 ([07600f3](https://github.com/mx-space/core/commit/07600f3a848cb4146c67d9be253f8a6b1e5e80ce))
* guard init module ([6236de7](https://github.com/mx-space/core/commit/6236de73b20786d0f3ae997c18ada3c8505ce609))

## [4.6.1](https://github.com/mx-space/core/compare/v4.6.0...v4.6.1) (2023-11-19)


### Bug Fixes

* comment populate `ref_type`, closes [#1232](https://github.com/mx-space/core/issues/1232) ([c9758a4](https://github.com/mx-space/core/commit/c9758a4d51bcb15541207a1359e72775875c904e))
* **deps:** update dependency @typegoose/typegoose to v11.7.1 ([57e565b](https://github.com/mx-space/core/commit/57e565be995d4ee203d67701b7f744a0382edb1e))
* **deps:** update dependency axios-retry to v3.9.1 ([70fd41b](https://github.com/mx-space/core/commit/70fd41beb438796e55675a6563f725e2e86b0809))
* **deps:** update dependency mongoose to v8.0.1 ([#1221](https://github.com/mx-space/core/issues/1221)) ([2c3a218](https://github.com/mx-space/core/commit/2c3a2188c384d762c67b54bb34de99ab271eab45))
* **deps:** update nest monorepo to v10.2.9 ([0f26ffb](https://github.com/mx-space/core/commit/0f26ffb114403021cf07df8b4d344f92ab975817))
* remove cdn download url ([795ab13](https://github.com/mx-space/core/commit/795ab13f13d944dfa8c856562b368cc7752075c3))

# [4.6.0](https://github.com/mx-space/core/compare/v4.5.3...v4.6.0) (2023-11-16)


### Bug Fixes

* **deps:** update babel monorepo to v7.23.3 ([b8adf44](https://github.com/mx-space/core/commit/b8adf44f9c4863065a6108de11196089acc72b66))
* **deps:** update dependency @nestjs/event-emitter to v2.0.3 ([9f2c47d](https://github.com/mx-space/core/commit/9f2c47d730c311b4321c467bcc2bf1e616ee276b))
* **deps:** update dependency linkedom to v0.16.4 ([8aa1696](https://github.com/mx-space/core/commit/8aa1696bf5062fad8596884e1534a6fe9da8110b))
* **deps:** update dependency lru-cache to v10.0.2 ([538c3ae](https://github.com/mx-space/core/commit/538c3ae7c442b409805162a13535c1232ecfd95e))
* **deps:** update dependency marked to v10 ([#1214](https://github.com/mx-space/core/issues/1214)) ([428bece](https://github.com/mx-space/core/commit/428bece4e76e5ee254238b5a1c9e1069914845dc))
* **deps:** update dependency marked to v9.1.6 ([d8a0d8a](https://github.com/mx-space/core/commit/d8a0d8ae8412517f84a41b2729343e6845222353))
* migrate db ([aee6f63](https://github.com/mx-space/core/commit/aee6f6327b73abae89f0e7f9e2bf1d2d3d3ba4c0))


### Features

* Sync system ([#1208](https://github.com/mx-space/core/issues/1208)) ([255e05c](https://github.com/mx-space/core/commit/255e05c0d101d487fac97525e8b7bde10a2790e0))

## [4.5.3](https://github.com/mx-space/core/compare/v4.5.2...v4.5.3) (2023-11-07)

## [4.5.2](https://github.com/mx-space/core/compare/v4.5.1...v4.5.2) (2023-11-07)

## [4.5.1](https://github.com/mx-space/core/compare/v4.5.0...v4.5.1) (2023-11-07)


### Bug Fixes

* **deps:** update dependency @nestjs/cache-manager to v2.1.1 ([0b7352d](https://github.com/mx-space/core/commit/0b7352d471882231ea0af6c50a19d60e12632efd))
* **deps:** update dependency inquirer to v9 ([#1102](https://github.com/mx-space/core/issues/1102)) ([d7d5f49](https://github.com/mx-space/core/commit/d7d5f49ed46003cfec54acc3bddf4b2529d165f2))
* **deps:** update dependency marked to v9.1.5 ([274ca23](https://github.com/mx-space/core/commit/274ca237593ca10100ca23e47cb1801740bee606))
* **deps:** update dependency mongoose to v8 ([#1179](https://github.com/mx-space/core/issues/1179)) ([e5ca485](https://github.com/mx-space/core/commit/e5ca4855c66b69a7fe3f363543da8f50091c5078))
* **deps:** update nest monorepo to v10.2.8 ([0f3b48c](https://github.com/mx-space/core/commit/0f3b48ca69def2cbd0f3a63df0fb2c33dfe11d0a))
* link exists check ([b58dc2f](https://github.com/mx-space/core/commit/b58dc2fe044c52dd7f1e71029ddd6c68c692f09f))

# [4.5.0](https://github.com/mx-space/core/compare/v4.4.1...v4.5.0) (2023-10-31)


### Bug Fixes

* **deps:** update dependency marked to v9.1.4 ([3eabdb2](https://github.com/mx-space/core/commit/3eabdb29cb1824fef63f9d94512fa95623d4eeba))
* **deps:** update dependency mongoose to v7.6.4 ([148f281](https://github.com/mx-space/core/commit/148f281a157fad4d324a1b4d3ddaaea440544803))


### Features

* add count apis ([f90772d](https://github.com/mx-space/core/commit/f90772d06cc0aca8fd3e9f9547451e34d7e656bd))

## [4.4.1](https://github.com/mx-space/core/compare/v4.4.0...v4.4.1) (2023-10-29)


### Bug Fixes

* **deps:** update dependency @nestjs/throttler to v5.0.1 ([126c075](https://github.com/mx-space/core/commit/126c075d26d7c562f60b0fb92548b57b97e740ca))
* **deps:** update dependency axios-retry to v3.8.1 ([d74db15](https://github.com/mx-space/core/commit/d74db15fee1bbaaccbaa63fefcda0de808085f12))
* **deps:** update dependency linkedom to v0.16.1 ([#1161](https://github.com/mx-space/core/issues/1161)) ([dbd7f1d](https://github.com/mx-space/core/commit/dbd7f1dabc80a7e5c5a341d921d312d701d478a5))
* **deps:** update dependency marked to v9.1.3 ([dc0799c](https://github.com/mx-space/core/commit/dc0799c74aab81837e825b52f35fbb4d689aa800))
* **deps:** update dependency nodemailer to v6.9.7 ([#1160](https://github.com/mx-space/core/issues/1160)) ([e6ae312](https://github.com/mx-space/core/commit/e6ae312e5cb7b0408837728a1a58a60ed7ce2f40))
* **deps:** update dependency ua-parser-js to v1.0.37 ([77f384f](https://github.com/mx-space/core/commit/77f384f1d76d52ad58cebe433bbff9b2b21c8f9c))


### Features

* upgrade deps ([a126bbd](https://github.com/mx-space/core/commit/a126bbdf68926ac473cd3c67992469b016c96358))

# [4.4.0](https://github.com/mx-space/core/compare/v4.3.12...v4.4.0) (2023-10-21)


### Features

* **api-client:** add ack controller ([08dc741](https://github.com/mx-space/core/commit/08dc741c6ccc6b32dbb172557634a67a5dd54944))

## [4.3.12](https://github.com/mx-space/core/compare/v4.3.11...v4.3.12) (2023-10-18)


### Bug Fixes

* **deps:** update dependency ua-parser-js to v1.0.36 ([#1132](https://github.com/mx-space/core/issues/1132)) ([badd8e8](https://github.com/mx-space/core/commit/badd8e87a9af1d24b923be75af3a73db18786cc2))
* disable api cache if query with ts ([b6796b4](https://github.com/mx-space/core/commit/b6796b4c99368c76c299a3642c9f79ccba27f755))
* judge  is master ([25870cd](https://github.com/mx-space/core/commit/25870cdfadde847e79087de8ab25a6c03ab55779))
* lint ([a2e351c](https://github.com/mx-space/core/commit/a2e351cc252dd9372d4831b3a30e121d3ffa23c7))
* typo ([bbc1821](https://github.com/mx-space/core/commit/bbc18216b28dd8dfa2aa20652727865dfcd7eae6))

## [4.3.11](https://github.com/mx-space/core/compare/v4.3.10...v4.3.11) (2023-09-24)


### Bug Fixes

* skip throttler for proxy controller ([62cd807](https://github.com/mx-space/core/commit/62cd80743be73a5bc47ab618062c167bf8a8fd58))

## [4.3.10](https://github.com/mx-space/core/compare/v4.3.9...v4.3.10) (2023-09-13)


### Bug Fixes

* **deps:** update babel monorepo to v7.22.17 (patch) ([#1131](https://github.com/mx-space/core/issues/1131)) ([2f12db6](https://github.com/mx-space/core/commit/2f12db6762baef6b525b1fc87065fd1a41aa60ee))
* server time middleware apply ([a4e1bc4](https://github.com/mx-space/core/commit/a4e1bc468ef67a53769b7763f62030c47826be44))

## [4.3.9](https://github.com/mx-space/core/compare/v4.3.8...v4.3.9) (2023-09-07)


### Features

* add server time ([30aeaa7](https://github.com/mx-space/core/commit/30aeaa773cd53c6bd5b89bc2b8f5f839f8cba21f))

## [4.3.8](https://github.com/mx-space/core/compare/v4.3.7...v4.3.8) (2023-09-05)


### Bug Fixes

* rss description ([d3c65b2](https://github.com/mx-space/core/commit/d3c65b275dab529421219f3753d93d96decc21cd))

## [4.3.7](https://github.com/mx-space/core/compare/v4.3.6...v4.3.7) (2023-09-05)


### Bug Fixes

* only use swc in dev ([2bd87e9](https://github.com/mx-space/core/commit/2bd87e9a52fc0d37f0e9cc6caa104a2f5b148e15))
* rss 2.0 field ([8a39eaf](https://github.com/mx-space/core/commit/8a39eafbc709837c9dc00bea664dbb86cf5bbea6))


### Features

* add swc to complie ([d23f71a](https://github.com/mx-space/core/commit/d23f71ade0a798fe64cae828b2eaeeffb05910d6))

## [4.3.6](https://github.com/mx-space/core/compare/v4.3.5...v4.3.6) (2023-09-05)


### Bug Fixes

* **deps:** update babel monorepo to v7.22.11 (patch) ([#1120](https://github.com/mx-space/core/issues/1120)) ([637c02c](https://github.com/mx-space/core/commit/637c02cb98d10083670901312df3367fbf44bbcc))
* feed xml content ([a9913cb](https://github.com/mx-space/core/commit/a9913cb74a8109699ceec7ff85183d090e3b2137))
* typo ([8e1fe79](https://github.com/mx-space/core/commit/8e1fe79b572c8d292ca746b5991363109502924d))


### Features

* upgrade throttle ([a981f14](https://github.com/mx-space/core/commit/a981f14053bcbb78cb29867e9e1037205b9453c3))

## [4.3.5](https://github.com/mx-space/core/compare/v4.3.4...v4.3.5) (2023-08-23)


### Bug Fixes

* remove lean for popluate ([d4d64a2](https://github.com/mx-space/core/commit/d4d64a2f37853d7232da05649287377e863d4a36))

## [4.3.4](https://github.com/mx-space/core/compare/v4.3.3...v4.3.4) (2023-08-22)


### Bug Fixes

* redis password auth ([0c1655e](https://github.com/mx-space/core/commit/0c1655e2bb4f18c0e97374119e5076b5e23f531f))

## [4.3.3](https://github.com/mx-space/core/compare/v4.3.2...v4.3.3) (2023-08-10)


### Bug Fixes

* remove webshell ([2b36d9a](https://github.com/mx-space/core/commit/2b36d9a301fe5550cb6e694c5d50c7679afcdb86))

## [4.3.2](https://github.com/mx-space/core/compare/v4.3.1...v4.3.2) (2023-08-10)


### Bug Fixes

* typo ([9c3f48a](https://github.com/mx-space/core/commit/9c3f48a819e9d056ad54f7f6b5ee8aaa9a2ae545))

## [4.3.1](https://github.com/mx-space/core/compare/v4.3.0...v4.3.1) (2023-08-10)


### Bug Fixes

* **deps:** update dependency marked to v7 ([#1107](https://github.com/mx-space/core/issues/1107)) ([a6d186a](https://github.com/mx-space/core/commit/a6d186a8c66a3c19560cdf58d8c285c70108bd78))
* remove default noe ([e3e49c0](https://github.com/mx-space/core/commit/e3e49c04061bab33ff8a476b43a5bdb91515f272))


### Features

* allow disabling SSL/TLS for SMTP ([#1108](https://github.com/mx-space/core/issues/1108)) ([42f2f83](https://github.com/mx-space/core/commit/42f2f83805224ad7b4c62d781d9f8ac962abba0a))

# [4.3.0](https://github.com/mx-space/core/compare/v4.2.14...v4.3.0) (2023-08-06)


### Bug Fixes

* **deps:** update all non-major dependencies ([#1100](https://github.com/mx-space/core/issues/1100)) ([6d781ac](https://github.com/mx-space/core/commit/6d781ac67e7e48b840981d74b8955166336d1358))
* like list query ([03ca5c6](https://github.com/mx-space/core/commit/03ca5c65921bc42d7e04de0ebb8af09cdaed157b))


### Features

* activity controller ([61b4fb3](https://github.com/mx-space/core/commit/61b4fb3db6998676a066b05b7938fe63e2f20f21))
* add api client for activity controller ([44ab9dc](https://github.com/mx-space/core/commit/44ab9dc2730189ad7c90d0a2e9daa583912e2c1a))

## [4.2.14](https://github.com/mx-space/core/compare/v4.2.13...v4.2.14) (2023-07-30)


### Bug Fixes

* create post error when related post ([72f78a2](https://github.com/mx-space/core/commit/72f78a2004eb6a664ceedbcc561d672c284b7b45))
* deps version ([c14e8bf](https://github.com/mx-space/core/commit/c14e8bfdc6146c4c587c13ccaa676759f5784adc))

## [4.2.13](https://github.com/mx-space/core/compare/v4.2.12...v4.2.13) (2023-07-27)


### Bug Fixes

* **deps:** update all non-major dependencies (minor) ([#1097](https://github.com/mx-space/core/issues/1097)) ([33b14d8](https://github.com/mx-space/core/commit/33b14d89111a91a76384aa9efeff644135236a1a))
* **deps:** update all non-major dependencies (patch) ([#1081](https://github.com/mx-space/core/issues/1081)) ([80218f0](https://github.com/mx-space/core/commit/80218f0b0d6451abf288f17a8e1c91e084de69cb))
* distinguish between the types of comments ([e4ce8cd](https://github.com/mx-space/core/commit/e4ce8cd71997bdd942595b716527fe10c1c81690))
* leanid ([b30565d](https://github.com/mx-space/core/commit/b30565dc1c847c200bd2912f91fbd3cc416936e5))
* typo ([7054c79](https://github.com/mx-space/core/commit/7054c799bc70897d03589587e75e6e90bedfe317))

## [4.2.12](https://github.com/mx-space/core/compare/v4.2.11...v4.2.12) (2023-07-07)


### Bug Fixes

* related ([9c16544](https://github.com/mx-space/core/commit/9c165441853fc00c07f56ca83e2167e65a1fcac9))

## [4.2.11](https://github.com/mx-space/core/compare/v4.2.10...v4.2.11) (2023-07-05)


### Bug Fixes

* throw ([950dc8c](https://github.com/mx-space/core/commit/950dc8c9eac3232c6d2f054f1ef1615ccf46b1ea))


### Features

* add extra field for `/top` ([a7b4513](https://github.com/mx-space/core/commit/a7b45132996061aef23f96facab18b4b396aef25))

## [4.2.10](https://github.com/mx-space/core/compare/v4.2.9...v4.2.10) (2023-07-04)


### Features

* fn support broardcast ([dadd3c8](https://github.com/mx-space/core/commit/dadd3c8d9a285edf3b3824b60b73cc2e32f1b016))

## [4.2.9](https://github.com/mx-space/core/compare/v4.2.8...v4.2.9) (2023-07-03)


### Bug Fixes

* adjust module seq ([d24dc6e](https://github.com/mx-space/core/commit/d24dc6e89f58787fd54c7a8c76d169acbb9edf20))
* timeline lean query ([313b8d0](https://github.com/mx-space/core/commit/313b8d075783d5ad13a1f554ce4f32f082931f4a))

## [4.2.8](https://github.com/mx-space/core/compare/v4.2.7...v4.2.8) (2023-06-28)


### Bug Fixes

* nest comment children nested and limit max depth ([ccc5b54](https://github.com/mx-space/core/commit/ccc5b54f241da7ce7493a3ec0018d6a7a463ddb6))
* omit data if patch post data ([904c31b](https://github.com/mx-space/core/commit/904c31b98ec926ad0bad8589c91beaf85e3e7861))
* populate comment avatar ([591ae33](https://github.com/mx-space/core/commit/591ae33bce83bc7c194c458edf1496c627d7a352))


### Features

* post related each other ([c822398](https://github.com/mx-space/core/commit/c82239807b36f6a94848f5704f1a69a649f515df))

## [4.2.7](https://github.com/mx-space/core/compare/v4.2.6...v4.2.7) (2023-06-27)


### Bug Fixes

* comment mail props ([26f23cb](https://github.com/mx-space/core/commit/26f23cbfe82d722a29b88e93a498643b82bb0c15))


### Features

* comment modal add `avatar` and `source` ([cf98260](https://github.com/mx-space/core/commit/cf982603aafdfe36bd124f20049ecfb949353fc5))
* serverless cache ttl ([0c4849c](https://github.com/mx-space/core/commit/0c4849c945f949be1bd359b2731fb929fbb70a35))

## [4.2.6](https://github.com/mx-space/core/compare/v4.2.5...v4.2.6) (2023-06-23)


### Bug Fixes

* enum uppercase ([33539aa](https://github.com/mx-space/core/commit/33539aa69674d75d002e09532c4080ef01801930))
* re-sign token ([719a49c](https://github.com/mx-space/core/commit/719a49ca7782fdd44a1ea689f24f4633d1f8bde1))

## [4.2.5](https://github.com/mx-space/core/compare/v4.2.4...v4.2.5) (2023-06-23)


### Bug Fixes

* cache manger ttl ([adbb000](https://github.com/mx-space/core/commit/adbb000bb4ee4d92cf378de8e1f8bcecc1e66423))
* test ([38f4d3b](https://github.com/mx-space/core/commit/38f4d3b235e96a96c18f446990144f9d4c3be96a))

## [4.2.4](https://github.com/mx-space/core/compare/v4.2.3...v4.2.4) (2023-06-23)


### Bug Fixes

* re-sign jwt delay ([7536dd1](https://github.com/mx-space/core/commit/7536dd17cf226ac9f5bd7382d065e276018fc43b))

## [4.2.3](https://github.com/mx-space/core/compare/v4.2.2...v4.2.3) (2023-06-20)


### Bug Fixes

* **note:** remove password field ([b49711c](https://github.com/mx-space/core/commit/b49711c24c9d69cfb8d055d3c69963079862b58e))
* type error ([45eba0e](https://github.com/mx-space/core/commit/45eba0e327f9f760c92d0e544c174d2a2a7bb365))

## [4.2.2](https://github.com/mx-space/core/compare/v4.2.1...v4.2.2) (2023-06-17)


### Bug Fixes

* test case ([fbcf2cc](https://github.com/mx-space/core/commit/fbcf2cc53f98d4cf4bef2d8e7b48341100d381fb))

## [4.2.1](https://github.com/mx-space/core/compare/v4.2.0...v4.2.1) (2023-06-16)


### Features

* add debug logging ([b5a2b7f](https://github.com/mx-space/core/commit/b5a2b7fdd6d642bb44c692a692ef575fc2be17d1))

# [4.2.0](https://github.com/mx-space/core/compare/v4.1.0...v4.2.0) (2023-06-16)


### Bug Fixes

* docker build ([944c571](https://github.com/mx-space/core/commit/944c5712103db7535db6ab3f8b1633af1b489848))

# [4.1.0](https://github.com/mx-space/core/compare/v4.1.0-beta.1...v4.1.0) (2023-06-08)


### Bug Fixes

* escapeXml for feed ([5821c04](https://github.com/mx-space/core/commit/5821c04640a813a243ca42d8248d930cf5645941))

# [4.1.0-beta.1](https://github.com/mx-space/core/compare/v4.1.0-beta.0...v4.1.0-beta.1) (2023-06-07)


### Bug Fixes

* add config encrypt args to dockerfile ([2f455dc](https://github.com/mx-space/core/commit/2f455dc9b9bdf0f9fa8398c4c7ab66a801c57f48))
* remove marked warning ([f3f47ef](https://github.com/mx-space/core/commit/f3f47efa46dd55ebd157c1a963060cb87df0803b))


### Features

* add some info on comment render ([a120498](https://github.com/mx-space/core/commit/a120498252f354432df3067ddef40db7652940ec))


### Performance Improvements

* cache get subscribe email template ([1b602ea](https://github.com/mx-space/core/commit/1b602eac4b4f3e838adc04a47529e63b05673046))

# [4.1.0-beta.0](https://github.com/mx-space/core/compare/v4.1.0-alpha.0...v4.1.0-beta.0) (2023-06-06)


### Bug Fixes

* bypass if not init system ([99b7a03](https://github.com/mx-space/core/commit/99b7a036b07542274bcc4fdbecf2e3cf6a66bf35))
* update test case ([771d6c5](https://github.com/mx-space/core/commit/771d6c5cd59933c9d95a6e25fc4ad1d0fcd722b0))


### Features

* update email template ([a874c66](https://github.com/mx-space/core/commit/a874c66b729c87b2bb63c91f2bb1b43f6d26d853))

# [4.1.0-alpha.0](https://github.com/mx-space/core/compare/v4.0.2...v4.1.0-alpha.0) (2023-06-04)


### Bug Fixes

* push script ([754f560](https://github.com/mx-space/core/commit/754f56071202719c265d8facbae79309c51cfeae))
