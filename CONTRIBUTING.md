# Contributing

## Branching

Create one feature branch per engineering wave:

```text
feature/wave-x-y-z-short-description
```

Do not commit directly to `main`.

## Required delivery flow

1. Update local `main`
2. Create a feature branch
3. Implement one scoped change
4. Run `npm run validate`
5. Run `npm run lint`
6. Run the relevant Apps Script smoke test
7. Push the branch
8. Open a draft pull request
9. Confirm CI passes
10. Review sheet outputs and execution logs
11. Merge to `main`
12. Delete the feature branch
13. Tag and release when appropriate

## Code standards

- Use the `fo` prefix for public platform functions
- Use a trailing underscore for internal helpers
- Keep engines separated from spreadsheet I/O helpers
- Use `foInfo_` and `foError_` for operational logging
- Avoid hidden credentials and environment-specific identifiers
- Preserve idempotency where a function may run repeatedly
- Add a smoke test for material new modules

## Security

Never commit:

- `.clasprc.json`
- OAuth access or refresh tokens
- `.env` files
- service-account keys
- broker credentials
- personal financial exports

## Pull requests

Every pull request should state:

- Scope
- Files changed
- Tests run
- Sheet outputs affected
- Rollback approach
- Known limitations
