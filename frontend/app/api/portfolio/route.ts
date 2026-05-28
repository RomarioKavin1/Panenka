import type { NextRequest } from "next/server";
import { supabaseAnonServer } from "@/lib/supabase/server";

/** Card state from the wallet's perspective */
export type CardState = "OWN" | "RENTING_IN" | "RENTING_OUT" | "LOCKED";

export interface PortfolioCard {
  tokenId: string;
  playerId: string;
  tier: number;
  serialNumber: number;
  mintBatch: number;
  owner: string;
  userAddr: string | null;
  userExpires: number;
  state: CardState;
}

export interface PortfolioResponse {
  cards: PortfolioCard[];
}

/**
 * GET /api/portfolio?wallet=0x...
 *
 * Returns all cards owned by or rented to the given wallet, with a
 * computed `state` field:
 *   OWN          — owner = wallet (may also be rented OUT, which takes priority)
 *   RENTING_IN   — user_addr = wallet, owner ≠ wallet, unexpired
 *   RENTING_OUT  — owner = wallet, user_addr set to someone else, unexpired
 *   LOCKED       — token_id appears in any lineups row for this wallet
 *
 * Wallet is lowercased before querying.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const rawWallet = searchParams.get("wallet");

  if (!rawWallet || rawWallet.trim() === "") {
    return Response.json(
      { error: "Missing required query param: wallet" },
      { status: 400 }
    );
  }

  const wallet = rawWallet.trim().toLowerCase();
  const nowSeconds = Math.floor(Date.now() / 1000);

  const db = supabaseAnonServer();

  // Fetch cards owned by wallet OR actively rented to wallet
  // Two separate queries unified in memory (Supabase JS doesn't support OR across columns easily with filters)
  const [ownedRes, rentingInRes, lineupsRes] = await Promise.all([
    // Cards owned by wallet
    db
      .from("cards")
      .select(
        "token_id, player_id, tier, serial_number, mint_batch, owner, user_addr, user_expires"
      )
      .eq("owner", wallet),

    // Cards rented TO this wallet (user_addr = wallet, unexpired, owner ≠ wallet)
    db
      .from("cards")
      .select(
        "token_id, player_id, tier, serial_number, mint_batch, owner, user_addr, user_expires"
      )
      .eq("user_addr", wallet)
      .gt("user_expires", nowSeconds)
      .neq("owner", wallet),

    // All lineup entries for this wallet (to detect LOCKED cards)
    db.from("lineups").select("token_ids").eq("wallet", wallet),
  ]);

  if (ownedRes.error) {
    return Response.json(
      { error: `Supabase error (owned): ${ownedRes.error.message}` },
      { status: 500 }
    );
  }
  if (rentingInRes.error) {
    return Response.json(
      { error: `Supabase error (renting_in): ${rentingInRes.error.message}` },
      { status: 500 }
    );
  }
  if (lineupsRes.error) {
    return Response.json(
      { error: `Supabase error (lineups): ${lineupsRes.error.message}` },
      { status: 500 }
    );
  }

  // Build a set of locked token_ids (any token appearing in ANY lineup row for this wallet)
  const lockedTokenIds = new Set<string>();
  for (const row of lineupsRes.data ?? []) {
    for (const tid of row.token_ids ?? []) {
      lockedTokenIds.add(String(tid));
    }
  }

  // Merge results, deduplicated by token_id (owned rows take priority over renting_in)
  type RawCard = {
    token_id: string;
    player_id: string;
    tier: number;
    serial_number: number;
    mint_batch: number;
    owner: string;
    user_addr: string | null;
    user_expires: number;
  };

  const cardMap = new Map<string, RawCard>();

  // Add owned cards first
  for (const row of (ownedRes.data ?? []) as RawCard[]) {
    cardMap.set(String(row.token_id), row);
  }

  // Add renting-in cards (only if not already in map as owned)
  for (const row of (rentingInRes.data ?? []) as RawCard[]) {
    const key = String(row.token_id);
    if (!cardMap.has(key)) {
      cardMap.set(key, row);
    }
  }

  const cards: PortfolioCard[] = [];

  for (const [key, row] of cardMap) {
    let state: CardState;

    if (lockedTokenIds.has(key)) {
      state = "LOCKED";
    } else if (
      row.owner === wallet &&
      row.user_addr &&
      row.user_addr !== wallet &&
      row.user_expires > nowSeconds
    ) {
      state = "RENTING_OUT";
    } else if (row.owner !== wallet) {
      // user_addr = wallet, unexpired (already filtered in rentingInRes query)
      state = "RENTING_IN";
    } else {
      state = "OWN";
    }

    cards.push({
      tokenId: key,
      playerId: row.player_id,
      tier: row.tier,
      serialNumber: row.serial_number,
      mintBatch: row.mint_batch,
      owner: row.owner,
      userAddr: row.user_addr,
      userExpires: row.user_expires,
      state,
    });
  }

  return Response.json({ cards } satisfies PortfolioResponse);
}
