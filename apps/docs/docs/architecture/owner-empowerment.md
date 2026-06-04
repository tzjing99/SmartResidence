---
sidebar_position: 3
title: Owner empowerment
---

# Owner empowerment

The reason this project exists is that many existing condo apps treat owners
as data subjects rather than data controllers. SmartResidence is built on the
opposite assumption.

Concretely, a unit owner can always:

- **See every audit event involving their unit** — payments viewed, visitor
  passes generated, defects opened, role changes — at `/activity` on the
  resident portal and `Activity` in the mobile app.
- **See who looked at their data** — the "who viewed me" surface lists every
  staff member who pulled a record tagged with their `unitId`. This includes
  reads, not just writes.
- **Revoke any delegated access immediately** — at `/access` an owner can
  revoke a tenant or contractor with one click. Behind the scenes:
  - The `RoleAssignment.revokedAt` is set
  - All active sessions for that user are killed (`session.revokedAt`)
  - A blocklist entry is pushed to Redis so any in-flight access tokens are
    rejected on the next request
- **Read every fee item with the formula that produced it** — invoice line
  items carry a `formula` field (e.g. `unit_sqft * 0.12`) so owners can audit
  every charge.

These guarantees are not configurable per deployment; they are part of the
data model and the API surface. Forks may choose to disable them, but the
upstream project considers any regression a P0 bug.
