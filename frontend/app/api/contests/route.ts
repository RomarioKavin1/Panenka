import type { NextRequest } from "next/server";
import { supabaseAnonServer } from "@/lib/supabase/server";

export interface ContestWithEntrants {
  contestId: string;
  matchday: number;
  entryFee: string;
  rakeBps: number;
  minTier: number;
  pool: string;
  rakeTaken: boolean;
  entrants: number;
}

export interface ContestsResponse {
  contests: ContestWithEntrants[];
}

/**
 * GET /api/contests?matchday=1
 *
 * Returns all contests (optionally filtered by matchday), each with an
 * `entrants` count derived from `contest_entries`.
 *
 * If `matchday` is omitted, all contests are returned.
 * If `matchday` is provided, it must be a non-negative integer.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const matchdayParam = searchParams.get("matchday");

  // Validate matchday if provided
  let matchday: number | null = null;
  if (matchdayParam !== null) {
    if (matchdayParam.trim() === "" || !/^\d+$/.test(matchdayParam.trim())) {
      return Response.json(
        { error: "Invalid query param: matchday must be a non-negative integer" },
        { status: 400 }
      );
    }
    matchday = parseInt(matchdayParam.trim(), 10);
    if (!Number.isFinite(matchday)) {
      return Response.json(
        { error: "Invalid query param: matchday out of range" },
        { status: 400 }
      );
    }
  }

  const db = supabaseAnonServer();

  // Query contests (filtered by matchday if provided)
  let contestsQuery = db
    .from("contests")
    .select(
      "contest_id, matchday, entry_fee, rake_bps, min_tier, pool, rake_taken"
    )
    .order("matchday", { ascending: true });

  if (matchday !== null) {
    contestsQuery = contestsQuery.eq("matchday", matchday);
  }

  const contestsRes = await contestsQuery;

  if (contestsRes.error) {
    return Response.json(
      { error: `Supabase error (contests): ${contestsRes.error.message}` },
      { status: 500 }
    );
  }

  const rawContests = contestsRes.data ?? [];

  if (rawContests.length === 0) {
    return Response.json({ contests: [] } satisfies ContestsResponse);
  }

  // Fetch entrant counts for all returned contest_ids in one query
  const contestIds = rawContests.map((c) => c.contest_id);

  const entriesRes = await db
    .from("contest_entries")
    .select("contest_id")
    .in("contest_id", contestIds);

  if (entriesRes.error) {
    return Response.json(
      { error: `Supabase error (contest_entries): ${entriesRes.error.message}` },
      { status: 500 }
    );
  }

  // Count entrants per contest_id
  const entrantCounts = new Map<string, number>();
  for (const entry of entriesRes.data ?? []) {
    const key = String(entry.contest_id);
    entrantCounts.set(key, (entrantCounts.get(key) ?? 0) + 1);
  }

  const contests: ContestWithEntrants[] = rawContests.map((c) => ({
    contestId: String(c.contest_id),
    matchday: c.matchday,
    entryFee: String(c.entry_fee),
    rakeBps: c.rake_bps,
    minTier: c.min_tier,
    pool: String(c.pool),
    rakeTaken: c.rake_taken,
    entrants: entrantCounts.get(String(c.contest_id)) ?? 0,
  }));

  return Response.json({ contests } satisfies ContestsResponse);
}
