---
slug: workflow
title: Mandatory workflow and safety rules
description: How to drive any mxs task end-to-end without damaging server state
order: 10
---

# Workflow

```text
┌──────────────────────┐
│ Identify operation   │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Load relevant refs   │  (mxs skill get commands-post, authoring, …)
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Confirm target/auth  │  (mxs auth whoami --json, mxs auth status --json)
└──────────┬───────────┘
           ▼
     ◆ Mutation? ◆
      /          \
     ▼            ▼
┌──────────┐  ┌──────────────────────┐
│ Read cmd │  │ Dry run if supported │
└────┬─────┘  └──────────┬───────────┘
     │                   ▼
     │          ┌──────────────────────┐
     │          │ Execute mutation     │  (--json)
     │          └──────────┬───────────┘
     │                   ▼
     └─────────>┌──────────────────────┐
                │ Verify read-back     │  (--output llm or --json)
                └──────────────────────┘
```

## Required safety rules

- Always use machine-readable output: pass `--json` for mutations and reads unless the task explicitly asks for human output.
- Never print access tokens, refresh tokens, cookies, API keys, or raw credential files.
- Treat `MXS_API_URL`, `MXS_TOKEN`, `MXS_API_KEY`, `--api-url`, `--token`, and `--api-key` as execution context, not content.
- Do not publish to production unless the user explicitly requested publication or the configured target has been confirmed as the intended target.
- If testing the write path without publication, set `<state>draft</state>` or pass `--state draft`.
- After any create, edit, update, publish, or unpublish operation, read the resource back and verify observable fields.
- For destructive operations, prefer `--dry-run` first where supported, then require an explicit user request or confirmed intended target before using `delete --force`.

See `safety` for the full mutation matrix, common failures, and exit codes.
