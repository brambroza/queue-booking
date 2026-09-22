/** Numbers per letter before rolling to the next one (A001–A999 → B001). */
const NUMBERS_PER_LETTER = 999;
const LETTERS = 26;

/**
 * Formats the Nth booking of a (shop, branch, day) as a queue number.
 *
 * Mirror of the Postgres `format_queue_number()` in migration
 * `202609220001_queue_number_sequence.sql` — the database trigger is what
 * actually issues numbers on insert; this copy exists so the rollover rule is
 * documented and unit-tested in TS. Keep both in sync.
 *
 * 1 → `A001`, 999 → `A999`, 1000 → `B001`, … 25974 → `Z999`. Past that the
 * letter stays `Z` and the number keeps growing so it remains unique.
 */
export function formatQueueNumber(ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1) {
    throw new RangeError(`queue ordinal must be a positive integer, got ${ordinal}`);
  }
  const letterIndex = Math.floor((ordinal - 1) / NUMBERS_PER_LETTER);
  if (letterIndex >= LETTERS) {
    return `Z${ordinal - (LETTERS - 1) * NUMBERS_PER_LETTER}`;
  }
  const letter = String.fromCharCode(65 + letterIndex);
  const number = ((ordinal - 1) % NUMBERS_PER_LETTER) + 1;
  return `${letter}${String(number).padStart(3, '0')}`;
}
