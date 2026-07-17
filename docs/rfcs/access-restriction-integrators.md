# Arrears access restriction — integrator guide

SmartResidence owns **billing policy** and **soft blocks** (facility booking, visitor / delivery / recurring passes). Physical barriers (ZKTeco Eco / BioTime, MAG car-park, lift DAC) stay with the site security contractor.

## Export

Management endpoints (Bearer auth + CASL `export` / `manage` on `AccessRestriction`):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/access-restriction/condo/:condoId/export.json` | Active restricted units |
| `GET` | `/api/access-restriction/condo/:condoId/export.csv` | Same, CSV download |

JSON shape:

```json
{
  "condoId": "…",
  "generatedAt": "2026-07-17T00:00:00.000Z",
  "zonesDefault": ["CAR_PARK", "AMENITIES"],
  "units": [
    {
      "unitId": "…",
      "identifier": "A-12-03",
      "block": "A",
      "active": true,
      "source": "AUTO",
      "zones": ["CAR_PARK", "AMENITIES"],
      "outstandingAmount": 350.0,
      "oldestDueDate": "…",
      "activatedAt": "…",
      "reason": "Auto: 21 days past due"
    }
  ]
}
```

Zones are **never** `HOME`. Blocking a resident from their flat door is a site/legal decision outside this API.

## Webhook

Configure under **Admin → Settings → Arrears access**:

- `webhookUrl` + `webhookSecret`
- Enable **Integrator webhook** (`autoSyncEnabled`)

On restrict / clear, SmartResidence POSTs:

```json
{
  "event": "unit.restricted",
  "condoId": "…",
  "occurredAt": "…",
  "unit": { /* same fields as export row */ }
}
```

Headers:

- `content-type: application/json`
- `x-sr-event: unit.restricted | unit.cleared`
- `x-sr-signature: sha256=<hmac-sha256-hex of raw body>` when a secret is set

## Suggested integrator flow

1. Poll CSV/JSON nightly, **or** listen for webhooks.
2. Map `identifier` / `unitId` to cardholders in ZKTeco / MAG.
3. Disable access groups for listed **zones** (car park, amenities, common facilities).
4. Re-enable when the unit disappears from export / `unit.cleared` arrives.

Native ZKTeco / MAG drivers are intentionally out of scope for v1.
