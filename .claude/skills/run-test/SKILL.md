---
name: run-test
description: Run tests. Supports running all tests, single file, or pattern-matched tests.
argument-hint: [file-path|pattern]
disable-model-invocation: true
allowed-tools: Bash(pnpm test*), Bash(cd *), Read, Glob
---

# Run Tests

Run project tests. Arguments: `$ARGUMENTS`

## Test Commands

### Run All Tests

```bash
pnpm test
```

### Run Single Test File

```bash
# Using relative path (from apps/core directory)
pnpm test -- test/src/modules/post/post.controller.e2e-spec.ts

# Using filename pattern
pnpm test -- --testNamePattern="PostController"
```

### Watch Mode

```bash
pnpm -C apps/core run test:watch
```

### Run Specific Test Case

```bash
# Match test name
pnpm test -- --testNamePattern="should create post"
```

## Test Directory Structure

```
apps/core/test/
├── src/
│   ├── modules/           # Module tests
│   │   ├── post/
│   │   │   ├── post.controller.e2e-spec.ts
│   │   │   └── post.e2e-mock.db.ts
│   │   ├── user/
│   │   │   ├── user.controller.spec.ts
│   │   │   ├── user.controller.e2e-spec.ts
│   │   │   └── user.service.spec.ts
│   │   └── ...
│   ├── utils/             # Utility tests
│   ├── processors/        # Processor tests
│   └── transformers/      # Transformer tests
├── helper/                # Test helpers
├── mock/                  # Mock implementations
└── setup-global.ts        # Global setup
```

## Test Types

| Suffix | Type | Description |
|--------|------|-------------|
| `.spec.ts` | Unit test | Test single function or class |
| `.e2e-spec.ts` | E2E test | Test complete HTTP request flow |

## Execution Steps

1. Analyze arguments to determine which tests to run
2. If file path specified, verify file exists first
3. Execute appropriate test command
4. Report test results

## Common Issues

### Test Timeout

Increase timeout:

```bash
pnpm test -- --testTimeout=30000
```

### Memory Issues

Tests use in-memory database. If memory issues occur:

```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm test
```

### Run Only Failed Tests

```bash
pnpm test -- --reporter=verbose
```
