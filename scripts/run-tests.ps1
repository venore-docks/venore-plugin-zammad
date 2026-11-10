# Roda os testes unitários do plugin a partir do core clonado (default ..\venore-docks):
#   .\scripts\run-tests.ps1 [-Filter workflow]
# Cria um junction node_modules -> core (o plugin não tem node_modules próprio) e o remove no fim.
# Nenhum teste fala com o Zammad de verdade: usam o recorte em shared/__fixtures__/fem-schema.ts.
param([string]$Core = "", [string]$Filter = "")
$ErrorActionPreference = "Stop"
$plugin = Split-Path -Parent $PSScriptRoot
if (-not $Core) { $Core = Join-Path (Split-Path -Parent $plugin) "venore-docks" }
$Core = (Resolve-Path $Core).Path

Push-Location $Core
try {
  $junction = Join-Path $plugin "node_modules"
  if (Test-Path $junction) { throw "$junction já existe — remova antes (é só um junction temporário)." }
  New-Item -ItemType Junction -Path $junction -Target (Join-Path $Core "node_modules") | Out-Null
  try {
    $env:CORE_DIR = $Core
    $args = @("vitest", "run", "--config", (Join-Path $plugin "tests\vitest.unit.config.ts"))
    if ($Filter) { $args += $Filter }
    & npx @args
  } finally {
    (Get-Item $junction).Delete()
  }
} finally {
  Pop-Location
}
