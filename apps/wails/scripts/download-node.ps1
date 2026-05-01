# Download and cache a stripped Node.js runtime for the Sidecar (Windows)
# Usage: .\download-node.ps1 [[-Version] <string>] [[-Platform] <string>] [[-Arch] <string>]

param(
  [string]$Version = "22.15.0",
  [string]$Platform = "win",
  [string]$Arch = "x64"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CacheDir = Join-Path $ScriptDir ".." ".cache" "node" $Version "$Platform-$Arch"
$DestDir = Join-Path $CacheDir "stripped"

if ((Test-Path (Join-Path $DestDir "node.exe"))) {
  Write-Host "Node.js $Version ($Platform-$Arch) already cached at $DestDir"
  exit 0
}

$Archive = "node-v$Version-win-$Arch.zip"
$Url = "https://nodejs.org/dist/v$Version/$Archive"

Write-Host "Downloading Node.js $Version ($Platform-$Arch)..."

$TmpDir = Join-Path $env:TEMP "node-download-$(Get-Random)"
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null

try {
  $ArchivePath = Join-Path $TmpDir $Archive
  Invoke-WebRequest -Uri $Url -OutFile $ArchivePath -UseBasicParsing

  Write-Host "Extracting..."
  $ExtractDir = Join-Path $TmpDir "extracted"
  Expand-Archive -Path $ArchivePath -DestinationPath $ExtractDir -Force

  $ExtractedDir = Get-ChildItem -Path $ExtractDir -Directory -Filter "node-v*" | Select-Object -First 1

  Write-Host "Stripping unnecessary files..."
  New-Item -ItemType Directory -Path $DestDir -Force | Out-Null

  Copy-Item (Join-Path $ExtractedDir.FullName "node.exe") $DestDir

  Write-Host "Node.js $Version ($Platform-$Arch) ready at $DestDir"
}
finally {
  Remove-Item -Path $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
