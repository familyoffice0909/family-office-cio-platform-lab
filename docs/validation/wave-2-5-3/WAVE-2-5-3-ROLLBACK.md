# Wave 2.5.3-B — Rollback Plan

## Trigger Conditions
Rollback if trend classifications conflict with deltas, unchanged inputs create repeated material events, duplicate history rows appear, or orchestration fails after decision support.

## Git Rollback
```bash
git switch main
git pull origin main
git switch -c rollback/wave-2-5-3-a
git revert <WAVE_2_5_3_A_MERGE_COMMIT_SHA>
git push -u origin rollback/wave-2-5-3-a
```

After merging the rollback:
```bash
git switch main
git pull origin main
clasp push --force
```

Run:
```javascript
foRunAutonomousCioOrchestrator()
```

## Expected Baseline
```text
QQC / TFSA
Recommendation: WATCH
Conviction: 61
Risk: 38
Confidence: 45
Trend: STABLE
Materiality: 0
Action: REFRESH DATA
Price Freshness: STALE
```
