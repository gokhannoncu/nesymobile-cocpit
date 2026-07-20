const s = require('./sched-pac.json')
const seen = new Set()
for (const st of s.schedule?.stops || []) {
  for (const t of st.taskList || []) {
    if (seen.has(t.taskId) || t.taskType !== 1) continue
    seen.add(t.taskId)
    console.log(
      JSON.stringify({
        party: t.taskParty,
        status: t.taskStatus,
        wbs: (t.shipmentList || []).map((x) => x.waybillNumber),
        items: (t.shipmentList || []).flatMap((x) =>
          (x.shipmentItemList || []).map((i) => ({
            leg: i.legacySystemShortBarcode,
            st: i.shipmentItemStatus,
            bar: (i.barcode || '').slice(0, 30),
          })),
        ),
      }),
    )
  }
}
console.log('scheduleStatus', s.schedule?.status)
