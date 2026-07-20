const fs = require('fs')
const xml = fs.readFileSync('./.tmp-e2e/uidump-bounds.xml', 'utf8')
const nodes = [...xml.matchAll(/<node [^>]+>/g)].map((m) => m[0])
for (const n of nodes) {
  const id = (n.match(/resource-id="([^"]*)"/) || [])[1] || ''
  const text = (n.match(/text="([^"]*)"/) || [])[1] || ''
  const bounds = (n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || []).slice(1)
  if (!bounds.length) continue
  if (
    id.includes('btn_out') ||
    id.includes('btn_notification') ||
    text.includes('Waiting Approval') ||
    text.includes('Request Tour')
  ) {
    const [x1, y1, x2, y2] = bounds.map(Number)
    console.log(JSON.stringify({ id, text, x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2), bounds }))
  }
}
