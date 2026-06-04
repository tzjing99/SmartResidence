# Changesets

This folder is used by [Changesets](https://github.com/changesets/changesets)
to track which packages need a version bump on the next release.

## Adding a changeset

```bash
pnpm changeset
```

Pick the affected packages, choose `patch`/`minor`/`major`, write a one-line
summary that will end up in `CHANGELOG.md`. Commit the generated file in your
PR. CI will refuse to merge a feature PR that doesn't include a changeset
(except for docs-only or chore-only changes).

## Releases

`main` → automatic alpha tags via `release.yml`. Tags like `v0.1.0` trigger a
production release: Docker images to GHCR, npm publish for shared packages,
GitHub Release notes.
