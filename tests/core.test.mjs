import { test, eq, truthy } from "./harness.mjs";
import * as V from "../js/validators.js";
import * as L from "../js/auction-logic.js";
import { inr, inrShort } from "../js/format.js";
import { DEFAULT_CONFIG } from "../js/constants.js";

/* ---------- validators ---------- */
test("name accepts normal names", () => {
  for (const n of ["Krishna", "Krishna Chaitanya Reddy Kothakapu", "Anne-Marie O'Neil", "  Sai   Darshin  ", "Ravi K."]) eq(V.checkName(n), "", n);
});
test("name rejects bad names", () => {
  for (const n of ["", " ", "A", "R2D2", "x".repeat(61), "<script>", "12345", "-Ravi"]) truthy(V.checkName(n), JSON.stringify(n));
});

test("email accepts valid addresses and normalises case", () => {
  for (const e of ["a@b.co", "Krishna.Reddy+auction@gmail.com", "x_y@sub.domain.in"]) eq(V.checkEmail(e), "", e);
  eq(V.normEmail("  Krishna@Gmail.COM "), "krishna@gmail.com");
});
test("email rejects bad addresses", () => {
  for (const e of ["", "abc", "a@b", "a@@b.com", "a b@c.com", "a..b@c.com", ".a@c.com", "a@-c.com", "a@c.com.", "a@c.c", "@c.com", "a@c..com"]) {
    truthy(V.checkEmail(e), JSON.stringify(e));
  }
  truthy(V.checkEmail("a".repeat(101) + "@b.com"));
});

test("phone accepts 10 digits starting 6-9 and common prefixes", () => {
  for (const p of ["9876543210", "+91 98765 43210", "919876543210", "09876543210", "98765-43210", "6000000000"]) eq(V.checkPhone(p), "", p);
  eq(V.normPhone("+91 98765 43210"), "9876543210");
  eq(V.normPhone("09876543210"), "9876543210");
});
test("phone rejects bad numbers", () => {
  for (const p of ["", "12345", "5876543210", "98765432100", "98765abc10", "0000000000", "+1 9876543210"]) truthy(V.checkPhone(p), JSON.stringify(p));
});

test("employee id is exactly 4 digits", () => {
  for (const i of ["1234", "0001", " 4 5 6 7 "]) eq(V.checkEmpId(i), "", i);
  for (const i of ["", "123", "12345", "12a4", "abcd", "12.4"]) truthy(V.checkEmpId(i), JSON.stringify(i));
});

test("choices, skill, bio, consent", () => {
  eq(V.checkRole("Batter"), "");
  truthy(V.checkRole("Umpire"));
  truthy(V.checkBatting(""));
  truthy(V.checkBowling("Underarm"));
  eq(V.checkSkill("3"), "");
  for (const s of ["0", "6", "2.5", "", "abc"]) truthy(V.checkSkill(s), s);
  eq(V.checkBio(""), "");
  truthy(V.checkBio("x".repeat(141)));
  truthy(V.checkConsent(false));
  truthy(V.checkConsent("true"));
  eq(V.checkConsent(true), "");
});

test("photo checks", () => {
  eq(V.checkPhotoFile({ type: "image/png", size: 1000 }), "");
  truthy(V.checkPhotoFile({ type: "image/gif", size: 1000 }));
  truthy(V.checkPhotoFile({ type: "image/jpeg", size: 6 * 1024 * 1024 }));
  truthy(V.checkPhotoFile(null));
  eq(V.checkPhotoData("data:image/jpeg;base64,AAAA"), "");
  truthy(V.checkPhotoData("data:text/html;base64,AAAA"));
  truthy(V.checkPhotoData("data:image/jpeg;base64," + "A".repeat(150001)));
  truthy(V.checkPhotoData(""));
});

test("validateRegistration collects every error and cleans good input", () => {
  const bad = V.validateRegistration({});
  eq(bad.ok, false);
  eq(Object.keys(bad.errors).sort(), ["bio" === 1 ? "" : "batting", "bowling", "consent", "email", "empId", "name", "phone", "photo", "role", "skill"].sort());
  const good = V.validateRegistration({
    name: "  Krishna  Reddy ", email: " Krishna@Gmail.com ", phone: "+91 98765 43210", empId: "1234",
    role: "All-rounder", batting: "Right hand", bowling: "Right-arm pace", skill: "4", bio: "  Opens the batting ",
    photo: "data:image/jpeg;base64,AAAA", consent: true,
  });
  eq(good.ok, true);
  eq(good.clean.name, "Krishna Reddy");
  eq(good.clean.email, "krishna@gmail.com");
  eq(good.clean.phone, "9876543210");
  eq(good.clean.skill, 4);
  eq(good.clean.bio, "Opens the batting");
});

/* ---------- bid logic ---------- */
const cfg = { ...DEFAULT_CONFIG };
const liveBase = { status: "live", playerId: "1001", baseBid: 150000, currentBid: 0, currentTeam: "", bidCount: 0, lastBidAt: 1_000_000 };
const team = (purseLeft, n) => ({ purseLeft, squad: Array.from({ length: n }, (_, i) => String(i)) });

test("step grows with the price: 25k, 50k from 4L, 1L from 6L, 2L from 10L", () => {
  eq(L.stepFor(150000), 25000);
  eq(L.stepFor(375000), 25000);
  eq(L.stepFor(399999), 25000);
  eq(L.stepFor(400000), 50000);
  eq(L.stepFor(550000), 50000);
  eq(L.stepFor(600000), 100000);
  eq(L.stepFor(900000), 100000);
  eq(L.stepFor(1000000), 200000);
  eq(L.stepFor(1400000), 200000);
});

test("a full ladder from the base price", () => {
  let live = { ...liveBase }; const seen = [];
  for (let i = 0; i < 16; i += 1) { const a = L.nextBid(live); seen.push(a); live = { ...live, bidCount: live.bidCount + 1, currentBid: a }; }
  eq(seen, [150000,175000,200000,225000,250000,275000,300000,325000,350000,375000,400000,450000,500000,550000,600000,700000]);
});

test("first bid equals base, then adds a step", () => {
  eq(L.nextBid(liveBase), 150000);
  eq(L.nextBid({ ...liveBase, bidCount: 1, currentBid: 150000 }), 175000);
  eq(L.nextBid({ ...liveBase, bidCount: 9, currentBid: 1000000 }), 1200000);
});

test("a valid bid is accepted", () => {
  const r = L.checkBid({ team: "team1", live: liveBase, teamState: team(3000000, 0), cfg, nowMs: 1_005_000 });
  eq(r, { ok: true, amount: 150000 });
});

test("bids are refused when they should be", () => {
  const ok = { team: "team1", live: liveBase, teamState: team(3000000, 0), cfg, nowMs: 1_005_000 };
  truthy(!L.checkBid({ ...ok, live: { ...liveBase, status: "idle" } }).ok, "idle");
  truthy(!L.checkBid({ ...ok, live: { ...liveBase, status: "paused" } }).ok, "paused");
  truthy(!L.checkBid({ ...ok, nowMs: 1_000_000 + 30_001 }).ok, "late");
  truthy(L.checkBid({ ...ok, nowMs: 1_000_000 + 30_000 }).ok, "exactly on the clock still counts");
  truthy(!L.checkBid({ ...ok, live: { ...liveBase, currentTeam: "team1", bidCount: 1, currentBid: 150000 } }).ok, "self outbid");
  truthy(!L.checkBid({ ...ok, teamState: team(3000000, 13) }).ok, "squad full");
  truthy(!L.checkBid({ ...ok, teamState: team(100000, 0) }).ok, "cannot afford");
});

test("reserve rule keeps enough to fill the minimum squad", () => {
  // 10 players already (min 11): reserve for 0 more slots, so can spend everything
  eq(L.checkBid({ team: "team1", live: liveBase, teamState: team(150000, 10), cfg, nowMs: 1_001_000 }).ok, true);
  // 9 players: after this bid 10, need 1 more at 1.5L. Purse 250000 - 150000 = 100000 < 150000
  eq(L.checkBid({ team: "team1", live: liveBase, teamState: team(250000, 9), cfg, nowMs: 1_001_000 }).ok, false);
  // purse 300000 leaves 150000, exactly enough
  eq(L.checkBid({ team: "team1", live: liveBase, teamState: team(300000, 9), cfg, nowMs: 1_001_000 }).ok, true);
  eq(L.reserveNeeded(1, 11), 1500000);
  eq(L.reserveNeeded(11, 11), 0);
  eq(L.reserveNeeded(13, 11), 0);
});

test("time left and settle", () => {
  eq(L.timeLeftMs(liveBase, 1_010_000, 30), 20000);
  eq(L.timeLeftMs(liveBase, 1_100_000, 30), 0);
  eq(L.timeLeftMs({ ...liveBase, status: "paused", pausedLeftMs: 12000 }, 9_999_999, 30), 12000);
  eq(L.timeLeftMs({ ...liveBase, status: "idle" }, 1, 30), 0);
  eq(L.settle(liveBase), { outcome: "unsold" });
  eq(L.settle({ ...liveBase, bidCount: 3, currentBid: 250000, currentTeam: "team2" }), { outcome: "sold", team: "team2", price: 250000 });
});

test("money formatting uses Indian grouping", () => {
  eq(inr(3000000), "₹30,00,000");
  eq(inr(25000), "₹25,000");
  eq(inr(100000), "₹1,00,000");
  eq(inrShort(3000000), "₹30L");
  eq(inrShort(250000), "₹2.5L");
  eq(inrShort(25000), "₹25k");
});
