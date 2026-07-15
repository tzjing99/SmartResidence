# SmartResidence documentation

This directory contains the maintainer, operator, product, and engineering
documentation for SmartResidence. The published Docusaurus site lives in
[`apps/docs`](../apps/docs).

## Start here

| Document | Purpose |
| --- | --- |
| [`HANDOFF.md`](./HANDOFF.md) | Current project state, known gaps, and continuation notes |
| [`ROADMAP.md`](./ROADMAP.md) | Product direction and shipped/deferred scope |
| [`BACKLOG.md`](./BACKLOG.md) | Engineering and product backlog |
| [`SELF_HOSTING.md`](./SELF_HOSTING.md) | Local Docker trial and self-hosting guide |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Internet-facing deployment considerations |
| [`LOCAL_CI.md`](./LOCAL_CI.md) | Local verification equivalent to hosted CI |
| [`testing.md`](./testing.md) | Test strategy and suite organization |
| [`BUSINESS_MODEL.md`](./BUSINESS_MODEL.md) | Product positioning and business model |

## Architecture and decisions

Larger architectural changes should begin as an RFC under
[`rfcs/`](./rfcs/). Keep accepted RFCs as durable decision records rather than
embedding architectural decisions in temporary release notes.

## Historical documents

Time-bound release plans and incident-era runbooks are retained under
[`archive/`](./archive/) for context. They are not current operating
instructions. Prefer the active documents listed above.

## Documentation ownership

- Update `README.md` when installation or the repository layout changes.
- Update `SELF_HOSTING.md` and `deploy/README.md` together when Compose changes.
- Keep `apps/docs/docs/` aligned with the canonical guides in this directory.
- Move completed time-bound plans to `archive/<year>-<month>/`.
