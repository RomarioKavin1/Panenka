/**
 * fixtures.ts — Demo fixture catalog for ManagerCup.
 *
 * DEMO_FIXTURE_ID is a documented config placeholder; the real API-Football
 * fixture id must be set in Phase 4 once the user picks the demo match and
 * provides API_FOOTBALL_KEY.
 */

import type { Nation } from "./nations";

export interface Fixture {
  fixtureId: number;
  matchday: number;
  home: Nation;
  away: Nation;
  kickoff: string; // ISO 8601
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";
}

// ---------------------------------------------------------------------------
// TODO(Phase 4): Replace with the real API-Football fixture id for the
// chosen FRA vs ARG demo match. Keep this value at 0 until then.
// ---------------------------------------------------------------------------
export const DEMO_FIXTURE_ID = 0; // TODO(Phase 4): set to the real API-Football fixture id

export const DEMO_FIXTURE_ID_ENG_BRA = 0; // TODO(Phase 4): set to the real API-Football fixture id

export const FIXTURES: Fixture[] = [
  {
    // France vs Argentina — World Cup Final 2022 (18 December 2022)
    // fixtureId is TBD — see DEMO_FIXTURE_ID above.
    fixtureId: DEMO_FIXTURE_ID,
    matchday: 1,
    home: "FRA",
    away: "ARG",
    kickoff: "2022-12-18T15:00:00Z",
    status: "FINISHED",
  },
  {
    // England vs Brazil — friendly / Nations League placeholder
    // fixtureId is TBD — see DEMO_FIXTURE_ID_ENG_BRA above.
    fixtureId: DEMO_FIXTURE_ID_ENG_BRA,
    matchday: 2,
    home: "ENG",
    away: "BRA",
    kickoff: "2023-03-23T19:45:00Z",
    status: "FINISHED",
  },
  {
    // Brazil vs France — additional variety fixture (future scheduled)
    fixtureId: 0, // TODO(Phase 4): set to the real API-Football fixture id
    matchday: 3,
    home: "BRA",
    away: "FRA",
    kickoff: "2024-06-01T18:00:00Z",
    status: "SCHEDULED",
  },
];
