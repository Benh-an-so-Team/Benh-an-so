# NCL-15-CN-006 — Tiếp nhận và xử lý yêu cầu về dữ liệu cá nhân

Backend contract & data design (CV-01 / CV-02). Workbook `project-workbook.xlsx` is the
authoritative business source (Sheet "Product Backlog" R140, "Tasks" R641–R645,
"Acceptance Criteria" R518–R520, "Business Rules" QTN-19/QTN-24).

## A. Requirements explicitly supported by the workbook

- Actors: **Administrator** (records, tracks, completes), **Patient** (subject whose personal
  data is concerned).
- A request must record at least: request type, received date, processing deadline, result,
  status, processor.
- **TC-01** — record a request (example: a copy of the medical record) with type, received
  date and processing deadline.
- **TC-02** — the system periodically reviews requests; the administrator is alerted about
  upcoming/overdue requests.
- **TC-03** — a processed request is updated with a result, becomes completed, and records
  the processor.
- Dependencies: NCL-15-CN-005 (consent withdrawal / data-erasure), NCL-11-CN-004 (medical
  record copy). QTN-19: medical records retained ≥10 years and must not be deleted before
  retention expires.

## B. Existing-project behaviour reused

- `RequestPatientDataErasureService` (NCL-15-CN-005) already owns the *deletion/erasure*
  workflow: it withdraws consent, writes `patient_consent_history`, `patient_change_logs`
  and a QTN-19 audit trail, and never hard-deletes medical records. **NCL-15-CN-006 does not
  re-implement or duplicate this workflow.** A data-erasure request continues to be handled
  solely by the existing NCL-15-CN-005 flow.
- `IssueMedicalRecordCopyService` (NCL-11-CN-004) already issues a medical-record copy and
  writes its own audit trail. NCL-15-CN-006 does not re-implement copy production.
- `MedicalRecordRetentionPolicy` / `ClinicConfiguration.retentionYears` (QTN-19) remain the
  single source of truth for retention; this feature never deletes medical records.
- `AuditLog` / `AuditLogRepository`, `ClockPort`, `CurrentUserPort`, `PatientRepository`,
  `RequirePermission` aspect, and the Flyway permission-seeding convention are all reused.

## C. Implementation decisions (the workbook is silent on these)

- **Request types are an open string**, not an enumerated taxonomy. The only documented
  value is `MEDICAL_RECORD_COPY` (constant `PersonalDataRequest.TYPE_MEDICAL_RECORD_COPY`).
  The workbook names only the medical-record-copy request; it does not define an exhaustive
  list, so no other types (including a `DATA_ERASURE` type) are introduced.
- **Patient Portal read is not implemented.** The workbook lists "Bệnh nhân" as an actor but
  none of the acceptance criteria describe a patient viewing their requests; this surface is
  omitted to keep the backend minimal.
- **`dueAt` is caller-supplied.** The workbook does not define a legal processing period, so
  no default/hardcoded deadline is computed. However the backend enforces the business
  invariant `dueAt >= receivedAt` (receivedAt is generated server-side) at the domain level;
  a request whose deadline precedes its received time is rejected.
- **Status lifecycle** is minimal: `RECEIVED` → `COMPLETED`. "Upcoming" and "overdue" are
  derived from `dueAt` relative to `now`, never stored as separate statuses.
- **TC-02 alert delivery**: the workbook defines periodic review + administrator alerting but
  not the upcoming-deadline window nor a push/email channel. The backend therefore persists
  administrator alerts into `personal_data_request_deadline_alerts` — one row per
  (request, alert type) with `UPCOMING`/`OVERDUE` — so the administrator can retrieve them
  through `GET /personal-data-request-deadline-alerts`. The scheduler
  `PersonalDataRequestDeadlineScheduler` is enabled by default
  (`personal-data-request.deadline-check.enabled=true`) and the upcoming window is configurable
  via `personal-data-request.deadline-check.upcoming-window-hours` (default `24`). No
  email/SMS/push channel is invented; the persisted alert is the delivery surface.

## Data model

Table `personal_data_requests` (Flyway `V108`):

| Column | Type | Notes |
|---|---|---|
| id | BINARY(16) PK | |
| patient_id | BINARY(16) NOT NULL | FK → `patients(id)` |
| request_type | VARCHAR(50) NOT NULL | open string; `MEDICAL_RECORD_COPY` documented |
| status | VARCHAR(30) NOT NULL | `RECEIVED` / `COMPLETED` (CHECK) |
| reason | VARCHAR(2000) NULL | auditability |
| received_at | TIMESTAMP NOT NULL | = time of recording |
| due_at | TIMESTAMP NOT NULL | processing deadline (caller-supplied) |
| result | VARCHAR(2000) NULL | set on completion |
| completed_at | TIMESTAMP NULL | |
| processed_by | BINARY(16) NULL | FK → `users(id)` (the administrator) |
| created_at / updated_at | TIMESTAMP | |

Indexes: `patient_id`, `(status, due_at)` (overdue/upcoming scan), `due_at`, `processed_by`.

No patient name/phone/address or medical-record content is duplicated in this table.

Table `personal_data_request_deadline_alerts` (Flyway `V109`) stores the persistent
administrator alerts produced by the deadline review:

| Column | Type | Notes |
|---|---|---|
| id | BINARY(16) PK | |
| personal_data_request_id | BINARY(16) NOT NULL | FK → `personal_data_requests(id)` |
| alert_type | VARCHAR(20) NOT NULL | `UPCOMING` / `OVERDUE` |
| created_at | TIMESTAMP NOT NULL | |

Unique `(personal_data_request_id, alert_type)` so a re-run of the scheduler never duplicates
the same alert.

## Authorization

- Permissions seeded (ADMIN only): `PERSONAL_DATA_REQUEST_READ`, `PERSONAL_DATA_REQUEST_UPDATE`.
- Enforced both at the controller (`@RequirePermission`) and the service layer
  (`PersonalDataRequestAuthorizer`).

## API contract

Base path `/api/v1` (context path). All endpoints require an ADMIN session.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/personal-data-requests` | UPDATE | Record a request (TC-01) |
| GET | `/personal-data-requests/{id}` | READ | Get one request |
| PATCH | `/personal-data-requests/{id}/complete` | UPDATE | Complete with result + processor (TC-03) |
| GET | `/personal-data-requests` | READ | Search; params `patientId`, `status`, `overdue`, `dueFrom`, `dueTo`, paging |
| GET | `/personal-data-request-deadline-alerts` | READ | Administrator deadline alerts (TC-02), paging |

The `dueFrom`/`dueTo` range filter is **inclusive on both bounds** (`dueFrom ≤ dueAt ≤ dueTo`),
so `dueFrom == dueTo` matches the single instant rather than returning an empty interval.

### Record request body

```json
{ "patientId": "<uuid>", "requestType": "MEDICAL_RECORD_COPY", "reason": "…", "dueAt": "2026-10-01T08:00:00Z" }
```

### Complete request body

```json
{ "result": "Đã cấp bản sao hồ sơ bệnh án" }
```

## QTN-19 / deletion behaviour

This feature is append-only: recording a request never deletes or modifies medical records.
Deletion of personal data remains governed by the existing NCL-15-CN-005 erasure workflow and
`MedicalRecordRetentionPolicy`, which refuse hard deletion while records are within retention.
