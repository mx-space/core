## TL;DR

Mix Space now welcomes administrators with a unified, interactive entry flow spanning sign-in, server connection, and first-run setup.

## Highlights

The dashboard now brings login, API connection, and onboarding together in one consistent entry experience. Each stage has its own visual treatment while retaining the same layout and design language, so moving between server configuration, authentication, and initial setup feels continuous. Existing authentication methods and setup actions remain available within the refreshed forms.

A real WebGL ripple background responds to interaction and smoothly changes shape as the entry flow progresses. The canvas stays mounted across entry routes to preserve continuity. Responsive layouts, reduced-motion handling, and visibility-aware rendering support smaller screens and motion preferences, while setup panels and password controls remain readable in dark mode.

## Changes

### Features

- Explore an interactive WebGL ripple that morphs smoothly between entry scenes. ([8ac2d8e](https://github.com/mx-space/core/commit/8ac2d8e9fa10c09994e8ff2490cfd8bec482e2e0))
- Use a shared entry layout for login, server connection, and onboarding, with forms tailored to each stage. ([d0441f2](https://github.com/mx-space/core/commit/d0441f21763f85cef81863fcf5dd80a4e46cf376))

### Bug Fixes

- Keep setup panels readable in dark mode and prevent password text from overlapping trailing controls. ([370b743](https://github.com/mx-space/core/commit/370b743421355771234a792d7711407f746b0241))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v16.1.0...v16.2.0
