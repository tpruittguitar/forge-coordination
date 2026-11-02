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
# A publication failure leaves a dirty checkout. Publish exactly the retained
# accounting before fetching again; never reset a checkpoint or copy over main.
function Publish-Accounting {
    $changed = @(Git-Checked @('status','--porcelain','--untracked-files=all'))
    if (-not $changed.Count) { return }
    $paths = @('state/PROGRAMMED_COORDINATOR.json','state/PROGRAMMED_COORDINATOR_REPORT.json',
        'state/RELEVANCE_INTAKE_PLAN.json','state/RELEVANCE_SCREEN_GUARD.json','state/CLAUDE_HELPER_CONSUMPTION.json',
        'state/EMAIL_RECOVERY_QUEUE.json','state/EMAIL_RECOVERY_SUMMARY.json','control/CLAUDE_HELPER_WORK.json','control/ENRICHMENT_HELPER_WORK.json')
    foreach ($line in $changed) {
        $relative = $line.Substring(3).Replace('\','/').Trim('"')
        if ($paths -notcontains $relative -and $relative -notmatch '^receipts/FORGE-CODE-CHATGPT-[A-Za-z0-9_-]+_(CHECKPOINT|ACCEPTANCE|VERIFIED|SCREEN|TERMINAL)\.json$') {
            throw "Unexpected changed path; preserve and inspect: $relative"
        }
        Git-Checked @('add','--',$relative) | Out-Null
    }
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        Git-Checked @('-c','user.name=forge-code-coordinator','-c','user.email=forge-code-coordinator@users.noreply.github.com',
            'commit','-m','CHATGPT FORGE-CODE-COORDINATOR: checkpoint helper processing and verified effects') | Out-Null
    } elseif ($LASTEXITCODE -ne 0) { throw 'Cannot inspect staged accounting' }
    Git-Checked @('fetch','origin','main') | Out-Null
    # Rebase retains independent bot appends. A real conflict stays visible and
    # stops this runner; no force push, reset or scripted conflict resolution.
    Git-Checked @('rebase','origin/main') | Out-Null
    Git-Checked @('push','origin','HEAD:main') | Out-Null
    $local = Git-Checked @('rev-parse','HEAD')
    Git-Checked @('fetch','origin','main') | Out-Null
    Git-Checked @('merge-base','--is-ancestor',$local,'origin/main') | Out-Null
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
