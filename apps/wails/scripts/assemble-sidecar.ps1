# Assemble the Sidecar into the Wails build output (Windows)
# Must run AFTER `wails build` completes.

param()

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Join-Path $ScriptDir ".."
$BuildDir = Join-Path $ProjectDir "build" "bin"

$SidecarDir = Join-Path $BuildDir "sidecar"
$NodeVersion = if ($env:NODE_VERSION) { $env:NODE_VERSION } else { "22.15.0" }
$NodeCache = Join-Path $ScriptDir ".." ".cache" "node" $NodeVersion "win-x64" "stripped"
$SidecarBundle = Join-Path $ProjectDir ".." "sidecar" "dist" "sidecar.mjs"

Write-Host "Assembling Sidecar into $SidecarDir..."

New-Item -ItemType Directory -Path (Join-Path $SidecarDir "app") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $SidecarDir "data") -Force | Out-Null

if (Test-Path $NodeCache) {
  Write-Host "Copying Node.js runtime..."
  New-Item -ItemType Directory -Path (Join-Path $SidecarDir "node") -Force | Out-Null
  Copy-Item -Path "$NodeCache\*" -Destination (Join-Path $SidecarDir "node") -Recurse -Force
} else {
  Write-Host "Warning: Node.js runtime not cached. Run download-node.ps1 first."
}

if (Test-Path $SidecarBundle) {
  Write-Host "Copying Sidecar bundle..."
  Copy-Item $SidecarBundle (Join-Path $SidecarDir "app" "sidecar.mjs") -Force
} else {
  Write-Host "Warning: Sidecar bundle not found. Run 'pnpm --filter @lumina/sidecar build' first."
}

Write-Host "Sidecar assembly complete."
