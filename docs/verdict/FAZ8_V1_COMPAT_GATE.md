# FAZ 8.1 v1 compatibility gate

Cockpit must keep both envelope versions enabled until active mobile producers
stop sending `v=1`. The production parser in
`apps/api/src/services/test-event-bridge.ts` currently accepts `v=1` and `v=2`.
`test-event-compat-gate.test.ts` pins three properties:

1. The current mobile `v=1` envelope still parses when all additive SDK keys are
   present (`spanId`, `parentSpanId`, `legacyAction`, `legacyStatus`,
   `payloadVersion`, `droppedSince`). Keys Cockpit does not consume are ignored.
2. A mixed v1/v2 rollout parses, but the sunset gate stays closed.
3. Only a non-empty, parse-clean, de-duplicated all-v2 active sample opens the
   gate. An empty sample is not evidence of a zero rate.

## Measurement hook

When production telemetry is available, export the observation window as JSONL:

```json
{"deviceId":"serial-1","line":"... NESY_TEST_EVENT|{\"v\":2,...}"}
{"deviceId":"serial-2","line":"... NESY_TEST_EVENT|{\"v\":1,...}"}
```

Each row represents one observed structured line. The hook ignores non-structured
lines and de-duplicates `(deviceId, runId, sessionId, seq)`, because logcat and
WebSocket may carry the same event. A device removed from service by an approved,
documented sunset may be marked `"active":false`; do not use that field merely
to make the rate pass.

Run the gate from the Cockpit root:

```sh
VERDICT_V1_GATE_CAPTURE=/absolute/path/active-events.jsonl \
  pnpm --filter @nesy/api exec vitest run src/services/test-event-compat-gate.test.ts
```

The default command expects `GO` and fails closed when any active v1 producer is
present. During rollout, apply a capture that is expected to prove the gate is
still closed without treating that expected decision as a broken test run:

```sh
VERDICT_V1_GATE_CAPTURE=/absolute/path/active-events.jsonl \
VERDICT_V1_GATE_EXPECT=NO_GO \
  pnpm --filter @nesy/api exec vitest run src/services/test-event-compat-gate.test.ts
```

`NO_GO` is measurement-only: it cannot authorize removal. The test prints the
measured decision and report; an expectation that disagrees with the capture
fails.

The checked-in `current-mobile-v1-capture.jsonl` is the structured half of the
2026-07-31 Dalga 3 RS Test DUT dual-line lab capture. It is useful for pinning
the expected closed decision, but it is not production telemetry and cannot
prove fleet coverage:

```sh
VERDICT_V1_GATE_CAPTURE="$PWD/apps/api/src/services/fixtures/test-event-compat/current-mobile-v1-capture.jsonl" \
VERDICT_V1_GATE_EXPECT=NO_GO \
  pnpm --filter @nesy/api exec vitest run src/services/test-event-compat-gate.test.ts
```

The emitted report contains both event and device rates:

```text
activeV1EventRate = unique active v1 events / unique active v1+v2 events
activeV1DeviceRate = active devices with any v1 / active devices with v1+v2 data
```

## Sunset criterion

Cockpit v1 parsing may be removed only when the selected observation window is:

- non-empty and covers active devices;
- free of rejected structured lines;
- `activeV1EventRate == 0`; and
- `activeV1DeviceRate == 0`.

The only alternative permitted by FAZ 8.1 is a conscious sunset: every remaining
v1 device is explicitly taken out of service, with that decision and device list
recorded before those rows are marked inactive. Without production telemetry,
the lab cases prove parser compatibility and gate behavior, but they do **not**
authorize deletion of Cockpit v1 support.

## Dual-path invariant for this wave

`logcat-sniffer.ts` must continue starting ADB with both
`NESY_AUTO_BRIDGE:D` and `NESY_TEST_EVENT:I`. This gate does not remove the
legacy parser, the legacy tag, or either `v=1`/`v=2` structured parser branch.

The envelope and legacy-tag decisions are separate gates:

- v1 parser removal requires the active-device telemetry criterion above;
- `NESY_AUTO_BRIDGE` removal additionally requires the mobile owner to flag off
  the producer after dual-line runtime evidence, or to document structured-only
  sufficiency and pass the nine-channel oracle suite without the tag;
- formatter/enum/legacy-line fixtures remain live compatibility assets while
  either receive path is retained. They are not dead code merely because the
  structured path passes in isolation.

The Cockpit structured-only oracle check is:

```sh
pnpm --filter @nesy/api exec vitest run \
  src/services/oracle-engine.parallel-validation.test.ts
```

It injects only structured events into the production sniffer fan-out for all
nine migrated oracle channels. The legacy half is parsed solely as the frozen
reference used to compare evidence and verdicts.

The 2026-07-31 source audit initially found that the old mobile
`AutomationBridge` producer had been deleted in commit `92a3abfcf` while the SDK
legacy sink was still disabled. Dalga 2 temporarily restored core
`LegacyAdapter` as the sole producer. In Dalga 3, the mobile owner captured
`STATE_LOGIN/CHECK_LOGIN` and `VALIDATE_STOPLIST` on both tags in the same
session, then removed the legacy emit plumbing. The post-sunset DUT smoke kept
seven structured lines, including the two compatibility-metadata events, while
the legacy-tag count was zero.

That mobile producer sunset does not by itself retire Cockpit compatibility.
This wave keeps `NESY_AUTO_BRIDGE` in the sniffer filter, `parseLogcatLine()` and
the legacy corpus consumer. They remain an intentional receive/rollback and
parity surface until the ordered Cockpit gate authorizes their removal. No tag
or parser is removed by this gate.
