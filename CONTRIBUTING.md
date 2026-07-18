# Contributing

Start with the [Engineering Guide](docs/engineering/ENGINEERING_GUIDE.md). The canonical workflow, Definition of Done, Pull Request checklist, architecture controls, branching, release process, and AI collaboration rules live under [`docs/engineering/`](docs/engineering/).

## Contributor flow

1. Read the relevant ADRs, wave documents, schemas, tests, and current implementation.
2. Define one scoped wave with acceptance criteria, affected outputs, evidence, and rollback.
3. Create the appropriate short-lived branch from `origin/develop`.
4. Implement the smallest complete change, including tests and owning documentation.
5. Run the checks required by the [Development Workflow](docs/engineering/DEVELOPMENT_WORKFLOW.md).
6. Open a pull request to `develop`, complete the canonical Pull Request checklist, and obtain required approvals.
7. Validate runtime and workbook behavior in the designated Lab when applicable.
8. Treat production promotion as a separate, explicitly approved release process.

## Branching

Use one branch per coherent change. Feature waves retain the established naming convention:

```text
feature/wave-x-y-z-short-description
```

Do not commit directly to `develop`, Lab `main`, or production `main`. See [Branching Strategy](docs/engineering/BRANCHING_STRATEGY.md) for feature, fix, documentation, release, hotfix, and rollback branches.

## Code standards

- Use the `fo` prefix for public platform functions
- Use a trailing underscore for internal helpers
- Keep engines separated from spreadsheet I/O helpers
- Use `foInfo_` and `foError_` for operational logging
- Avoid hidden credentials and environment-specific identifiers
- Preserve idempotency where a function may run repeatedly
- Add a smoke test for material new modules
- Preserve source-of-truth and workbook ownership boundaries
- Treat missing, stale, or invalid data explicitly; never manufacture certainty

## Security

Never commit:

- `.clasprc.json`
- OAuth access or refresh tokens
- `.env` files
- service-account keys
- broker credentials
- personal financial exports

## Pull requests and releases

Use the [Pull Request checklist](docs/engineering/DEVELOPMENT_WORKFLOW.md#pull-request-checklist) for every change. Production candidates also follow the [Release Policy](docs/engineering/RELEASE_POLICY.md) and canonical [Release Checklist](docs/RELEASE_CHECKLIST.md).
