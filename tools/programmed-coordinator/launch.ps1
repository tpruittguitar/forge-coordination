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
function Publish-Accounting([string]$Phase) {
    & node tools/programmed-coordinator/publish.cjs $repo | Out-Host
    if ($LASTEXITCODE -eq 0) { return $true }
    # This is an audit delivery failure, not ownership of a live Writer operation.
    # Retain every local commit/checkpoint and make the failure available to Gofer.
    $failure = @{ schema='forge.audit-publication-failure.v1'; at=(Get-Date).ToUniversalTime().ToString('o'); runId=$env:FORGE_COORDINATOR_HELD_RUN_ID; phase=$Phase; status='AUDIT_PENDING'; owner='FORGE_APPLICATION_WRITER_GOFER'; nextAction='Reconcile and publish retained accounting; never replay canonical writes'; writerSubmissions=0 }
    $directory = Join-Path $config.privateDirectory 'audit-failures'
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $failure | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $directory ($env:FORGE_COORDINATOR_HELD_RUN_ID + '-' + $Phase + '.json')) -Encoding utf8
    Write-Warning 'AUDIT_PENDING: retained accounting needs publication; independent jobs may continue.'
    return $false
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
    $published = Publish-Accounting 'before'
    if ($published) {
        Git-Checked @('fetch','origin','main') | Out-Null
        Git-Checked @('merge','--ff-only','origin/main') | Out-Null
    } else {
        # Work from the retained trusted revision while delivery is unavailable.
        # An interrupted merge or changed code still requires reconciliation.
        & node tools/programmed-coordinator/publish.cjs $repo --check-retained
        if ($LASTEXITCODE -ne 0) { throw 'Retained checkout requires code or merge reconciliation' }
    }
    & node tools/programmed-coordinator/run.cjs apply
    $runExit = $LASTEXITCODE
} finally {
    # Publication, including failure recording, cannot prevent lock release.
    # Original transaction checkpoints keep uncertain requests fenced after release.
    try { Publish-Accounting 'after' | Out-Null }
    finally {
        & node $lockScript release $config.productionLock $env:FORGE_COORDINATOR_HELD_RUN_ID
        if ($LASTEXITCODE -ne 0) { throw 'Shared lock release failed; inspect actual owner' }
    }
}
if ($runExit -ne 0) { throw "Coordinator retained unfinished work (exit $runExit)" }
