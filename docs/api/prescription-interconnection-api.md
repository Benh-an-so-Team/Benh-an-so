# Prescription interconnection API

Base path: `/api/v1`. The live OpenAPI document is available at `/api/v1/api-docs` and Swagger UI at `/api/v1/swagger-ui.html`.

| Endpoint | Permission | Business authorization |
|---|---|---|
| `POST /prescriptions/{id}/interconnection` | `PRESCRIPTION_INTERCONNECTION_SEND` | DOCTOR and responsible for the prescription visit |
| `GET /prescription-interconnections` | `PRESCRIPTION_INTERCONNECTION_READ` | ADMIN |
| `POST /prescriptions/{id}/interconnection/retry` | `PRESCRIPTION_INTERCONNECTION_RETRY` | ADMIN; only `FAILED` submissions |

PHARMACIST is not assigned any interconnection permission.

## Reconciliation (NCL-12-CN-007)

Reconciliation between transmitted and dispensed prescriptions lives on
`/prescription-reconciliation` and is documented in
[`ncl-12-cn-007-reconciliation-contract.md`](ncl-12-cn-007-reconciliation-contract.md).

| Endpoint | Permission | Business authorization |
|---|---|---|
| `GET /prescription-reconciliation` | `PRESCRIPTION_RECONCILIATION_VIEW` | ADMIN, PHARMACIST |
| `GET /prescription-reconciliation/{prescriptionId}/notes` | `PRESCRIPTION_RECONCILIATION_VIEW` | ADMIN, PHARMACIST |
| `POST /prescription-reconciliation/{prescriptionId}/notes` | `PRESCRIPTION_RECONCILIATION_NOTE` | ADMIN, PHARMACIST |

Reconciliation does **not** add a retransmission endpoint and does **not** change the
authorization of the existing retry endpoint above: retry remains
`PRESCRIPTION_INTERCONNECTION_RETRY`, ADMIN only, `FAILED` submissions only. A PHARMACIST may view
reconciliation and record a reconciliation reason, but must retransmit nothing. The
`retransmissionEligible` flag returned by the reconciliation list is derived strictly from
`interconnectionStatus == FAILED`, so the frontend can safely offer retry only for the rows the
existing NCL-12-CN-004 flow would accept.

## Send and retry response

Both submit operations return HTTP 200 with the following shape. A gateway failure is represented as `FAILED`, so the caller can show the recorded reason without losing the history record.

```json
{
  "prescriptionId": "a4e06ad5-d63b-4faa-a711-7bb895ec9736",
  "prescriptionCode": "RX000001",
  "status": "SUCCESS",
  "receiptCode": "LT-20260821-000001",
  "failureReason": null,
  "completedAt": "2026-08-21T03:00:00Z"
}
```

For a failed send/retry, `status` is `FAILED`, `receiptCode` is `null`, and `failureReason` is populated. Invalid authorization or retrying a status other than `FAILED` returns the standard 403/400 API error.

## Search

`GET /prescription-interconnections?status=FAILED&from=2026-08-01T00:00:00Z&to=2026-08-31T23:59:59Z&page=0&size=20`

`status` is required and accepts `NOT_SENT`, `SUCCESS`, or `FAILED`. Results are sorted by `lastInterconnectionAt` descending and include prescription, patient, prescribing doctor, dispensing status, interconnection status, latest error, and receipt code.
