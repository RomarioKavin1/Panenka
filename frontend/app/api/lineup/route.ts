import type { NextRequest } from "next/server";
import { supabaseAnonServer } from "@/lib/supabase/server";

export interface LineupRow {
  matchday: number;
  wallet: string;
  tokenIds: string[];
  formation: number;
  captainIdx: number;
  viceIdx: number;
  chipId: number;
  committedBlock: number;
}

export interface LineupResponse {
  lineup: LineupRow | null;
}

/**
 * GET /api/lineup?matchday=1&wallet=0x...
 *
 * Returns the `lineups` row for (matchday, wallet) or `null` if not found.
 * Both `matchday` and `wallet` are required.
 * Wallet is lowercased before querying.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const matchdayParam = searchParams.get("matchday");
  const rawWallet = searchParams.get("wallet");

  // Validate wallet
  if (!rawWallet || rawWallet.trim() === "") {
    return Response.json(
      { error: "Missing required query param: wallet" },
      { status: 400 }
    );
  }

  // Validate matchday
  if (matchdayParam === null || matchdayParam.trim() === "") {
    return Response.json(
      { error: "Missing required query param: matchday" },
      { status: 400 }
    );
  }

  if (!/^\d+$/.test(matchdayParam.trim())) {
    return Response.json(
      { error: "Invalid query param: matchday must be a non-negative integer" },
      { status: 400 }
    );
  }

  const matchday = parseInt(matchdayParam.trim(), 10);
  if (!Number.isFinite(matchday)) {
    return Response.json(
      { error: "Invalid query param: matchday out of range" },
      { status: 400 }
    );
  }

  const wallet = rawWallet.trim().toLowerCase();

  const db = supabaseAnonServer();

  const { data, error } = await db
    .from("lineups")
    .select(
      "matchday, wallet, token_ids, formation, captain_idx, vice_idx, chip_id, committed_block"
    )
    .eq("matchday", matchday)
    .eq("wallet", wallet)
    .maybeSingle();

  if (error) {
    return Response.json(
      { error: `Supabase error: ${error.message}` },
      { status: 500 }
    );
  }

  if (!data) {
    return Response.json({ lineup: null } satisfies LineupResponse);
  }

  const lineup: LineupRow = {
    matchday: data.matchday,
    wallet: data.wallet,
    tokenIds: (data.token_ids ?? []).map(String),
    formation: data.formation,
    captainIdx: data.captain_idx,
    viceIdx: data.vice_idx,
    chipId: data.chip_id,
    committedBlock: data.committed_block,
  };

  return Response.json({ lineup } satisfies LineupResponse);
}
