# Gera uma migration do banco do plugin (schema `colabora`) a partir de database/schema/index.ts, com o drizzle-kit
# do core. Nao toca em banco nenhum (so compara o schema com os snapshots em migrations/meta).
#
#   powershell -NoProfile -File scripts\db-generate.ps1 -Name metas
#
# Usa o MESMO mutex de scripts\verify.ps1 (o junction node_modules do plugin e um recurso unico) e remove o junction
# no fim. Nunca editar migrations/meta/_journal.json a mao. Arquivo so em ASCII (PowerShell 5.1).
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$Core = "C:\dev\venore\venore-docks",
  [int]$WaitMinutes = 20
)
$ErrorActionPreference = "Stop"
$plugin = Split-Path -Parent $PSScriptRoot
$Core = (Resolve-Path $Core).Path

$mutex = New-Object System.Threading.Mutex($false, "Global\venore-colabora-verify")
Write-Host "[db-generate] aguardando a vez..."
if (-not $mutex.WaitOne([TimeSpan]::FromMinutes($WaitMinutes))) { throw "Nao consegui a vez em $WaitMinutes min." }
try {
  $junction = Join-Path $plugin "node_modules"
  $created = $false
  if (-not (Test-Path $junction)) {
    New-Item -ItemType Junction -Path $junction -Target (Join-Path $Core "node_modules") | Out-Null
    $created = $true
  }
  try {
    Push-Location $plugin
    & node (Join-Path $Core "node_modules\drizzle-kit\bin.cjs") generate --config drizzle.config.ts --name $Name
    if ($LASTEXITCODE -ne 0) { throw "drizzle-kit generate falhou ($LASTEXITCODE)." }
  }
  finally {
    Pop-Location
    if ($created -and (Get-Item $junction -Force -ErrorAction SilentlyContinue).LinkType -eq "Junction") { (Get-Item $junction).Delete() }
  }
}
finally {
  $mutex.ReleaseMutex()
}
