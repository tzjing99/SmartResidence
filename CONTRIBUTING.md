# Contributing to SmartResidence

Thanks for considering a contribution. SmartResidence exists because we
believe condo residents deserve software that respects them. Your help —
code, translations, design feedback, bug reports — makes that real.

## Ways to help

| Kind                 | How                                                        |
| -------------------- | ---------------------------------------------------------- |
| Report a bug         | Open an issue using the **Bug report** template            |
| Request a feature    | Open an issue using the **Feature request** template       |
| Submit a translation | Edit files under `apps/*/src/i18n/locales/`                |
| Improve docs         | Edit files under `docs/`                                   |
| Fix a bug / build it | Pick a `good first issue` and open a PR                    |
| Larger changes       | Open an RFC under `docs/rfcs/` first                       |

## Development setup

See the **Quick start** in [`README.md`](./README.md). You will need Node 22,
pnpm 9, and Docker.

```bash
pnpm install
pnpm infra:up
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Branch naming

- `feat/<scope>-<short-description>`
- `fix/<scope>-<short-description>`
- `docs/<scope>-<short-description>`
- `chore/<short-description>`

Scopes match top-level folders: `api`, `web`, `mobile`, `ui-web`, `ui-mobile`,
`shared-types`, `api-client`, `infra`, `docs`.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/).
Examples:

```
feat(api): add visitor pre-registration endpoint
fix(web): correct invoice formula display in zh-Hans
docs(rfcs): RFC-0007 facility booking
```

The release tooling (Changesets + semantic-release) reads these to compute
versions and changelogs automatically.

## Pull request checklist

Before requesting review:

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] You added/updated tests for new behavior
- [ ] You updated docs / translations / OpenAPI spec if the change is
      user-facing
- [ ] You added a Changeset entry: `pnpm changeset`

## Code style

Biome enforces formatting and linting. Run `pnpm format` before committing.
TypeScript everywhere — no plain `.js` outside config files.

## Translations

Locales live in `apps/web/src/i18n/locales/{en,ms,zh-Hans}/` and the mirror
folder in `apps/mobile`. English is canonical. To add a new language, copy
the `en/` folder, translate the values (keys must stay English), and open a
PR.

## Reporting security issues

Please **do not** open a public issue for security reports. Use GitHub's
private vulnerability reporting at
https://github.com/tzjing99/SmartResidence/security/advisories/new instead.
See [`SECURITY.md`](./SECURITY.md).

## Code of Conduct

By participating you agree to abide by the
[Code of Conduct](./CODE_OF_CONDUCT.md).
