param([Parameter(Mandatory=$true)][string]$ConfigFile)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigFile -Raw | ConvertFrom-Json
foreach ($name in @('repositoryDirectory','cockpitDirectory','connectionFile','privateDirectory','productionLock')) {
    if (-not $config.$name -or -not [IO.Path]::IsPathFullyQualified($config.$name)) { throw "Absolute configuration path required: $name" }
}
$repo = [IO.Path]::GetFullPath($config.repositoryDirectory)
Set-Location -LiteralPath $repo
function Git-Checked([string[]]$GitArgs) {
    $result = & git @GitArgs
    if ($LASTEXITCODE -ne 0) { throw 'Git operation failed; retained local state needs reconciliation' }
    return $result
}
# Publish retained accounting even when a failed push left a clean committed checkout.
function Publish-Accounting {
    & node tools/programmed-coordinator/publish.cjs $repo
    if ($LASTEXITCODE -ne 0) { throw 'Accounting publication needs reconciliation; retained evidence and lock preserved' }
}
$env:ACTIVITY_FC_DIR = $config.cockpitDirectory
$env:FORGE_CONNECTION_FILE = $config.connectionFile
$env:FORGE_PRIVATE_WORK_DIR = $config.privateDirectory
$env:FORGE_PRODUCTION_LOCK = $config.productionLock
$env:FORGE_COORDINATOR_HELD_RUN_ID = 'FORGE-CODE-CHATGPT-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
$lockScript = Join-Path $repo 'tools\automation-run-lock.cjs'
& node $lockScript acquire $config.productionLock $env:FORGE_COORDINATOR_HELD_RUN_ID
if ($LASTEXITCODE -ne 0) { throw 'Production lock held; preserve prior run and defer' }
# The existing connection stays local. No Writer credential is put in Git,
# scheduler arguments, output, a helper prompt or an environment configuration.
try {
    Publish-Accounting
    Git-Checked @('fetch','origin','main') | Out-Null
    Git-Checked @('merge','--ff-only','origin/main') | Out-Null
    & node tools/programmed-coordinator/run.cjs apply
    $runExit = $LASTEXITCODE
} finally {
    # A failed publication deliberately retains the shared lock and all local
    # evidence. Resolve that failure before allowing a second coordinator.
    Publish-Accounting
    & node $lockScript release $config.productionLock $env:FORGE_COORDINATOR_HELD_RUN_ID
    if ($LASTEXITCODE -ne 0) { throw 'Accounting persisted, but shared lock release failed' }
}
if ($runExit -ne 0) { throw "Coordinator retained unfinished work (exit $runExit)" }
