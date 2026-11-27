/* Premium layer: light, cursor, spotlight, scramble, intro curtain, and the register button that teases.
   Visual only. It never touches data or rules, and every effect is skipped for reduced motion. */

import { motionOn } from "./motion.js";
import { flick } from "./cricket-fx.js";

const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const isAdmin = page === "admin.html";
const isScreen = page === "screen.html";

/* ---------- ambient floodlights (static on the shared live board) ---------- */
function beams() {
  if (isAdmin) return;
  const el = document.createElement("div");
  el.className = "beams" + (isScreen ? " beams-still" : "");
  el.setAttribute("aria-hidden", "true");
  document.body.prepend(el);
}

/* ---------- scroll progress: a ball rolls along a line as you read ---------- */
function progress() {
  if (isAdmin || isScreen) return;
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  bar.innerHTML = "<i></i><b></b>";
  document.body.append(bar);
  let queued = false;
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty("--p", max > 0 ? Math.min(1, scrollY / max).toFixed(4) : "0");
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", update);
  update();
}

/* ---------- spotlight: a pool of light follows the pointer inside cards ---------- */
function spotlight() {
  if (!fine) return;
  const sel = ".panel, .team, .co-card, .steps li, .rule-list li, .board, .notice";
  const add = (el) => {
    if (el.dataset.spot) return;
    el.dataset.spot = "1";
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    const s = document.createElement("span");
    s.className = "spot";
    s.setAttribute("aria-hidden", "true");
    el.prepend(s);
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sx", e.clientX - r.left + "px");
      el.style.setProperty("--sy", e.clientY - r.top + "px");
    });
  };
  $$(sel).forEach(add);
}

/* ---------- text scramble: letters shuffle into place ---------- */
const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&";
function scramble(el, duration = 750) {
  if (!motionOn || !el) return;
  const text = el.dataset.orig || el.textContent;
  el.dataset.orig = text;
  if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", text);
  cancelAnimationFrame(el._scr);
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      out += c === " " || i < p * text.length * 1.15 ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (p < 1) el._scr = requestAnimationFrame(step);
    else el.textContent = text;
  };
  el._scr = requestAnimationFrame(step);
}
function scrambles() {
  if (!motionOn) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); scramble(e.target); }
  }, { threshold: 0.6 });
  $$("[data-scramble]").forEach((el) => io.observe(el));
  if (fine) {
    $$(".nav a:not(.btn), .footer-links a").forEach((a) => {
      if (a.children.length) return;
      a.addEventListener("pointerenter", () => scramble(a, 420));
    });
  }
}

/* ---------- button press: a ball flicked off the button ---------- */
function clickBurst() {
  if (!motionOn || isAdmin) return;
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".btn-primary");
    if (!b || b.disabled || e.detail === 0) return;
    flick({ x: e.clientX, y: e.clientY });
  });
}

/* ---------- stage curtains: they part on arrival and close again when you move to another page ---------- */
function stage() {
  const sc = $(".stage-curtain");
  if (!sc) return;
  const root = document.documentElement;
  const clearAll = () => {
    root.classList.remove("preload", "curtain-in");
    sc.classList.remove("on", "is-open", "is-closing");
  };
  try { sessionStorage.removeItem("relanto-nav"); } catch { /* private mode */ }
  if (!motionOn) { sc.remove(); return; }

  const open = (quick) => {
    sc.classList.add("is-open");
    setTimeout(() => { if (window.__preloaderResolve) window.__preloaderResolve(); }, quick ? 80 : 450);
    setTimeout(() => {
      if (!quick) { try { sessionStorage.setItem("relanto-pre", "1"); } catch { /* ignore */ } }
      if (window.__preloaderResolve) window.__preloaderResolve();
      clearAll();
    }, quick ? 1200 : 2100);
  };

  if (root.classList.contains("preload")) {
    const num = $(".pre-count", sc);
    const t0 = performance.now();
    const total = 1300;
    (function tick(now) {
      const p = Math.min(1, (now - t0) / total);
      const e = 1 - Math.pow(1 - p, 3);
      num.textContent = String(Math.round(e * 100)).padStart(2, "0");
      sc.style.setProperty("--pp", e.toFixed(3));
      if (p < 1) requestAnimationFrame(tick); else setTimeout(() => open(false), 250);
    })(t0);
    sc.addEventListener("click", () => open(false), { once: true });
  } else if (root.classList.contains("curtain-in")) {
    requestAnimationFrame(() => requestAnimationFrame(() => open(true)));
  } else {
    sc.remove();
  }

  // leaving: draw the curtains shut, then go
  if (isAdmin || isScreen) return;
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    let url;
    try { url = new URL(a.href, location.href); } catch { return; }
    if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname) return;
    const el = document.querySelector(".stage-curtain") || sc;
    e.preventDefault();
    el.classList.add("on", "is-open");
    void el.offsetWidth;
    el.classList.add("is-closing");
    el.classList.remove("is-open");
    try { sessionStorage.setItem("relanto-nav", "1"); } catch { /* ignore */ }
    setTimeout(() => { location.href = url.href; }, 640);
    // if the page did not change, open the curtains again
    setTimeout(() => { if (document.visibilityState === "visible") { el.classList.add("is-open"); setTimeout(clearAll, 800); } }, 4000);
  });
  addEventListener("pageshow", (e) => { if (e.persisted) clearAll(); });
}

/* ---------- register: the button teases, then gives in ---------- */
function tease() {
  const btn = $("#submit");
  if (!btn || !fine || !motionOn || innerWidth < 760) return;
  const lines = ["Too slow.", "Nope.", "Catch me.", "Almost...", "Okay. You win."];
  const bubble = document.createElement("span");
  bubble.className = "tease";
  bubble.setAttribute("aria-hidden", "true");
  document.body.append(bubble);
  const label = btn.textContent;
  let n = 0, x = 0, y = 0, settled = false, busy = false, last = 0, px = -999, py = -999;
  const MAX = 4;
  btn.style.transition = "transform 0.46s cubic-bezier(0.34, 1.56, 0.64, 1)";

  const say = (text) => {
    const r = btn.getBoundingClientRect();
    bubble.textContent = text;
    bubble.style.left = r.left + r.width / 2 + "px";
    bubble.style.top = r.top - 14 + "px";
    bubble.classList.add("show");
    clearTimeout(bubble._t);
    bubble._t = setTimeout(() => bubble.classList.remove("show"), 1300);
  };
  const settle = () => {
    settled = true;
    x = 0; y = 0;
    btn.style.transform = "translate(0, 0) rotate(0deg)";
    btn.textContent = "Fine. Register";
    say(lines[MAX]);
    removeEventListener("pointermove", onMove);
  };
  const dodgeAway = () => {
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let vx = cx - px, vy = cy - py;
    const len = Math.hypot(vx, vy) || 1;
    vx /= len; vy /= len;
    const dist = rand(150, 240);
    let dx = vx * dist + rand(-60, 60);
    let dy = vy * dist * 0.7 + rand(-50, 50);
    // keep the button on screen and not too far from home
    const nl = r.left + dx, nr = r.right + dx, nt = r.top + dy, nb = r.bottom + dy;
    if (nl < 16) dx += 16 - nl;
    if (nr > innerWidth - 16) dx -= nr - (innerWidth - 16);
    if (nt < 90) dy += 90 - nt;
    if (nb > innerHeight - 16) dy -= nb - (innerHeight - 16);
    x = Math.max(-420, Math.min(420, x + dx));
    y = Math.max(-160, Math.min(160, y + dy));
    btn.style.transform = `translate(${x}px, ${y}px) rotate(${rand(-9, 9).toFixed(1)}deg)`;
    n += 1;
    const line = lines[Math.min(n - 1, 3)];
    setTimeout(() => say(line), 230);
    if (n >= MAX) setTimeout(settle, 1100);
  };
  function onMove(e) {
    px = e.clientX; py = e.clientY;
    if (settled || busy || btn.disabled || n >= MAX) return;
    const r = btn.getBoundingClientRect();
    const near = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    const reach = Math.max(r.width, r.height) / 2 + 55;
    if (near < reach && performance.now() - last > 500) {
      last = performance.now();
      busy = true;
      dodgeAway();
      setTimeout(() => { busy = false; }, 420);
    }
  }
  addEventListener("pointermove", onMove, { passive: true });
  // keyboard users and anyone who presses it directly are never blocked
  btn.addEventListener("focus", () => { if (btn.matches(":focus-visible") && !settled) { settled = true; x = y = 0; btn.style.transform = ""; btn.textContent = label; removeEventListener("pointermove", onMove); } });
  btn.addEventListener("pointerdown", () => { if (!settled) { settled = true; removeEventListener("pointermove", onMove); } });
  setTimeout(() => { if (!settled && n > 0) settle(); }, 25000);
}

/* ---------- register: a ball rolls along as the form fills ---------- */
function formProgress() {
  const form = $("#form");
  if (!form) return;
  const actions = $(".form-actions", form);
  const names = new Map();
  $$("[required]", form).forEach((el) => { names.set(el.type === "radio" ? "r:" + el.name : el, el); });
  const keys = [...names.keys()];
  if (!keys.length) return;
  const wrap = document.createElement("div");
  wrap.className = "form-progress";
  wrap.innerHTML = '<span class="fp-track"><i></i><b></b></span><span class="fp-text" aria-live="off"></span>';
  actions.before(wrap);
  const filled = (k) => {
    const el = names.get(k);
    if (el.type === "radio") return !!$(`[name="${el.name}"]:checked`, form);
    if (el.type === "checkbox") return el.checked;
    if (el.type === "file") return !!(el.files && el.files.length);
    return String(el.value || "").trim() !== "";
  };
  const update = () => {
    const n = keys.filter(filled).length;
    const p = n / keys.length;
    wrap.style.setProperty("--fp", p.toFixed(3));
    $(".fp-text", wrap).textContent = n === keys.length ? "Ready to go" : `${n} of ${keys.length} done`;
    form.classList.toggle("is-ready", n === keys.length);
  };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
}

beams();
progress();
spotlight();
scrambles();
clickBurst();
stage();
tease();
formProgress();
