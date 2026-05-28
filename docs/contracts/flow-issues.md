# Contract Surface — Flow Issues

Issues found in the gist (https://gist.github.com/Philotheephilix/af119589d2bb0622d5e6c79128230f0e), security set aside. **2 flow bugs + 3 ambiguities + 5 implicit rules** to document before coding.

---

## 🟠 Bug 1 — `RentalMarket.rent()` doesn't re-verify ownership

**Scenario**

```
T0  Owner: RentalMarket.listForRent(tokenId, ...)   → listings[id] active
T1  Owner: Marketplace.list(tokenId, price)         → NFT escrowed to Marketplace
T2  Renter: RentalMarket.rent(tokenId, matchday)    → succeeds, sets 4907 user
T3  Buyer: Marketplace.buy(tokenId)                 → reverts (TransferWhileRented)
                                                       → permanently stuck
```

**Fix** — re-check ownership at rent time:

```solidity
function rent(uint256 tokenId, uint256 matchday) external {
    Listing memory l = listings[tokenId];
    require(l.active, "not listed");
    require(CardNFT(card).ownerOf(tokenId) == l.owner, "owner changed");  // ← ADD
    // ... existing logic
}
```

---

## 🟠 Bug 2 — Dual-listing not reconciled

Same root cause as Bug 1. Marketplace and RentalMarket don't know about each other.

**Resolution rule:** listings in either market are allowed; rent/buy operations must re-verify current state. The Bug 1 fix above closes this. `Marketplace.list` already implicitly fails on active rental via the `_update` hook — no change needed there.

---

## 🟡 Ambiguity 1 — `commitLineup` controller validation is vague

Gist says "validate controller per card." If owner can always commit regardless of active rental, an owner can grief their own renter by committing first and consuming the per-matchday exclusivity slot.

**Required semantic:**

```
For each tokenId in lineup:
  if userOf(tokenId) != address(0) && userExpires(tokenId) > block.timestamp:
    require(msg.sender == userOf(tokenId), "not the renter");
  else:
    require(msg.sender == ownerOf(tokenId), "not the owner");
```

**Rule:** if a card has an active 4907 user, **only that user** can commit it. Owner is locked out for the rental duration.

---

## 🟡 Ambiguity 2 — Payout root has weaker trust than score root

```
ScoreOracle.roots[matchday]        ← 3-of-5 multi-sig
ContestEscrow.setPayoutRoot(...)   ← owner-only (single key)
SeasonLeaderboard.setSeasonRoot()  ← owner-only (single key)
```

Score root is multi-sig-protected; payout root and season root are not. Malicious owner could publish an arbitrary payout root that doesn't match the score root.

**Fix:** route both `setPayoutRoot` and `setSeasonRoot` through `ScoreOracle` multi-sig. Add `submitPayoutRoot(contestId, root)` and `submitSeasonRoot(root)` to `ScoreOracle`. Consumers read from oracle, not from a local owner setter.

---

## 🟡 Ambiguity 3 — Insurance pool insolvency not modeled

No guard against pool running dry. Many DNP claims in one matchday → pool empty → some `claim()` calls revert based on tx ordering.

**Fix:** add reserve-ratio invariant to `InsurancePool`.

```
- reserveRatio (e.g., 8000 bps = 80%)
- openExposure (sum of rental + 50% premium across unsettled policies)

insure() reverts if:
  (balance - openExposure - newPolicyExposure) / openExposure < reserveRatio
```

Pool requires initial seeding from treasury. UX: "Insurance temporarily unavailable for this matchday."

---

## 📝 Implicit rules — document explicitly

These are correct as designed but not stated anywhere in the gist.

| ID | Rule |
|---|---|
| D1 | **One lineup per (matchday, wallet)** applies to all contests entered for that matchday — not per-contest lineups |
| D2 | **Free Starter Squad** is delivered via deployer calling `CardNFT.mint` — should be an explicit `airdropStarterSquad` function |
| D3 | **`RentalMarket.delist`** removes future availability but existing per-matchday rentals persist until `settle`/`refundPostponed` |
| D4 | **Rental `settle()` timing** — only callable after `clock.lockTime(matchday)` AND `!isCancelled` |
| D5 | **4907 user expiry** = `lockTime + MATCH_WINDOW (6h)` — covers all match durations plus grace |

---

## Bonus — Contest tier-gate enforcement is missing

Not strictly a flow issue but related. PRD has tier-gated contests (Common Open / Rare+ Open / Whale Pool). `ContestEscrow.enter()` doesn't check that the entrant will lineup cards of the right tier — nothing prevents entering Whale Pool with a Common lineup.

**Fix:** add `minTier` to `Contest` struct. Off-chain payout computation excludes ineligible lineups (they score 0 in that contest, entry fee captured in rake). Document the trade-off — on-chain enforcement is more expensive but possible if desired.

---

## Summary

| # | Issue | Severity | Fix complexity |
|---|---|---|---|
| Bug 1 | Rent doesn't re-verify ownership | 🟠 | 1-line add |
| Bug 2 | Dual-listing — same root cause | 🟠 | (subsumed by Bug 1) |
| A1 | commitLineup controller rule vague | 🟡 | Specify semantics |
| A2 | Payout/season root weak trust | 🟡 | Route through oracle |
| A3 | Insurance insolvency | 🟡 | Reserve ratio guard |
| D1–D5 | Implicit rules undocumented | 📝 | Document only |
| Bonus | Tier-gate enforcement | 🟡 | Add `minTier` field |

Address these and the flow is solid.
