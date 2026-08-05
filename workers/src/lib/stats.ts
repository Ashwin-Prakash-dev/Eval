/**
 * Replacements for the Python `statistics` functions the scoring engine used. Getting
 * these subtly wrong silently shifts every score and disagreement flag, so each one
 * mirrors CPython's semantics exactly.
 */

/** statistics.fmean — the arithmetic mean as a float. */
export function fmean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * statistics.pstdev — POPULATION standard deviation (divides by N), not the sample
 * version (N-1). Using the sample formula would inflate every std_dev and over-trigger
 * the disagreement threshold.
 */
export function pstdev(values: number[]): number {
  const mean = fmean(values);
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Python's round() — banker's rounding (ties to even) applied to the EXACT binary value
 * of the double.
 *
 * Multiplying by a power of ten first does not work: `2.675 * 100` rounds up to exactly
 * 267.5 in binary, so a tie test would fire and return 2.68, where Python returns 2.67
 * because the stored double is really 2.67499999999999982. So the value is expanded to
 * its decimal digits first and the decision is made on those digits, with a true tie
 * (a 5 followed by nothing but zeros) resolved to the even neighbour.
 */
export function pyRound(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value;

  const expansion = Math.min(digits + 25, 100);
  const text = value.toFixed(expansion);
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const [intPart = "0", fracPart = ""] = body.split(".");

  const keep = fracPart.slice(0, digits).padEnd(digits, "0");
  const rest = fracPart.slice(digits);

  let scaled = BigInt(intPart + keep);
  const isTie = /^50*$/.test(rest);
  const roundUp = isTie ? scaled % 2n !== 0n : rest !== "" && rest[0]! >= "5";
  if (roundUp) scaled += 1n;

  const result = Number(scaled) / 10 ** digits;
  return negative ? -result : result;
}
