# Architecture decision records

Six decisions that shaped the framework, recorded with the alternatives that were rejected and
what each one costs. A decision without its trade-off is not a record, it is a preference.

| ADR | Decision | Cost accepted |
| --- | --- | --- |
| [001](001-in-memory-database.md) | In-memory store, resettable in O(1) | No transaction or concurrency semantics to test — **superseded by 005** |
| [002](002-test-data-isolation.md) | Reset once per run; isolate by uniqueness | Finite resources (stock) need explicit top-up |
| [003](003-hydration-readiness.md) | Wait on an explicit readiness signal | A test affordance lives in production code |
| [004](004-visual-baselines.md) | Baselines belong to the CI container | `test:visual` fails on a workstation, by design |
| [005](005-persistent-postgres.md) | PostgreSQL everywhere, suite included | `npm test` now needs Docker |
| [006](006-self-hosted-analytics.md) | Matomo, self-hosted, absent from the suite | A second database engine, and two build-time variables |

ADR-003 also records a fix that was **wrong**, and why. That is deliberate: the failed attempt
explains why the accepted solution is shaped the way it is, and re-deriving it would cost the next
person the same afternoon.

ADR-001 is kept rather than deleted, for a related reason. It is the decision ADR-005 overturns,
and it had already written down the cost that later proved too high — reading the pair is how you
see a trade-off being re-examined instead of a conclusion appearing fully formed.
