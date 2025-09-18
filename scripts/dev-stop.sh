#!/usr/bin/env bash
set -euo pipefail

SELF_PID=$$
SELF_PGID="$(ps -o pgid= -p "$SELF_PID" | tr -d ' ')"

kill_group_by_pat() {
  local pat="$1"
  mapfile -t pids < <(pgrep -f "$pat" || true)
  for pid in "${pids[@]}"; do
    [[ -z "${pid:-}" ]] && continue
    local pgid
    pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
    # 현재 스크립트가 속한 PGID는 절대 건드리지 않음
    if [[ -n "$pgid" && "$pgid" != "$SELF_PGID" ]]; then
      kill -TERM -- "-$pgid" 2>/dev/null || true
    fi
  done
}

kill_procs_by_pat() {
  local sig="$1"; shift
  for pat in "$@"; do
    mapfile -t pids < <(pgrep -f "$pat" || true)
    for pid in "${pids[@]}"; do
      [[ -z "${pid:-}" ]] && continue
      # 자기 자신은 제외
      if [[ "$pid" != "$SELF_PID" ]]; then
        kill "$sig" "$pid" 2>/dev/null || true
      fi
    done
  done
}

# 루트 트리들을 그룹 단위로 종료
kill_group_by_pat "pnpm dev:backend:and:frontend"
kill_group_by_pat "concurrently .*pnpm dev:backend pnpm dev:frontend"

# 개별 프로세스들 종료
kill_procs_by_pat -TERM \
  "uvicorn .*apps\.backend\.src\.main:app" \
  "celery.*worker" "celery.*beat" \
  "vite/bin/vite\.js" "chokidar-cli" "esbuild --service" \
  "pnpm gen:api:watch" "pnpm --filter .*frontend dev"

sleep 1

# 아직 살아있으면 강제 종료
kill_group_by_pat "pnpm dev:backend:and:frontend"
kill_group_by_pat "concurrently .*pnpm dev:backend pnpm dev:frontend"
kill_procs_by_pat -KILL \
  "uvicorn .*apps\.backend\.src\.main:app" \
  "celery.*worker" "celery.*beat" \
  "vite/bin/vite\.js" "chokidar-cli" "esbuild --service" \
  "pnpm gen:api:watch" "pnpm --filter .*frontend dev"

exit 0
