#!/usr/bin/env python3
"""Reproduce the cockpit "Run Test" path for nesy.workflow.login and report where it stops.

Mirrors apps/web/src/lib/verdict-runtime/start-pinned-run.ts: readiness -> pack pin ->
compile -> start run, then polls run detail and prints the terminal state.
"""
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = "http://127.0.0.1:4001/api"
WF = "nesy.workflow.login"
DEVICE = "R6CW400BC8N"
APP_ID = "com.arasdigital.nesymobile.rstest"


def req(method, path, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw or "{}")
        except json.JSONDecodeError:
            return e.code, {"raw": raw[:2000]}


def canonical(digest):
    return bool(re.match(r"^sha256:[a-f0-9]{64}$", (digest or "").strip(), re.I))


def vkey(v):
    return [int(p) if p.isdigit() else -1 for p in (v or "").split(".")]


def step(name):
    print(f"\n{'=' * 70}\n{name}\n{'=' * 70}", flush=True)


step("1. READINESS")
code, readiness = req("GET", f"/verdict/runtime/devices/{DEVICE}/readiness?appId={APP_ID}")
print(f"HTTP {code} overall={readiness.get('overall')}")
for lane in readiness.get("lanes", []):
    if lane.get("status") != "UP":
        print(f"  BLOCKED/DOWN: {lane}")
print("  all lanes UP" if all(l.get("status") == "UP" for l in readiness.get("lanes", [])) else "")

step("2. PIN DOMAIN PACK")
code, packs = req("GET", "/verdict/runtime/domain-packs")
items = packs.get("items", [])
published = [p for p in items if p.get("publicationState") == "PUBLISHED" and canonical(p.get("bundleDigest", ""))]
compile_ready = [p for p in published if p.get("compileReady") is True]
base = compile_ready or published
preferred = [p for p in base if p.get("packKey") == "nesy.courier"] or base
pack = sorted(preferred, key=lambda p: vkey(p.get("version")), reverse=True)[0] if preferred else None
print(f"catalog={len(items)} published={len(published)} compileReady={len(compile_ready)}")
if not pack:
    print("FATAL: no pinnable published pack -> UI would throw 'No published Domain Pack to pin a run to'")
    for p in items:
        print(f"  {p.get('packKey')}@{p.get('version')} state={p.get('publicationState')} "
              f"compileReady={p.get('compileReady')} digest={p.get('bundleDigest','')[:20]}")
    sys.exit(1)
print(f"pinned: {pack['packKey']}@{pack['version']} digest={pack['bundleDigest'][:24]}")

step("3. LOAD WORKFLOW IR")
code, wf = req("GET", f"/workflows/{WF}")
version = wf.get("data", {}).get("currentVersion", {})
nodes = version.get("nodes", []) or []
connections = version.get("connections", []) or []
print(f"version={version.get('version')} nodes={len(nodes)} connections={len(connections)}")
for n in nodes:
    print(f"  {n.get('type'):<24} {n.get('data', {}).get('title')}")

step("4. COMPILE")
code, compiled = req("POST", "/verdict/runtime/compile", {
    "workflowRef": WF,
    "workflowIr": {"nodes": nodes, "connections": connections},
    "domainPackKey": pack["packKey"],
    "domainPackVersion": pack["version"],
    "domainPackDigest": pack["bundleDigest"],
})
print(f"HTTP {code} ok={compiled.get('ok')} planRef={compiled.get('compiledPlanRef')}")
for issue in (compiled.get("issues") or []):
    print(f"  [{issue.get('severity')}] {issue.get('code')}: {issue.get('message')}")
if not compiled.get("ok"):
    print("\nSTOPPED AT COMPILE — run would never start.")
    sys.exit(2)

step("5. START RUN")
subprocess.run(["/Users/gokhanoncu/Library/Android/sdk/platform-tools/adb", "-s", DEVICE, "logcat", "-c"], check=False)
code, started = req("POST", "/verdict/runtime/runs", {
    "workflowRef": WF,
    "deviceId": DEVICE,
    "compiledPlanRef": compiled["compiledPlanRef"],
    "compiledPlanHash": compiled.get("compiledPlanHash"),
    "domainPackKey": pack["packKey"],
    "domainPackVersion": pack["version"],
    "domainPackDigest": pack["bundleDigest"],
    # The editor pins this profile for nesy.workflow.login; without it nothing
    # cold-starts the app and wait-login-ready can only time out.
    "profileKey": "nesy.launch.cold-real-login",
    "inputs": {"pin": "3680", "sessionCorrelationId": f"diag-{int(time.time())}"},
})
print(f"HTTP {code}")
print(json.dumps(started, indent=2)[:2500])
run_id = (started.get("run") or {}).get("runId") or started.get("runId")
if not run_id:
    print("\nSTOPPED AT RUN START — no runId returned.")
    sys.exit(3)
print(f"runId={run_id}")

step("6. POLL RUN")
terminal = {"completed", "failed", "cancelled", "error", "COMPLETED", "FAILED", "PASSED", "ERROR"}
last = None
detail = {}
for i in range(90):
    code, detail = req("GET", f"/verdict/runtime/runs/{run_id}")
    run = detail.get("run") or detail
    status = run.get("status")
    steps = run.get("steps") or run.get("stepResults") or []
    line = f"[{i * 2:>3}s] status={status} steps={len(steps)}"
    if line != last:
        print(line, flush=True)
        last = line
    if status in terminal:
        break
    time.sleep(2)

step("7. RUN DETAIL")
print(json.dumps(detail, indent=2)[:6000])

step("8. LOGCAT (device side)")
out = subprocess.run(
    ["/Users/gokhanoncu/Library/Android/sdk/platform-tools/adb", "-s", DEVICE,
     "logcat", "-d", "-v", "brief"],
    capture_output=True, text=True, check=False).stdout
keep = [l for l in out.splitlines()
        if re.search(r"verdict|nesy|websocket|okhttp|auth|gap|cleartext|bridge", l, re.I)]
print("\n".join(keep[-120:]) or "(no matching logcat lines)")
