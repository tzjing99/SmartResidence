# Malaysian strata compliance (Strata Management Act 2013 + MyInvois)

SmartResidence is built for **Joint Management Bodies (JMB)** and management corporations operating under Malaysia’s **Strata Management Act 2013 (SMA 2013)**. This guide explains how fund separation, governance, record-keeping, and e-invoicing work in the product — not just where fields live in the schema.

## Separate maintenance vs sinking fund

Under SMA 2013, maintenance charges and sinking fund contributions must be **accounted for separately**. SmartResidence maps ledger funds as follows:

| Ledger fund | Plain English | Legal / operational role |
|-------------|---------------|---------------------------|
| `MAINTENANCE` | Maintenance account | Day-to-day operating expenses, routine repairs, management costs |
| `SINKING_FUND` | Sinking fund | Capital replacements (lift, roof, repainting, major works) |
| `DEPOSIT` | Deposits held | Renovation, access-card, delivery deposits — **not** operating cash |
| `GENERAL` | General | Ad-hoc charges that do not fit MAINT/SINK (use sparingly; auditors prefer explicit codes) |

### How charges land in the correct fund

1. **Fee schedule (unit type rates)** — `FeeScheduleService.computeLinesForUnit` emits:
   - `MAINT` → maintenance account
   - `SINKING` → sinking fund
2. **Extra schedule lines** (fire insurance, quit rent, assessment, etc.) — fund is inferred from line **code** via `LedgerService.fundOfCode`:
   - Codes containing `SINK` → sinking fund
   - Codes containing `MAINT` → maintenance account
   - Otherwise → general
3. **Manual invoice lines** — same code rules apply when invoices are issued.
4. **Payments** — allocated **proportionally** across funds based on the invoice line mix (`LedgerService.recordPaymentAllocation`).

Deposits recorded through **Deposits** always post to `DEPOSIT`, never to maintenance or sinking ledgers.

### Reports that prove separation

- **Accounting → fund balance cards** — current cash position per fund (charges excluded from cash; collections counted).
- **`GET /api/billing/reports/condo/:condoId/fund-summary`** — opening/closing balance, collections, charges issued, adjustments per fund for a date range.
- **`GET /api/billing/reports/condo/:condoId/income-expense`** — charges vs collections by fund and invoice line category.
- **Fund summary PDF** — `/api/billing/condo/:condoId/exports/fund-summary.pdf`
- **Audit trail CSV** — `/api/billing/reports/condo/:condoId/audit-trail.csv` (idempotency keys + void reversal links)

Automated tests in `ledger.service.spec.ts` and `financial-reports.spec.ts` assert that maintenance, sinking, and deposit balances never commingle in report math.

## Unit share / apportionment

Polls and governance resolutions weight votes by **ownership share**:

- Each active `Ownership` row carries `sharePercent` (0–100).
- Poll votes and AGM resolution ballots use this weight so results reflect legal share, not one-vote-per-login.

Configure share when assigning owners to units (**Admin → Units**). For mixed commercial/residential schemes, ensure share matches the strata schedule of parcels filed with COB.

## AGM financial presentation

For Annual General Meetings, treasurers typically present:

1. **Fund summary** (maintenance + sinking opening/closing) — Accounting dashboard or fund summary PDF.
2. **Collections vs charges** — income/expense report for the financial year.
3. **Arrears aging** — outstanding by 0–30 / 31–60 / 61–90 / 90+ days.
4. **Receipt register** — official receipt trail (Accounting → Receipt register).

Link governance workflows:

- **Admin → Governance** — schedule AGM/EGM, publish notice, record proxies.
- Attach exported PDFs/CSVs to the meeting record or document vault as supporting papers.

## Commissioner of Buildings (COB) record-keeping

COB expects JMBs to retain:

- Minutes of general meetings
- Audited or management accounts showing **separate** maintenance and sinking balances
- Register of proprietors and contribution schedules
- Contracts, insurance, and bank statements (stored outside SmartResidence or in **Documents**)

SmartResidence supports COB-ready exports:

| Need | Where |
|------|--------|
| Pre-filled COB form pack (annual return, financial summary, minutes cover, insurance register) | **Admin → COB forms** (`/admin/compliance/cob`) — `GET /api/cob/condo/:condoId/templates` |
| Ledger audit trail with user + timestamp | Audit trail CSV |
| Idempotent, non-duplicated postings | `idempotencyKey` on every automated ledger write |
| Void / reversal trace | Void adjustments link to original charge keys |
| Receipt trail | Receipt register + PDF downloads |
| Unit statements | Per-unit statement PDF/CSV |

COB form PDFs pre-fill from condo settings (name, address, registration no.), block/unit counts, management admin role holders, and latest fund balances. They are **filing aids only** — not legal advice. Verify all entries before submitting to your local Commissioner of Buildings office.

Retention policy (how long you keep exports) remains the JMB’s responsibility; export monthly and store in your document vault.

## MyInvois e-invoicing (LHDN)

SmartResidence integrates **LHDN MyInvois** for compliant e-invoices.

### Sandbox vs production

| Environment | When used | Behaviour |
|-------------|-----------|-----------|
| **SANDBOX** | Default; Settings → E-invoice → Sandbox | Local validation only — **no live LHDN HTTP**. Returns deterministic UUID + verification URL on `preprod.myinvois.hasil.gov.my`. |
| **PRODUCTION** | Sandbox off + valid API client id/secret | Live OAuth2 + document API via `ProductionMyInvoisProvider`. |
| **PRODUCTION without credentials** | Misconfiguration guard | Falls back to sandbox adapter with a logged warning — prevents silent live submissions. |

Configuration: **Admin → Settings → E-invoice**.

### When invoices are submitted

1. **Manual** — Admin opens an invoice → **Submit to MyInvois** (requires issued invoice with buyer details).
2. **Auto-submit on issue** — When enabled in e-invoice settings, submission is queued as the invoice moves to **Issued** (`EInvoiceService` async job).
3. **Validation** — Document builder checks required fields (buyer TIN/name, line totals, etc.) before any provider call.

### Verification URLs

After successful validation/submission:

- **Sandbox:** `https://preprod.myinvois.hasil.gov.my/{uuid}/share/{longId}`
- **Production:** `https://myinvois.hasil.gov.my/{uuid}/share/{longId}`

Residents and auditors can scan the QR / open the URL on the LHDN portal. Invoice detail in SmartResidence shows status (`VALID`, `INVALID`, cancelled) and the link when available.

### Operational checklist for treasurers

1. Complete **E-invoice settings** (TIN, MSIC, sandbox test first).
2. Issue monthly invoices (manual or automation — see [billing automation](./automation.md)).
3. Submit or confirm auto-submit; fix `INVALID` rows before AGM pack.
4. Export fund summary + audit trail for the financial year.

## Related UI

- **Admin → Accounting** — fund dashboards, exports, compliance note
- **Admin → COB forms** — pre-filled Commissioner of Buildings PDF templates
- **Admin → Settings → Billing** — fee rates (MAINT/SINK separation), auditor note
- **Admin → Invoices → Automatic invoice generation** — monthly cycle
- **Admin → Settings → E-invoice** — MyInvois environment and credentials

## Gaps vs enterprise strata suites (honest)

SmartResidence does **not** yet replace a full chartered-accountant GL (no double-entry chart of accounts, bank reconciliation worksheet, or audited FS template). HashMicro/i-Neighbour may offer deeper native MY payroll, vendor PO, or facility asset depreciation — evaluate those if required. Our focus is **strata-native** billing, fund separation, MyInvois seam, and AGM-ready exports.
