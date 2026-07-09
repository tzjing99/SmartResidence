-- Gate-verifiable access codes for approved renovation (and similar) form permits.

ALTER TABLE "form_submissions"
  ADD COLUMN "accessCode" TEXT,
  ADD COLUMN "qrPayload" TEXT,
  ADD COLUMN "permitValidFrom" TIMESTAMP(3),
  ADD COLUMN "permitValidUntil" TIMESTAMP(3);

CREATE UNIQUE INDEX "form_submissions_condoId_accessCode_key"
  ON "form_submissions"("condoId", "accessCode");

CREATE UNIQUE INDEX "form_submissions_qrPayload_key"
  ON "form_submissions"("qrPayload");

CREATE INDEX "form_submissions_condoId_accessCode_idx"
  ON "form_submissions"("condoId", "accessCode");
