/* Auction rules shared by the browser, the tests and (copied by hand) the Firestore rules.
   If you change a number here, change it in firestore.rules too. */

/* Every player starts at the same base price. The category only sets the order players are called in
   (Marquee first), so the organizer can put the best players on the block first. */
export const BASE_PRICE = 150000;
export const CATEGORIES = {
  marquee: { label: "Marquee", base: BASE_PRICE },
  A: { label: "Category A", base: BASE_PRICE },
  B: { label: "Category B", base: BASE_PRICE },
  C: { label: "Category C", base: BASE_PRICE },
};

/* Used to make sure a team can still afford a full squad: one base price per empty slot. */
export const MIN_BASE = BASE_PRICE;

/* How much a new bid adds, by the current price. The first tier whose "below" is above the price wins.
   Under 4L: 25k. From 4L: 50k. From 6L: 1L. From 10L: 2L. Keep firestore.rules in step with this table. */
export const STEP_TIERS = [
  { below: 400000, step: 25000 },
  { below: 600000, step: 50000 },
  { below: 1000000, step: 100000 },
  { below: Infinity, step: 200000 },
];

export const TEAM_KEYS = ["team1", "team2"];

export const DEFAULT_CONFIG = {
  purse: 3000000,
  minSquad: 11,
  maxSquad: 13,
  lotSeconds: 30,
  registrationOpen: true,
  timerOn: false,
  teamNames: { team1: "Team 1", team2: "Team 2" },
  captains: { team1: "", team2: "" },
  auctionDate: "",
};
