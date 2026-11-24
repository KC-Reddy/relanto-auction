/* Bid rules. Pure functions, used by the engine in the browser and by the tests.
   firestore.rules enforces the same rules on the server. */

import { MIN_BASE, STEP_TIERS } from "./constants.js";

export function stepFor(currentBid) {
  return STEP_TIERS.find((t) => currentBid < t.below).step;
}

/* The only amount that can be bid right now.
   The first bid equals the base price, every later bid adds one step. */
export function nextBid(live) {
  return live.bidCount === 0 ? live.baseBid : live.currentBid + stepFor(live.currentBid);
}

export function lotEndsAt(live, lotSeconds) {
  return live.lastBidAt + lotSeconds * 1000;
}

export function timeLeftMs(live, nowMs, lotSeconds) {
  if (live.status === "paused") return Math.max(0, live.pausedLeftMs ?? 0);
  if (live.status !== "live") return 0;
  return Math.max(0, lotEndsAt(live, lotSeconds) - nowMs);
}

/* How much money a team must keep so it can still fill the minimum squad at the cheapest base price. */
export function reserveNeeded(squadCountAfterBid, minSquad) {
  return Math.max(0, minSquad - squadCountAfterBid) * MIN_BASE;
}

/* Decide whether a captain may bid right now.
   Returns { ok: true, amount } or { ok: false, reason }.
   team: "team1" | "team2"; teamState: { purseLeft, squad: [...] } */
export function checkBid({ team, live, teamState, cfg, nowMs, operator = false }) {
  if (!live || live.status === "idle" || !live.playerId) return { ok: false, reason: "No player is on the block." };
  if (live.status === "paused") return { ok: false, reason: "The auction is paused." };
  if (live.status !== "live") return { ok: false, reason: "No player is on the block." };
  if (!operator && nowMs > lotEndsAt(live, cfg.lotSeconds)) return { ok: false, reason: "Time is up for this player." };
  if (live.currentTeam === team) return { ok: false, reason: operator ? "This team already holds the highest bid." : "You already hold the highest bid." };

  const count = teamState.squad.length;
  if (count >= cfg.maxSquad) return { ok: false, reason: `Your squad is full (${cfg.maxSquad} players).` };

  const amount = nextBid(live);
  if (amount > teamState.purseLeft) return { ok: false, reason: operator ? "Not enough purse left for this bid." : "Not enough purse left for this bid." };

  const reserve = reserveNeeded(count + 1, cfg.minSquad);
  if (teamState.purseLeft - amount < reserve) {
    return { ok: false, reason: "This bid would leave too little to fill your minimum squad." };
  }
  return { ok: true, amount };
}

/* What happens when the hammer falls. */
export function settle(live) {
  return live.bidCount > 0
    ? { outcome: "sold", team: live.currentTeam, price: live.currentBid }
    : { outcome: "unsold" };
}
