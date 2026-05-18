---
name: mxs-cli-ai-author
description: Use when an agent must inspect, draft, validate, edit, publish, unpublish, delete, or configure mx-space content through packages/cli or the mxs binary.
disable-model-invocation: true
---

# mxs CLI AI Author

Use `mxs` as the deterministic interface for mx-core content operations without opening the admin UI. Load only the references needed for the requested operation.

## Reference Map

| Need | Read |
| --- | --- |
| Exact command syntax, flags, resource coverage | [Command Index](references/command-index.md) |
| Post, note, and page authoring workflows | [Content Authoring](references/content-authoring.md) |
| Authentication, target selection, output modes, config files | [Auth, Config, And Output](references/auth-config-output.md) |
| Mutation safety, verification, failures, exit codes | [Safety And Troubleshooting](references/safety-troubleshooting.md) |

## Mandatory Workflow

```text
┌──────────────────────┐
│ Identify operation   │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Load relevant refs   │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Confirm target/auth  │
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
     │          │ Execute mutation     │
     │          └──────────┬───────────┘
     │                   ▼
     └─────────>┌──────────────────────┐
                │ Verify read-back     │
                └──────────────────────┘
```

## Required Safety Rules

- Always use machine-readable output: pass `--json` for mutations and reads unless the task explicitly asks for human output.
- Never print access tokens, refresh tokens, cookies, API keys, or raw credential files.
- Treat `MXS_API_URL`, `MXS_TOKEN`, `MXS_API_KEY`, `--api-url`, `--token`, and `--api-key` as execution context, not content.
- Do not publish to production unless the user explicitly requested publication or the configured target has been confirmed as the intended target.
- If testing the write path without publication, set `<state>draft</state>` or pass `--state draft`.
- After any create, edit, update, publish, or unpublish operation, read the resource back and verify observable fields.
- For destructive operations, prefer `--dry-run` first where supported, then require an explicit user request or confirmed intended target before using `delete --force`.

## Target Confirmation

Before writing, establish the target. See [Auth, Config, And Output](references/auth-config-output.md) for complete auth and configuration behavior.

```bash
mxs auth status --json
mxs auth whoami --json
mxs category list --json
```

If the command returns `fetch failed`, start or select the intended mx-core server before continuing. In this repository, local development normally uses `http://localhost:2333`, with no `/api/v2` prefix.
If writes return `auth.expired` while reads work, confirm whether the available credential is an API key. API keys must be passed through `MXS_API_KEY` or `--api-key`, not `MXS_TOKEN`.

## Command Coverage

The CLI command surface includes `auth`, `post`, `note`, `page`, `category`, `topic`, `comment`, and `config`. Before using an unfamiliar command or flag, read [Command Index](references/command-index.md). Do not infer unsupported flags from another resource type.

## Verification Checklist

| Check | Evidence |
| --- | --- |
| Target | `auth whoami --json` and API URL |
| Category | `category list --json` includes requested slug |
| Topic | `topic list --json` includes requested slug when writing notes |
| Mutation | create/update/publish/unpublish/delete command returns `ok: true` under `--json` |
| Retrieval | matching `get <slugOrId> --json` or `--output llm` succeeds |
| Publication | read-back state matches requested draft, publish, or unpublish state |
| Body | representative content text survives LiteXML or markdown conversion |

## Output Discipline

- Mutations: use `--json`.
- Script reads: use `--json`.
- Agent read-back for document content: use `--output llm` or `--output envelope`.
- Human inspection: use `--output readable` only when requested.
- Troubleshooting: use `--verbose` without printing credentials.
