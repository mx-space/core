/**
 * @deprecated Compat shim for the V2 → V3 mx-core wire-format transition.
 *
 * Remove this file once all deployments referenced by the CLI's user base are
 * confirmed V3 (`API_VERSION = 3` in mx-core). Removal checklist:
 *
 *   1. Delete this file (`envelope-compat.ts`) and its test
 *      (`test/domain/envelope-compat.test.ts`).
 *   2. In `src/services/Api.ts`, `grep -n 'COMPAT:envelope'` and delete the
 *      two normalizer calls + the `Ref<WireVersion>` field + verbose log
 *      annotation.
 *   3. In `src/services/Config.ts`, change `parsed.apiVersion ?? 2` to
 *      `?? 3`.
 *   4. In `test/integration/cli-post-list.test.ts` and
 *      `test/integration/cli-error-envelope.test.ts`, drop the V2 `it`
 *      block; keep only the V3 mock.
 *   5. Run `pnpm -C packages/cli typecheck && pnpm -C packages/cli test` —
 *      no references should remain.
 *
 * Full design: `packages/cli/docs/specs/2026-05-21-v2-v3-envelope-compat-layer.md`.
 */

export type WireVersion = 'v2' | 'v3'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Sniff the wire version from a parsed response body. Returns `null` if the
 * body is too small (raw scalar, FormData echo, dry-run synthetic) to decide.
 * Callers must tolerate `null`.
 *
 * V3 markers (any one suffices):
 *   - object has a `meta` key, OR
 *   - object has `error.code` (string) or `error.message` (string).
 *
 * V2 markers (any one):
 *   - object has a root-level `pagination` key, OR
 *   - object has a root-level `message: string | string[]` and no `error` key.
 *
 * When both V2 and V3 markers are present, V3 wins.
 */
export const detectWireVersion = (body: unknown): WireVersion | null => {
  if (!isRecord(body)) return null

  // V3 markers win.
  if ('meta' in body) return 'v3'
  if (isRecord(body.error)) {
    const err = body.error
    if (typeof err.code === 'string' || typeof err.message === 'string') {
      return 'v3'
    }
  }

  // V2 markers.
  if ('pagination' in body) return 'v2'
  if (
    !('error' in body) &&
    (typeof body.message === 'string' ||
      (Array.isArray(body.message) &&
        body.message.every((m) => typeof m === 'string')))
  ) {
    return 'v2'
  }

  return null
}

/**
 * Normalize a 2xx response body to the V3 shape `{ data, meta? }`.
 *
 *   - V3 (`{ data, meta? }`)                  → returned as-is
 *   - V2 paginated (`{ data, pagination }`)   → `{ data, meta: { pagination } }`
 *   - V2 bare (`{ data }`)                    → returned as-is
 *   - Anything else (arrays, scalars, non-object, already-unwrapped doc) → unchanged
 *
 * Shape-tolerant: unrecognized inputs pass through unchanged. Never mutates
 * the input.
 */
export const normalizeSuccessBody = (body: unknown): unknown => {
  if (!isRecord(body)) return body

  // Already V3 (or carries a meta block) — pass through.
  if ('meta' in body) return body

  // V2 paginated: lift root `pagination` under `meta`.
  if ('data' in body && 'pagination' in body) {
    const { pagination, ...rest } = body
    return { ...rest, meta: { pagination } }
  }

  return body
}

export interface NormalizedError {
  code?: string
  message?: string
  details?: unknown
}

/**
 * Normalize a non-2xx response body to a flat `{ code?, message?, details? }`
 * tuple.
 *
 *   - V3 (`{ error: { code, message, details? } }`) → unwrapped
 *   - V2 (`{ message: string | string[], code?, details? }`) → flattened.
 *     Array messages join with `'; '` to match the legacy `extractMessage`
 *     helper in `api-envelope.ts`.
 *   - Non-object body → `{}`
 *
 * Never throws, never mutates.
 */
export const normalizeErrorBody = (body: unknown): NormalizedError => {
  if (!isRecord(body)) return {}

  // V3 shape.
  if (isRecord(body.error)) {
    const err = body.error
    return {
      code: typeof err.code === 'string' ? err.code : undefined,
      message: typeof err.message === 'string' ? err.message : undefined,
      details: err.details,
    }
  }

  // V2 shape — flat.
  const rawMsg = body.message
  let message: string | undefined
  if (typeof rawMsg === 'string') {
    message = rawMsg
  } else if (
    Array.isArray(rawMsg) &&
    rawMsg.every((m) => typeof m === 'string')
  ) {
    message = (rawMsg as string[]).join('; ')
  }
  const code = typeof body.code === 'string' ? body.code : undefined
  return { code, message, details: body.details }
}
