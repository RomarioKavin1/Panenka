/**
 * middleware.ts — Set a per-request geofence cookie from IP headers.
 *
 * Reads `x-vercel-ip-country` / `cf-ipcountry` for the country code and
 * `x-vercel-ip-country-region` for the region code (if available). The
 * resolved `JurisdictionPosture` is dropped into a non-httpOnly cookie
 * (`mc-geo`) so client components can gate paid-contest UI without an
 * extra round-trip.
 *
 * Local dev with no edge headers defaults to "US" → fully allow.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolvePosture } from "./lib/geofence";

export function middleware(req: NextRequest) {
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    "US";
  const region = req.headers.get("x-vercel-ip-country-region") ?? "";
  const iso = region ? `${country}-${region}` : country;

  const posture = resolvePosture(iso);

  const res = NextResponse.next();
  res.cookies.set(
    "mc-geo",
    JSON.stringify({ iso, ...posture }),
    {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    },
  );
  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon|api/transparency|public).*)"],
};
