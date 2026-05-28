import { describe, it, expect } from "vitest";
import {
  mapTransfer,
  mapUpdateUser,
  mapListed,
  mapSold,
  mapCancelled,
  mapListedForRent,
  mapRented,
  mapSettled,
  mapRentalCancelled,
  mapPackBought,
  mapPackRevealed,
  mapLineupCommitted,
  mapContestCreated,
  mapEntered,
  mapRakeTaken,
  mapRootFinalized,
  mapPayoutRootFinalized,
} from "./decode";

// ─────────────────────────────────────────────────────────────────────────────
// CardNFT — Transfer
// ─────────────────────────────────────────────────────────────────────────────

describe("mapTransfer", () => {
  it("maps a Transfer to a cards partial upsert (owner + token_id + updated_block)", () => {
    const result = mapTransfer(
      { from: "0x0000000000000000000000000000000000000000", to: "0xABCDEF", tokenId: 42n },
      100n,
    );
    expect(result.table).toBe("cards");
    expect(result.onConflict).toBe("token_id");
    expect(result.row).toEqual({
      token_id: "42",
      owner: "0xabcdef",
      updated_block: 100,
    });
  });

  it("lowercases the `to` address", () => {
    const result = mapTransfer(
      { from: "0xAAA", to: "0xBBBBBB", tokenId: 1n },
      1n,
    );
    expect(result.row.owner).toBe("0xbbbbbb");
  });

  it("stringifies token_id (bigint → numeric(78,0))", () => {
    const result = mapTransfer(
      { from: "0x0", to: "0x1", tokenId: 999999999999999999999999999999n },
      5n,
    );
    expect(result.row.token_id).toBe("999999999999999999999999999999");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CardNFT — UpdateUser
// ─────────────────────────────────────────────────────────────────────────────

describe("mapUpdateUser", () => {
  it("maps UpdateUser to cards upsert with user_addr + user_expires", () => {
    const result = mapUpdateUser(
      { tokenId: 7n, user: "0xUSER", expires: 1_700_000_000n },
      200n,
    );
    expect(result.table).toBe("cards");
    expect(result.onConflict).toBe("token_id");
    expect(result.row).toEqual({
      token_id: "7",
      user_addr: "0xuser",
      user_expires: 1_700_000_000,
      updated_block: 200,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace — Listed
// ─────────────────────────────────────────────────────────────────────────────

describe("mapListed", () => {
  it("maps Listed to marketplace_listings with active:true", () => {
    const result = mapListed(
      { tokenId: 5n, seller: "0xSELLER", price: 1_000_000n },
      300n,
    );
    expect(result.table).toBe("marketplace_listings");
    expect(result.onConflict).toBe("token_id");
    expect(result.row).toEqual({
      token_id: "5",
      seller: "0xseller",
      price: "1000000",
      active: true,
      updated_block: 300,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace — Sold
// ─────────────────────────────────────────────────────────────────────────────

describe("mapSold", () => {
  it("maps Sold to marketplace_listings with active:false", () => {
    const result = mapSold(
      { tokenId: 5n, buyer: "0xBUYER", price: 1_000_000n },
      301n,
    );
    expect(result.table).toBe("marketplace_listings");
    expect(result.onConflict).toBe("token_id");
    expect(result.row.active).toBe(false);
    expect(result.row.token_id).toBe("5");
    expect(result.row.updated_block).toBe(301);
  });

  it("does NOT include seller (not in Sold event)", () => {
    const result = mapSold({ tokenId: 5n, buyer: "0xB", price: 1n }, 1n);
    expect("seller" in result.row).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace — Cancelled
// ─────────────────────────────────────────────────────────────────────────────

describe("mapCancelled", () => {
  it("maps Cancelled to marketplace_listings with active:false", () => {
    const result = mapCancelled({ tokenId: 10n }, 302n);
    expect(result.table).toBe("marketplace_listings");
    expect(result.onConflict).toBe("token_id");
    expect(result.row).toEqual({
      token_id: "10",
      active: false,
      updated_block: 302,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RentalMarket — ListedForRent
// ─────────────────────────────────────────────────────────────────────────────

describe("mapListedForRent", () => {
  it("maps ListedForRent to rental_listings with owner from ctx", () => {
    const result = mapListedForRent(
      { tokenId: 3n, mode: 1, priceValue: 500_000n },
      "0xOWNER",
      400n,
    );
    expect(result.table).toBe("rental_listings");
    expect(result.onConflict).toBe("token_id");
    expect(result.row).toEqual({
      token_id: "3",
      owner: "0xowner",
      mode: 1,
      price_value: "500000",
      active: true,
      updated_block: 400,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RentalMarket — Rented
// ─────────────────────────────────────────────────────────────────────────────

describe("mapRented", () => {
  it("maps Rented to a rentals upsert row", () => {
    const result = mapRented(
      { tokenId: 7n, matchday: 3n, renter: "0xAbC", paid: 12_000_000n },
      "0xDEF",
      555n,
    );
    expect(result.table).toBe("rentals");
    expect(result.onConflict).toBe("matchday,token_id");
    expect(result.row).toEqual({
      matchday: 3,
      token_id: "7",
      renter: "0xabc",
      owner: "0xdef",
      paid: "12000000",
      settled: false,
      updated_block: 555,
    });
  });

  it("lowercases both renter and owner", () => {
    const result = mapRented(
      { tokenId: 1n, matchday: 1n, renter: "0xABCD", paid: 1n },
      "0xEFGH",
      1n,
    );
    expect(result.row.renter).toBe("0xabcd");
    expect(result.row.owner).toBe("0xefgh");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RentalMarket — Settled
// ─────────────────────────────────────────────────────────────────────────────

describe("mapSettled", () => {
  it("maps Settled to rentals with settled:true", () => {
    const result = mapSettled({ tokenId: 7n, matchday: 3n }, 600n);
    expect(result.table).toBe("rentals");
    expect(result.onConflict).toBe("matchday,token_id");
    expect(result.row).toEqual({
      matchday: 3,
      token_id: "7",
      settled: true,
      updated_block: 600,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RentalMarket — Cancelled (rental cancel)
// ─────────────────────────────────────────────────────────────────────────────

describe("mapRentalCancelled", () => {
  it("maps RentalMarket Cancelled to rental_listings with active:false", () => {
    const result = mapRentalCancelled({ tokenId: 8n, matchday: 2n }, 601n);
    expect(result.table).toBe("rental_listings");
    expect(result.onConflict).toBe("token_id");
    expect(result.row).toEqual({
      token_id: "8",
      active: false,
      updated_block: 601,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PackSale — PackBought
// ─────────────────────────────────────────────────────────────────────────────

describe("mapPackBought", () => {
  it("maps PackBought to packs with opened:false", () => {
    const result = mapPackBought(
      { commitId: 99n, buyer: "0xBUYER2", packType: 2 },
      700n,
    );
    expect(result.table).toBe("packs");
    expect(result.onConflict).toBe("commit_id");
    expect(result.row).toEqual({
      commit_id: "99",
      buyer: "0xbuyer2",
      pack_type: 2,
      opened: false,
      updated_block: 700,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PackSale — PackRevealed
// ─────────────────────────────────────────────────────────────────────────────

describe("mapPackRevealed", () => {
  it("maps PackRevealed to packs with opened:true and stringified token array", () => {
    const result = mapPackRevealed(
      { commitId: 99n, tokenIds: [1n, 2n, 3n, 4n, 5n] },
      701n,
    );
    expect(result.table).toBe("packs");
    expect(result.onConflict).toBe("commit_id");
    expect(result.row).toEqual({
      commit_id: "99",
      revealed_token_ids: ["1", "2", "3", "4", "5"],
      opened: true,
      updated_block: 701,
    });
  });

  it("stringifies large token IDs in the array", () => {
    const big = 123456789012345678901234567890n;
    const result = mapPackRevealed({ commitId: 1n, tokenIds: [big] }, 1n);
    expect(result.row.revealed_token_ids).toEqual(["123456789012345678901234567890"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GameRegistry — LineupCommitted
// ─────────────────────────────────────────────────────────────────────────────

describe("mapLineupCommitted", () => {
  it("maps LineupCommitted to a PARTIAL lineups row (matchday, wallet, chip_id, committed_block only)", () => {
    const result = mapLineupCommitted(
      { matchday: 5n, wallet: "0xWALLET", chipId: 3 },
      800n,
    );
    expect(result.table).toBe("lineups");
    expect(result.onConflict).toBe("matchday,wallet");
    expect(result.row).toEqual({
      matchday: 5,
      wallet: "0xwallet",
      chip_id: 3,
      committed_block: 800,
    });
    // Must NOT include token_ids/formation/captain_idx/vice_idx — those are runner's job
    expect("token_ids" in result.row).toBe(false);
    expect("formation" in result.row).toBe(false);
    expect("captain_idx" in result.row).toBe(false);
    expect("vice_idx" in result.row).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ContestEscrow — ContestCreated
// ─────────────────────────────────────────────────────────────────────────────

describe("mapContestCreated", () => {
  it("maps ContestCreated to contests with pool:0 and rake_taken:false", () => {
    const result = mapContestCreated(
      {
        id: 10n,
        matchday: 4n,
        entryFee: 5_000_000n,
        rakeBps: 1000,
        minTier: 2,
      },
      900n,
    );
    expect(result.table).toBe("contests");
    expect(result.onConflict).toBe("contest_id");
    expect(result.row).toEqual({
      contest_id: "10",
      matchday: 4,
      entry_fee: "5000000",
      rake_bps: 1000,
      min_tier: 2,
      pool: "0",
      rake_taken: false,
      updated_block: 900,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ContestEscrow — Entered
// ─────────────────────────────────────────────────────────────────────────────

describe("mapEntered", () => {
  it("maps Entered to contest_entries", () => {
    const result = mapEntered(
      { id: 10n, player: "0xPLAYER" },
      901n,
    );
    expect(result.table).toBe("contest_entries");
    expect(result.onConflict).toBe("contest_id,wallet");
    expect(result.row).toEqual({
      contest_id: "10",
      wallet: "0xplayer",
      entered_block: 901,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ContestEscrow — RakeTaken
// ─────────────────────────────────────────────────────────────────────────────

describe("mapRakeTaken", () => {
  it("maps RakeTaken to contests with rake_taken:true", () => {
    const result = mapRakeTaken(
      { id: 10n, rake: 500_000n },
      950n,
    );
    expect(result.table).toBe("contests");
    expect(result.onConflict).toBe("contest_id");
    expect(result.row).toEqual({
      contest_id: "10",
      rake_taken: true,
      updated_block: 950,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScoreOracle — RootFinalized
// ─────────────────────────────────────────────────────────────────────────────

describe("mapRootFinalized", () => {
  it("maps RootFinalized to score_roots", () => {
    const scoreRoot = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const dnpRoot = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const result = mapRootFinalized(
      { matchday: 6n, scoreRoot, dnpRoot },
      1000n,
    );
    expect(result.table).toBe("score_roots");
    expect(result.onConflict).toBe("matchday");
    expect(result.row).toEqual({
      matchday: 6,
      score_root: scoreRoot,
      dnp_root: dnpRoot,
      finalized_block: 1000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ScoreOracle — PayoutRootFinalized
// ─────────────────────────────────────────────────────────────────────────────

describe("mapPayoutRootFinalized", () => {
  it("maps PayoutRootFinalized to payout_roots", () => {
    const root = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    const result = mapPayoutRootFinalized(
      { contestId: 10n, root },
      1001n,
    );
    expect(result.table).toBe("payout_roots");
    expect(result.onConflict).toBe("contest_id");
    expect(result.row).toEqual({
      contest_id: "10",
      root,
      finalized_block: 1001,
    });
  });
});
