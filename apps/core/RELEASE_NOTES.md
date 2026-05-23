## TL;DR

Patch release: the device-authorization endpoint now accepts owner approvals again, and Mermaid diagrams in rich content render with stable layout.

## Changes

- Owner approval for `mxs auth login` (and any other device-flow client) once again succeeds — the verify endpoint was rejecting every payload with `user_code: Invalid input` because the schema declared a snake-case key while the global case-normalization pipe had already camelized it. ([f5703a2](https://github.com/mx-space/core/commit/f5703a23419a5328059ecfe559801d10c0274ac0))
- Mermaid diagram rendering moves off the upstream `mermaid` runtime onto `beautiful-mermaid` via `@haklex/rich-headless@0.15.4`. Output is unchanged, but loading is staged and the diagram now reserves its estimated height so Mermaid blocks no longer cause cumulative layout shift. ([ff7d07a](https://github.com/mx-space/core/commit/ff7d07aa4c37d5b010fef1be1b4485a1ae67e342), [b5b2bb3](https://github.com/mx-space/core/commit/b5b2bb3189a40ed0186140ece3c92e03fbeddb15))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.0.1...v13.0.2
