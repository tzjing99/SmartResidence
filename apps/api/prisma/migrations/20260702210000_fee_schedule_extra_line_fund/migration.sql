-- Require ledger fund on fee schedule extra lines so recurring charges land in
-- the correct maintenance or sinking fund (not General).

ALTER TABLE "fee_schedule_extra_lines"
  ADD COLUMN IF NOT EXISTS "fund" "LedgerFund";

-- Infer fund from category where possible; default remaining rows to maintenance.
UPDATE "fee_schedule_extra_lines"
SET "fund" = CASE
  WHEN "category" IN ('FIRE_INSURANCE', 'SPECIAL_LEVY') THEN 'SINKING_FUND'::"LedgerFund"
  WHEN "category" = 'OTHER' AND UPPER("code") LIKE '%SINK%' THEN 'SINKING_FUND'::"LedgerFund"
  ELSE 'MAINTENANCE'::"LedgerFund"
END
WHERE "fund" IS NULL;

ALTER TABLE "fee_schedule_extra_lines"
  ALTER COLUMN "fund" SET NOT NULL;

-- Record backfill in row metadata for audit trail.
UPDATE "fee_schedule_extra_lines"
SET "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object(
  'fundBackfillAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'fundBackfillNote', 'Inferred fund from category during migration; default MAINTENANCE when unknown'
);

-- One audit log per condo summarising the backfill.
INSERT INTO "audit_logs" ("id", "condoId", "action", "resourceType", "resourceId", "metadata", "createdAt")
SELECT
  gen_random_uuid(),
  "condoId",
  'UPDATE'::"AuditAction",
  'FeeScheduleExtraLine',
  NULL,
  jsonb_build_object(
    'note', 'Backfilled fund on fee schedule extra lines for Strata Act fund separation',
    'defaultFund', 'MAINTENANCE',
    'inferredFrom', 'category'
  ),
  NOW()
FROM (
  SELECT DISTINCT "condoId" FROM "fee_schedule_extra_lines"
) AS condos
ON CONFLICT DO NOTHING;
