# Role-Wise UI ↔ Backend Integration Tracker

**Updated:** 2026-11-18  
**Frontend:** `C:\karan\irul\ERP_QMIS`  
**Backend:** `C:\karan\irul\backend`  
**Live mode:** `VITE_USE_MOCK=false` + `VITE_API_BASE_URL=http://127.0.0.1:8000`

Status: **LIVE** | **PARTIAL** | **MOCK** | **BLOCKED** | **UAT VERIFIED**

Shared checkpoint (preserve): Auth LIVE · Announcements LIVE · HR Employees LIVE (portal edit limits).

---

## Role roadmap (backend-verified codes)

Proposed order vs actual `permissions/matrix.py` role codes:

| # | Proposed | Backend role code | Notes |
|---|---|---|---|
| 1 | Super Admin | `superadmin` | Full `_ADMIN` = all permission codes |
| 2 | Admin | `admin` | Same permission set as superadmin |
| 3 | HR | `hr` | Employees already LIVE |
| 4 | Finance / Account Head | `accounthead` (+ `finance_assistant`) | |
| 5–25 | … | See FRONTEND_ROLES + MD_EXTRA_ROLES | Adjust if API deps require |

Do not start the next role until the current role checkpoint is reported.

---

## Super Admin — Phase A audit

**Login:** `superadmin@qmis.edu` / `superadmin123` → JWT role `superadmin` → `/super-admin/dashboard`  
**Layout:** `Layout/SuperAdminLayout.jsx` → `Routes/SuperAdminRoutes.jsx`  
**Docs (frontend):** `Pages/SuperAdmin/SUPER_ADMIN.md` (demo-era; sidebar may differ from routes)

### Feature inventory

| Area | Routes / pages | Current data source | Backend available? |
|---|---|---|---|
| Dashboard | `/super-admin/dashboard` | `dashboardData.js` mock charts | `GET /api/v1/admin/dashboard` |
| Admin user creation | `/super-admin/user-creation/*` | `adminUsersData.js` sessionStorage | `GET/POST/PATCH /api/v1/admin/users`, reset-password |
| Student directory | `/super-admin/user-database/students*` | hardcoded `STUDENTS_LIST` | `GET /api/v1/students`, `GET /students/{id}` |
| Employee directory | `/super-admin/user-database/employees*` | hardcoded `EMPLOYEES_LIST` | Shared HR `GET /hr/portal/employees` |
| Announcements | `/super-admin/announcement*` | Common → already LIVE | Announcements APIs |
| Student attendance | `/super-admin/attendance/students/list` | Admin attendance mock data | `GET /api/v1/attendance?date=` |
| Employee attendance / leave | AttendanceAndLeaveWorkspace | mock/local | HR attendance + leave-requests |
| Gate pass | `/super-admin/gate-pass*` | `gatePassData.js` | `GET /api/v1/front-office/{collection}` |
| Star ratings | recognition pages | demoDomain / awards mock | **Likely BLOCKED** (no dedicated recognition API) |
| Tasks | TaskManagementRoutes | Common task mock | `GET/POST /api/v1/tasks` (SA assigns to `admin` only) |
| Approvals | `/super-admin/approvals*` | `approvalsData.js` | `GET /api/v1/approvals/inbox`, decide |
| Finance overview | `/super-admin/finance/*` | `financeOverviewData.js` | `GET /api/v1/finance/...` |
| Audit reports | `/super-admin/audit-reports/*` | mock | `campus_audit` + partial; UI not 1:1 |
| Activity logs | `/super-admin/activity-logs/*` | large mock JS | `GET /api/v1/audit-logs` (thin payload) |
| Communication | inbox wrappers | Common mock | `/api/v1/communication/*` |
| Calendar | AcademicCalendar wrapper | Common mock | `/api/v1/calendar` |
| Notifications | wrapper | Common mock | `/api/v1/notifications` |
| Escalations | wrappers | Common mock | `/api/v1/escalations` |
| Transport overview | `transportOverviewData.js` | mock | Partial `ops` / `protrack` |
| Enterprise ops routes | Stores, ticketing, etc. | demo / mock | Mixed ops collections; many **BLOCKED** for full UI |
| RBAC permission matrix edit | ViewAdminUser module toggles | sessionStorage | **BLOCKED** — only `GET /admin/roles/.../permissions` mounted |

---

## Super Admin — Phase B mapping (priority slice)

| Feature | Endpoint | Method | Integration status |
|---|---|---|---|
| Dashboard KPIs | `/api/v1/admin/dashboard` | GET | **LIVE** (this slice) |
| List admin accounts | `/api/v1/admin/users?role=admin` | GET | **LIVE** |
| Create admin | `/api/v1/admin/users` (`role=admin`) | POST | **LIVE** |
| View / status update | `/api/v1/admin/users/{id}` | GET / PATCH | **LIVE** (status; not module toggles) |
| Reset password | `/api/v1/admin/users/{id}/reset-password` | POST | **LIVE** (from view when wired) |
| Students list/detail | `/api/v1/students`, `/students/{id}` | GET | **LIVE** |
| Employees list/detail | `/api/v1/hr/portal/employees`, `/hr/employees/{code}` | GET | **LIVE** (shared `hrApiService`) |
| Announcements | existing | — | **LIVE** (shared) |
| Permission matrix write | — | — | **BLOCKED** |
| Hard delete user | — | — | **BLOCKED** (deactivate only) |
| Remaining SA modules | see audit | — | **MOCK** until later SA slices / role work |

---

## Super Admin — Phase C implementation plan

1. Shared API services (no duplicate clients): `adminUsersApiService`, `studentApiService`, `adminDashboardApiService`; reuse `hrApiService` + `announcementApiService`.
2. Wire SA User Creation list/create/view (live when `isLiveApiEnabled()`; no silent sessionStorage fallback).
3. Wire SA student + employee directories to shared APIs.
4. Wire dashboard KPI strip to `GET /admin/dashboard` (keep existing layout/charts as decorative until later).
5. Leave other SA pages MOCK/PARTIAL with tracker labels.
6. RBAC: verify superadmin write; teacher/unauthorized denied.
7. Browser UAT as `superadmin@qmis.edu`.
8. Regression: auth static + admin users tests + HR tests + frontend build.

**Checkpoint rule:** Admin role work starts only after this Super Admin slice is reported.

---

## Super Admin — status board

| Feature | Status | UAT |
|---|---|---|
| Auth / login | LIVE | **UAT VERIFIED** (`superadmin@qmis.edu`) |
| Announcements | LIVE | Pass (shared Common) |
| Dashboard KPIs | LIVE | **UAT VERIFIED** (live KPI strip) |
| Administrator accounts list/create/status/reset | LIVE | **UAT VERIFIED** (list shows ADM-0001 after create) |
| Module permission toggles | BLOCKED | N/A (honest UI notice) |
| Student directory | LIVE | **UAT VERIFIED** (ADM-DEMO-001) |
| Employee directory | LIVE | **UAT VERIFIED** (6 portal employees via shared HR API) |
| Escalations / Tasks / Leave / Approvals / Comm / Calendar / Notifications / Gate / Finance / Audit UI / Stars / Transport / Ops | MOCK | — |

**RBAC spot-check:** teacher `GET /api/v1/admin/users` → **403**. Super Admin can create `role=admin` (seed API create `ADM-0001`).

**Super Admin checkpoint:** Priority slice complete. Do **not** start Admin role until acknowledged.

### Files modified (this slice)

- `docs/ROLE_WISE_UI_BACKEND_INTEGRATION_TRACKER.md` (new)
- `ERP_QMIS/src/services/api/adminUsersApiService.js`
- `ERP_QMIS/src/services/api/studentApiService.js`
- `ERP_QMIS/src/services/api/adminDashboardApiService.js`
- `ERP_QMIS/src/services/modules/adminUsersApiService.js`
- `ERP_QMIS/src/services/modules/studentApiService.js`
- `ERP_QMIS/src/services/index.js`
- `ERP_QMIS/src/Common/RBAC/CreateUserPage.jsx` (async submit + live notice)
- `ERP_QMIS/src/Pages/SuperAdmin/UserCreation/*` (list/create/view)
- `ERP_QMIS/src/Pages/SuperAdmin/UserManagement/StudentDatabase/*`
- `ERP_QMIS/src/Pages/SuperAdmin/UserManagement/EmployeeDatabase/*`
- `ERP_QMIS/src/Pages/SuperAdmin/Dashboard/Dashboard.jsx`

---

## Change log

| Date | Change |
|---|---|
| 2026-11-18 | Created tracker; Super Admin audit + priority slice plan; begin Super Admin LIVE wiring |
| 2026-11-18 | Super Admin priority slice LIVE + UAT: dashboard KPIs, admin users, students, employees (shared HR) |
