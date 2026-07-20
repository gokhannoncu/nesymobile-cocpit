const fs = require('fs')
const { execSync } = require('child_process')

execSync(
  'adb -s R6CW400BC8N exec-out run-as com.arasdigital.nesymobile.rstest cat shared_prefs/com.arasdigital.nesymobile.rstest_preferences.xml',
  { stdio: ['ignore', fs.openSync('./.tmp-e2e/prefs-live.xml', 'w'), 'ignore'] },
)

let xml = fs.readFileSync('./.tmp-e2e/prefs-live.xml', 'utf8').replace(/^\uFEFF/, '')
const token = ((xml.match(/<string name="token">([\s\S]*?)<\/string>/) || [])[1] || '').replace(/\s+/g, '')
const scheduleStatus = (xml.match(/name="scheduleStatus" value="(\d+)"/) || [])[1]
console.log(JSON.stringify({ tokenLen: token.length, scheduleStatus, tokenStart: token.slice(0, 12) }))
fs.writeFileSync('./.tmp-e2e/mobile-token.txt', token)

const env = fs.readFileSync('apps/api/.env', 'utf8')
const base = (env.match(/^NESY_RS_STAGE_BASE_URL=(.+)$/m) || [])[1]
  ?.trim()
  .replace(/^["']|["']$/g, '')
  .replace(/\/$/, '')

;(async () => {
  const res = await fetch(`${base}/Task/GetMyScheduleByZoneCode/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Channel': 'Mobile',
    },
    body: '{}',
  })
  const j = await res.json()
  const p = j.payload || j.Payload
  console.log(
    JSON.stringify(
      {
        http: res.status,
        rc: j.resultCode || j.ResultCode,
        msg: j.resultMessage || j.ResultMessage,
        status: p && (p.scheduleStatus ?? p.ScheduleStatus),
        id: p && (p.scheduleId || p.ScheduleId),
        stops: p && (p.stopList || p.StopList || []).length,
      },
      null,
      2,
    ),
  )
  fs.writeFileSync('./.tmp-e2e/gms-mobile.json', JSON.stringify(j, null, 2))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
