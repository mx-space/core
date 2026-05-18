import { FileSystem, Path } from '@effect/platform'
import { SystemError } from '@effect/platform/Error'
import { Effect, Layer } from 'effect'

// ---------------------------------------------------------------------------
// In-memory FileSystem implementation for unit tests.
//
// Models a flat path-keyed map for files plus a separate Set for directories.
// Supports the surface used by Config / Profile / Migration services:
//   readFileString, writeFileString, readDirectory, makeDirectory, stat,
//   remove (force/recursive), chmod, exists.
// ---------------------------------------------------------------------------

interface FileNode {
  readonly type: 'file'
  data: string
  mode: number
}

interface DirNode {
  readonly type: 'dir'
  mode: number
}

type Node = FileNode | DirNode

const notFound = (method: string, path: string): SystemError =>
  new SystemError({
    reason: 'NotFound',
    module: 'FileSystem',
    method,
    pathOrDescriptor: path,
    description: `ENOENT: no such file or directory, ${path}`,
  })

const normalize = (p: string): string => p.replace(/\/+$/, '') || '/'

const parentOf = (p: string): string => {
  const norm = normalize(p)
  const idx = norm.lastIndexOf('/')
  if (idx <= 0) return '/'
  return norm.slice(0, idx)
}

export interface MemFs {
  readonly nodes: Map<string, Node>
  readonly seed: (path: string, data: string, mode?: number) => void
  readonly mkdir: (path: string, mode?: number) => void
  readonly has: (path: string) => boolean
  readonly readFile: (path: string) => string | null
  readonly mode: (path: string) => number | null
}

export const makeMemFs = (): MemFs => {
  const nodes = new Map<string, Node>()

  const seed = (path: string, data: string, mode = 0o644): void => {
    const p = normalize(path)
    // Auto-create ancestor directories.
    let dir = parentOf(p)
    while (dir && dir !== '/' && !nodes.has(dir)) {
      nodes.set(dir, { type: 'dir', mode: 0o755 })
      dir = parentOf(dir)
    }
    nodes.set(p, { type: 'file', data, mode })
  }

  const mkdir = (path: string, mode = 0o755): void => {
    const p = normalize(path)
    let dir = parentOf(p)
    while (dir && dir !== '/' && !nodes.has(dir)) {
      nodes.set(dir, { type: 'dir', mode: 0o755 })
      dir = parentOf(dir)
    }
    nodes.set(p, { type: 'dir', mode })
  }

  return {
    nodes,
    seed,
    mkdir,
    has: (p) => nodes.has(normalize(p)),
    readFile: (p) => {
      const n = nodes.get(normalize(p))
      return n && n.type === 'file' ? n.data : null
    },
    mode: (p) => {
      const n = nodes.get(normalize(p))
      return n ? n.mode : null
    },
  }
}

const fakeInfo = (node: Node, size = 0): FileSystem.File.Info =>
  ({
    type: node.type === 'dir' ? 'Directory' : 'File',
    mtime: { _tag: 'None' } as any,
    atime: { _tag: 'None' } as any,
    birthtime: { _tag: 'None' } as any,
    dev: 0,
    ino: { _tag: 'None' } as any,
    mode: node.mode,
    nlink: { _tag: 'None' } as any,
    uid: { _tag: 'None' } as any,
    gid: { _tag: 'None' } as any,
    rdev: { _tag: 'None' } as any,
    size: BigInt(size) as any,
    blksize: { _tag: 'None' } as any,
    blocks: { _tag: 'None' } as any,
  }) as unknown as FileSystem.File.Info

export const TestFsLive = (mem: MemFs): Layer.Layer<FileSystem.FileSystem> =>
  FileSystem.layerNoop({
    readFileString: (path: string) => {
      const node = mem.nodes.get(normalize(path))
      if (!node || node.type !== 'file') {
        return Effect.fail(notFound('readFileString', path))
      }
      return Effect.succeed(node.data)
    },
    writeFileString: (path: string, data: string, options?: { mode?: number }) =>
      Effect.sync(() => {
        const p = normalize(path)
        // Auto-create parent directory tree if missing — matches real fs only
        // when `recursive: true` was used to mkdir, but tests rely on it.
        let dir = parentOf(p)
        while (dir && dir !== '/' && !mem.nodes.has(dir)) {
          mem.nodes.set(dir, { type: 'dir', mode: 0o755 })
          dir = parentOf(dir)
        }
        mem.nodes.set(p, {
          type: 'file',
          data,
          mode: options?.mode ?? 0o644,
        })
      }),
    makeDirectory: (path: string, options?: { mode?: number; recursive?: boolean }) =>
      Effect.sync(() => {
        const p = normalize(path)
        if (options?.recursive) {
          let dir = parentOf(p)
          while (dir && dir !== '/' && !mem.nodes.has(dir)) {
            mem.nodes.set(dir, { type: 'dir', mode: 0o755 })
            dir = parentOf(dir)
          }
        }
        mem.nodes.set(p, { type: 'dir', mode: options?.mode ?? 0o755 })
      }),
    readDirectory: (path: string) => {
      const dir = normalize(path)
      if (!mem.nodes.has(dir)) {
        return Effect.fail(notFound('readDirectory', path))
      }
      const prefix = dir === '/' ? '/' : `${dir}/`
      const out: string[] = []
      for (const key of mem.nodes.keys()) {
        if (key === dir) continue
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        if (rest.includes('/')) continue
        out.push(rest)
      }
      return Effect.succeed(out.sort())
    },
    stat: (path: string) => {
      const node = mem.nodes.get(normalize(path))
      if (!node) return Effect.fail(notFound('stat', path))
      const size = node.type === 'file' ? node.data.length : 0
      return Effect.succeed(fakeInfo(node, size))
    },
    remove: (path: string, options?: { recursive?: boolean; force?: boolean }) =>
      Effect.suspend(() => {
        const p = normalize(path)
        const node = mem.nodes.get(p)
        if (!node) {
          return options?.force
            ? Effect.void
            : Effect.fail(notFound('remove', path))
        }
        if (node.type === 'dir' && options?.recursive) {
          const prefix = `${p}/`
          for (const key of [...mem.nodes.keys()]) {
            if (key === p || key.startsWith(prefix)) mem.nodes.delete(key)
          }
        } else {
          mem.nodes.delete(p)
        }
        return Effect.void
      }),
    chmod: (path: string, mode: number) =>
      Effect.suspend(() => {
        const p = normalize(path)
        const node = mem.nodes.get(p)
        if (!node) return Effect.fail(notFound('chmod', path))
        ;(node as Node).mode = mode
        return Effect.void
      }),
    exists: (path: string) => Effect.succeed(mem.nodes.has(normalize(path))),
  })

export const TestPathLive: Layer.Layer<Path.Path> = Path.layer
