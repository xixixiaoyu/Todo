# ==============================================================================
# package-windows.ps1 — Windows 代码签名 + NSIS 安装器打包
#
# 用法：
#   .\scripts\package-windows.ps1                           # 仅创建安装器（无签名）
#   .\scripts\package-windows.ps1 -Sign                     # 签名 + 安装器
#   .\scripts\package-windows.ps1 -CertPath .\cert.pfx      # 指定签名证书
#
# 环境变量：
#   CODE_SIGN_CERT_PATH  — 代码签名证书路径 (.pfx / .p12)
#   CODE_SIGN_PASSWORD   — 证书密码
#   CODE_SIGN_TIMESTAMP  — 时间戳服务器 URL（默认: DigiCert）
# ==============================================================================
param(
  [switch]$Sign = $false,
  [string]$CertPath = "",
  [string]$CertPassword = "",
  [string]$TimestampServer = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Join-Path $ScriptDir ".."
$BuildDir = Join-Path $ProjectDir "build" "bin"
$WindowsDir = Join-Path $ProjectDir "build" "windows"
$AppExe = Join-Path $BuildDir "Lumina.exe"

# ---- 检查构建产物 ----
if (-not (Test-Path $AppExe)) {
  Write-Host "ERROR: Lumina.exe not found at $AppExe" -ForegroundColor Red
  Write-Host "Run 'wails build' first." -ForegroundColor Red
  exit 1
}

$AppVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($AppExe).FileVersion
if (-not $AppVersion) { $AppVersion = "1.0.0.0" }

Write-Host "Lumina version: $AppVersion" -ForegroundColor Green

# ---- 确定证书路径 ----
$EffectiveCertPath = if ($CertPath) { $CertPath } else { $env:CODE_SIGN_CERT_PATH }
$EffectiveCertPassword = if ($CertPassword) { $CertPassword } else { $env:CODE_SIGN_PASSWORD }

# ---- 代码签名 ----
if ($Sign) {
  if (-not $EffectiveCertPath) {
    Write-Host "ERROR: Certificate path not specified. Set -CertPath or CODE_SIGN_CERT_PATH." -ForegroundColor Red
    exit 1
  }
  if (-not $EffectiveCertPassword) {
    Write-Host "ERROR: Certificate password not specified. Set -CertPassword or CODE_SIGN_PASSWORD." -ForegroundColor Red
    exit 1
  }

  Write-Host "Signing $AppExe..." -ForegroundColor Yellow

  $signArgs = @(
    "sign",
    "/fd", "SHA256",
    "/f", $EffectiveCertPath,
    "/p", $EffectiveCertPassword,
    "/tr", $TimestampServer,
    "/td", "SHA256",
    "/v",
    $AppExe
  )

  & "signtool.exe" @signArgs 2>&1 | Out-Host

  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Code signing failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
  }

  Write-Host "Code signing complete." -ForegroundColor Green
} else {
  Write-Host "Skipping code signing (use -Sign to enable)" -ForegroundColor Yellow
  Write-Host "Without signing, Windows SmartScreen will warn users." -ForegroundColor Yellow
}

# ---- 创建 NSIS 安装器 ----
$NsisScript = Join-Path $WindowsDir "installer.nsi"
if (Test-Path $NsisScript) {
  Write-Host "Building NSIS installer..." -ForegroundColor Yellow

  $arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "x86" }
  $nsisArgs = @(
    "/DVERSION=$AppVersion",
    "/DARCH=$arch",
    $NsisScript
  )

  $makensis = Get-Command makensis -ErrorAction SilentlyContinue
  if ($makensis) {
    & makensis.exe @nsisArgs 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
      Write-Host "WARNING: NSIS build returned exit code $LASTEXITCODE" -ForegroundColor Yellow
    } else {
      Write-Host "NSIS installer created." -ForegroundColor Green
    }

    # 签名安装器
    if ($Sign) {
      $SetupExe = Join-Path $BuildDir "Lumina-Setup-$AppVersion-$arch.exe"
      if (Test-Path $SetupExe) {
        Write-Host "Signing installer..." -ForegroundColor Yellow
        $signSetupArgs = @(
          "sign",
          "/fd", "SHA256",
          "/f", $EffectiveCertPath,
          "/p", $EffectiveCertPassword,
          "/tr", $TimestampServer,
          "/td", "SHA256",
          "/v",
          $SetupExe
        )
        & "signtool.exe" @signSetupArgs 2>&1 | Out-Host
        Write-Host "Installer signed." -ForegroundColor Green
      }
    }
  } else {
    Write-Host "WARNING: makensis not found. Skipping NSIS installer." -ForegroundColor Yellow
    Write-Host "Install NSIS from: https://nsis.sourceforge.io/Download" -ForegroundColor Yellow
  }
} else {
  Write-Host "WARNING: installer.nsi not found at $NsisScript" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Windows package complete ===" -ForegroundColor Green
Write-Host "Output directory: $BuildDir" -ForegroundColor Green
Get-ChildItem $BuildDir -Filter "*.exe" | ForEach-Object {
  Write-Host "  $($_.Name) — $([math]::Round($_.Length / 1MB, 1)) MB" -ForegroundColor Cyan
}
