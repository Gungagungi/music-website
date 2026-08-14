import { faker } from '@faker-js/faker';

/**
 * Identifier generation for parallel-safe test data.
 *
 * Playwright runs specs across several worker processes; two workers
 * registering `test@example.com` at the same time is the classic way a suite
 * becomes flaky at exactly the moment you speed it up. Every generated
 * identifier therefore carries the worker index and a timestamp.
 */

function workerIndex(): string {
  return process.env.TEST_WORKER_INDEX ?? '0';
}

export function uniqueEmail(prefix = 'qa'): string {
  return `${prefix}+w${workerIndex()}-${Date.now()}-${faker.string.alphanumeric(5).toLowerCase()}@fretline.test`;
}

export function uniqueSuffix(): string {
  return `w${workerIndex()}-${Date.now()}`;
}

/** Meets the app's rules: 8+ characters, at least one letter and one digit. */
export function validPassword(): string {
  return `Qa${faker.string.alphanumeric(6)}9!`;
}
