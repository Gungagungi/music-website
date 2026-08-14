/**
 * Test tags and traceability.
 *
 * Tags drive what CI runs: `@smoke` gates every push on three browsers,
 * `@regression` runs the full sweep nightly. `@known-bug` marks the specs that
 * only fail when the app is started with SEED_BUGS=1, so they can be excluded
 * from the green pipeline and run on purpose in a dedicated job.
 *
 * The `TC-XXX` annotation is the link back to `docs/test-cases/`. Without it,
 * a documented test case and its automation drift apart within a month and the
 * traceability matrix becomes fiction.
 */

export const TAGS = {
  smoke: '@smoke',
  regression: '@regression',
  critical: '@critical',
  knownBug: '@known-bug',
  security: '@security',
  contract: '@contract',
} as const;

export type Tag = (typeof TAGS)[keyof typeof TAGS];

/** Annotation linking a spec to its documented test case. */
export function testCase(id: `TC-${string}`, description?: string) {
  return { type: 'test-case', description: description ? `${id} — ${description}` : id };
}

/** Annotation linking a spec to a known defect report. */
export function knownBug(id: `BUG-${string}`, summary: string) {
  return { type: 'known-bug', description: `${id} — ${summary}` };
}

/** Annotation naming the requirement a spec covers. */
export function covers(requirementId: `REQ-${string}`) {
  return { type: 'requirement', description: requirementId };
}
