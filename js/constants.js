/* Auction rules shared by the browser, the tests and (copied by hand) the Firestore rules.
   If you change a number here, change it in firestore.rules too. */

export const CATEGORIES = {
  marquee: { label: "Marquee", base: 500000 },
  A: { label: "Category A", base: 300000 },
  B: { label: "Category B", base: 200000 },
  C: { label: "Category C", base: 100000 },
};

/* The cheapest base price. Used to make sure a captain can still afford a full squad. */
export const MIN_BASE = 100000;

/* A new bid adds STEP_LOW while the price is at or below STEP_THRESHOLD, STEP_HIGH above it. */
export const STEP_LOW = 25000;
export const STEP_HIGH = 50000;
export const STEP_THRESHOLD = 1000000;

export const TEAM_KEYS = ["team1", "team2"];

export const DEFAULT_CONFIG = {
  purse: 3000000,
  minSquad: 11,
  maxSquad: 13,
  lotSeconds: 30,
  registrationOpen: true,
  teamNames: { team1: "Team 1", team2: "Team 2" },
  captains: { team1: "", team2: "" },
  auctionDate: "",
};
