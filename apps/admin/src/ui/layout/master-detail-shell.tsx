import type { PanInfo } from 'motion/react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Group as PanelGroup,
  Panel as ResizablePanel,
} from 'react-resizable-panels'
import { useNavigate, useOutlet } from 'react-router'

import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '~/hooks/use-media-query'
import { ResizeHandle } from '~/ui/layout/resize-handle'
import { cn } from '~/utils/cn'

/** List 之默认宽度（像素）。group 改尺寸时保 pixel-size 不变。 */
const DEFAULT_LIST_PIXELS = 320
const DEFAULT_LIST_MIN_PIXELS = 240
const DEFAULT_LIST_MAX_PIXELS = 560

/** iOS-canonical parallax ratio：list 背向左推 0.25 * (W - x) */
const LIST_PARALLAX = 0.25

/** Spring 物理参数（与 BottomSheet 同源） */
const SPRING_TRANSITION = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 40,
}

/** 释放后投影时长（秒） */
const PROJECTION_SECONDS = 0.2

/** Velocity 阈：> 800 px/s 视为 fling */
const FLING_VX = 800

/** Pointer-down clientX < EDGE_ZONE 方为"边缘 swipe" */
const EDGE_ZONE = 20

interface MasterDetailContextValue {
  /** Desktop aside DOM 节点，供未来扩展（portal target）；当前不必用 */
  asideEl: HTMLDivElement | null
}

const MasterDetailContext = createContext<MasterDetailContextValue | null>(null)

export interface MasterDetailShellProps {
  list: ReactNode
  /** Desktop 无 detail 时之占位；mobile 不显 */
  emptyDetail?: ReactNode
  /** List panel 之默认宽度（像素） */
  defaultSize?: number
  /** List panel 之最小宽度（像素） */
  minSize?: number
  /** List panel 之最大宽度（像素） */
  maxSize?: number
  className?: string
  listClassName?: string
  detailClassName?: string
  /**
   * 强制 mobile 关 detail 时之自定义返回行为。默认为 `navigate(-1)`。
   * 当 history 起点即 detail（如分享链接直入）时，可传 `() => navigate('/drafts')`。
   */
  onDismiss?: () => void
}

/**
 * Master-detail layout shell。Desktop 双栏，mobile nav stack。
 *
 * Detail 由 React Router 子 route 自然 mount 至 `<Outlet/>`。Shell 读 `useOutlet()`
 * 决定 desktop 是否填 aside、mobile 是否推 detail overlay。
 *
 * Mobile 上：list 永驻 base layer，detail 自右推入，list 视差左移 0.25 * (W - x)。
 * Edge swipe-back（左 20px 起拖）可拖动 detail 至右；release 时按 velocity-projection
 * 决 dismiss 或 cancel。Programmatic 返回（header back / Esc）由 `onDismiss`/`navigate(-1)`
 * 触发，AnimatePresence 之 exit 动画自动收尾。
 */
export function MasterDetailShell(props: MasterDetailShellProps) {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY)
  const outlet = useOutlet()
  const navigate = useNavigate()
  const [asideEl, setAsideEl] = useState<HTMLDivElement | null>(null)

  const ctxValue = useMemo<MasterDetailContextValue>(
    () => ({ asideEl }),
    [asideEl],
  )

  const handleDismiss = useCallback(() => {
    if (props.onDismiss) props.onDismiss()
    else navigate(-1)
  }, [navigate, props])

  return (
    <MasterDetailContext.Provider value={ctxValue}>
      {isDesktop ? (
        <DesktopShell
          asideRef={setAsideEl}
          className={props.className}
          defaultSize={props.defaultSize}
          detailClassName={props.detailClassName}
          emptyDetail={props.emptyDetail}
          hasDetail={outlet != null}
          list={props.list}
          listClassName={props.listClassName}
          maxSize={props.maxSize}
          minSize={props.minSize}
          outlet={outlet}
        />
      ) : (
        <MobileShell
          className={props.className}
          detailClassName={props.detailClassName}
          list={props.list}
          listClassName={props.listClassName}
          onDismiss={handleDismiss}
          outlet={outlet}
        />
      )}
    </MasterDetailContext.Provider>
  )
}

interface DesktopShellProps {
  asideRef: (el: HTMLDivElement | null) => void
  className?: string
  defaultSize?: number
  detailClassName?: string
  emptyDetail?: ReactNode
  hasDetail: boolean
  list: ReactNode
  listClassName?: string
  maxSize?: number
  minSize?: number
  outlet: ReactNode
}

function DesktopShell(props: DesktopShellProps) {
  const defaultSize = props.defaultSize ?? DEFAULT_LIST_PIXELS
  const minSize = props.minSize ?? DEFAULT_LIST_MIN_PIXELS
  const maxSize = props.maxSize ?? DEFAULT_LIST_MAX_PIXELS

  return (
    <div
      className={cn(
        'relative h-full min-h-0 overflow-hidden bg-white dark:bg-neutral-950',
        props.className,
      )}
    >
      <PanelGroup className="flex h-full min-h-0" orientation="horizontal">
        <ResizablePanel
          className={cn('min-h-0 overflow-hidden', props.listClassName)}
          defaultSize={defaultSize}
          groupResizeBehavior="preserve-pixel-size"
          maxSize={maxSize}
          minSize={minSize}
        >
          {props.list}
        </ResizablePanel>
        <ResizeHandle />
        <ResizablePanel
          className={cn(
            'min-h-0 min-w-0 overflow-hidden',
            props.detailClassName,
          )}
        >
          <div className="relative h-full" ref={props.asideRef}>
            {props.hasDetail ? props.outlet : props.emptyDetail}
          </div>
        </ResizablePanel>
      </PanelGroup>
    </div>
  )
}

interface MobileShellProps {
  className?: string
  detailClassName?: string
  list: ReactNode
  listClassName?: string
  onDismiss: () => void
  outlet: ReactNode
}

function MobileShell(props: MobileShellProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const detailMounted = props.outlet != null
  // 初始 detailMounted snapshot — 决首帧之初值，免首 paint 错位。
  const initialDetailMountedRef = useRef(detailMounted)
  // 首帧同步测 width；resize 经 ResizeObserver 跟随。
  const [width, setWidth] = useState(0)
  const [measured, setMeasured] = useState(false)
  const [edgeDrag, setEdgeDrag] = useState(false)
  // x 表 detail 之 translateX：detail 在屏 = 0；无 detail = width（off-screen 右）。
  // 由 motion 之 drag 直接驱动；programmatic transition 经 imperative animate(x, target)。
  // 初始 0；首测 width 后若初始无 detail 即 set 至 w（同步，首 paint 即正）。
  const x = useMotionValue(0)
  const [renderOverlay, setRenderOverlay] = useState(
    initialDetailMountedRef.current,
  )
  // 持 last non-null outlet，于 exit 动画时仍可渲（navigate(-1) 后 outlet 即 null）。
  const lastOutletRef = useRef<ReactNode>(props.outlet)
  if (props.outlet != null) lastOutletRef.current = props.outlet

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const w = containerRef.current.clientWidth
    setWidth(w)
    if (!initialDetailMountedRef.current) {
      x.set(w)
    }
    setMeasured(true)
  }, [x])

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // List 视差：x 自 [0, W] → translateX 自 [-LIST_PARALLAX*W, 0]
  const listX = useTransform(
    x,
    (cur) => -(LIST_PARALLAX * Math.max(0, width - cur)),
  )

  // 跟踪上一次 detailMounted 之态以辨"首入"与"转入/转出"。
  const prevDetailRef = useRef<boolean | null>(null)
  // 当 detail 由无到有时，先 setRenderOverlay(true) 致 re-render；待 overlay mount 毕
  // 方启 push spring。以此 ref 标 "需启 push"。
  const pendingPushRef = useRef(false)

  useEffect(() => {
    if (!measured || !width) return
    const prev = prevDetailRef.current
    if (prev === detailMounted) return
    prevDetailRef.current = detailMounted

    if (prev === null) {
      // 首次：useLayoutEffect 已正 x，此处仅同步 renderOverlay 之态。
      setRenderOverlay(detailMounted)
      return
    }

    if (detailMounted) {
      // 先 set x 至 off-screen 右，再 setRenderOverlay；下一 layout effect 启 push spring。
      x.set(width)
      pendingPushRef.current = true
      setRenderOverlay(true)
      return
    }
    // Dismiss：从当前 x 弹至 width，settle 后 unmount overlay。
    const c = animate(x, width, {
      ...SPRING_TRANSITION,
      onComplete: () => setRenderOverlay(false),
    })
    return () => c.stop()
  }, [detailMounted, width, measured, x])

  // overlay mount 毕方启 push spring。layout effect 保 x 之 set 与 spring 启在 paint 前同帧。
  useLayoutEffect(() => {
    if (!renderOverlay || !pendingPushRef.current || !width) return
    pendingPushRef.current = false
    // x 已于 useEffect 中 set 至 width，此处径启 animate 至 0。
    const c = animate(x, 0, SPRING_TRANSITION)
    return () => c.stop()
  }, [renderOverlay, width, x])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // 仅 detail 在屏 + 左边缘起拖方启 swipe-back
      if (!detailMounted) return
      const rect = e.currentTarget.getBoundingClientRect()
      const localX = e.clientX - rect.left
      if (localX > EDGE_ZONE) {
        setEdgeDrag(false)
        return
      }
      setEdgeDrag(true)
    },
    [detailMounted],
  )

  const handleDragEnd = useCallback(
    (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      const vx = info.velocity.x
      const cur = x.get()
      const projected = cur + vx * PROJECTION_SECONDS
      const W = width || 1
      let dismiss: boolean
      if (vx > FLING_VX) dismiss = true
      else if (vx < -FLING_VX) dismiss = false
      else dismiss = projected > W / 2
      if (dismiss) {
        // detail unmount 之 useEffect 会接管动画至 W 并最终 setRenderOverlay(false)。
        props.onDismiss()
      } else {
        animate(x, 0, SPRING_TRANSITION)
      }
      setEdgeDrag(false)
    },
    [props, width, x],
  )

  return (
    <div
      className={cn(
        'relative h-full min-h-0 overflow-hidden bg-white dark:bg-neutral-950',
        props.className,
      )}
      ref={containerRef}
    >
      <motion.div
        aria-hidden={renderOverlay ? 'true' : undefined}
        className={cn(
          'absolute inset-0 min-h-0 overflow-hidden',
          renderOverlay && 'pointer-events-none',
          props.listClassName,
        )}
        style={{ x: listX }}
      >
        {props.list}
      </motion.div>

      {renderOverlay ? (
        <motion.div
          className={cn(
            'absolute inset-0 z-30 min-h-0 min-w-0 overflow-hidden bg-white shadow-xl dark:bg-neutral-950',
            props.detailClassName,
          )}
          drag={edgeDrag ? 'x' : false}
          dragConstraints={{ left: 0, right: width }}
          dragElastic={{ left: 0, right: 0 }}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          onPointerDown={handlePointerDown}
          style={{ x }}
        >
          {lastOutletRef.current}
        </motion.div>
      ) : null}
    </div>
  )
}

/**
 * 取 shell context（如需直接访问 aside DOM）。子组件多数无须用。
 */
export function useMasterDetailContext() {
  return useContext(MasterDetailContext)
}
