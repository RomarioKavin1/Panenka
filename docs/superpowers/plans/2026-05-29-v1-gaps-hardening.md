# Plan 1 — v1 Gaps & Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every remaining v1 gap so ManagerCup is a credible, trust-minimized product on X Layer — not just a working demo.

**Architecture:** Six independent phases — oracle multi-sig hardening, UI placeholder completion, live API-Football wiring, player content completeness, Stream F compliance basics, transparency page. Each phase produces shippable software on its own; no phase blocks the others except for Phase A (signers must be onboarded before B-F can credibly demo trustlessness).

**Tech Stack:** Solidity / Foundry (contracts), TypeScript / Next.js 16 App Router / React 19 (frontend), Vitest (tests), Supabase (read layer), viem v2 (chain reads), Privy (wallet auth), API-Football (match data), `merkletreejs` (Merkle proofs).

---

## Reference docs (read before starting)

- Product requirements: `PRD.md` (all FR-* identifiers referenced here)
- Design spec: `docs/superpowers/specs/2026-05-28-football-card-fantasy-design.md`
- Contract surface: `docs/contracts/contract-surface.md` (corrected v1)
- Flow issues: `docs/contracts/flow-issues.md`
- Existing build plan: `docs/superpowers/plans/2026-05-28-managercup-build.md` (what's already shipped)
- Contract reference: `CONTRACTS.md`
- Deployed addresses: `contracts/deployments/xlayer-testnet.json` (chain `1952`)
- Lifecycle walkthrough: `docs/E2E-LIFECYCLE.md`
- Hackathon framing: `HACKATHON_CONTEXT.md`

## Pre-flight (run once before starting)

- [ ] **Step 1:** Confirm you're on `main`, working tree clean:
  ```bash
  cd "/Users/romariokavin/Documents/PersonalProjects/OkX hackathon"
  git status   # expect: clean working tree
  git pull --ff-only
  ```
- [ ] **Step 2:** Confirm contracts test suite still green:
  ```bash
  cd contracts && forge test
  # expect: 50 passed; 0 failed
  ```
- [ ] **Step 3:** Confirm frontend tests still green:
  ```bash
  cd ../frontend && npm test
  # expect: all green
  ```
- [ ] **Step 4:** Confirm dev server boots:
  ```bash
  cd frontend && npm run dev
  # expect: server starts on :3000 with no compile errors
  # ctrl-c after seeing "ready"
  ```

## File structure (created/modified across this plan)

```
contracts/
  script/
    AddSigners.s.sol               ← NEW (Task A1)
    RotateOracle.s.sol             ← NEW (Task A3)
  test/
    ScoreOracle.signers.t.sol      ← NEW (Task A2)

frontend/
  app/
    (app)/
      settings/page.tsx            ← MODIFY (Task B2)
      portfolio/page.tsx           ← MODIFY (Task B4)
      u/[wallet]/page.tsx          ← MODIFY (Task B4)
      transparency/page.tsx        ← MODIFY (Task F1, F2, F3)
    api/
      profile/
        claims/route.ts            ← NEW (Task B1)
        career/route.ts            ← NEW (Task B3)
      transparency/
        signers/route.ts           ← NEW (Task F1)
  lib/
    data/
      players.ts                   ← MODIFY (Task D2)
      traits.ts                    ← MODIFY (Task D2)
      formationSynergy.ts          ← MODIFY (Task D3)
    geofence.ts                    ← NEW (Task E3)
  middleware.ts                    ← NEW (Task E3)
  services/oracle/
    ingest.it.test.ts              ← MODIFY (Task C1)
    publish.ts                     ← MODIFY (Task A4)
  scripts/
    audit-players.ts               ← NEW (Task D1)
  supabase/migrations/
    20260529NNNNNN_claim_history.sql ← NEW (Task B1)

docs/
  compliance/
    risk-jurisdictions.md          ← NEW (Task E1)
    terms-of-service.md            ← NEW (Task E2)
    privacy-policy.md              ← NEW (Task E2)
    fair-play.md                   ← NEW (Task E2)
    signer-agreement-template.md   ← NEW (Task E4)
    incident-playbook.md           ← NEW (Task E5)
    bug-bounty.md                  ← NEW (Task E5)
```

## Conventions

- All paths absolute or relative to `/Users/romariokavin/Documents/PersonalProjects/OkX hackathon`.
- Frontend commands run from `frontend/`. Contract commands from `contracts/`.
- Tests use **vitest** (frontend) and **Foundry** (contracts).
- **TDD discipline:** for code tasks — failing test → run (red) → minimal impl → run (green) → commit. For doc tasks: write → manual review → commit.
- **Commit after every green step.** Never use `--no-verify`. Never commit secrets.
- New env vars go in repo-root `.env` (gitignored, server-only) or `frontend/.env.local` (browser-public, `NEXT_PUBLIC_` prefix only).
- New Supabase work uses `supabaseAdmin()` (service-role) from server-only code; reads use `supabaseAnonServer()` or `supabaseBrowser()`.
- For UI changes, the project rule applies: **start dev server and use the feature in a browser** before marking complete. Type checks verify code, not feature correctness.

---

# PHASE A — Oracle multi-sig hardening

**Goal:** Promote `ScoreOracle` from 1-of-1 (deployer signer) to 3-of-5 multi-sig with documented external signers. This is the single largest trust delta in v1.

### Task A1: Foundry script to add 4 signers and bump threshold

**Files:**
- Create: `contracts/script/AddSigners.s.sol`

- [ ] **Step 1:** Create the script that reads 4 signer addresses from env and adds them:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {ScoreOracle} from "../src/ScoreOracle.sol";

contract AddSigners is Script {
    function run() external {
        address oracleAddr = vm.envAddress("SCORE_ORACLE");
        address signer1 = vm.envAddress("SIGNER_1");
        address signer2 = vm.envAddress("SIGNER_2");
        address signer3 = vm.envAddress("SIGNER_3");
        address signer4 = vm.envAddress("SIGNER_4");
        uint256 newThreshold = vm.envUint("ORACLE_THRESHOLD");

        require(newThreshold > 0 && newThreshold <= 5, "bad threshold");

        vm.startBroadcast();
        ScoreOracle o = ScoreOracle(oracleAddr);
        o.setSigner(signer1, true);
        o.setSigner(signer2, true);
        o.setSigner(signer3, true);
        o.setSigner(signer4, true);
        o.setThreshold(newThreshold);
        vm.stopBroadcast();
    }
}
```

- [ ] **Step 2:** Compile:
  ```bash
  cd contracts && forge build
  # expect: compiles cleanly
  ```
- [ ] **Step 3:** Commit:
  ```bash
  git add contracts/script/AddSigners.s.sol
  git commit -m "feat(contracts): script to bootstrap ScoreOracle 3-of-5 multi-sig"
  ```

### Task A2: Foundry test — signer add/remove + threshold change

**Files:**
- Create: `contracts/test/ScoreOracle.signers.t.sol`

- [ ] **Step 1:** Write a failing test that asserts (a) adding signers works, (b) removing works, (c) threshold change blocks finalization until reached, (d) only owner can rotate signers:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ScoreOracle} from "../src/ScoreOracle.sol";
import {Errors} from "../src/libs/Errors.sol";

contract ScoreOracleSignersTest is Test {
    ScoreOracle oracle;
    address owner = address(0xA);
    address signer1 = address(0xB);
    address signer2 = address(0xC);
    address signer3 = address(0xD);
    address signer4 = address(0xE);
    address signer5 = address(0xF);
    address attacker = address(0x999);

    function setUp() public {
        address[] memory init = new address[](1);
        init[0] = signer1;
        vm.prank(owner);
        oracle = new ScoreOracle(init, 1);
    }

    function test_OwnerCanAddSigners() public {
        vm.prank(owner);
        oracle.setSigner(signer2, true);
        assertTrue(oracle.isSigner(signer2));
    }

    function test_NonOwnerCannotAddSigners() public {
        vm.expectRevert();
        vm.prank(attacker);
        oracle.setSigner(signer2, true);
    }

    function test_OwnerCanRotateThreshold() public {
        vm.prank(owner);
        oracle.setThreshold(3);
        assertEq(oracle.threshold(), 3);
    }

    function test_FinalizationRequiresThresholdVotes() public {
        // 3-of-3 setup: add signers 2, 3 and bump threshold
        vm.startPrank(owner);
        oracle.setSigner(signer2, true);
        oracle.setSigner(signer3, true);
        oracle.setThreshold(3);
        vm.stopPrank();

        bytes32 scoreR = keccak256("score-1");
        bytes32 dnpR = keccak256("dnp-1");

        // 1 vote — not finalized
        vm.prank(signer1);
        oracle.submitRoot(1, scoreR, dnpR);
        assertFalse(oracle.finalized(1));

        // 2 votes — still not finalized
        vm.prank(signer2);
        oracle.submitRoot(1, scoreR, dnpR);
        assertFalse(oracle.finalized(1));

        // 3 votes — finalized
        vm.prank(signer3);
        oracle.submitRoot(1, scoreR, dnpR);
        assertTrue(oracle.finalized(1));
        assertEq(oracle.roots(1), scoreR);
        assertEq(oracle.dnpRoots(1), dnpR);
    }

    function test_RemovedSignerCannotVote() public {
        vm.prank(owner);
        oracle.setSigner(signer1, false);

        vm.expectRevert(Errors.NotAuthorized.selector);
        vm.prank(signer1);
        oracle.submitRoot(1, keccak256("a"), keccak256("b"));
    }
}
```

- [ ] **Step 2:** Run, expect failure (compilation may succeed but if any assertion mismatches the existing contract, you'll see it now):
  ```bash
  cd contracts && forge test --match-contract ScoreOracleSignersTest -vv
  # expect: 5 tests, all passing if ScoreOracle is correct
  ```
  If a test fails, the existing `ScoreOracle.sol` has a bug — fix it before continuing.
- [ ] **Step 3:** Commit:
  ```bash
  git add contracts/test/ScoreOracle.signers.t.sol
  git commit -m "test(contracts): signer rotation + threshold change in ScoreOracle"
  ```

### Task A3: Operational script — rotate signers on testnet

**Files:**
- Create: `contracts/script/RotateOracle.s.sol`

- [ ] **Step 1:** Build a script that takes a comma-separated list of signers via env and a new threshold. Read existing signers from chain state (loop possible since `isSigner` is public mapping with no enumerator — so this script uses an env list of CURRENT signers to remove, plus a list to add):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {ScoreOracle} from "../src/ScoreOracle.sol";

contract RotateOracle is Script {
    function run() external {
        ScoreOracle oracle = ScoreOracle(vm.envAddress("SCORE_ORACLE"));
        address[] memory toRemove = vm.envAddress("REMOVE_SIGNERS", ",");
        address[] memory toAdd = vm.envAddress("ADD_SIGNERS", ",");
        uint256 newThreshold = vm.envUint("ORACLE_THRESHOLD");

        vm.startBroadcast();
        for (uint256 i = 0; i < toRemove.length; i++) oracle.setSigner(toRemove[i], false);
        for (uint256 i = 0; i < toAdd.length; i++) oracle.setSigner(toAdd[i], true);
        oracle.setThreshold(newThreshold);
        vm.stopBroadcast();
    }
}
```

- [ ] **Step 2:** Compile:
  ```bash
  cd contracts && forge build
  # expect: clean
  ```
- [ ] **Step 3:** Commit:
  ```bash
  git add contracts/script/RotateOracle.s.sol
  git commit -m "feat(contracts): operational script to rotate oracle signers"
  ```

### Task A4: Update publish.ts to require N-of-M before publishing

**Files:**
- Modify: `frontend/services/oracle/publish.ts`

- [ ] **Step 1:** Read existing publish.ts to understand its current contract:
  ```bash
  cd frontend && sed -n '1,80p' services/oracle/publish.ts
  ```
- [ ] **Step 2:** Find the place where the script submits a root (likely a single `submitRoot` call). Replace with a loop: take a comma-separated `SIGNER_KEYS` env var (one privkey per signer this worker controls — for a real 3-of-5 each worker may hold 1, not all), and have each signer call `submitRoot` in sequence. The contract already tracks votes per-signer; this loop just makes it so a worker holding multiple keys can submit them all in one job. Code (add at the top of the function that posts):

```typescript
// publish.ts — fragment, near where current root submission happens
const keys = (process.env.SIGNER_KEYS ?? process.env.PRIVATE_KEY ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

if (keys.length === 0) throw new Error("no signer keys configured");

for (const pk of keys) {
  const wallet = getScriptWalletClient(pk as `0x${string}`);
  const account = wallet.account!;
  const hash = await submitScoreRoot(wallet, matchday, scoreRoot, dnpRoot, account.address);
  await waitFor(hash);
  console.log(`submitted by ${account.address}`);
}
```

- [ ] **Step 3:** Write a vitest unit test (in `services/oracle/publish.test.ts` if not present, otherwise extend) that mocks `submitScoreRoot` and asserts the loop calls once per key:

```typescript
// services/oracle/publish.test.ts
import { describe, it, expect, vi } from "vitest";

const submitScoreRoot = vi.fn().mockResolvedValue("0x" + "ab".repeat(32));
const waitFor = vi.fn().mockResolvedValue(undefined);

vi.mock("../../lib/actions/writes", () => ({
  submitScoreRoot,
  waitFor,
}));

describe("publish.ts signer loop", () => {
  it("calls submitScoreRoot once per signer key", async () => {
    process.env.SIGNER_KEYS = "0x" + "1".repeat(64) + "," + "0x" + "2".repeat(64);
    // import publish module AFTER env is set; mock as needed for the function under test
    // ... call the publish function ...
    expect(submitScoreRoot).toHaveBeenCalledTimes(2);
  });
});
```

(Adjust the imports and test harness to match the actual exported shape of `publish.ts`.)

- [ ] **Step 4:** Run:
  ```bash
  cd frontend && npm test -- publish
  # expect: pass
  ```
- [ ] **Step 5:** Commit:
  ```bash
  git add frontend/services/oracle/publish.ts frontend/services/oracle/publish.test.ts
  git commit -m "feat(oracle): publish loop submits a root per configured signer key"
  ```

---

# PHASE B — UI placeholders

**Goal:** Replace the two placeholder UI sections with live data backed by Supabase + on-chain reads. Covers FR-T1 (transparency on claim history), FR-G1/FR-G2 (portfolio career stats).

### Task B1: Claim history API endpoint

**Files:**
- Create: `frontend/app/api/profile/claims/route.ts`
- Create: `frontend/supabase/migrations/20260529120000_claim_history.sql`

- [ ] **Step 1:** Write Supabase migration adding a view over the indexed `Claimed` events from `ContestEscrow` + `SeasonLeaderboard`:

```sql
-- 20260529120000_claim_history.sql
create or replace view public.v_claims as
select
  args ->> 'player' as wallet,
  (args ->> 'amount')::numeric as amount,
  contract,
  name as event,
  tx_hash,
  block_number,
  created_at
from public.events
where (name = 'Claimed' or name = 'ClaimedSeason')
order by block_number desc;

grant select on public.v_claims to anon;
```

- [ ] **Step 2:** Apply migration (against the dev Supabase project):
  ```bash
  cd frontend && npx supabase db push
  # expect: applied; verify with `npx supabase db diff` reporting no diff
  ```
- [ ] **Step 3:** Write the route handler that returns paginated claims for a wallet:

```typescript
// app/api/profile/claims/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAnonServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet")?.toLowerCase();
  const limit = Math.min(Number(searchParams.get("limit") ?? 25), 100);

  if (!wallet) return NextResponse.json({ error: "missing wallet" }, { status: 400 });

  const sb = supabaseAnonServer();
  const { data, error } = await sb
    .from("v_claims")
    .select("*")
    .eq("wallet", wallet)
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ claims: data ?? [] });
}
```

- [ ] **Step 4:** Write an integration test that hits the endpoint with a known wallet:

```typescript
// app/api/__tests__/claims.test.ts
import { describe, it, expect } from "vitest";

describe("/api/profile/claims", () => {
  it("returns claims array for a known wallet", async () => {
    const res = await fetch("http://localhost:3000/api/profile/claims?wallet=0xA3327d90d087cdddfB99E598E50B5Bdee7fC55bD");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.claims)).toBe(true);
  });
});
```

- [ ] **Step 5:** Run integration tests (requires dev server running):
  ```bash
  cd frontend && npm run dev &  # background
  npm run test:it -- claims
  # expect: pass; then kill dev server
  ```
- [ ] **Step 6:** Commit:
  ```bash
  git add frontend/app/api/profile/claims/route.ts frontend/supabase/migrations/20260529120000_claim_history.sql frontend/app/api/__tests__/claims.test.ts
  git commit -m "feat(api): claim history endpoint backed by indexer view"
  ```

### Task B2: Wire claim history into Settings UI

**Files:**
- Modify: `frontend/app/(app)/settings/page.tsx`

- [ ] **Step 1:** Locate the "Claim History — placeholder" section in `settings/page.tsx`. Identify the surrounding component structure (it's a `<section>` per the file).
- [ ] **Step 2:** Add a fetcher hook + render:

```typescript
// Inside settings/page.tsx — add to imports
import { useEffect, useState } from "react";

// ... inside the Settings page component, after other state:
const [claims, setClaims] = useState<Array<{
  wallet: string; amount: string; contract: string; event: string;
  tx_hash: string; block_number: number; created_at: string;
}>>([]);
const [claimsLoading, setClaimsLoading] = useState(false);

useEffect(() => {
  if (!address) return;
  let cancelled = false;
  setClaimsLoading(true);
  (async () => {
    try {
      const res = await fetch(`/api/profile/claims?wallet=${address.toLowerCase()}&limit=25`);
      const body = await res.json();
      if (!cancelled) setClaims(body.claims ?? []);
    } finally {
      if (!cancelled) setClaimsLoading(false);
    }
  })();
  return () => { cancelled = true; };
}, [address]);

// Replace the placeholder section with:
<section>
  <h2 className="text-lg font-semibold">Claim history</h2>
  {claimsLoading ? (
    <p className="text-sm text-zinc-500">Loading…</p>
  ) : claims.length === 0 ? (
    <p className="text-sm text-zinc-500">No claims yet.</p>
  ) : (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs uppercase text-zinc-500"><th>Source</th><th>Amount</th><th>Tx</th><th>When</th></tr></thead>
      <tbody>
        {claims.map(c => (
          <tr key={c.tx_hash} className="border-t">
            <td>{c.contract}</td>
            <td>{(BigInt(c.amount) / 1_000_000n).toString()}.{(BigInt(c.amount) % 1_000_000n).toString().padStart(6, "0")} USDC</td>
            <td><a className="text-blue-600 underline" href={`https://www.oklink.com/xlayer-test/tx/${c.tx_hash}`} target="_blank" rel="noreferrer">{c.tx_hash.slice(0, 10)}…</a></td>
            <td>{new Date(c.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</section>
```

- [ ] **Step 3:** Update the file's top-level comment to remove the "placeholder" note for section 3.
- [ ] **Step 4:** Verify in browser:
  ```bash
  cd frontend && npm run dev
  # visit http://localhost:3000/settings, connect a wallet with prior claims,
  # confirm rows render and links go to the explorer
  ```
- [ ] **Step 5:** Commit:
  ```bash
  git add frontend/app/\(app\)/settings/page.tsx
  git commit -m "feat(ui): live claim history in settings"
  ```

### Task B3: Career stats API endpoint

**Files:**
- Create: `frontend/app/api/profile/career/route.ts`

- [ ] **Step 1:** Decide the metrics. Per PRD FR-T1 / FR-T2 / spec §4.10, surface: matchdays played, total points scored, best-day score, total USDC won, total USDC spent (entry fees + rentals), current season-leaderboard rank.

- [ ] **Step 2:** Write the route handler:

```typescript
// app/api/profile/career/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAnonServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface CareerStats {
  matchdaysPlayed: number;
  totalPoints: number;
  bestDayScore: number;
  totalWon: string;   // USDC base units
  totalSpent: string; // USDC base units
  seasonRank: number | null;
}

export async function GET(req: NextRequest) {
  const wallet = new URL(req.url).searchParams.get("wallet")?.toLowerCase();
  if (!wallet) return NextResponse.json({ error: "missing wallet" }, { status: 400 });

  const sb = supabaseAnonServer();
  const [{ data: lineups }, { data: claims }, { data: entries }, { data: rentals }] = await Promise.all([
    sb.from("events").select("args, name").eq("name", "LineupCommitted").contains("args", { wallet }),
    sb.from("v_claims").select("amount").eq("wallet", wallet),
    sb.from("events").select("args").eq("name", "Entered").contains("args", { player: wallet }),
    sb.from("events").select("args").eq("name", "Rented").contains("args", { renter: wallet }),
  ]);

  const matchdaysPlayed = (lineups ?? []).length;
  const totalWon = (claims ?? []).reduce((acc, c) => acc + BigInt(c.amount), 0n);
  const totalSpent = (entries ?? []).reduce((acc, e) => acc + BigInt(e.args.entryFee ?? "0"), 0n)
                  + (rentals ?? []).reduce((acc, r) => acc + BigInt(r.args.paid ?? "0"), 0n);

  // Per-matchday points require a score-table lookup; left as a follow-up if not yet indexed.
  // Surface placeholder zeros for now — never show "—" to the user.
  const stats: CareerStats = {
    matchdaysPlayed,
    totalPoints: 0,
    bestDayScore: 0,
    totalWon: totalWon.toString(),
    totalSpent: totalSpent.toString(),
    seasonRank: null,
  };

  return NextResponse.json(stats);
}
```

- [ ] **Step 3:** Integration test:

```typescript
// app/api/__tests__/career.test.ts
import { describe, it, expect } from "vitest";

describe("/api/profile/career", () => {
  it("returns career stats shape for a wallet", async () => {
    const res = await fetch("http://localhost:3000/api/profile/career?wallet=0xA3327d90d087cdddfB99E598E50B5Bdee7fC55bD");
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(typeof s.matchdaysPlayed).toBe("number");
    expect(typeof s.totalWon).toBe("string");
    expect(typeof s.totalSpent).toBe("string");
  });
});
```

- [ ] **Step 4:** Run:
  ```bash
  cd frontend && npm run dev &
  npm run test:it -- career
  # expect: pass
  ```
- [ ] **Step 5:** Commit:
  ```bash
  git add frontend/app/api/profile/career/route.ts frontend/app/api/__tests__/career.test.ts
  git commit -m "feat(api): career stats endpoint"
  ```

### Task B4: Wire career stats into Portfolio + user profile pages

**Files:**
- Modify: `frontend/app/(app)/portfolio/page.tsx`
- Modify: `frontend/app/(app)/u/[wallet]/page.tsx`

- [ ] **Step 1:** In `portfolio/page.tsx`, locate the "Career stats placeholder" comment. Add a fetch hook and render:

```typescript
// portfolio/page.tsx additions
import { useEffect, useState } from "react";

interface CareerStats {
  matchdaysPlayed: number; totalPoints: number; bestDayScore: number;
  totalWon: string; totalSpent: string; seasonRank: number | null;
}

const [career, setCareer] = useState<CareerStats | null>(null);

useEffect(() => {
  if (!address) return;
  let cancelled = false;
  (async () => {
    const res = await fetch(`/api/profile/career?wallet=${address.toLowerCase()}`);
    if (!res.ok) return;
    const body = await res.json();
    if (!cancelled) setCareer(body);
  })();
  return () => { cancelled = true; };
}, [address]);

// Render in place of placeholder:
{career && (
  <section className="rounded-lg border bg-white p-4">
    <h2 className="mb-3 text-lg font-semibold">Career stats</h2>
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div><dt className="text-zinc-500">Matchdays played</dt><dd className="font-mono">{career.matchdaysPlayed}</dd></div>
      <div><dt className="text-zinc-500">Total won</dt><dd className="font-mono">{(BigInt(career.totalWon) / 1_000_000n).toString()} USDC</dd></div>
      <div><dt className="text-zinc-500">Total spent</dt><dd className="font-mono">{(BigInt(career.totalSpent) / 1_000_000n).toString()} USDC</dd></div>
      <div><dt className="text-zinc-500">Season rank</dt><dd className="font-mono">{career.seasonRank ?? "—"}</dd></div>
    </dl>
  </section>
)}
```

- [ ] **Step 2:** In `u/[wallet]/page.tsx`, do the same render block but using the wallet from the route params instead of the connected wallet.
- [ ] **Step 3:** Verify in browser at `/portfolio` and `/u/0x…`:
  ```bash
  cd frontend && npm run dev
  ```
- [ ] **Step 4:** Commit:
  ```bash
  git add frontend/app/\(app\)/portfolio/page.tsx frontend/app/\(app\)/u/\[wallet\]/page.tsx
  git commit -m "feat(ui): live career stats in portfolio and user profile"
  ```

---

# PHASE C — Live API-Football wiring

**Goal:** Prove end-to-end that ingest → score → publish actually works against a real upstream feed, not just fixtures.

### Task C1: Live integration test against a known historical fixture

**Files:**
- Modify: `frontend/services/oracle/ingest.it.test.ts`

- [ ] **Step 1:** Pick a stable historical match (e.g., a World Cup 2022 final group-stage match) where stats are unlikely to change. Find its fixture id via the API-Football web UI or:
  ```bash
  curl "https://v3.football.api-sports.io/fixtures?league=1&season=2022&round=Group%20Stage%20-%201" \
    -H "x-rapidapi-key: $API_FOOTBALL_KEY" | jq '.response[0]'
  ```
  Record the chosen fixture id and expected event totals (goals, assists, cards).

- [ ] **Step 2:** Add a live integration test that gates on the env var:

```typescript
// services/oracle/ingest.it.test.ts — append:
import { describe, it, expect } from "vitest";
import { ingestFixture } from "./ingest";

const KEY = process.env.API_FOOTBALL_KEY;
const FIXTURE_ID = 857035; // ← replace with chosen fixture id
const EXPECTED_GOALS = 2;  // ← from chosen fixture
const EXPECTED_CARDS = 3;  // ← from chosen fixture

const maybe = KEY ? describe : describe.skip;

maybe("ingest against live API-Football", () => {
  it("normalizes a known historical fixture's event counts", async () => {
    const events = await ingestFixture(FIXTURE_ID, KEY!);
    const goals = events.filter(e => e.type === "goal").length;
    const cards = events.filter(e => e.type === "yellow" || e.type === "red").length;
    expect(goals).toBe(EXPECTED_GOALS);
    expect(cards).toBe(EXPECTED_CARDS);
  });
});
```

- [ ] **Step 3:** Run (skips if no key — that's fine; in CI with secret set, it runs):
  ```bash
  cd frontend && npm run test:it -- ingest
  # expect: pass (or skipped if no key)
  ```
- [ ] **Step 4:** Commit:
  ```bash
  git add frontend/services/oracle/ingest.it.test.ts
  git commit -m "test(oracle): live API-Football ingest smoke against known fixture"
  ```

### Task C2: Full e2e smoke against testnet — ingest → publish → claim

**Files:**
- Create: `frontend/scripts/smoke-e2e.ts`

- [ ] **Step 1:** Write a script that runs the full oracle pipeline against a pre-existing testnet matchday with a known lineup:

```typescript
// scripts/smoke-e2e.ts
import "./_env";
import { ingestFixture } from "../services/oracle/ingest";
import { scoreLineups } from "../services/oracle/score";
import { publishMatchday } from "../services/oracle/publish";
import { rolloverMatchday } from "../services/oracle/rollover";

const FIXTURE_ID = Number(process.env.SMOKE_FIXTURE_ID);
const MATCHDAY = Number(process.env.SMOKE_MATCHDAY);

if (!FIXTURE_ID || !MATCHDAY) {
  console.error("set SMOKE_FIXTURE_ID and SMOKE_MATCHDAY");
  process.exit(1);
}

const events = await ingestFixture(FIXTURE_ID, process.env.API_FOOTBALL_KEY!);
console.log(`ingested ${events.length} events`);

const scores = await scoreLineups(MATCHDAY, events);
console.log(`scored ${scores.length} lineups`);

const { scoreRoot, dnpRoot, payoutRoot } = await publishMatchday(MATCHDAY, scores);
console.log({ scoreRoot, dnpRoot, payoutRoot });

await rolloverMatchday(MATCHDAY);
console.log("rolled over");
```

- [ ] **Step 2:** Run against testnet with a real matchday:
  ```bash
  cd frontend && SMOKE_FIXTURE_ID=<id> SMOKE_MATCHDAY=<n> tsx scripts/smoke-e2e.ts
  # expect: each phase logs success; verify on-chain via explorer
  ```
- [ ] **Step 3:** Document the result — append the chosen fixture/matchday + on-chain tx hashes to `docs/E2E-LIFECYCLE.md` under a new "Live smoke runs" section.
- [ ] **Step 4:** Commit:
  ```bash
  git add frontend/scripts/smoke-e2e.ts docs/E2E-LIFECYCLE.md
  git commit -m "feat(scripts): live e2e smoke pipeline against testnet"
  ```

---

# PHASE D — Player content completeness

**Goal:** Coverage of all ~1,300 World Cup 2026 players (48 teams × ~26 squad) with deterministic traits and stats. Without this, paid tier-gated contests are unfillable.

### Task D1: Audit current player coverage

**Files:**
- Create: `frontend/scripts/audit-players.ts`

- [ ] **Step 1:** Write an audit script that reports coverage gaps:

```typescript
// scripts/audit-players.ts
import { PLAYERS } from "../lib/data/players";
import { NATIONS } from "../lib/data/nations";
import { TRAITS } from "../lib/data/traits";

const wcTeams = NATIONS.filter(n => n.qualifiedFor2026); // expand NATIONS to include this flag if missing
const expectedPlayers = wcTeams.length * 26;
const actual = PLAYERS.length;

console.log(`Teams qualified: ${wcTeams.length}, expected players: ${expectedPlayers}, present: ${actual}`);

const byNation = new Map<string, number>();
for (const p of PLAYERS) byNation.set(p.nationId, (byNation.get(p.nationId) ?? 0) + 1);

for (const t of wcTeams) {
  const have = byNation.get(t.id) ?? 0;
  if (have < 26) console.log(`  ${t.id} (${t.name}): ${have}/26`);
}

const missingTraits = PLAYERS.filter(p => !TRAITS[p.id]);
console.log(`Players missing traits: ${missingTraits.length}`);
for (const p of missingTraits.slice(0, 20)) console.log(`  ${p.id}  ${p.name}`);
```

- [ ] **Step 2:** Run and capture the gap report:
  ```bash
  cd frontend && tsx scripts/audit-players.ts > /tmp/player-audit.txt
  cat /tmp/player-audit.txt
  ```
- [ ] **Step 3:** Commit the script (the report is not committed):
  ```bash
  git add frontend/scripts/audit-players.ts
  git commit -m "feat(scripts): player coverage audit"
  ```

### Task D2: Fill missing player + trait entries

**Files:**
- Modify: `frontend/lib/data/players.ts`
- Modify: `frontend/lib/data/traits.ts`

- [ ] **Step 1:** Working from `/tmp/player-audit.txt`, for each team under 26 players, look up the official 26-player FIFA-published squad list. Add entries to `PLAYERS` with `id`, `name`, `nationId`, `position`, `shirtNumber`.

- [ ] **Step 2:** For each player added (and each existing player missing from `TRAITS`), assign a `primaryTrait` and `secondaryTrait` per the position taxonomy in spec §4.2. Deterministic per real-world playing style — no RNG.

- [ ] **Step 3:** Re-run the audit script — expect `Players missing traits: 0` and every team at 26/26:
  ```bash
  cd frontend && tsx scripts/audit-players.ts
  ```
- [ ] **Step 4:** Run the broader test suite to ensure type integrity:
  ```bash
  cd frontend && npm test
  # expect: all green
  ```
- [ ] **Step 5:** Commit in chunks (one commit per ~5 teams) to keep diffs reviewable:
  ```bash
  git add frontend/lib/data/players.ts frontend/lib/data/traits.ts
  git commit -m "feat(data): complete squad + trait coverage for [teams A-E]"
  # repeat for B-J, etc.
  ```

### Task D3: Audit formation synergy table

**Files:**
- Modify: `frontend/lib/data/formationSynergy.ts`

- [ ] **Step 1:** Re-read spec §4.3 (formation synergies — Wide Play / Iron Wall / Tiki-Taka / Counter-Attack / Brick Defense). Open the current `formationSynergy.ts` and confirm each named synergy is present with the correct trigger and bonus.

- [ ] **Step 2:** Write a unit test that asserts each synergy's trigger + bonus:

```typescript
// lib/data/__tests__/formationSynergy.test.ts
import { describe, it, expect } from "vitest";
import { FORMATION_SYNERGIES, evaluateFormationSynergy } from "../formationSynergy";

describe("formation synergies", () => {
  it("Wide Play triggers on 2+ Wingers in 4-3-3", () => {
    const synergy = evaluateFormationSynergy("4-3-3", ["Winger", "Winger", "Playmaker", "Wall"]);
    expect(synergy?.name).toBe("Wide Play");
    expect(synergy?.bonus).toBe(1.05);
  });

  it("Iron Wall triggers on 3+ Wall in 5-3-2", () => {
    const synergy = evaluateFormationSynergy("5-3-2", ["Wall", "Wall", "Wall", "Poacher"]);
    expect(synergy?.name).toBe("Iron Wall");
    expect(synergy?.bonus).toBe(1.10);
  });

  // …add similar for Tiki-Taka, Counter-Attack, Brick Defense
});
```

- [ ] **Step 3:** Run:
  ```bash
  cd frontend && npm test -- formationSynergy
  # expect: all 5 cases pass; if any fail, the table is wrong — fix and re-run
  ```
- [ ] **Step 4:** Commit:
  ```bash
  git add frontend/lib/data/formationSynergy.ts frontend/lib/data/__tests__/formationSynergy.test.ts
  git commit -m "test(data): pin formation-synergy trigger/bonus per spec §4.3"
  ```

---

# PHASE E — Compliance basics

**Goal:** The Stream F items from the PRD/spec — legal posture, geofencing, ToS, signer agreements, incident response, bug bounty. None of these are big technical builds; most are docs. They unblock any real-money launch.

### Task E1: Risk-jurisdictions matrix doc

**Files:**
- Create: `docs/compliance/risk-jurisdictions.md`

- [ ] **Step 1:** Write the document. Identify jurisdictions where DFS or fantasy sports is restricted (US states like Idaho, Iowa, Louisiana, Montana, Nevada, Tennessee, Washington for free-with-prize models; EU member states with specific rules). For each: classification, recommended posture (block / allow / KYC-required), source citation.

```markdown
# Risk Jurisdictions Matrix

> Living document — review quarterly. Operative source of truth for the geofencing middleware in `frontend/middleware.ts`.

## Legend
- **Block:** users from this jurisdiction cannot enter paid contests; free track allowed.
- **Allow:** no restrictions in MVP.
- **KYC:** requires identity verification above a threshold before paid contest entry.

## US States

| State | Free track | Paid track | Notes |
|---|---|---|---|
| AL | Allow | Allow | — |
| AK | Allow | Allow | — |
| AZ | Allow | Allow | — |
| AR | Allow | Allow | — |
| CA | Allow | Allow | DFS classified as game of skill |
| CO | Allow | Allow | — |
| CT | Allow | Allow | — |
| DE | Allow | Allow | — |
| FL | Allow | Allow | — |
| GA | Allow | Allow | — |
| HI | Allow | Block | DFS prohibited |
| ID | Allow | Block | DFS prohibited |
| IL | Allow | Allow | — |
| IN | Allow | Allow | DFS regulated |
| IA | Allow | Allow | DFS regulated |
| KS | Allow | Allow | — |
| KY | Allow | Allow | — |
| LA | Allow | Block | DFS restricted |
| ME | Allow | Allow | — |
| MD | Allow | Allow | — |
| MA | Allow | Allow | — |
| MI | Allow | Allow | DFS regulated |
| MN | Allow | Allow | — |
| MS | Allow | Allow | — |
| MO | Allow | Allow | — |
| MT | Allow | Block | DFS prohibited |
| NE | Allow | Allow | — |
| NV | Allow | Block | Treats DFS as gambling |
| NH | Allow | Allow | — |
| NJ | Allow | Allow | — |
| NM | Allow | Allow | — |
| NY | Allow | Allow | DFS regulated |
| NC | Allow | Allow | — |
| ND | Allow | Allow | — |
| OH | Allow | Allow | — |
| OK | Allow | Allow | — |
| OR | Allow | Allow | — |
| PA | Allow | Allow | DFS regulated |
| RI | Allow | Allow | — |
| SC | Allow | Allow | — |
| SD | Allow | Allow | — |
| TN | Allow | Allow | DFS regulated |
| TX | Allow | Allow | — |
| UT | Allow | Allow | — |
| VT | Allow | Allow | — |
| VA | Allow | Allow | — |
| WA | Allow | Block | DFS restricted |
| WV | Allow | Allow | — |
| WI | Allow | Allow | — |
| WY | Allow | Allow | — |

## EU & UK

| Country | Free track | Paid track | Notes |
|---|---|---|---|
| UK | Allow | Allow | — |
| Germany | Allow | Allow | — |
| France | Allow | Allow | — |
| Spain | Allow | Allow | — |
| Italy | Allow | Allow | — |
| Netherlands | Allow | Allow | — |
| Sweden | Allow | Allow | — |
| Belgium | Allow | KYC | Strict gambling regulation; verify before launch |
| Norway | Allow | KYC | — |

## Other

| Country | Free track | Paid track | Notes |
|---|---|---|---|
| Brazil | Allow | Allow | — |
| Argentina | Allow | Allow | — |
| India | Allow | Allow | DFS classified as game of skill |
| Singapore | Allow | KYC | — |
| China (mainland) | Block | Block | Crypto + sports betting restrictions |
| North Korea | Block | Block | Sanctions |
| Iran | Block | Block | Sanctions |
| Cuba | Block | Block | Sanctions |
| Syria | Block | Block | Sanctions |

## Process

A jurisdiction added or moved to **Block** requires a code change to `frontend/lib/geofence.ts` and a deployment.

> **Disclaimer:** This is a non-lawyer technical posture document, not legal advice. Final classifications require counsel review before launch.
```

- [ ] **Step 2:** Commit:
  ```bash
  git add docs/compliance/risk-jurisdictions.md
  git commit -m "docs(compliance): risk-jurisdictions matrix"
  ```

### Task E2: ToS, Privacy Policy, Fair-Play rules

**Files:**
- Create: `docs/compliance/terms-of-service.md`
- Create: `docs/compliance/privacy-policy.md`
- Create: `docs/compliance/fair-play.md`

- [ ] **Step 1:** Write `terms-of-service.md` — sections: scope of service, acceptance, eligibility (18+, jurisdiction not blocked), accounts and wallets, no-custody disclaimer, prize pools and rake, intellectual property, prohibited conduct, dispute resolution, governing law, modifications. Lift standard DFS ToS structure; flag for legal review.

- [ ] **Step 2:** Write `privacy-policy.md` — sections: data we collect (wallet address, IP for geofence, optional email), what we do with it, third-party processors (Supabase, Privy, X Layer RPC, API-Football), no PII for free-track participation, GDPR/CCPA rights, retention, contact.

- [ ] **Step 3:** Write `fair-play.md` — sections: Sybil detection policy, multi-account ban, same-lineup-across-wallets flagging, oracle dispute window, refund policy, anti-cheating measures.

- [ ] **Step 4:** Cross-link from each ToS section to the relevant FR-* identifier in `PRD.md`.

- [ ] **Step 5:** Commit:
  ```bash
  git add docs/compliance/terms-of-service.md docs/compliance/privacy-policy.md docs/compliance/fair-play.md
  git commit -m "docs(compliance): draft ToS, Privacy Policy, Fair-Play rules"
  ```

### Task E3: Geofencing middleware

**Files:**
- Create: `frontend/lib/geofence.ts`
- Create: `frontend/middleware.ts`
- Create: `frontend/lib/__tests__/geofence.test.ts`

- [ ] **Step 1:** Write a failing unit test for the geofence resolver:

```typescript
// lib/__tests__/geofence.test.ts
import { describe, it, expect } from "vitest";
import { resolvePosture } from "../geofence";

describe("geofence", () => {
  it("blocks paid track from a blocked-state ISO code", () => {
    expect(resolvePosture("US-NV").paid).toBe("block");
  });
  it("allows free track even from blocked jurisdictions", () => {
    expect(resolvePosture("US-NV").free).toBe("allow");
  });
  it("requires KYC for Belgium paid track", () => {
    expect(resolvePosture("BE").paid).toBe("kyc");
  });
  it("blocks sanctioned countries entirely", () => {
    expect(resolvePosture("IR").paid).toBe("block");
    expect(resolvePosture("IR").free).toBe("block");
  });
  it("defaults to allow for unknown ISO codes", () => {
    expect(resolvePosture("ZZ").paid).toBe("allow");
  });
});
```

- [ ] **Step 2:** Run, expect FAIL (geofence module doesn't exist):
  ```bash
  cd frontend && npm test -- geofence
  # expect: FAIL — cannot find module
  ```
- [ ] **Step 3:** Implement `lib/geofence.ts` with a hand-maintained table mirroring `docs/compliance/risk-jurisdictions.md`:

```typescript
// lib/geofence.ts
export type Posture = "allow" | "kyc" | "block";

export interface JurisdictionPosture {
  free: Posture;
  paid: Posture;
}

const BLOCK_PAID_STATES = new Set([
  "US-HI", "US-ID", "US-LA", "US-MT", "US-NV", "US-WA",
]);

const SANCTIONED = new Set(["KP", "IR", "CU", "SY", "CN"]);

const KYC_PAID = new Set(["BE", "NO", "SG"]);

export function resolvePosture(isoCode: string): JurisdictionPosture {
  const c = isoCode.toUpperCase();
  if (SANCTIONED.has(c)) return { free: "block", paid: "block" };
  if (BLOCK_PAID_STATES.has(c)) return { free: "allow", paid: "block" };
  if (KYC_PAID.has(c)) return { free: "allow", paid: "kyc" };
  return { free: "allow", paid: "allow" };
}
```

- [ ] **Step 4:** Run test, expect PASS:
  ```bash
  cd frontend && npm test -- geofence
  # expect: 5 passing
  ```
- [ ] **Step 5:** Write the Next.js middleware that attaches the posture to request cookies for downstream UI gating:

```typescript
// frontend/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { resolvePosture } from "./lib/geofence";

export function middleware(req: NextRequest) {
  // Cloudflare / Vercel injects country header; fall back to US for local dev.
  const country = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? "US";
  const region = req.headers.get("x-vercel-ip-country-region") ?? "";
  const iso = region ? `${country}-${region}` : country;

  const posture = resolvePosture(iso);

  const res = NextResponse.next();
  res.cookies.set("mc-geo", JSON.stringify({ iso, ...posture }), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon).*)"],
};
```

- [ ] **Step 6:** Update `app/(app)/contests/page.tsx` (or wherever paid-contest entry is rendered) to read the cookie and hide/disable paid entry when `posture.paid !== "allow"`. Show a clear "Not available in your region" notice. Out of scope for this task is the full KYC flow — show a "KYC required" message that links to a `/kyc` placeholder route.

- [ ] **Step 7:** Verify in dev (use a header override extension or `curl` to simulate jurisdictions):
  ```bash
  curl -H "x-vercel-ip-country: NV" http://localhost:3000/api/profile/claims?wallet=0x...
  ```

- [ ] **Step 8:** Commit:
  ```bash
  git add frontend/lib/geofence.ts frontend/middleware.ts frontend/lib/__tests__/geofence.test.ts frontend/app/\(app\)/contests/page.tsx
  git commit -m "feat(compliance): geofence middleware + paid-contest gating"
  ```

### Task E4: Signer agreement template

**Files:**
- Create: `docs/compliance/signer-agreement-template.md`

- [ ] **Step 1:** Write a template that external oracle signers sign. Sections: identity, address, role and responsibilities, key management practices, response-time SLA (sign within 90 min of last whistle), dispute escalation, removal terms, no-conflict declaration, term, compensation (or none), signatures.

- [ ] **Step 2:** Commit:
  ```bash
  git add docs/compliance/signer-agreement-template.md
  git commit -m "docs(compliance): oracle signer agreement template"
  ```

### Task E5: Incident playbook + bug bounty intro

**Files:**
- Create: `docs/compliance/incident-playbook.md`
- Create: `docs/compliance/bug-bounty.md`

- [ ] **Step 1:** Write `incident-playbook.md`. Cover: oracle disagreement (signers post different roots), data feed outage, contract pause procedure, on-chain front-running attempt, indexer lag, Privy outage, Supabase outage. For each: detection (alert source), mitigation, communication template, post-mortem owner.

- [ ] **Step 2:** Write `bug-bounty.md`. Sections: scope (in-scope contracts + offchain services, out-of-scope), severity tiers + payout ranges (e.g., critical $5k–$25k, high $1k–$5k, medium $500–$1k, low $100–$500), submission flow (PGP key or email), safe harbor language, exclusions (known issues from `docs/contracts/flow-issues.md`).

- [ ] **Step 3:** Commit:
  ```bash
  git add docs/compliance/incident-playbook.md docs/compliance/bug-bounty.md
  git commit -m "docs(compliance): incident playbook + bug bounty intro"
  ```

---

# PHASE F — Transparency page completeness

**Goal:** The transparency page (FR-T1 through FR-T4) becomes a live reflection of the actual trust posture, not a static page.

### Task F1: Live oracle signers + threshold

**Files:**
- Create: `frontend/app/api/transparency/signers/route.ts`
- Modify: `frontend/app/(app)/transparency/page.tsx`

- [ ] **Step 1:** Build the API:

```typescript
// app/api/transparency/signers/route.ts
import { NextResponse } from "next/server";
import { publicClient } from "@/lib/clients";
import { ADDRESSES, ABIS } from "@/lib/contracts";

export const dynamic = "force-dynamic";

const KNOWN_SIGNERS_ENV = process.env.SCORE_ORACLE_SIGNERS ?? ""; // comma-separated
const KNOWN_SIGNERS = KNOWN_SIGNERS_ENV.split(",").map(s => s.trim()).filter(Boolean) as `0x${string}`[];

export async function GET() {
  const threshold = await publicClient.readContract({
    address: ADDRESSES.ScoreOracle,
    abi: ABIS.ScoreOracle,
    functionName: "threshold",
  }) as bigint;

  const signers = await Promise.all(
    KNOWN_SIGNERS.map(async (addr) => {
      const isSigner = await publicClient.readContract({
        address: ADDRESSES.ScoreOracle,
        abi: ABIS.ScoreOracle,
        functionName: "isSigner",
        args: [addr],
      }) as boolean;
      return { address: addr, active: isSigner };
    }),
  );

  return NextResponse.json({
    threshold: Number(threshold),
    activeCount: signers.filter(s => s.active).length,
    signers,
  });
}
```

- [ ] **Step 2:** Set `SCORE_ORACLE_SIGNERS` in repo-root `.env.example`:

```
SCORE_ORACLE_SIGNERS=0xabc...,0xdef...,0x123...,0x456...,0x789...
```

- [ ] **Step 3:** Update the transparency page to render a "Oracle signers" section using this endpoint. Render: threshold, active count, each signer's address with green/grey active indicator.

- [ ] **Step 4:** Commit:
  ```bash
  git add frontend/app/api/transparency/signers/route.ts frontend/app/\(app\)/transparency/page.tsx .env.example
  git commit -m "feat(ui): live oracle signers panel on transparency page"
  ```

### Task F2: Data feed source disclosure

**Files:**
- Modify: `frontend/app/(app)/transparency/page.tsx`

- [ ] **Step 1:** Add a "Data Feed" section to the transparency page:

```tsx
<section>
  <h2 className="text-lg font-semibold">Match data feed</h2>
  <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
    <dt className="text-zinc-500">Primary source</dt>
    <dd><a className="underline" href="https://api-football.com" target="_blank" rel="noreferrer">API-Football (v3.football.api-sports.io)</a></dd>
    <dt className="text-zinc-500">Fallback source</dt>
    <dd>SportRadar trial / manual fallback</dd>
    <dt className="text-zinc-500">Ingest cadence</dt>
    <dd>Every 60 seconds during live matches; final snapshot 30 minutes after last whistle</dd>
    <dt className="text-zinc-500">Public re-verify</dt>
    <dd><code>npm run verify -- &lt;matchday&gt;</code> against this repo reproduces the score Merkle root</dd>
  </dl>
</section>
```

- [ ] **Step 2:** Commit:
  ```bash
  git add frontend/app/\(app\)/transparency/page.tsx
  git commit -m "feat(ui): data feed source disclosure on transparency page"
  ```

### Task F3: Audit status + contract addresses disclosure

**Files:**
- Modify: `frontend/app/(app)/transparency/page.tsx`

- [ ] **Step 1:** Add a "Smart contracts" section that lists every deployed contract address with a link to the explorer + audit-status:

```tsx
import deployment from "@/../../contracts/deployments/xlayer-testnet.json";

// In the page body:
<section>
  <h2 className="text-lg font-semibold">Smart contracts</h2>
  <p className="text-sm text-zinc-500">Deployed to {deployment.network} ({deployment.chainId}). Block {deployment.startBlock}.</p>
  <ul className="text-sm">
    {Object.entries(deployment.contracts).map(([name, addr]) => (
      <li key={name} className="font-mono">
        {name}: <a className="underline" href={`https://www.oklink.com/xlayer-test/address/${addr}`} target="_blank" rel="noreferrer">{addr}</a>
      </li>
    ))}
  </ul>

  <h3 className="mt-4 text-sm font-semibold">Audit status</h3>
  <p className="text-sm">Testnet deployment is unaudited; <strong>do not deposit real funds</strong>. Pre-mainnet audit is pending — see <a href="https://github.com/RomarioKavin1/OKX-Hackathon" className="underline">repo</a> for status.</p>
</section>
```

- [ ] **Step 2:** Verify visually:
  ```bash
  cd frontend && npm run dev
  # visit /transparency, scroll, confirm sections render
  ```
- [ ] **Step 3:** Commit:
  ```bash
  git add frontend/app/\(app\)/transparency/page.tsx
  git commit -m "feat(ui): audit status + contract addresses on transparency page"
  ```

---

# PHASE G — Sign-off

### Task G1: Full test suite green

- [ ] **Step 1:** Run everything:
  ```bash
  cd contracts && forge test
  cd ../frontend && npm test && npm run test:it && npm run typecheck && npm run lint
  ```
- [ ] **Step 2:** Confirm: 50+ Foundry tests pass; all vitest pass; typecheck zero errors; lint zero errors. If anything regresses, fix before commit.

### Task G2: Manual end-to-end browser walkthrough

- [ ] **Step 1:** Start dev server:
  ```bash
  cd frontend && npm run dev
  ```
- [ ] **Step 2:** Walk through these flows in the browser, confirming each renders with live data (not placeholders):
  - `/onboard` — Privy connect + claim starter squad
  - `/portfolio` — career stats panel renders with real numbers (or zeros for fresh wallet)
  - `/settings` — claim history table renders (or "No claims yet")
  - `/transparency` — signers list, data feed, contract addresses all populated
  - `/contests` — if testing from a US-NV header, paid track shows "Not available"

### Task G3: Update README + commit

- [ ] **Step 1:** Update top-level `README.md` "What's done" section to reflect this plan's completion: oracle multi-sig, full player coverage, live UI sections, transparency page, compliance docs.
- [ ] **Step 2:** Commit:
  ```bash
  git add README.md
  git commit -m "docs(readme): v1 hardening complete"
  ```

### Task G4: Tag release

- [ ] **Step 1:** Tag and push:
  ```bash
  git tag -a v1.0.0-testnet -m "v1 gaps & hardening complete; testnet only; no audit"
  git push origin v1.0.0-testnet
  ```

---

## Spec coverage check (run after writing this plan)

Each row maps a PRD requirement to a task in this plan. Open items remain explicitly out of scope (deferred to later plans).

| PRD reference | Requirement | Where addressed |
|---|---|---|
| FR-O3 | Free Starter Squad on signup | Already shipped (commit `7935851`) — no change |
| FR-CT2 | Paid Common Open at $1 entry | Already shipped — no change |
| FR-S4 | Merkle root within 90 min of last whistle | Tasks A1–A4 (multi-sig) + C2 (live smoke) |
| FR-S5 | Public verifier CLI | Already shipped (`frontend/verifier/`) — no change |
| FR-T1 | Transparency page (signers, feed, formula) | Phase F |
| FR-T2 | Match data preserved for re-verification | Already shipped (events table) — no change |
| FR-T3 | Contract addresses + audit reports in UI | Task F3 |
| FR-T4 | Dispute reporting flow | Already shipped (transparency/DisputeForm.tsx) — no change |
| FR-CT9 | Anti-Sybil entry caps | Already shipped (contract `entered` mapping) — no change |
| F1 (spec §9 Stream F) | Legal review DFS classification | Task E1 |
| F2 | Geofencing | Task E3 |
| F3 | ToS / Privacy / Fair-Play | Task E2 |
| F4 | Oracle signer agreements | Task E4 |
| F5 | Bug bounty | Task E5 (intro doc; live program is post-launch) |
| F6 | Incident response playbook | Task E5 |
| Open #2 (PRD §11) | Card art direction | Out of scope — needs design partner |
| Open #3 | Player likeness rights | Out of scope — needs legal partner |
| Open #4 | Oracle signer partners | Task A1 enables; partner identification is operational |
| Open #5 | Sponsor / grants | Out of scope — business development |
| Open #7 | Geofencing list | Task E1 + E3 |
| Open #8 | VRF source on X Layer | Out of scope — deferred to Plan 2 (v1.5) |
| Open #9 | Audit firm | Out of scope — business decision |

Two PRD opens (#2 card art, #5 sponsors) are out of scope for any engineering plan — they belong to design and BDR streams.

## Plan-internal type consistency check

- `CareerStats` shape defined in Task B3 is re-used in Task B4 — fields match: `matchdaysPlayed`, `totalPoints`, `bestDayScore`, `totalWon`, `totalSpent`, `seasonRank`. ✓
- `Posture` and `JurisdictionPosture` defined in Task E3 are used in `middleware.ts` and downstream UI gating. ✓
- `SCORE_ORACLE_SIGNERS` env var introduced in Task F1 has a matching entry in `.env.example` (step 2). ✓
- `ScoreOracle` ABI surface (`isSigner`, `threshold`, `setSigner`, `setThreshold`, `submitRoot`) used in A1–A4 and F1 matches the constructor + methods already in `contracts/src/ScoreOracle.sol`. ✓
- `v_claims` Supabase view in Task B1 references `events` table columns matching the schema in `frontend/supabase/migrations/20260528150515_init.sql`. ✓

No type drift detected.

## Risks captured during planning

- Tasks A1–A3 require external signer identities that don't yet exist. Plan unblocks the technical capability; signer recruitment is operational and tracked in PRD Open #4.
- Task D2 may be a multi-day content task depending on FIFA squad announcement timing for WC 2026 — squads typically finalize in late May. If actual squad data is unavailable, ship with provisional rosters and add a `provisional: true` flag on `PLAYERS` entries so the UI can render the right status badge.
- Task E1's classifications are technical-posture only. A real legal opinion is required before paid-tier launch in non-Allow jurisdictions.
- Task C2's live smoke requires a configured `API_FOOTBALL_KEY` and a real matchday with a known lineup committed. If neither exists, gate this task on having a complete demo matchday set up (likely a follow-up effort).
