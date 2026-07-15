# Production Dependency Baseline

The code-owned manifest in `ArchitectureFreeze.js` is the authoritative
worksheet-level lineage for A2.1.6.

## Primary production flow

```text
TFSA Holdings / LIRA Holdings / Interactive Brokers
                         ↓
                  Portfolio Master
                         ↓
Market Symbol Registry → Market Data Cache
                         ↓
                   Portfolio State
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
     Valuation       Exposure       Snapshot
          ↓              ↓              ↓
    Performance   Sector/Country/  Market Intelligence
                    Currency             ↓
                    Exposure     Buy Zone Intelligence
                                         ↓
                              Investment Decision Support
                                         ↓
                              Capital Deployment Priorities
                                         ↓
                                  Executive Report
                                         ↓
                                Executive Dashboard
```

## Risk flow

```text
Portfolio Master + Portfolio Attribution
              ↓
          Position Risk
              ↓
          Portfolio Risk
       ↙       ↓        ↘
Risk Limits  Stress   Exposure
              ↓
        Risk Dashboard
              ↓
         Risk History
```

## Governance overlay

Platform Health, Data Validation, autonomous run/step logs, Portfolio Risk
Validation and Production Certification govern the production flow.
