/**
 * decode.ts — Pure event-arg → Supabase upsert-payload mappers.
 *
 * Rules enforced here:
 *  - Addresses are lowercased.
 *  - bigint values destined for numeric(78,0) columns are stringified.
 *  - bigint / plain-number values for bigint/int/smallint columns stay as JS number.
 *  - Block numbers come in as bigint and are stored as number (bigint column but JS
 *    number is safe for all realistic block heights).
 *  - No network calls, no Supabase client, no viem imports — pure functions only.
 *
 * Each mapper returns:
 *   { table: string; row: Record<string, unknown>; onConflict: string }
 */

export interface UpsertPayload {
  table: string;
  row: Record<string, unknown>;
  onConflict: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const addr = (a: string): string => a.toLowerCase();
const str = (n: bigint): string => n.toString();
const num = (n: bigint | number): number => Number(n);

// ─────────────────────────────────────────────────────────────────────────────
// CardNFT — Transfer(from, to, tokenId)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a CardNFT.Transfer event to a cards upsert.
 *
 * Emitted columns: token_id (PK), owner, updated_block.
 *
 * Deferred to runner (Task 1.2):
 *   - player_id, tier, serial_number, mint_batch, original_buyer
 *     (runner calls card.cards(tokenId) on mint and fills them in;
 *      on a plain transfer it performs a PARTIAL update — only owner +
 *      updated_block — leaving the static mint fields unchanged in the DB).
 *
 * @param args  Decoded event args: { from, to, tokenId }
 * @param block Log block number
 */
export function mapTransfer(
  args: { from: string; to: string; tokenId: bigint },
  block: bigint,
): UpsertPayload {
  return {
    table: "cards",
    row: {
      token_id: str(args.tokenId),
      owner: addr(args.to),
      updated_block: num(block),
    },
    onConflict: "token_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CardNFT — UpdateUser(tokenId, user, expires)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a CardNFT.UpdateUser event to a cards partial upsert.
 *
 * Emitted columns: token_id (PK), user_addr, user_expires, updated_block.
 *
 * Note: expires is stored raw (unix timestamp); expiry-vs-now resolved at read.
 * The `expires` arg is uint64 in the ABI — arrives as bigint from viem.
 */
export function mapUpdateUser(
  args: { tokenId: bigint; user: string; expires: bigint },
  block: bigint,
): UpsertPayload {
  return {
    table: "cards",
    row: {
      token_id: str(args.tokenId),
      user_addr: addr(args.user),
      user_expires: num(args.expires),
      updated_block: num(block),
    },
    onConflict: "token_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace — Listed(tokenId, seller, price)
// ─────────────────────────────────────────────────────────────────────────────

export function mapListed(
  args: { tokenId: bigint; seller: string; price: bigint },
  block: bigint,
): UpsertPayload {
  return {
    table: "marketplace_listings",
    row: {
      token_id: str(args.tokenId),
      seller: addr(args.seller),
      price: str(args.price),
      active: true,
      updated_block: num(block),
    },
    onConflict: "token_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace — Sold(tokenId, buyer, price)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a Marketplace.Sold event — sets active:false on the listing.
 *
 * Note: The ABI `Sold` event has args (tokenId, buyer, price).
 * Ownership change is handled separately via the CardNFT.Transfer emitted in
 * the same tx; the runner will process both.
 * `seller` is NOT in the Sold event — only the existing DB row holds it.
 * We therefore do NOT emit seller here; the upsert updates only the listed
 * columns we can fill.
 */
export function mapSold(
  args: { tokenId: bigint; buyer: string; price: bigint },
  block: bigint,
): UpsertPayload {
  return {
    table: "marketplace_listings",
    row: {
      token_id: str(args.tokenId),
      // seller is not in Sold event; keep existing value via upsert merge
      // We must still emit it for the NOT NULL constraint on insert — but Sold
      // can only be emitted after a Listed, so the row already exists.
      // We only touch the mutable fields:
      active: false,
      updated_block: num(block),
    },
    onConflict: "token_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace — Cancelled(tokenId)
// ─────────────────────────────────────────────────────────────────────────────

export function mapCancelled(
  args: { tokenId: bigint },
  block: bigint,
): UpsertPayload {
  return {
    table: "marketplace_listings",
    row: {
      token_id: str(args.tokenId),
      active: false,
      updated_block: num(block),
    },
    onConflict: "token_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RentalMarket — ListedForRent(tokenId, mode, priceValue)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps RentalMarket.ListedForRent.
 *
 * ctx: owner — the NFT owner resolved by the runner from the cards table
 * (not present in the event; the contract stores it but it's not emitted).
 *
 * @param args  { tokenId, mode, priceValue }
 * @param owner Card owner address (resolved upstream by runner)
 * @param block Log block number
 */
export function mapListedForRent(
  args: { tokenId: bigint; mode: number; priceValue: bigint },
  owner: string,
  block: bigint,
): UpsertPayload {
  return {
    table: "rental_listings",
    row: {
      token_id: str(args.tokenId),
      owner: addr(owner),
      mode: num(args.mode),
      price_value: str(args.priceValue),
      active: true,
      updated_block: num(block),
    },
    onConflict: "token_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RentalMarket — Rented(tokenId, matchday, renter, paid)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps RentalMarket.Rented.
 *
 * ctx: owner — card owner address resolved by runner from cards table.
 * (The Rented event does not emit owner; owner lives in the rental_listings row.)
 *
 * @param args  { tokenId, matchday, renter, paid }
 * @param owner Card owner address (resolved upstream by runner)
 * @param block Log block number
 */
export function mapRented(
  args: { tokenId: bigint; matchday: bigint; renter: string; paid: bigint },
  owner: string,
  block: bigint,
): UpsertPayload {
  return {
    table: "rentals",
    row: {
      matchday: num(args.matchday),
      token_id: str(args.tokenId),
      renter: addr(args.renter),
      owner: addr(owner),
      paid: str(args.paid),
      settled: false,
      updated_block: num(block),
    },
    onConflict: "matchday,token_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RentalMarket — Settled(tokenId, matchday)
// ─────────────────────────────────────────────────────────────────────────────

export function mapSettled(
  args: { tokenId: bigint; matchday: bigint },
  block: bigint,
): UpsertPayload {
  return {
    table: "rentals",
    row: {
      matchday: num(args.matchday),
      token_id: str(args.tokenId),
      settled: true,
      updated_block: num(block),
    },
    onConflict: "matchday,token_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RentalMarket — Cancelled(tokenId, matchday)
// (rental cancel — sets rental_listings.active:false)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps RentalMarket.Cancelled to a rental_listings deactivation.
 *
 * Note: The RentalMarket.Cancelled event has args (tokenId, matchday).
 * This sets active:false on the rental listing for that token.
 */
export function mapRentalCancelled(
  args: { tokenId: bigint; matchday: bigint },
  block: bigint,
): UpsertPayload {
  return {
    table: "rental_listings",
    row: {
      token_id: str(args.tokenId),
      active: false,
      updated_block: num(block),
    },
    onConflict: "token_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PackSale — PackBought(commitId, buyer, packType)
// ─────────────────────────────────────────────────────────────────────────────

export function mapPackBought(
  args: { commitId: bigint; buyer: string; packType: number },
  block: bigint,
): UpsertPayload {
  return {
    table: "packs",
    row: {
      commit_id: str(args.commitId),
      buyer: addr(args.buyer),
      pack_type: num(args.packType),
      opened: false,
      updated_block: num(block),
    },
    onConflict: "commit_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PackSale — PackRevealed(commitId, tokenIds)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps PackSale.PackRevealed.
 *
 * revealed_token_ids is stored as numeric(78,0)[] — array of stringified bigints.
 */
export function mapPackRevealed(
  args: { commitId: bigint; tokenIds: bigint[] },
  block: bigint,
): UpsertPayload {
  return {
    table: "packs",
    row: {
      commit_id: str(args.commitId),
      revealed_token_ids: args.tokenIds.map(str),
      opened: true,
      updated_block: num(block),
    },
    onConflict: "commit_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GameRegistry — LineupCommitted(matchday, wallet, chipId)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps GameRegistry.LineupCommitted — PARTIAL row only.
 *
 * Emitted columns: matchday, wallet, chip_id, committed_block.
 *
 * Deferred to runner (Task 1.2):
 *   - token_ids, formation, captain_idx, vice_idx
 *     (runner calls gameRegistry.getLineup(matchday, wallet) on-chain and
 *      merges these into the same upsert before inserting).
 *
 * Note: The lineups table has NOT NULL on token_ids/formation/captain_idx/vice_idx;
 * the runner MUST enrich this partial before upserting.
 */
export function mapLineupCommitted(
  args: { matchday: bigint; wallet: string; chipId: number },
  block: bigint,
): UpsertPayload {
  return {
    table: "lineups",
    row: {
      matchday: num(args.matchday),
      wallet: addr(args.wallet),
      chip_id: num(args.chipId),
      committed_block: num(block),
    },
    onConflict: "matchday,wallet",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ContestEscrow — ContestCreated(id, matchday, entryFee, rakeBps, minTier)
// ─────────────────────────────────────────────────────────────────────────────

export function mapContestCreated(
  args: {
    id: bigint;
    matchday: bigint;
    entryFee: bigint;
    rakeBps: number;
    minTier: number;
  },
  block: bigint,
): UpsertPayload {
  return {
    table: "contests",
    row: {
      contest_id: str(args.id),
      matchday: num(args.matchday),
      entry_fee: str(args.entryFee),
      rake_bps: num(args.rakeBps),
      min_tier: num(args.minTier),
      pool: "0",
      rake_taken: false,
      updated_block: num(block),
    },
    onConflict: "contest_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ContestEscrow — Entered(id, player)
// ─────────────────────────────────────────────────────────────────────────────

export function mapEntered(
  args: { id: bigint; player: string },
  block: bigint,
): UpsertPayload {
  return {
    table: "contest_entries",
    row: {
      contest_id: str(args.id),
      wallet: addr(args.player),
      entered_block: num(block),
    },
    onConflict: "contest_id,wallet",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ContestEscrow — RakeTaken(id, rake)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps ContestEscrow.RakeTaken — updates contests row.
 *
 * rake amount is not stored in the contests table (no `rake` column) but
 * rake_taken boolean is. Pool should decrease by rake; however pool delta
 * is not tracked here — only the boolean flag is set. Runner may update
 * pool via a separate read if needed.
 */
export function mapRakeTaken(
  args: { id: bigint; rake: bigint },
  block: bigint,
): UpsertPayload {
  return {
    table: "contests",
    row: {
      contest_id: str(args.id),
      rake_taken: true,
      updated_block: num(block),
    },
    onConflict: "contest_id",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ScoreOracle — RootFinalized(matchday, scoreRoot, dnpRoot)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps ScoreOracle.RootFinalized.
 *
 * scoreRoot and dnpRoot are bytes32 — stored as hex strings.
 */
export function mapRootFinalized(
  args: { matchday: bigint; scoreRoot: string; dnpRoot: string },
  block: bigint,
): UpsertPayload {
  return {
    table: "score_roots",
    row: {
      matchday: num(args.matchday),
      score_root: args.scoreRoot,
      dnp_root: args.dnpRoot,
      finalized_block: num(block),
    },
    onConflict: "matchday",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ScoreOracle — PayoutRootFinalized(contestId, root)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps ScoreOracle.PayoutRootFinalized.
 *
 * root is bytes32 — stored as hex string.
 */
export function mapPayoutRootFinalized(
  args: { contestId: bigint; root: string },
  block: bigint,
): UpsertPayload {
  return {
    table: "payout_roots",
    row: {
      contest_id: str(args.contestId),
      root: args.root,
      finalized_block: num(block),
    },
    onConflict: "contest_id",
  };
}
