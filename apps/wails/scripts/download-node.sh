#!/usr/bin/env bash
# Download and cache a stripped Node.js runtime for the Sidecar.
# Usage: ./download-node.sh [version] [platform] [arch]
# Defaults: version=22.15.0, platform=$(uname -s), arch=$(uname -m)

set -euo pipefail

NODE_VERSION="${1:-22.15.0}"
OS="${2:-$(uname -s | tr '[:upper:]' '[:lower:]')}"
ARCH="${3:-$(uname -m)}"

# Normalize arch
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
esac

# Normalize OS
case "$OS" in
  darwin) PLATFORM="darwin" ;;
  linux) PLATFORM="linux" ;;
  mingw*|msys*|cygwin*|windows) PLATFORM="win"; OS="win" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CACHE_DIR="${SCRIPT_DIR}/../.cache/node/${NODE_VERSION}/${PLATFORM}-${ARCH}"
DEST_DIR="${CACHE_DIR}/stripped"

if [ -d "$DEST_DIR/bin" ] || [ -f "$DEST_DIR/node.exe" ]; then
  echo "Node.js ${NODE_VERSION} (${PLATFORM}-${ARCH}) already cached at ${DEST_DIR}"
  exit 0
fi

# Download URL
if [ "$PLATFORM" = "win" ]; then
  ARCHIVE="node-v${NODE_VERSION}-win-${ARCH}.zip"
  URL="https://nodejs.org/dist/v${NODE_VERSION}/${ARCHIVE}"
else
  EXT="tar.gz"
  if [ "$PLATFORM" = "linux" ]; then EXT="tar.xz"; fi
  ARCHIVE="node-v${NODE_VERSION}-${PLATFORM}-${ARCH}.${EXT}"
  URL="https://nodejs.org/dist/v${NODE_VERSION}/${ARCHIVE}"
fi

echo "Downloading Node.js ${NODE_VERSION} (${PLATFORM}-${ARCH})..."
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fSL -o "${TMP_DIR}/${ARCHIVE}" "$URL"

# Extract
echo "Extracting..."
if [ "$PLATFORM" = "win" ]; then
  unzip -q "${TMP_DIR}/${ARCHIVE}" -d "${TMP_DIR}/extracted"
else
  mkdir -p "${TMP_DIR}/extracted"
  tar xf "${TMP_DIR}/${ARCHIVE}" -C "${TMP_DIR}/extracted"
fi

# Find extracted directory
EXTRACTED_DIR=$(find "${TMP_DIR}/extracted" -maxdepth 1 -type d -name "node-v*" | head -1)

# Strip unnecessary files
echo "Stripping unnecessary files..."
mkdir -p "$DEST_DIR"

if [ "$PLATFORM" = "win" ]; then
  # Windows: copy only node.exe and minimal npm
  cp "${EXTRACTED_DIR}/node.exe" "$DEST_DIR/"
else
  # Unix: copy bin/node and lib/node_modules
  mkdir -p "$DEST_DIR/bin" "$DEST_DIR/lib"
  cp "${EXTRACTED_DIR}/bin/node" "$DEST_DIR/bin/"
  chmod +x "$DEST_DIR/bin/node"
  cp -r "${EXTRACTED_DIR}/lib/node_modules" "$DEST_DIR/lib/" 2>/dev/null || true
fi

# Remove unnecessary files
rm -rf "${DEST_DIR}/bin/npm" "${DEST_DIR}/bin/npx" 2>/dev/null || true
rm -rf "${DEST_DIR}/bin/npm.cmd" "${DEST_DIR}/bin/npx.cmd" 2>/dev/null || true
rm -rf "${DEST_DIR}/include" 2>/dev/null || true
rm -rf "${DEST_DIR}/share" 2>/dev/null || true
rm -f "${DEST_DIR}/CHANGELOG.md" "${DEST_DIR}/LICENSE" "${DEST_DIR}/README.md" 2>/dev/null || true
rm -f "${DEST_DIR}/node.lib" "${DEST_DIR}/node.pdb" 2>/dev/null || true
rm -rf "${DEST_DIR}/lib/node_modules/npm" "${DEST_DIR}/lib/node_modules/corepack" 2>/dev/null || true

echo "Node.js ${NODE_VERSION} (${PLATFORM}-${ARCH}) ready at ${DEST_DIR}"
echo "Size: $(du -sh "$DEST_DIR" | cut -f1)"
