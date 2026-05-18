import { confirm, isCancel } from '@clack/prompts'

import { MxsError, MxsErrorCode } from '../../core/errors'
import { emitInfo, emitSuccess, type OutputOptions } from '../../core/output'
import {
  buildUpgradeCommand,
  type Channel,
  compareSemver,
  detectPackageManager,
  fetchLatestVersion,
  type PmKind,
  resolveCliEntrypoint,
  satisfiesNodeEngine,
  spawnUpgrade,
} from '../../core/self-update'
import type { GlobalFlags } from '../internal/shared'

export interface UpdateOpts {
  check?: boolean
  prerelease?: boolean
  pm?: string
  force?: boolean
  yes?: boolean
}

const KNOWN_PMS: ReadonlySet<PmKind> = new Set<PmKind>([
  'npm',
  'pnpm',
  'yarn',
  'bun',
])

export async function run(
  opts: UpdateOpts,
  flags: GlobalFlags,
  out: OutputOptions,
  currentVersion: string,
): Promise<void> {
  const channel: Channel = opts.prerelease ? 'next' : 'stable'

  // 1. Detect package manager
  const entry = resolveCliEntrypoint()
  const detection = detectPackageManager(entry)

  let pm: PmKind
  if (opts.pm) {
    if (!KNOWN_PMS.has(opts.pm as PmKind)) {
      throw new MxsError({
        code: MxsErrorCode.UpdatePmUnknown,
        message: `unknown package manager '${opts.pm}'`,
        hint: 'supported values: npm | pnpm | yarn | bun',
      })
    }
    pm = opts.pm as PmKind
  } else {
    switch (detection.kind) {
      case 'dev': {
        throw new MxsError({
          code: MxsErrorCode.UpdateDevEnvironment,
          message:
            'dev install detected; mxs is running from the monorepo source tree',
          hint: 'pull the repo with `git pull` and rebuild instead of self-updating',
        })
      }
      case 'transient': {
        throw new MxsError({
          code: MxsErrorCode.UpdateTransientInstall,
          message: `mxs is running from a transient ${detection.cache} cache`,
          hint: 'install mxs globally first, e.g. `npm i -g @mx-space/cli` or `pnpm add -g @mx-space/cli`',
        })
      }
      case 'unknown': {
        throw new MxsError({
          code: MxsErrorCode.UpdatePmUnknown,
          message: 'unable to detect the package manager that installed mxs',
          hint: 'pass --pm <npm|pnpm|yarn|bun> to override detection',
          details: { realPath: detection.realPath },
        })
      }
      case 'global': {
        pm = detection.pm
        break
      }
    }
  }

  // 2. Fetch latest from registry
  let hit
  try {
    const result = await fetchLatestVersion(channel)
    if ('notModified' in result && result.notModified) {
      throw new Error('unexpected 304 without an etag')
    }
    hit = result
  } catch (err) {
    throw new MxsError({
      code: MxsErrorCode.UpdateRegistryUnreachable,
      message: 'unable to reach the npm registry',
      hint: 'check your network connection or set MXS_NO_UPDATE_CHECK=1 to silence the notifier',
      cause: err,
    })
  }

  const cmp = compareSemver(currentVersion, hit.version)
  if (cmp >= 0) {
    emitSuccess(
      {
        current: currentVersion,
        latest: hit.version,
        channel,
        up_to_date: true,
      },
      out,
    )
    if (!out.json) {
      emitInfo(`mxs: already up to date (${currentVersion})`, out)
    }
    return
  }

  // 3. Node engine compatibility
  if (
    hit.engines?.node &&
    !satisfiesNodeEngine(process.versions.node, hit.engines.node)
  ) {
    throw new MxsError({
      code: MxsErrorCode.UpdateNodeIncompatible,
      message: `mxs ${hit.version} requires Node ${hit.engines.node} (current: v${process.versions.node})`,
      hint: 'upgrade Node first, then re-run `mxs update`',
    })
  }

  // 4. Announce
  if (!out.json) {
    emitInfo(
      `mxs: ${currentVersion} → ${hit.version}  (channel: ${channel}, pm: ${pm})`,
      out,
    )
  }

  if (opts.check) {
    emitSuccess(
      {
        current: currentVersion,
        latest: hit.version,
        channel,
        pm,
        up_to_date: false,
      },
      out,
    )
    return
  }

  const { cmd, args } = buildUpgradeCommand(pm, channel)

  if (flags.dryRun) {
    const shown = `${cmd} ${args.join(' ')}`
    emitSuccess(
      {
        current: currentVersion,
        latest: hit.version,
        channel,
        pm,
        command: shown,
        dry_run: true,
      },
      out,
    )
    if (!out.json) emitInfo(`mxs: would run: ${shown}`, out)
    return
  }

  // 5. Confirmation
  const interactive =
    Boolean(process.stdin.isTTY) && Boolean(process.stderr.isTTY) && !out.json
  if (!opts.yes && interactive) {
    const ok = await confirm({
      message: `Run \`${cmd} ${args.join(' ')}\` to upgrade?`,
    })
    if (isCancel(ok) || !ok) {
      emitInfo('mxs: update cancelled', out)
      return
    }
  }

  // 6. Spawn
  const result = await spawnUpgrade(cmd, args, {})
  if (result.status === 0) {
    emitSuccess(
      {
        current: currentVersion,
        latest: hit.version,
        channel,
        pm,
        upgraded: true,
      },
      out,
    )
    if (!out.json) {
      emitInfo(
        `mxs: upgraded to ${hit.version}. Restart any long-running mxs process.`,
        out,
      )
    }
    return
  }

  if (/eacces|permission denied/i.test(result.stderr)) {
    throw new MxsError({
      code: MxsErrorCode.UpdatePermissionDenied,
      message:
        'package manager could not write to the global install directory',
      hint: `rerun with elevated permissions, e.g. \`sudo ${cmd} ${args.join(' ')}\``,
    })
  }

  throw new MxsError({
    code: MxsErrorCode.UpdateSpawnFailed,
    message: `${cmd} exited with status ${result.status}`,
    hint: `rerun with \`mxs update --dry-run\` to inspect the exact command`,
  })
}
