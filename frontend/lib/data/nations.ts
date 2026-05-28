export type Nation =
  | "BRA" | "FRA" | "ARG" | "ENG" | "ESP" | "GER" | "POR" | "NED"
  | "ITA" | "BEL" | "CRO" | "URU";

export const NATION_NAME: Record<Nation, string> = {
  BRA: "Brazil", FRA: "France", ARG: "Argentina", ENG: "England",
  ESP: "Spain", GER: "Germany", POR: "Portugal", NED: "Netherlands",
  ITA: "Italy", BEL: "Belgium", CRO: "Croatia", URU: "Uruguay",
};
