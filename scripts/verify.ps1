# Verifica o plugin (testes unitários + typecheck + lint) contra o core, de forma SEGURA para uso em paralelo.
#
#   powershell -File scripts\verify.ps1                      # verifica este repo
#   powershell -File scripts\verify.ps1 -Plugin C:\caminho   # verifica outra cópia/worktree do plugin
#   -Only tests|tsc|lint   roda só uma etapa
#
# Por que existe: o typecheck/lint precisam que `node_modules/@venore/plugin-colabora` do core aponte para a
# cópia do plugin que está sendo verificada, e isso é um recurso ÚNICO. Vários agentes/worktrees rodando juntos
# se atropelariam. Este script pega um mutex global (os outros esperam a vez), aponta o junction para -Plugin,
# roda tudo e SEMPRE restaura o core ao estado anterior (pasta real renomeada de volta, package.json e lock
# restaurados de backup, registros regenerados). Nunca roda build nem toca banco.
param(
  [string]$Plugin = (Split-Path -Parent $PSScriptRoot),
  [string]$Core = "C:\dev\venore\venore-docks",
  [ValidateSet("all", "tests", "tsc", "lint")][string]$Only = "all",
  [int]$WaitMinutes = 20
)
# "Continue" de propósito: no Windows PowerShell 5.1, com "Stop" qualquer linha de aviso que o npx/vitest escreve
# no stderr (e que redirecionamos com 2>&1) vira erro terminante e derruba o script. As operações que PRECISAM
# parar (renomear/criar junction) levam -ErrorAction Stop explícito.
$ErrorActionPreference = "Continue"
$Plugin = (Resolve-Path $Plugin).Path
$Core = (Resolve-Path $Core).Path

$mutex = New-Object System.Threading.Mutex($false, "Global\venore-colabora-verify")
Write-Host "[verify] aguardando a vez (outro agente pode estar verificando)..."
if (-not $mutex.WaitOne([TimeSpan]::FromMinutes($WaitMinutes))) { throw "Não consegui a vez em $WaitMinutes min." }
Write-Host "[verify] a vez é minha. Plugin: $Plugin"

$scope = Join-Path $Core "node_modules\@venore"
$names = @("plugin-colabora", "plugin-zammad")
$renamed = @()
$pluginNm = Join-Path $Plugin "node_modules"
$createdPluginNm = $false
$tmpPkg = Join-Path $env:TEMP "verify-colabora-package.json.bak"
$tmpLock = Join-Path $env:TEMP "verify-colabora-package-lock.json.bak"
$results = @{}

try {
  Push-Location $Core
  Copy-Item (Join-Path $Core "package.json") $tmpPkg -Force
  Copy-Item (Join-Path $Core "package-lock.json") $tmpLock -Force

  # 1) tira do caminho qualquer instalação REAL do plugin (nova ou antiga) e aponta o junction para o repo.
  foreach ($name in $names) {
    $path = Join-Path $scope $name
    $item = Get-Item $path -Force -ErrorAction SilentlyContinue
    if ($item) {
      if ($item.LinkType -eq "Junction") { $item.Delete() }
      else { Rename-Item $path "$name.__verify_bak" -ErrorAction Stop; $renamed += $name }
    }
  }
  New-Item -ItemType Junction -Path (Join-Path $scope "plugin-colabora") -Target $Plugin -ErrorAction Stop | Out-Null
  if (-not (Test-Path $pluginNm)) {
    New-Item -ItemType Junction -Path $pluginNm -Target (Join-Path $Core "node_modules") | Out-Null
    $createdPluginNm = $true
  }

  # 2) no package.json temporário: só o plugin novo (o antigo `zammad` registraria rotas duplicadas).
  npm pkg delete "dependencies.@venore/plugin-zammad" | Out-Null
  npm pkg set "dependencies.@venore/plugin-colabora=file:$($Plugin -replace '\\', '/')" | Out-Null
  npm run gen:registries 2>&1 | Out-Null

  $env:CORE_DIR = $Core
  if ($Only -in @("all", "tests")) {
    Write-Host "[verify] testes..."
    $out = npx vitest run --config (Join-Path $Plugin "tests\vitest.unit.config.ts") --reporter=dot 2>&1 | Out-String
    $summary = ($out -split "`n" | Select-String -Pattern "Tests |Test Files|FAIL|Error:|AssertionError" | Select-Object -First 25) -join "`n"
    $results.tests = if ($LASTEXITCODE -eq 0) { "OK`n$summary" } else { "FALHOU`n$summary" }
  }
  if ($Only -in @("all", "tsc")) {
    Write-Host "[verify] tsc..."
    $out = npx tsc --noEmit 2>&1 | Out-String
    $head = ($out -split "`n" | Select-Object -First 60) -join "`n"
    $results.tsc = if ($LASTEXITCODE -eq 0) { "OK" } else { "FALHOU`n$head" }
  }
  if ($Only -in @("all", "lint")) {
    Write-Host "[verify] lint..."
    $copy = Join-Path $Core ("src\plugins\_lint-colabora-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
    New-Item -ItemType Directory -Force $copy | Out-Null
    robocopy $Plugin $copy /E /XD node_modules .git .next /NFL /NDL /NJH /NJS | Out-Null
    $out = npx eslint $copy 2>&1 | Out-String
    $code = $LASTEXITCODE
    Remove-Item -Recurse -Force $copy
    $head = ($out -split "`n" | Select-Object -First 60) -join "`n"
    $results.lint = if ($code -eq 0) { "OK" } else { "FALHOU`n$head" }
  }
}
finally {
  try {
    $link = Join-Path $scope "plugin-colabora"
    if ((Get-Item $link -Force -ErrorAction SilentlyContinue).LinkType -eq "Junction") { (Get-Item $link).Delete() }
    foreach ($name in $renamed) { Rename-Item (Join-Path $scope "$name.__verify_bak") $name }
    if ($createdPluginNm -and (Get-Item $pluginNm -Force -ErrorAction SilentlyContinue).LinkType -eq "Junction") { (Get-Item $pluginNm).Delete() }
    if (Test-Path $tmpPkg) { Copy-Item $tmpPkg (Join-Path $Core "package.json") -Force }
    if (Test-Path $tmpLock) { Copy-Item $tmpLock (Join-Path $Core "package-lock.json") -Force }
    npm run gen:registries 2>&1 | Out-Null
  }
  finally {
    Pop-Location
    $mutex.ReleaseMutex()
  }
}

Write-Host ""
Write-Host "================ VERIFY ================"
foreach ($key in @("tests", "tsc", "lint")) { if ($results.ContainsKey($key)) { Write-Host "[$key] $($results[$key])" } }
if (($results.Values | Where-Object { $_ -notlike "OK*" }).Count -gt 0) { exit 1 }
exit 0
