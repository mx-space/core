# AI Implementation Guidelines

## Documentation Maintenance

When implementing or completing user-facing `mxs` CLI functionality, update `packages/cli/README.md` in the same change set before considering the task complete.

- Add newly implemented commands, flags, output modes, authentication behavior, configuration behavior, and file formats to the README.
- Prefer concise updates under existing command, option, or capability sections instead of creating broad new sections.
- Do not add documentation churn for purely internal refactors, test-only changes, mechanical dependency updates, or bug fixes whose observable CLI behavior remains unchanged.
- When a feature affects both human and AI-agent usage, document the machine-readable and readable output contracts explicitly.
