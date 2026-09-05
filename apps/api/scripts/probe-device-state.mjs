#!/usr/bin/env node
/**
 * Read the courier app's own state off the device, and print the run inputs a
 * journey needs.
 *
 * ## Why this exists
 *
 * Every `open-stop` failure so far has been a GUESSED input. `run.input.rowKey`
 * was set to `688005` — a six-digit prefix somebody invented — and the run died
 * on `resolve:text=688005:NOT_FOUND` after correctly typing, searching and
 * submitting. Two runs were spent that way, and both were diagnosed by reading
 * the screen and arguing about what the row "probably" shows.
 *
 * None of that is necessary. The app is a source-available project and the
 * values live in its own Room database, so the row's text is a FACT to be read
 * rather than a shape to be inferred:
 *
 *   `StopsAdapter.kt:242-264` binds the row's `textViewLegacySystemId` to
 *   `taskList[].shipmentList[].shipmentItemList[].legacySystemShortBarcode`,
 *   grouped by `trackingNumber`. So the row prints the SHORT BARCODE, and the
 *   waybill is the tracking number — two different columns of one record.
 *
 *   `StopListFragment.kt:2428-2446` filters with
 *   `Gson().toJson(stop).contains(searchText, ignoreCase = true)` — a substring
 *   match over the WHOLE serialised stop. Any field's value is therefore a
 *   valid search term; what matters is only that the term and the row key
 *   DIFFER, because the typed text stays in the box and a single key would
 *   match twice and fail closed on ambiguity.
 *
 * ## What it does not do
 *
 * It does not write to the device, drive the UI, or start a run. It copies the
 * database out and reads it. Everything it prints is the app's own record of
 * what it currently holds.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * `adb` resolved by ABSOLUTE PATH, not from `PATH`.
 *
 * The interactive shell has platform-tools on `PATH` and non-interactive tool
 * invocations do not, so `adb` resolving in a terminal proves nothing about
 * whether a script will find it. That difference silently disabled the logcat
 * sniffer for twelve hours and produced runs with zero events and no error.
 */
const ADB = process.env.ADB ?? `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`
const DB_NAME = 'aras_kurye'

function adb(args, { binary = false } = {}) {
  return execFileSync(ADB, args, {
    maxBuffer: 256 * 1024 * 1024,
    ...(binary ? { encoding: 'buffer' } : { encoding: 'utf8' }),
  })
}

function firstDevice() {
  const lines = adb(['devices']).split('\n').slice(1)
  const serial = lines
    .map((line) => line.trim().split(/\s+/))
    .filter(([, state]) => state === 'device')
    .map(([id]) => id)[0]
  if (serial === undefined) throw new Error('no device is attached (adb devices lists none as "device")')
  return serial
}

/**
 * Copy the Room database out, WAL included.
 *
 * The `-wal` file is NOT optional: Room runs in WAL mode, so the most recent
 * writes — the ones a run just made — live there and not in the main file. A
 * probe that pulled only the main file would report a stale schedule and read
 * as a product bug.
 */
function pullDatabase(serial, appId) {
  const dir = mkdtempSync(join(tmpdir(), 'nesy-db-'))
  const remote = `/data/data/${appId}/databases`
  for (const suffix of ['', '-wal', '-shm']) {
    const name = `${DB_NAME}${suffix}`
    let bytes
    try {
      bytes = adb(['-s', serial, 'exec-out', `run-as ${appId} cat ${remote}/${name}`], { binary: true })
    } catch (error) {
      // Only the main file is required; a checkpointed database has no WAL.
      if (suffix === '') throw error
      continue
    }
    if (suffix === '' && bytes.length === 0) {
      throw new Error(
        `could not read ${remote}/${name} — is ${appId} installed, and is this build debuggable? ` +
          '`run-as` refuses a release build.',
      )
    }
    writeFileSync(join(dir, name), bytes)
  }
  return join(dir, DB_NAME)
}

function query(dbPath, sql) {
  // Separator chosen to survive JSON payloads, which contain every printable
  // ASCII character a comma-or-pipe delimiter would collide with.
  const out = execFileSync('sqlite3', ['-noheader', '-separator', '', dbPath, sql], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  return out
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.split(''))
}

function parseJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** Every parcel the stored stops mention, flattened with its stop and task. */
function readStops(dbPath) {
  return query(dbPath, 'SELECT stopIndex, stopId, stopJson FROM ScheduleStopChunk ORDER BY stopIndex')
    .map(([stopIndex, stopId, stopJson]) => {
      const stop = parseJson(stopJson)
      if (stop === undefined) return { stopIndex, stopId, unreadable: true, tasks: [] }
      const tasks = (stop.taskList ?? []).map((task) => ({
        taskId: task.taskId,
        taskType: task.taskType,
        address: task.taskAddress,
        shipments: (task.shipmentList ?? []).map((shipment) => ({
          waybill: shipment.trackingNumber,
          items: (shipment.shipmentItemList ?? []).map((item) => ({
            rowKey: item.legacySystemShortBarcode,
            scanBarcode: item.barcode,
            legacySystemBarcode: item.legacySystemBarcode,
            shortBarcodeTrim: item.legacySystemShortBarcodeTrim,
            itemCurrentLocation: item.itemCurrentLocation,
            shipmentItemStatus: item.shipmentItemStatus,
          })),
        })),
      }))
      return {
        stopIndex,
        stopId,
        timeWindow: stop.timeWindow,
        tasks,
      }
    })
}

function readSchedule(dbPath) {
  const [row] = query(dbPath, 'SELECT scheduleId, scheduleMetaJson FROM Schedule LIMIT 1')
  if (row === undefined) return undefined
  const [scheduleId, metaJson] = row
  return { scheduleId, meta: parseJson(metaJson) }
}

/**
 * `ScheduleStatusType`, named rather than numbered.
 *
 * The number alone reads as a magic constant in output somebody will paste into
 * a bug report, and two of these values matter to the tour-approval slice: 0
 * means a request can be made, 2 means one was already approved.
 */
const SCHEDULE_STATUS = {
  0: 'BeginningOfDay — a tour approval can be requested',
  1: 'Requested — waiting for the dispatcher',
  2: 'Approved — the dispatcher said yes',
  3: 'EndOfDay',
}

function main() {
  const appId = process.env.APP_ID ?? 'com.arasdigital.nesymobile.rstest'
  const serial = process.env.DEVICE_ID ?? firstDevice()

  process.stdout.write(`device   : ${serial}\napp      : ${appId}\n`)

  const dbPath = pullDatabase(serial, appId)
  const schedule = readSchedule(dbPath)
  const stops = readStops(dbPath)

  if (schedule === undefined) {
    process.stdout.write('\nNo schedule is stored. Select a route first; there is nothing to read yet.\n')
    return
  }

  const meta = schedule.meta ?? {}
  const status = Number(meta.scheduleStatus)
  process.stdout.write(
    `\nschedule : ${schedule.scheduleId}` +
      `\n  id            : ${meta.id}` +
      `\n  route         : ${meta.courierZoneCode}` +
      `\n  courier       : ${meta.courierName}` +
      `\n  status        : ${status} — ${SCHEDULE_STATUS[status] ?? 'unknown'}` +
      `\n  date          : ${meta.scheduleDate}` +
      `\n  firstApprove  : ${meta.firstApproveTime}` +
      `\n  stops stored  : ${stops.length}\n`,
  )

  for (const stop of stops) {
    process.stdout.write(`\nstop[${stop.stopIndex}] ${stop.stopId}${stop.unreadable ? '  (UNREADABLE JSON)' : ''}\n`)
    for (const task of stop.tasks) {
      process.stdout.write(`  task ${task.taskId}  type=${task.taskType}\n    address: ${task.address}\n`)
      for (const shipment of task.shipments) {
        process.stdout.write(`    waybill (trackingNumber): ${shipment.waybill}\n`)
        for (const item of shipment.items) {
          process.stdout.write(
            `      row text (legacySystemShortBarcode): ${item.rowKey}` +
              `\n      scan barcode                      : ${item.scanBarcode}` +
              `\n      legacySystemBarcode               : ${item.legacySystemBarcode}` +
              `\n      shortBarcodeTrim                  : ${item.shortBarcodeTrim}` +
              `\n      itemCurrentLocation / itemStatus  : ${item.itemCurrentLocation} / ${item.shipmentItemStatus}\n`,
          )
        }
      }
    }
  }

  /**
   * The run inputs, assembled from what was just read.
   *
   * `searchTerm` and `rowKey` come from DIFFERENT columns of the same record on
   * purpose. The search box keeps what was typed, so reusing one value for both
   * makes the row resolve twice and the step fails closed on ambiguity — which
   * is the pack's own documented reason for splitting them.
   */
  const first = stops
    .flatMap((stop) => stop.tasks.flatMap((task) => task.shipments.map((s) => ({ stop, shipment: s }))))
    .find(({ shipment }) => shipment.items.length > 0)

  if (first === undefined) {
    process.stdout.write('\nNo parcel is stored on any stop, so no open-stop inputs can be derived.\n')
    return
  }

  const item = first.shipment.items[0]

  /**
   * Every `run.input.*` the journey's macros actually read, enumerated from
   * `domain-packs/nesy-courier/src/macros/`. `scheduleId` is deliberately absent:
   * the schedule is minted BY the run when the route is confirmed, so its id is
   * unknowable at start and the macro derives it from what it observed.
   *
   * The three barcode-shaped inputs are the SAME value on purpose. The task
   * list's `matchesItem` (`TaskListFragment.kt:807-816`) accepts an exact match
   * against any of `barcode`, `legacySystemShortBarcode`,
   * `legacySystemShortBarcodeTrim`, `legacySystemBarcode` or
   * `internationalBarcode`, and the short barcode is the one the stop card
   * prints — so it is what a courier reads off the parcel and types.
   */
  const inputs = {
    pin: process.env.PIN ?? '<the courier PIN>',
    routeCode: String(meta.courierZoneCode ?? ''),
    // load-to-vehicle: typed into the manual-entry dialog.
    scanValue: item.rowKey,
    // open-stop: the term goes in the box and STAYS there, so the row must be
    // recognised by something the box does not hold.
    searchTerm: first.shipment.waybill,
    rowKey: item.rowKey,
    // process-parcel: typed on the task list.
    scanPayload: item.rowKey,
    // complete-delivery: one typed value and one back-office identity. The
    // dashboard knows the shipment by its tracking number, not by the barcode
    // printed on the parcel.
    consignmentNumber: item.rowKey,
    proofLookupId: first.shipment.waybill,
  }

  process.stdout.write(`\nrun inputs for nesy.workflow.full-courier-day:\n${JSON.stringify(inputs, null, 2)}\n`)

  if (inputs.searchTerm === inputs.rowKey) {
    process.stdout.write(
      '\nWARNING: the waybill and the row text are identical for this parcel. `open-stop`' +
        '\nrequires them to differ — the typed term stays in the search box and the row' +
        '\nwould match twice. Pick another stop, or a field the row does not display.\n',
    )
  }

  if (process.env.JSON === '1') {
    mkdirSync('probe-out', { recursive: true })
    writeFileSync('probe-out/device-state.json', `${JSON.stringify({ schedule, stops, inputs }, null, 2)}\n`)
    process.stdout.write('\nwrote probe-out/device-state.json\n')
  }
}

main()
