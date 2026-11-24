import { h } from "./layout.js";
import { connect } from "./db.js";
import { watchAll } from "./live-state.js";
import { createLotView, renderTeams } from "./lot-view.js";
import { inr } from "./format.js";

const $ = (id) => document.getElementById(id);
const { store, engine } = await connect();

const lotView = createLotView($("lot"), { big: true });
lotView.setClock(() => engine.now());
let state = null;

watchAll(store, {
  onState: (s) => { state = s; lotView.render(s); renderTeams($("teams"), s); renderSales(); },
  onResult: (r) => lotView.flash(r, state.cfg),
});
setInterval(() => lotView.tick(), 200);

function renderSales() {
  const box = $("sales");
  const sold = state.players.filter((p) => p.status === "sold").sort((a, b) => b.soldAt - a.soldAt).slice(0, 8);
  const key = JSON.stringify(sold.map((p) => [p.id, p.team, p.soldPrice]));
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.textContent = "";
  if (!sold.length) { box.append(h("span", { class: "sale", dataset: { team: "" }, text: "No sales yet" })); return; }
  for (const p of sold) {
    box.append(h("span", { class: "sale", dataset: { team: p.team }, text: `${p.name}  ${inr(p.soldPrice)}` }));
  }
}

$("fs").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
});
