## TL;DR

Dependency refresh: the AI runtime moves to pi-ai 1.6, which retries more transient provider errors, alongside NestJS 12.6 and Better Auth 1.7.27.

## Changes

- The AI runtime (pi-ai / pi-agent-core) is upgraded from 0.99 to 1.6. More transient provider failures (connection resets, gateway and upstream errors, Cloudflare 525) are now retried automatically, and Anthropic requests continue server-side message threads instead of resending the whole conversation. Tool arguments are validated and coerced against their JSON Schema by pi's own validator. ([ff7860a](https://github.com/mx-space/core/commit/ff7860a07604ef11e85dd40a1dd587422da7625c))
- Server dependencies are refreshed to their latest patch and minor releases, including NestJS 12.6.0, Better Auth 1.7.27, undici 8.13.1, nodemailer 10.6.1 and @fastify/static 10.1.12. ([d314260](https://github.com/mx-space/core/commit/d31426045fa72157b3bc368bd0998c69be892cf9))

---

**Full Changelog**: https://github.com/mx-space/core/compare/v18.2.1...v18.2.2
