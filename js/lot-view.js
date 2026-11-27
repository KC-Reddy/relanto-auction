/* The "player on the block" card, shared by the projector screen, the captain room and the organizer console. */

import { h } from "./layout.js";
import { inr, mmss } from "./format.js";
import { timeLeftMs, nextBid } from "./auction-logic.js";
import { CATEGORIES } from "./constants.js";
import { fx } from "./motion.js";
import { bowled } from "./cricket-fx.js";

/* Turn a string like "₹2,25,000" into scoreboard tiles. Only rebuilds when the text changes. */
export function setTiles(el, text) {
  if (el.dataset.val === text) return false;
  el.dataset.val = text;
  el.setAttribute("aria-label", text);
  el.textContent = "";
  for (const ch of text) {
    const span = h("span", { "aria-hidden": "true", class: /\d/.test(ch) ? "tile bump" : "tile-sep", text: ch });
    el.append(span);
  }
  return true;
}

export function createLotView(root, { big = false } = {}) {
  root.classList.add("lot");
  if (big) root.classList.add("lot-big");

  const photo = h("div", { class: "lot-photo", role: "img", "aria-label": "" });
  const name = h("h2", { class: "lot-name" });
  const meta = h("p", { class: "lot-meta" });
  const skill = h("p", { class: "lot-skill" });
  const base = h("p", { class: "lot-base" });
  const bidLabel = h("p", { class: "lot-bid-label" });
  const bid = h("div", { class: "tiles lot-bid" });
  const leader = h("p", { class: "lot-leader" });
  const barFill = h("div", { class: "timer-fill" });
  const bar = h("div", { class: "timer-bar", "aria-hidden": "true" }, barFill);
  const clock = h("p", { class: "timer-text", role: "timer", "aria-live": "off" });
  const idle = h("div", { class: "lot-idle" }, h("p", { class: "lot-idle-title" }), h("p", { class: "lot-idle-sub" }));
  const stamp = h("div", { class: "stamp", "aria-live": "assertive" });

  const card = h("div", { class: "lot-card" },
    photo,
    h("div", { class: "lot-body" }, name, meta, skill, base, bidLabel, bid, leader, bar, clock),
  );
  root.append(card, idle, stamp);

  let flashTimer = null;
  let seen = { playerId: null, bidCount: -1, team: "" };
  let last = { cfg: null, live: null, player: null, teams: null };

  function render(state) {
    const { cfg, live } = state;
    const player = live && live.playerId ? state.players.find((p) => p.id === live.playerId) : null;
    last = { cfg, live, player, teams: state.teams };
    const active = live && (live.status === "live" || live.status === "paused") && player;

    card.hidden = !active;
    idle.hidden = Boolean(active);
    if (!active) {
      const total = state.players.length;
      const done = state.players.filter((p) => p.status === "sold" || p.status === "unsold").length;
      idle.querySelector(".lot-idle-title").textContent = !state.loaded.live
        ? "Connecting..."
        : total === 0 ? "No players yet" : done === total ? "The auction is complete" : "Waiting for the next player";
      idle.querySelector(".lot-idle-sub").textContent = total ? `${done} of ${total} players have been through the hammer.` : "Players appear here once the organizer approves them.";
      return;
    }

    const newPlayer = seen.playerId !== player.id;
    const newBid = !newPlayer && live.bidCount > seen.bidCount;
    photo.style.backgroundImage = `url(${player.photo})`;
    photo.setAttribute("aria-label", `Photo of ${player.name}`);
    name.textContent = player.name;
    meta.textContent = [player.role, player.batting, player.bowling].filter(Boolean).join("  |  ");
    skill.textContent = `Skill ${player.skill} of 5`;
    const cat = CATEGORIES[player.category];
    base.textContent = `${cat ? cat.label : "Player"}, base price ${inr(live.baseBid)}`;

    const hasBid = live.bidCount > 0;
    bidLabel.textContent = hasBid ? "Current bid" : "Opening price";
    setTiles(bid, inr(hasBid ? live.currentBid : live.baseBid));

    if (hasBid) {
      leader.textContent = `${cfg.teamNames[live.currentTeam]} leads`;
      leader.dataset.team = live.currentTeam;
    } else {
      leader.textContent = `Next bid: ${inr(nextBid(live))}`;
      leader.dataset.team = "";
    }
    card.dataset.paused = live.status === "paused" ? "true" : "false";

    /* motion: a new player walks on, a new bid flashes the card and slides the leader in */
    if (newPlayer) {
      fx.pop(photo);
      fx.slideUp(name, 60);
      fx.slideUp(meta, 120);
      fx.slideUp(bid, 180, 20);
    } else if (newBid) {
      fx.flash(card, live.currentTeam === "team2" ? "rgba(240,176,58,0.22)" : "rgba(193,39,45,0.3)");
      fx.pulse(bid, 1.04);
      if (live.currentTeam !== seen.team) fx.slideIn(leader, live.currentTeam === "team1" ? "left" : "right");
    }
    seen = { playerId: player.id, bidCount: live.bidCount, team: live.bidCount > 0 ? live.currentTeam : "" };
    tick();
  }

  /* Called several times a second by the page. */
  function tick() {
    const { cfg, live } = last;
    if (!live || !cfg || (live.status !== "live" && live.status !== "paused")) return;
    if (live.status === "paused") {
      bar.hidden = !cfg.timerOn;
      clock.hidden = false;
      clock.textContent = "Paused";
      barFill.style.width = "100%";
      bar.dataset.low = "false";
      return;
    }
    bar.hidden = !cfg.timerOn;
    clock.hidden = !cfg.timerOn;
    if (!cfg.timerOn) return;
    const nowMs = tick.now ? tick.now() : Date.now();
    const left = timeLeftMs(live, nowMs, cfg.lotSeconds);
    clock.textContent = left > 0 ? mmss(left) : "Time";
    barFill.style.width = `${Math.min(100, (left / (cfg.lotSeconds * 1000)) * 100)}%`;
    bar.dataset.low = left <= 8000 ? "true" : "false";
  }

  /* SOLD / UNSOLD stamp over the card for a few seconds. */
  function flash(result, cfg) {
    clearTimeout(flashTimer);
    stamp.className = "stamp show " + result.outcome;
    stamp.dataset.team = result.team || "";
    stamp.textContent = "";
    stamp.append(
      h("span", { class: "stamp-word", text: result.outcome === "sold" ? "Sold" : "Unsold" }),
      h("span", { class: "stamp-line", text: result.player.name }),
      result.outcome === "sold"
        ? h("span", { class: "stamp-line", text: `${cfg.teamNames[result.team]} for ${inr(result.price)}` })
        : h("span", { class: "stamp-line", text: "Back in the pool" }),
    );
    flashTimer = setTimeout(() => { stamp.className = "stamp"; stamp.textContent = ""; }, 4500);
    if (result.outcome === "sold") {
      fx.thump(root);
      fx.slam(stamp.querySelector(".stamp-word"));
      if (big) {
        bowled();
      }
    } else {
      fx.slideUp(stamp.querySelector(".stamp-word"), 0, 24);
    }
  }

  return { render, tick, flash, setClock(fn) { tick.now = fn; } };
}

/* Two team cards: purse left and squad size. */
export function renderTeams(root, state) {
  let before = {};
  try { before = JSON.parse(root.dataset.purse || "{}"); } catch { before = {}; }
  const after = {};
  root.textContent = "";
  for (const k of ["team1", "team2"]) {
    const t = state.teams[k];
    const cfg = state.cfg;
    const count = t ? t.squad.length : 0;
    const purse = h("p", { class: "team-chip-purse", text: t ? inr(t.purseLeft) : "..." });
    after[k] = purse.textContent;
    root.append(h("div", { class: "team-chip", dataset: { team: k } },
      h("p", { class: "team-chip-name", text: cfg.teamNames[k] }),
      purse,
      h("p", { class: "team-chip-sub", text: `${count} of ${cfg.minSquad} to ${cfg.maxSquad} players` }),
    ));
    if (before[k] && before[k] !== after[k]) fx.pulse(purse, 1.08);
  }
  root.dataset.purse = JSON.stringify(after);
}
