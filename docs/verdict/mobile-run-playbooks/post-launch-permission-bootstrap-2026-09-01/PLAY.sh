#!/usr/bin/env bash
set -euo pipefail

DEVICE_ID="${1:-R6CW400BC8N}"
APPLICATION_ID="${2:-com.arasdigital.nesymobile.rstest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COCKPIT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
DEVICE_XML="/sdcard/nesy-permission-bootstrap-${DEVICE_ID}.xml"
LOCAL_XML="$(mktemp -t nesy-permission-bootstrap.XXXXXX.xml)"

cleanup() {
  "$ADB" -s "$DEVICE_ID" shell rm -f "$DEVICE_XML" >/dev/null 2>&1 || true
  rm -f "$LOCAL_XML"
}
trap cleanup EXIT

if [[ ! -x "$ADB" ]]; then
  printf 'ADB bulunamadı: %s\n' "$ADB" >&2
  exit 2
fi

if ! "$ADB" devices | awk 'NR > 1 && $1 == serial && $2 == "device" { found = 1 } END { exit !found }' serial="$DEVICE_ID"; then
  printf 'Cihaz bağlı değil veya yetkisiz: %s\n' "$DEVICE_ID" >&2
  exit 3
fi

cd "$COCKPIT_ROOT/apps/api"
DEVICE_ID="$DEVICE_ID" APPLICATION_ID="$APPLICATION_ID" node --import tsx --input-type=module -e '
  import { ensureNesyLoginStartupPermissions } from "./src/services/android-startup-permissions.ts";
  const result = await ensureNesyLoginStartupPermissions({
    deviceId: process.env.DEVICE_ID,
    applicationId: process.env.APPLICATION_ID,
  });
  console.log(JSON.stringify(result, null, 2));
'

sleep 4
"$ADB" -s "$DEVICE_ID" shell uiautomator dump "$DEVICE_XML" >/dev/null
"$ADB" -s "$DEVICE_ID" pull "$DEVICE_XML" "$LOCAL_XML" >/dev/null

python3 - "$LOCAL_XML" <<'PY'
from pathlib import Path
import sys

xml = Path(sys.argv[1]).read_text(encoding="utf-8")
permission_dialog = "Permission Confirmation" in xml or "permissioncontroller" in xml
pin_ready = ":id/pinView" in xml
login_ready = ":id/btn_login" in xml

print(f"permission_dialog_present={permission_dialog}")
print(f"pinView_present={pin_ready}")
print(f"btn_login_present={login_ready}")

if permission_dialog or not pin_ready or not login_ready:
    raise SystemExit("FAIL: izin penceresi kaldı veya login kontrolleri hazır değil")
print("PASS: izin pencereleri yok; PIN login ekranı hazır")
PY
