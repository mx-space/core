export class RippleMotion {
  readonly values: Float32Array
  private target: Float32Array

  constructor(initial: readonly number[]) {
    this.values = new Float32Array(initial)
    this.target = new Float32Array(initial)
  }

  setTarget(next: readonly number[], immediate = false) {
    this.target.set(next)
    if (immediate) this.values.set(next)
  }

  advance(elapsedMs: number) {
    const ease = 1 - Math.exp(-Math.max(0, Math.min(elapsedMs, 100)) / 235)
    for (let i = 0; i < this.values.length; i++) {
      this.values[i] += (this.target[i] - this.values[i]) * ease
    }
  }
}
