# ADR-004 — Visual baselines belong to the CI container

**Status**: Accepted · **Date**: 2026-08 · **Scope**: test suite

## Context

The ten visual baselines were captured on a development workstation. Every one of them failed on
the first real CI run, at around 6% of pixels differing.

The diff images were unambiguous: only text, every word shifted a few pixels by accumulation. No
layout change, no colour change, no regression. Font metrics differ between distributions, so the
same string renders at a slightly different width in the Ubuntu-based Playwright container than on
Debian.

Options:

1. **Raise `maxDiffPixelRatio`** until the difference is absorbed. Requires a tolerance around 7%,
   which is more than enough to hide a component that lost its border, changed background, or
   shifted a whole column. This trades a real capability for a green tick.
2. **Store one baseline per platform.** Doubles the images and makes local and CI baselines drift
   apart independently — two sources of truth, one of which is never checked.
3. **Make the CI container the reference environment**, since it is the one that gates merges.

## Decision

Option 3. Baselines are captured in `mcr.microsoft.com/playwright:<version>-noble`, on Chromium
only, and regenerated through a dedicated `workflow_dispatch` workflow that runs in that image and
commits the result.

Supporting choices that make this workable:

- **Product images are generated SVGs with no text.** Any text in an image would rasterise through
  the same font machinery and reintroduce the problem inside the picture.
- **`snapshotPathTemplate` pins the platform name**, so a macOS capture can never be silently
  compared against a Linux one.
- **`maxDiffPixelRatio` stays at 0.01**, which covers anti-aliasing and nothing else.
- **The regenerated PNGs are also published as an artifact**, so the diff can be reviewed before
  it is accepted. A baseline approved without being looked at turns visual regression into
  paperwork.

## Consequences

**Good.** The tolerance stays tight enough to catch a real regression. There is exactly one
baseline per component and one environment that produces it.

**Bad, and documented in three places because it surprises people.** `npm run test:visual` fails
on a workstation. That is expected, not a broken setup — it is stated in `CLAUDE.md`, in the
Playwright config next to the project definition, and in the README. Updating a baseline means
dispatching a workflow rather than passing `--update-snapshots` locally, which is slower and is
the price of the tolerance staying meaningful.

**Not attempted.** Running the container locally would remove the friction entirely, and is the
right answer on a machine with Docker. This one does not have it, which is why the workflow exists.
