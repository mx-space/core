export class VirtualFs {
  private readonly files = new Map<string, Record<string, string>>()
  private readonly journals = new Map<
    string,
    Array<{ op: 'write' | 'patch'; keys: string[] }>
  >()

  write(path: string, content: Record<string, string>): void {
    this.files.set(path, { ...content })
    this.appendJournal(path, { op: 'write', keys: Object.keys(content) })
  }

  read(path: string): Record<string, string> {
    return { ...this.files.get(path) }
  }

  has(path: string): boolean {
    return this.files.has(path)
  }

  applyPatch(
    path: string,
    patches: Record<string, string>,
  ): {
    appliedKeys: string[]
    droppedKeys: string[]
    changes: Array<{ key: string; before: string; after: string }>
  } {
    const file = this.files.get(path)
    const appliedKeys: string[] = []
    const droppedKeys: string[] = []
    const changes: Array<{ key: string; before: string; after: string }> = []
    for (const [key, after] of Object.entries(patches)) {
      if (!file || !(key in file)) {
        droppedKeys.push(key)
        continue
      }
      changes.push({ key, before: file[key], after })
      file[key] = after
      appliedKeys.push(key)
    }
    if (appliedKeys.length > 0) {
      this.appendJournal(path, { op: 'patch', keys: appliedKeys })
    }
    return { appliedKeys, droppedKeys, changes }
  }

  replaceInKey(
    path: string,
    key: string,
    find: string,
    replace: string,
  ):
    | { ok: true; before: string; after: string }
    | {
        ok: false
        reason: 'missing-key' | 'find-not-found' | 'find-ambiguous'
      } {
    const file = this.files.get(path)
    if (!file || !(key in file)) return { ok: false, reason: 'missing-key' }
    const before = file[key]
    const first = before.indexOf(find)
    if (first === -1) return { ok: false, reason: 'find-not-found' }
    if (before.includes(find, first + find.length)) {
      return { ok: false, reason: 'find-ambiguous' }
    }
    const after =
      before.slice(0, first) + replace + before.slice(first + find.length)
    file[key] = after
    this.appendJournal(path, { op: 'patch', keys: [key] })
    return { ok: true, before, after }
  }

  journal(path: string): Array<{ op: 'write' | 'patch'; keys: string[] }> {
    return [...(this.journals.get(path) ?? [])]
  }

  private appendJournal(
    path: string,
    entry: { op: 'write' | 'patch'; keys: string[] },
  ) {
    const list = this.journals.get(path) ?? []
    list.push(entry)
    this.journals.set(path, list)
  }
}
