/* Relanto Auction: landing page behaviour.
   Plain script, no build step, so the site runs on GitHub Pages as is. */

const CONFIG = {
  // Set to an ISO string such as "2026-12-12T17:00:00+05:30" once the date is fixed.
  auctionDate: null,
};

/* ---------- Scoreboard tiles ----------
   The HTML ships the final text so the page works without JavaScript.
   Here we split it into tiles and spin each digit once on load. */
function buildTiles(el) {
  const text = el.dataset.tiles;
  el.setAttribute("aria-label", text);
  el.textContent = "";
  const digits = [];
  let word = null; // a run of letters such as "to" becomes one quiet label

  for (const ch of text) {
    if (/[a-z]/i.test(ch)) {
      if (!word) {
        word = document.createElement("span");
        word.className = "tile-word";
        word.setAttribute("aria-hidden", "true");
        el.appendChild(word);
      }
      word.textContent += ch;
      continue;
    }
    word = null;
    if (ch === " ") continue;

    const span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    if (/\d/.test(ch)) {
      span.className = "tile";
      span.textContent = ch;
      digits.push({ span, final: ch });
    } else {
      span.className = "tile-sep";
      span.textContent = ch;
    }
    el.appendChild(span);
  }
  return digits;
}

function spin(digits, startDelay) {
  digits.forEach(({ span, final }, i) => {
    let ticks = 0;
    const total = 8 + i * 2;
    setTimeout(() => {
      const id = setInterval(() => {
        ticks += 1;
        if (ticks >= total) {
          span.textContent = final;
          clearInterval(id);
        } else {
          span.textContent = String(Math.floor(Math.random() * 10));
        }
      }, 55);
    }, startDelay + i * 60);
  });
}

function initBoard() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-tiles]").forEach((el, rowIndex) => {
    const digits = buildTiles(el);
    if (!reduce) spin(digits, 250 + rowIndex * 220);
  });
}

/* ---------- Auction date line ---------- */
function initWhen() {
  const el = document.getElementById("when");
  if (!el || !CONFIG.auctionDate) return;
  const date = new Date(CONFIG.auctionDate);
  if (Number.isNaN(date.getTime())) return;

  const fmt = new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const render = () => {
    const ms = date - Date.now();
    if (ms <= 0) { el.textContent = "The auction is live."; return; }
    const days = Math.floor(ms / 864e5);
    const hours = Math.floor((ms % 864e5) / 36e5);
    el.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = days > 0 ? `${days} days ${hours} hours to go` : `${hours} hours to go`;
    el.append(strong, ` until ${fmt.format(date)} IST.`);
  };
  render();
  setInterval(render, 60000);
}

initBoard();
initWhen();

/* ---------- Motion (scroll animation, headline reveals) ---------- */
import("./home-motion.js").catch((err) => console.warn("Motion not started:", err));
