param([switch]$CheckOnly,[string]$UpdateToken)
$ErrorActionPreference='Stop'
$appDir=$PSScriptRoot
. (Join-Path $appDir 'runtime\supervisor-task.ps1')
. (Join-Path $appDir 'runtime\update-common.ps1')
. (Join-Path $appDir 'runtime\install-preflight.ps1')
$config=Get-WidgetInstallPreflight -SourceDir $appDir -AppDir $appDir
if($CheckOnly){@{ok=$true;appDir=$appDir;codex=$config.codexPath;startupShortcut=$config.startupShortcut}|ConvertTo-Json;return}
$lock=Enter-WidgetUpdateLock -Token $UpdateToken
try {
  $journal=Read-WidgetUpdateJson (Join-Path (Get-WidgetUpdateAgentDir) 'update-transaction.json')
  if(!$UpdateToken -and $journal -and $journal.phase-notin @('committed','rolled-back')){throw 'Recover the unfinished update before installing.'}
  $config=Get-WidgetInstallPreflight -SourceDir $appDir -AppDir $appDir
  if(!$UpdateToken){
    try {
      $detector=Join-Path $appDir 'runtime/detect-balance-provider.mjs'
      $detected=& $config.nodePath $detector 2>$null
      if($LASTEXITCODE-ne 0){throw 'Provider detection failed'}
      $provider=$detected | ConvertFrom-Json -ErrorAction Stop
      switch($provider.status){
        'supported'   { Write-Host ('已识别 '+$provider.origin+'，挂件将自动查询余额。') }
        'unsupported' { Write-Host ('已识别 '+$provider.origin+'，此站点需要配置余额接口。继续安装。') }
        'credentials' { Write-Host ('已识别 '+$provider.origin+'，请在 Codex 配置中提供有效凭据。继续安装。') }
        'official'    { Write-Host '已识别 Codex 官方提供商，将显示订阅额度。' }
        default       { Write-Host '暂未识别余额配置，继续安装。' }
      }
    } catch { Write-Host '暂未识别余额配置，继续安装。' }
  }
  $null=New-Item -ItemType Directory -Path $config.dataDir -Force
  Stop-WidgetSupervisorTask -AppDir $appDir -Configuration $config
  Stop-WidgetGui -AppDir $appDir -DataDir $config.dataDir
  Install-WidgetUpdateAgent $appDir $config.dataDir
  Write-WidgetSupervisorJson (Join-Path $appDir 'installation.json') $config
  Write-WidgetSupervisorJson (Join-Path $appDir '.mcp.json') @{mcpServers=@{'gpt-niang-usage'=@{command=$config.nodePath;args=@((Join-Path $appDir 'runtime\mcp.mjs'))}}}
  & $config.codexPath plugin marketplace add $config.marketplaceRoot --json
  if($LASTEXITCODE-ne 0){throw 'Codex rejected the local marketplace.'}
  & $config.codexPath plugin add 'gpt-niang-usage@gpt-niang-local' --json
  if($LASTEXITCODE-ne 0){throw 'Codex rejected the GPT Niang plugin.'}
  Assert-WidgetPluginRegistration $config.codexPath $config.version
  $link=(New-Object -ComObject WScript.Shell).CreateShortcut($config.startupShortcut)
  # Startup is an independent fallback if the scheduled action cannot run.
  $link.TargetPath=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $link.Arguments=Get-WidgetAgentPowerShellArguments $config.updateAgent
  $link.WorkingDirectory=Join-Path $env:WINDIR 'System32'
  $link.WindowStyle=7
  $link.Description='GPT Niang: Codex subscription quota widget'
  $link.Save()
  $task=Register-WidgetSupervisorTask -AppDir $appDir
  Write-Output ('GPT Niang '+$config.version+' registered; supervisor started: '+$task.TaskName)
} finally {Exit-WidgetUpdateLock $lock}
