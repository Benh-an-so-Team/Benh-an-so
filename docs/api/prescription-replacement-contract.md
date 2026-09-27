# Prescription Replacement API Contract

> Module: **NCL-12 — Đơn thuốc điện tử và liên thông quốc gia**
>
> User Story: **NCL-12-CN-008 — Thay thế đơn thuốc đã liên thông**
>
> Business Rules: **QTN-42, QTN-21, QTN-12**
>
> Acceptance Criteria: **TC-01, TC-02, TC-03**
>
> Base URL: `http://localhost:8080/api/v1`
>
> Auth: Bearer Token (JWT)

## 1. Scope

An interconnected prescription is never edited in place. When a correction is
needed the doctor issues a **replacement prescription** that is linked to the
original, the original moves to the new status `REPLACED` ("đã bị thay thế"), and
the replacement is sent to the simulated interconnection system, which marks the
original as cancelled.

Immutability of the original (QTN-42, QTN-21):

- `prescriptionCode` never changes and is never reused.
- The original's interconnection history (`interconnectionStatus`, receipt code,
  timestamps) is preserved, because it is historically true that it was accepted.
- No endpoint edits the medication content of an interconnected prescription.
  `PATCH /prescriptions/{id}` still only accepts `PENDING_DISPENSE` prescriptions
  and now also refuses a `REPLACED` one.

## 2. Endpoint

| Method | Path | Permission | Response |
|---|---|---|---|
| `POST` | `/prescriptions/{originalPrescriptionId}/replacement` | `PRESCRIPTION_UPDATE` | `201 Created` |

`PRESCRIPTION_UPDATE` is the same permission that already guards
`PATCH /prescriptions/{id}` (amend) and `POST /prescriptions/{id}/cancel`, so no
new permission, role grant or permission-matrix change is introduced by this
story. `PHARMACIST`, `MANAGER` and reception staff therefore cannot call it.

## 3. Request body

```json
{
  "replacementReason": "Sai liều lượng so với chẩn đoán đã cập nhật",
  "note": "Đơn thay thế lần 1",
  "items": [
    {
      "medicineId": "16000000-0000-0000-0000-000000000001",
      "dosage": "1 vien",
      "frequency": 2,
      "route": "ORAL",
      "durationDays": 5,
      "quantity": 10,
      "instructions": "Uong sau an",
      "singleDoseQuantity": 1
    }
  ],
  "interactionOverrides": [],
  "allergyOverrides": [],
  "contraindicationOverrides": [],
  "maxDailyDoseOverrides": [],
  "controlledMedicineConfirmed": false
}
```

### Field rules

| Field | Required | Rules |
|---|---|---|
| `replacementReason` | yes | Not blank, at most 500 characters. |
| `note` | no | Free text recorded on the replacement. |
| `items` | yes | At least one item; the same shape and the same validation as `POST /prescriptions`. |
| `interactionOverrides` / `allergyOverrides` / `contraindicationOverrides` / `maxDailyDoseOverrides` | no | Identical to `POST /prescriptions`. Warning lists must be fully confirmed or the create flow answers `400`. |
| `controlledMedicineConfirmed` | no | Identical to `POST /prescriptions`. |

`medicalRecordId` is **not** part of the request. The replacement always belongs
to the medical record (and therefore the encounter) of the original prescription,
which the backend derives from the original. There is no legitimate alternative
value, so the field is not accepted.

## 4. Response — `201 Created`

```json
{
  "originalPrescription": {
    "id": "16200000-0000-0000-0000-000000000001",
    "prescriptionCode": "RX000001",
    "status": "REPLACED",
    "replacedByPrescriptionId": "16200000-0000-0000-0000-000000000002",
    "replacedByPrescriptionCode": "RX000002",
    "replacesPrescriptionId": null,
    "replacesPrescriptionCode": null,
    "replacementReason": null
  },
  "replacementPrescription": {
    "id": "16200000-0000-0000-0000-000000000002",
    "prescriptionCode": "RX000002",
    "status": "PENDING_DISPENSE",
    "replacesPrescriptionId": "16200000-0000-0000-0000-000000000001",
    "replacesPrescriptionCode": "RX000001",
    "replacementReason": "Sai liều lượng so với chẩn đoán đã cập nhật",
    "replacedByPrescriptionId": null,
    "replacedByPrescriptionCode": null
  },
  "interconnection": {
    "prescriptionId": "16200000-0000-0000-0000-000000000002",
    "prescriptionCode": "RX000002",
    "status": "SUCCESS",
    "receiptCode": "LT-20260925-000123",
    "failureReason": null,
    "completedAt": "2026-09-25T03:00:00Z"
  }
}
```

Both prescriptions are returned as full prescription payloads (the same shape as
`GET /prescriptions/{id}`), abbreviated above for readability.

## 5. Status codes and business errors

| Status | When | `code` |
|---|---|---|
| `201` | Replacement issued (interconnection may be `SUCCESS` or `FAILED`). | — |
| `400` | Missing/blank reason, empty items, or any existing prescription validation failure (missing diagnosis, unconfirmed interaction/allergy/contraindication/max-dose warning, controlled medicine not confirmed, inactive medicine, duplicate medicine). | `VALIDATION_FAILED`, `PRESCRIPTION_INTERACTION_CONFIRMATION_REQUIRED`, `PRESCRIPTION_ALLERGY_CONFIRMATION_REQUIRED`, `PRESCRIPTION_CONTRAINDICATION_CONFIRMATION_REQUIRED`, `PRESCRIPTION_MAX_DAILY_DOSE_CONFIRMATION_REQUIRED`, `CONTROLLED_MEDICINE_CONFIRMATION_REQUIRED`, … |
| `403` | Caller lacks `PRESCRIPTION_UPDATE`, is not a `DOCTOR`, or is not the doctor responsible for the original's visit. | `UNAUTHORIZED_PRESCRIPTION_REPLACEMENT`, `ACCESS_DENIED` |
| `404` | The original prescription does not exist. | `PRESCRIPTION_NOT_FOUND` |
| `409` | The original was never interconnected, its interconnection failed, it was already dispensed or partially dispensed, it was cancelled, or it was already replaced. | `PRESCRIPTION_INVALID_STATUS`, `PRESCRIPTION_ALREADY_DISPENSED`, `PRESCRIPTION_ALREADY_CANCELLED` |

The `409` message for a dispensed original is the TC-02 guidance:
*"Dispensed prescriptions cannot be replaced. Please prescribe a new prescription
for the visit instead."*

## 6. Lifecycle and transaction behaviour

The operation runs as **one transaction**: lock the original, validate it, create
the replacement through the existing creation flow, link it, mark the original
`REPLACED`, and only then send it to the interconnection system.

```
original: PENDING_DISPENSE + interconnectionStatus SUCCESS   (only eligible state)
                              | replace
                              v
                    status = REPLACED   (interconnectionStatus stays SUCCESS)

replacement: PENDING_DISPENSE + interconnectionStatus NOT_SENT
                    | send
                    +-- SUCCESS -> receipt stored, original cancelled on the gateway
                    +-- FAILED  -> reason stored, original NOT cancelled on the gateway
```

| Case | Committed local state | Simulated interconnection system | Recovery |
|---|---|---|---|
| Send accepted | original `REPLACED` (link intact), replacement `SUCCESS` + receipt | original marked cancelled | none needed (TC-01 + TC-03) |
| Gateway failure | original `REPLACED`, replacement `FAILED` + `lastInterconnectionError` + a `FAILED` attempt log | original still active | `POST /prescriptions/{replacementId}/interconnection/retry` (ADMIN) |
| Any other failure | nothing is committed; the original stays `PENDING_DISPENSE` | original active | call the endpoint again |

The response always tells the truth about the gateway state: the original is only
cancelled on the simulated interconnection system when `interconnection.status` is
`SUCCESS`. There is deliberately no separate "cancelled on gateway" flag, because
it is derivable and would duplicate `interconnection.status`.

Two concurrent requests for the same original cannot both succeed: the original is
locked with `SELECT … FOR UPDATE`, so the second sees `REPLACED` and receives
`409`. A database unique constraint on `replaces_prescription_id` is the second
line of defence, so at most one replacement can ever exist per original.

## 7. Retry after an interconnection failure (CV-04)

`POST /prescriptions/{replacementId}/interconnection/retry` is the existing admin
retry (`PRESCRIPTION_INTERCONNECTION_RETRY`). It is accepted only while the
replacement is `FAILED`, re-sends the identical payload — including the replaced
prescription code — and therefore marks the original as cancelled on the gateway
as soon as it succeeds. A repeated retry after success is rejected, so no second
replacement is created and the link cannot be corrupted.

The replacement of a replacement is allowed: once a replacement is itself
interconnected and still undispensed it can be superseded again, which produces the
chain `A ← B ← C` that the postcondition requires.

## 8. Querying the chain

No new lookup endpoint is needed. Both directions are exposed:

| Goal | Request |
|---|---|
| The original and its new status | `GET /prescriptions/{originalId}` → `status = REPLACED`, `replacedByPrescriptionId` / `replacedByPrescriptionCode` |
| The replacement and its origin | `GET /prescriptions/{replacementId}` → `replacesPrescriptionId`, `replacesPrescriptionCode`, `replacementReason` |
| All replaced prescriptions of a record | `GET /prescriptions/medical-records/{medicalRecordId}` → filter `status = REPLACED` |
| Every replaced prescription in the clinic | `GET /prescriptions?status=REPLACED` |
| Interconnection state of the replacement | `GET /prescription-interconnections?status=FAILED` (ADMIN) or the `interconnection` block of this endpoint |

The new response fields (`replacesPrescriptionId`, `replacesPrescriptionCode`,
`replacementReason`, `replacedByPrescriptionId`, `replacedByPrescriptionCode`) are
additive, so existing clients are unaffected.

## 9. Dispensing, cancelling and printing a replaced prescription

- A `REPLACED` prescription **cannot be dispensed or partially dispensed**; both
  dispense endpoints answer `409 PRESCRIPTION_INVALID_STATUS`.
- `POST /prescriptions/{id}/cancel` is unchanged: cancelling a not-yet-dispensed
  replacement is still allowed by the existing QTN-27 rule. Cancelling a
  replacement leaves the original `REPLACED` and, because at most one replacement
  can exist, no further replacement can be created for that original. This is
  existing behaviour and is flagged as an open product decision in the story
  report.
- A `REPLACED` prescription is not printable. `GET /prescriptions/{id}/print`
  accepts only `PENDING_DISPENSE` and `DISPENSED`, matching the existing
  "only active prescriptions can be printed" rule.

## 10. Audit

| Event | Audit entry |
|---|---|
| Replacement prescription created | `CREATE` on `PRESCRIPTION` (created by the existing creation flow) |
| Original superseded | `UPDATE` on `PRESCRIPTION`, resource = original id, detail contains `prescriptionCode`, `status = REPLACED`, `replacementPrescriptionId`, `replacementPrescriptionCode`, `replacementReason`, `replacedAt` |
| Replacement sent | `SEND` on `PRESCRIPTION` (existing send flow) |
| Attempt to replace another doctor's prescription | `ACCESS_DENIED` on `PRESCRIPTION`, written in its own transaction so it survives the rejected request |
