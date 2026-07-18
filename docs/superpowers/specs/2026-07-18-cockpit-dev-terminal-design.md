# Cockpit Dev Terminal — Banner + Stream Logs

**Date:** 2026-07-18  
**Status:** Draft for review  
**Scope:** Root `pnpm dev` / `pnpm prod` terminal UX (Turborepo TUI replacement)

## Problem

`turbo.json` uses `"ui": "tui"`. In Cursor/VS Code on Windows this shows a
split task browser (`Tasks (/ - Search)`, `@nesy/web#start`, …) that feels
unrelated to the product, is hard to scan, and often lags or glitches
(partial redraw artifacts in the pane).

Operators want a clear “cockpit” start signal and readable streaming logs —
not Turbo’s interactive task picker.

## Goals

1. Replace the Turbo TUI for long-lived runs with a **clean stream** (no laggy
   split UI).
2. On `pnpm dev` and `pnpm prod` only, print a short **NESY Cockpit banner**
   (mode + API/Web ports) before Turbo starts.
3. Rewrite Turbo package prefixes to short tags: `[api]` / `[web]`.
4. Keep Ctrl+C / process lifecycle behavior compatible with the existing
   `scripts/dev-runner.mjs` pattern (no Windows “Terminate batch job?” prompts).

## Non-goals

- Changing `build` / `lint` / `test` / `typecheck` UX beyond turning off TUI
- In-app web dashboard for process status
- Log filtering, search, or live status panels
- Replacing Turbo’s dependency graph (`dependsOn`, cache) for `dev` / `start`
- Custom UI for packages other than `@nesy/api` and `@nesy/web` (other packages
  keep a short generic prefix derived from the package name)

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| UX shape | B — Cockpit banner + clean stream |
| Commands with banner | A — only `pnpm dev` / `pnpm prod` |
| Log prefixes | A — short `[api]` / `[web]` |
| Orchestration | Keep Turbo; wrap it with a cockpit runner |
| Global Turbo UI | `"stream"` (disable TUI everywhere; kills lag) |

## Architecture

```
pnpm dev / pnpm prod
  → predev / preprod (kill-dev-ports)  [unchanged]
  → node scripts/cockpit-runner.mjs --mode dev|prod
       → print NESY Cockpit banner (mode, :4001, :4002)
       → spawn turbo run dev|start --ui=stream
       → transform stdout/stderr line prefixes
            @nesy/api:<task>: …  →  [api] …
            @nesy/web:<task>: …  →  [web] …
       → forward exit codes / signals cleanly
```

Package scripts in apps stay on `dev-runner.mjs` (port free + child spawn).
Only the **root** `dev` / `prod` entrypoints switch to the cockpit runner.

### Banner content

Minimal box (aligned with existing API `startup-banner` tone, not a second
dashboard):

- Title: `NESY Cockpit`
- Mode: `dev` or `prod`
- API: `http://localhost:4001`
- Web: `http://localhost:4002`
- Hint: Ctrl+C to stop

Ports are fixed to the project defaults documented in `README.md` unless later
env overrides are introduced (out of scope for v1).

### Prefix mapping

| Turbo stream token | Display |
| --- | --- |
| `@nesy/api` | `[api]` |
| `@nesy/web` | `[web]` |
| other `@nesy/<name>` | `[<name>]` |
| non-matching lines | unchanged |

Strip the Turbo task suffix (`:dev:`, `:start:`, etc.) so the operator sees
`[api] message` not `[api]:dev: message`.

### Turbo config

```json
"ui": "stream"
```

Root scripts:

```json
"dev": "node scripts/cockpit-runner.mjs --mode dev",
"prod": "node scripts/cockpit-runner.mjs --mode prod"
```

`predev` / `preprod` remain as today.

## Files to touch

| File | Change |
| --- | --- |
| `scripts/cockpit-runner.mjs` | **New** — banner, turbo spawn, prefix transform, signals |
| `package.json` | Point `dev` / `prod` at cockpit runner |
| `turbo.json` | `"ui": "tui"` → `"ui": "stream"` |
| `README.md` | Note that `pnpm dev` / `pnpm prod` use stream + cockpit banner |

## Error handling

- If Turbo fails to spawn: print clear error and exit non-zero.
- Child exit code is forwarded to the parent.
- SIGINT/SIGTERM: terminate Turbo process tree (Windows: `taskkill /T` pattern
  consistent with `dev-runner.mjs`).
- Partial lines (no trailing newline yet) are buffered until a full line is
  available before prefix rewrite.

## Testing

Manual verification on Windows:

1. `pnpm dev` — banner appears; no TUI task sidebar; logs use `[api]` / `[web]`.
2. `pnpm prod` — same, mode label `prod`.
3. Ctrl+C exits without “Terminate batch job (Y/N)?”.
4. `pnpm build` — still works; stream UI (no banner required).

## Success criteria

- Opening the terminal after `pnpm dev` reads as a cockpit start screen, not a
  Turbo task browser.
- No noticeable TUI redraw lag in Cursor’s terminal pane.
- API and Web lines are distinguishable at a glance via short prefixes.
