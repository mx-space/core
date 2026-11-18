## TL;DR

The editor agent can now search the web and read pages through OpenRouter or DeepSeek, switched on from a new AI settings section.

## Highlights

The writing agent can now look things up online. When web search is on, the agent gets `web_search` and `web_fetch` tools, so it can check facts, find recent information and read links you give it. It decides when to search, then cites the URLs it relied on. Search results and pages are marked as untrusted, and the agent is told never to follow instructions found in them.

Web search is off by default. Turn it on under AI settings → Agent web search and pick a search provider. A DeepSeek provider works with any agent model and uses the DeepSeek Search and Fetch API with that provider's key. An OpenRouter provider uses OpenRouter's built-in web tools, which only apply when the agent runs on that same provider. Each agent turn is capped at 20 web calls.

## Changes

### Features

- Agent web search and page reading through DeepSeek's Search & Fetch API or OpenRouter's built-in web tools, with a per-turn limit and an untrusted-content fence ([0d7967b](https://github.com/mx-space/core/commit/0d7967bd9c29cb2396e5f9c712571b4c2d2671c7), [c08a950](https://github.com/mx-space/core/commit/c08a95065e6c08fbe297f3be12faa1995f39e7c4), [014b884](https://github.com/mx-space/core/commit/014b8840ddb51eef08ad31b7ed2493a3234094e7))
- New AI settings section to enable agent web search and choose its provider; saving rejects providers without built-in search ([29ee4fd](https://github.com/mx-space/core/commit/29ee4fdc5ccfa2d7653d97d35ceb9c7f78787876), [8dc01e2](https://github.com/mx-space/core/commit/8dc01e237b34ce085c3542ea274d651d9c7927d4))

### Bug Fixes

- A fetched page's title can no longer break out of the untrusted-content fence shown to the agent ([db349aa](https://github.com/mx-space/core/commit/db349aac52beb8f1b7a4facbc1dcceea7e2ac908))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v18.0.1...v18.1.0
