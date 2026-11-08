export class UpgradeError extends Error {
  constructor(
    public readonly code: string,
    public readonly path?: string,
  ) {
    super(path ? `${code} (${path})` : code)
  }
}
