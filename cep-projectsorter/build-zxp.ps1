# Build CEP ZXP archive for installation via ZXP Installer
# Usage: Right-click -> Run with PowerShell (or run from terminal in repo root)

$ErrorActionPreference = 'Stop'

# Go to script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$Source = $ScriptDir  # package the contents of current folder
$OutDir = Join-Path $ScriptDir 'dist'
$OutFile = Join-Path $OutDir 'projectsorter.zxp'

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

# Remove old
if (Test-Path $OutFile) { Remove-Item $OutFile -Force }

# Create temp zip
$TempZip = Join-Path $OutDir 'projectsorter.zip'
if (Test-Path $TempZip) { Remove-Item $TempZip -Force }

# Important: pack CONTENTS of this folder, not the folder itself
Compress-Archive -Path (Join-Path $Source '*') -DestinationPath $TempZip -Force

# Rename to .zxp
Rename-Item -Path $TempZip -NewName 'projectsorter.zxp'

Write-Host "Built: $OutFile"
