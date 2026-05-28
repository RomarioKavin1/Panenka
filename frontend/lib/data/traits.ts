import type { Position } from "@/lib/types";

export type Trait =
  | "ShotStopper" | "SweeperKeeper" | "PenaltySpecialist"
  | "Wall" | "BallPlaying" | "Aggressor" | "Wingback"
  | "Playmaker" | "BoxToBox" | "BallWinner" | "Creator" | "Anchor"
  | "Poacher" | "TargetMan" | "Winger" | "InsideForward" | "False9";

// Each trait boosts specific event categories (multiplier applied to that category's points).
// Categories mirror lib/constants SCORE_* tables.
export type EventCategory = "goals" | "assists" | "cleanSheet" | "tackles" | "keyPasses" | "saves" | "penaltiesSaved" | "all" | "attacking";

export const TRAIT_BOOST: Record<Trait, Partial<Record<EventCategory, number>>> = {
  ShotStopper:       { saves: 1.20 },
  SweeperKeeper:     { keyPasses: 1.10 },
  PenaltySpecialist: { penaltiesSaved: 1.50 },
  Wall:              { cleanSheet: 1.15 },
  BallPlaying:       { keyPasses: 1.25 },
  Aggressor:         { tackles: 1.10 },
  Wingback:          { assists: 1.20 },
  Playmaker:         { assists: 1.25 },
  BoxToBox:          { all: 1.10 },
  BallWinner:        { tackles: 1.20 },
  Creator:           { keyPasses: 1.30 },
  Anchor:            { cleanSheet: 1.15 },
  Poacher:           { goals: 1.25 },
  TargetMan:         { goals: 1.20 },   // "headed" goals approximated as goals
  Winger:            { assists: 1.20 },
  InsideForward:     { goals: 1.15, assists: 1.15 }, // G+A
  False9:            { attacking: 1.15 }, // goals+assists+keyPasses
};

export const TRAITS_BY_POSITION: Record<Position, Trait[]> = {
  GK:  ["ShotStopper", "SweeperKeeper", "PenaltySpecialist"],
  DEF: ["Wall", "BallPlaying", "Aggressor", "Wingback"],
  MID: ["Playmaker", "BoxToBox", "BallWinner", "Creator", "Anchor"],
  FWD: ["Poacher", "TargetMan", "Winger", "InsideForward", "False9"],
};
