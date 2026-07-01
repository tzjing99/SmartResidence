-- Wave 1 performance indexes (query paths from audit; no behavior change)

-- CreateIndex
CREATE INDEX "invoices_unitId_periodStart_status_idx" ON "invoices"("unitId", "periodStart", "status");

-- CreateIndex
CREATE INDEX "invoices_condoId_status_dueDate_idx" ON "invoices"("condoId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "visitor_check_ins_checkInAt_idx" ON "visitor_check_ins"("checkInAt");

-- CreateIndex
CREATE INDEX "visitors_condoId_overnight_status_idx" ON "visitors"("condoId", "overnight", "status");
