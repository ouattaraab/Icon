# Icon Agent — Windows MSI Build Script
# Requires: Rust toolchain, WiX Toolset v4 (dotnet tool install --global wix)
# Usage: .\build.ps1 [-Version "0.1.0"] [-ServerUrl "https://icon.gs2e.ci"]

param(
    [string]$Version = "0.1.0",
    [string]$ServerUrl = "https://icon.gs2e.ci",
    [string]$Target = "x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = (Resolve-Path "$ScriptDir\..\..").Path
$AgentDir = Join-Path $RootDir "agent"
$OutputMsi = Join-Path $ScriptDir "Icon-Agent-$Version.msi"

Write-Host "=== Building Icon Agent Windows MSI v$Version ===" -ForegroundColor Cyan

# Step 1: Build Rust binaries (release)
Write-Host "`n[1/4] Building Rust agent and watchdog..." -ForegroundColor Yellow
Push-Location $AgentDir
try {
    cargo build --release --target $Target
    if ($LASTEXITCODE -ne 0) { throw "Cargo build failed" }
} finally {
    Pop-Location
}

$AgentBinary = Join-Path $AgentDir "target\$Target\release\icon-agent.exe"
$WatchdogBinary = Join-Path $AgentDir "target\$Target\release\icon-watchdog.exe"

if (-not (Test-Path $AgentBinary)) { throw "Agent binary not found: $AgentBinary" }
if (-not (Test-Path $WatchdogBinary)) { throw "Watchdog binary not found: $WatchdogBinary" }

$AgentSize = [math]::Round((Get-Item $AgentBinary).Length / 1MB, 1)
$WatchdogSize = [math]::Round((Get-Item $WatchdogBinary).Length / 1MB, 1)
Write-Host "  Agent:    $AgentSize MB" -ForegroundColor Green
Write-Host "  Watchdog: $WatchdogSize MB" -ForegroundColor Green

# Step 2: Sign binaries (if signtool available)
Write-Host "`n[2/4] Checking code signing..." -ForegroundColor Yellow
$SignTool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if ($SignTool) {
    Write-Host "  Signing agent binary..."
    & signtool.exe sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a $AgentBinary
    & signtool.exe sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a $WatchdogBinary
    Write-Host "  Binaries signed" -ForegroundColor Green
} else {
    Write-Host "  signtool.exe not found, skipping code signing" -ForegroundColor DarkYellow
}

# Step 3: Build MSI with WiX
Write-Host "`n[3/4] Building MSI package..." -ForegroundColor Yellow
Push-Location $ScriptDir
try {
    wix build icon.wxs -o $OutputMsi -d "Version=$Version"
    if ($LASTEXITCODE -ne 0) { throw "WiX build failed" }
} finally {
    Pop-Location
}

# Step 4: Sign MSI
if ($SignTool) {
    Write-Host "`n[4/4] Signing MSI..." -ForegroundColor Yellow
    & signtool.exe sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a $OutputMsi
    Write-Host "  MSI signed" -ForegroundColor Green
} else {
    Write-Host "`n[4/4] Skipping MSI signing (no signtool)" -ForegroundColor DarkYellow
}

# Compute checksum
$Hash = (Get-FileHash $OutputMsi -Algorithm SHA256).Hash
$MsiSize = [math]::Round((Get-Item $OutputMsi).Length / 1MB, 1)

Write-Host "`n=== Build Complete ===" -ForegroundColor Cyan
Write-Host "  Output:   $OutputMsi" -ForegroundColor Green
Write-Host "  Size:     $MsiSize MB" -ForegroundColor Green
Write-Host "  SHA-256:  $Hash" -ForegroundColor Green
Write-Host ""
Write-Host "Deploy via GPO:" -ForegroundColor Yellow
Write-Host "  1. Copy MSI to network share (\\server\deploy\icon\)"
Write-Host "  2. Create GPO: Computer Config > Policies > Software Settings"
Write-Host "  3. Add package: Icon-Agent-$Version.msi"
Write-Host "  4. Set to 'Assigned' for automatic installation"
