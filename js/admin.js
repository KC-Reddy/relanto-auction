import { renderChrome, h } from "./layout.js";
import { connect, roleOf } from "./db.js";
import { watchAll } from "./live-state.js";
import { createLotView, renderTeams } from "./lot-view.js";
import { inr } from "./format.js";
import { CATEGORIES } from "./constants.js";
import { timeLeftMs } from "./auction-logic.js";
import { sendMail, mailIsLive, getAdminKey, setAdminKey, readOutbox, clearOutbox } from "./mail.js";
import { loadSamples, categoryForSkill } from "./demo-seed.js";
import { makeAvatar } from "./avatar.js";

renderChrome("");
const $ = (id) => document.getElementById(id);

/* ---------- small helpers ---------- */
function toast(text, bad = false) {
  const t = h("div", { class: "toast" + (bad ? " bad" : ""), text });
  $("toasts").append(t);
  setTimeout(() => t.remove(), bad ? 7000 : 3500);
}

function explain(err) {
  if (err && err.code === "permission-denied") return "Firebase refused this. Check that you are signed in as the organizer and that the rules are published.";
  return (err && err.message) || "Something went wrong.";
}

/* A button that needs a second click within 4 seconds. */
function twoStep(btn, armedLabel, action) {
  const original = btn.textContent;
  let armed = false;
  let timer;
  const reset = () => { armed = false; btn.textContent = original; btn.classList.remove("btn-confirm"); };
  btn.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      btn.textContent = armedLabel;
      btn.classList.add("btn-confirm");
      timer = setTimeout(reset, 4000);
      return;
    }
    clearTimeout(timer);
    reset();
    action();
  });
}

async function guarded(fn) {
  try { return await fn(); } catch (err) { toast(explain(err), true); console.error(err); return undefined; }
}

const istInputValue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace(" ", "T").slice(0, 16);
};

/* ---------- boot ---------- */
const { store, engine, adminEmails, demo } = await connect();
let started = false;
let watcher = null;
let state = null;
let regs = [];
let regFilter = "pending";
let secondRound = false;
let hammering = false;
const picked = {};
const sig = { regs: "", players: "" };

$("signin-btn").addEventListener("click", async () => {
  $("signin-error").textContent = "";
  try { await store.auth.signIn("admin"); } catch (err) {
    $("signin-error").textContent = "Sign-in failed. " + (err.code === "auth/popup-blocked" ? "Allow pop-ups for this site and try again." : explain(err));
  }
});
$("signout").addEventListener("click", () => store.auth.signOut());

store.auth.onChange((user) => applyUser(user));

async function applyUser(user) {
  const cfg = await engine.getConfig().catch(() => null);
  const role = roleOf(user, cfg || { captains: {} }, adminEmails);
  $("signout").hidden = !role.signedIn;
  $("who").textContent = role.signedIn ? `Signed in as ${role.email}` : "";
  $("signin").hidden = role.signedIn;
  $("denied").hidden = !(role.signedIn && !role.isAdmin);
  $("admin").hidden = !role.isAdmin;

  $("signin-text").textContent = demo
    ? "Demo mode. Press the button to act as the organizer. No password needed."
    : "Sign in with the Google account listed as organizer.";
  $("signin-btn").textContent = demo ? "Continue as organizer" : "Sign in with Google";
  if (role.signedIn && !role.isAdmin) {
    $("denied-text").textContent = `${role.email} is not in the organizer list. Sign out and use the organizer account.`;
  }
  if (role.isAdmin) start();
}

/* ---------- start once signed in as organizer ---------- */
async function start() {
  if (started) return;
  started = true;
  $("sec-demo").hidden = !demo;
  $("btn-clear-outbox").hidden = !demo;
  $("adminkey-field").hidden = !mailIsLive();
  $("adminkey").value = getAdminKey();
  $("adminkey").addEventListener("input", (e) => setAdminKey(e.target.value));
  $("mail-sub").textContent = mailIsLive()
    ? "Emails go out through your Apps Script. Approval emails send when you approve, sold emails when the hammer falls."
    : "Demo mode: emails are not sent. They are listed below as they would go out.";

  await guarded(() => engine.ensureSetup());

  const lotView = createLotView($("lot"));
  lotView.setClock(() => engine.now());

  watcher = watchAll(store, {
    onState: (s) => { state = s; renderAll(lotView); },
    onResult: (r) => lotView.flash(r, state.cfg),
  });
  store.watchCollection("registrations", (list) => { regs = list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); renderRegs(); });

  setInterval(() => { lotView.tick(); autoHammer(); }, 250);
  wireControls();
  wireSetup();
  wireMail();
  wireDemo();
}

/* ---------- rendering ---------- */
let formFilled = false;

function renderAll(lotView) {
  if (!state || !state.loaded.cfg) return;
  lotView.render(state);
  renderTeams($("teams"), state);
  renderControls();
  renderPlayers();
  renderRegs();
  renderOutbox();
  if (!formFilled) fillSetup();
}

function renderControls() {
  const live = state.live;
  const busy = live && (live.status === "live" || live.status === "paused");
  const available = state.players.filter((p) => p.status === "available");
  const unsold = state.players.filter((p) => p.status === "unsold");
  const pool = secondRound ? unsold : available;

  $("btn-next").hidden = busy;
  $("pick-player").hidden = busy;
  $("btn-pick").hidden = busy;
  $("btn-hammer").hidden = !busy;
  $("btn-pause").hidden = !busy;
  $("btn-pause").textContent = live && live.status === "paused" ? "Resume (restarts the clock)" : "Pause";
  $("btn-hammer").textContent = live && live.bidCount > 0 ? `Sold to ${state.cfg.teamNames[live.currentTeam]}` : "Mark unsold";
  $("btn-second").hidden = busy || secondRound || available.length > 0 || unsold.length === 0;
  $("btn-next").disabled = pool.length === 0;
  $("btn-pick").disabled = pool.length === 0;

  const select = $("pick-player");
  const current = select.value;
  const key = pool.map((p) => p.id).join(",");
  if (select.dataset.key !== key) {
    select.dataset.key = key;
    select.textContent = "";
    select.append(h("option", { value: "", text: pool.length ? "Pick a player" : "No players left" }));
    for (const p of pool) select.append(h("option", { value: p.id, text: `${p.name} (${CATEGORIES[p.category].label})` }));
    select.value = pool.some((p) => p.id === current) ? current : "";
  }

  const sold = state.players.filter((p) => p.status === "sold").length;
  $("live-sub").textContent = state.players.length
    ? `${sold} sold, ${available.length} waiting, ${unsold.length} unsold, ${state.players.length} in the pool.${secondRound ? " Second round: only unsold players are called." : ""}`
    : "Approve some registrations to fill the pool.";
}

function badge(status) { return h("span", { class: "badge", dataset: { s: status }, text: status }); }
function thumb(photo) { const d = h("div", { class: "thumb" }); d.style.backgroundImage = `url(${photo})`; return d; }

function renderRegs() {
  const counts = { pending: 0, approved: 0, rejected: 0 };
  regs.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });

  const tabs = $("reg-tabs");
  const tabKey = JSON.stringify([regFilter, counts]);
  if (tabs.dataset.key !== tabKey) {
    tabs.dataset.key = tabKey;
    tabs.textContent = "";
    for (const f of ["pending", "approved", "rejected", "all"]) {
      const n = f === "all" ? regs.length : counts[f] || 0;
      tabs.append(h("button", { class: "tab", type: "button", "aria-pressed": String(regFilter === f), text: `${f[0].toUpperCase() + f.slice(1)} (${n})`, onClick: () => { regFilter = f; sig.regs = ""; renderRegs(); } }));
    }
  }

  const shown = regs.filter((r) => regFilter === "all" || r.status === regFilter);
  const signature = JSON.stringify([regFilter, shown.map((r) => [r.id, r.status])]);
  if (signature === sig.regs) return;
  sig.regs = signature;

  const table = $("reg-table");
  table.textContent = "";
  if (!shown.length) {
    table.append(h("caption", { class: "empty", text: regFilter === "pending" ? "No registrations waiting. New ones appear here by themselves." : "Nothing here." }));
    return;
  }
  table.append(h("thead", {}, h("tr", {}, ["", "Player", "Contact", "Cricket", "Status", "Category", ""].map((t) => h("th", { scope: "col", text: t })))));
  const body = h("tbody");
  for (const r of shown) {
    const select = h("select", { class: "select", "aria-label": `Category for ${r.name}` },
      Object.entries(CATEGORIES).map(([k, c]) => h("option", { value: k, text: `${c.label} (${inr(c.base)})` })));
    select.value = picked[r.id] || categoryForSkill(r.skill);
    select.addEventListener("change", () => { picked[r.id] = select.value; });

    const approveBtn = h("button", { class: "btn btn-primary btn-small", type: "button", text: "Approve" });
    approveBtn.addEventListener("click", () => guarded(async () => {
      approveBtn.disabled = true;
      const out = await engine.approve(r.id, select.value);
      toast(`Approved ${out.name}`);
      const mail = await sendMail({ type: "approved", to: out.email, name: out.name, auctionDate: state.cfg.auctionDate });
      if (!mail.ok) toast(`Approved, but the email failed: ${mail.error}`, true);
      renderOutbox();
    }).finally(() => { approveBtn.disabled = false; }));
    const rejectBtn = h("button", { class: "btn btn-danger btn-small", type: "button", text: "Reject" });
    twoStep(rejectBtn, "Confirm reject", () => guarded(async () => { await engine.reject(r.id); toast(`Rejected ${r.name}`); }));

    body.append(h("tr", {},
      h("td", {}, thumb(r.photo)),
      h("td", {}, r.name, h("span", { class: "cell-sub", text: `ID ${r.id}` })),
      h("td", {}, r.email, h("span", { class: "cell-sub", text: r.phone })),
      h("td", {}, r.role, h("span", { class: "cell-sub", text: `${r.batting}, ${r.bowling}, skill ${r.skill}` })),
      h("td", {}, badge(r.status)),
      h("td", {}, r.status === "pending" ? select : ""),
      h("td", {}, h("div", { class: "actions" }, r.status === "pending" ? [approveBtn, rejectBtn] : [])),
    ));
  }
  table.append(body);
}

function renderPlayers() {
  const signature = JSON.stringify(state.players.map((p) => [p.id, p.status, p.category, p.team, p.soldPrice]));
  if (signature === sig.players) return;
  sig.players = signature;

  $("players-sub").textContent = state.players.length ? "Change a category before a player is called. The base price follows the category." : "No approved players yet.";
  const table = $("player-table");
  table.textContent = "";
  if (!state.players.length) return;
  table.append(h("thead", {}, h("tr", {}, ["", "Player", "Category", "Base price", "Status", "Team", "Sold for"].map((t, i) => h("th", { scope: "col", class: i >= 3 && i !== 4 && i !== 5 ? "num" : "", text: t })))));
  const body = h("tbody");
  for (const p of state.players) {
    const locked = p.status === "sold" || p.status === "live";
    const select = h("select", { class: "select", "aria-label": `Category for ${p.name}`, disabled: locked },
      Object.entries(CATEGORIES).map(([k, c]) => h("option", { value: k, text: c.label })));
    select.value = p.category;
    select.addEventListener("change", () => guarded(async () => { await engine.setCategory(p.id, select.value); toast(`${p.name} moved to ${CATEGORIES[select.value].label}`); }));
    body.append(h("tr", {},
      h("td", {}, thumb(p.photo)),
      h("td", {}, p.name, h("span", { class: "cell-sub", text: `ID ${p.id}, ${p.role}` })),
      h("td", {}, select),
      h("td", { class: "num", text: inr(p.basePrice) }),
      h("td", {}, badge(p.status)),
      h("td", { text: p.team ? state.cfg.teamNames[p.team] : "" }),
      h("td", { class: "num", text: p.soldPrice ? inr(p.soldPrice) : "" }),
    ));
  }
  table.append(body);
}

/* ---------- live controls ---------- */
function wireControls() {
  $("btn-next").addEventListener("click", () => guarded(async () => {
    const next = await engine.pickNext({ secondRound });
    if (!next) { toast("No players left to call."); return; }
    await engine.startLot(next.id);
  }));
  $("btn-pick").addEventListener("click", () => guarded(async () => {
    const id = $("pick-player").value;
    if (!id) { toast("Pick a player first.", true); return; }
    await engine.startLot(id);
  }));
  $("btn-hammer").addEventListener("click", () => doHammer(false));
  $("btn-pause").addEventListener("click", () => guarded(() => (state.live.status === "paused" ? engine.resume() : engine.pause())));
  $("btn-second").addEventListener("click", () => { secondRound = true; renderControls(); toast("Second round: unsold players will be called."); });
}

async function doHammer(auto) {
  if (hammering) return;
  hammering = true;
  try {
    const result = await engine.hammer({ auto });
    if (result.outcome === "sold") {
      toast(`${result.playerName} sold to ${result.teamName} for ${inr(result.price)}`);
      const reg = await store.get(`registrations/${result.playerId}`);
      if (reg) {
        const mail = await sendMail({ type: "sold", to: reg.email, name: reg.name, team: result.teamName, price: inr(result.price) });
        if (!mail.ok) toast(`Sold email to ${reg.name} failed: ${mail.error}`, true);
      }
    } else {
      toast(`${result.playerName} went unsold`);
    }
    renderOutbox();
  } catch (err) {
    if (err.code !== "early" && err.code !== "invalid") toast(explain(err), true);
  } finally {
    hammering = false;
  }
}

function autoHammer() {
  if (!state || !state.live || state.live.status !== "live" || !$("auto-hammer").checked || hammering) return;
  if (timeLeftMs(state.live, engine.now(), state.cfg.lotSeconds) <= 0) doHammer(true);
}

/* ---------- setup form ---------- */
function fillSetup() {
  const c = state.cfg;
  $("c-name1").value = c.teamNames.team1;
  $("c-name2").value = c.teamNames.team2;
  $("c-cap1").value = c.captains.team1;
  $("c-cap2").value = c.captains.team2;
  $("c-purse").value = c.purse / 100000;
  $("c-min").value = c.minSquad;
  $("c-max").value = c.maxSquad;
  $("c-lot").value = c.lotSeconds;
  $("c-date").value = istInputValue(c.auctionDate);
  $("c-open").checked = c.registrationOpen;
  formFilled = true;
}

function wireSetup() {
  $("setup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const status = $("setup-status");
    const date = $("c-date").value;
    const patch = {
      teamNames: { team1: $("c-name1").value, team2: $("c-name2").value },
      captains: { team1: $("c-cap1").value, team2: $("c-cap2").value },
      purse: Math.round(Number($("c-purse").value) * 100000),
      minSquad: Number($("c-min").value),
      maxSquad: Number($("c-max").value),
      lotSeconds: Number($("c-lot").value),
      registrationOpen: $("c-open").checked,
      auctionDate: date ? new Date(date + ":00+05:30").toISOString() : "",
    };
    status.textContent = "Saving...";
    status.className = "form-status";
    guarded(async () => {
      await engine.saveConfig(patch);
      status.textContent = "Saved.";
      status.className = "form-status good";
      toast("Setup saved");
      formFilled = false;
      return true;
    }).then((r) => { if (r === undefined) { status.textContent = "Not saved. See the message."; status.className = "form-status bad"; } });
  });
}

/* ---------- emails ---------- */
function renderOutbox() {
  const list = $("outbox");
  list.textContent = "";
  if (mailIsLive()) return;
  const box = readOutbox();
  if (!box.length) { list.append(h("li", { class: "empty", text: "Nothing in the demo outbox yet." })); return; }
  for (const m of box) {
    list.append(h("li", {},
      h("span", { class: "badge", text: m.type }), " ",
      h("strong", { text: m.name || "" }), " to ", h("span", { class: "mono", text: m.to }),
      m.team ? h("span", { class: "cell-sub", text: `${m.team} for ${m.price}` }) : null,
    ));
  }
}

function wireMail() {
  twoStep($("btn-unsold-mail"), "Confirm: email all unsold", () => guarded(async () => {
    const unsold = state.players.filter((p) => p.status === "unsold");
    if (!unsold.length) { toast("No unsold players."); return; }
    let ok = 0;
    for (const p of unsold) {
      const reg = await store.get(`registrations/${p.id}`);
      if (!reg) continue;
      const res = await sendMail({ type: "unsold", to: reg.email, name: reg.name });
      if (res.ok) ok += 1; else toast(`Email to ${reg.name} failed: ${res.error}`, true);
    }
    toast(`${ok} of ${unsold.length} unsold emails ${mailIsLive() ? "sent" : "added to the demo outbox"}`);
    renderOutbox();
  }));
  $("btn-clear-outbox").addEventListener("click", () => { clearOutbox(); renderOutbox(); });
  renderOutbox();
}

/* ---------- demo tools and reset ---------- */
function wireDemo() {
  $("btn-samples").addEventListener("click", () => guarded(async () => {
    $("btn-samples").disabled = true;
    const n = await loadSamples(engine, 25, makeAvatar);
    toast(`Loaded ${n} sample players`);
    $("btn-samples").disabled = false;
  }));
  twoStep($("btn-wipe"), "Confirm wipe", async () => { await store.wipe(); sig.regs = sig.players = ""; formFilled = false; clearOutbox(); toast("Demo data wiped"); });
  twoStep($("btn-reset"), "Confirm reset", () => guarded(async () => { await engine.resetAuction(); secondRound = false; toast("Auction reset"); }));
}
