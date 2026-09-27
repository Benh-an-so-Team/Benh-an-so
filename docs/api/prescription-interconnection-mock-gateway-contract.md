# Prescription Interconnection Mock Gateway Contract

> Module: **NCL-12 — Electronic prescription and national interconnection**
>
> User Story: **NCL-12-CN-004 — Send prescriptions to the mock interconnection system**
>
> Status: **Approved mock-gateway contract for backend implementation**

## Scope

This contract defines the boundary between Benh So An and the mock
interconnection gateway. It is deliberately not a specification for a real
national integration.

The clinic application sends a completed, non-cancelled prescription which
already has its immutable `prescriptionCode`. The gateway accepts the request
once, returns a receipt, and makes retries idempotent.

## Endpoint

```
POST http://localhost:8081/api/v1/mock-interconnection/v1/prescriptions
Content-Type: application/json
X-Idempotency-Key: {prescriptionCode}
```

`X-Idempotency-Key` is mandatory and must be exactly equal to the request body
field `prescriptionCode`.

No real credentials are defined for the mock gateway. Authentication for a
real gateway is explicitly out of scope.

The endpoint is disabled by default. For a standalone demo, start a second
application process with `SERVER_PORT=8081` and
`INTERCONNECTION_MOCK_GATEWAY_ENABLED=true`.

## Request body

```json
{
  "prescriptionCode": "RX000123",
  "prescribedAt": "2026-08-21T10:30:00Z",
  "clinic": {
    "id": "1",
    "name": "Phong kham Benh So An",
    "address": "Thai Nguyen",
    "phone": "0345678910"
  },
  "doctor": {
    "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
    "name": "Dr. Nguyen Minh Anh"
  },
  "patient": {
    "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "code": "BN000123",
    "name": "Tran Van B"
  },
  "items": [
    {
      "medicineId": "16000000-0000-0000-0000-000000000001",
      "medicineName": "Paracetamol 500 mg",
      "activeIngredient": "Paracetamol",
      "strength": "500 mg",
      "unit": "vien",
      "dosage": "1 vien",
      "frequencyPerDay": 3,
      "route": "ORAL",
      "durationDays": 3,
      "quantity": 9,
      "instructions": "Uong sau an"
    }
  ],
  "replacesPrescriptionCode": null
}
```

`replacesPrescriptionCode` is optional and defaults to `null` for an ordinary
submission, so the NCL-12-CN-004 payload is unchanged. When it is supplied the
submission is a replacement (NCL-12-CN-008) and the gateway additionally marks the
named prescription as cancelled, because that prescription is no longer the
effective one. It must match `RX` followed by at least six digits and must differ
from `prescriptionCode`.

### Required request fields

| Field | Rules |
|---|---|
| `prescriptionCode` | Required, matches `RX` followed by at least six digits. |
| `prescribedAt` | Required ISO-8601 instant. |
| `clinic.id`, `clinic.name` | Required. `id` is the string form of the clinic configuration singleton ID. |
| `doctor.id`, `doctor.name` | Required. |
| `patient.id`, `patient.code`, `patient.name` | Required. |
| `items` | Required and contains at least one item. |
| Per item | All fields except `instructions` are required; `frequencyPerDay`, `durationDays`, and `quantity` are positive integers. |
| `route` | One of the existing `AdministrationRoute` enum values. |

`address`, `phone`, and `instructions` may be `null`; all other fields are
snapshots from the prescription at submission time.

## Successful responses

### First accepted submission — `201 Created`

```json
{
  "receiptCode": "LT-20260821-000123",
  "status": "ACCEPTED",
  "receivedAt": "2026-08-21T10:30:02Z"
}
```

### Idempotent retry — `200 OK`

If the gateway has already accepted the same `X-Idempotency-Key` with an
identical request body, it must not create another received prescription. It
returns the receipt from the first submission with the same response shape.

## Error responses

All error responses use this shape:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "prescriptionCode is required"
}
```

| HTTP status | `code` | Meaning |
|---|---|---|
| `400` | `VALIDATION_FAILED` | Request is missing or contains invalid data. |
| `400` | `IDEMPOTENCY_KEY_MISMATCH` | Header key differs from `prescriptionCode`. |
| `409` | `IDEMPOTENCY_KEY_REUSED` | Key was accepted before with a different request body. |
| `409` | `PRESCRIPTION_CANCELLED` | The submitted `prescriptionCode` was cancelled because a replacement superseded it (NCL-12-CN-008). |
| `500` | `MOCK_GATEWAY_ERROR` | Deliberate mock-gateway failure. |

A cancelled prescription is refused **after** the idempotency lookup, so an
idempotent replay of a previously accepted submission still returns its original
receipt. The cancellation is only recorded when a replacement submission is
actually accepted, so a failing gateway never cancels anything: `VALIDATION_ERROR`,
`SERVER_ERROR` and `NO_RESPONSE` all throw before the cancellation is stored.

A connection timeout or unavailable gateway does not have an HTTP response;
the clinic application records it as an interconnection failure and may retry.
`NO_RESPONSE` mode delays its response for the configured duration and then
returns `504`; a client with a shorter timeout observes it as a timeout.

## Gateway behavior required for later phases

1. Persist or retain accepted idempotency keys and their receipt response.
2. Generate one unique `receiptCode` for each first accepted key.
3. Provide deterministic test modes for accepted, validation error, server
   error, and no-response/timeout behavior.
4. Never mutate the received prescription for an idempotent retry.

## Out of scope

- A real Ministry of Health endpoint, credentials, certificates, or legal
  payload format.
- The clinic's interconnection status/history persistence and retry API; those
  belong to the following implementation phases.
- Frontend display and retry controls.
