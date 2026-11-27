# Roda os testes do plugin a partir do core clonado (default ..\venore-docks):
#   .\scripts\run-tests.ps1 [-Filter workflow]   unitarios (nenhum fala com o Zammad: usam os recortes em shared/__fixtures__)
#   .\scripts\run-tests.ps1 -Integration         banco do plugin contra Postgres EM MEMORIA (PGlite); nenhum banco real
# Cria um junction node_modules -> core (o plugin nao tem node_modules proprio) e o remove no fim. Usa o MESMO mutex
# de scripts\verify.ps1 (o junction e um recurso unico). Arquivo so em ASCII (PowerShell 5.1 le sem BOM como ANSI).
param([string]$Core = "", [string]$Filter = "", [switch]$Integration, [int]$WaitMinutes = 20)
$ErrorActionPreference = "Stop"
$plugin = Split-Path -Parent $PSScriptRoot
if (-not $Core) { $Core = Join-Path (Split-Path -Parent $plugin) "venore-docks" }
$Core = (Resolve-Path $Core).Path

$mutex = New-Object System.Threading.Mutex($false, "Global\venore-colabora-verify")
if (-not $mutex.WaitOne([TimeSpan]::FromMinutes($WaitMinutes))) { throw "Nao consegui a vez em $WaitMinutes min." }
Push-Location $Core
try {
  if ($Integration -and -not (Test-Path (Join-Path $Core "node_modules\@electric-sql\pglite"))) {
    # --no-save: instala o PGlite no core SEM gravar em package.json/lock.
    npm install --no-save --no-audit --no-fund --loglevel=error @electric-sql/pglite
  }
  $junction = Join-Path $plugin "node_modules"
  if (Test-Path $junction) { throw "$junction ja existe - remova antes (e so um junction temporario)." }
  New-Item -ItemType Junction -Path $junction -Target (Join-Path $Core "node_modules") | Out-Null
  try {
    $env:CORE_DIR = $Core
    $config = if ($Integration) { "tests\integration\vitest.integration.config.ts" } else { "tests\vitest.unit.config.ts" }
    $vitestArgs = @("vitest", "run", "--config", (Join-Path $plugin $config))
    if ($Filter) { $vitestArgs += $Filter }
    & npx @vitestArgs
  } finally {
    (Get-Item $junction).Delete()
  }
} finally {
  Pop-Location
  $mutex.ReleaseMutex()
}
