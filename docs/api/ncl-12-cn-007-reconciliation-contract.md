# NCL-12-CN-007 — Reconciliation contract (interconnection vs dispensing)

> **Module:** NCL-12 — Đơn thuốc điện tử và liên thông quốc gia
> **User Story:** NCL-12-CN-007 — *Đối chiếu đơn đã liên thông với đơn đã cấp phát*
> **Scope of this document:** CV-01 (business analysis) and CV-02 (backend implementation) only.
> **Related:** QTN-21, NCL-12-CN-004 (interconnection), NCL-06-CN-003 / NCL-06-CN-008 (dispensing)
> **Base path:** `/api/v1`

This document is the backend contract for the frontend developer. The frontend (CV-03) can be built
against this contract without any further backend change for basic reconciliation functionality.

**Not delivered here:** CV-03 (frontend UI) is **not** implemented. CV-04 (independent QA as a
separate team deliverable) is **not** claimed as complete by this document.

---

## 1. Business purpose

An administrator needs to reconcile prescriptions that were **sent through the interconnection
flow** against the prescriptions that were **actually dispensed**, in order to detect discrepancies
between the two systems early.

The story explicitly requires the system to list prescriptions by interconnection status and
dispensing status and to **flag the discrepant cases**:

- *đã liên thông nhưng chưa cấp phát* — transmitted but not dispensed
- *đã cấp phát nhưng chưa liên thông* — dispensed but not successfully transmitted

The story also states that a discrepant record must be actionable by **either retransmitting the
interconnection or recording a reason/note**.

---

## 2. Excel requirement mapping

Source of truth: `project-workbook.xlsx` (sheets *Product Backlog*, *Tasks*, *Business Rules*,
*Acceptance Criteria*).

| Workbook item | Requirement | Where it is satisfied | Status |
|---|---|---|---|
| Story | List prescriptions by interconnection status + dispensing status and flag the two discrepancy cases | `GET /prescription-reconciliation` with `outcome` / `discrepanciesOnly` | Implemented |
| Roles | ADMIN (*Quản trị viên*), PHARMACIST (*Dược sĩ*) | `PRESCRIPTION_RECONCILIATION_VIEW`, `PRESCRIPTION_RECONCILIATION_NOTE` granted to `ADMIN`, `PHARMACIST` (V102) | Implemented |
| Precondition | Prescriptions transmitted and/or dispensed in the period | Period predicate covers issuance, transmission **and** dispensing | Implemented |
| QTN-21 | Electronic prescription has a unique identifier used for printing, lookup and interconnection | `prescriptionCode` is exposed per row; no new identifier is introduced | Reused |
| CV-02 expected | Discrepant list displays correctly and can be handled by retransmission **or** note | Retransmission = existing NCL-12-CN-004 retry endpoint; note = `POST /prescription-reconciliation/{id}/notes` | Implemented |
| TC-01 | Correct interconnection and dispensing status per prescription | `interconnectionStatus`, `prescriptionStatus`, plus derived `outcome` | Implemented |
| TC-02 | Dispensed but not successfully transmitted is flagged and can be retransmitted | `DISPENSED_NOT_TRANSMITTED` + `retransmissionEligible` | Implemented |
| TC-03 | Receptionist denied **and the denial is logged** | `@RequirePermission` + existing `RequirePermissionAspect` writes `ACCESS_DENIED` / `PERMISSION` | Reused |

---

## 3. Reconciliation matrix

Reconciliation is **derived** from the two states the system already maintains. No reconciliation
status is persisted and no new prescription status value is invented.

Sources:
- interconnection state — `prescriptions.interconnection_status` + `last_interconnection_at` +
  `last_interconnection_error` + `interconnection_receipt_code` (V21, NCL-12-CN-004)
- dispensing state — `prescriptions.status` (V11 / V68, NCL-06-CN-003 / NCL-06-CN-008)

| Interconnection | Dispensing | `outcome` | `discrepancy` | `retransmissionEligible` |
|---|---|---|---|---|
| `SUCCESS` | `DISPENSED` | `CONSISTENT` | false | false |
| `SUCCESS` | `PARTIALLY_DISPENSED` | `CONSISTENT` | false | false |
| `SUCCESS` | `PENDING_DISPENSE` | `TRANSMITTED_NOT_DISPENSED` | **true** | false |
| `FAILED` | `DISPENSED` | `DISPENSED_NOT_TRANSMITTED` | **true** | **true** |
| `FAILED` | `PARTIALLY_DISPENSED` | `DISPENSED_NOT_TRANSMITTED` | **true** | **true** |
| `NOT_SENT` | `DISPENSED` | `DISPENSED_NOT_TRANSMITTED` | **true** | false |
| `NOT_SENT` | `PARTIALLY_DISPENSED` | `DISPENSED_NOT_TRANSMITTED` | **true** | false |
| `FAILED` | `PENDING_DISPENSE` | `NOT_TRANSMITTED_NOT_DISPENSED` | false | false |
| `NOT_SENT` | `PENDING_DISPENSE` | `NOT_TRANSMITTED_NOT_DISPENSED` | false | false |
| any | `CANCELLED` | `CANCELLED` | false | false |

Rules that the matrix encodes:

1. There are **exactly two** discrepancy categories: `TRANSMITTED_NOT_DISPENSED` and
   `DISPENSED_NOT_TRANSMITTED`. No third category exists.
2. `retransmissionEligible` is derived **strictly** from `interconnectionStatus == FAILED`. It is a
   direct projection of the existing NCL-12-CN-004 retry precondition, so the reconciliation feature
   can never offer a retransmission the original feature would reject.
3. `NOT_SENT` + dispensed is therefore a **discrepancy that is not retry-eligible**. Its actionable
   backend path is a reconciliation note (see §9).
4. **Partial dispensing is not a discrepancy.** `SUCCESS` + `PARTIALLY_DISPENSED` is `CONSISTENT`.
   Partial dispensing is a valid operational state of NCL-06-CN-008, and it is not one of the two
   categories the workbook defines.
5. **CANCELLED is visible but out of scope.** NCL-12-CN-007 defines only the two discrepancy
   categories above, so reconciliation of cancellation against interconnection state is outside the
   current story scope. Such rows are returned for visibility with `discrepancy = false` and are not
   classified into either category. No business rule is claimed for cancellation.
6. **No quantity reconciliation.** The story reconciles interconnection state against dispensing
   state only. No prescribed, dispensed or remaining quantity is read or exposed.

The classification lives in one place — `PrescriptionReconciliationOutcome` holds the
(dispensing statuses, interconnection statuses) sets of each outcome, and both the pure classifier
`PrescriptionReconciliationClassifier` and the query filter derive from those sets.

---

## 4. Period semantics

The workbook only states *"trong kỳ"* and names no controlling timestamp. Filtering on
`last_interconnection_at` alone would be wrong, because a prescription that was dispensed but never
successfully transmitted has no transmission time at all — that is precisely Excel TC-02.

**Rule (half-open interval `[from, to)`):** a prescription belongs to the requested period when
**any** of the following is true:

- `prescribedAt ∈ [from, to)`
- `lastInterconnectionAt ∈ [from, to)`
- there exists a dispense item with `dispensedAt ∈ [from, to)`

Each of the three alternatives is a **complete** range check (both bounds applied together), so a
prescription dated after `to` can never enter through the `>= from` side.

Bound handling follows the existing convention used by `GET /prescription-interconnections`: `from`
and `to` are optional, and a missing bound is unbounded on that side. Validation: `from <= to`, and
page size between 1 and 100. No maximum period length is imposed, because the project has no such
convention.

**Ordering is deterministic:** `prescribedAt DESC`, then `id DESC`. Ordering is expressed inside the
query, not through an ambiguous `Pageable` sort on a constructor/projection query.

> *Technical implementation decision* — the workbook does not define the period timestamp; the rule
> above is the interpretation that makes the two required discrepancy categories reachable.

---

## 5. Filters

`GET /prescription-reconciliation`

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `from` | ISO-8601 instant | no | inclusive lower bound |
| `to` | ISO-8601 instant | no | exclusive upper bound |
| `outcome` | enum | no | one `PrescriptionReconciliationOutcome` value |
| `discrepanciesOnly` | boolean | no | `true` expands to the two discrepancy outcomes |
| `prescriptionCode` | string | no | exact match on the QTN-21 unique code; trimmed |
| `page` | int | no (default `0`) | non-negative |
| `size` | int | no (default `20`) | 1–100 |

Interaction rule: when `outcome` is supplied it wins and `discrepanciesOnly` is ignored. When
neither is supplied, all outcomes are returned. `prescriptionCode` is optional and exact — no
wildcard or partial-match semantics are introduced.

---

## 6. Response contract

`GET /prescription-reconciliation` returns a Spring `Page` of rows:

```json
{
  "content": [
    {
      "prescriptionId": "…",
      "prescriptionCode": "RX000001",
      "patientId": "…",
      "patientCode": "PA001",
      "patientName": "Nguyen Van A",
      "doctorId": "…",
      "doctorName": "Dr. B",
      "prescriptionStatus": "DISPENSED",
      "interconnectionStatus": "FAILED",
      "outcome": "DISPENSED_NOT_TRANSMITTED",
      "discrepancy": true,
      "retransmissionEligible": true,
      "prescribedAt": "2026-09-10T02:00:00Z",
      "lastInterconnectionAt": "2026-09-10T03:00:00Z",
      "lastDispensedAt": "2026-09-11T02:00:00Z",
      "lastInterconnectionError": "gateway timeout",
      "interconnectionReceiptCode": null,
      "reconciliationNoteCount": 0
    }
  ],
  "totalElements": 1,
  "totalPages": 1,
  "size": 20,
  "number": 0
}
```

**Deliberately not exposed:** allergies, identity number, insurance number, phone, address,
clinical history, and any prescribed / dispensed / remaining quantity.

`patientName` follows the project's existing anonymization behaviour: when anonymization mode is
enabled it is masked with `PatientAnonymizer.maskFullName(patientCode)`, exactly as
`GET /prescription-interconnections` does.

---

## 7. Authorization matrix

| Actor | View reconciliation | Record note | Retry `FAILED` interconnection |
|---|---|---|---|
| ADMIN | YES | YES | YES (existing rule, unchanged) |
| PHARMACIST | YES | YES | **NO** |
| DOCTOR | NO | NO | existing rule only (responsible doctor, first send) |
| RECEPTIONIST | NO | NO | NO |
| MANAGER | NO | NO | NO |

Only **two** permissions are introduced, both created by `V102` and granted to `ADMIN` and
`PHARMACIST`:

- `PRESCRIPTION_RECONCILIATION_VIEW` — list reconciliation + read notes
- `PRESCRIPTION_RECONCILIATION_NOTE` — record a reconciliation reason

**Not touched by NCL-12-CN-007:** `PRESCRIPTION_INTERCONNECTION_RETRY`,
`PRESCRIPTION_INTERCONNECTION_SEND`, `PRESCRIPTION_INTERCONNECTION_READ`, and the ADMIN-only
authorization inside `RetryPrescriptionInterconnectionService`. A pharmacist does **not** gain
retransmission capability through this story. This is enforced by the migration itself (a test
asserts that the executable SQL of `V102` never references an interconnection permission).

Authorization is enforced twice, on the same permission codes:

1. **REST layer** — `@RequirePermission("PRESCRIPTION_RECONCILIATION_VIEW" | "…_NOTE")`
2. **Service layer** — `PrescriptionReconciliationAccessValidator` via
   `CurrentUserPort.hasPermission(...)`

Denial behaviour (TC-03): HTTP 403 `ACCESS_DENIED` and an audit record written by the **existing**
`RequirePermissionAspect` (`ActionType.ACCESS_DENIED`, `ResourceType.PERMISSION`). No duplicate
denial-audit logic is added.

Client input is never trusted: the actor identity comes from `CurrentUserPort`, and no endpoint
accepts a `userId`, `role`, `doctorId` or discrepancy type from the request.

---

## 8. Retransmission behavior

Retransmission is **not re-implemented**. The existing NCL-12-CN-004 endpoint is reused:

| Method | Path | Permission | Behavior |
|---|---|---|---|
| `POST` | `/prescriptions/{id}/interconnection/retry` | `PRESCRIPTION_INTERCONNECTION_RETRY` | Unchanged: ADMIN only, `FAILED` only, row-locked, audited |

The reconciliation list tells the client when retransmission is available through
`retransmissionEligible`, which is derived strictly from `interconnectionStatus == FAILED`. No
`/prescription-reconciliation/{id}/retransmit` endpoint exists, and no second payload builder,
state machine, external adapter or transmission audit was introduced.

Consequence for the frontend: for a row with `retransmissionEligible = true`, call the existing
retry endpoint. For a row with `discrepancy = true` and `retransmissionEligible = false` (the
`NOT_SENT` case), the actionable path is a reconciliation note.

First-time transmission remains with the responsible doctor through
`POST /prescriptions/{id}/interconnection` and is unaffected by this story.

---

## 9. Note / reason behavior

Persistence is **new and append-only**: table `prescription_reconciliation_notes` (migration
`V102`). `prescriptions.note`, `prescriptions.cancel_reason` and the audit log were deliberately
**not** reused:

- `prescriptions.note` is the clinical note, and an interconnected prescription must not be modified
  (QTN-12, QTN-42)
- `prescriptions.cancel_reason` only describes cancellation
- an audit record is a system trace, not a user-visible reconciliation reason

A note row contains: the prescription, the reconciliation outcome (the workbook *discrepancy type*),
the reason, the author and the timestamp. There is **no** update operation and no delete operation on
the note repository. The only deletion path is `MedicalRecordCascadeDeleter`, which removes the notes
of a medical record **before** deleting its prescriptions, exactly like `prescription_items`,
`prescription_dispense_items`, `prescription_amendments`, `prescription_warning_logs` and
`prescription_allergy_warning_logs`. Reconciliation notes are therefore prescription-scoped history:
they never outlive the prescription they describe.

> *Retention decision* — the workbook defines **no** retention or deletion rule for reconciliation
> notes (`project-workbook.xlsx` has no row mentioning retention or deletion for NCL-12-CN-007). The
> original schema instead declared a non-cascading `NOT NULL` foreign key hoping the note would
> survive prescription deletion, which is impossible: that combination does not preserve the row, it
> **blocks** the parent delete and broke `DeleteMedicalRecordService`. Deleting the notes with their
> prescription is the behaviour consistent with every other prescription child table, and it is the
> only option that keeps them reachable — the endpoints are prescription-scoped, so a note whose
> prescription is gone could never be read again.

Write semantics (`POST /prescription-reconciliation/{prescriptionId}/notes`):

```json
{ "reason": "Đã liên hệ lại đơn vị liên thông, chờ xác nhận." }
```

| Rule | Behavior |
|---|---|
| `reason` blank | rejected (`@NotBlank` → 400, and the domain aggregate rejects it too) |
| `reason` longer than 500 characters | rejected (`@Size(max = 500)` → 400, and the domain aggregate rejects it too) |
| `reason` whitespace | trimmed before persisting |
| discrepancy type | **always computed server-side** from the current prescription state; a client-supplied value is never accepted |
| outcome is not a discrepancy (`CONSISTENT`, `NOT_TRANSMITTED_NOT_DISPENSED`, `CANCELLED`) | rejected (`VALIDATION_FAILED` → 400); the note is not saved and no audit record is written. Only `TRANSMITTED_NOT_DISPENSED` and `DISPENSED_NOT_TRANSMITTED` accept a note |
| author and timestamp | from `CurrentUserPort` and `ClockPort`; never from the request |
| unknown prescription | 404 `PRESCRIPTION_NOT_FOUND` |
| permission | `PRESCRIPTION_RECONCILIATION_NOTE` |

Read semantics (`GET /prescription-reconciliation/{prescriptionId}/notes`, permission
`PRESCRIPTION_RECONCILIATION_VIEW`) returns the append-only history oldest-first. An unknown
prescription is a 404 rather than an empty list. `reconciliationOutcome` in this payload **is** the
workbook discrepancy type.

---

## 10. Audit behavior

Almost all auditing is **reused**; almost nothing is new.

| Operation | Audit | Notes |
|---|---|---|
| Reconciliation list (read) | none | Matches the existing `SearchPrescriptionInterconnectionsService`, which does not audit administrative reads. A read-audit was not introduced. |
| Read reconciliation notes | none | Same reason as above. |
| Record reconciliation note | **new** record via the existing `AuditLog` | `ActionType.UPDATE`, `ResourceType.PRESCRIPTION`, `resourceId` = prescription id, detail = `{action: "RECONCILIATION_NOTE", prescriptionCode, reconciliationOutcome, reconciliationNoteId, reason}`, timestamp from `ClockPort` |
| Retransmission | unchanged | Still written by `RetryPrescriptionInterconnectionService` (attempt history + audit) |
| Authorization denial | unchanged | Still written once by `RequirePermissionAspect` as `ActionType.ACCESS_DENIED` / `ResourceType.PERMISSION` |

No new `ActionType` or `ResourceType` enum value was introduced, so no unrelated consumer (for
example the out-of-scope admin operation log screen) is affected. No sensitive payload is logged —
only the identifier, the outcome and the reason text.

---

## 11. Error behavior

| Situation | HTTP | Code |
|---|---|---|
| Missing / wrong permission | 403 | `ACCESS_DENIED` (plus `ACCESS_DENIED` audit) |
| Unauthenticated | 401 | `AUTHENTICATION_FAILED` |
| `from` after `to` | 400 | `VALIDATION_FAILED` |
| `size` outside 1–100, or negative `page` | 400 | `VALIDATION_FAILED` |
| Unknown `outcome` value | 400 | parameter type mismatch |
| Blank or over-long note reason | 400 | `VALIDATION_FAILED` with field errors |
| Note on a non-discrepancy prescription (`CONSISTENT`, `NOT_TRANSMITTED_NOT_DISPENSED`, `CANCELLED`) | 400 | `VALIDATION_FAILED` |
| Unknown prescription on the note endpoints | 404 | `PRESCRIPTION_NOT_FOUND` |
| Retry a non-`FAILED` interconnection (existing endpoint) | 400 | `VALIDATION_FAILED` / `PRESCRIPTION_INVALID_STATUS` |

---

## 12. What is reused, what is new

**Reused (no duplication):** `Prescription` and `prescriptionCode` (QTN-21),
`InterconnectionStatus`, `PrescriptionStatus`, `prescription_interconnection_logs` (V21),
`prescription_dispense_items` (V13), the NCL-12-CN-004 retry endpoint and its authorization,
`RequirePermission` / `RequirePermissionAspect` / `PermissionEvaluator`, `CurrentUserPort`,
`ClockPort`, `AuditLog`, `PatientAnonymizer` + `AnonymizationModeState`, the existing
projection-based query-repository pattern (`QueueItemQueryRepository` precedent), and the existing
pagination (`Page` / `PageRequest`) and error conventions.

**New:** the derived classification (`PrescriptionReconciliationOutcome`,
`PrescriptionReconciliationClassifier`), the append-only note aggregate + table + repository, the
dedicated read adapter with a projection (chosen over the aggregate mapper, which loads prescription
items per row and would create N+1), three use cases, three services, one access validator, one
controller with three endpoints, and migration `V102`.

**Query cost per page is constant (4 queries):** the reconciliation projection (patient/doctor
display context resolved with `left join` inside the same query), the paged count, and the batched
dispensing/note lookups. It does not grow with page size. Both the page query and the count query are
assembled from the same predicate text in `PrescriptionReconciliationQueryRepositoryAdapter`, and the
count query carries **no** display joins, because a left join on a primary key cannot remove a row.

---

## 13. Known business gaps and technical limitations

1. **PHARMACIST cannot retransmit (deliberate, unresolved by this story).** The workbook lists
   PHARMACIST as a story actor, but NCL-12-CN-004 restricts retry to ADMIN. Per the locked
   requirement, retransmission authorization was left unchanged: PHARMACIST receives view + note,
   ADMIN receives view + note + retry. If the product owner wants pharmacists to retransmit, that is
   a change to NCL-12-CN-004 and is out of scope here.
2. **`NOT_SENT` + dispensed cannot be remediated by retry.** Retry only accepts `FAILED`, so these
   rows are reported with `retransmissionEligible = false` and are handled by a reconciliation note.
   No retry flow was invented for `NOT_SENT`.
3. **Cancellation reconciliation is out of scope.** NCL-12-CN-007 defines only two discrepancy
   categories, so `CANCELLED` rows are visible but never flagged. The workbook also mentions
   replacing an already-transmitted prescription (QTN-42) but that flow belongs to NCL-12-CN-008 and
   is not implemented here.
4. **Quantity-level reconciliation is out of scope.** Partial dispensing is reported through
   `prescriptionStatus` only; no quantity is compared and none is exposed.
5. **Period timestamp is an interpretation.** The workbook does not name the controlling timestamp;
   the chosen "issuance OR transmission OR dispensing" rule is documented in §4.
6. **Enum/DB coupling.** `prescription_reconciliation_notes.reconciliation_outcome` has a `CHECK`
   constraint listing the five outcome values. Adding a future outcome value requires a new
   migration — this follows the existing convention (`chk_prescription_interconnection_logs_type`).
7. **Notification on discrepancy is not implemented.** The workbook does not require notifying
   anyone when a discrepancy is found at reconciliation time, so no email/SMS/push path was added.
8. **`prescription_interconnection_logs` FK deletion — resolved.** A pre-existing **NCL-12-CN-004**
   defect was discovered during this feature: `MedicalRecordCascadeDeleter` removed the
   reconciliation notes but not the interconnection logs, so deleting a medical record that had a
   transmitted prescription remained broken on a foreign-key-enforcing database. The minimal fix —
   a `deleteByPrescriptionIdIn` on `JpaPrescriptionInterconnectionLogRepository` plus one line in the
   deleter, mirroring the reconciliation-note fix — was applied here because it is small, isolated
   and does not change NCL-12-CN-004 business behaviour. The non-cascading FK is intentionally
   preserved, exactly like every other prescription child table.

---

## 14. Verification status

| Item | Status |
|---|---|
| Focused NCL-12-CN-007 backend tests (domain matrix, services, controller, migration guard, H2 query, cascade delete) | **Executed** — 89 tests, 0 failures, 0 errors, 0 skipped |
| Affected-area regression (`*Prescription*`, `*Reconciliation*`, `*MedicalRecord*`, `*Dispense*`, `*Interconnection*`) | **Executed** — 640 tests, 0 failures, 0 errors, 12 skipped (Docker-guarded MySQL classes) |
| Full backend suite | **Executed** — 3377 tests, 5 failures, 6 errors, 55 skipped. All failing classes are pre-existing and unrelated: `ContraindicationRuleControllerTest` (3), `DoctorWeeklyTableControllerTest` (5) — documented before this task; `PatientImportEdgeCasesTest` (1) and `ExcelPatientSheetParserTest` (1, `NoClassDefFoundError`) — **re-verified to fail identically with this task's changes stashed**, in the patient-Excel-import area; `LoginAttemptConcurrencyIntegrationTest` is order-dependent and passes in isolation. None of them touches reconciliation, notes, prescriptions or medical-record deletion. |
| MySQL migration (`V102`) applied by Flyway on a real MySQL server | **Not executed** — no Docker daemon is available in this environment, so Testcontainers/MySQL suites are skipped and `V102`'s MySQL-specific SQL (for example `UUID_TO_BIN(UUID())`) remains unverified. `V102` follows the exact convention of its neighbours `V77`, `V79` and `V98`. H2 verifies the JPQL projection and the JPA mapping of the note entity (Flyway is disabled in H2 slice tests by project convention). |
| Medical-record deletion with reconciliation notes present | **Executed on H2** — `MedicalRecordCascadeDeleterReconciliationNoteIntegrationTest` adds the real non-cascading foreign key and deletes a medical record that has prescriptions with notes. It fails with `Referential integrity constraint violation` when the note deletion is removed from the deleter, which is how the fix was proven. |
| Medical-record deletion with interconnection logs present | **Executed on H2** — `MedicalRecordCascadeDeleterPrescriptionHistoryIntegrationTest` adds the real non-cascading foreign keys on both child tables and proves (1) a medical record whose prescriptions have interconnection logs deletes successfully, (2) unrelated medical records' logs/notes are kept, and (3) the deleter joins the caller's transaction. The pre-existing NCL-12-CN-004 FK defect is thereby closed. |
| CV-03 frontend | **Not implemented** (out of scope) |
| CV-04 independent QA | **Not claimed as complete** (separate team deliverable) |

The frontend should consume this contract. No backend change is required for basic reconciliation
functionality.





