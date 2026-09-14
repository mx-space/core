## TL;DR

Admin switches now match lobe-ui, and dictionary translation no longer drops fields when the model mangles hash keys.

## Highlights

The admin dashboard Switch control now uses the lobe-ui track, thumb shadow, and press-stretch spring. Labeled settings rows are a separate FormSwitch, so a switch sitting in an existing layout is no longer wrapped in a second title.

Dictionary translation used to send 64-character hash keys that models often dropped or rewrote, leaving tags and other entries untranslated. Fields are now sent by index and mapped back, with a warning when the model still omits a value.

## Changes

### Features

- Admin Switch matches the lobe-ui control, with FormSwitch for labeled setting rows ([12a3582](https://github.com/mx-space/core/commit/12a3582d835ab0f403802583d830df0e0cc70953))

### Bug Fixes

- Dictionary translation maps model output by field index so hash keys cannot drop entries ([59a4a2a](https://github.com/mx-space/core/commit/59a4a2a4555438fce351f6f97297b91a4fee0c73))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.12.1...v14.12.2
