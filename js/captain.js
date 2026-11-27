import { renderChrome, h } from "./layout.js";
import { connect, roleOf } from "./db.js";
import { watchAll } from "./live-state.js";
import { createLotView, renderTeams } from "./lot-view.js";
import { checkBid } from "./auction-logic.js";
import { inr } from "./format.js";
import { openTeamSheet } from "./team-sheet.js";

renderChrome("");
const $ = (id) => document.getElementById(id);

function toast(text, bad = false) {
  const t = h("div", { class: "toast" + (bad ? " bad" : ""), text });
  $("toasts").append(t);
  setTimeout(() => t.remove(), bad ? 6000 : 3500);
}

const { store, engine, adminEmails, demo } = await connect();
let state = null;
let myTeam = null;
let started = false;
let pending = false;
let lastLeader = null;

/* ---------- sign in ---------- */
function buildSignin() {
  $("signin-text").textContent = demo
    ? "Demo mode. Pick a captain to act as. No password needed."
    : "Sign in with the Google account the organizer registered for your team.";
  const box = $("signin-buttons");
  box.textContent = "";
  const go = async (hint) => {
    $("signin-error").textContent = "";
    try { await store.auth.signIn(hint); } catch (err) {
      $("signin-error").textContent = "Sign-in failed. " + (err.code === "auth/popup-blocked" ? "Allow pop-ups for this site and try again." : (err.message || ""));
    }
  };
  if (demo) {
    box.append(
      h("button", { class: "btn btn-primary", text: "Continue as Captain 1", onClick: () => go("team1") }),
      h("button", { class: "btn btn-quiet", text: "Continue as Captain 2", onClick: () => go("team2") }),
    );
  } else {
    box.append(h("button", { class: "btn btn-primary", text: "Sign in with Google", onClick: () => go() }));
  }
}
buildSignin();
$("signout").addEventListener("click", () => store.auth.signOut());

store.auth.onChange(async (user) => {
  const cfg = await engine.getConfig().catch(() => null);
  const role = roleOf(user, cfg || { captains: {} }, adminEmails);
  myTeam = role.team;
  $("signout").hidden = !role.signedIn;
  $("see-team").hidden = !role.team;
  $("who").textContent = role.signedIn ? `Signed in as ${role.email}` : "";
  $("signin").hidden = role.signedIn;
  $("denied").hidden = !(role.signedIn && !role.team);
  $("room").hidden = !role.team;
  if (role.signedIn && !role.team) {
    $("denied-text").textContent = `${role.email} is not set as a captain. Ask the organizer to add this email in Setup, then reload.`;
  }
  if (role.team) start();
  else renderBid();
});

function start() {
  if (started) return;
  started = true;
  const lotView = createLotView($("lot"));
  lotView.setClock(() => engine.now());
  watchAll(store, {
    onState: (s) => { state = s; lotView.render(s); renderTeams($("teams"), s); renderSquad(); renderBid(); announce(); },
    onResult: (r) => lotView.flash(r, state.cfg),
  });
  setInterval(() => { lotView.tick(); renderBid(); }, 250);

  $("bid-btn").addEventListener("click", placeBid);
  const showTeam = (ev) => {
    if (!state || !myTeam) return;
    openTeamSheet({
      players: state.players.filter((p) => p.team === myTeam && p.status === "sold"),
      teamKey: myTeam,
      teamName: state.cfg.teamNames[myTeam],
      teamState: state.teams[myTeam],
      opener: ev.currentTarget,
    });
  };
  $("see-team").addEventListener("click", showTeam);
  $("see-team-2").addEventListener("click", showTeam);
}

/* ---------- bidding ---------- */
function verdict() {
  if (!state || !state.loaded.live || !state.teams[myTeam]) return { ok: false, reason: "Connecting..." };
  return checkBid({ team: myTeam, live: state.live, teamState: state.teams[myTeam], cfg: state.cfg, nowMs: engine.now() });
}

function renderBid() {
  const btn = $("bid-btn");
  if (!myTeam) return;
  const v = verdict();
  if (v.ok) {
    btn.disabled = pending;
    btn.textContent = `Bid ${inr(v.amount)}`;
    btn.dataset.amount = String(v.amount);
    $("bid-why").textContent = "";
  } else {
    btn.disabled = true;
    delete btn.dataset.amount;
    const idle = !state || !state.live || state.live.status === "idle";
    btn.textContent = idle ? "Waiting for a player" : "Bid not available";
    $("bid-why").textContent = v.reason;
  }
}

async function placeBid() {
  const btn = $("bid-btn");
  const amount = Number(btn.dataset.amount);
  if (!amount || pending) return;
  pending = true;
  btn.disabled = true;
  try {
    await engine.placeBid(myTeam, amount);
  } catch (err) {
    const msg = err.code === "permission-denied"
      ? "The server refused that bid. Someone may have bid first, or time ran out."
      : err.message;
    toast(msg, true);
  } finally {
    pending = false;
    renderBid();
  }
}

/* Tell screen readers and the captain when the lead changes hands. */
function announce() {
  if (!state || !state.live) return;
  const key = state.live.status === "live" ? `${state.live.playerId}:${state.live.currentTeam}:${state.live.bidCount}` : null;
  if (key && key !== lastLeader && state.live.bidCount > 0 && state.live.currentTeam !== myTeam) {
    toast(`${state.cfg.teamNames[state.live.currentTeam]} bid ${inr(state.live.currentBid)}`);
  }
  lastLeader = key;
}

/* ---------- my squad ---------- */
function renderSquad() {
  if (!state || !myTeam) return;
  const mine = state.players.filter((p) => p.team === myTeam && p.status === "sold");
  $("squad-sub").textContent = `${mine.length} of ${state.cfg.minSquad} to ${state.cfg.maxSquad} players.`;
  const list = $("squad");
  list.textContent = "";
  if (!mine.length) { list.append(h("li", { class: "empty", text: "No players yet." })); return; }
  for (const p of mine) {
    const t = h("div", { class: "thumb" });
    t.style.backgroundImage = `url(${p.photo})`;
    list.append(h("li", {}, t, h("span", {}, p.name, h("span", { class: "sub", text: `${p.role}, ${p.category}` })), h("span", { class: "price", text: inr(p.soldPrice) })));
  }
}
