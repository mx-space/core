#!/usr/bin/env bash
# ============================================================================
# mx-core Node.js vs Bun Performance Benchmark
# ============================================================================
set -euo pipefail

# ---- Configuration ----
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BENCH_DIR="$PROJECT_ROOT/bench"
OUT_DIR="$PROJECT_ROOT/apps/core/out"
ENTRY="$OUT_DIR/main.mjs"
RESULTS_DIR="$BENCH_DIR/results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Benchmark parameters
WARMUP_DURATION=5
BENCH_DURATION=10
CONNECTIONS=50
PIPELINING=1
PORT_NODE=2333
PORT_BUN=2334

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ---- Endpoints to test ----
ENDPOINTS=(
  "/api/v2/ping|Ping (trivial, no I/O)|GET"
  "/api/v2/|Info (static JSON)|GET"
  "/api/v2/categories|Categories (simple DB read)|GET"
  "/api/v2/posts?size=10&select=id%20title%20slug|Posts paginated (moderate DB)|GET"
)

mkdir -p "$RESULTS_DIR"

# ---- Helper Functions ----
log()   { echo -e "${CYAN}[BENCH]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERR]${NC} $*"; }

now_ms() { python3 -c "import time; print(int(time.time()*1000))"; }

wait_for_server() {
  local port=$1 name=$2 max_attempts=30 attempt=0
  while [ $attempt -lt $max_attempts ]; do
    curl -sf "http://127.0.0.1:${port}/api/v2/ping" > /dev/null 2>&1 && return 0
    attempt=$((attempt + 1)); sleep 1
  done
  err "$name failed to start on port $port after ${max_attempts}s"; return 1
}

kill_server() {
  local pid_file=$1
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    kill -0 "$pid" 2>/dev/null && kill "$pid" 2>/dev/null || true
    local w=0
    while kill -0 "$pid" 2>/dev/null && [ $w -lt 10 ]; do sleep 1; w=$((w+1)); done
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$pid_file"
  fi
}

get_memory_mb() {
  ps -o rss= -p "$1" 2>/dev/null | awk '{printf "%.1f", $1/1024}' || echo "N/A"
}

# ---- Pre-flight checks ----
log "Pre-flight checks..."

[ ! -f "$ENTRY" ] && { err "Bundle not found at $ENTRY. Run 'pnpm bundle' first."; exit 1; }
! pg_isready -h 127.0.0.1 -p 5432 > /dev/null 2>&1 && { err "PostgreSQL not running"; exit 1; }
! redis-cli -h 127.0.0.1 -p 6379 ping > /dev/null 2>&1 && { err "Redis not running"; exit 1; }

for port in $PORT_NODE $PORT_BUN; do
  lsof -i ":$port" > /dev/null 2>&1 && { warn "Freeing port $port..."; lsof -ti ":$port" | xargs kill -9 2>/dev/null || true; sleep 1; }
done

ok "All pre-flight checks passed"

# ============================================================
# Main Benchmark
# ============================================================

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     mx-core Performance Benchmark: Node.js vs Bun      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Node.js: ${GREEN}$(node --version)${NC}"
echo -e "  Bun:     ${GREEN}$(bun --version)${NC}"
echo -e "  Duration: ${BENCH_DURATION}s/endpoint | Conn: ${CONNECTIONS} | Pipeline: ${PIPELINING}"
echo ""

# ---- Helper: run one full phase (Node or Bun) ----
run_phase() {
  local RUNNER="$1"     # "node" or "bun"
  local PORT="$2"
  local LABEL="$3"
  local PHASE_LOG="$RESULTS_DIR/${RUNNER}.log"
  local PHASE_PID="$RESULTS_DIR/${RUNNER}.pid"

  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD} ${LABEL}${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  rm -f "$PHASE_LOG" "$PHASE_PID"
  local t0=$(now_ms)
  NODE_ENV=production $RUNNER "$ENTRY" --port "$PORT" --throttle_limit 999999 --throttle_ttl 1 > "$PHASE_LOG" 2>&1 &
  echo $! > "$PHASE_PID"
  wait_for_server "$PORT" "$LABEL"
  local t1=$(now_ms)
  local STARTUP=$((t1 - t0))
  ok "${LABEL} startup: ${STARTUP}ms"

  sleep 2
  local PID=$(cat "$PHASE_PID")
  local MEM_STARTUP=$(get_memory_mb "$PID")
  ok "${LABEL} RSS after startup: ${MEM_STARTUP}MB"

  # Warmup
  log "Warming up ${LABEL} (${WARMUP_DURATION}s)..."
  npx autocannon -c 10 -d "$WARMUP_DURATION" -p 5 -H 'User-Agent=Mozilla/5.0+Benchmark' "http://127.0.0.1:${PORT}/api/v2/ping" > /dev/null 2>&1
  local MEM_WARM=$(get_memory_mb "$PID")

  # Benchmark each endpoint
  local i=0
  for entry in "${ENDPOINTS[@]}"; do
    IFS='|' read -r path name method <<< "$entry"
    log "Benchmarking ${LABEL}: $name"

    local safe_name=$(echo "$path" | tr '/?=&% ' '_' | head -c 60)
    local RESULT_FILE="$RESULTS_DIR/${RUNNER}_${TIMESTAMP}_${safe_name}.json"

    npx autocannon \
      --connections "$CONNECTIONS" \
      --duration "$BENCH_DURATION" \
      --pipelining "$PIPELINING" \
      --method "$method" \
      --headers 'User-Agent=Mozilla/5.0+Benchmark' \
      --json \
      "http://127.0.0.1:${PORT}${path}" > "$RESULT_FILE" 2>/dev/null || warn "  Benchmark failed"

    [ -f "$RESULT_FILE" ] && [ -s "$RESULT_FILE" ] && ok "  Done" || warn "  No results"
  done

  local MEM_LOADED=$(get_memory_mb "$PID")

  log "Stopping ${LABEL}..."
  kill_server "$PHASE_PID"
  ok "${LABEL} stopped"

  # Return phase data via temp file
  cat > "$RESULTS_DIR/${RUNNER}_phase.json" << PHASEEOF
{
  "startup_ms": $STARTUP,
  "mem_startup_mb": $MEM_STARTUP,
  "mem_warm_mb": $MEM_WARM,
  "mem_loaded_mb": $MEM_LOADED,
  "runner": "$RUNNER",
  "port": $PORT
}
PHASEEOF
}

# ---- Phase 1: Node.js ----
run_phase "node" "$PORT_NODE" "Phase 1: Node.js Benchmark"
echo ""

# ---- Phase 2: Bun ----
run_phase "bun" "$PORT_BUN" "Phase 2: Bun Benchmark"
echo ""

# ============================================================
# Phase 3: Generate Report
# ============================================================

echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                    RESULTS SUMMARY                      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

node "$BENCH_DIR/report.js" "$RESULTS_DIR" "$TIMESTAMP" "$(node --version)" "$(bun --version)" "$BENCH_DURATION" "$CONNECTIONS" "$PIPELINING"

log "Cleaning up..."
ok "Benchmark complete!"
