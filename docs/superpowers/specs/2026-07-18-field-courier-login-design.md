# Field Courier Login — Design

**Date:** 2026-07-18  
**Status:** Approved for implementation  
**App:** NesyMobileCocpit (`/automation/field-login`)

## Problem

Field support needs to log into a courier’s NESY Mobile session on a local ADB
device when the courier is stuck. Today this requires manual hub switch, PIN
lookup, device registration, and on-device login across several screens.

## Goals

1. One Create flow under Automation that collects shipment/courier identifiers.
2. Server-orchestrated steps: resolve courier → align admin hub → fetch PIN →
   read device code via ADB `GET_DEVICE_ID` → register device → Maestro
   `LAUNCH_APP` + `AUTH_LOGIN` → restore admin hub.
3. Persist successful/failed sessions (no PIN) and show them in a filterable,
   deletable table with shimmer loading.
4. Animated step progress inside the Create popup.

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Device code | ADB broadcast `GET_DEVICE_ID` (receiver required in APK) |
| On-device PIN | Maestro via system workflow YAML (`LAUNCH_APP` + `AUTH_LOGIN`) |
| Hub restore | Always restore admin hub after success or failure (if changed) |
| ADB device | Exactly one connected `device` required |
| Token refresh | Server-side `Auth/LoginDashboard` with env credentials |
| PIN storage | Never persist PIN |

## Architecture

```
UI Create → POST /api/field-courier-login/sessions
                → orchestrator (in-memory session + SSE)
                → Nesy portal APIs + ADB + Automation :3008
                → INSERT field_courier_logins
UI table  → GET / DELETE /api/field-courier-login
```

## Non-goals

- OCR / UI scrape of device code
- Changing the courier’s hub (only admin hub is temporarily aligned)
- Multi-device picker
- Extra Maestro steps after login
