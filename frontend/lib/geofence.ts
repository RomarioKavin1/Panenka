/**
 * geofence.ts — Per-request jurisdiction posture resolver.
 *
 * Mirrors `docs/compliance/risk-jurisdictions.md`. When that document changes,
 * update both the matrix and the sets here in the same PR.
 */

export type Posture = "allow" | "kyc" | "block";

export interface JurisdictionPosture {
  free: Posture;
  paid: Posture;
}

/** US states where paid DFS is restricted or prohibited. */
const BLOCK_PAID_STATES = new Set([
  "US-HI",
  "US-ID",
  "US-LA",
  "US-MT",
  "US-NV",
  "US-WA",
]);

/** OFAC / restricted-market full blocks. */
const SANCTIONED = new Set(["KP", "IR", "CU", "SY", "CN"]);

/** Paid contests require KYC in these jurisdictions. */
const KYC_PAID = new Set(["BE", "NO", "SG"]);

/**
 * Resolve the per-request posture for a jurisdiction.
 *
 * @param isoCode  ISO country code OR ISO-3166-2 (e.g. "US-NV"). Case-insensitive.
 */
export function resolvePosture(isoCode: string): JurisdictionPosture {
  const c = isoCode.toUpperCase();
  if (SANCTIONED.has(c)) return { free: "block", paid: "block" };
  if (BLOCK_PAID_STATES.has(c)) return { free: "allow", paid: "block" };
  if (KYC_PAID.has(c)) return { free: "allow", paid: "kyc" };
  return { free: "allow", paid: "allow" };
}
