-- Backfill invoice/receipt sequence counters from existing numbers so newly
-- generated records do not collide with seeded or historical documents.

INSERT INTO "billing_number_sequences" (
  "id", "condoId", "kind", "year", "lastNumber", "createdAt", "updatedAt"
)
SELECT
  (substr(md5("condoId"::text || ':INVOICE:' || substring("number" from '^INV-([0-9]{4})-[0-9]+$')), 1, 8) || '-' ||
   substr(md5("condoId"::text || ':INVOICE:' || substring("number" from '^INV-([0-9]{4})-[0-9]+$')), 9, 4) || '-' ||
   substr(md5("condoId"::text || ':INVOICE:' || substring("number" from '^INV-([0-9]{4})-[0-9]+$')), 13, 4) || '-' ||
   substr(md5("condoId"::text || ':INVOICE:' || substring("number" from '^INV-([0-9]{4})-[0-9]+$')), 17, 4) || '-' ||
   substr(md5("condoId"::text || ':INVOICE:' || substring("number" from '^INV-([0-9]{4})-[0-9]+$')), 21, 12))::uuid,
  "condoId",
  'INVOICE',
  substring("number" from '^INV-([0-9]{4})-[0-9]+$')::int,
  max(substring("number" from '([0-9]+)$')::int),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "invoices"
WHERE "number" ~ '^INV-[0-9]{4}-[0-9]+$'
GROUP BY "condoId", substring("number" from '^INV-([0-9]{4})-[0-9]+$')
ON CONFLICT ("condoId", "kind", "year") DO UPDATE
SET "lastNumber" = GREATEST(
  "billing_number_sequences"."lastNumber",
  EXCLUDED."lastNumber"
);

INSERT INTO "billing_number_sequences" (
  "id", "condoId", "kind", "year", "lastNumber", "createdAt", "updatedAt"
)
SELECT
  (substr(md5("condoId"::text || ':RECEIPT:' || substring("number" from '-([0-9]{4})-[0-9]+$')), 1, 8) || '-' ||
   substr(md5("condoId"::text || ':RECEIPT:' || substring("number" from '-([0-9]{4})-[0-9]+$')), 9, 4) || '-' ||
   substr(md5("condoId"::text || ':RECEIPT:' || substring("number" from '-([0-9]{4})-[0-9]+$')), 13, 4) || '-' ||
   substr(md5("condoId"::text || ':RECEIPT:' || substring("number" from '-([0-9]{4})-[0-9]+$')), 17, 4) || '-' ||
   substr(md5("condoId"::text || ':RECEIPT:' || substring("number" from '-([0-9]{4})-[0-9]+$')), 21, 12))::uuid,
  "condoId",
  'RECEIPT',
  substring("number" from '-([0-9]{4})-[0-9]+$')::int,
  max(substring("number" from '([0-9]+)$')::int),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "receipts"
WHERE "number" ~ '-[0-9]{4}-[0-9]+$'
GROUP BY "condoId", substring("number" from '-([0-9]{4})-[0-9]+$')
ON CONFLICT ("condoId", "kind", "year") DO UPDATE
SET "lastNumber" = GREATEST(
  "billing_number_sequences"."lastNumber",
  EXCLUDED."lastNumber"
);
