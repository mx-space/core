/**
 * Sandbox worker runtime source.
 *
 * This file is NOT compiled or bundled as a module — it is imported as a raw
 * string (Vite `?raw`) and evaluated via `new Worker(code, { eval: true })`,
 * so it must stay plain JavaScript (no imports) and CommonJS.
 * The Worker is itself an isolated environment, so many features are
 * implemented inline here. Provides globals compatible with the Next.js Edge
 * Runtime.
 */
'use strict'

const { createRequire } = require('node:module')
const { parentPort, workerData } = require('node:worker_threads')
const vm = require('node:vm')
const { webcrypto } = require('node:crypto')
const { performance, PerformanceObserver } = require('node:perf_hooks')

const WorkerMessageType = {
  Execute: 'execute',
  Result: 'result',
  BridgeCall: 'bridge_call',
  BridgeResponse: 'bridge_response',
  Terminate: 'terminate',
}

if (!parentPort) {
  throw new Error('This file must be run as a Worker')
}

const port = parentPort
const pendingRequests = new Map()

const dnsPromises = require('node:dns').promises
const net = require('node:net')

// ===== SSRF egress guard (self-contained; the Worker runs as eval'd string
// code and cannot import app modules) =====
// Mirrors the range checks in apps/core/src/processors/agent-browser/url-guard.ts.

function ipv4ToParts(ip) {
  const parts = ip.split('.').map((p) => Number(p))
  if (
    parts.length !== 4 ||
    parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
  ) {
    return null
  }
  return parts
}

function isPrivateIpv4(ip) {
  const p = ipv4ToParts(ip)
  if (!p) return false
  const [a, b] = p
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8 RFC1918
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local (+ metadata 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 RFC1918
  if (a === 192 && b === 168) return true // 192.168.0.0/16 RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  if (a >= 224) return true // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false
}

function isPrivateIpv6(ip) {
  let addr = ip.toLowerCase()
  if (addr.startsWith('[') && addr.endsWith(']')) addr = addr.slice(1, -1)
  // strip zone id
  const pct = addr.indexOf('%')
  if (pct !== -1) addr = addr.slice(0, pct)
  if (addr === '::1' || addr === '::') return true // loopback / unspecified
  if (
    addr.startsWith('fe8') ||
    addr.startsWith('fe9') ||
    addr.startsWith('fea') ||
    addr.startsWith('feb')
  )
    return true // fe80::/10 link-local
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true // fc00::/7 ULA
  if (addr.startsWith('ff')) return true // ff00::/8 multicast
  // IPv4-mapped / -compatible: ::ffff:a.b.c.d or ::a.b.c.d
  const mapped = addr.match(/(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIpv4(mapped[1])
  return false
}

function isPrivateIp(ip) {
  const kind = net.isIP(ip)
  if (kind === 4) return isPrivateIpv4(ip)
  if (kind === 6) return isPrivateIpv6(ip)
  // Not a literal IP — be conservative if it somehow reaches here.
  return false
}

async function assertEgressUrlSafe(input) {
  let url
  try {
    url =
      input instanceof URL
        ? input
        : new URL(String(input && input.url ? input.url : input))
  } catch {
    throw new Error('SSRF guard: invalid URL')
  }
  const protocol = url.protocol
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('SSRF guard: disallowed protocol "' + protocol + '"')
  }
  let hostname = url.hostname
  if (hostname.startsWith('[') && hostname.endsWith(']'))
    hostname = hostname.slice(1, -1)

  // Literal IP target — check directly (no DNS).
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(
        'SSRF guard: blocked private/loopback address ' + hostname,
      )
    }
    return url
  }

  // Hostname — resolve every A/AAAA record and reject if ANY is private.
  let resolved
  try {
    resolved = await dnsPromises.lookup(hostname, { all: true })
  } catch (error) {
    throw new Error(
      'SSRF guard: DNS lookup failed for ' +
        hostname +
        ': ' +
        (error && error.message),
    )
  }
  if (!resolved || resolved.length === 0) {
    throw new Error('SSRF guard: no addresses resolved for ' + hostname)
  }
  for (const entry of resolved) {
    if (isPrivateIp(entry.address)) {
      throw new Error(
        'SSRF guard: ' +
          hostname +
          ' resolves to blocked address ' +
          entry.address,
      )
    }
  }
  return url
}

// Wrap the real fetch so every sandbox egress is validated first. Redirects
// ARE followed (so legit http→https / apex→www / canonicalization 3xx work),
// but EVERY hop is re-validated against the egress guard to keep the
// redirect-to-internal SSRF bypass closed.
//
// Implementation: we force redirect:'manual' on the underlying undici fetch so
// each 3xx surfaces as a real response (in Node/undici, redirect:'manual'
// returns the actual 3xx with a readable Location header and a 300-399 status,
// unlike the browser's opaque status-0 response). We inspect Location, resolve
// it against the current URL, re-validate, and re-issue — up to MAX_REDIRECTS.
const MAX_REDIRECTS = 20
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function createGuardedFetch() {
  const realFetch = globalThis.fetch
  if (typeof realFetch !== 'function') return realFetch
  return async function guardedFetch(input, init) {
    const userRedirect = init && init.redirect

    // Honor an explicit non-follow choice: don't auto-follow, just validate the
    // first target and hand back the raw response (manual: caller inspects 3xx;
    // error: undici throws on redirect).
    if (userRedirect === 'manual' || userRedirect === 'error') {
      await assertEgressUrlSafe(input)
      return realFetch(input, init)
    }

    // Auto-follow path (redirect unspecified or 'follow').
    let currentUrl =
      input instanceof URL
        ? input.href
        : input && typeof input === 'object' && input.url
          ? input.url
          : String(input)
    let currentInput = input
    let currentInit = init ? { ...init } : {}
    currentInit.redirect = 'manual'

    for (let hop = 0; ; hop++) {
      await assertEgressUrlSafe(currentUrl)
      const res = await realFetch(currentInput, currentInit)

      const location = res.headers.get('location')
      if (!REDIRECT_STATUSES.has(res.status) || !location) {
        return res
      }

      if (hop >= MAX_REDIRECTS) {
        throw new Error(
          'SSRF guard: too many redirects (max ' + MAX_REDIRECTS + ')',
        )
      }

      // Resolve the (possibly relative) Location against the current URL.
      let nextUrl
      try {
        nextUrl = new URL(location, currentUrl).href
      } catch {
        throw new Error(
          'SSRF guard: invalid redirect Location "' + location + '"',
        )
      }

      // Drain the redirect body so the underlying socket can be reused/freed.
      try {
        await res.body?.cancel()
      } catch {}

      // Method/body handling per fetch spec, pragmatically:
      //   307/308 — preserve method AND body (no downgrade).
      //   301/302/303 — follow as GET and drop the body (browser default; the
      //     vast majority of canonicalization/apex→www redirects are 301/302).
      const next = { ...currentInit, redirect: 'manual' }
      if (res.status === 301 || res.status === 302 || res.status === 303) {
        next.method = 'GET'
        delete next.body
      }

      currentUrl = nextUrl
      currentInput = nextUrl
      currentInit = next
    }
  }
}

// Wrap WebSocket so the connection target is validated before the handshake.
function createGuardedWebSocket() {
  const RealWebSocket = globalThis.WebSocket
  if (typeof RealWebSocket !== 'function') return RealWebSocket
  return new Proxy(RealWebSocket, {
    construct(target, args) {
      const rawUrl = args[0]
      let url
      try {
        url = new URL(String(rawUrl))
      } catch {
        throw new Error('SSRF guard: invalid WebSocket URL')
      }
      let hostname = url.hostname
      if (hostname.startsWith('[') && hostname.endsWith(']'))
        hostname = hostname.slice(1, -1)
      if (net.isIP(hostname) && isPrivateIp(hostname)) {
        throw new Error(
          'SSRF guard: blocked private WebSocket target ' + hostname,
        )
      }
      // Async DNS resolution can't be awaited in a synchronous constructor;
      // literal-IP targets are blocked above, hostnames pass through. The
      // fetch path remains the fully-guarded egress channel.
      return Reflect.construct(target, args)
    },
  })
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function sendMessage(message) {
  port.postMessage(message)
}

// Bridge call: used only for operations that must access main-thread resources
async function requestBridgeCall(method, args) {
  const id = generateId()
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })
    sendMessage({
      id,
      type: WorkerMessageType.BridgeCall,
      payload: { method, args },
    })
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id)
        reject(new Error('Bridge call timeout: ' + method))
      }
    }, 30000)
  })
}

// ===== The following features are implemented directly inside the Worker =====

// ALLOWLIST of built-in module specifiers the snippet runtime may require.
// A denylist is bypassable (transitive re-exports, node: prefixes, sub-path
// requires). Anything not listed here is rejected. Keep this minimal — adding
// a module here grants the snippet its full surface, so prefer wrappers
// (see restrictedNetModule) for modules with dangerous capabilities.
const ALLOWED_BUILTIN_MODULES = new Set([
  'url', // URL / URLSearchParams (WHATWG-overlapping, safe)
  'querystring',
  'string_decoder',
  'punycode',
  'events',
  'util',
  'assert',
  'buffer',
  'path',
  'crypto', // hashing / random; safe surface
  'zlib',
  'stream',
  'timers',
])

// 'net' is needed by built-in snippets ONLY for isIP/isIPv4/isIPv6. The full
// module exposes raw TCP sockets (Socket/createConnection/Server) which would
// bypass the fetch SSRF egress guard entirely. Hand back a restricted facade
// exposing only the pure address-classification helpers.
function restrictedNetModule() {
  const realNet = require('node:net')
  return {
    isIP: realNet.isIP.bind(realNet),
    isIPv4: realNet.isIPv4.bind(realNet),
    isIPv6: realNet.isIPv6.bind(realNet),
  }
}

// Normalize a specifier so 'node:fs', 'fs', 'fs/promises', and 'FS' can't be
// used to slip past the allowlist. Returns the base built-in name (lowercased,
// node: prefix stripped, sub-path dropped) or null if it is not a bare
// built-in specifier (relative/absolute/package paths fall through to the
// normal resolver, which is jailed to requireBasePath).
function normalizeBuiltinId(moduleId) {
  let id = moduleId
  if (id.startsWith('node:')) id = id.slice(5)
  // Bare specifiers only (no path separators in the first segment, no relative).
  if (id.startsWith('.') || id.startsWith('/')) return null
  const base = id.split('/')[0].toLowerCase()
  return base
}

// Node's exhaustive built-in module list — used to reject ANY built-in that is
// not explicitly allowlisted, regardless of node: prefix or sub-path form.
const NODE_BUILTIN_MODULES = new Set(
  require('node:module').builtinModules.map((m) => m.replace(/^node:/, '')),
)

// require runs directly inside the Worker
function createSandboxRequire(basePath) {
  const baseRequire = createRequire(basePath)

  return function sandboxRequire(moduleId) {
    if (!moduleId || typeof moduleId !== 'string') {
      throw new Error('require: module id must be a non-empty string')
    }

    // Remote modules are loaded through the bridge
    if (moduleId.startsWith('http://') || moduleId.startsWith('https://')) {
      throw new Error(
        'Remote modules must use async require: await require("' +
          moduleId +
          '")',
      )
    }

    const builtinBase = normalizeBuiltinId(moduleId)

    if (builtinBase !== null) {
      if (builtinBase === 'net') {
        return restrictedNetModule()
      }
      if (ALLOWED_BUILTIN_MODULES.has(builtinBase)) {
        // Resolve via the canonical node: name so an attacker-shadowed local
        // package of the same name under requireBasePath cannot be loaded.
        return baseRequire('node:' + builtinBase)
      }
      // A Node built-in that is NOT allowlisted (covers every node: prefix and
      // sub-path form, e.g. 'fs', 'node:fs', 'fs/promises') — always rejected.
      if (NODE_BUILTIN_MODULES.has(builtinBase)) {
        throw new Error(
          'require: built-in module "' + moduleId + '" is not allowed',
        )
      }
      // Otherwise it is a bare third-party package specifier (e.g. 'axios',
      // '@mx-space/extra'). Requiring user-installed packages from the data
      // dir's node_modules is a documented snippet feature, so resolve it
      // through the normal resolver jailed to requireBasePath.
      return baseRequire(moduleId)
    }

    // Relative / absolute paths resolve against requireBasePath as before.
    return baseRequire(moduleId)
  }
}

// Async require
function createAsyncRequire(basePath) {
  const syncRequire = createSandboxRequire(basePath)
  return async function asyncRequire(moduleId) {
    return syncRequire(moduleId)
  }
}

function createSandboxConsole(namespace) {
  const prefix = '[sandbox:' + namespace + ']'
  const logs = []
  const MAX_LOGS = 200
  const MAX_ARG_SIZE = 1024

  function sanitizeArg(arg) {
    try {
      if (arg === undefined) return 'undefined'
      if (arg === null) return null
      if (typeof arg === 'string') {
        return arg.length > MAX_ARG_SIZE
          ? arg.slice(0, MAX_ARG_SIZE) + '...(truncated)'
          : arg
      }
      if (typeof arg === 'number' || typeof arg === 'boolean') return arg
      const str = JSON.stringify(arg)
      if (str && str.length > MAX_ARG_SIZE) {
        return str.slice(0, MAX_ARG_SIZE) + '...(truncated)'
      }
      return arg
    } catch {
      return String(arg)
    }
  }

  function capture(level, args) {
    if (logs.length < MAX_LOGS) {
      logs.push({ level, timestamp: Date.now(), args: args.map(sanitizeArg) })
    }
  }

  const sandboxConsole = {
    log: (...args) => {
      capture('log', args)
      console.log(prefix, ...args)
    },
    info: (...args) => {
      capture('info', args)
      console.info(prefix, ...args)
    },
    warn: (...args) => {
      capture('warn', args)
      console.warn(prefix, ...args)
    },
    error: (...args) => {
      capture('error', args)
      console.error(prefix, ...args)
    },
    debug: (...args) => {
      capture('debug', args)
      console.debug(prefix, ...args)
    },
  }

  return { console: sandboxConsole, getLogs: () => logs }
}

// ===== The following features need to reach the main thread via the Bridge =====

function createBridgeContext(namespace) {
  return {
    storage: {
      cache: {
        get: (key) => requestBridgeCall('storage.cache.get', [key]),
        set: (key, value, ttl) =>
          requestBridgeCall('storage.cache.set', [key, value, ttl]),
        del: (key) => requestBridgeCall('storage.cache.del', [key]),
      },
      db: {
        get: (key) => requestBridgeCall('storage.db.get', [namespace, key]),
        find: (condition) =>
          requestBridgeCall('storage.db.find', [namespace, condition]),
        set: (key, value) =>
          requestBridgeCall('storage.db.set', [namespace, key, value]),
        insert: (key, value) =>
          requestBridgeCall('storage.db.insert', [namespace, key, value]),
        update: (key, value) =>
          requestBridgeCall('storage.db.update', [namespace, key, value]),
        del: (key) => requestBridgeCall('storage.db.del', [namespace, key]),
      },
    },
    getOwner: () => requestBridgeCall('getOwner', []),
    getService: async (name) => {
      if (name === 'config')
        return { get: (key) => requestBridgeCall('config.get', [key]) }
      throw new Error('Service "' + name + '" not available')
    },
    broadcast: (type, data) => requestBridgeCall('broadcast', [type, data]),
    writeAsset: (path, data, options) =>
      requestBridgeCall('writeAsset', [path, data, options]),
    readAsset: (path, options) =>
      requestBridgeCall('readAsset', [path, options]),
  }
}

// ===== Timer management =====

function createTimerManager() {
  const timers = new Set()
  const intervals = new Set()
  const MAX_TIMERS = 100
  const MAX_DELAY = 30000 // Max delay of 30 seconds

  return {
    setTimeout: (callback, delay, ...args) => {
      if (timers.size >= MAX_TIMERS) {
        throw new Error('Too many timers created')
      }
      const clampedDelay = Math.min(Math.max(0, delay || 0), MAX_DELAY)
      const id = setTimeout(() => {
        timers.delete(id)
        callback(...args)
      }, clampedDelay)
      timers.add(id)
      return id
    },
    clearTimeout: (id) => {
      timers.delete(id)
      clearTimeout(id)
    },
    setInterval: (callback, delay, ...args) => {
      if (intervals.size >= MAX_TIMERS) {
        throw new Error('Too many intervals created')
      }
      const clampedDelay = Math.max(10, Math.min(delay || 10, MAX_DELAY)) // Minimum 10ms
      const id = setInterval(callback, clampedDelay, ...args)
      intervals.add(id)
      return id
    },
    clearInterval: (id) => {
      intervals.delete(id)
      clearInterval(id)
    },
    cleanup: () => {
      for (const id of timers) clearTimeout(id)
      for (const id of intervals) clearInterval(id)
      timers.clear()
      intervals.clear()
    },
  }
}

// ===== Restricted Function constructor =====
// The Edge Runtime forbids creating functions from strings
const RestrictedFunction = new Proxy(Function, {
  construct(target, args) {
    throw new Error('Code generation from strings is not allowed in sandbox')
  },
  apply(target, thisArg, args) {
    throw new Error('Code generation from strings is not allowed in sandbox')
  },
  get(target, prop) {
    // Allow access to Function's static properties and prototype
    return target[prop]
  },
})

// ===== Code execution =====

async function executeCode(payload) {
  const startTime = Date.now()
  const { code, context, timeout, namespace } = payload
  const timerManager = createTimerManager()
  const { console: sandboxConsole, getLogs } = createSandboxConsole(namespace)

  try {
    const sandboxRequire = createSandboxRequire(
      workerData.requireBasePath || process.cwd(),
    )
    const asyncRequire = createAsyncRequire(
      workerData.requireBasePath || process.cwd(),
    )
    const bridgeContext = createBridgeContext(namespace)

    const req = context.req || {}

    const throws = (status, message) => {
      const error = new Error(message)
      error.status = status
      throw error
    }

    const sandboxGlobals = {
      context: {
        ...context,
        req,
        query: req.query,
        headers: req.headers,
        params: req.params || {},
        method: req.method,
        secret: context.secret || {},
        model: context.model,
        document: context.model,
        name: context.model.name,
        reference: context.model.reference,
        hasAdminAccess: context.hasAdminAccess ?? context.isAuthenticated,
        isAuthenticated: context.isAuthenticated,
        ...bridgeContext,
        throws,
      },

      // ===== Module System =====
      console: sandboxConsole,
      logger: sandboxConsole,
      require: asyncRequire,
      import: (moduleId) => asyncRequire(moduleId),
      exports: {},
      module: { exports: {} },
      __dirname: '',
      __filename: '',

      // ===== Network APIs =====
      // fetch/WebSocket are wrapped with an SSRF egress guard that blocks
      // private/loopback/link-local/metadata targets (see createGuardedFetch).
      fetch: createGuardedFetch(),
      URL: globalThis.URL,
      URLSearchParams: globalThis.URLSearchParams,
      Headers: globalThis.Headers,
      Request: globalThis.Request,
      Response: globalThis.Response,
      Blob: globalThis.Blob,
      File: globalThis.File,
      FormData: globalThis.FormData,
      WebSocket: createGuardedWebSocket(),

      // ===== Encoding APIs =====
      TextEncoder: globalThis.TextEncoder,
      TextDecoder: globalThis.TextDecoder,
      TextEncoderStream: globalThis.TextEncoderStream,
      TextDecoderStream: globalThis.TextDecoderStream,
      atob: globalThis.atob,
      btoa: globalThis.btoa,

      // ===== Stream APIs =====
      ReadableStream: globalThis.ReadableStream,
      ReadableStreamDefaultReader: globalThis.ReadableStreamDefaultReader,
      ReadableStreamBYOBReader: globalThis.ReadableStreamBYOBReader,
      WritableStream: globalThis.WritableStream,
      WritableStreamDefaultWriter: globalThis.WritableStreamDefaultWriter,
      TransformStream: globalThis.TransformStream,
      ByteLengthQueuingStrategy: globalThis.ByteLengthQueuingStrategy,
      CountQueuingStrategy: globalThis.CountQueuingStrategy,
      CompressionStream: globalThis.CompressionStream,
      DecompressionStream: globalThis.DecompressionStream,

      // ===== Crypto APIs =====
      crypto: webcrypto,
      CryptoKey: webcrypto.CryptoKey,
      SubtleCrypto: webcrypto.SubtleCrypto,

      // ===== Timer APIs =====
      setTimeout: timerManager.setTimeout,
      clearTimeout: timerManager.clearTimeout,
      setInterval: timerManager.setInterval,
      clearInterval: timerManager.clearInterval,
      queueMicrotask: globalThis.queueMicrotask,

      // ===== Abort APIs =====
      AbortController: globalThis.AbortController,
      AbortSignal: globalThis.AbortSignal,

      // ===== Event APIs =====
      Event: globalThis.Event,
      EventTarget: globalThis.EventTarget,
      CustomEvent: globalThis.CustomEvent,

      // ===== Error Types =====
      Error: globalThis.Error,
      EvalError: globalThis.EvalError,
      RangeError: globalThis.RangeError,
      ReferenceError: globalThis.ReferenceError,
      SyntaxError: globalThis.SyntaxError,
      TypeError: globalThis.TypeError,
      URIError: globalThis.URIError,
      AggregateError: globalThis.AggregateError,

      // ===== Typed Arrays =====
      ArrayBuffer: globalThis.ArrayBuffer,
      SharedArrayBuffer: globalThis.SharedArrayBuffer,
      DataView: globalThis.DataView,
      Int8Array: globalThis.Int8Array,
      Uint8Array: globalThis.Uint8Array,
      Uint8ClampedArray: globalThis.Uint8ClampedArray,
      Int16Array: globalThis.Int16Array,
      Uint16Array: globalThis.Uint16Array,
      Int32Array: globalThis.Int32Array,
      Uint32Array: globalThis.Uint32Array,
      Float32Array: globalThis.Float32Array,
      Float64Array: globalThis.Float64Array,
      BigInt64Array: globalThis.BigInt64Array,
      BigUint64Array: globalThis.BigUint64Array,

      // ===== Collections =====
      Array: globalThis.Array,
      Map: globalThis.Map,
      Set: globalThis.Set,
      WeakMap: globalThis.WeakMap,
      WeakSet: globalThis.WeakSet,
      WeakRef: globalThis.WeakRef,
      FinalizationRegistry: globalThis.FinalizationRegistry,

      // ===== Core Objects =====
      Object: globalThis.Object,
      Function: RestrictedFunction, // Forbid creating functions from strings
      Boolean: globalThis.Boolean,
      Symbol: globalThis.Symbol,
      Number: globalThis.Number,
      BigInt: globalThis.BigInt,
      String: globalThis.String,
      RegExp: globalThis.RegExp,
      Date: globalThis.Date,
      Promise: globalThis.Promise,
      Proxy: globalThis.Proxy,
      Reflect: globalThis.Reflect,

      // ===== Utilities =====
      JSON: globalThis.JSON,
      Math: globalThis.Math,
      Intl: globalThis.Intl,
      Atomics: globalThis.Atomics,
      Buffer: globalThis.Buffer,
      structuredClone: globalThis.structuredClone,
      performance: performance,
      PerformanceObserver: PerformanceObserver,

      // ===== Encoding/Decoding Functions =====
      encodeURI: globalThis.encodeURI,
      decodeURI: globalThis.decodeURI,
      encodeURIComponent: globalThis.encodeURIComponent,
      decodeURIComponent: globalThis.decodeURIComponent,
      escape: globalThis.escape,
      unescape: globalThis.unescape,

      // ===== Type Checking =====
      isFinite: globalThis.isFinite,
      isNaN: globalThis.isNaN,
      parseFloat: globalThis.parseFloat,
      parseInt: globalThis.parseInt,

      // ===== Constants =====
      Infinity: globalThis.Infinity,
      NaN: globalThis.NaN,
      undefined: undefined,

      // ===== Process (Limited) =====
      // Note: do not expose process.env to avoid leaking sensitive information
      process: {
        nextTick: (callback) => queueMicrotask(callback),
      },

      // ===== Global Reference =====
      globalThis: null, // Set after the context is created
    }

    const vmContext = vm.createContext(sandboxGlobals, {
      name: 'sandbox:' + namespace,
      codeGeneration: { strings: false, wasm: false },
    })

    // Set the globalThis reference
    vmContext.globalThis = vmContext
    vmContext.global = vmContext
    vmContext.self = vmContext

    const wrappedCode = `
      (async function() {
        ${code};
        if (typeof handler === "function") return handler(context, require);
        if (exports.default && typeof exports.default === "function") return exports.default(context, require);
        if (module.exports && typeof module.exports === "function") return module.exports(context, require);
        throw new Error("handler function is not defined");
      })()
    `

    const script = new vm.Script(wrappedCode, {
      filename: 'sandbox:' + namespace,
    })
    const result = await script.runInContext(vmContext, {
      timeout,
      breakOnSigint: true,
    })

    return {
      success: true,
      data: result,
      executionTime: Date.now() - startTime,
      logs: getLogs(),
    }
  } catch (error) {
    return {
      success: false,
      error: {
        name: error.name || 'Error',
        message: error.message || 'Unknown error',
        stack: error.stack,
      },
      executionTime: Date.now() - startTime,
      logs: getLogs(),
    }
  } finally {
    // Clean up all timers
    timerManager.cleanup()
  }
}

// ===== Message handling =====

port.on('message', async (message) => {
  const { id, type, payload } = message

  switch (type) {
    case WorkerMessageType.Execute: {
      const result = await executeCode(payload)
      sendMessage({ id, type: WorkerMessageType.Result, payload: result })
      break
    }
    case WorkerMessageType.BridgeResponse: {
      const pending = pendingRequests.get(id)
      if (pending) {
        pendingRequests.delete(id)
        if (payload.success) pending.resolve(payload.data)
        else pending.reject(new Error(payload.error || 'Bridge call failed'))
      }
      break
    }
    case WorkerMessageType.Terminate: {
      process.exit(0)
    }
  }
})

sendMessage({
  id: generateId(),
  type: WorkerMessageType.Result,
  payload: { ready: true },
})
