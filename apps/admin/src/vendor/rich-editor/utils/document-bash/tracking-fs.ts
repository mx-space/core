import { InMemoryFs } from 'just-bash'

function readonlyEntries(paths: string[]) {
  const files = new Set(paths)
  const dirs = new Set<string>()
  for (const path of paths) {
    let dir = path.slice(0, path.lastIndexOf('/'))
    while (dir) {
      dirs.add(dir)
      dir = dir.slice(0, dir.lastIndexOf('/'))
    }
  }
  return { dirs, files }
}

export class TrackingFs extends InMemoryFs {
  touched: Set<string> | null = null
  refused: Set<string> | null = null
  written: Set<string> | null = null
  private readonly readonly: ReturnType<typeof readonlyEntries>
  private readonly locked: Set<string>

  constructor(
    files: Record<string, string>,
    readonlyPaths: string[] = [],
    lockedFiles: string[] = [],
  ) {
    super(files)
    this.readonly = readonlyEntries(readonlyPaths)
    this.locked = new Set(lockedFiles)
  }

  private guard(...paths: string[]) {
    const { dirs, files } = this.readonly
    for (const raw of paths) {
      const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw
      const parent = path.slice(0, path.lastIndexOf('/'))
      if (
        files.has(path) ||
        dirs.has(path) ||
        dirs.has(parent) ||
        this.locked.has(path)
      ) {
        this.refused?.add(path)
        throw new Error(`EROFS: read-only file system, '${path}'`)
      }
      this.written?.add(path)
    }
  }

  lock(path: string) {
    this.locked.add(path)
  }

  private async mark(...paths: string[]) {
    const touched = this.touched
    if (!touched) return
    for (const path of paths) {
      touched.add(path)
      try {
        touched.add(await this.realpath(path))
      } catch {
        // A destination that does not exist yet has no real path.
      }
    }
  }

  override async readFile(...args: Parameters<InMemoryFs['readFile']>) {
    await this.mark(args[0])
    return super.readFile(...args)
  }

  override async readFileBytes(
    ...args: Parameters<InMemoryFs['readFileBytes']>
  ) {
    await this.mark(args[0])
    return super.readFileBytes(...args)
  }

  override async readFileBuffer(
    ...args: Parameters<InMemoryFs['readFileBuffer']>
  ) {
    await this.mark(args[0])
    return super.readFileBuffer(...args)
  }

  override async writeFile(...args: Parameters<InMemoryFs['writeFile']>) {
    this.guard(args[0])
    await this.mark(args[0])
    return super.writeFile(...args)
  }

  override async appendFile(...args: Parameters<InMemoryFs['appendFile']>) {
    this.guard(args[0])
    await this.mark(args[0])
    return super.appendFile(...args)
  }

  override async cp(...args: Parameters<InMemoryFs['cp']>) {
    this.guard(args[1])
    await this.mark(args[0], args[1])
    return super.cp(...args)
  }

  override async mv(...args: Parameters<InMemoryFs['mv']>) {
    this.guard(args[0], args[1])
    await this.mark(args[0], args[1])
    return super.mv(...args)
  }

  override async rm(...args: Parameters<InMemoryFs['rm']>) {
    this.guard(args[0])
    return super.rm(...args)
  }

  override async mkdir(...args: Parameters<InMemoryFs['mkdir']>) {
    this.guard(args[0])
    return super.mkdir(...args)
  }

  override async createExclusive(
    ...args: Parameters<InMemoryFs['createExclusive']>
  ) {
    this.guard(args[0])
    return super.createExclusive(...args)
  }

  override async chmod(...args: Parameters<InMemoryFs['chmod']>) {
    this.guard(args[0])
    return super.chmod(...args)
  }

  override async utimes(...args: Parameters<InMemoryFs['utimes']>) {
    this.guard(args[0])
    return super.utimes(...args)
  }

  override async symlink(...args: Parameters<InMemoryFs['symlink']>) {
    this.guard(args[1])
    return super.symlink(...args)
  }

  override async link(...args: Parameters<InMemoryFs['link']>) {
    this.guard(args[1])
    return super.link(...args)
  }
}
