#!/bin/sh

set -eu

APP_ROOT="${APP_ROOT:-/app}"
MODE="${1:-}"
CACHE_DIR="${DEV_BOOTSTRAP_CACHE_DIR:-/pnpm-store/.lumina-dev-bootstrap}"

log() {
  printf '[dev-bootstrap] %s\n' "$1"
}

hash_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{ print $1 }'
    return
  fi

  shasum -a 256 | awk '{ print $1 }'
}

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
    return
  fi

  shasum -a 256 "$1" | awk '{ print $1 }'
}

hash_inputs() {
  (
    cd "$APP_ROOT"

    for path in "$@"; do
      if [ -e "$path" ]; then
        find "$path" -type f
      fi
    done | sort | while IFS= read -r file; do
      printf '%s\n' "$file"
      cat "$file"
    done
  ) | hash_stdin
}

run_locked() {
  lock_name="$1"
  shift

  lock_dir="$CACHE_DIR/${lock_name}.lock"
  announced='false'

  while ! mkdir "$lock_dir" 2>/dev/null; do
    if [ "$announced" = 'false' ]; then
      log "Waiting for ${lock_name} step in another container"
      announced='true'
    fi

    sleep 1
  done

  (
    trap 'rmdir "$lock_dir" 2>/dev/null || true' EXIT INT TERM
    "$@"
  )
}

setup_pnpm() {
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@9.15.0 --activate >/dev/null 2>&1
}

ensure_install_unlocked() {
  lock_hash="$(hash_file "$APP_ROOT/pnpm-lock.yaml")"
  marker_file="$CACHE_DIR/pnpm-lock.sha256"

  if [ -d "$APP_ROOT/node_modules/.pnpm" ] &&
    [ -f "$marker_file" ] &&
    [ "$(cat "$marker_file")" = "$lock_hash" ]; then
    log 'Skipping pnpm install (lockfile unchanged)'
    return
  fi

  log 'Installing workspace dependencies'
  pnpm --dir "$APP_ROOT" install --frozen-lockfile --store-dir /pnpm-store
  printf '%s' "$lock_hash" >"$marker_file"
}

ensure_shared_build_unlocked() {
  shared_hash="$(hash_inputs \
    packages/shared/src \
    packages/shared/package.json \
    packages/shared/tsconfig.json \
    packages/shared/tsup.config.ts)"
  marker_file="$CACHE_DIR/shared.sha256"

  if [ -d "$APP_ROOT/packages/shared/dist" ] &&
    [ -f "$marker_file" ] &&
    [ "$(cat "$marker_file")" = "$shared_hash" ]; then
    log 'Skipping @lumina/shared build (inputs unchanged)'
    return
  fi

  log 'Building @lumina/shared'
  pnpm --dir "$APP_ROOT" --filter @lumina/shared build
  printf '%s' "$shared_hash" >"$marker_file"
}

ensure_prisma_generate_unlocked() {
  prisma_hash="$(hash_inputs \
    apps/backend/prisma \
    apps/backend/prisma.config.js \
    apps/backend/package.json)"
  marker_file="$CACHE_DIR/backend-prisma.sha256"

  if [ -d "$APP_ROOT/node_modules/.prisma/client" ] &&
    [ -f "$marker_file" ] &&
    [ "$(cat "$marker_file")" = "$prisma_hash" ]; then
    log 'Skipping Prisma client generation (schema unchanged)'
    return
  fi

  log 'Generating Prisma client'
  pnpm --dir "$APP_ROOT" --filter @lumina/backend prisma:generate
  printf '%s' "$prisma_hash" >"$marker_file"
}

if [ -z "$MODE" ]; then
  echo 'Usage: scripts/dev-bootstrap.sh <backend|frontend>' >&2
  exit 1
fi

mkdir -p "$CACHE_DIR"
setup_pnpm
run_locked install ensure_install_unlocked
run_locked shared-build ensure_shared_build_unlocked

case "$MODE" in
  backend)
    run_locked prisma-generate ensure_prisma_generate_unlocked
    ;;
  frontend)
    ;;
  *)
    echo "Unsupported mode: $MODE" >&2
    exit 1
    ;;
esac

log "Bootstrap complete for $MODE"
