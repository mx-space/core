import type { MotionValue } from 'motion/react'
import { useMotionValue } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'

/**
 * 通用 1D rAF 半隐式 Euler spring。BottomSheet 与 master-detail push transition 共用。
 *
 * 公式：a = -k * (x - target) - c * vx ；vx += a*dt；x += vx*dt
 *
 * 默认参数与 BottomSheet 同源（STIFFNESS=400, DAMPING=40），故二处 feel 一致。
 */
export interface SpringOptions {
  stiffness?: number
  damping?: number
  /** 起始位置 */
  initial?: number
  /** dt 上限（秒），防 frame stall */
  maxDt?: number
  /** 终止条件：|vx| 与 |x-target| 同时小于此值则停 */
  epsilon?: number
}

export interface SpringHandle {
  /** 当前位置（MotionValue），可绑 `style={{ x }}` 或 `useTransform` 派生 */
  x: MotionValue<number>
  /** 速度（px/s），release 时由 pointer-tracking 注入；spring 内部亦持续更新 */
  vx: { current: number }
  /** 设新 target，rAF 自启 */
  setTarget: (next: number) => void
  /** 直接 set 位置（drag 中），同步入 motion value，**不**启 spring */
  setPosition: (next: number) => void
  /** 注入速度（pointer up 时） */
  setVelocity: (vy: number) => void
  /** 读当前 target */
  getTarget: () => number
  /** 立刻停 rAF（用于 unmount 或 user-grab） */
  stop: () => void
  /** 取当前 x（同步） */
  read: () => number
}

const DEFAULT_STIFFNESS = 400
const DEFAULT_DAMPING = 40
const DEFAULT_MAX_DT = 0.032
const DEFAULT_EPSILON_X = 0.3
const DEFAULT_EPSILON_V = 0.5

export function useSheetSpring(opts: SpringOptions = {}): SpringHandle {
  const k = opts.stiffness ?? DEFAULT_STIFFNESS
  const c = opts.damping ?? DEFAULT_DAMPING
  const maxDt = opts.maxDt ?? DEFAULT_MAX_DT
  const epsX = opts.epsilon ?? DEFAULT_EPSILON_X
  const epsV = opts.epsilon ?? DEFAULT_EPSILON_V

  const x = useMotionValue(opts.initial ?? 0)
  const vxRef = useRef(0)
  const targetRef = useRef(opts.initial ?? 0)
  const rafRef = useRef<number | null>(null)
  const lastTRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    lastTRef.current = null
  }, [])

  const tick = useCallback(
    (now: number) => {
      const last = lastTRef.current
      lastTRef.current = now
      const dt = last == null ? 0 : Math.min((now - last) / 1000, maxDt)
      let cur = x.get()
      let vx = vxRef.current
      const target = targetRef.current
      if (dt > 0) {
        const a = -k * (cur - target) - c * vx
        vx += a * dt
        cur += vx * dt
        x.set(cur)
        vxRef.current = vx
      }
      if (Math.abs(vx) < epsV && Math.abs(cur - target) < epsX) {
        x.set(target)
        vxRef.current = 0
        stop()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [c, epsV, epsX, k, maxDt, stop, x],
  )

  const setTarget = useCallback(
    (next: number) => {
      targetRef.current = next
      if (rafRef.current == null) {
        lastTRef.current = null
        rafRef.current = requestAnimationFrame(tick)
      }
    },
    [tick],
  )

  const setPosition = useCallback(
    (next: number) => {
      x.set(next)
    },
    [x],
  )

  const setVelocity = useCallback((vy: number) => {
    vxRef.current = vy
  }, [])

  const getTarget = useCallback(() => targetRef.current, [])
  const read = useCallback(() => x.get(), [x])

  useEffect(() => stop, [stop])

  return {
    x,
    vx: vxRef,
    setTarget,
    setPosition,
    setVelocity,
    getTarget,
    stop,
    read,
  }
}
