import { RippleMotion } from './ripple-motion'
import { type RippleScene, rippleScenes } from './ripple-scenes'
import { rippleFragmentShader, rippleVertexShader } from './ripple-shaders'

export interface RippleRenderer {
  setScene: (scene: RippleScene) => void
  pulse: () => void
  dispose: () => void
}

export function createRippleRenderer(
  canvas: HTMLCanvasElement,
  initialScene: RippleScene,
  onState: (state: { available: boolean; reducedMotion: boolean }) => void,
): RippleRenderer {
  const motion = new RippleMotion(rippleScenes[initialScene])
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const events = new AbortController()
  let gl: WebGLRenderingContext | null = null
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  let uniforms: Record<string, WebGLUniformLocation | null> = {}
  let width = 0,
    height = 0,
    frame = 0,
    last = 0,
    time = 6
  let visible = true,
    lost = false,
    disposed = false,
    unsupported = false
  let x = 0,
    y = 0,
    presence = 0,
    drag = 0
  let targetX = 0,
    targetY = 0,
    targetPresence = 0,
    targetDrag = 0
  let pointer: number | null = null,
    pulseIndex = 0,
    lastTrail = -10
  const pulses = new Float32Array(16)
  for (let i = 2; i < 16; i += 4) pulses[i] = -100
  const values = motion.values
  const shape = values.subarray(0, 4),
    waves = values.subarray(4, 8),
    style = values.subarray(8, 12)
  canvas.dataset.rippleScene = initialScene

  function announce(available: boolean) {
    onState({ available, reducedMotion: reduced.matches })
  }

  function build() {
    if (!gl) return
    const shaders: WebGLShader[] = []
    const next = gl.createProgram()
    if (!next) throw new Error('Cannot create ripple program')
    try {
      for (const [type, source] of [
        [gl.VERTEX_SHADER, rippleVertexShader],
        [gl.FRAGMENT_SHADER, rippleFragmentShader],
      ] as const) {
        const shader = gl.createShader(type)
        if (!shader) throw new Error('Cannot create ripple shader')
        shaders.push(shader)
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw new Error(gl.getShaderInfoLog(shader) || 'Ripple shader failed')
        gl.attachShader(next, shader)
      }
      gl.linkProgram(next)
      if (!gl.getProgramParameter(next, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(next) || 'Ripple program failed')
      program = next
      uniforms = {}
      for (
        let i = 0;
        i < gl.getProgramParameter(next, gl.ACTIVE_UNIFORMS);
        i++
      ) {
        const uniform = gl.getActiveUniform(next, i)!
        uniforms[uniform.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(
          next,
          uniform.name,
        )
      }
      buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      )
      announce(true)
    } catch (error) {
      gl.deleteProgram(next)
      throw error
    } finally {
      shaders.forEach((shader) => gl!.deleteShader(shader))
    }
  }

  function draw() {
    if (
      !gl ||
      !program ||
      lost ||
      disposed ||
      !width ||
      !height ||
      document.hidden ||
      !visible
    )
      return
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const position = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height)
    gl.uniform1f(uniforms.uTime, time)
    gl.uniform1f(
      uniforms.uDark,
      document.documentElement.classList.contains('dark') ? 1 : 0,
    )
    gl.uniform4fv(uniforms.uShape, shape)
    gl.uniform4fv(uniforms.uWaves, waves)
    gl.uniform4fv(uniforms.uStyle, style)
    gl.uniform4f(uniforms.uCursor, x, y, presence, drag)
    gl.uniform4fv(uniforms.uRipples, pulses)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  function animates() {
    return Boolean(
      program &&
      !lost &&
      !disposed &&
      !document.hidden &&
      visible &&
      width &&
      height &&
      !reduced.matches,
    )
  }
  function tick(now: number) {
    frame = 0
    if (!animates()) return
    if (last && now - last < 32) {
      frame = requestAnimationFrame(tick)
      return
    }
    const elapsed = last ? Math.min(now - last, 100) : 33
    time += last ? elapsed / 1000 : 0
    last = now
    motion.advance(elapsed)
    const ease = 1 - Math.exp(-elapsed / 100)
    x += (targetX - x) * ease
    y += (targetY - y) * ease
    presence += (targetPresence - presence) * ease
    drag += (targetDrag - drag) * ease
    draw()
    frame = requestAnimationFrame(tick)
  }
  function refresh() {
    if (!animates()) {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
      draw()
      return
    }
    if (!frame) {
      last = 0
      frame = requestAnimationFrame(tick)
    }
  }
  function resize() {
    if (disposed) return
    const rect = canvas.getBoundingClientRect()
    width = Math.round(rect.width)
    height = Math.round(rect.height)
    if (!width || !height) {
      refresh()
      return
    }
    if (!gl && !unsupported) {
      try {
        gl = canvas.getContext('webgl', {
          alpha: true,
          antialias: true,
          premultipliedAlpha: false,
          powerPreference: 'low-power',
        })
        if (gl) build()
        else {
          unsupported = true
          announce(false)
        }
      } catch {
        unsupported = true
        announce(false)
      }
    }
    const ratio = Math.min(devicePixelRatio || 1, 2)
    const pixelWidth = Math.round(width * ratio),
      pixelHeight = Math.round(height * ratio)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    draw()
    refresh()
  }
  function pulse(atX = 0, atY = 0, strength = 1) {
    if (reduced.matches || !program || lost || disposed) return
    pulses.set([atX, atY, time, strength], (pulseIndex++ % 4) * 4)
    refresh()
  }
  function locate(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    targetX =
      (((event.clientX - rect.left) / rect.width - 0.5) * rect.width) /
      rect.height
    targetY = 1 - (event.clientY - rect.top) / rect.height - 0.53
  }
  canvas.addEventListener(
    'pointermove',
    (event) => {
      locate(event)
      targetPresence = 1
      if (pointer === event.pointerId && time - lastTrail > 0.24) {
        pulse(targetX, targetY, 0.42)
        lastTrail = time
      }
    },
    { signal: events.signal },
  )
  canvas.addEventListener(
    'pointerenter',
    (event) => {
      locate(event)
      targetPresence = 1
    },
    { signal: events.signal },
  )
  canvas.addEventListener(
    'pointerleave',
    () => {
      if (pointer === null) targetPresence = 0
    },
    { signal: events.signal },
  )
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || reduced.matches) return
      locate(event)
      pointer = event.pointerId
      targetDrag = targetPresence = 1
      canvas.setPointerCapture(event.pointerId)
      pulse(targetX, targetY)
    },
    { signal: events.signal },
  )
  function release(event: PointerEvent) {
    if (pointer !== event.pointerId) return
    pointer = null
    targetDrag = 0
    if (event.pointerType === 'touch') targetPresence = 0
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId)
  }
  canvas.addEventListener('pointerup', release, { signal: events.signal })
  canvas.addEventListener('pointercancel', release, { signal: events.signal })
  canvas.addEventListener(
    'lostpointercapture',
    () => {
      pointer = null
      targetDrag = 0
    },
    { signal: events.signal },
  )
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault()
      lost = true
      cancelAnimationFrame(frame)
      frame = 0
      announce(false)
    },
    { signal: events.signal },
  )
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      lost = false
      try {
        build()
        resize()
      } catch {
        announce(false)
      }
    },
    { signal: events.signal },
  )
  const onMotion = () => {
    if (reduced.matches) {
      motion.setTarget(
        rippleScenes[canvas.dataset.rippleScene as RippleScene],
        true,
      )
      presence = drag = 0
      for (let i = 2; i < 16; i += 4) pulses[i] = -100
    }
    announce(Boolean(program && !lost))
    refresh()
  }
  reduced.addEventListener('change', onMotion)
  document.addEventListener('visibilitychange', refresh, {
    signal: events.signal,
  })
  const sizing = new ResizeObserver(resize)
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting
    refresh()
  })
  const theme = new MutationObserver(draw)
  sizing.observe(canvas)
  intersection.observe(canvas)
  theme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  announce(false)
  resize()

  return {
    setScene(scene) {
      canvas.dataset.rippleScene = scene
      motion.setTarget(rippleScenes[scene], reduced.matches)
      refresh()
    },
    pulse: () => pulse(0, 0, 1.2),
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      events.abort()
      reduced.removeEventListener('change', onMotion)
      sizing.disconnect()
      intersection.disconnect()
      theme.disconnect()
      if (gl) {
        gl.deleteBuffer(buffer)
        gl.deleteProgram(program)
      }
    },
  }
}
