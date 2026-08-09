# M8 — M7’den taşınan blocker notu

Karar (2026-08-09): M7 kalanları **not edilerek** M8’e geçildi.
M8 COMPLETED iddiası **yok**; DUT fault matrix `BLOCKED_EXTERNAL`.

| ID | Tür | Kaynak | M8 etkisi |
|---|---|---|---|
| SIGNING_STORE | Lokal config | M7 | Release DEX negative hâlâ yok; M8 ana scope değil |
| CP3-DUT | Lab ortam | M7 → M8 hard gate | userdebug/eng yok → fault matrix koşulamaz |
| FLOW_E2E | Acceptance (koşulmadı) | M7 | Login/Tour baseline zayıf; M8 kill matrix için risk |
| KILL_RECOVERY | Acceptance (koşulmadı) | M7 → M8 scope | Process-kill kabulü M8’in kendisi; DUT şart |
| Cockpit P7 | Program fazı | M7’de açıktı | Artık Cockpit P7/P8 COMPLETED (external DUT ile) |

## DUT snapshot (carry anı)

| Field | Value |
|---|---|
| model | SM-A346E |
| `ro.build.type` | `user` |
| `ro.debuggable` | `0` |
| Policy | Production user build üzerinde jest/injection PASS yok |

## Offline Bridge kanıtı (DUT değil)

Aşağıdakiler JVM unit ile mevcut; M8 DUT yerine geçmez:

- foreign-window → `obscured_by_foreign_window`, gesture yok
- cancel / process-death → auto-retry worker yok
- wait_any AMBIGUOUS + candidates (M6)
- fencing / stale_tree
