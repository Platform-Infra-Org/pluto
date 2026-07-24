# Manual Test Plan — Platform new-ui

Hands-on verification of all implemented work, against the running local stack. We go **section by
section**: you run the steps, tell me what you see, I fix anything you flag, then we move on.

## Environment (already running)
- **SPA:** http://localhost:5173
- **BFF API:** http://localhost:8000 (health `/healthz`)
- **Keycloak:** http://localhost:8080 (admin console `admin`/`admin`)
- **MinIO console:** http://localhost:9001 (`minioadmin`/`minioadmin`)

### Test users (realm `platform`)
| User | Password | Role/Team |
|------|----------|-----------|
| `admin` | `admin` | `platform-admin` |
| `requester` | `requester` | team `payments` |
| `auditor` | `auditor` | `auditor` (read-only) |

> Token is in-memory: a hard page reload logs you out (re-login). Navigate with in-app links, not the URL bar.

### How we run each section
For every check: **Do** → **Expect** → you report **✅ / ❌ + notes**. I implement fixes for ❌ items
before we advance. Track status in the checkboxes.

---

## Section 1 — Authentication & Login (E02)
- [ ] **1.1** Open http://localhost:5173 logged out. **Expect:** header shows brand + **Login** only; no app nav links.
- [ ] **1.2** Click **Login** → redirected to Keycloak → sign in as `admin`/`admin` → returns to the app. **Expect:** header now shows `admin` + Logout.
- [ ] **1.3** Click **Logout**. **Expect:** back to logged-out state.
- [ ] **1.4** Log in as `requester`/`requester`, then (new) as `auditor`/`auditor`. **Expect:** each logs in cleanly and shows its username.
- [ ] **1.5** (API) In a terminal: `curl -s http://localhost:8000/api/me` with no token → **Expect:** 401.

## Section 2 — RBAC & Navigation (E02/E09)
- [ ] **2.1** Logged in as `admin`. **Expect:** nav shows Resources, My Requests, Approvals, Service Builder(if service-owner), **Admin**, notification bell.
- [ ] **2.2** Logged in as `requester`. **Expect:** Resources + My Requests; **no Admin** link.
- [ ] **2.3** Logged in as `auditor`. **Expect:** read surfaces only; **no Admin**, no approve/create actions.
- [ ] **2.4** (server-side enforcement) As `requester`, in devtools console or curl with the requester token, hit `GET /api/admin/overview`. **Expect:** **403** (UI hiding is not the boundary).

## Section 3 — Resource Catalog (E04)
- [ ] **3.1** As `requester`, open **Resources**. **Expect:** only `payments`-owned resources listed (RBAC filter).
- [ ] **3.2** As `admin`, open **Resources**. **Expect:** all seeded resources (more than requester sees).
- [ ] **3.3** Open a resource **detail**. **Expect:** parsed fields + raw JSON + owner team shown.
- [ ] **3.4** (RBAC boundary) As `requester`, try to open a resource owned by another team by guessing its id in the URL. **Expect:** 404 (no cross-team leak).

## Section 4 — Requests & Approvals (E05)
- [ ] **4.1** As `requester`, open a `payments` resource → **Request change** (update) → submit. **Expect:** request created, appears under **My Requests** as PENDING_APPROVAL.
- [ ] **4.2** As `admin` (or an owner-team approver), open **Approvals**. **Expect:** the request appears with a current-vs-proposed **diff** + Approve/Reject.
- [ ] **4.3** Approve it (SINGLE policy). **Expect:** state → APPROVED; audit trail shows who approved.
- [ ] **4.4** (separation of duties) As `requester`, confirm you **cannot** approve your own request.
- [ ] **4.5** (admin bypass) Submit another request; as `admin` use **bypass** with a reason. **Expect:** APPROVED + an `admin_bypass` audit event with the reason.
- [ ] **4.6** (staleness) Optional: if a resource changes underneath a pending request, approving warns/ re-confirms.

## Section 5 — Execution & Workflow Status (E06)
> Live Argo is **not** wired here (no Kubernetes), so approval does not launch a real workflow — this section verifies the *status surface* and that approval stops cleanly at APPROVED.
- [ ] **5.1** Open an APPROVED request's detail / status view. **Expect:** a status area is present; with no Argo it shows APPROVED/queued (not an error).
- [ ] **5.2** Confirm no crash/500 on the status endpoint for an approved request.

## Section 6 — In-App Notifications (E07)
- [ ] **6.1** As `requester`, submit a request. As `admin`, watch the **bell**. **Expect:** an `APPROVAL_NEEDED` notification appears (SSE live) with an unread badge.
- [ ] **6.2** As `admin`, approve it. As `requester`, watch the bell. **Expect:** an approved/outcome notification arrives live.
- [ ] **6.3** Open the notification dropdown/page, **mark all read**. **Expect:** unread badge clears; clicking a notification deep-links to the request.

## Section 7 — Service Builder & Onboarding (E08)
- [ ] **7.1** As a `service-owner` (tell me if you want me to grant `admin`/a user the `service-owner` group), open **Service Builder**. Build a simple form (a couple fields) + set approval policy. **Expect:** live preview renders exactly as the request form will.
- [ ] **7.2** Add a **groups picker** field (scoped) — **Expect:** options come from Keycloak groups, scoped (not the whole directory).
- [ ] **7.3** Add a **file upload** field and a **dynamic choice** (external API) field. **Expect:** upload accepts within size/type limits; dynamic choice pulls options (cached).
- [ ] **7.4** Submit the definition for onboarding. As `admin`, open the **onboarding queue** → approve. **Expect:** the type becomes ACTIVE and requestable; a non-admin cannot approve onboarding.

## Section 8 — Admin Dashboard (E09)
- [ ] **8.1** As `admin`, open **Admin**. **Expect:** overview tiles (requests by state, pending onboarding, workflow success rate, option-source staleness, invalid catalog files).
- [ ] **8.2** Cross-team **requests** panel shows all teams' requests (incl. bypass events).
- [ ] **8.3** **Services / onboarding**, **workflows**, **rbac/ownership**, **option-source health** panels render.
- [ ] **8.4** Edit the **ownership map** → confirm a new request routes to the changed owner team.

## Section 9 — Auditor Read-Only (E09)
- [ ] **9.1** As `auditor`, browse requests/approvals across all teams. **Expect:** full read access.
- [ ] **9.2** Confirm **no** Approve/Reject/Submit/Bypass controls are shown, and any write attempt (via curl with auditor token) → 403.

---

## Results log

### Backend/API-verified by me (against the live stack, real Keycloak tokens) — 2026-07-24
- **S1** ✅ no-token `/api/me`→401; admin→200 principal `{roles:[platform-admin]}`; requester `teams:[payments]`; auditor `roles:[auditor]`. (Visual login/header: also covered by Playwright E2E.)
- **S2** ✅ server-side RBAC: `/api/admin/overview` requester→403, auditor→403, admin→200.
- **S3** ✅ catalog RBAC: requester sees 2 (payments), admin sees 3; **S3.4** requester GET other-team resource (id=3, owner=search)→**404** (no cross-team leak).
- **S4** ✅ full lifecycle: submit→PENDING_APPROVAL routed to `payments`; in admin queue; requester self-approve→**403**; admin approve→APPROVED with audit trail (2 transitions); **bypass** empty reason→**400**, with reason→APPROVED + `admin_bypass` event audited.
- **S6** ✅ `/api/notifications` reachable (200); unread filter 200. (Live SSE bell delivery: needs your eyes — see below.)
- **S8** ✅ all 7 admin panels (`overview/requests/services/workflows/rbac/ownership/option-sources`) admin→200, requester→403.
- **S7** ✅ (setup) granted `requester` the `service-owner` group → principal `roles:[service-owner]`; `/api/services/definitions`→200; **groups picker vs real Keycloak**: `scope=mine`→200 returns the user's real groups, **unscoped→400** (whole-directory rejected — scoping control works live). Builder UI + file upload (MinIO) + dynamic-choice + onboarding-approve still need your eyes.
- **S9** ✅ auditor write (`POST /api/requests`)→**403** (read-only enforced server-side).

### Still needs your browser (visual/interactive only)
- **S1–S3 visual**, **S5** status view, **S6** live bell delivery, **S7** service builder UI + server-backed fields (need Keycloak/MinIO/external API interaction), **S8** panel rendering. Playwright E2E already confirmed: admin login+dashboard, requester catalog+detail render, auditor no-controls.
