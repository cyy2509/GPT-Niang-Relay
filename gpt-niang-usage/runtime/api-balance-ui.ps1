function Format-ApiMoney($Amount,[switch]$Full,[string]$Currency) {
  if($null-eq $Amount){return '—'}
  $number=[double]$Amount
  if([double]::IsNaN($number) -or [double]::IsInfinity($number)){return '—'}
  $format=if($Full){'G15'}elseif($number-ne 0 -and [Math]::Abs($number)-lt 0.00000001){'G8'}elseif($number-ne 0 -and [Math]::Abs($number)-lt 0.0001){'0.########'}else{'0.####'}
  return ($number.ToString($format,[Globalization.CultureInfo]::InvariantCulture)+' '+$Currency).TrimEnd()
}

function Get-ApiBalanceView($Status,[long]$NowMilliseconds) {
  $available=$Status.ok-eq $true -and $null-ne $Status.balance -and $null-ne $Status.balance.amount
  $age=if($Status.observedAt){[Math]::Max(0,($NowMilliseconds-[double]$Status.observedAt)/1000)}else{0}
  $stale=$available -and ($Status.queryOk-ne $true -or $age-gt 180)
  $time=if($Status.observedAt){[DateTimeOffset]::FromUnixTimeMilliseconds([long]$Status.observedAt).ToLocalTime().ToString('HH:mm:ss')}else{''}
  $currency=if($Status.balance.currency -match '^[A-Z]{3}$'){$Status.balance.currency}else{''}
  $header=if(!$available){"API 余额 $currency"}elseif($stale){"上次余额 $currency"}else{"API 余额 $currency"}
  $message=if(!$available){if($Status.error){[string]$Status.error}else{'正在查询 API 余额…'}}elseif($Status.queryOk-ne $true){'刷新失败 · 上次 '+$time}elseif($age-gt 180){'旧数据 · 上次 '+$time}else{$time+' 更新 · 账户余额'}
  $details=@($header)
  if($available){$details+='账户余额：'+(Format-ApiMoney $Status.balance.amount -Full -Currency $currency)}
  if($available -and $null-ne $Status.balance.todaySpent){$details+='今日实际费用：'+(Format-ApiMoney $Status.balance.todaySpent -Full -Currency $currency)+"（站点统计）"}
  $details+=$message
  if($Status.error){$details+=[string]$Status.error}
  return @{Available=$available;Stale=$stale;Header=$header;Amount=$(if($available){Format-ApiMoney $Status.balance.amount -Currency $currency}else{'—'});Today=$(if($available){Format-ApiMoney $Status.balance.todaySpent -Currency $currency}else{'—'});HasToday=($available -and $null-ne $Status.balance.todaySpent);Message=$message;Tooltip=($details-join "`n")}
}

function Update-ApiBalanceUi {
  $view=Get-ApiBalanceView $script:status ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  $script:ui.Header.Text=$view.Header
  $script:ui.Header.ToolTip=$view.Tooltip
  $script:ui.ShortRow.Visibility=[Windows.Visibility]::Visible
  $script:ui.ShortLabel.Text='余额'
  $script:ui.ShortLeft.Text=$view.Amount
  $script:ui.ShortLeft.FontSize=if($view.Amount.Length-gt 10){18}else{22}
  $script:ui.ShortReset.Text=$view.Message
  $script:ui.ShortReset.ToolTip=$view.Tooltip
  $script:ui.ShortUsed.Text='账户余额 '+$view.Amount
  $script:ui.ShortBar.Parent.Visibility=[Windows.Visibility]::Collapsed
  $script:ui.WeekRow.Visibility=if($view.HasToday){[Windows.Visibility]::Visible}else{[Windows.Visibility]::Collapsed}
  $script:ui.WeekLabel.Text='今日'
  $script:ui.WeekLeft.Text=$view.Today
  $script:ui.WeekLeft.FontSize=if($view.Today.Length-gt 10){18}else{22}
  $script:ui.WeekReset.Text='实际费用 · 站点统计'
  $script:ui.WeekReset.ToolTip=$view.Tooltip
  $script:ui.WeekUsed.Text='今日实际费用 '+$view.Today
  $script:ui.WeekBar.Parent.Visibility=[Windows.Visibility]::Collapsed
  $script:ui.Status.Text=$view.Message
  $script:ui.Status.ToolTip=$view.Tooltip
  $color=if(!$view.Available -or $view.Stale){'#C5A96F'}elseif([double]$script:status.balance.amount-le 0){'#B74839'}else{'#745A98'}
  $script:ui.ShortLeft.Foreground=[Windows.Media.BrushConverter]::new().ConvertFromString($color)
  $script:ui.LiveDot.Fill=[Windows.Media.BrushConverter]::new().ConvertFromString($color)
  Update-BubbleTooltip
  if($script:widgetColors){Update-WidgetColorScene}
}
