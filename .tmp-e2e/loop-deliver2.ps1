$ErrorActionPreference = 'Continue'
$serial = 'R6CW400BC8N'
$inv = Get-Content .tmp-e2e/task-inventory.json -Raw | ConvertFrom-Json
# refresh remaining deliveries from live schedule
curl.exe -s -m 40 "http://127.0.0.1:4002/api/adb/schedule?serial=$serial" -o .tmp-e2e/sched-live.json | Out-Null
$live = Get-Content .tmp-e2e/sched-live.json -Raw | ConvertFrom-Json
$pending = @()
foreach ($st in $live.schedule.stops) {
  foreach ($t in $st.taskList) {
    if ($t.taskType -ne 2) { continue }
    if ($t.taskStatus -eq 2) { continue }
    foreach ($sh in $t.shipmentList) {
      foreach ($it in $sh.shipmentItemList) {
        if ($it.legacySystemShortBarcode) {
          $pending += [string]$it.legacySystemShortBarcode
        }
      }
    }
  }
}
$pending = $pending | Select-Object -Unique
Write-Output "PENDING DELIVERIES: $($pending.Count)"
$pending | ForEach-Object { Write-Output $_ }

$results = @()
$template = Get-Content .tmp-e2e/deliver-template.yaml -Raw

function Ensure-StopList {
  for ($i=0; $i -lt 6; $i++) {
    adb -s $serial shell uiautomator dump /sdcard/uidump.xml | Out-Null
    adb -s $serial pull /sdcard/uidump.xml .tmp-e2e/nav.xml 2>$null | Out-Null
    $txt = Get-Content .tmp-e2e/nav.xml -Raw
    if ($txt -match 'manuel_input' -and $txt -match 'Stop List') { return $true }
    if ($txt -match 'text="Login"') {
      maestro --device $serial test .tmp-e2e/login-3680.yaml | Out-Null
      continue
    }
    adb -s $serial shell input keyevent 4
    Start-Sleep 1
  }
  return $false
}

foreach ($bc in $pending) {
  Ensure-StopList | Out-Null
  $yaml = $template.Replace('SCANCODE', $bc)
  $path = ".tmp-e2e/ld-$bc.yaml"
  Set-Content $path $yaml -Encoding UTF8
  Write-Output "=== DELIVER $bc ==="
  $out = maestro --device $serial test $path 2>&1 | Out-String
  $ok = $LASTEXITCODE -eq 0
  Write-Output ($out.Substring(0, [Math]::Min(700, $out.Length)))
  $results += [pscustomobject]@{ barcode=$bc; ok=$ok; exit=$LASTEXITCODE }
  if (-not $ok) { adb -s $serial shell input keyevent 4; Start-Sleep 1 }
  Start-Sleep 2
}

$results | ConvertTo-Json | Set-Content .tmp-e2e/delivery-results.json
$results | Format-Table -AutoSize
curl.exe -s -m 40 "http://127.0.0.1:4002/api/adb/schedule?serial=$serial" -o .tmp-e2e/sched-loop2.json
node -e "const s=require('./.tmp-e2e/sched-loop2.json'); const tasks=(s.schedule?.stops||[]).flatMap(st=>st.taskList||[]); const by=tasks.reduce((a,t)=>{a[t.taskStatus]=(a[t.taskStatus]||0)+1;return a},{}); console.log(JSON.stringify({status:s.schedule?.status,stops:(s.schedule?.stops||[]).length,taskStatusCounts:by},null,2));"
