$ErrorActionPreference = 'Continue'
$serial = 'R6CW400BC8N'
$app = 'com.arasdigital.nesymobile.rstest'
$inv = Get-Content .tmp-e2e/task-inventory.json -Raw | ConvertFrom-Json
$barcodes = $inv | Where-Object { $_.type -eq 'DELIVERY' } | ForEach-Object { $_.items[0].legacy } | Where-Object { $_ }
$results = @()

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

foreach ($bc in $barcodes) {
  Ensure-StopList | Out-Null
  $yaml = @"
appId: $app
---
- extendedWaitUntil:
    visible:
      id: "$app:id/manuel_input"
    timeout: 20000
- tapOn:
    id: "$app:id/manuel_input"
- extendedWaitUntil:
    visible:
      id: "$app:id/et_input_dialog_barcode_number"
    timeout: 8000
- tapOn:
    id: "$app:id/et_input_dialog_barcode_number"
- eraseText: 80
- inputText: "$bc"
- tapOn:
    id: "$app:id/btn_ok"
- extendedWaitUntil:
    visible:
      id: "$app:id/btnDelivery"
    timeout: 15000
    optional: true
- runFlow:
    when:
      visible:
        id: "$app:id/btnDelivery"
    commands:
      - tapOn:
          id: "$app:id/btnDelivery"
- extendedWaitUntil:
    visible:
      id: "$app:id/tie_delivery_name"
    timeout: 25000
- tapOn:
    id: "$app:id/tie_delivery_name"
- inputText: "Test Receiver"
- pressKey: Enter
- hideKeyboard
- scrollUntilVisible:
    element:
      id: "$app:id/btn_deliver"
    direction: DOWN
    timeout: 15000
- swipe:
    start: "25%, 78%"
    end: "75%, 78%"
    duration: 500
- tapOn:
    id: "$app:id/btn_deliver"
- runFlow:
    when:
      visible:
        id: "$app:id/btnDely"
    commands:
      - tapOn:
          id: "$app:id/btnDely"
- runFlow:
    when:
      visible:
        id: "$app:id/btn_arasDg_positive_button"
    commands:
      - tapOn:
          id: "$app:id/btn_arasDg_positive_button"
- runFlow:
    when:
      visible:
        id: "$app:id/btn_arasDg_positive_button"
    commands:
      - tapOn:
          id: "$app:id/btn_arasDg_positive_button"
- extendedWaitUntil:
    visible: "Stop List"
    timeout: 45000
    optional: true
"@
  $path = ".tmp-e2e/loop-$bc.yaml"
  Set-Content $path $yaml -Encoding UTF8
  Write-Output "=== DELIVER $bc ==="
  $out = maestro --device $serial test $path 2>&1 | Out-String
  $ok = $LASTEXITCODE -eq 0
  Write-Output ($out.Substring(0, [Math]::Min(600, $out.Length)))
  $results += [pscustomobject]@{ barcode=$bc; ok=$ok; exit=$LASTEXITCODE }
  if (-not $ok) {
    adb -s $serial shell input keyevent 4
    Start-Sleep 1
  }
  Start-Sleep 2
}

$results | ConvertTo-Json | Set-Content .tmp-e2e/delivery-results.json
$results | Format-Table -AutoSize
curl.exe -s -m 40 "http://127.0.0.1:4002/api/adb/schedule?serial=$serial" -o .tmp-e2e/sched-loop.json
node -e "const s=require('./.tmp-e2e/sched-loop.json'); const tasks=(s.schedule?.stops||[]).flatMap(st=>st.taskList||[]); const by=tasks.reduce((a,t)=>{a[t.taskStatus]=(a[t.taskStatus]||0)+1;return a},{}); console.log(JSON.stringify({loadedHint:'see UI', status:s.schedule?.status, stops:(s.schedule?.stops||[]).length, taskStatusCounts:by},null,2));"
