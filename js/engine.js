/* The auction engine. Every rule lives here, written once, on top of a small store interface.
   The demo store and the Firebase store both implement that interface,
   so what the tests prove about the demo is what runs on Firebase. */

import { CATEGORIES, DEFAULT_CONFIG, TEAM_KEYS } from "./constants.js";
import { checkBid, settle, timeLeftMs } from "./auction-logic.js";
import { checkEmail, normEmail, tidy } from "./validators.js";

const CATEGORY_ORDER = ["marquee", "A", "B", "C"];

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  throw err;
}

function mergeConfig(doc) {
  return {
    ...DEFAULT_CONFIG,
    ...(doc || {}),
    teamNames: { ...DEFAULT_CONFIG.teamNames, ...((doc && doc.teamNames) || {}) },
    captains: { ...DEFAULT_CONFIG.captains, ...((doc && doc.captains) || {}) },
  };
}

function idleLive(ts) {
  return { status: "idle", playerId: "", baseBid: 0, currentBid: 0, currentTeam: "", bidCount: 0, lastBidAt: ts, pausedLeftMs: 0 };
}

export function createEngine(store, { adminEmails = [] } = {}) {
  const admins = adminEmails.map((e) => e.toLowerCase());
  const now = () => Date.now() + (store.skewMs ? store.skewMs() : 0);
  const actorEmail = () => (store.auth.user && store.auth.user.email ? store.auth.user.email.toLowerCase() : "");

  function requireAdmin() {
    if (!admins.includes(actorEmail())) fail("not-admin", "Only the organizer can do this.");
  }

  /* ---------------- setup ---------------- */
  async function getConfig() {
    return mergeConfig(await store.get("config/auction"));
  }

  async function ensureSetup() {
    requireAdmin();
    await store.run(async (tx) => {
      const [c, live, t1, t2] = await Promise.all([
        tx.get("config/auction"), tx.get("auction/live"), tx.get("teams/team1"), tx.get("teams/team2"),
      ]);
      const cfg = mergeConfig(c);
      if (!c) tx.set("config/auction", DEFAULT_CONFIG);
      if (!t1) tx.set("teams/team1", { name: cfg.teamNames.team1, purseLeft: cfg.purse, squad: [] });
      if (!t2) tx.set("teams/team2", { name: cfg.teamNames.team2, purseLeft: cfg.purse, squad: [] });
      if (!live) tx.set("auction/live", idleLive(tx.serverTime()));
    });
  }

  async function saveConfig(patch) {
    requireAdmin();
    const players = await store.list("players");
    return store.run(async (tx) => {
      const current = mergeConfig(await tx.get("config/auction"));
      const live = await tx.get("auction/live");
      const started = players.some((p) => p.status === "sold") || (live && live.status !== "idle");

      const next = {
        ...current, ...patch,
        teamNames: { ...current.teamNames, ...(patch.teamNames || {}) },
        captains: { ...current.captains, ...(patch.captains || {}) },
      };

      const int = (v) => Number.isInteger(v);
      if (!int(next.purse) || next.purse < 100000 || next.purse > 100000000) fail("invalid", "Purse must be between ₹1,00,000 and ₹10,00,00,000.");
      if (!int(next.minSquad) || next.minSquad < 1 || next.minSquad > 25) fail("invalid", "Minimum squad must be between 1 and 25.");
      if (!int(next.maxSquad) || next.maxSquad < next.minSquad || next.maxSquad > 25) fail("invalid", "Maximum squad must be between the minimum and 25.");
      if (!int(next.lotSeconds) || next.lotSeconds < 10 || next.lotSeconds > 180) fail("invalid", "Timer must be between 10 and 180 seconds.");
      for (const k of TEAM_KEYS) {
        next.teamNames[k] = tidy(next.teamNames[k]);
        if (next.teamNames[k].length < 1 || next.teamNames[k].length > 24) fail("invalid", "Team names need 1 to 24 characters.");
        next.captains[k] = normEmail(next.captains[k]);
        if (next.captains[k] && checkEmail(next.captains[k])) fail("invalid", "A captain email is not valid.");
      }
      if (next.captains.team1 && next.captains.team1 === next.captains.team2) fail("invalid", "The two captains need different emails.");
      if (typeof next.registrationOpen !== "boolean") fail("invalid", "Registration must be open or closed.");
      if (next.auctionDate && Number.isNaN(new Date(next.auctionDate).getTime())) fail("invalid", "The auction date is not valid.");

      const locked = ["purse", "minSquad", "maxSquad"].filter((k) => next[k] !== current[k]);
      if (started && locked.length) fail("locked", "Purse and squad sizes cannot change once the auction has started. Reset the auction first.");

      const teams = await Promise.all(TEAM_KEYS.map((k) => tx.get(`teams/${k}`)));
      tx.set("config/auction", next);
      TEAM_KEYS.forEach((k, i) => {
        const t = teams[i];
        if (!t) return;
        const patchTeam = { name: next.teamNames[k] };
        if (!started) patchTeam.purseLeft = next.purse;
        tx.update(`teams/${k}`, patchTeam);
      });
      return next;
    });
  }

  /* ---------------- registration ---------------- */
  async function submitRegistration(clean) {
    const cfg = await getConfig();
    if (!cfg.registrationOpen) fail("closed", "Registration is closed.");
    try {
      await store.create(`registrations/${clean.empId}`, { ...clean, status: "pending", createdAt: store.serverTime() });
    } catch (err) {
      if (err.code === "exists" || err.code === "permission-denied") {
        fail("duplicate", "This employee ID is already registered, or registration just closed.");
      }
      throw err;
    }
  }

  async function approve(empId, category) {
    requireAdmin();
    if (!CATEGORIES[category]) fail("invalid", "Choose a category first.");
    return store.run(async (tx) => {
      const reg = await tx.get(`registrations/${empId}`);
      if (!reg) fail("not-found", "Registration not found.");
      if (reg.status === "approved") fail("invalid", "Already approved.");
      tx.set(`players/${empId}`, {
        name: reg.name, role: reg.role, batting: reg.batting, bowling: reg.bowling, skill: reg.skill,
        bio: reg.bio, photo: reg.photo, category, basePrice: CATEGORIES[category].base,
        status: "available", team: "", soldPrice: 0, soldAt: 0, approvedAt: tx.serverTime(),
      });
      tx.update(`registrations/${empId}`, { status: "approved" });
      return { empId, name: reg.name, email: reg.email };
    });
  }

  async function reject(empId) {
    requireAdmin();
    return store.run(async (tx) => {
      const reg = await tx.get(`registrations/${empId}`);
      if (!reg) fail("not-found", "Registration not found.");
      const player = await tx.get(`players/${empId}`);
      if (player && player.status !== "available") fail("invalid", "This player has already been in the auction.");
      tx.update(`registrations/${empId}`, { status: "rejected" });
      return { empId, name: reg.name, email: reg.email };
    });
  }

  async function setCategory(empId, category) {
    requireAdmin();
    if (!CATEGORIES[category]) fail("invalid", "Unknown category.");
    return store.run(async (tx) => {
      const p = await tx.get(`players/${empId}`);
      if (!p) fail("not-found", "Player not found.");
      if (p.status === "sold" || p.status === "live") fail("invalid", "This player is already sold or on the block.");
      tx.update(`players/${empId}`, { category, basePrice: CATEGORIES[category].base });
    });
  }

  /* ---------------- running the auction ---------------- */
  async function startLot(playerId) {
    requireAdmin();
    return store.run(async (tx) => {
      const [live, player] = await Promise.all([tx.get("auction/live"), tx.get(`players/${playerId}`)]);
      if (!live) fail("not-found", "The auction is not set up yet.");
      if (live.status !== "idle") fail("busy", "Finish the current player first.");
      if (!player) fail("not-found", "Player not found.");
      if (player.status !== "available" && player.status !== "unsold") fail("invalid", "This player is not available.");
      tx.set("auction/live", {
        status: "live", playerId, baseBid: player.basePrice, currentBid: 0, currentTeam: "",
        bidCount: 0, lastBidAt: tx.serverTime(), pausedLeftMs: 0,
      });
      tx.update(`players/${playerId}`, { status: "live" });
      return { playerId };
    });
  }

  /* Marquee first, then A, B, C. Random inside a category. Unsold players only in a second round. */
  async function pickNext({ secondRound = false } = {}) {
    const players = await store.list("players");
    const pool = players.filter((p) => p.status === (secondRound ? "unsold" : "available"));
    if (!pool.length) return null;
    for (const cat of CATEGORY_ORDER) {
      const inCat = pool.filter((p) => p.category === cat);
      if (inCat.length) return inCat[Math.floor(Math.random() * inCat.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async function placeBid(team, expectedAmount) {
    if (!TEAM_KEYS.includes(team)) fail("invalid", "Unknown team.");
    const actor = actorEmail(); // captured now, before any await
    const cfg = await getConfig();
    if (!actor || actor !== (cfg.captains[team] || "").toLowerCase()) {
      fail("not-captain", "You are not the captain of this team.");
    }
    return store.run(async (tx) => {
      const [live, teamDoc] = await Promise.all([tx.get("auction/live"), tx.get(`teams/${team}`)]);
      if (!live || !teamDoc) fail("not-found", "The auction is not set up yet.");
      const verdict = checkBid({ team, live, teamState: teamDoc, cfg, nowMs: now() });
      if (!verdict.ok) fail("refused", verdict.reason);
      if (expectedAmount !== undefined && verdict.amount !== expectedAmount) {
        fail("stale", "Someone bid first. The price has changed.");
      }
      tx.update("auction/live", {
        currentBid: verdict.amount, currentTeam: team, bidCount: live.bidCount + 1, lastBidAt: tx.serverTime(),
      });
      return { amount: verdict.amount };
    });
  }

  /* The hammer falls: sold to the top bidder, or unsold if nobody bid.
     auto: true is used when the timer ran out; it refuses to fire early. */
  async function hammer({ auto = false } = {}) {
    requireAdmin();
    const cfg = await getConfig();
    return store.run(async (tx) => {
      const live = await tx.get("auction/live");
      if (!live || (live.status !== "live" && live.status !== "paused")) fail("invalid", "No player is on the block.");
      if (auto && (live.status !== "live" || timeLeftMs(live, now(), cfg.lotSeconds) > 0)) fail("early", "The clock is still running.");

      const result = settle(live);
      const player = await tx.get(`players/${live.playerId}`);
      if (!player) fail("not-found", "Player not found.");

      if (result.outcome === "sold") {
        const teamDoc = await tx.get(`teams/${result.team}`);
        if (result.price > teamDoc.purseLeft) fail("invalid", "The winning team cannot afford this price.");
        tx.update(`players/${live.playerId}`, { status: "sold", team: result.team, soldPrice: result.price, soldAt: tx.serverTime() });
        tx.update(`teams/${result.team}`, {
          purseLeft: teamDoc.purseLeft - result.price,
          squad: [...teamDoc.squad, live.playerId],
        });
      } else {
        tx.update(`players/${live.playerId}`, { status: "unsold" });
      }
      tx.set("auction/live", idleLive(tx.serverTime()));
      return { ...result, playerId: live.playerId, playerName: player.name, teamName: result.team ? cfg.teamNames[result.team] : "" };
    });
  }

  async function pause() {
    requireAdmin();
    const cfg = await getConfig();
    return store.run(async (tx) => {
      const live = await tx.get("auction/live");
      if (!live || live.status !== "live") fail("invalid", "Nothing to pause.");
      tx.update("auction/live", { status: "paused", pausedLeftMs: timeLeftMs(live, now(), cfg.lotSeconds) });
    });
  }

  /* Resuming restarts the clock at the full time. */
  async function resume() {
    requireAdmin();
    return store.run(async (tx) => {
      const live = await tx.get("auction/live");
      if (!live || live.status !== "paused") fail("invalid", "Nothing to resume.");
      tx.update("auction/live", { status: "live", lastBidAt: tx.serverTime(), pausedLeftMs: 0 });
    });
  }

  async function resetAuction() {
    requireAdmin();
    const players = await store.list("players");
    return store.run(async (tx) => {
      const cfg = mergeConfig(await tx.get("config/auction"));
      for (const p of players) tx.update(`players/${p.id}`, { status: "available", team: "", soldPrice: 0, soldAt: 0 });
      for (const k of TEAM_KEYS) tx.update(`teams/${k}`, { name: cfg.teamNames[k], purseLeft: cfg.purse, squad: [] });
      tx.set("auction/live", idleLive(tx.serverTime()));
    });
  }

  return {
    store, now, getConfig, ensureSetup, saveConfig,
    submitRegistration, approve, reject, setCategory,
    startLot, pickNext, placeBid, hammer, pause, resume, resetAuction,
  };
}

export { mergeConfig };
