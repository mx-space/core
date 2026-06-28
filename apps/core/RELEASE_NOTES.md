## TL;DR

Hotfix for v13.11.6: restores the `stock_quote` / `stock_bars` / `geocode_search` / `geocode_location` serverless built-ins so the `apikey` / `key` query parameter actually reaches Twelve Data and Amap.

## Changes

### Bug Fixes

- **serverless**: v13.11.6 routed Twelve Data and Amap calls through `axios.get(url, { params })`, but the sandbox's bundled `axios` was a thin `fetch` wrapper that silently dropped the `params` config — so the API key was never appended to the URL and both providers responded with *"parameter is incorrect or not specified"*. All five built-ins (`stock_quote`, `stock_bars`, `geocode_search`, `geocode_location`, `ip-query`) now use the global `fetch` + `URLSearchParams`, and the fake-axios stub plus its `HttpAxios` / `HttpService` type surface have been removed from the sandbox — `fetch` is the supported HTTP egress ([b34034e](https://github.com/mx-space/core/commit/b34034e3a5ab892b0b6edc6b29f170af54d4b4e2)).

## Upgrade Notes

If you maintain a custom serverless snippet that called `ctx.getService('http').axios.*`, replace those calls with the global `fetch` (with `URLSearchParams` for query strings) or `require('axios')` to install the real axios package.

---

**Full Changelog**: https://github.com/mx-space/core/compare/v13.11.6...v13.11.7
