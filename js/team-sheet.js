/* Team sheet: a TV style "line-up" reveal of a captain's squad. Photo, role, batting hand, bowling style, rating.
   Display only. It reads players that are already loaded and never writes anything. */

import { makeAvatar } from "./avatar.js";
import { inr } from "./format.js";
import { motionOn } from "./motion.js";

const ICON = {
  bat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.6 2.4l6 6-9.4 9.4-3.4-.7-.7-3.4z" fill="currentColor"/><path d="M8.6 15.4L3 21" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  ball: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M5 6.5c5 3 5 8 0 11M19 6.5c-5 3-5 8 0 11" fill="none" stroke="var(--rc)" stroke-width="1.5" stroke-dasharray="2 2" stroke-linecap="round"/></svg>',
  both: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.6 2.4l5 5-7.6 7.6-2.9-.6-.6-2.9z" fill="currentColor"/><path d="M7 12.6L2.5 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="18" cy="18" r="4.4" fill="currentColor"/><path d="M15.4 16.4c1.6 1 1.6 2.4 0 3.4" fill="none" stroke="var(--rc)" stroke-width="1" stroke-linecap="round"/></svg>',
  keeper: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 21.5v-8l-2-3.2 2.1-1.1 1.9 2.1V5.2h2.1V11V4h2.1v7V5.2h2.1v7l1-3 2.1.8-1.1 6.2c-.5 3.1-2.6 5.3-5.6 5.3z" fill="currentColor"/></svg>',
};
const ROLE = {
  "Batter": { label: "Batter", icon: "bat", tone: "bat" },
  "Bowler": { label: "Bowler", icon: "ball", tone: "bowl" },
  "All-rounder": { label: "All-rounder", icon: "both", tone: "all" },
  "Wicketkeeper": { label: "Wicketkeeper", icon: "keeper", tone: "keep" },
};

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function bowlText(b) {
  if (!b || /does not/i.test(b)) return null;
  return b;
}

function card(p, i, total) {
  const r = ROLE[p.role] || { label: p.role || "Player", icon: "bat", tone: "bat" };
  const photo = p.photo || makeAvatar(p.name || "Player");
  const hand = /left/i.test(p.batting) ? "L" : "R";
  const bowl = bowlText(p.bowling);
  const skill = Math.max(0, Math.min(5, Number(p.skill) || 0));
  const pips = Array.from({ length: 5 }, (_, k) => `<i class="${k < skill ? "on" : ""}"></i>`).join("");
  const c = el("li", `ts-card tone-${r.tone}`);
  c.innerHTML =
    `<span class="ts-no">${String(i + 1).padStart(2, "0")}</span>` +
    `<div class="ts-photo"><img src="${esc(photo)}" alt="" loading="eager"></div>` +
    `<div class="ts-role"><span class="ts-ico">${ICON[r.icon]}</span><span>${esc(r.label)}</span></div>` +
    `<h3 class="ts-name">${esc(p.name)}</h3>` +
    `<ul class="ts-facts">` +
    (p.batting ? `<li><span class="k">Bats</span><span class="v">${esc(p.batting)}<b class="hand">${hand}</b></span></li>` : "") +
    (bowl ? `<li><span class="k">Bowls</span><span class="v">${esc(bowl)}</span></li>` : `<li class="dim"><span class="k">Bowls</span><span class="v">Does not bowl</span></li>`) +
    `<li><span class="k">Rating</span><span class="v pips" aria-label="${skill} out of 5">${pips}</span></li>` +
    `</ul>` +
    (p.bio ? `<p class="ts-bio">${esc(p.bio)}</p>` : "") +
    (p.soldPrice ? `<p class="ts-price">${esc(inr(p.soldPrice))}</p>` : "");
  return c;
}

function countsLine(list) {
  const n = (role) => list.filter((p) => p.role === role).length;
  const bits = [];
  const add = (cnt, one, many) => { if (cnt) bits.push(`${cnt} ${cnt === 1 ? one : many}`); };
  add(n("Batter"), "batter", "batters");
  add(n("Bowler"), "bowler", "bowlers");
  add(n("All-rounder"), "all-rounder", "all-rounders");
  add(n("Wicketkeeper"), "wicketkeeper", "wicketkeepers");
  return bits;
}

export function openTeamSheet({ players, teamKey, teamName, teamState, opener }) {
  const list = players.slice().sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
  const root = el("div", `ts team-${teamKey}`);
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", `${teamName} team sheet`);
  root.innerHTML =
    '<div class="ts-bg" aria-hidden="true"></div>' +
    '<div class="ts-bar"><button class="btn btn-quiet btn-small ts-replay" type="button">Replay</button><button class="btn btn-primary btn-small ts-close" type="button">Close</button></div>' +
    '<div class="ts-scroll" data-lenis-prevent>' +
    '<header class="ts-head"><span class="ts-stripe" aria-hidden="true"></span>' +
    `<p class="ts-kicker">Line-up</p><h2 class="ts-title">${esc(teamName)}</h2>` +
    '<div class="ts-chips"></div></header>' +
    '<ul class="ts-grid"></ul></div>';
  const chips = root.querySelector(".ts-chips");
  const grid = root.querySelector(".ts-grid");
  const bits = countsLine(list);
  const spent = teamState && Number.isFinite(teamState.purseLeft) ? `Purse left ${inr(teamState.purseLeft)}` : "";
  [`${list.length} ${list.length === 1 ? "player" : "players"}`, ...bits, spent].filter(Boolean).forEach((t) => chips.append(el("span", "ts-chip", esc(t))));

  const build = () => {
    grid.textContent = "";
    if (!list.length) {
      grid.append(el("li", "ts-empty", "No players yet. Your line-up appears here as you win players."));
      return;
    }
    list.forEach((p, i) => grid.append(card(p, i, list.length)));
  };

  const play = () => {
    build();
    if (!motionOn) return;
    const title = root.querySelector(".ts-title");
    const stripe = root.querySelector(".ts-stripe");
    const kicker = root.querySelector(".ts-kicker");
    const ease = "cubic-bezier(.2,.9,.25,1)";
    stripe.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 520, easing: ease, fill: "both" });
    kicker.animate([{ opacity: 0, transform: "translateX(-24px)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: 160, easing: ease, fill: "both" });
    title.animate([{ opacity: 0, transform: "translateY(60%) skewX(-8deg)" }, { opacity: 1, transform: "skewX(-8deg)" }], { duration: 560, delay: 120, easing: ease, fill: "both" });
    [...chips.children].forEach((c, i) => c.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 420 + i * 70, easing: ease, fill: "both" }));
    [...grid.children].forEach((c, i) => {
      if (!c.classList.contains("ts-card")) return;
      const side = i % 2 ? 70 : -70;
      const d = 520 + i * 90;
      c.animate(
        [{ opacity: 0, transform: `translate(${side}px, 46px) rotate(${side > 0 ? 4 : -4}deg) scale(.92)` }, { opacity: 1, transform: "none" }],
        { duration: 520, delay: d, easing: ease, fill: "both" },
      );
      const ph = c.querySelector(".ts-photo");
      ph.animate([{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: 520, delay: d + 140, easing: ease, fill: "both" });
      c.querySelector(".ts-role").animate([{ opacity: 0, transform: "translateX(-30px) skewX(-14deg)" }, { opacity: 1, transform: "skewX(-14deg)" }], { duration: 360, delay: d + 300, easing: ease, fill: "both" });
      c.querySelector(".ts-name").animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 320, delay: d + 340, easing: ease, fill: "both" });
      [...c.querySelectorAll(".ts-facts li")].forEach((f, k) => f.animate([{ opacity: 0, transform: "translateX(-14px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: d + 420 + k * 80, easing: ease, fill: "both" }));
      const on = c.querySelectorAll(".pips i.on");
      on.forEach((pip, k) => pip.animate([{ transform: "scale(0)" }, { transform: "scale(1.35)", offset: 0.6 }, { transform: "scale(1)" }], { duration: 300, delay: d + 640 + k * 70, easing: "ease-out", fill: "both" }));
      const shine = c.querySelector(".ts-photo");
      shine.style.setProperty("--shine-delay", `${d + 900}ms`);
      shine.classList.remove("shine"); void shine.offsetWidth; shine.classList.add("shine");
    });
  };

  const prevOverflow = document.body.style.overflow;
  const close = () => {
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = prevOverflow;
    const done = () => { root.remove(); if (opener && opener.focus) opener.focus(); };
    if (!motionOn) return done();
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" }).onfinish = done;
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (e.key === "Tab") {
      const f = [...root.querySelectorAll("button")];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  root.querySelector(".ts-close").addEventListener("click", close);
  root.querySelector(".ts-replay").addEventListener("click", play);
  document.addEventListener("keydown", onKey);
  document.body.style.overflow = "hidden";
  document.body.append(root);
  if (motionOn) root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: "both" });
  play();
  root.querySelector(".ts-close").focus({ preventScroll: true });
  return { close };
}
