/**
 * Offline param-validation tests for the three read API route handlers.
 *
 * These tests hit only the validation layer (status 400) which returns
 * BEFORE any Supabase call, so they work without a DB connection or env vars.
 *
 * The supabaseAnonServer import is mocked to a no-op so that even if the
 * validation branch is accidentally bypassed the test won't throw on missing
 * env vars.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

// Mock supabase server client so imports don't throw on missing env vars
vi.mock("@/lib/supabase/server", () => ({
  supabaseAnonServer: () => {
    throw new Error("supabaseAnonServer should not be called in validation tests");
  },
  supabaseAdmin: () => {
    throw new Error("supabaseAdmin should not be called in validation tests");
  },
}));

// Lazy-import handlers after the mock is in place
let portfolioGET: (req: NextRequest) => Promise<Response>;
let contestsGET: (req: NextRequest) => Promise<Response>;
let lineupGET: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
  const portfolio = await import("../portfolio/route");
  const contests = await import("../contests/route");
  const lineup = await import("../lineup/route");
  portfolioGET = portfolio.GET;
  contestsGET = contests.GET;
  lineupGET = lineup.GET;
});

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------
describe("GET /api/portfolio — param validation", () => {
  it("returns 400 when wallet param is missing", async () => {
    const req = new NextRequest("http://localhost/api/portfolio");
    const res = await portfolioGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when wallet param is blank", async () => {
    const req = new NextRequest("http://localhost/api/portfolio?wallet=");
    const res = await portfolioGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// Contests
// ---------------------------------------------------------------------------
describe("GET /api/contests — param validation", () => {
  it("returns 400 when matchday is not numeric", async () => {
    const req = new NextRequest("http://localhost/api/contests?matchday=abc");
    const res = await contestsGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when matchday is blank string", async () => {
    const req = new NextRequest("http://localhost/api/contests?matchday=");
    const res = await contestsGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when matchday is a float string", async () => {
    const req = new NextRequest("http://localhost/api/contests?matchday=1.5");
    const res = await contestsGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// Lineup
// ---------------------------------------------------------------------------
describe("GET /api/lineup — param validation", () => {
  it("returns 400 when wallet param is missing", async () => {
    const req = new NextRequest("http://localhost/api/lineup?matchday=1");
    const res = await lineupGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when wallet param is blank", async () => {
    const req = new NextRequest("http://localhost/api/lineup?matchday=1&wallet=");
    const res = await lineupGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when matchday param is missing", async () => {
    const req = new NextRequest("http://localhost/api/lineup?wallet=0xabc");
    const res = await lineupGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when matchday param is blank", async () => {
    const req = new NextRequest("http://localhost/api/lineup?matchday=&wallet=0xabc");
    const res = await lineupGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when matchday is not numeric", async () => {
    const req = new NextRequest("http://localhost/api/lineup?matchday=foo&wallet=0xabc");
    const res = await lineupGET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
