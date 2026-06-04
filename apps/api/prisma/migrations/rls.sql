-- Row-Level Security policies for SmartResidence.
-- Applied via `prisma migrate dev` after the initial schema migration.
--
-- The API sets two GUC session variables on every request:
--
--   SET LOCAL app.current_user_id = '<uuid>';
--   SET LOCAL app.current_condo_id = '<uuid>';   -- nullable
--   SET LOCAL app.current_role = 'UNIT_OWNER';   -- top role for the request
--
-- A separate "service" connection (used for cross-tenant operations like
-- platform admin tooling and background jobs) sets app.current_role = 'SERVICE'
-- which bypasses these policies via the BYPASSRLS attribute on the role.

-- Helper: read current condo id from session, or NULL.
CREATE OR REPLACE FUNCTION app_current_condo_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_condo_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_role() RETURNS text AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_role', true), ''), 'GUEST');
$$ LANGUAGE sql STABLE;

-- Tables that are scoped per-condo.
ALTER TABLE condos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE units              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownerships         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_check_ins  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE defects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE defect_updates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_acks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;

-- Condo isolation: only the active condo (or platform admins) may read.
CREATE POLICY condo_tenant_isolation ON condos
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR id = app_current_condo_id()
  );

CREATE POLICY block_tenant_isolation ON blocks
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR condo_id = app_current_condo_id()
  );

CREATE POLICY unit_tenant_isolation ON units
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR condo_id = app_current_condo_id()
  );

CREATE POLICY ownership_tenant_isolation ON ownerships
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM units u
      WHERE u.id = ownerships.unit_id
        AND u.condo_id = app_current_condo_id()
    )
  );

CREATE POLICY tenancy_tenant_isolation ON tenancies
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM units u
      WHERE u.id = tenancies.unit_id
        AND u.condo_id = app_current_condo_id()
    )
  );

CREATE POLICY household_tenant_isolation ON household_members
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM units u
      WHERE u.id = household_members.unit_id
        AND u.condo_id = app_current_condo_id()
    )
  );

CREATE POLICY role_assignment_tenant_isolation ON role_assignments
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR condo_id = app_current_condo_id()
    OR (condo_id IS NULL AND user_id = app_current_user_id())
  );

CREATE POLICY visitor_tenant_isolation ON visitors
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR condo_id = app_current_condo_id()
  );

CREATE POLICY visitor_checkin_tenant_isolation ON visitor_check_ins
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM visitors v
      WHERE v.id = visitor_check_ins.visitor_id
        AND v.condo_id = app_current_condo_id()
    )
  );

CREATE POLICY invoice_tenant_isolation ON invoices
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR condo_id = app_current_condo_id()
  );

CREATE POLICY invoice_line_tenant_isolation ON invoice_lines
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_lines.invoice_id
        AND i.condo_id = app_current_condo_id()
    )
  );

CREATE POLICY payment_tenant_isolation ON payments
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payments.invoice_id
        AND i.condo_id = app_current_condo_id()
    )
  );

CREATE POLICY defect_tenant_isolation ON defects
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR condo_id = app_current_condo_id()
  );

CREATE POLICY defect_update_tenant_isolation ON defect_updates
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR EXISTS (
      SELECT 1 FROM defects d
      WHERE d.id = defect_updates.defect_id
        AND d.condo_id = app_current_condo_id()
    )
  );

CREATE POLICY attachment_tenant_isolation ON attachments
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR uploaded_by_user_id = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM defects d
      WHERE d.id = attachments.defect_id
        AND d.condo_id = app_current_condo_id()
    )
  );

CREATE POLICY announcement_tenant_isolation ON announcements
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR condo_id = app_current_condo_id()
  );

CREATE POLICY announcement_ack_tenant_isolation ON announcement_acks
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR user_id = app_current_user_id()
    OR EXISTS (
      SELECT 1 FROM announcements a
      WHERE a.id = announcement_acks.announcement_id
        AND a.condo_id = app_current_condo_id()
    )
  );

CREATE POLICY audit_log_tenant_isolation ON audit_logs
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR condo_id = app_current_condo_id()
    OR actor_user_id = app_current_user_id()
  );

-- Allow rows to be inserted/updated only when they belong to the active condo.
-- (Postgres uses USING for SELECT/UPDATE/DELETE, WITH CHECK for INSERT/UPDATE.)
ALTER POLICY visitor_tenant_isolation ON visitors
  USING (
    app_current_role() = 'SUPER_ADMIN'
    OR condo_id = app_current_condo_id()
  );
