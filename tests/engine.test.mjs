import { test, eq, truthy } from "./harness.mjs";
import { createDemoStore, DEMO_USERS } from "../js/store-demo.js";
import { createEngine } from "../js/engine.js";
import { loadSamples, sampleRegistrations } from "../js/demo-seed.js";
import { DEFAULT_CONFIG, MIN_BASE } from "../js/constants.js";

async function fresh() {
  const store = await createDemoStore({ sessionStorageLike: null });
  const engine = createEngine(store, { adminEmails: [DEMO_USERS.admin] });
  const as = async (who) => (who ? store.auth.signIn(who) : store.auth.signOut());
  return { store, engine, as };
}
async function rejects(fn, code) {
  try { await fn(); } catch (e) { if (code && e.code !== code) throw new Error(`wanted ${code}, got ${e.code}: ${e.message}`); return; }
  throw new Error("expected a rejection" + (code ? ` (${code})` : ""));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- registration ---------- */
test("registration stores a pending record and blocks duplicate employee ids", async () => {
  const { store, engine } = await fresh();
  const [r] = sampleRegistrations(1);
  await engine.submitRegistration(r);
  eq((await store.get("registrations/" + r.empId)).status, "pending");
  await rejects(() => engine.submitRegistration(r), "duplicate");
});

test("registration can be closed by the organizer", async () => {
  const { engine, as } = await fresh();
  await as("admin");
  await engine.saveConfig({ registrationOpen: false });
  await as(null);
  await rejects(() => engine.submitRegistration(sampleRegistrations(1)[0]), "closed");
});

test("approving creates a public player without email or phone", async () => {
  const { store, engine, as } = await fresh();
  const [r] = sampleRegistrations(1);
  await engine.submitRegistration(r);
  await rejects(() => engine.approve(r.empId, "A"), "not-admin");
  await as("admin");
  await rejects(() => engine.approve(r.empId, "Z"), "invalid");
  const out = await engine.approve(r.empId, "A");
  eq(out.email, r.email);
  const p = await store.get("players/" + r.empId);
  eq(p.basePrice, 300000);
  eq(p.status, "available");
  truthy(!("email" in p) && !("phone" in p), "public player must not carry contact details");
  await rejects(() => engine.approve(r.empId, "A"), "invalid");
});

/* ---------- config ---------- */
test("config validation and locking", async () => {
  const { engine, as } = await fresh();
  await as("admin");
  await rejects(() => engine.saveConfig({ purse: 5 }), "invalid");
  await rejects(() => engine.saveConfig({ minSquad: 14, maxSquad: 13 }), "invalid");
  await rejects(() => engine.saveConfig({ lotSeconds: 5 }), "invalid");
  await rejects(() => engine.saveConfig({ captains: { team1: "nope", team2: "" } }), "invalid");
  await rejects(() => engine.saveConfig({ captains: { team1: "a@b.co", team2: "A@B.co" } }), "invalid");
  await rejects(() => engine.saveConfig({ teamNames: { team1: "   " } }), "invalid");
  const cfg = await engine.saveConfig({ teamNames: { team1: "Royals" }, purse: 4000000, captains: { team1: " Cap@X.com " } });
  eq(cfg.teamNames.team1, "Royals");
  eq(cfg.captains.team1, "cap@x.com");
  eq((await engine.store.get("teams/team1")).purseLeft, 4000000);
});

/* ---------- bidding rules ---------- */
async function readyLot(playerIndex = 0) {
  const ctx = await fresh();
  await ctx.as("admin");
  await loadSamples(ctx.engine, 25);
  const players = await ctx.store.list("players");
  const p = players[playerIndex];
  await ctx.engine.startLot(p.id);
  return { ...ctx, p };
}

test("only the right captain can bid, amounts are fixed, and the clock is enforced", async () => {
  const { engine, as, store, p } = await readyLot(0);
  await as(null);
  await rejects(() => engine.placeBid("team1"), "not-captain");
  await as("team2");
  await rejects(() => engine.placeBid("team1"), "not-captain");
  await as("team1");
  const first = await engine.placeBid("team1", p.basePrice);
  eq(first.amount, p.basePrice);
  await rejects(() => engine.placeBid("team1"), "refused");
  await as("team2");
  await rejects(() => engine.placeBid("team2", p.basePrice), "stale");
  const second = await engine.placeBid("team2", p.basePrice + 25000);
  eq(second.amount, p.basePrice + 25000);
  const live = await store.get("auction/live");
  eq(live.currentTeam, "team2");
  eq(live.bidCount, 2);
});

test("a late bid is refused", async () => {
  const { engine, as, store } = await readyLot(1);
  await store.run(async (tx) => tx.update("auction/live", { lastBidAt: Date.now() - 31000 }));
  await as("team1");
  await rejects(() => engine.placeBid("team1"), "refused");
});

test("hammer: sold moves money and squad, unsold marks the player, early auto-hammer is refused", async () => {
  const { engine, as, store, p } = await readyLot(2);
  await as("admin");
  await rejects(() => engine.hammer({ auto: true }), "early");
  await as("team1");
  await engine.placeBid("team1", p.basePrice);
  await as("admin");
  const sold = await engine.hammer();
  eq([sold.outcome, sold.team, sold.price], ["sold", "team1", p.basePrice]);
  const t1 = await store.get("teams/team1");
  eq(t1.purseLeft, DEFAULT_CONFIG.purse - p.basePrice);
  eq(t1.squad, [p.id]);
  eq((await store.get("players/" + p.id)).status, "sold");
  eq((await store.get("auction/live")).status, "idle");

  const next = await engine.pickNext();
  await engine.startLot(next.id);
  const unsold = await engine.hammer();
  eq(unsold.outcome, "unsold");
  eq((await store.get("players/" + next.id)).status, "unsold");
  await rejects(() => engine.hammer(), "invalid");
});

test("auto hammer fires once the clock has run out", async () => {
  const { engine, as, store } = await readyLot(3);
  await store.run(async (tx) => tx.update("auction/live", { lastBidAt: Date.now() - 31000 }));
  await as("admin");
  eq((await engine.hammer({ auto: true })).outcome, "unsold");
});

test("pause blocks bids and resume restarts the clock", async () => {
  const { engine, as, store } = await readyLot(4);
  await as("admin");
  await engine.pause();
  eq((await store.get("auction/live")).status, "paused");
  await as("team1");
  await rejects(() => engine.placeBid("team1"), "refused");
  await as("admin");
  await engine.resume();
  await as("team1");
  eq((await engine.placeBid("team1")).amount > 0, true);
});

test("second lot cannot start while one is live; starting needs admin", async () => {
  const { engine, as, store } = await readyLot(5);
  const others = (await store.list("players")).filter((x) => x.status === "available");
  await rejects(() => engine.startLot(others[0].id), "busy");
  await as("team1");
  await rejects(() => engine.startLot(others[0].id), "not-admin");
});

test("pickNext goes marquee first, then A, B, C; second round uses unsold players", async () => {
  const { engine, as, store } = await fresh();
  await as("admin");
  await loadSamples(engine, 25);
  const order = [];
  for (let i = 0; i < 25; i += 1) {
    const n = await engine.pickNext();
    order.push(n.category);
    await engine.startLot(n.id);
    await engine.hammer();
  }
  const rank = { marquee: 0, A: 1, B: 2, C: 3 };
  const ranks = order.map((c) => rank[c]);
  eq(ranks, [...ranks].sort((a, b) => a - b));
  eq(await engine.pickNext(), null);
  const again = await engine.pickNext({ secondRound: true });
  truthy(again && again.status === "unsold");
  eq((await store.list("players")).every((x) => x.status === "unsold"), true);
});

/* ---------- full simulated auction: the invariants that must never break ---------- */
test("full auction with 25 players and two aggressive captains keeps every rule", async () => {
  const { engine, as, store } = await fresh();
  await as("admin");
  await loadSamples(engine, 25);
  const cfg = await engine.getConfig();
  let seed = 12345;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

  for (let guard = 0; guard < 60; guard += 1) {
    const next = await engine.pickNext();
    if (!next) break;
    await as("admin");
    await engine.startLot(next.id);
    for (let round = 0; round < 40; round += 1) {
      const team = rand() < 0.5 ? "team1" : "team2";
      await as(team);
      if (rand() < 0.15) break; // captain stops bidding
      try { await engine.placeBid(team); } catch (e) { if (e.code !== "refused") throw e; }
    }
    await as("admin");
    await engine.hammer();

    for (const k of ["team1", "team2"]) {
      const t = await store.get("teams/" + k);
      truthy(t.purseLeft >= 0, `${k} purse never negative`);
      truthy(t.squad.length <= cfg.maxSquad, `${k} squad within max`);
      const slots = Math.max(0, cfg.minSquad - t.squad.length);
      truthy(t.purseLeft >= slots * MIN_BASE, `${k} can still afford the minimum squad (${t.squad.length} players, ${t.purseLeft} left)`);
    }
  }

  const players = await store.list("players");
  const sold = players.filter((x) => x.status === "sold");
  const spent = { team1: 0, team2: 0 };
  sold.forEach((x) => { spent[x.team] += x.soldPrice; truthy(x.soldPrice >= x.basePrice, "sold at or above base"); });
  for (const k of ["team1", "team2"]) {
    const t = await store.get("teams/" + k);
    eq(t.purseLeft + spent[k], cfg.purse, `${k} money adds up`);
    eq(t.squad.length, sold.filter((x) => x.team === k).length, `${k} squad matches sold players`);
  }
  eq(players.every((x) => ["sold", "unsold"].includes(x.status)), true);
});

test("reset puts everything back", async () => {
  const { engine, as, store } = await fresh();
  await as("admin");
  await loadSamples(engine, 6);
  const n = await engine.pickNext();
  await engine.startLot(n.id);
  await as("team1");
  await engine.placeBid("team1");
  await as("admin");
  await engine.hammer();
  await engine.resetAuction();
  const players = await store.list("players");
  eq(players.every((p) => p.status === "available" && p.team === "" && p.soldPrice === 0), true);
  const t1 = await store.get("teams/team1");
  eq([t1.purseLeft, t1.squad], [DEFAULT_CONFIG.purse, []]);
  eq((await store.get("auction/live")).status, "idle");
});

test("two captains bidding at the same moment: one wins, the other is told the price moved", async () => {
  const { engine, as, store, p } = await readyLot(6);
  await as("team1");
  const a = engine.placeBid("team1", p.basePrice); // actor captured at call time
  await as("team2");
  const b = engine.placeBid("team2", p.basePrice); // same displayed price, clicked together
  const results = await Promise.allSettled([a, b]);
  eq(results[0].status, "fulfilled");
  eq(results[1].status, "rejected");
  eq(results[1].reason.code, "stale");
  const live = await store.get("auction/live");
  eq([live.currentTeam, live.currentBid, live.bidCount], ["team1", p.basePrice, 1]);
});

test("simulation really exercises bidding and the purse limits", async () => {
  const { engine, as, store } = await fresh();
  await as("admin");
  await loadSamples(engine, 25);
  // team1 always bids, team2 never: team1 should hit the squad max and then be refused
  let refusedForSquad = false;
  for (let i = 0; i < 25; i += 1) {
    const n = await engine.pickNext();
    if (!n) break;
    await as("admin"); await engine.startLot(n.id);
    await as("team1");
    try { await engine.placeBid("team1"); } catch (e) { if (/squad is full|too little|Not enough/.test(e.message)) refusedForSquad = true; else throw e; }
    await as("admin"); await engine.hammer();
  }
  const t1 = await store.get("teams/team1");
  eq(t1.squad.length <= 13, true);
  eq(refusedForSquad, true);
});

/* ---------- desk bidding (organizer types in bids called out loud) ---------- */
async function deskSetup() {
  const ctx = await fresh();
  await ctx.as("admin");
  await loadSamples(ctx.engine, 5);
  const n = await ctx.engine.pickNext();
  await ctx.engine.startLot(n.id);
  return ctx;
}

test("desk bids run without captains and without a clock", async () => {
  const { engine, store } = await deskSetup();
  const a = await engine.deskBid("team1");
  const b = await engine.deskBid("team2");
  eq(b.amount > a.amount, true);
  const live = await store.get("auction/live");
  eq(live.bidCount, 2);
  eq(live.currentTeam, "team2");
  eq(live.history.length, 2);
});

test("desk bids still follow the rules", async () => {
  const { engine, as } = await deskSetup();
  await engine.deskBid("team1");
  await rejects(() => engine.deskBid("team1"), "refused");           // already leading
  await rejects(() => engine.deskBid("team1", 123), "refused");
  await rejects(() => engine.deskBid("team9"), "invalid");
  await as("team2");
  await rejects(() => engine.deskBid("team2"), "not-admin");          // captains cannot use the desk
  await as(null);
  await rejects(() => engine.deskBid("team2"), "not-admin");
});

test("a stale expected amount is refused", async () => {
  const { engine } = await deskSetup();
  const first = await engine.deskBid("team1");
  await rejects(() => engine.deskBid("team2", first.amount), "stale");
});

test("undo removes the last bid and restores the previous leader", async () => {
  const { engine, store } = await deskSetup();
  const a = await engine.deskBid("team1");
  await engine.deskBid("team2");
  await engine.undoBid();
  let live = await store.get("auction/live");
  eq(live.currentTeam, "team1");
  eq(live.currentBid, a.amount);
  eq(live.bidCount, 1);
  await engine.undoBid();
  live = await store.get("auction/live");
  eq(live.currentTeam, "");
  eq(live.currentBid, 0);
  eq(live.bidCount, 0);
  await rejects(() => engine.undoBid(), "invalid");
});

test("undo then hammer sells at the restored price", async () => {
  const { engine, store } = await deskSetup();
  const a = await engine.deskBid("team1");
  await engine.deskBid("team2");
  await engine.undoBid();
  const r = await engine.hammer();
  eq(r.outcome, "sold");
  eq(r.team, "team1");
  eq(r.price, a.amount);
  eq((await store.get("teams/team1")).purseLeft, DEFAULT_CONFIG.purse - a.amount);
});
