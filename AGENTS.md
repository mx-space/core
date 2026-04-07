# Repository Guidelines

This document provides the technical standards and operational procedures for contributors to the `mx-core` repository.

## Project Structure

The repository is organized as a `pnpm` monorepo.

| Directory | Purpose |
| :--- | :--- |
| `apps/core` | Primary NestJS backend application and API |
| `packages/` | Shared internal libraries and modular components |
| `assets/` | Static assets and resource files |
| `configs/` | Environment and system configuration files |
| `scripts/` | Automation, maintenance, and utility scripts |
| `bin/` | CLI tools and executable binaries |

## Development Workflow

### Core Commands

| Command | Action | Description |
| :--- | :--- | :--- |
| `pnpm install` | Setup | Install all workspace dependencies |
| `pnpm dev` | Execution | Start the core application in development mode |
| `pnpm build` | Compilation | Build the production bundle for `@mx-space/core` |
| `pnpm test` | Validation | Execute the Vitest test suite |
| `pnpm lint` | Quality | Run ESLint and apply automatic fixes |
| `pnpm typecheck` | Analysis | Perform a full TypeScript type check |
| `pnpm format` | Style | Apply Prettier formatting across the project |

## Engineering Standards

### Coding Style
- **Runtime**: Node.js $\ge$ 22.
- **Stack**: TypeScript, NestJS, and Fastify.
- **Formatting**: Prettier is enforced. All commits are validated via `lint-staged` to ensure consistent style.
- **Linting**: ESLint is used with `@lobehub/eslint-config`.
- **Naming Conventions**:
    - Classes/Interfaces: `PascalCase`
    - Variables/Functions: `camelCase`
    - Constants: `SCREAMING_SNAKE_CASE`

### Testing Guidelines
- **Framework**: Vitest.
- **Approach**: Prioritize behavioral and regression testing over implementation snapshots.
- **Execution**: Run tests using `pnpm test` within a development environment.
- **Verification**: New features must include corresponding tests that validate externally meaningful outcomes.

## Contribution Process

### Commit Guidelines
- **Hooks**: The project uses `simple-git-hooks` to prevent the commitment of unlinted or incorrectly formatted code.
- **Consistency**: Ensure all changes align with the established naming and style patterns before pushing.

### Pull Request Requirements
- **Traceability**: PRs must be linked to a relevant issue.
- **Documentation**: Any changes to the API or system configuration must be reflected in the accompanying documentation.
- **Validation**: PRs should include evidence of testing and verification for the proposed changes.
