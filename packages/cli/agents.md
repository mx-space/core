# AI Implementation Guidelines

## Skill bundle

`mxs skill` is the canonical entry point for downstream AI agents. The chapter set covers commands, authoring workflows, liteXML, target selection, output modes, and safety. Use `mxs skill` to enumerate, `mxs skill get <slug>` to load one chapter, `mxs skill all` for everything, and `mxs skill search <kw>` for substring lookup. Default output is raw markdown (`--output llm`) suitable for context injection.

When changing CLI surface, update the corresponding chapter under `packages/cli/skills/*.md` in the same change set so agents see current behaviour.

## Documentation Maintenance

When implementing or completing user-facing `mxs` CLI functionality, update `packages/cli/README.md` in the same change set before considering the task complete.

- Add newly implemented commands, flags, output modes, authentication behavior, configuration behavior, and file formats to the README.
- Prefer concise updates under existing command, option, or capability sections instead of creating broad new sections.
- Do not add documentation churn for purely internal refactors, test-only changes, mechanical dependency updates, or bug fixes whose observable CLI behavior remains unchanged.
- When a feature affects both human and AI-agent usage, document the machine-readable and readable output contracts explicitly.
