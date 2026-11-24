import { renderChrome, h } from "./layout.js";
import { connect } from "./db.js";
import { watchAll } from "./live-state.js";
import { inr } from "./format.js";
import { CATEGORIES } from "./constants.js";

renderChrome("results.html");
const $ = (id) => document.getElementById(id);
const { store } = await connect();
let state = null;

watchAll(store, { onState: (s) => { state = s; render(); } });

function playerRow(p, showPrice) {
  const t = h("div", { class: "thumb" });
  t.style.backgroundImage = `url(${p.photo})`;
  return h("li", {}, t,
    h("span", {}, p.name, h("span", { class: "sub", text: `${p.role}, ${CATEGORIES[p.category] ? CATEGORIES[p.category].label : ""}` })),
    h("span", { class: "price", text: showPrice ? inr(p.soldPrice) : "" }));
}

function render() {
  if (!state || !state.loaded.players) return;
  const { cfg, players } = state;
  const sold = players.filter((p) => p.status === "sold");
  const unsold = players.filter((p) => p.status === "unsold");
  $("progress").textContent = `${sold.length} sold, ${unsold.length} unsold, ${players.length - sold.length - unsold.length} still to come.`;

  const grid = $("teams");
  grid.textContent = "";
  for (const k of ["team1", "team2"]) {
    const t = state.teams[k];
    const squad = sold.filter((p) => p.team === k).sort((a, b) => b.soldPrice - a.soldPrice);
    const spent = squad.reduce((n, p) => n + p.soldPrice, 0);
    const list = h("ul", { class: "squad" }, squad.length ? squad.map((p) => playerRow(p, true)) : h("li", { class: "empty", text: "No players yet." }));
    grid.append(h("section", {},
      h("div", { class: "result-head", dataset: { team: k } },
        h("h2", { text: cfg.teamNames[k] }),
        h("dl", { class: "result-stats" },
          h("div", {}, h("dt", { text: "Players" }), h("dd", { text: String(squad.length) })),
          h("div", {}, h("dt", { text: "Spent" }), h("dd", { text: inr(spent) })),
          h("div", {}, h("dt", { text: "Purse left" }), h("dd", { text: t ? inr(t.purseLeft) : "" })),
        )),
      h("div", { class: "result-body" }, list)));
  }

  const ul = $("unsold");
  ul.textContent = "";
  if (!unsold.length) ul.append(h("li", { class: "empty", text: "Nobody is unsold." }));
  unsold.forEach((p) => ul.append(playerRow(p, false)));
}

/* CSV with public fields only: no emails or phone numbers. */
$("csv").addEventListener("click", () => {
  if (!state) return;
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Team", "Employee ID", "Name", "Role", "Category", "Base price", "Sold for", "Status"]];
  for (const p of state.players) {
    rows.push([p.team ? state.cfg.teamNames[p.team] : "", p.id, p.name, p.role, p.category, p.basePrice, p.soldPrice || "", p.status]);
  }
  const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = h("a", { href: url, download: "relanto-auction-results.csv" });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
