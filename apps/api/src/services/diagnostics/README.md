# Host diagnostic captures

This directory implements FAZ 5.8 / plan B.5.4. The boundary is deliberate:

- `CapturePolicyEngine` consumes the existing `MEMORY_PRESSURE_DETECTED` event,
  polls the existing `get_health` fields (`pid`, `apiLevel`, `profileable`,
  `inCriticalSpan`), and brackets each started capture through the existing
  `mark_diagnostic` operation.
- `AdbDiagnostics` executes only Android OS observations (`dumpsys meminfo`,
  Perfetto, and `am dumpheap`). It is not a `ControlExecutor` and sends no new
  app command.
- D3 has no automatic escalation path. It needs an explicit dev/test opt-in,
  a successful `>= 3x expected dump size` free-space check, writes only under
  `/data/local/tmp`, is pulled immediately, and is removed from the device in
  `finally`.
- CRITICAL spans are a forbidden window. A skipped audit is written with
  `critical_span`, then the deduplicated request is re-evaluated after the span
  closes and a fresh `get_health` probe confirms it is safe.

## Symbolication

`automationRelease` is minified. A D2/D3 artefact from that build is not
symbolication-ready unless the exact build's R8 `mapping.txt` is copied beside
the capture and persisted as `mappingFileRef`. The engine stores that sidecar
when `mappingFilePath` is supplied; the run UI warns when it is absent.
Minified-device proof and symbolication quality remain part of FAZ 7.2b.

## Sensitive reporting

Heap dumps are always persisted with `sensitive=true`. The run detail UI shows
them in the diagnostic artefact hierarchy, but JSON report export calls
`reportableDiagnosticCaptures()` with its default (`includeSensitive=false`).
An explicit future authorization flow is required before any report includes a
sensitive artefact.
