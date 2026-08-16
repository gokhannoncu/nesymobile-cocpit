# Investigate uninjected complete-delivery remote commit

Ticket: **APP delivery succeeds locally while RS staging remains Loaded and delivery proof is absent.**

Lineage: PID **76781** / `06786f0` / pack **1.34.0**. Investigation only — **not** BD.6 proof. Do not inject `OFFLINE_QUEUE`.

Oracle unchanged:

```text
APP.DELIVERY_SUBMITTED != PRODUCT_PASS
local itemStatus=6     != PRODUCT_PASS
HTTP 2xx               != PRODUCT_PASS
```

## Three hypotheses (locked split)

| # | Claim | `run_80a055d2` |
|---|---|---|
| 1 | Mobil request never leaves the device; UI commits local delivery early | **True at measure time.** `deliverParcels` is persisted as a 120s waiting `Request`, not sent on confirm. |
| 2 | Request goes out, technical success, no business mutation | **False long-term.** `Task/DeliverParcels` later mutates the schedule; SearchShipment becomes Delivered. |
| 3 | Mutation happens, read model is stale or a different store | **True for the Verdict clock.** Proof Mongo and SearchShipment are empty/Loaded at t+14s; both catch up after the 120s flush. |

## Mobile chain (1–50 shipments)

```text
tap-delivery-confirm
  → DeliveryFragment.initiateDeliveryProcess
  → deliverShipment → handleDelivery → findShipmentAndDeliver
       Room itemStatus=6 / shipmentStatus=Delivered   (optimistic)
  → offlineDelivery → saveRequest(DELIVER_PARCELS)
       Request.isWaitingRequest = true
       createdAt = now (unix s)
       Verdict DELIVERY_PERSISTED
  → emitDeliverySuccess
       wire DELIVERY_UI_COMPLETED + delivery_submitted=true
       → APP.DELIVERY_SUBMITTED
```

`collectiveDelivery` (immediate HTTP) is only for **>50** shipments. Our singleton invoice path never uses it.

`RequestSenderService.handleWaitingRequests`:

```text
eligible when createdAt + 120s <= now
  OR sendWithoutWaiting
  OR Verdict.Flags.SKIP_DELIVERY_WAIT   (release no-op = false)
then POST Task/DeliverParcels/
processApiCall checks body resultCode
on HTTP success: DELIVERY_RESPONSE_RECEIVED / step=BACKEND_CONFIRMED
```

That last wire is **not** what complete-delivery waits on.

## Backend chain

```text
TaskService.DeliverParcels
  → DeliverParcelsV2(deliveryModel)
  → SetSuccessResponse(new { })     // always after V2 returns
```

`DeliverParcelsV2` matches barcodes on today's schedule, marks items Delivered, then:

```text
SendShipmentEventToTrackingAsync
  → broker EventCompleted
  → SaveShipmentEventLogs
  → CompleteStop
```

`GetShipmentDeliveryProof` reads Mongo `_eventLogRepository` where:

```text
RecordStatus = Active
EventType    = Delivered
WaybillNumber IN ShipmentIdList
```

That is **not** SearchShipment. `/shipments/events` is EventTower/GetEvents — also not proof.

## Reconstructed singleton — `run_80a055d2`

```text
runId            run_80a055d2-84e0-4622-bc43-bb1cad487640
barcode          6880051000293916
waybill          40515485408297
customer         10330 (invoice / CPP)

APP.DELIVERY_SUBMITTED
  CompletedRequest createdAt  1786856476  = 2026-08-16T05:01:16Z
  verify-backend-status       2026-08-16T05:01:30.564Z   (t+14s)

deliverParcels
  request started             processTime 1786856598947 = 2026-08-16T05:03:18.947Z
  endpoint                    POST Task/DeliverParcels/
  requestId / correlationId   CompletedRequest id=7; requestTrace=null after archive
  HTTP status                 archived as success (tryCount=0, no requestTrace)
  response body semantic      TaskService SetSuccessResponse({})
  request completed           ~05:03:18.947Z

REMOTE reads
  t+0  / t+14s verify         SearchShipment Loaded; proof []
  t+2s / t+5s / t+10s / t+30s still inside the 120s wait — would still be Loaded + []
  t+122s                      HTTP on the wire
  t+123s                      SearchShipment actualDeliveryDate 2026-08-16T05:03:19.866Z
  later (hours)               SearchShipment Delivered / OnConsignee
                              GetShipmentDeliveryProof n=1 eventType=Delivered
```

Cash twin `32566991114744` (`run_15fb55b7`) is the same shape: Room delivered immediately, remote Delivered ~2 minutes later (`actualDeliveryDate` 2026-08-16T04:37:26.78Z).

## What Verdict did right

At verify time the authoritative remote facts were `Loaded + proof=[]`. Local `APP.DELIVERY_SUBMITTED` and `itemStatus=6` are the 120s undo queue, not a backend commit. `FAIL_PRODUCT` is the correct oracle answer on that clock.

## Host landmine (not the oracle)

`read-delivery-status` normalize used to match only `ShipmentId` / `Barcode`. Live RS rows use `waybillNumber`. After the 120s flush, proof exists and would still normalize to `completed=false` without that host match. Fixed in the adapter; classifier / pack / `observeInjectedClass` untouched.

## BD.6 reopen bar (unchanged)

Uninjected complete-delivery must first show:

```text
APP.DELIVERY_SUBMITTED      ✅
local delivery              ✅
remote delivered state      ✅
delivery proof              ✅
ProductVerdict              PASS_ONLINE
observedClass               null
```

Only then the same fixture family:

```text
OFFLINE_QUEUE
→ WAN cut
→ confirm
→ durable nesy.pendingOperation
→ LOCAL.OFFLINE_QUEUE_ITEM_WAITING
→ PASS_QUEUED_OFFLINE
→ EFFECT_OBSERVED
→ OFFLINE_QUEUED
```

## Product 120s pin (locked)

```text
SharedViewModel.saveRequest(DELIVER_PARCELS)
  isWaitingRequest = true          (VPos cash-desk exception only)
RequestSenderService.shouldSkipRequest
  createdAt + 120 - now > 0        → keep waiting
waitingRequestsRunnable            every 1s (DEFAULT_WAITING_SYNC_INTERVAL)
sendStoredRequestsToServer         every 3s after release
SKIP_DELIVERY_WAIT                 release no-op = false
```

The `+ 120` is a literal in three product sites (`RequestSenderService` ×2, `TaskAdapter`). Not a Verdict timeout. Pack `REMOTE.DELIVERY_*` EVENTUAL is already `deadlineMs: 120_000` from **assert-confirmed**, which starts ~t+14 after submit. Do not rewrite that 120 to 130 because `run_80a055d2` committed at t+123.

`t+14s Loaded + [] → immediate PRODUCT_FAIL` was wrong for a different reason: empty proof published `completed: false` (MEASURED negative), so EVENTUAL never ran. Empty is now `REMOTE_PENDING` / no boolean. Host re-reads proof every 5s while that fact is UNKNOWN.

## deferred online request ≠ offline queued request

`nesy.pendingOperation.pending_count` = `RequestDao.countPendingRequests()`:

```sql
SELECT COUNT(id) FROM request
WHERE isWaitingRequest = 0 AND COALESCE(tryCount, 0) < 3
```

The 120s undo row (`isWaitingRequest=1`) is **excluded**. Immediately after confirm, online and WAN-cut both look like `pending_count=0`. The BD.6 LOCAL fact must not treat that deferred row as `OFFLINE_QUEUED`. Distinction appears only after the 120s release: online archives the row; offline keeps `isWaitingRequest=0` and the send fails.

## Next occurrence

Live attempt `run_94773959` (PID **84598**, pack 1.34.0): open-stop + process-parcel PASS, `tap-delivery-confirm` SATISFIED, Room `itemStatus=6`. `verify-backend-status` FAILED — `back-office base URL or token is not configured` because the restart dropped the in-memory LoginDashboard cache and `/Auth/LoginDashboard` + `/nesy/auth/login` now return captcha/400. EVENTUAL never started. Probe did not record t+0..130. Leftover is locally delivered; do not reuse.

`run_7b037ebe` (PID **91738**) stays **INCONCLUSIVE**: physical confirm and APP/local delivery held; remote verify failed the auth precondition. `observedClass=null`. Not BD.6 evidence. Leftover `72564226961796` is locally consumed; do not reuse.

LoginDashboard 200 from a script is not the same as the verify adapter cache being full. `/nesy/auth/login` now writes the same process cache `getDashboardAdminToken` / `resolveBackofficeAdminCredentials` read. Probe uses `/nesy/auth/cached-token` and FAIL_FAST `ADMIN_AUTH_NOT_READY` — it does not call LoginDashboard.

## Admin auth handoff (PID 20130)

`ADMIN_AUTH_READY`. LoginDashboard called once. Same-PID cache fingerprint `sha256:d6122ba8ba780d31`. Verify adapter readback matched. Probe used `/nesy/auth/cached-token` (calls stayed 1). GetMyInfo HTTP 200 / resultCode 200.

## Third singleton — `run_e68ca3ae`

```text
waybill          69369275241949
barcode          6880051000294111
load-to-vehicle  run_791f6c9d PASS_ONLINE
open-stop        run_50de85f0 PASS_ONLINE
process-parcel   run_e1cc9d2e PASS_ONLINE
confirm          SATISFIED
APP.DELIVERY_SUBMITTED   SATISFIED
LOCAL.OFFLINE_QUEUE      VIOLATED (optional; uninjected online — not BD.6)
verify                   SUCCEEDED at 06:00:36  proof=[]
assert-confirmed         EVENTUAL 120s  06:00:38 → 06:02:38
proof eventDate          2026-08-16T06:02:26.623Z  Delivered  waybill match
probe t+120 / t+130      proof n=1 eventType=Delivered
ProductVerdict           INCONCLUSIVE
evaluation               EVIDENCE_INSUFFICIENT
observedClass            null
injectedFault            null
```

Auth is closed. Product committed. First red box is **A**: Final Oracle EVENTUAL slept from the first PENDING pass to `deadlineAtMs`. `refreshFacts` / proof re-read ran once at 06:00:38 (`proof=[]`). Continue Gate already polls every 250ms; Final Oracle did not. `lastEvidenceRevision` stayed 22. Proof existed at 06:02:26 (12s before timeout). C is untested live because the adapter was not called while `n=1`. Do not bump the deadline. Do not reuse this waybill. Do not inject `OFFLINE_QUEUE`. Do not restart PID 20130 until the host fix is deployed as a new binary.
