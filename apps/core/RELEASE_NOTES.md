## TL;DR

The dashboard home now loads from one aggregated request and renders all at once, so sections no longer push the page around.

## Breaking Changes

- **aggregate**: `GET /aggregate/on-this-day` and `GET /aggregate/publish-heatmap` are removed; only the dashboard home used them. **Migration**: read `on_this_day` and `publish_heatmap` from `GET /aggregate/dashboard` instead.

## Highlights

Opening the dashboard used to fire about ten requests and draw each section as its data arrived, so the page jumped several times while loading. The home now makes a single request to the new `GET /aggregate/dashboard` endpoint, shows a skeleton until it returns, and then renders every section in one pass. Online visitor counts still refresh every few seconds.

`GET /aggregate/dashboard` requires sign-in and returns the owner name, site counters, read and like totals, pending comments and link requests, the latest drafts, on this day, the publishing heatmap, top articles, recent comments and likes, and today's hourly traffic.

## Changes

### Features

- Add `GET /aggregate/dashboard`, returning everything the dashboard home needs in one response ([689dcd5](https://github.com/mx-space/core/commit/689dcd5a5))
- The dashboard home loads in a single request and shows a skeleton instead of filling in section by section ([7c4ef8c](https://github.com/mx-space/core/commit/7c4ef8c84))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v14.14.2...v14.14.3
