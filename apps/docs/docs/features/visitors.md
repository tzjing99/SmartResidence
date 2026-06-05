---
sidebar_position: 2
title: Visitors
---

# Visitor flows

SmartResidence separates **pre-registration** (resident-initiated, ahead of arrival) from
**walk-in** registration (guard-initiated at the gate).

## Pre-registration

Residents pre-register guests at `/visitors/new` (web) or **Visitors → New** (mobile).

| Setting | Default / rule |
| ------- | -------------- |
| Entry mode | **Drive in** (plate required; walk-in still selectable) |
| Overnight | Optional — management rules, plate photo, unit monthly cap |
| Pass | QR / access code from expected arrival |

Overnight stays apply **only** to pre-registrations when the overnight toggle is on (typically
drive-in with typed plate and photo).

## Walk-in

Guards register unexpected arrivals via the mobile **Walk-in** screen (unit or management office).

| Setting | Rule |
| ------- | ---- |
| Overnight | **Not available** — API rejects `overnight: true` |
| Visit model | **One visit — validated once at the gate** |
| Flow | Security validates at entry → gate opens → owner meets visitor |

Walk-in unit requests wait for owner approval (timeout from condo visitor settings). Management
office walk-ins are logged and checked in immediately.

## Management settings

Condo admins adjust caps, holidays, walk-in timeout, and enforcement toggles at
**Settings → Visitors** (`/admin/settings/visitors`).
