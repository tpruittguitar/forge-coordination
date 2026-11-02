param([Parameter(Mandatory=$true)][string]$ConfigFile)
$ErrorActionPreference = 'Stop'
$configPath = [IO.Path]::GetFullPath($ConfigFile)
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$repo = [IO.Path]::GetFullPath($config.repositoryDirectory)
$launcher = Join-Path $repo 'tools\programmed-coordinator\launch.ps1'
if (-not (Test-Path -LiteralPath $launcher) -or -not (Test-Path -LiteralPath $config.connectionFile)) { throw 'Merged launcher and existing connection are required' }
$remote = & git -C $repo ls-remote origin refs/heads/main
if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve current main' }
$head = & git -C $repo rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $head -ne ($remote -split '\s+')[0]) { throw 'Install from a clean merged main checkout after review' }
$dirty = & git -C $repo status --porcelain
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Clean dedicated coordinator checkout required' }
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $launcher + '" -ConfigFile "' + $configPath + '"'
$action = New-ScheduledTaskAction -Execute (Get-Command pwsh.exe -ErrorAction Stop).Source -Argument $arguments -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'FORGE_PROGRAMMED_COORDINATOR' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Get-ScheduledTask -TaskName 'FORGE_PROGRAMMED_COORDINATOR' | Select-Object TaskName,State
