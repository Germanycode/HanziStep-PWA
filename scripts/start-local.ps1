param([switch]$Rebuild)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

function Invoke-Npm {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )
  & npm @Arguments
  if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

# `npm install` is incremental. Running it every time keeps node_modules in
# sync with package-lock.json without deleting a working installation first.
Write-Host 'Checking dependencies...'
Invoke-Npm -Arguments @('install', '--no-fund', '--no-audit') -FailureMessage 'Dependency installation failed.'

$manifest = Join-Path $root 'public\data\v1\manifest.json'
if (-not (Test-Path -LiteralPath $manifest)) {
  Write-Host 'Data pack not found. Downloading and building it...'
  Invoke-Npm -Arguments @('run', 'data:fetch') -FailureMessage 'Data download failed.'
  Invoke-Npm -Arguments @('run', 'data:build') -FailureMessage 'Data build failed.'
}

# Always validate and rebuild. Source changes must never be hidden behind a
# stale dist/index.html left by an earlier Claude or developer run.
Write-Host 'Validating data and building the current source...'
Invoke-Npm -Arguments @('run', 'data:validate') -FailureMessage 'Data validation failed.'
Invoke-Npm -Arguments @('run', 'build', '--ignore-scripts') -FailureMessage 'App build failed.'

# Saved progress lives in IndexedDB for this exact origin, so the port never changes.
$url = 'http://localhost:4173'
$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

# Open only after an HTTP response proves that this port serves HanziStep.
Start-Job -ArgumentList $url, $edge -ScriptBlock {
  param($url, $edge)
  $ready = $false
  for ($i = 0; $i -lt 120; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200 -and $response.Content -match 'HanziStep') {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if (-not $ready) { return }
  if ($edge) { Start-Process -FilePath $edge -ArgumentList $url } else { Start-Process $url }
} | Out-Null

Write-Host "HanziStep is running at $url - close this window to stop it."
Invoke-Npm -Arguments @('run', 'preview') -FailureMessage 'Preview server stopped with an error.'
