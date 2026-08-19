# QA documentation

Documentation for the Fretline test framework. Written the way a QA engineer documents a system
they were handed: what could go wrong, what is verified, what is deliberately not, and why each
decision cost what it cost.

| Document | What it answers |
| --- | --- |
| [Test strategy](test-strategy.md) | Why the suite is shaped this way — risk analysis, layering, data policy, how instability is handled |
| [Test plan](test-plan.md) | What runs, where, when, and what it costs |
| [Requirements](requirements.md) | The 139 `REQ-*` the suite is written against |
| [Test cases](test-cases/) | 185 cases — generated catalogue plus six journeys written out in full |
| [Traceability matrix](traceability-matrix.md) | Requirement ↔ test case, both ways — **generated**, verified in CI |
| [Bug reports](bug-reports/) | The three seeded defects, with real reproduction data |
| [Architecture decisions](adr/) | Five ADRs, including one fix that was wrong and one decision later overturned |
| [API specification](api/openapi.json) | OpenAPI 3.1, **generated** from the contract schemas the API suite validates — verified in CI |
| [Deployment](deployment.md) | Running it for real — Docker Compose, backups, and the post-deployment check that is not decoration |

## Where to start

**Assessing the framework?** [Test strategy](test-strategy.md), then
[ADR-003](adr/003-hydration-readiness.md) — it records a real diagnosis, an insufficient fix, and
the reasoning that led to the right one.

**Looking for coverage?** [Traceability matrix](traceability-matrix.md) — 139 requirements, 185
test cases, zero untraced, and both directions checked.

**Wondering whether any of it catches anything?** [Bug reports](bug-reports/). Three defects sit
behind a flag, and a CI job fails if the suite stops detecting them.

## What is generated and what is not

`traceability-matrix.md` and `test-cases/test-cases.csv` are derived from the `testCase()` and
`covers()` annotations the specs carry. `npm run trace:check -w e2e` fails CI when the committed
copies no longer match the code.

Everything else is written by hand, and deliberately so: a strategy nobody wrote is a strategy
nobody thought about.
