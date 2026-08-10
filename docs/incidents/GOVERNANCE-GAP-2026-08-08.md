# GOVERNANCE-GAP-2026-08-08: Lab/Production Apps Script Separation

## Status
Identified 2026-08-08. Reconciliation in progress — PR #76 open, not merged.

## Finding
The live Apps Script project (scriptId 17C0pZ...) is confirmed running
v3.4.3, byte-identical to release/v3.4.3-production-promotion.
`production/main` (git) was current through v3.4.0 — v3.2.13, v3.3.0,
and v3.4.0 all reached production correctly via the established
`release(vX.Y.Z): import certified <lab-commit>` PR pattern.

**The gap is v3.4.1 through v3.4.3 (3 releases, 7 files)** — these
reached the live script without a corresponding recorded promotion
through that same pattern.

## Root Cause
The documented promotion process (release branch → PR → `production/main`
import commit → tag → Production Operator deployment) worked correctly
for at least three consecutive releases (v3.2.13, v3.3.0, v3.4.0). It
was not followed for v3.4.1 through v3.4.3 — those changes reached the
live Apps Script project by a different, unrecorded path.

This is possible because of a structural gap the working process was
relying on discipline, not tooling, to cover: the Lab repo's `.clasp.json`
targets the same scriptId as the live/production Apps Script project.
There is one Apps Script project, not two. `RELEASE_CHECKLIST.md`'s
"Production credentials... are separate from Lab" and "deployed only to
the designated Lab Apps Script project" describe a separation that does
not exist in current tooling. Any `clasp push` from the Lab repo —
including ordinary development iteration — is technically capable of
deploying directly to what is treated as production. The documented
process held for three releases on discipline alone, then didn't.

## Impact
- No recorded approver, timestamp, or promotion mechanism exists for
  v3.4.1 through v3.4.3 reaching the live script.
- `production/main` did not reflect the live deployment's actual state
  between whenever v3.4.1 was pushed live and 2026-08-08.
- [Owner to complete: timeline of when v3.4.1-v3.4.3 were actually
  pushed live, if recoverable from local clasp history / machine logs,
  and confirmation of who had push access during that window.]

## Reconciliation (in progress)
- [x] Confirmed live script matches release/v3.4.3-production-promotion
  byte-for-byte (2026-08-08).
- [x] Built import commit (976e949) replicating the established
  `release(vX.Y.Z): import certified <lab-commit>` pattern — full tree
  replacement from lab commit fefce24, on top of production/main's true
  tip (6e683f2).
- [x] Opened PR #76 against production/main, documenting retroactive
  scope and evidence. Not merged.
- [ ] PR #76 reviewed and merged by [owner/approver].
- [ ] Tag v3.4.3 on production/main post-merge, release notes noting
  retroactive/non-standard promotion timing for v3.4.1-v3.4.3.
- [ ] Post-merge validation per RELEASE_CHECKLIST.md's "Before production
  Apps Script deployment" and "Production deployment and validation"
  sections — noting deployment itself already happened; this validates
  retroactively rather than gating a new deployment.

## Proposed Safeguard (requires owner decision)
Options, not mutually exclusive:
1. **Separate Apps Script projects.** Create a distinct Lab scriptId,
   repoint the Lab repo's `.clasp.json` at it. Live/production scriptId
   only ever receives pushes from a Production Operator, from
   `production/main`, per existing checklist intent — now technically
   enforceable rather than discipline-dependent.
2. **Credential separation.** Restrict which Google account/OAuth token
   has push rights to the production scriptId, independent of #1.
3. **Pre-push guard.** A local git hook or clasp wrapper that checks
   current branch/repo before allowing `clasp push`, refusing on
   develop/feature branches. Weaker than #1 — advisory, not structural —
   but low-effort and could be added alongside #1, not instead of it.

Recommendation: #1 is the only option that removes reliance on discipline
entirely. The process worked correctly three times before it didn't —
that's evidence the checklist and PR pattern are sound, but also evidence
that discipline alone isn't sufficient for a platform at this stage. #3
is worth adding regardless, as a cheap second layer.

## Owner / Approver
[To be assigned]
