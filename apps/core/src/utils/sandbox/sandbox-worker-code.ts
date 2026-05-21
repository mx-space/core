/**
 * Generate the worker thread code string.
 * The Worker is itself an isolated environment, so many features are implemented inline here.
 * Provides globals compatible with the Next.js Edge Runtime.
 */
export function createSandboxWorkerCode(): string {
  return `
'use strict';

const { createRequire } = require('node:module');
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { performance, PerformanceObserver } = require('node:perf_hooks');

const WorkerMessageType = {
  Execute: 'execute',
  Result: 'result',
  BridgeCall: 'bridge_call',
  BridgeResponse: 'bridge_response',
  Terminate: 'terminate',
};

if (!parentPort) {
  throw new Error('This file must be run as a Worker');
}

const port = parentPort;
const pendingRequests = new Map();

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sendMessage(message) {
  port.postMessage(message);
}

// Bridge call: used only for operations that must access main-thread resources
async function requestBridgeCall(method, args) {
  const id = generateId();
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    sendMessage({ id, type: WorkerMessageType.BridgeCall, payload: { method, args } });
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Bridge call timeout: ' + method));
      }
    }, 30000);
  });
}

// ===== The following features are implemented directly inside the Worker =====

const BANNED_MODULES = new Set([
  'child_process', 'cluster', 'dgram', 'dns', 'fs', 'fs/promises',
  'inspector', 'os', 'process',
  'repl', 'sys', 'tls', 'v8', 'vm', 'worker_threads',
  // Prevent bypassing sandbox restrictions via module.createRequire
  'module',
]);

// require runs directly inside the Worker
function createSandboxRequire(basePath) {
  const baseRequire = createRequire(basePath);

  return function sandboxRequire(moduleId) {
    if (!moduleId || typeof moduleId !== 'string') {
      throw new Error('require: module id must be a non-empty string');
    }

    const normalizedId = moduleId.startsWith('node:') ? moduleId.slice(5) : moduleId;

    if (BANNED_MODULES.has(normalizedId)) {
      throw new Error('require: module "' + moduleId + '" is not allowed');
    }

    // Remote modules are loaded through the bridge
    if (moduleId.startsWith('http://') || moduleId.startsWith('https://')) {
      throw new Error('Remote modules must use async require: await require("' + moduleId + '")');
    }

    return baseRequire(moduleId);
  };
}

// Async require
function createAsyncRequire(basePath) {
  const syncRequire = createSandboxRequire(basePath);
  return async function asyncRequire(moduleId) {
    return syncRequire(moduleId);
  };
}

function createSandboxConsole(namespace) {
  const prefix = '[sandbox:' + namespace + ']';
  const logs = [];
  const MAX_LOGS = 200;
  const MAX_ARG_SIZE = 1024;

  function sanitizeArg(arg) {
    try {
      if (arg === undefined) return 'undefined';
      if (arg === null) return null;
      if (typeof arg === 'string') {
        return arg.length > MAX_ARG_SIZE ? arg.slice(0, MAX_ARG_SIZE) + '...(truncated)' : arg;
      }
      if (typeof arg === 'number' || typeof arg === 'boolean') return arg;
      const str = JSON.stringify(arg);
      if (str && str.length > MAX_ARG_SIZE) {
        return str.slice(0, MAX_ARG_SIZE) + '...(truncated)';
      }
      return arg;
    } catch { return String(arg); }
  }

  function capture(level, args) {
    if (logs.length < MAX_LOGS) {
      logs.push({ level, timestamp: Date.now(), args: args.map(sanitizeArg) });
    }
  }

  const sandboxConsole = {
    log: (...args) => { capture('log', args); console.log(prefix, ...args); },
    info: (...args) => { capture('info', args); console.info(prefix, ...args); },
    warn: (...args) => { capture('warn', args); console.warn(prefix, ...args); },
    error: (...args) => { capture('error', args); console.error(prefix, ...args); },
    debug: (...args) => { capture('debug', args); console.debug(prefix, ...args); },
  };

  return { console: sandboxConsole, getLogs: () => logs };
}

// ===== The following features need to reach the main thread via the Bridge =====

// Create the HTTP service (implemented directly inside the Worker)
function createHttpService() {
  const request = async (url, options = {}) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { data, status: res.status, headers: Object.fromEntries(res.headers.entries()) };
  };

  return {
    axios: {
      get: (url, config) => request(url, { method: 'GET', ...config }),
      post: (url, data, config) => request(url, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' }, ...config }),
      put: (url, data, config) => request(url, { method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' }, ...config }),
      delete: (url, config) => request(url, { method: 'DELETE', ...config }),
      patch: (url, data, config) => request(url, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' }, ...config }),
      request: (config) => request(config.url, config),
    },
  };
}

function createBridgeContext(namespace) {
  return {
    storage: {
      cache: {
        get: (key) => requestBridgeCall('storage.cache.get', [key]),
        set: (key, value, ttl) => requestBridgeCall('storage.cache.set', [key, value, ttl]),
        del: (key) => requestBridgeCall('storage.cache.del', [key]),
      },
      db: {
        get: (key) => requestBridgeCall('storage.db.get', [namespace, key]),
        find: (condition) => requestBridgeCall('storage.db.find', [namespace, condition]),
        set: (key, value) => requestBridgeCall('storage.db.set', [namespace, key, value]),
        insert: (key, value) => requestBridgeCall('storage.db.insert', [namespace, key, value]),
        update: (key, value) => requestBridgeCall('storage.db.update', [namespace, key, value]),
        del: (key) => requestBridgeCall('storage.db.del', [namespace, key]),
      },
    },
    getOwner: () => requestBridgeCall('getOwner', []),
    getService: async (name) => {
      if (name === 'http') return createHttpService();
      if (name === 'config') return { get: (key) => requestBridgeCall('config.get', [key]) };
      throw new Error('Service "' + name + '" not available');
    },
    broadcast: (type, data) => requestBridgeCall('broadcast', [type, data]),
    writeAsset: (path, data, options) => requestBridgeCall('writeAsset', [path, data, options]),
    readAsset: (path, options) => requestBridgeCall('readAsset', [path, options]),
  };
}

// ===== Timer management =====

function createTimerManager() {
  const timers = new Set();
  const intervals = new Set();
  const MAX_TIMERS = 100;
  const MAX_DELAY = 30000; // Max delay of 30 seconds

  return {
    setTimeout: (callback, delay, ...args) => {
      if (timers.size >= MAX_TIMERS) {
        throw new Error('Too many timers created');
      }
      const clampedDelay = Math.min(Math.max(0, delay || 0), MAX_DELAY);
      const id = setTimeout(() => {
        timers.delete(id);
        callback(...args);
      }, clampedDelay);
      timers.add(id);
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
      clearTimeout(id);
    },
    setInterval: (callback, delay, ...args) => {
      if (intervals.size >= MAX_TIMERS) {
        throw new Error('Too many intervals created');
      }
      const clampedDelay = Math.max(10, Math.min(delay || 10, MAX_DELAY)); // Minimum 10ms
      const id = setInterval(callback, clampedDelay, ...args);
      intervals.add(id);
      return id;
    },
    clearInterval: (id) => {
      intervals.delete(id);
      clearInterval(id);
    },
    cleanup: () => {
      for (const id of timers) clearTimeout(id);
      for (const id of intervals) clearInterval(id);
      timers.clear();
      intervals.clear();
    },
  };
}

// ===== Restricted Function constructor =====
// The Edge Runtime forbids creating functions from strings
const RestrictedFunction = new Proxy(Function, {
  construct(target, args) {
    throw new Error('Code generation from strings is not allowed in sandbox');
  },
  apply(target, thisArg, args) {
    throw new Error('Code generation from strings is not allowed in sandbox');
  },
  get(target, prop) {
    // Allow access to Function's static properties and prototype
    return target[prop];
  },
});

// ===== Code execution =====

async function executeCode(payload) {
  const startTime = Date.now();
  const { code, context, timeout, namespace } = payload;
  const timerManager = createTimerManager();
  const { console: sandboxConsole, getLogs } = createSandboxConsole(namespace);

  try {
    const sandboxRequire = createSandboxRequire(workerData.requireBasePath || process.cwd());
    const asyncRequire = createAsyncRequire(workerData.requireBasePath || process.cwd());
    const bridgeContext = createBridgeContext(namespace);

    const req = context.req || {};

    const throws = (status, message) => {
      const error = new Error(message);
      error.status = status;
      throw error;
    };

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
      fetch: globalThis.fetch,
      URL: globalThis.URL,
      URLSearchParams: globalThis.URLSearchParams,
      Headers: globalThis.Headers,
      Request: globalThis.Request,
      Response: globalThis.Response,
      Blob: globalThis.Blob,
      File: globalThis.File,
      FormData: globalThis.FormData,
      WebSocket: globalThis.WebSocket,

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
    };

    const vmContext = vm.createContext(sandboxGlobals, {
      name: 'sandbox:' + namespace,
      codeGeneration: { strings: false, wasm: false },
    });

    // Set the globalThis reference
    vmContext.globalThis = vmContext;
    vmContext.global = vmContext;
    vmContext.self = vmContext;

    const wrappedCode = \`
      (async function() {
        \${code};
        if (typeof handler === "function") return handler(context, require);
        if (exports.default && typeof exports.default === "function") return exports.default(context, require);
        if (module.exports && typeof module.exports === "function") return module.exports(context, require);
        throw new Error("handler function is not defined");
      })()
    \`;

    const script = new vm.Script(wrappedCode, { filename: 'sandbox:' + namespace });
    const result = await script.runInContext(vmContext, { timeout, breakOnSigint: true });

    return { success: true, data: result, executionTime: Date.now() - startTime, logs: getLogs() };
  } catch (error) {
    return {
      success: false,
      error: { name: error.name || 'Error', message: error.message || 'Unknown error', stack: error.stack },
      executionTime: Date.now() - startTime,
      logs: getLogs(),
    };
  } finally {
    // Clean up all timers
    timerManager.cleanup();
  }
}

// ===== Message handling =====

port.on('message', async (message) => {
  const { id, type, payload } = message;

  switch (type) {
    case WorkerMessageType.Execute: {
      const result = await executeCode(payload);
      sendMessage({ id, type: WorkerMessageType.Result, payload: result });
      break;
    }
    case WorkerMessageType.BridgeResponse: {
      const pending = pendingRequests.get(id);
      if (pending) {
        pendingRequests.delete(id);
        if (payload.success) pending.resolve(payload.data);
        else pending.reject(new Error(payload.error || 'Bridge call failed'));
      }
      break;
    }
    case WorkerMessageType.Terminate: {
      process.exit(0);
    }
  }
});

sendMessage({ id: generateId(), type: WorkerMessageType.Result, payload: { ready: true } });
`
}
