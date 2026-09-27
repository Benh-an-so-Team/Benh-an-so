# Partial Medication Dispensing — NCL-06-CN-008 (Backend)

> **Module:** NCL-06 — Cấp phát thuốc
> **User Story:** NCL-06-CN-008 — Cấp phát một phần khi tồn kho không đủ
> **Related:** QTN-06 (*Không cấp phát vượt tồn kho*), NCL-06-CN-003 (*Cấp phát thuốc theo đơn*), NCL-07-CN-001 (*Thanh toán*)

This document is the backend contract for the frontend teammate. No backend source change should be needed to build the UI.

---

## 1. Business rules (CV-01)

1. **Who:** Only `PHARMACIST` (and `ADMIN`) may dispense. Enforced in the service layer (`AccessDeniedException`) and gated at the REST layer by `@RequirePermission("PRESCRIPTION_UPDATE_STATUS")`.
2. **When partial dispensing is allowed:** prescription in `PENDING_DISPENSE` or `PARTIALLY_DISPENSED` state. `CANCELLED` → invalid status; `DISPENSED` → already dispensed.
3. **Quantity rules** (validated before any stock changes):
   - actual quantity `> 0`;
   - actual quantity `<= remaining` where `remaining = prescribed - totalDispensed` (cumulative, not just this request);
   - actual quantity `<= available` eligible inventory (QTN-06). Violating this raises `INSUFFICIENT_STOCK` (HTTP 409) with per-item shortage detail.
4. **Shortage calculation:** `remaining = prescribed - totalActuallyDispensed`. `remaining > 0` → `PARTIALLY_DISPENSED`; all items `remaining == 0` → `DISPENSED`.
5. **Completion after replenishment:** dispense the remaining quantity in a later call; inventory decreases by exactly the newly dispensed quantity; status becomes `DISPENSED`; a NEW history record is created (previous events are never overwritten).
6. **Inventory/lot:** FEFO (earliest `expiry_date`, then `created_at`) across `medicine_batches`; each event records the actual batch/lot and quantity. One request may consume multiple lots.
7. **Payment (NCL-07-CN-001):** the medicine fee is entered by the receptionist; the backend exposes `prescribedQuantity`, `dispensedQuantity`, and `remainingQuantity` per item so the UI charges only the actually dispensed quantity. A `PARTIALLY_DISPENSED` prescription is NOT `PENDING_DISPENSE`, so its visit appears in payable encounters.
8. **History:** every dispense event appends a `prescription_dispense_items` row (medication, quantity, lot, actor, timestamp) and a `stock_movements` row. Never overwritten.

---

## 2. Data model (CV-02)

Reused existing tables (no new tables):

- `prescriptions.status` — new enum value `PARTIALLY_DISPENSED` (VARCHAR, no schema change needed).
- `prescription_items` — added `dispensed_quantity INT NOT NULL DEFAULT 0` (migration `V62__add_dispensed_quantity_to_prescription_items.sql`) with a `CHECK (dispensed_quantity >= 0 AND dispensed_quantity <= quantity)` constraint.
- `prescription_dispense_items` — existing dispensing history (medication, batch/lot, quantity, pharmacist, timestamp).
- `stock_movements` — existing inventory movement history.
- `medicine_batches` — existing lot inventory, deducted atomically (`UPDATE ... WHERE quantity >= :delta`).

---

## 3. API endpoints

Base: `/prescriptions`

### 3.1 Partial / completion dispensing

- **Method:** `POST`
- **Path:** `/prescriptions/{id}/partial-dispense`
- **Permission:** `PRESCRIPTION_UPDATE_STATUS` (PHARMACIST/ADMIN)
- **Request body (optional):** empty body = dispense all remaining quantity for every item.

```json
{
  "items": [
    { "prescriptionItemId": "…", "quantity": 12 }
  ]
}
```

- **Response (200):**

```json
{
  "prescription": {
    "id": "…",
    "status": "PARTIALLY_DISPENSED",
    "items": [
      { "id": "…", "medicineId": "…", "quantity": 20, "dispensedQuantity": 12, "remainingQuantity": 8 }
    ]
  },
  "dispensedBy": "…",
  "dispensedAt": "…",
  "items": [
    {
      "prescriptionItemId": "…",
      "medicineId": "…",
      "medicineCode": "…",
      "medicineName": "…",
      "unit": "vien",
      "prescribedQuantity": 20,
      "dispensedQuantity": 12,
      "remainingQuantity": 8
    }
  ],
  "allocations": [
    {
      "dispenseItemId": "…",
      "prescriptionItemId": "…",
      "medicineId": "…",
      "medicineCode": "…",
      "medicineName": "…",
      "batchId": "…",
      "batchNumber": "BATCH-A",
      "expiryDate": "2026-12-01",
      "dispensedQuantity": 12,
      "batchQuantityRemaining": 0
    }
  ]
}
```

- **Errors:**
  - `400 VALIDATION_FAILED` — `quantity <= 0`, `quantity > remaining`, unknown `prescriptionItemId`.
  - `404 PRESCRIPTION_NOT_FOUND`.
  - `409 PRESCRIPTION_ALREADY_DISPENSED` / `PRESCRIPTION_INVALID_STATUS`.
  - `409 INSUFFICIENT_STOCK` — requested quantity exceeds available inventory (with shortage details).

### 3.2 Dispensing history

- **Method:** `GET`
- **Path:** `/prescriptions/{id}/dispense-history`
- **Permission:** `PRESCRIPTION_DISPENSE_HISTORY_READ` (granted to `ADMIN`, `DOCTOR` — own visits only, `PHARMACIST`, `MANAGER`)

```json
[
  {
    "id": "…",
    "prescriptionId": "…",
    "prescriptionItemId": "…",
    "medicineId": "…",
    "medicineBatchId": "…",
    "dispensedQuantity": 12,
    "dispensedBy": "…",
    "dispensedAt": "…",
    "medicineName": "Paracetamol 500 mg",
    "batchNumber": "BATCH-A",
    "dispenserName": "Vo Thanh Nam"
  }
]
```

### 3.3 Existing endpoints (unchanged)

- `POST /prescriptions/{id}/dispense` — full single-shot dispense from `PENDING_DISPENSE` only; now rejects `PARTIALLY_DISPENSED` (must use `/partial-dispense` to complete).
- `GET /prescriptions/{id}` — the prescription `items[]` now include `dispensedQuantity` and `remainingQuantity` (payment view).

---

## 4. Concurrency

- Prescription row locked with `SELECT … FOR UPDATE` (`findByIdForUpdate`), serializing multiple dispenses of the same prescription.
- Eligible batches locked with `PESSIMISTIC_WRITE` and deducted via an atomic guarded update (`UPDATE medicine_batches SET quantity = quantity - :delta WHERE id = :id AND quantity >= :delta`). If the guard fails, the operation rolls back with `INSUFFICIENT_STOCK`, so inventory can never go negative or be double-consumed.
- Inventory deduction + dispense history + stock movement + prescription status all commit in one `@Transactional` unit.

> A full database-level concurrency test requires Docker/MySQL and is skipped when Docker is unavailable (see final report).

---

## 5. Security

- `PHARMACIST`/`ADMIN` role enforced in the service; `@RequirePermission("PRESCRIPTION_UPDATE_STATUS")` on the dispense endpoint and `PRESCRIPTION_DISPENSE_HISTORY_READ` on history. History is authorized contextually (a `DOCTOR` may only read the dispense history of their own visits); `MANAGER` is granted the dedicated history-read permission without full prescription read access.

---

## 6. Relationship to reconciliation (NCL-12-CN-007)

Partial dispensing is a valid operational state and is **not** a reconciliation discrepancy.

NCL-12-CN-007 (`docs/api/ncl-12-cn-007-reconciliation-contract.md`) compares the interconnection state
against the dispensing state and recognises exactly two discrepancy categories:

- transmitted but not dispensed, and
- dispensed but not successfully transmitted.

`PARTIALLY_DISPENSED` counts as **dispensed**, so:

- `SUCCESS` + `PARTIALLY_DISPENSED` reconciles to `CONSISTENT` (no discrepancy), and
- `NOT_SENT`/`FAILED` + `PARTIALLY_DISPENSED` reconciles to the discrepancy
  `DISPENSED_NOT_TRANSMITTED`.

Reconciliation does **not** compare quantities: `prescribedQuantity`, `dispensedQuantity` and
`remainingQuantity` stay available on the dispensing/payment endpoints documented above and are not
exposed by the reconciliation API. Completing a partially dispensed prescription still follows
section 3.1 (`POST /prescriptions/{id}/partial-dispense`); that completion can later change the
reconciliation outcome to `CONSISTENT` because the reconciliation state is derived, never stored.

