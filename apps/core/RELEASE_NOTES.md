## TL;DR

Owner automation tokens remain usable beyond ten daily requests, while image editing handles empty accent values and receives updated editor dependencies.

## Changes

- Keep newly issued owner automation tokens working beyond the API key provider's default daily request quota. ([eac0330](https://github.com/mx-space/core/commit/eac0330d1c29e261cc5a7b4907dcd68b483b2469))
- Prevent empty image accent values from blocking image updates. ([#2854](https://github.com/mx-space/core/pull/2854))
- Update the bundled rich text editor to Haklex 0.52.0, including its new syntax highlighting engine. ([97133a3](https://github.com/mx-space/core/commit/97133a3802357e5d051a222a4f19c6d4d8715eed))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v15.0.0...v15.0.1
