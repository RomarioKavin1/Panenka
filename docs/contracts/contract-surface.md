# Smart Contract Surface (v1)

> Function-level API specification for all 10 contracts. Derived from the gist at https://gist.github.com/Philotheephilix/af119589d2bb0622d5e6c79128230f0e and refined to fix 2 flow bugs, resolve 3 ambiguities, and document 5 implicit rules.
>
> Companion docs: `docs/superpowers/specs/2026-05-28-football-card-fantasy-design.md` (design spec) · `PRD.md` (product requirements).

---

## 0. Architecture overview

```
                  ┌────────────────────────────────┐
                  │           ScoreOracle           │
                  │   (N-of-M signer multi-sig)    │
                  └───────────┬───────────────────┘
                              │ roots / dnpRoots / payoutRoot
                              │
       ┌─────────────────┬────┴────────┬──────────────────┐
       │                 │             │                  │
┌──────▼──────┐  ┌───────▼──────┐  ┌──▼─────────────┐  ┌─▼─────────────────┐
│ContestEscrow│  │InsurancePool │  │SeasonLeaderbrd │  │  (any future       │
│             │  │              │  │                │  │   root-consumer)   │
└──────┬──────┘  └──────┬───────┘  └────────────────┘  └────────────────────┘
       │                │
       │                │
       │      ┌─────────▼─────────┐
       │      │   GameRegistry    │  ◄────── IMatchdayClock
       │      │ (lineups, stamina,│
       │      │  matchday status) │
       │      └─────────┬─────────┘
       │                │
       │      ┌─────────▼─────────┐
       │      │   RentalMarket    │  ─────► CardNFT.setRentalUser
       │      │ (ERC-4907 leases) │
       │      └─────────┬─────────┘
       │                │
┌──────▼────────────────▼────────┐
│           CardNFT              │  ◄──── PackSale.mint
│   (ERC-721 + ERC-4907)         │  ◄──── Marketplace (escrow/transfer)
└────────────────────────────────┘

┌────────────────┐                ┌──────────────────┐
│   PackSale     │                │     Marketplace  │
│ (commit-reveal)│                │  (fixed-price)   │
└────────┬───────┘                └────────┬─────────┘
         │ mint                            │ transferFrom (escrow)
         ▼                                 ▼
                       CardNFT

┌──────────────────┐
│     ChipNFT      │  ◄──── GameRegistry.burnFrom (on chip use)
│   (ERC-1155)     │
└──────────────────┘
```

Trust boundaries:
- `ScoreOracle` multi-sig is the trust root for all score-derived state (scores, DNPs, payouts, season totals)
- `CardNFT.setRentalUser` is privileged to `rentalMarket` only — RentalMarket is trusted to honor ownership invariants (see §4)
- `ChipNFT.burnFrom` is privileged to GameRegistry only

---

## 1. CardNFT.sol

ERC-721 with inlined ERC-4907 rental extension. The foundational asset — every other contract reads it.

### State

| Variable | Purpose |
|---|---|
| `cards[id]` | `{playerId, tier, serial, mintBatch}` |
| `statsOf[id]` | Card stats copy (denormalized from tierStats at mint for read efficiency) |
| `originalBuyer[id]` | First owner — receives royalty share on resale and rental |
| `tierStats[player][tier]` | Source-of-truth stats per (player, tier) — set by owner pre-mint |
| `mintedCount[player][tier]` | Current supply count |
| `tierSupplyCap` | `[∞, 1000, 100, 1]` |
| `isMinter[addr]` | Address allowlist for `mint()` |
| `rentalMarket` | Single privileged caller for `setRentalUser` |

### Functions

| Function | Access | What it does |
|---|---|---|
| `setMinter(addr, bool)` | owner | Grant/revoke mint rights (PackSale, deployer airdrops, future earned-drop contract) |
| `setRentalMarket(addr)` | owner | Authorize the single RentalMarket address |
| `setPlayerStats(playerId, tier, Stats)` | owner | Set deterministic stats per (player, tier). Required before any mint of that pair. |
| `mint(to, playerId, tier, mintBatch)` | minter | Mint a card. Enforces `tierSupplyCap`, copies tier stats to `statsOf`, sets `originalBuyer[id] = to`. Returns `tokenId`. |
| `airdropStarterSquad(to)` | minter | **NEW (D2):** mint the 5 deterministic Common cards comprising the Starter Squad. Idempotent per wallet. |
| `tierOf(id)` / `serialOf(id)` | view | Tier (0–3) / serial number within tier |
| `originalBuyer(id)` | view | First owner |
| `setUser(id, user, expires)` | owner/approved | ERC-4907: grant lineup rights until `expires` |
| `setRentalUser(id, user, expires)` | rentalMarket | Marketplace-bypass path for RentalMarket to lease without per-token approval |
| `userOf(id)` | view | Current renter (`address(0)` if expired/none) |
| `userExpires(id)` | view | Rental expiry timestamp |
| `_update(...)` | internal | Transfer hook — reverts `TransferWhileRented` if active 4907 user is set and not expired |
| `supportsInterface(id)` | view | ERC-4907 + ERC-721 |

### Invariants

- **I-C1.** `mintedCount[player][tier] <= tierSupplyCap[tier]` always
- **I-C2.** `originalBuyer[id]` is set once at mint and is immutable
- **I-C3.** Transfer reverts while `userOf(id) != address(0) && userExpires(id) > block.timestamp`
- **I-C4.** `setRentalUser` is callable only by the configured `rentalMarket` address
- **I-C5.** `setPlayerStats` must be called before any `mint(playerId, tier, ...)`

---

## 2. ChipNFT.sol

ERC-1155 gameplay boosters. IDs: `0`=TripleCaptain, `1`=Doubler, `2`=Wildcard, `3`=FreeHit.

### State

| Variable | Purpose |
|---|---|
| `isBurner[addr]` | Authorized burners (GameRegistry) |
| `isMinter[addr]` | Authorized minters (v1.5 earned-drop contract) |
| `claimedBaseline[wallet]` | Has wallet already claimed its 4 baseline chips? |
| `mintedPerEvent[eventId]` | **NEW (v1.5):** per-event mint counter for capped earned drops |

### Functions

| Function | Access | What it does |
|---|---|---|
| `setBurner(addr, bool)` | owner | Authorize GameRegistry to burn chips on use |
| `setMinter(addr, bool)` | owner | Authorize earned-drop minters (v1.5) |
| `claimBaseline()` | public | One-time mint of 1× each of the 4 chips per wallet. Reverts if already claimed. |
| `mint(to, id, amount, eventId)` | minter | Mint extra chips (v1.5 performance drops). **NEW (item #9):** enforces `mintedPerEvent[eventId] + amount <= eventCap[eventId]`. |
| `setEventCap(eventId, cap)` | owner | **NEW:** Set max mints per event |
| `burnFrom(account, id, amount)` | burner | Burn chip(s) when used in lineup |
| `balanceOf(account, id)` | view | Chip balance (ERC-1155) |

### Invariants

- **I-Ch1.** `claimedBaseline[wallet]` flips true after `claimBaseline()`; subsequent calls revert
- **I-Ch2.** `mintedPerEvent[eventId] <= eventCap[eventId]` for any event

---

## 3. PackSale.sol

Commit-reveal pack opening. Pack types: `0`=Bronze, `1`=Silver, `2`=Gold (v1 only; Diamond is v1.5). 5 cards per pack.

### State

| Variable | Purpose |
|---|---|
| `commits[id]` | `{buyer, targetBlock, packType, opened}` |
| `packPrice[type]` | USDC price per pack type |
| `tierCum[type]` | `uint16[4]` cumulative tier pull thresholds (sum = 10000 bps) |
| `playerPool` | Eligible playerIds for pulls |
| `treasury` | USDC sweep target |
| `revealDelayBlocks` | **NEW (security):** delay before reveal allowed (default `16`) |

### Functions

| Function | Access | What it does |
|---|---|---|
| `setPackPrice(type, price)` | owner | Set USDC price per pack type |
| `setTierCum(type, uint16[4])` | owner | Set cumulative tier pull rates (verifiable on-chain) |
| `setPlayerPool(bytes32[])` | owner | Set eligible playerIds |
| `setMintBatch(uint32)` | owner | Tag minted cards with a batch id |
| `setRevealDelay(uint256)` | owner | Adjust commit-to-reveal block delay |
| `withdraw(amount)` | owner | Move escrowed USDC to treasury |
| `buy(packType)` | public | Pay USDC; store commit at `block.number + revealDelayBlocks`. Returns commitId. |
| `reveal(commitId)` | public | After `targetBlock`: seed from `blockhash(targetBlock)`, pull 5 (tier, player), mint via `_mintWithDowngrade` |
| `_mintWithDowngrade(...)` | internal | If `tierSupplyCap` exhausted for (player, tier), step tier down toward Common (which is unlimited) |

### Security note

`blockhash` randomness with a short delay is sequencer-influenceable on rollups. Default delay raised to **16 blocks** (configurable). Mitigates but doesn't eliminate the risk; replace with Chainlink VRF in v1.5 if available on X Layer. See §10.

### Invariants

- **I-P1.** A commit can be revealed exactly once (`opened` flips true)
- **I-P2.** `tierCum[type][3]` must equal `10000` (sum-of-pull-rates = 100%)
- **I-P3.** Reveal reverts if `block.number <= commit.targetBlock`
- **I-P4.** Reveal reverts if `block.number > commit.targetBlock + 256` (blockhash window expired) — refund path required

---

## 4. RentalMarket.sol

Per-matchday card leases via ERC-4907 + USDC escrow. Pricing modes: `0`=Fixed, `1`=FloorPegged, `2`=Suggested. Split: owner 88% / platform 10% / original buyer 2%.

### State

| Variable | Purpose |
|---|---|
| `listings[tokenId]` | `{owner, mode, priceValue, active}` |
| `rentals[matchday][tokenId]` | `{renter, paid, settled, cancelled}` |
| `floorPrice[player][tier]` | Floor price feed (owner-set) for FloorPegged mode |
| `clock` | `IMatchdayClock` (GameRegistry) for lock/cancel state |
| `treasury` | Platform fee recipient |
| `MATCH_WINDOW` | 6 hours (rental expiry past lock) |
| `CANCEL_REFUND_BPS` | 9000 (90% refund pre-lock) |

### Functions

| Function | Access | What it does |
|---|---|---|
| `setTreasury(addr)` | owner | Set platform fee recipient |
| `setFloorPrice(player, tier, price)` | owner | Feed floor for FloorPegged mode. **Trust note:** centralized in v1; document in transparency page. |
| `listForRent(tokenId, mode, priceValue)` | token owner | List a card for rent in one of 3 modes |
| `delist(tokenId)` | token owner | Deactivate future availability (existing per-matchday rentals persist — see D3) |
| `rent(tokenId, matchday)` | public | Pay USDC into escrow; set 4907 user = renter until `clock.lockTime(matchday) + MATCH_WINDOW`. **FIXED (Bug 1):** re-verifies `CardNFT.ownerOf(tokenId) == listings[tokenId].owner` |
| `settle(tokenId, matchday)` | public | After `clock.lockTime(matchday)`: pay owner 88% / platform 10% / original buyer 2% |
| `cancel(tokenId, matchday)` | renter | Pre-lock: 90% refund to renter, 10% to owner, clear 4907 user |
| `refundPostponed(tokenId, matchday)` | public | If `clock.isCancelled(matchday)`: 100% refund to renter, clear 4907 user |
| `_resolvePrice(...)` | internal | Concrete price (Fixed = priceValue; FloorPegged = bps of floor; Suggested = priceValue with sanity bounds) |

### Bug-fix detail (Bug 1)

Without the ownership re-check at `rent()`, an owner could list both in RentalMarket and Marketplace simultaneously, sell to a buyer via Marketplace, then a renter could still call `rent()` and lock a 4907 user on a card the original lister no longer holds. The new buyer's subsequent transfer attempts would revert (`TransferWhileRented`) and the renter would have rights they shouldn't have.

```solidity
function rent(uint256 tokenId, uint256 matchday) external {
    Listing memory l = listings[tokenId];
    require(l.active, "not listed");
    require(CardNFT(card).ownerOf(tokenId) == l.owner, "owner changed");   // ← NEW
    require(rentals[matchday][tokenId].renter == address(0), "already rented");
    // ... pay, escrow, setRentalUser ...
}
```

### Invariants

- **I-R1.** A single token can have at most one active 4907 user at any time (enforced by CardNFT)
- **I-R2.** A `rentals[m][tokenId]` entry is final once `settle()` or `refundPostponed()` runs — no double-payout
- **I-R3.** `settle()` requires `block.timestamp > clock.lockTime(matchday)` AND `!clock.isCancelled(matchday)`
- **I-R4.** `cancel()` requires `block.timestamp <= clock.lockTime(matchday)` AND `msg.sender == rentals[m][tokenId].renter`
- **I-R5.** Sum of fee splits = 100% (8800 + 1000 + 200 = 10000 bps)

---

## 5. Marketplace.sol

Fixed-price secondary sales in USDC. NFT escrowed on listing. Split: seller 95% / platform 4% / original buyer 1%.

### State

| Variable | Purpose |
|---|---|
| `listings[tokenId]` | `{seller, price, active}` |
| `treasury` | Platform fee recipient |

### Functions

| Function | Access | What it does |
|---|---|---|
| `setTreasury(addr)` | owner | Set platform fee recipient |
| `list(tokenId, price)` | token owner | Escrow NFT (transfer to Marketplace), create listing |
| `cancel(tokenId)` | seller | Reclaim escrowed NFT, delete listing |
| `buy(tokenId)` | public | Pay USDC, split 9500/400/100 bps, transfer NFT to buyer |

### Implicit rule

`list()` will revert if the token has an active 4907 user (because the transfer-to-escrow triggers `CardNFT._update` which reverts on active rental). This is correct behavior — sellers must wait for any active rental to expire before listing.

### Invariants

- **I-M1.** Sum of fee splits = 100% (9500 + 400 + 100 = 10000 bps)
- **I-M2.** A listing is removed on either `cancel()` or `buy()`

---

## 6. GameRegistry.sol

Matchday lifecycle clock + lineup commitment. Implements `IMatchdayClock` for RentalMarket and InsurancePool. Chip sentinel: `255` = no chip.

### State

| Variable | Purpose |
|---|---|
| `matchdays[m]` | `{lockTime, status}` where status ∈ `{None, Open, Locked, Cancelled, Settled}` |
| `_lineups[m][wallet]` | `{tokenIds[11], formation, captainIdx, viceIdx, chipId, committedAt}` |
| `cardUsedInMatchday[m][tokenId]` | Wallet that used this card on matchday m (`address(0)` = unused) |
| `staminaOf[tokenId]` | Current stamina (0–100) |
| `lastUsedMatchday[tokenId]` | For lazy regen calculation |

Constants:
- `STAMINA_MAX = 100`
- `STAMINA_COST = 30`
- `STAMINA_REGEN_PER_MATCHDAY = 50`
- `FRESH_THRESHOLD = 70`
- `FATIGUED_THRESHOLD = 30`

### Functions

| Function | Access | What it does |
|---|---|---|
| `configureMatchday(m, lock)` | owner | Open a matchday with a lock timestamp |
| `lock(m)` / `cancel(m)` / `settle(m)` | owner | Advance matchday status |
| `lockTime(m)` | view | Lock timestamp (IMatchdayClock) |
| `isOpen(m)` / `isCancelled(m)` / `isSettled(m)` | view | Status checks (IMatchdayClock) |
| `hasLineup(m, wallet)` | view | Whether wallet committed a lineup |
| `getLineup(m, wallet)` | view | Full lineup struct |
| `commitLineup(m, tokenIds[11], formation, captainIdx, viceIdx, chipId)` | public | See semantics below. |
| `_applyStamina(tokenId, chipId)` | internal | Lazy regen since `lastUsedMatchday`; subtract `STAMINA_COST` (skipped for FreeHit); Wildcard sets stamina to `STAMINA_MAX` for the cards in this lineup |

### `commitLineup` semantics (Ambiguity 1 resolved)

For each `tokenId` in the lineup:

```
if userOf(tokenId) != address(0) AND userExpires(tokenId) > block.timestamp:
    require(msg.sender == userOf(tokenId), "not the renter");
else:
    require(msg.sender == ownerOf(tokenId), "not the owner");

require(cardUsedInMatchday[m][tokenId] == address(0), "card already used this matchday");
require(matchdays[m].status == Open, "matchday not open");
require(block.timestamp < matchdays[m].lockTime, "matchday locked");
require(captainIdx < 11 && viceIdx < 11 && captainIdx != viceIdx, "bad captain indices");

// apply stamina, mark exclusivity
_applyStamina(tokenId, chipId);
cardUsedInMatchday[m][tokenId] = msg.sender;
```

After loop:
```
if chipId != 255:
    require(ChipNFT.balanceOf(msg.sender, chipId) >= 1, "no chip");
    ChipNFT.burnFrom(msg.sender, chipId, 1);

_lineups[m][msg.sender] = Lineup{...};
```

**Critical rule (A1):** if a card has an active 4907 user, ONLY that user can lineup it. This prevents the owner-grief-renter scenario where an owner racing to commit first would consume the per-matchday exclusivity slot.

### Wildcard chip scope (clarified)

Wildcard resets stamina to `STAMINA_MAX` for the 11 cards in **this lineup**, not for all the user's cards. This is a scope simplification from the spec wording — it is intentional and documented here.

### Invariants

- **I-G1.** A given `(matchday, wallet)` has at most one lineup
- **I-G2.** A given `(matchday, tokenId)` has at most one committing wallet (exclusivity)
- **I-G3.** `commitLineup` requires `matchdays[m].status == Open && block.timestamp < lockTime`
- **I-G4.** Stamina ∈ `[0, 100]` after `_applyStamina`
- **I-G5.** Chip burn is atomic with lineup commit — either both succeed or neither

---

## 7. ScoreOracle.sol

N-of-M signer voting that finalizes per-matchday Merkle roots. Read by ContestEscrow, InsurancePool, SeasonLeaderboard.

### State

| Variable | Purpose |
|---|---|
| `isSigner[addr]` | Signer allowlist |
| `threshold` | Votes required (e.g., 3-of-5) |
| `roots[matchday]` | Finalized score Merkle root |
| `dnpRoots[matchday]` | Finalized DNP Merkle root |
| `seasonRoot` | **NEW (Ambiguity 2 / SeasonLeaderboard fix):** finalized season aggregate root |
| `payoutRoots[contestId]` | **NEW (Ambiguity 2):** finalized payout root per contest |
| `votes[matchday][signer]` | Tally per signer |
| `seasonVotes[signer]` / `payoutVotes[contestId][signer]` | Tallies for season/payout root |

### Functions

| Function | Access | What it does |
|---|---|---|
| `setSigner(addr, bool)` | owner | Add/remove a signer |
| `setThreshold(uint256)` | owner | Set required votes |
| `submitRoot(matchday, scoreRoot, dnpRoot)` | signer | Vote for a `(scoreRoot, dnpRoot)` pair for the matchday; finalizes when votes ≥ threshold |
| `submitPayoutRoot(contestId, root)` | signer | **NEW:** Vote for a contest's payout root; finalizes at threshold |
| `submitSeasonRoot(root)` | signer | **NEW:** Vote for season root; finalizes at threshold |
| `roots(matchday)` | view | Score Merkle root |
| `dnpRoots(matchday)` | view | DNP Merkle root |
| `payoutRoots(contestId)` | view | Payout Merkle root |
| `seasonRoot()` | view | Season Merkle root |

### Trust model (Ambiguity 2 resolved)

All Merkle roots that govern user payouts go through the same `threshold`-of-`N` signer set. Previously the gist had `ContestEscrow.setPayoutRoot` and `SeasonLeaderboard.setSeasonRoot` as owner-only — both are now routed through `ScoreOracle`.

### Invariants

- **I-O1.** A finalized root is immutable (cannot be re-voted after threshold reached)
- **I-O2.** A signer can only vote once per `(matchday, root-pair)` before finalization
- **I-O3.** `threshold > 0 && threshold <= count(isSigner)`

---

## 8. ContestEscrow.sol

Contest entry escrow + Merkle-proof payouts. Free contest = `entryFee 0`. Leaf = `keccak256(abi.encodePacked(account, amount))`.

### State

| Variable | Purpose |
|---|---|
| `contests[id]` | `{matchday, entryFee, rakeBps, minTier, pool, payoutRoot, finalized}` |
| `entered[id][wallet]` | One entry per wallet per contest |
| `claimed[id][wallet]` | Prevent double-claim |
| `treasury` | Rake recipient |
| `scoreOracle` | Source of truth for payout roots |

### Functions

| Function | Access | What it does |
|---|---|---|
| `setTreasury(addr)` | owner | Set rake recipient |
| `createContest(matchday, entryFee, rakeBps, minTier)` | owner | **MODIFIED (issue 3):** open a contest with a minimum-card-tier gate. Returns `contestId`. |
| `enter(id)` | public | Pay entry fee into escrow; one entry per wallet |
| `finalize(id)` | public | Pull payout root from `ScoreOracle.payoutRoots(id)`, transfer rake to treasury. Replaces owner-only `setPayoutRoot`. |
| `claim(id, amount, proof)` | public | Verify Merkle proof against `contests[id].payoutRoot`, pay winner once |

### Lineup linkage rule (D1 — documented)

A wallet's score for contest `id` is derived from its single canonical lineup committed in `GameRegistry` for `contests[id].matchday`. The same lineup applies to every contest entered for that matchday — there is no per-contest lineup in v1.

### Tier gate enforcement (issue 3)

`enter()` does not on-chain-verify card tiers in the lineup (lineup may not even be committed yet at entry time). Instead:
1. `createContest` records `minTier`
2. Off-chain score computation excludes any lineup with cards below `minTier` from this contest's payout tree
3. Excluded wallets score 0 in this contest (entry fee is forfeited, captured in rake)
4. Frontend UI prevents entering tier-gated contests with ineligible lineups (best-effort UX)

This trades on-chain enforcement for simpler contracts and gas. Document loudly in PRD.

### Rake split (D6 — implicit rule)

`finalize` transfers the entire `rakeBps` portion to `treasury` in a single transfer. The internal 4/2/2 split (ops / season pool / LM rewards from the PRD) happens off-chain at the treasury level. This is documented but not on-chain-enforced in v1.

### Invariants

- **I-CE1.** `entered[id][wallet]` flips true on `enter()`; subsequent calls revert
- **I-CE2.** `claimed[id][wallet]` flips true on `claim()`; subsequent calls revert
- **I-CE3.** `finalize()` requires `ScoreOracle.payoutRoots(id) != bytes32(0)`
- **I-CE4.** Claim verification: `MerkleProof.verify(proof, payoutRoot, leaf) && leaf == keccak256(abi.encodePacked(msg.sender, amount))`

---

## 9. InsurancePool.sol

DNP insurance. Premium = 20% of rental cost. Payout on DNP = 100% rental + 50% premium back. Reads `ScoreOracle.dnpRoots`. **v1.5.**

### State

| Variable | Purpose |
|---|---|
| `policies[matchday][tokenId]` | `{renter, rentalCost, premium, claimed}` |
| `oracle` | ScoreOracle address |
| `treasury` | Surplus recipient |
| `reserveRatio` | **NEW (Ambiguity 3):** minimum balance / open-policy-exposure ratio before new policies can be sold |
| `openExposure` | Sum of (rentalCost + 50% premium) across unsettled policies |

### Functions

| Function | Access | What it does |
|---|---|---|
| `setTreasury(addr)` | owner | Set surplus recipient |
| `setReserveRatio(bps)` | owner | Set minimum reserve ratio (e.g., 8000 bps = 80%) |
| `withdrawSurplus(amount)` | owner | Move pool surplus to treasury (only above reserve threshold) |
| `insure(matchday, tokenId, rentalCost)` | renter (of that rental) | Pay 20% premium. **NEW guard:** revert if `(balance - openExposure - (rentalCost + premium/2)) / openExposure < reserveRatio` |
| `claimDnp(matchday, tokenId, rentalCost, proof)` | renter | If DNP proven against `ScoreOracle.dnpRoots(matchday)`, pay rental + half premium |
| `expire(matchday, tokenId)` | public | After matchday settled: if no DNP claim, release the open exposure (keeps reserve math accurate) |

### Insolvency strategy (Ambiguity 3 resolved)

A reserve-ratio guard at `insure()` time prevents the pool from accepting policies it can't cover. Initial pool seeding (from platform treasury) is required before any policy can be sold. If reserve ratio dips below threshold, `insure()` reverts until pool is replenished — UX message: "Insurance temporarily unavailable for this matchday."

### Invariants

- **I-I1.** `insure` requires (a) the caller is the current renter, (b) the premium hits the pool, (c) reserve ratio remains satisfied after the new policy
- **I-I2.** `claimDnp` requires (a) valid Merkle proof against finalized DNP root, (b) `!policies[m][id].claimed`
- **I-I3.** A policy is finalized (claimed or expired) exactly once

---

## 10. SeasonLeaderboard.sol

End-of-Cup aggregate payout. One season Merkle root, claim once. Leaf = `keccak256(abi.encodePacked(account, amount))`.

### State

| Variable | Purpose |
|---|---|
| `oracle` | ScoreOracle address |
| `claimed[wallet]` | Prevent double-claim |
| `funded` | Whether the prize pool has been deposited |

### Functions

| Function | Access | What it does |
|---|---|---|
| `fund(amount)` | owner | Deposit USDC into the season prize pool |
| `claim(amount, proof)` | public | Verify proof against `oracle.seasonRoot()`, pay season winner once |

### Trust fix (Ambiguity 2 / Issue 2)

`seasonRoot` is no longer owner-set on this contract — it lives in `ScoreOracle` and is set via N-of-M signer vote (`submitSeasonRoot`). `claim` reads it from oracle. Consistent with all other root-derived payouts.

### Invariants

- **I-SL1.** `claimed[wallet]` flips true on `claim()`; subsequent calls revert
- **I-SL2.** `claim` requires `oracle.seasonRoot() != bytes32(0)`

---

## 11. Canonical end-to-end flows

### 11.1 Onboarding

```
1. User connects wallet
2. CardNFT.airdropStarterSquad(user)          ← deployer is a minter
3. ChipNFT.claimBaseline()                    ← called by user, gas-only
4. User can now field 11 by adding 6 cheap rentals
```

### 11.2 Pack purchase

```
1. User calls PackSale.buy(packType)          → escrow USDC, store commit
2. Wait revealDelayBlocks (default 16) blocks
3. User calls PackSale.reveal(commitId)       → blockhash seed → 5 mints via CardNFT.mint
```

### 11.3 Rental lifecycle

```
T0  Owner: RentalMarket.listForRent(tokenId, mode, priceValue)
T1  Renter: RentalMarket.rent(tokenId, matchday)
      ├── Re-verify ownership (Bug 1 fix)
      ├── Escrow USDC
      └── CardNFT.setRentalUser(tokenId, renter, lockTime+6h)
T2  Renter: GameRegistry.commitLineup(matchday, [..., tokenId, ...], ...)
      └── Controller check (A1): renter is the 4907 user → allowed
T3  Lock time passes; matches play out
T4  Anyone: RentalMarket.settle(tokenId, matchday)
      └── 88% owner / 10% platform / 2% original buyer

— OR —

T1' Match cancelled before kickoff
T2' Anyone: RentalMarket.refundPostponed(tokenId, matchday) → 100% refund
```

### 11.4 Matchday → payout

```
1. Matchday closes
2. Off-chain: signers compute scores per lineup → build score Merkle tree
3. Signers: ScoreOracle.submitRoot(matchday, scoreRoot, dnpRoot)  → finalize at threshold
4. Off-chain: for each contest, build payout tree from finalized scores + contest rules (rake, tier gate, prize curve)
5. Signers: ScoreOracle.submitPayoutRoot(contestId, root)         → finalize at threshold
6. Anyone: ContestEscrow.finalize(id)                              → pull root, transfer rake
7. Winners: ContestEscrow.claim(id, amount, proof)                 → paid out
```

### 11.5 Insurance (v1.5)

```
T0  Renter holds active rental for (matchday, tokenId), cost = 12 USDC
T1  Renter: InsurancePool.insure(matchday, tokenId, 12)        → premium 2.4 USDC; reserve check passes
T2  Matchday plays out; player gets 0 minutes
T3  Signers: ScoreOracle.submitRoot(matchday, scoreRoot, dnpRoot) (DNP root contains tokenId)
T4  Renter: InsurancePool.claimDnp(matchday, tokenId, 12, proof) → receives 12 + 1.2 = 13.2 USDC
```

### 11.6 Season payout

```
1. Final matchday closes; all daily roots finalized
2. Off-chain: aggregate all 28 matchday scores per wallet → season Merkle tree
3. Signers: ScoreOracle.submitSeasonRoot(root)                → finalize at threshold
4. Owner: SeasonLeaderboard.fund(amount)                       → deposit prize pool
5. Top-100 winners: SeasonLeaderboard.claim(amount, proof)
```

---

## 12. Implicit rules — now explicit

| ID | Rule | Where enforced |
|---|---|---|
| D1 | One canonical lineup per `(matchday, wallet)` applies to all contests entered for that matchday | `GameRegistry._lineups[m][wallet]` is single-slot; documented in `ContestEscrow` |
| D2 | Free Starter Squad is delivered via `CardNFT.airdropStarterSquad(to)` called by deployer | New explicit function on CardNFT |
| D3 | `RentalMarket.delist` removes future availability; existing per-matchday rentals persist until `settle`/`refundPostponed` | Documented in §4 |
| D4 | Rental settlement timing: `settle()` callable only after `clock.lockTime(matchday)` AND `!isCancelled` | Invariant I-R3 |
| D5 | 4907 user expiry on rental = `lockTime + MATCH_WINDOW (6h)` — covers all match durations + grace | Constant in §4 |
| D6 | ContestEscrow rake transfers as a single sum; internal split (ops/season/LM) happens off-chain at treasury | Documented in §8 |

---

## 13. Changelog from gist v0 → this doc

| Change | Reason | Where |
|---|---|---|
| Added `CardNFT.airdropStarterSquad` | Free starter squad onboarding (PRD FR-O3) was implicit | §1 |
| Added `ChipNFT.setEventCap` + `mintedPerEvent` | Cap earned-drop minting per event to prevent unbounded supply | §2 |
| Increased `PackSale.revealDelayBlocks` default 1 → 16 + made configurable | Reduce blockhash manipulation surface on rollups | §3 |
| Added explicit blockhash-window-expiry handling in `PackSale.reveal` | If reveal not called within 256 blocks, blockhash is unavailable — need refund path | §3 |
| **`RentalMarket.rent` re-verifies `ownerOf(tokenId) == listings.owner` (Bug 1 fix)** | Prevents stuck-rental bug when card is dual-listed in Marketplace | §4 |
| `commitLineup` controller-validation spec made explicit (Ambiguity 1) | Was vague — now: "if 4907 user is active, only they can commit; else owner" | §6 |
| Wildcard chip scope clarified | Resets stamina for the 11 cards in this lineup, not all owned cards | §6 |
| `ContestEscrow.createContest` adds `minTier` parameter | Enforce tier-gated paid contests via off-chain payout computation | §8 |
| `ContestEscrow.setPayoutRoot` (owner) removed; replaced with `finalize` pulling from `ScoreOracle` | Trust consistency (Ambiguity 2) | §8 / §7 |
| `SeasonLeaderboard.setSeasonRoot` (owner) removed; `seasonRoot` lives on `ScoreOracle` | Trust consistency (Issue 2) | §10 / §7 |
| `InsurancePool` adds `reserveRatio`, `openExposure`, `expire()` | Prevents pool insolvency (Ambiguity 3) | §9 |
| Added §0 architecture overview and §11 end-to-end flow walkthroughs | Made implicit linkages explicit | new |

---

## 14. Open items / future work

- **VRF migration for PackSale** (v1.5): replace blockhash with Chainlink VRF on X Layer when available
- **On-chain rake split** in ContestEscrow if/when treasury accounting becomes a transparency concern
- **Multi-matchday rentals** (v2): currently lease is exactly one matchday; multi-day terms require new contract surface
- **Bench / subs + Bench Boost chip** (v2): expand `_lineups` to 15 slots + 4 sub indices
- **Country/Faction pools** (v2): new contract surface for faction enrollment, contribution tracking, and faction-vs-faction payout
- **English-auction Marketplace** (v1.5): extend Marketplace with auction listing type + anti-snipe
- **Diamond pack tier + Unique auctions** (v1.5): extend PackSale + new UniqueAuction contract
- **Earned chip drop contract** (v1.5): new minter contract called by oracle on performance events

---

## 15. Status

- Surface review: ✅ complete
- Flow validation: ✅ complete (2 bugs fixed, 3 ambiguities resolved, 5 implicit rules documented, 6 changelog items)
- Ready for Solidity implementation: ✅
- Security review (separate from flow): still TBD — see notes in §3 (PackSale randomness), §4 (`setFloorPrice` centralization), §11 (overall trust model)
