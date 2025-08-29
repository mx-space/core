# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MX Space is a personal blog server application built with NestJS, MongoDB, and Redis. This is a monorepo containing the core server application and related packages. The main application is located in `apps/core/`.

## Development Commands

All commands should be run from the repository root unless specified otherwise.

### Core Development Commands
- `pnpm dev` - Start development server (builds externals then starts core app)
- `pnpm build` - Build the entire project (externals + core)
- `pnpm bundle` - Create production bundle
- `pnpm test` - Run tests
- `pnpm lint` - Run ESLint on core app
- `pnpm format` - Format code with Prettier

### Core App Specific Commands (run from `apps/core/`)
- `npm run start` - Start development server with watch mode
- `npm run start:cluster` - Start in cluster mode with 2 workers
- `npm run start:debug` - Start with debug mode
- `npm run repl` - Start REPL mode
- `npm run test:watch` - Run tests in watch mode
- `npm run build:webpack` - Build with webpack (alternative build method)

## Architecture Overview

### Directory Structure
- `apps/core/` - Main NestJS application
  - `src/modules/` - Business logic modules (auth, posts, comments, etc.)
  - `src/processors/` - Infrastructure services (database, redis, gateway, helpers)
  - `src/common/` - Shared utilities (guards, interceptors, decorators, etc.)
  - `src/migration/` - Database migration scripts
  - `test/` - Test files and mocks
- `packages/` - Shared packages
- `external/` - External dependencies with custom implementations

### Key Architectural Patterns

**Modular Design**: Each business domain has its own module (posts, comments, auth, etc.) with controllers, services, DTOs, and models.

**Processors**: Infrastructure services are organized in `processors/`:
- `database/` - MongoDB connection and models
- `redis/` - Redis caching and pub/sub
- `gateway/` - WebSocket gateways for real-time features
- `helper/` - Utility services (email, image processing, etc.)

**Common Layer**: Shared functionality in `src/common/`:
- Guards for authentication and authorization
- Interceptors for response transformation, caching, and logging
- Decorators for common patterns
- Exception filters

### Database Models
Uses Mongoose with TypeGoose for type-safe MongoDB models. All models extend a base model with common fields like `_id`, `created`, `updated`.

### Authentication
JWT-based authentication with role-based access control. Uses decorators like `@Auth()` and `@CurrentUser()` for protection.

### Caching Strategy
Redis-based caching with cache interceptors. Uses conditional caching based on request patterns.

## Configuration

The application uses a command-line interface for configuration (`src/app.config.ts`). Key configuration includes:
- Database connection (MongoDB)
- Redis configuration
- JWT settings
- CORS settings
- Cluster mode options

Configuration can be provided via:
- Environment variables
- Command line arguments
- YAML configuration files

## Testing

Uses Vitest for testing with:
- E2E tests for controllers
- Unit tests for services and utilities
- Mock implementations for external dependencies
- In-memory MongoDB and Redis for testing

Test files are located in `test/` directory with mocks in `test/mock/`.

## Development Patterns

### Controllers
- Use `@ApiController()` decorator for API controllers
- Implement proper DTOs for request/response validation
- Use guards and interceptors for cross-cutting concerns

### Services
- Implement business logic in services
- Use dependency injection for database and external services
- Handle errors appropriately with custom exceptions

### Models
- Use TypeGoose for MongoDB models
- Implement proper indexes and relationships
- Use plugins for common functionality (pagination, auto-increment)

### DTOs
- Use class-validator for input validation
- Implement proper transformation decorators
- Group related DTOs by module

## Build and Deployment

The application supports multiple build methods:
- Standard NestJS build (`nest build`)
- Webpack build for optimized bundles
- Bundle script for production deployment

Deployment uses PM2 with ecosystem configuration files for cluster management.

## Key Dependencies

- **NestJS** - Main framework
- **Mongoose/TypeGoose** - MongoDB ODM
- **Fastify** - HTTP server (instead of Express)
- **Redis** - Caching and pub/sub
- **Socket.IO** - WebSocket support
- **class-validator** - Input validation
- **Vitest** - Testing framework

## Common Development Tasks

### Adding a New Module
1. Create module directory in `src/modules/`
2. Implement controller, service, model, and DTOs
3. Add module to `app.module.ts`
4. Write tests in corresponding test directory

### Database Migrations
- Migration scripts located in `src/migration/version/`
- Use helper functions for common migration tasks
- Version migrations by application version

### Adding Tests
- Create test files with `.spec.ts` or `.e2e-spec.ts` suffix
- Use mock helpers from `test/helper/`
- Use test setup files for common configuration