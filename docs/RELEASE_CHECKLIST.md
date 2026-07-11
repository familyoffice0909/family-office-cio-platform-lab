# Release Checklist

## Before pull request approval

- [ ] Scope matches the engineering wave
- [ ] `npm ci` succeeds
- [ ] `npm run validate` passes
- [ ] `npm run lint` passes
- [ ] No secrets or local credentials are committed
- [ ] Relevant Apps Script smoke test completes
- [ ] Expected Google Sheets outputs are validated
- [ ] Existing data is not unintentionally overwritten
- [ ] Changelog is updated
- [ ] Rollback approach is documented

## Before merge to main

- [ ] CI status checks pass
- [ ] Pull request review is complete
- [ ] Branch is up to date with `main`
- [ ] Deployment impact is understood
- [ ] Apps Script authorization or scope changes are documented

## After merge

- [ ] Controlled Apps Script deployment completes
- [ ] Platform health check passes
- [ ] Platform integrity check passes
- [ ] Modular smoke test passes
- [ ] Version and build identifiers are confirmed
- [ ] Executive outputs render correctly
- [ ] Deployment result is recorded
- [ ] Feature branch is deleted

## Release creation

- [ ] Semantic version selected
- [ ] Git tag points to the intended `main` commit
- [ ] Release notes summarize features, fixes, tests, limitations, and rollback
- [ ] `CHANGELOG.md` is updated
- [ ] Release is marked latest only when production validation is complete
