# Local UI ↔ Backend Integration Map

**Date:** 2026-11-18  
**UI:** `c:\karan\irul\ERP_QMIS` (React 19 + Vite, [irulappan151204/ERP_QMIS](https://github.com/irulappan151204/ERP_QMIS))  
**Backend:** `c:\karan\irul\backend` (FastAPI from [Heuristic-Labs/QMIS](https://github.com/Heuristic-Labs/QMIS) lineage; not overwritten)  
**Mode:** Local development only (`VITE_USE_MOCK=false`, SQLite file DB)

Status legend:

- **WIRED** — UI calls the real endpoint in live mode
- **PARTIAL** — list/read wired or auth-gated; create/update still local or incomplete
- **AVAILABLE** — backend endpoint exists; UI still on mock/localStorage
- **BLOCKED / NOT AVAILABLE** — no matching backend endpoint found (do not invent)

| UI Feature | Existing Data Source | Backend Endpoint | Integration Status |
|---|---|---|---|
| Login | Demo directory (`enterpriseUserDirectory.js`), any password ≥4 | `POST /api/v1/auth/login` | **WIRED** (JWT) |
| Session / me | `sessionStorage` `schoolerp_auth` | `GET /api/v1/auth/me` | **WIRED** |
| Logout | Clear browser storage | `POST /api/v1/auth/logout` | **WIRED** (audit + discard token) |
| OTP challenge / verify | Not in UI | `POST /api/v1/auth/otp/challenge`, `POST /api/v1/auth/otp/verify` | **AVAILABLE** |
| Change password | Demo UI | `POST /api/v1/auth/change-password` | **AVAILABLE** |
| Health | N/A | `GET /health` | **WIRED** (via `checkBackendHealth`) |
| Role home routing | `ROLE_HOME_PATHS` / `App.jsx` | Role code from JWT `/me` | **WIRED** (role must exist in UI `ROLES`) |
| Announcements list | `announcementData.js` + localStorage | `GET /api/v1/announcements` | **PARTIAL** (live list; create still local) |
| Announcement categories | Local constants | `GET /api/v1/announcements/categories` | **AVAILABLE** |
| Announcement create | localStorage | `POST /api/v1/announcements` (multipart) | **AVAILABLE** (not wired in form) |
| HR employees | Demo / local HR pages | `GET /api/v1/hr/employees` | **AVAILABLE** (`hrApiService` helper added) |
| Admin users / RBAC UI | localStorage / static | `/api/v1/admin/...`, permissions in matrix | **AVAILABLE** |
| Masters (years/classes) | Hardcoded selects | `/api/v1/masters/...` | **AVAILABLE** |
| Students | Demo databases | `/api/v1/students` | **AVAILABLE** |
| Attendance | localStorage + biometric mock | `/api/v1/attendance` | **AVAILABLE** |
| Leave requests | localStorage | `/api/v1/leave-requests` | **AVAILABLE** |
| Exams / marks | localStorage / demo | `/api/v1/exams`, marks routes | **AVAILABLE** |
| Lesson plans | localStorage | `/api/v1/lesson-plans` | **AVAILABLE** |
| Finance / fees | `feeService` mock adapter | `/api/v1/finance` | **AVAILABLE** (service still mock by default) |
| Front office / PRM | Demo workspaces | `/api/v1/front-office` | **AVAILABLE** |
| TC requests | localStorage | `/api/v1/tc-requests` | **AVAILABLE** |
| Activities | localStorage | `/api/v1/activities` | **AVAILABLE** |
| Communication | localStorage / placeholder | `/api/v1/communication` | **AVAILABLE** |
| Documents / files | local / mock | `/api/v1/documents`, `/api/v1/files` | **AVAILABLE** |
| Calendar | localStorage | `/api/v1/calendar` | **AVAILABLE** |
| Approvals / notifications | local | `/api/v1/approvals`, `/api/v1/notifications` | **AVAILABLE** |
| Escalations / tasks | local | `/api/v1/escalations`, `/api/v1/tasks` | **AVAILABLE** |
| Academics collections | local | `/api/v1/academics` | **AVAILABLE** |
| Ops collections | local | `/api/v1/ops` | **AVAILABLE** |
| Campus audit | localStorage | `/api/v1/campus-audit` | **AVAILABLE** |
| ProTrack GPS | Demo / empty credentials | `/api/v1/protrack` | **AVAILABLE** (needs school credentials) |
| CCTV workspace | `cctvService` mock | *(no dedicated CCTV router found)* | **BLOCKED / NOT AVAILABLE** |
| File Room workspace | `fileRoomService` mock | *(no dedicated file-room router; generic `/files` exists)* | **PARTIAL** mapping only |
| Hostel | `hostelService` mock | *(no dedicated hostel router found)* | **BLOCKED / NOT AVAILABLE** |
| Lost & Found | `lostFoundService` mock | *(no dedicated L&F router found)* | **BLOCKED / NOT AVAILABLE** |
| PRO government cases | `proService` mock | *(no dedicated PRO router found)* | **BLOCKED / NOT AVAILABLE** |
| Store / purchase mock modules | mock adapter | Ops/store fragments under `/api/v1/ops` only | **PARTIAL** — confirm per action before wiring |
| Global search | Hardcoded 19 links | *(no search API found)* | **BLOCKED / NOT AVAILABLE** |
| Parent portal (full) | Demo | `/api/v1/parents` | **AVAILABLE** |
| Admissions | Demo | `/api/v1/admissions` | **AVAILABLE** |

## Seed accounts (development only)

Configured in `backend/.env` when `ENVIRONMENT=development`:

| Email | Password | Role |
|---|---|---|
| admin@qmis.edu | admin123 | admin |
| superadmin@qmis.edu | superadmin123 | superadmin |
| hr@qmis.edu | hr12345 | hr |
| accounthead@qmis.edu | accounts123 | accounthead |
| teacher@qmis.edu | teacher123 | teacher |
| coordinator@qmis.edu | coord123 | coordinator |
| principal@qmis.edu | principal123 | principal |
| prm@qmis.edu | prm12345 | prm |
| director@qmis.edu | director123 | director |

## Notes

1. Most ERP_QMIS pages remain on `*Data.js` / localStorage by design until each screen is mapped carefully.
2. Live mode is controlled only by `ERP_QMIS/.env.local` (`VITE_API_BASE_URL` + `VITE_USE_MOCK=false`).
3. Endpoints listed as **AVAILABLE** were discovered from `backend/app/main.py` router mounts — not invented.
4. Reference clone (read-only): `c:\karan\QMIS-heuristic-ref` from Heuristic-Labs/QMIS `main`.
