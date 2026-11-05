# Exercise the real installer without registering a task or running the coordinator.
$ErrorActionPreference = 'Stop'
$root = Join-Path ([IO.Path]::GetTempPath()) ('forge-install-test-' + [guid]::NewGuid())
$installer = Join-Path $PSScriptRoot 'install.ps1'
New-Item -ItemType Directory -Path $root | Out-Null
$originalSystemRoot = $env:SystemRoot
try {
    $repo = Join-Path $root 'repo with spaces'
    $launcher = Join-Path $repo 'tools\programmed-coordinator\launch.ps1'
    New-Item -ItemType Directory -Path (Split-Path $launcher) -Force | Out-Null
    Set-Content -LiteralPath $launcher -Value '# never executed'
    $connection = Join-Path $root 'connection.json'
    Set-Content -LiteralPath $connection -Value '{}'
    $configPath = Join-Path $root 'config with spaces.json'
    @{repositoryDirectory=$repo;connectionFile=$connection} | ConvertTo-Json | Set-Content -LiteralPath $configPath
    $env:SystemRoot = Join-Path $root 'Windows'
    $consoleHost = Join-Path $env:SystemRoot 'System32\conhost.exe'
    New-Item -ItemType Directory -Path (Split-Path $consoleHost) -Force | Out-Null
    Set-Content -LiteralPath $consoleHost -Value ''
    function git {
        $global:LASTEXITCODE = 0
        if ($args -contains 'ls-remote') { return ('a' * 40) + "`trefs/heads/main" }
        if ($args -contains 'rev-parse') { return 'a' * 40 }
    }
    function Get-Command { param($Name, $ErrorAction) @{Source='C:\Program Files\PowerShell\7\pwsh.exe'} }
    function New-ScheduledTaskAction { param($Execute,$Argument,$WorkingDirectory) @{Execute=$Execute;Arguments=$Argument;WorkingDirectory=$WorkingDirectory} }
    function New-ScheduledTaskPrincipal { param($UserId,$LogonType,$RunLevel) @{} }
    $capture = @{}
    function Register-ScheduledTask {
        param($TaskName,$Action,$Trigger,$Settings,$Principal,[switch]$Force)
        $capture.registered = @{Name=$TaskName;Action=$Action;Trigger=$Trigger}
    }
    function Get-ScheduledTask { param($TaskName) @{TaskName=$TaskName;State='Ready'} }
    # Switch parameters in the native cmdlets are accepted by these mock functions.
    function New-ScheduledTaskTrigger { param([switch]$Once,$At,$RepetitionInterval) @{Interval=$RepetitionInterval} }
    function New-ScheduledTaskSettingsSet { param($MultipleInstances,[switch]$StartWhenAvailable,$ExecutionTimeLimit) @{} }
    $expected = '--headless "C:\Program Files\PowerShell\7\pwsh.exe" -NoProfile -NonInteractive -WindowStyle Hidden -File "' + $launcher + '" -ConfigFile "' + $configPath + '"'
    foreach ($installation in 1..2) {
        & $installer -ConfigFile $configPath | Out-Null
        $registered = $capture.registered
        if ($registered.Name -ne 'FORGE_PROGRAMMED_COORDINATOR' -or
            $registered.Action.Execute -ne $consoleHost -or
            $registered.Action.Arguments -cne $expected -or
            $registered.Action.WorkingDirectory -ne $repo -or
            $registered.Trigger.Interval.TotalMinutes -ne 5) { throw 'Install/reinstall changed the headless launch contract or schedule' }
    }
    Remove-Item -LiteralPath $consoleHost
    $capture.registered = $null
    $rejected = $false
    try { & $installer -ConfigFile $configPath | Out-Null } catch {
        if ($_.Exception.Message -notlike 'Headless console host is required*') { throw }
        $rejected = $true
    }
    if (-not $rejected -or $capture.registered) { throw 'Missing conhost must fail before replacing the task' }
    Write-Output 'Installer headless launch, reinstall, quoted paths, schedule and missing-host checks passed.'
} finally {
    $env:SystemRoot = $originalSystemRoot
    Remove-Item -LiteralPath $root -Recurse -Force
}
