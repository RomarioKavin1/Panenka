# Handoff — ManagerCup v1.5 Build

> **Purpose:** Fresh context for the next agent (human or AI) picking up this build. Read this entire file before doing anything.
> **Last updated:** 2026-05-29, after Plan 2 was written and committed.

---

## 1. Project at a glance

**Product:** ManagerCup — a daily-cadence fantasy football game for the 2026 FIFA World Cup, built for the **OKX Build X Hackathon (xCup track)**, deployed on **OKX X Layer (Polygon CDK ZK L2, chain `1952`)**.

**Repo:** `https://github.com/RomarioKavin1/OKX-Hackathon`
**Working directory:** `/Users/romariokavin/Documents/PersonalProjects/OkX hackathon`
**User:** Romario Kavin · `hello@decimal.at` · GitHub `RomarioKavin1`

The product is a **daily fantasy game with NFT cards + a rental market**. Highlights:
- ERC-721 + ERC-4907 player cards across 4 tiers (Common / Rare / Super Rare / Unique)
- Per-matchday on-chain card rentals (88% owner / 10% platform / 2% original-buyer split)
- Free + tier-gated paid contests; USDC entry fees, Merkle-proof payouts
- N-of-M oracle multi-sig posts score + DNP + payout + season Merkle roots
- DNP insurance with on-chain solvency reserve guard

---

## 2. Where we are right now

### Branch state

- **Current branch:** `feat/v1.5-economy-expansion`
- **Diverged from:** `feat/v1-gaps-hardening` (which is merged-ready vs `main`)
- **Status vs origin:** ahead by 1 commit (the Plan 2 doc was committed locally but NOT pushed yet — push when next milestone is reached)
- **Uncommitted local artifacts (ignore):**
  - `frontend/package-lock.json` (touched by `npm install` during setup; do not commit)
  - `contracts/foundry.lock` (untracked, from `forge install`; do not commit)

### Plans completed

| Plan | File | Status |
|---|---|---|
| Plan 1 — v1 Gaps & Hardening | `docs/superpowers/plans/2026-05-29-v1-gaps-hardening.md` | **✅ Complete**, tagged `v1.0.0-testnet`, pushed |
| Plan 2 — v1.5 Economy Expansion | `docs/superpowers/plans/2026-05-29-v1.5-economy-expansion.md` | 🟡 **In progress** — plan written, branch created, Task A1 in_progress |
| Plan 3 — v2 Bench & Strategic Depth | not yet written | pending |
| Plan 4 — v2 Country Factions | not yet written | pending |
| Plan 5 — v2 Moments & Composability | not yet written | pending |
| Plan 6 — Native Mobile App | not yet written | pending |

### Current task

**Task A1: PackSale Diamond test** (status: `in_progress`)

The plan's Phase A1 is to write a Foundry test at `contracts/test/PackSaleDiamond.t.sol` that proves Diamond pack behavior. The exact code to write is in Plan 2 §A1.

Important pre-discovery I already did: `PackSale.sol` uses `mapping(uint8 => uint16[4]) public tierCum` — i.e. it ALREADY supports arbitrary pack types via mapping keys. So **Task A2 ("Extend PackSale for 4th tier") is a no-op verification**: the contract already supports type 3 (Diamond) without source changes. The implementer for A1 just needs to confirm the test passes after writing it; if it passes, mark A2 immediately complete.

---

## 3. The workflow being used

**Skill stack** (in load order):

1. `superpowers:using-superpowers` (auto-loaded at session start)
2. `superpowers:brainstorming` (used to design the game; completed)
3. `superpowers:writing-plans` (used to draft Plans 1 and 2)
4. `superpowers:subagent-driven-development` (current driver — every task gets implementer → spec reviewer → quality reviewer)

**Per-task loop:**

```
1. Mark task in_progress via TaskUpdate
2. Dispatch implementer subagent with FULL TASK TEXT + scene-setting context
   (the subagent has no prior conversation context — give it everything it needs)
3. If implementer reports DONE: dispatch spec compliance reviewer
4. If spec ✅: dispatch code quality reviewer
5. If quality ✅: mark task completed via TaskUpdate
6. Move to next task immediately — do NOT pause to check in with the user
   (continuous-execution rule from subagent-driven-development skill)
```

**Reviewer pattern:** for tasks where the implementer report is strong and the spec is verbatim code, you can combine spec + quality reviewers into a single subagent dispatch with two `## Phase 1 — Spec` and `## Phase 2 — Quality` sections in the prompt. I did this for B3 onward in Plan 1 — works fine.

**Model selection:**
- `haiku` for mechanical tasks with verbatim specs (Foundry scripts, test files copied from plan, doc files)
- `sonnet` for tasks needing judgment (refactoring publish.ts, fixing the /live crash bug, writing new contracts from a sketched API)
- `opus` if you hit a BLOCKED retry or genuinely architectural decision

**Parallel dispatch:** OK for independent doc tasks (e.g., E1+E2+E4+E5 in Plan 1 ran in parallel). NEVER parallel-dispatch implementers that touch the same file or both attempt to commit at the same time — git locking risk.

**For UI tasks:** dispatch a **Chrome subagent** at the end of the plan (G2 in both Plan 1 and Plan 2) to walk through pages in a real browser. The Chrome subagent must:
1. Load `mcp__claude-in-chrome__*` tools via `ToolSearch` (they're deferred)
2. Call `tabs_context_mcp` with `createIfEmpty=true`
3. Navigate, read page text, check console messages
4. NOT attempt Privy login or interactive auth
5. NOT trigger transactions

---

## 4. User-facing rules (non-negotiable)

These came from explicit user feedback during the session. Memory entries are in:
`/Users/romariokavin/.claude/projects/-Users-romariokavin-Documents-PersonalProjects-OkX-hackathon/memory/`

1. **NO `Co-Authored-By: Claude` trailer** on ANY commit. Use HEREDOC commit messages without that trailer. (User rejected one commit because of it.)

2. **NO deadlines** in any documentation. The user is building this fully, not racing the May 28 2026 23:59 UTC hackathon submission window. PRD, design spec, plans — none mention deadlines.

3. **User prefers in-chat ideation** over the visual companion / browser-based brainstorming UI.

4. **Real player content is a content task, not a code task.** The product currently has 52 demo players across FRA/ARG/ENG/BRA. Filling all 1,300 World Cup players is out of scope for any plan — needs FIFA squad data + likeness rights. Was Task D2 in Plan 1, marked `deleted` (not "completed") with this rationale.

---

## 5. Tech stack & conventions

### Contracts (`/contracts`)

- Solidity 0.8.24, paris EVM
- Foundry (forge)
- OpenZeppelin v5.0.2 (do NOT install v5.6+ — it requires solc 0.8.25 for `mcopy` opcode)
- forge-std at latest
- libs are in `contracts/lib/` and gitignored — run `forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.0.2` if missing
- Baseline tests: **55 passing** (50 from prior + 5 from Plan 1 Task A2)

### Frontend (`/frontend`)

- Next.js 16.2.6 (App Router; routes use async `params` per Next 16 conventions — read `node_modules/next/dist/docs/` after `npm install`)
- React 19
- TypeScript
- Tailwind v4 (CSS-config, NOT a `tailwind.config.js`)
- Privy for wallet auth (`@privy-io/react-auth`) — first-class, plus MetaMask / WalletConnect
- wagmi + viem v2 for chain interactions
- Supabase for read layer (`@supabase/supabase-js` + `@supabase/ssr`)
- @tanstack/react-query v5
- `merkletreejs`
- Vitest for tests
- Baseline tests: **398 passing**, **0 typecheck errors**, **0 new lint errors** (8 pre-existing warnings)

### Off-chain services (`frontend/services/`)

- `indexer/` — viem logs → Supabase decoders (decode.ts is pure functions; no runner shipped)
- `oracle/` — `ingest.ts`, `score.ts`, `publish.ts` (supports SIGNER_KEYS multi-signer loop), `rollover.ts`, `season.ts`, `roots.ts`
- `livescore/` — `replay.ts` (websocket-style live ticker)
- `lifecycle/` — `cron.ts` (matchday lifecycle worker)

### Verifier (`frontend/verifier/`)

Public CLI: `cd frontend && npm run verify -- <matchday>` reproduces score Merkle root from public match data.

### Database (Supabase)

URL is in repo-root `.env`: `NEXT_PUBLIC_SUPABASE_URL=https://jwylnndtmfyxnngfyuqq.supabase.co`. Migrations in `frontend/supabase/migrations/`.

**Migrations applied so far:**
- `20260528150515_init.sql` — base schema (cards, marketplace_listings, rentals, scores, contests, etc.)
- `20260528184817_live_scores.sql` — live scoring table

**Plan 2 will add:**
- `20260530000000_v1.5_economy.sql` — `private_leagues`, `league_members`, `chip_drops` tables

### RLS rule

Every `public.*` table has RLS enabled. Browse data has `SELECT TO anon USING (true)`. All writes go through `supabaseAdmin()` (service-role) from server-only code. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

---

## 6. Deployed contracts (X Layer testnet, chain 1952)

| Contract | Address |
|---|---|
| MockUSDC | `0x29A46d0376C41423FF2aa9425A13c44FC53a1850` |
| CardNFT | `0xa6188b7eCb3638A3b7Fbb855089cdCFc84dE36c9` |
| ChipNFT | `0x2991dF527c84823a16917f425E24e746EE31F314` |
| PackSale | `0x0136b193EE83BffC55262aAFC411efd578F9e8D5` |
| Marketplace | `0x4b1c73E8d59FD4a0EB1525A1255d64FEE05aF7C8` |
| GameRegistry | `0x53d6CBe6bcA72396Fe1E5AD8E2249a78Ec79D5fC` |
| RentalMarket | `0x7a809b6e51b5DeE675036F24F76Eeb149C0f266c` |
| ScoreOracle | `0x3470694dD5Afd5474F916B89C108bBB85d05A295` (1-of-1 signer = deployer, will be 3-of-5 once external signers are recruited) |
| ContestEscrow | `0x00B08f0E928933422A7b623E475Dd84b2B98BaA4` |
| InsurancePool | `0xc6d3061ccEA1c25769962A9cBDcee293Aaf698fB` |
| SeasonLeaderboard | `0x9D696CBB6BD4DcfA322C14Ff74B662560aa5C2d8` |

Plan 2 will deploy:
- `UniqueAuction` (TBD address — set after Phase B)
- `ChipDropMinter` (TBD address — set after Phase C)

Deployer: `0xA3327d90d087cdddfB99E598E50B5Bdee7fC55bD` (start block 31509019).

RPC: `https://testrpc.xlayer.tech`. Explorer: `https://www.oklink.com/xlayer-test`.

---

## 7. Environment

**Repo-root `.env`** (gitignored; user has it open in IDE — may or may not be relevant):

```
PRIVATE_KEY=0x...                                 # deployer/oracle signer key
RPC_URL=https://testrpc.xlayer.tech
CHAIN_ID=1952
SIGNER_KEYS=                                      # comma-sep multi-signer (optional, falls back to PRIVATE_KEY)
SUPABASE_SERVICE_ROLE_KEY=...                     # server-only, do NOT expose
API_FOOTBALL_KEY=...                              # match data feed
NEXT_PUBLIC_SCORE_ORACLE_SIGNERS=                 # display roster on /transparency
```

`.env.example` mirrors the shape with placeholders.

**Frontend `.env.local`** (browser-visible, `NEXT_PUBLIC_` prefix only):

```
NEXT_PUBLIC_SUPABASE_URL=https://jwylnndtmfyxnngfyuqq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_zADdGfIGyo3CAkIsol-roA_TXcDjyMA
NEXT_PUBLIC_PRIVY_APP_ID=<set by user — if missing, Privy login spins forever>
```

The Privy app ID may be missing in the local dev env. Confirmed in browser walkthrough — pages like `/onboard` and `/settings` show persistent "Loading…" spinner. **Not a code bug**; just a local-dev config gap.

---

## 8. Reference documents (read in this order)

1. **`HANDOFF.md`** (this file) — operating context
2. **`PRD.md`** — product requirements; FR-* identifiers used throughout plans
3. **`HACKATHON_CONTEXT.md`** — OKX Build X xCup ecosystem framing
4. **`docs/superpowers/specs/2026-05-28-football-card-fantasy-design.md`** — original design spec
5. **`docs/contracts/contract-surface.md`** — corrected function-level API surface
6. **`docs/contracts/flow-issues.md`** — known issues + design ambiguities
7. **`CONTRACTS.md`** — function reference for all 10 deployed contracts
8. **`docs/E2E-LIFECYCLE.md`** — end-to-end test walkthrough
9. **`docs/superpowers/plans/2026-05-29-v1-gaps-hardening.md`** — Plan 1 (completed; reference for conventions)
10. **`docs/superpowers/plans/2026-05-29-v1.5-economy-expansion.md`** — Plan 2 (THE CURRENT PLAN — execute this next)
11. **`README.md`** — public-facing project intro
12. **`docs/compliance/*`** — risk-jurisdictions, ToS, privacy-policy, fair-play, signer-agreement, incident-playbook, bug-bounty

---

## 9. The TaskCreate task list

The session task list currently has tasks #35 through #56 for Plan 2. Task #35 (A1) is `in_progress`; everything after is `pending`. If you're a fresh agent, you can re-create them by reading Plan 2's phase headings — each `### Task X:` heading becomes a TaskCreate entry. Use the same labels I did (A1, A2, A3, B1, B2, B3, ...) to stay aligned with the plan.

---

## 10. How to start work (the literal first 5 steps)

1. **Confirm baseline is still green** (you may need to install deps if this is a fresh clone or after `git clean`):

```bash
cd "/Users/romariokavin/Documents/PersonalProjects/OkX hackathon"
git status
git branch --show-current        # expect: feat/v1.5-economy-expansion
git log --oneline -3              # expect: top commit = "docs: Plan 2 — v1.5 economy expansion implementation plan"

# Contracts baseline
cd contracts
[ -d lib ] || forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.0.2
forge test 2>&1 | tail -3        # expect: 55 passed

# Frontend baseline
cd ../frontend
[ -d node_modules ] || npm install
npm test 2>&1 | tail -3          # expect: 398 passed
```

2. **Open `docs/superpowers/plans/2026-05-29-v1.5-economy-expansion.md`** and read Phase A.

3. **Re-create the TaskCreate task list** for Plan 2 (22 tasks: A1-A3, B1-B3, C1-C4, D1-D2, E1-E2, F1-F4, G1-G4). The subjects + descriptions from the Plan 2 phase headings map 1:1 to TaskCreate inputs.

4. **Dispatch the first implementer subagent for Task A1.** The full task text is in Plan 2 §A1. Use the implementer-prompt pattern from `superpowers:subagent-driven-development`. Key context lines to include:
   - Branch: `feat/v1.5-economy-expansion`
   - Working dir: `/Users/romariokavin/Documents/PersonalProjects/OkX hackathon`
   - PackSale already supports type 3 via `mapping(uint8 => ...)` — no contract modification needed
   - NO `Co-Authored-By: Claude` in commit messages

5. **Proceed task-by-task through Plan 2** with implementer → spec reviewer → quality reviewer per task. Mark complete via TaskUpdate. Do not pause for user confirmation between tasks.

---

## 11. Things to watch for

- **Next.js 16 deprecation warning:** `middleware.ts` triggers `The "middleware" file convention is deprecated. Please use "proxy" instead`. Plan 1 used the legacy filename; this works but might need migration to `proxy.ts` for Next 17. Track as a follow-up, not blocking.

- **publish.ts short-circuit dead code:** the `submitRootWithSigners` loop string-matches `"AlreadyExists" + "finali"` to detect finalization. The contract custom error is just `AlreadyExists()` with no message — so the short-circuit never triggers. Behavior is still correct (lastReceipt set from prior success), but wastes 1–2 RPC calls. Final reviewer in Plan 1 flagged it. Not blocking; track as follow-up. The fix: check `finalized(matchday)` via on-chain read at loop top.

- **`/live/[matchday]` crash:** fixed in Plan 1 (`fix(ui): guard supabaseBrowser init`). The pattern `supabaseBrowser()` can throw when env vars are missing — always wrap in try/catch inside useEffect.

- **Tests excluded from default `npm test`:** integration tests live in `*.it.test.ts` and run via `npm run test:it`. The geofence test is `lib/__tests__/geofence.test.ts` — runs in the default suite.

- **Privy + Next 16 quirk:** `useWallets()` called outside `PrivyProvider` logs warnings repeatedly. There's a header/nav component invoking it pre-provider; not a runtime bug but noisy.

- **Wallet address normalization:** ALWAYS lowercase wallet strings before Supabase comparisons. Both writers (publish.ts, indexer decode.ts) and readers use lowercase. Mixing case → no match.

- **`scores` table is the source of truth** for payout history, NOT a `v_claims` view over `events`. The `events` table has no anon read policy. Plan 1's B1 explicitly diverged from the plan-sketch to use `scores` directly.

- **Player likeness rights** are an open decision (PRD §11 #3). All current player names + nations are placeholders for a demo squad of 52 across FRA/ARG/ENG/BRA.

---

## 12. Hand-off contact + state-of-mind

User has been moving fast and decisively. Pattern:
- "make plans" → wants the plan written
- "use subagent driven development" → wants me to execute autonomously
- "push it and start plan 2" → keep momentum, no need to check in for every milestone

The user just opened `.env` in their IDE — likely setting up secrets locally. Don't assume that's a signal to stop; just continue Plan 2 unless they say otherwise.

**The most important thing:** the user wants to ship the full PRD scope (all of v1 + v1.5 + v2). We're plan 2 of 6. Don't lose that long-term goal. Push back if a task looks like dead-end work for the v2 vision.

---

## 13. Quick-reference commands

```bash
# Run all contract tests
cd contracts && forge test

# Run all frontend tests (unit)
cd frontend && npm test

# Run integration tests (requires API_FOOTBALL_KEY + Supabase service role)
cd frontend && npm run test:it

# Type-check
cd frontend && npm run typecheck

# Lint
cd frontend && npm run lint

# Dev server (background)
cd frontend && npm run dev > /tmp/dev.log 2>&1 &

# Stop dev server
pkill -f "next dev"

# Regenerate ABIs from Foundry build artifacts
cd frontend && npm run gen-abis      # or: node scripts/gen-abis.mjs

# Apply pending Supabase migrations
cd frontend && npx supabase db push

# Deploy contracts to testnet
cd contracts && forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY

# Seed paid contests for a matchday (Plan 2 §D1)
cd contracts && MATCHDAY=1 CONTEST_ESCROW=0x00B0... forge script script/SeedContests.s.sol --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY

# Add 4 oracle signers + bump threshold (Plan 1 §A1)
cd contracts && SCORE_ORACLE=0x3470... SIGNER_1=0x... SIGNER_2=0x... SIGNER_3=0x... SIGNER_4=0x... ORACLE_THRESHOLD=3 forge script script/AddSigners.s.sol --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY

# Run the public verifier
cd frontend && npm run verify -- <matchday>

# Push v1 work + tag (already done)
git push origin feat/v1-gaps-hardening v1.0.0-testnet

# Push v1.5 work (when ready)
git push origin feat/v1.5-economy-expansion v1.5.0-testnet
```

---

## 14. Failure modes & recovery

- **Subagent reports BLOCKED:** read the blocker. If it's "context missing," provide it and re-dispatch. If it's "task too large," split the task in the plan. If it's "spec is wrong," escalate to user.

- **Spec reviewer ❌:** implementer fixes inline; re-dispatch spec reviewer.

- **Quality reviewer ❌:** implementer fixes inline; re-dispatch quality reviewer. Don't skip the re-review.

- **Tests regress:** find the breaking commit (`git log --oneline`), inspect the diff. Plan 1 found a regression once — `Marketplace.list` failing under active rental because the implementer subtly broke the `_update` hook. Fixed by reverting the wrong sub-change.

- **Dev server won't start:** check `tail -40 /tmp/dev.log`. Common issues: missing env vars (NEXT_PUBLIC_*), port 3000 busy (`lsof -i :3000`), Next.js cache stale (`rm -rf frontend/.next`).

- **Forge install fails:** network issue or git config. Verify with `forge --version`. Re-run `forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.0.2`.

---

## 15. Definition of done (for handoff context)

You are "done" with Plan 2 when:

- All 22 tasks (A1-G4) are marked completed via TaskUpdate
- `cd contracts && forge test` → 66+ passing
- `cd frontend && npm test` → 400+ passing
- `npm run typecheck` → zero errors
- `npm run lint` → zero new errors
- The 4 new paid contest tiers are seeded on testnet for at least one matchday
- `UniqueAuction` + `ChipDropMinter` are deployed and recorded in `contracts/deployments/xlayer-testnet.json`
- A Chrome subagent walkthrough confirms `/auction`, `/packs` (with Diamond), `/portfolio` (with chip-drop badge), `/league` all render without crashes
- README has a v1.5 section
- Tag `v1.5.0-testnet` exists locally + pushed to origin
- Branch `feat/v1.5-economy-expansion` pushed

Then dispatch the **final code reviewer subagent** (model=sonnet, scope = entire branch diff vs `feat/v1-gaps-hardening`) per the subagent-driven-development workflow.

After that: `superpowers:finishing-a-development-branch` to merge / PR / clean up.

Then start Plan 3 (v2 Bench & Strategic Depth) per the decomposition outlined in §2.

---

**End of handoff. Good luck.**
