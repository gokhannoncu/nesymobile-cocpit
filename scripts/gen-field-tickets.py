#!/usr/bin/env python3
"""tickets.json (NesyArchitectureReport) -> field-tickets-data.ts (NesyMobileCocpit)

48 saha ticket'ını kanonik root cause havuzuna bağlayarak TS veri dosyası üretir.
"""
import json, sys

SRC = "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyArchitectureReport/src/data/tickets.json"
OUT = "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/web/src/data/engineering/field-ticket-records.ts"

# ── Kanonik root cause eşlemesi (elle küratörlük) ────────────────
# ticket id -> (primary RC, [contributing RC], fixType override)
RC_MAP = {
    6352: ("RC-01", ["RC-02"]),
    6157: ("RC-01", ["RC-06"]),
    5339: ("RC-01", ["RC-09"]),
    4494: ("RC-01", ["RC-17"]),
    6218: ("RC-02", []),
    4252: ("RC-02", []),
    5683: ("RC-03", ["RC-13"]),
    6099: ("RC-03", []),
    4506: ("RC-04", []),
    4575: ("RC-05", ["RC-08"]),
    4484: ("RC-05", ["RC-13"]),
    5278: ("RC-06", []),
    4903: ("RC-06", ["RC-07"]),
    3420: ("RC-07", ["RC-15"]),
    5033: ("RC-07", []),
    4405: ("RC-08", []),
    4824: ("RC-08", ["RC-11"]),
    5944: ("RC-08", ["RC-13"]),
    5058: ("RC-08", ["RC-01"]),
    3886: ("RC-08", ["RC-04"]),
    5062: ("RC-09", []),
    4858: ("RC-09", []),
    5013: ("RC-09", ["RC-08"]),
    4344: ("RC-09", ["RC-10"]),
    5091: ("RC-10", ["RC-13"]),
    5312: ("RC-10", ["RC-13"]),
    2970: ("RC-10", []),
    4800: ("RC-11", ["RC-08"]),
    5539: ("RC-11", ["RC-08"]),
    4457: ("RC-11", []),
    5055: ("RC-12", ["RC-06"]),
    3249: ("RC-12", []),
    5257: ("RC-12", []),
    4426: ("RC-13", []),
    6087: ("RC-13", []),
    4545: ("RC-13", []),
    4771: ("RC-14", []),
    4776: ("RC-14", []),
    4772: ("RC-14", []),
    4446: ("RC-14", []),
    5874: ("RC-15", ["RC-06"]),
    4502: ("RC-16", []),
    4452: ("RC-17", []),
    4571: ("RC-17", ["RC-01"]),
    3349: ("RC-18", []),
    1878: ("RC-18", []),
    3393: ("RC-18", ["RC-06"]),
    4491: ("RC-18", ["RC-08"]),
}

CONF_DEFAULT = {  # RC bazlı varsayılan confidence (story.confidence yoksa)
    "RC-01": 85, "RC-02": 90, "RC-03": 80, "RC-04": 82, "RC-05": 88,
    "RC-06": 78, "RC-07": 84, "RC-08": 80, "RC-09": 62, "RC-10": 64,
    "RC-11": 58, "RC-12": 70, "RC-13": 76, "RC-14": 66, "RC-15": 80,
    "RC-16": 88, "RC-17": 74, "RC-18": 90,
}

def story_get(story, key):
    for item in story or []:
        if isinstance(item, dict) and item.get("k") == key:
            return item
    return None

def main():
    tickets = json.load(open(SRC))
    rows = []
    for t in tickets:
        a = t.get("analysis", {})
        rc, contributing = RC_MAP[t["id"]]
        story = a.get("story") or []
        sym = story_get(story, "symptom")
        cause = story_get(story, "cause")
        fixdone = story_get(story, "fix")
        state = story_get(story, "state")
        todo = story_get(story, "todo")

        symptom = (sym or {}).get("text") or t.get("summary") or t["title"]
        root_note = a.get("rootCause") or (cause or {}).get("text") or ""
        past = a.get("pastAttempts") or (fixdone or {}).get("text") or ""
        if past.strip() in ("—", "-"):
            past = ""
        why = a.get("verdict") or (state or {}).get("text") or ""
        fix = a.get("fix") or (todo or {}).get("text") or ""
        conf = (state or {}).get("confidence") or CONF_DEFAULT[rc]
        det = ((state or {}).get("detectability") or {}).get("level")

        risk = a.get("recurrenceRisk", "medium")
        closed = t["status"] == "closed"
        if not closed:
            fix_type = "none"
        elif risk == "low" and not past:
            fix_type = "permanent"
        elif risk == "low":
            fix_type = "permanent"
        else:
            fix_type = "workaround"

        rows.append({
            "id": f"GH-{t['id']}",
            "ghId": t["id"],
            "customerTicket": t.get("customer_ticket") or "",
            "title": t["title"].strip(),
            "type": t["type"].lower(),
            "severity": t["severity"].lower(),
            "status": t["status"],
            "country": t["country"],
            "date": t["date"],
            "group": t["group"],
            "screen": t["screen"],
            "symptom": symptom.strip(),
            "location": (a.get("location") or "").strip(),
            "rootCause": rc,
            "contributing": contributing,
            "rootNote": root_note.strip(),
            "confidence": conf,
            "repeatRisk": risk,
            "pastAttempt": past.strip(),
            "whyInsufficient": why.strip(),
            "fix": fix.strip(),
            "fixType": fix_type,
            "detectability": det,
            "edgeCases": a.get("edgeCases") or [],
            "ghUrl": t.get("gh_url") or "",
        })

    rows.sort(key=lambda r: (
        {"critical": 0, "high": 1, "medium": 2}[r["severity"]],
        r["status"] != "open",
        -r["ghId"],
    ))

    header = (
        "// AUTO-GENERATED — kaynak: NesyArchitectureReport/src/data/tickets.json\n"
        "// Üretici: scripts/gen-field-tickets.py — elle düzenlemeyin; RC eşlemesi script içinde küratörlüdür.\n\n"
        "import type { FieldTicket } from './field-tickets'\n\n"
        "export const FIELD_TICKET_RECORDS: FieldTicket[] = "
    )
    body = json.dumps(rows, ensure_ascii=False, indent=2)
    with open(OUT, "w") as f:
        f.write(header + body + "\n")
    print(f"{len(rows)} ticket yazıldı -> {OUT}")

if __name__ == "__main__":
    sys.exit(main())
