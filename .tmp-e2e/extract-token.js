const fs = require('fs')
const xml = fs.readFileSync('./.tmp-e2e/prefs-live.xml', 'utf8')
const token = (xml.match(/<string name="token">([^<]+)<\/string>/) || [])[1] || ''
const offline = (xml.match(/name="offlineMode"[^>]*value="([^"]+)"/) || [])[1]
const alt = (xml.match(/<string name="alternativeURL">([^<]*)<\/string>/) || [])[1]
console.log(JSON.stringify({ offlineMode: offline, altURL: alt, tokenLen: token.length }))
fs.writeFileSync('./.tmp-e2e/mobile-token.txt', token)
