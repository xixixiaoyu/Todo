#!/usr/bin/env bash
# Assemble the Sidecar (Node runtime + JS bundle) into the Wails build output.
# Must run AFTER `wails build` completes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."
BUILD_DIR="${PROJECT_DIR}/build/bin"

# Detect OS
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"

# Locate Node.js runtime cache
NODE_VERSION="${NODE_VERSION:-22.15.0}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
esac

if [ "$OS" = "darwin" ]; then
  PLATFORM="darwin"
  APP_BUNDLE="${BUILD_DIR}/Lumina.app"
  if [ ! -d "$APP_BUNDLE" ]; then
    echo "Error: Lumina.app not found at ${APP_BUNDLE}"
    echo "Run 'wails build' first."
    exit 1
  fi
  SIDECAR_DIR="${APP_BUNDLE}/Contents/Resources/sidecar"
elif [ "$OS" = "linux" ]; then
  PLATFORM="linux"
  SIDECAR_DIR="${BUILD_DIR}/sidecar"
else
  echo "Unsupported OS: $OS. Use download-node.ps1 + assemble-sidecar.ps1 on Windows."
  exit 1
fi

NODE_CACHE="${SCRIPT_DIR}/../.cache/node/${NODE_VERSION}/${PLATFORM}-${ARCH}/stripped"
SIDECAR_BUNDLE="${PROJECT_DIR}/../sidecar/dist/sidecar.mjs"

echo "Assembling Sidecar into ${SIDECAR_DIR}..."

# Create sidecar directory structure
mkdir -p "${SIDECAR_DIR}/app"
mkdir -p "${SIDECAR_DIR}/data"

# Copy Node.js runtime
if [ -d "$NODE_CACHE" ]; then
  echo "Copying Node.js runtime from ${NODE_CACHE}..."
  mkdir -p "${SIDECAR_DIR}/node"
  cp -r "$NODE_CACHE"/* "${SIDECAR_DIR}/node/" 2>/dev/null || true
else
  echo "Warning: Node.js runtime not cached. Run download-node.sh first."
  echo "Expected: ${NODE_CACHE}"
fi

# Copy Sidecar JS bundle
if [ -f "$SIDECAR_BUNDLE" ]; then
  echo "Copying Sidecar bundle..."
  cp "$SIDECAR_BUNDLE" "${SIDECAR_DIR}/app/sidecar.mjs"
else
  echo "Warning: Sidecar bundle not found. Run 'pnpm --filter @lumina/sidecar build' first."
  echo "Expected: ${SIDECAR_BUNDLE}"
fi

echo "Sidecar assembly complete."
echo "Structure:"
find "${SIDECAR_DIR}" -type f | head -20
