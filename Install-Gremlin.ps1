<#
  ==============================================================
   GREMLIN - One-Shot Installer / Launcher
   (Anti-Copilot: The IDE Gremlin)
  ==============================================================

  Run this on any Windows 10/11 PC. It will:
    1. Make sure Node.js (LTS) and VS Code are installed - installing them
       automatically via winget if they are missing.
    2. Install all npm dependencies for the overlay + VS Code sensor.
    3. Build and install the VS Code extension (the "sensor").
    4. Boot the Gremlin overlay, which connects to the HOSTED backend
       (https://vercel-brain-zeta.vercel.app) and shows a loading splash
       while it connects.

  Nothing is run as admin and nothing touches the brain's AWS keys - the
  brain already lives in the cloud.

  Usage:
    Right-click  ->  "Run with PowerShell"   (or double-click Gremlin-Setup.bat)
    Or:  powershell -ExecutionPolicy Bypass -File .\Install-Gremlin.ps1

  Switches:
    -SkipLaunch   Install everything but do not boot the overlay.
    -BackendUrl   Override the hosted brain URL.
#>

param(
  [switch]$SkipLaunch,
  [string]$BackendUrl = "https://vercel-brain-zeta.vercel.app"
)

$ErrorActionPreference = "Stop"
$RepoRoot   = $PSScriptRoot
$OverlayDir = Join-Path $RepoRoot "desktop-overlay"
$SensorDir  = Join-Path $RepoRoot "vscode-sensor"

# ---- pretty output -------------------------------------------------
function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [ok] $msg"   -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  $msg"        -ForegroundColor Gray }
function Write-Warn2($msg){ Write-Host "  [!] $msg"    -ForegroundColor Yellow }
function Write-Err2($msg) { Write-Host "  [x] $msg"    -ForegroundColor Red }

function Refresh-Path {
  $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $user    = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

function Test-Cmd($name) {
  $null = Get-Command $name -ErrorAction SilentlyContinue
  return $?
}

function Ensure-Winget {
  if (Test-Cmd "winget") { return $true }
  Write-Err2 "winget (App Installer) is not available on this PC."
  Write-Info "Install 'App Installer' from the Microsoft Store, then re-run this script."
  Write-Info "Store link: https://apps.microsoft.com/detail/9NBLGGH4NNS1"
  return $false
}

# Install an app via winget if the given command is missing. Returns $true if
# the command is available afterwards.
function Ensure-App($cmd, $wingetId, $friendly) {
  if (Test-Cmd $cmd) { Write-Ok "$friendly already installed"; return $true }

  Write-Warn2 "$friendly not found - installing via winget ($wingetId)..."
  if (-not (Ensure-Winget)) { return $false }

  $null = Invoke-Native {
    winget install --id $wingetId -e --source winget `
      --accept-package-agreements --accept-source-agreements --silent
  }

  Refresh-Path
  if (Test-Cmd $cmd) { Write-Ok "$friendly installed"; return $true }

  Write-Err2 "$friendly still not detected on PATH."
  Write-Info "Open a NEW terminal (so PATH refreshes) and re-run this script."
  return $false
}

# Resolve the VS Code CLI even if it is not on PATH yet (fresh installs).
function Resolve-Code {
  if (Test-Cmd "code") { return "code" }
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\bin\code.cmd"),
    "C:\Program Files\Microsoft VS Code\bin\code.cmd"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  return $null
}

# Run a native command without letting its stderr (e.g. npm WARN lines) be
# turned into a terminating error by $ErrorActionPreference='Stop'. Returns the
# process exit code.
function Invoke-Native([scriptblock]$block) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  # Send the command's output straight to the console so it does NOT become
  # part of this function's return value (only the exit code should).
  try { & $block | Out-Host } finally { $ErrorActionPreference = $prev }
  return $LASTEXITCODE
}

function Invoke-Npm($dir, $argList, $label) {
  Write-Info "$label ..."
  Push-Location $dir
  try {
    $code = Invoke-Native { & npm @argList }
    if ($code -ne 0) { throw "npm $($argList -join ' ') failed (exit $code)" }
    Write-Ok $label
  } finally {
    Pop-Location
  }
}

# ====================================================================
Write-Host ""
Write-Host "  GREMLIN  -  Anti-Copilot IDE Gremlin" -ForegroundColor Red
Write-Host "  Hosted brain: $BackendUrl" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path $OverlayDir)) {
  Write-Err2 "Could not find 'desktop-overlay' next to this script."
  Write-Info "Run this from inside the project folder (the one containing desktop-overlay\ and vscode-sensor\)."
  exit 1
}

# ---- 1. Prerequisites ----------------------------------------------
Write-Step "1/5  Checking prerequisites"
if (-not (Ensure-App "node" "OpenJS.NodeJS.LTS" "Node.js (LTS)")) { exit 1 }
if (-not (Ensure-App "code" "Microsoft.VisualStudioCode" "VS Code")) {
  Write-Warn2 "VS Code missing - the sensor extension cannot be installed, but the overlay can still run."
}
Write-Info ("node " + (node --version))
Write-Info ("npm  " + (npm --version))

# ---- 2. Install dependencies ---------------------------------------
Write-Step "2/5  Installing dependencies"
Invoke-Npm $OverlayDir @("install") "Overlay dependencies"
if (Test-Path $SensorDir) {
  Invoke-Npm $SensorDir @("install") "Sensor (VS Code extension) dependencies"
}

# ---- 3. Build + install the VS Code extension ----------------------
Write-Step "3/5  Building and installing the VS Code sensor"
$codeCli = Resolve-Code
if ((Test-Path $SensorDir) -and $codeCli) {
  try {
    Invoke-Npm $SensorDir @("run", "package") "Packaging extension (.vsix)"
    $vsix = Get-ChildItem -Path $SensorDir -Filter *.vsix | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($vsix) {
      Write-Info "Installing $($vsix.Name) into VS Code..."
      $null = Invoke-Native { & $codeCli --install-extension $vsix.FullName --force }
      Write-Ok "Sensor extension installed"
    } else {
      Write-Warn2 "No .vsix was produced - skipping extension install."
    }
  } catch {
    Write-Warn2 "Extension build/install failed: $($_.Exception.Message)"
    Write-Info "The overlay will still run; the sensor just will not feed it telemetry."
  }
} else {
  Write-Warn2 "Skipping extension install (VS Code CLI not found)."
}

# ---- 4. Build the overlay ------------------------------------------
Write-Step "4/5  Building the overlay"
try {
  Invoke-Npm $OverlayDir @("run", "build") "Overlay build"
} catch {
  Write-Warn2 "Production build failed; dev mode will still boot it. ($($_.Exception.Message))"
}

# ---- 5. Launch -----------------------------------------------------
Write-Step "5/5  Launching Gremlin"
if ($SkipLaunch) {
  Write-Ok "Install complete. Skipping launch (-SkipLaunch)."
  Write-Info "To start later:  cd desktop-overlay ; npm run dev"
  exit 0
}

# Pass the hosted backend URL to the overlay; boot via the dev launcher
# (vite + electron), which is the supported run path in this repo.
Write-Info "Starting overlay (splash will show while it connects to the brain)..."
Write-Info "Leave the new window open. Close it to stop the Gremlin."

Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c", "set ANTI_COPILOT_BRAIN_URL=$BackendUrl && npm run dev" `
  -WorkingDirectory $OverlayDir

Write-Ok "Gremlin is booting. Open VS Code and start coding - it is watching."
