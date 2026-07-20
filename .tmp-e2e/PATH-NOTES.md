# E2E Path Notes — RS Stage courier G.ONCU (PIN 3680) — 2026-07-20

## Confirmed paths / UI branches during delivery (Approved tour)

1. After scanning a loaded barcode: bottom sheet `rootDeliveryOptions`
   - `btnDelivery` / **DELIVERY**
   - `btnDeliveryFailed` / **DELIVERY FAILED**
   - `btnDeps` / **DEPS**
2. Task detail also exposes **Delivery Failed** and **Try delivery today again**
3. Multicolli stop can show `1/3 Parcel` — incomplete multicolli blocks normal delivery until remaining pieces loaded

## Confirmed paths / UI branches during zimmet (Load to Vehicle)

1. **Manual barcode entry** (`manuel_input` → barcode dialog → OK)
2. **Select Time Range** dialog (seen after scan) — slots e.g. `07:00 - 09:00`, `08:00 - 10:00` → `Select`
   - Blocks return to Stop List until chosen
   - Path note: zimmet ≠ just scan; time frame is a real branch
3. **ArasDialog** positive button (HUB_WARNING / confirm) — optional after scan/pipeline
4. Stop card shows **CASH** badge / Direct4Me labels on some RS deliveries
5. Maestro driver can drop (`UNAVAILABLE`) mid-batch — need retry + UI recover
6. After successful zimmet: Loaded Parcels increments; stop appears under ASSIGNED with time window `tv_time_window`

## Scan identifier rule

- Use `legacySystemShortBarcode` (e.g. `6880051000263216`) or full `barcode` (`N…`)
- **Never** use `shipmentId` for zimmet

## Observed alternate paths still to explore (delivery/pickup)

- Pick Failed
- Try Delivery Today
- Delivery Failed / FDLY
- Partial delivery
- COD / cash collection
- Multicolli incomplete warning on Request Tour Start
- Auto Route vs Manual Route on tour start

## Pickup assign blocker (backend)

Cockpit `POST /api/pickups/:id/assign` calls `Task/GetPickupList` with hardcoded `hubId: "100"`.
RS CEBeograd works with **`hubId: "11"`** (today’s date). `hubId: "100"` returns empty → Cockpit `PickupListFailed`.
Workaround used: direct `Task/UpdatePickup` + `Task/AssignPickupToCourier` with hub `11`, zone `36`.

## Tour approval

- Mobile status enum: `0 BOD → 1 WaitingForApproval → 2 Approved`
- `Task/ApproveLeavingPermission` succeeded; backend `GetTodayScheduleByCourierZone("36")` → **status 2**
- Notification received: **"Leaving Permission Approved by your Dispatcher"**
- **Sync gap:** device still shows Waiting Approval / local `scheduleStatus=1`
- Mobile `GetMyScheduleByZoneCode` with courier JWT returned `payload: null` (likely `ScheduleDate == DateTime.Now.Date` filter vs stored UTC date) — pull-to-refresh cannot apply Approved
- Pickup assign notification also received: **"A New PickUp Task Has Been Assigned Stop No: 12"**; backend has 12 stops, device still 11

## Progress snapshot

- Login PIN 3680 / G.ONCU / route 36 / hub CEBeograd ✓
- Zimmet via `legacySystemShortBarcode` only ✓ (11 parcels / 11 stops on device)
- Time Range branch during zimmet ✓
- Tour request ✓ → WaitingForApproval
- Backend approve ✓ (Approved)
- Pickup assign to zone 36 ✓ (backend)
- Mobile Approved sync �Approval
- Backend approve ✓ (Approved)
- Pickup assign to zone 36 ✓ (backend)
- Mobile Approved sync ✓ after re-login (GetMySchedule returned full Approved schedule with 12 stops; UI **End Of Tour**)
- Local Room DB force-edit of scheduleMetaJson caused logout once — avoid; prefer re-login sync
- Delivery/pick execution: IN PROGRESS

## Delivery / pickup phase (2026-07-20 continued)

### Confirmed delivery happy path
1. Stop List → `manuel_input` → enter `legacySystemShortBarcode` → `btn_ok`
2. Optional **Attention** dialog: "Please pick up the document related to this shipment" → `btn_arasDg_positive_button` (seen on `isDocumentCollection=true`, also observed after some scans)
3. **Delivery options** sheet: `btnDelivery` / `btnDeliveryFailed` / `btnDeps` ("Which operation do you want for this shipment?")
4. Delivery form: `tie_delivery_name` → signature swipe → `btn_deliver`
5. Optional `btnDely` (DELY/DEPS confirm)
6. Optional ArasDialog positive
7. **COD Cash** branch: tap text `Cash` (fiscal path)
8. **Invoice Summary / PRINT** (`tvInvoiceSummary`, `android:id/button2` = PRINT) → dismiss with Back (PRINT triggers "Fiscal Created" notification)

### Stop detail alternate paths (observed, not fully exercised)
- `btn_not_deliver` — **Delivery Failed**
- `btn_come_again` — **Try delivery today again**
- `iv_document` icon on document-collection stop cards
- Pickup section shows **Picked Up Parcel Count** and shipper/consignee info; **Pick Failed** not confirmed as a separate button this run (may appear on pick-action sheet)

### Recoveries that worked
- Sticky in-app notifications (`rv_notifications` / Fiscal Created): `am force-stop` + start `SplashActivity` (Back/`btn_exit` insufficient)
- Maestro driver dead: `adb forward --remove-all`, sometimes `adb kill-server` / `adb start-server`
- Re-login via `login-3680.yaml` when session lost; SplashActivity component: `com.arasdigital.nesymobile.SplashActivity`

### Progress this phase
- Deliveries completed (taskStatus 2 / itemStatus 6): 6/11
- Pickups completed: 0/3 (+ stop12 may list 2 shipment rows)
- Multicolli stop1 (1/3 Parcel UI earlier): delivered the loaded piece TH8230 / 6880051000262813; sibling parcels PW7070/DG1653 were not separate pending tasks in schedule snapshot


## Delivery execution (2026-07-20 cont.)
- Zimmet: ONLY legacySystemShortBarcode / full barcode (never shipmentId)
- Delivery template fix: do NOT tapOn text "DELIVERY" after btnDelivery (matches toolbar title "Delivery")
- Need scrollUntilVisible btn_deliver + signature swipe before tap
- Result: 11/11 deliveries taskStatus=2 / itemStatus=6

## Pickup execution
- Path: scan legacy short barcode -> dialog Pick Up / Pickup Failed -> Pick Up
- Then on Task (Waiting For Pickup) scan again -> "Please scan all the barcodes" + complete_task
- Alternate visible: Pickup Failed, Try pickup today again
- Done: 6880051000263919, 6880051000264015 (2/3 pickup tasks)
- Blocked: _CASH multi-shipment task � waybill 74901237799972 is PickupAtCustomer with parcelCount=0 (no barcode). Arbitrary PAC scan -> "Barcode doesn't belong to that customer". 94643876527895 already PickedUp on backend.
