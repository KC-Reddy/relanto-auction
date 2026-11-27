/* Premium layer: light, cursor, spotlight, scramble, intro curtain, and the register button that teases.
   Visual only. It never touches data or rules, and every effect is skipped for reduced motion. */

import { motionOn, confetti } from "./motion.js";

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

/* ---------- button press: a small burst of paper ---------- */
function clickBurst() {
  if (!motionOn || isAdmin) return;
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".btn-primary");
    if (!b || b.disabled || e.detail === 0) return;
    confetti({ x: e.clientX, y: e.clientY, count: 16, spread: 2, power: 0.5 });
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

/* ---------- register: a tiny groundsman hauls the button around, then gives it back ---------- */
function tease() {
  const btn = $("#submit");
  if (!btn || !fine || !motionOn || innerWidth < 760) return;
  const NS = "http://www.w3.org/2000/svg";
  const label = btn.textContent;
  const lines = ["Heave ho!", "Mine now.", "Don't look!", "Okay. You win."];
  const MAX = lines.length;
  const T = "transform 0.46s cubic-bezier(0.34, 1.56, 0.64, 1)";
  const ABORT = Symbol("abort");

  const bubble = document.createElement("span");
  bubble.className = "tease";
  bubble.setAttribute("aria-hidden", "true");

  const mini = document.createElement("div");
  mini.className = "mini";
  mini.setAttribute("aria-hidden", "true");
  mini.innerHTML =
    '<svg viewBox="0 0 40 64"><g class="mini-lean"><g class="mini-body">' +
    '<g class="leg leg-a"><path class="limb pants" d="M18 40 L17 58"/><path class="shoe" d="M13 59.5 h8"/></g>' +
    '<g class="leg leg-b"><path class="limb pants" d="M22 40 L23 58"/><path class="shoe" d="M19 59.5 h8"/></g>' +
    '<path class="jersey" d="M12 24 q8-5 16 0 l-1.5 18 h-13z"/>' +
    '<g class="arm arm-a"><path class="limb sleeve" d="M14 26 L9 39"/></g>' +
    '<g class="arm arm-b"><path class="limb sleeve" d="M26 26 L31 39"/></g>' +
    '<circle class="skin" cx="20" cy="15" r="7.2"/>' +
    '<circle class="eye" cx="23" cy="14.4" r="1"/>' +
    '<path class="cap" d="M12.6 13.5 q7.4-10 14.8 0z"/><path class="brim" d="M20 13.2 h11"/>' +
    "</g></g></svg>";

  const ropeLayer = document.createElementNS(NS, "svg");
  ropeLayer.setAttribute("class", "rope-layer");
  ropeLayer.setAttribute("aria-hidden", "true");
  const rope = document.createElementNS(NS, "path");
  rope.setAttribute("class", "rope");
  ropeLayer.append(rope);
  document.body.append(ropeLayer, mini, bubble);

  let n = 0, x = 0, y = 0, lx = 0, ly = 0;
  let settled = false, busy = false, aborted = false, last = 0, px = -999, py = -999;
  btn.style.transition = T;

  const rect = () => btn.getBoundingClientRect();
  const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
  const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const syncBubble = () => {
    if (!bubble.classList.contains("show")) return;
    const r = rect();
    bubble.style.left = r.left + r.width / 2 + "px";
    bubble.style.top = r.top - 14 + "px";
  };
  const say = (text, ms = 1500) => {
    bubble.textContent = text;
    bubble.classList.add("show");
    syncBubble();
    clearTimeout(bubble._t);
    bubble._t = setTimeout(() => bubble.classList.remove("show"), ms);
  };
  const run = (ms, fn) => new Promise((res, rej) => {
    const t0 = performance.now();
    const step = (now) => {
      if (aborted) return rej(ABORT);
      const t = Math.min(1, (now - t0) / ms);
      fn(t);
      syncBubble();
      if (t < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  const wait = (ms) => new Promise((res, rej) => setTimeout(() => (aborted ? rej(ABORT) : res()), ms));

  const put = (ox, oy, rot = 0, squash = 0) => {
    lx = ox; ly = oy;
    btn.style.transform = `translate(${ox}px, ${oy}px) rotate(${rot}deg) scale(${1 + squash * 0.5}, ${1 - squash})`;
  };
  const stand = (sx, sy, f) => { mini.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%) scaleX(${f})`; };
  const ropeTo = (bx, by, w, h, sx, sy, slack) => {
    const hx = sx, hy = sy - 28;
    const vx = hx - bx, vy = hy - by;
    const t = Math.min(1, Math.min((w / 2) / (Math.abs(vx) || 1e-6), (h / 2) / (Math.abs(vy) || 1e-6)));
    const ex = bx + vx * t, ey = by + vy * t;
    rope.setAttribute("d", `M${ex.toFixed(1)} ${ey.toFixed(1)} Q${((ex + hx) / 2).toFixed(1)} ${((ey + hy) / 2 + slack).toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}`);
  };
  const fadeOut = (t) => { mini.style.opacity = t > 0.55 ? String(Math.max(0, 1 - (t - 0.55) / 0.45)) : "1"; };

  const dest = (m) => {
    const r = rect();
    return (dx, dy) => [
      clamp(dx, Math.max(-420, x + (m.l - r.left)), Math.min(420, x + (innerWidth - m.r - r.right))),
      clamp(dy, Math.max(-160, y + (m.t - r.top)), Math.min(160, y + (innerHeight - m.b - r.bottom))),
    ];
  };

  // gag 1 and 3: a rope round the button, a little fellow walks off with it
  const pull = async () => {
    const r = rect(), w = r.width, h = r.height, cx = r.left + w / 2, cy = r.top + h / 2;
    const side = cx < innerWidth / 2 ? 1 : -1;
    const m = { l: 16, r: 16, t: 100, b: 60 };
    if (side > 0) m.r = 200; else m.l = 200;
    const [dx, dy] = dest(m)(x + side * rand(220, 320), y + rand(-70, 70));
    const vx = dx - x, vy = dy - y, L = Math.hypot(vx, vy) || 1, ux = vx / L, uy = vy / L, f = ux >= 0 ? 1 : -1;
    const ROPE = 130;
    const feet = (bx, by) => [bx + ux * ROPE, by + uy * ROPE + 26];
    const [hx, hy] = feet(cx, cy);
    mini.style.opacity = "1";
    mini.className = "mini on is-run";
    ropeLayer.classList.add("on");
    await run(430, (t) => {
      const k = easeOut(t), sx = hx + ux * 360 * (1 - k), sy = hy + uy * 360 * (1 - k);
      stand(sx, sy, -f);
      ropeTo(cx, cy, w, h, sx, sy, 46 * (1 - k) + 10);
    });
    mini.classList.add("is-pull");
    stand(hx, hy, f);
    say(lines[n]);
    await wait(150);
    await run(780, (t) => {
      const k = easeIO(t), bx = cx + vx * k, by = cy + vy * k;
      put(x + vx * k, y + vy * k, Math.sin(t * 17) * 3.4 * (1 - t));
      const [sx, sy] = feet(bx, by);
      stand(sx, sy, f);
      ropeTo(bx, by, w, h, sx, sy, 0);
    });
    x = dx; y = dy; put(x, y, 0, 0);
    ropeLayer.classList.remove("on");
    mini.classList.remove("is-pull");
    const [ex, ey] = feet(cx + vx, cy + vy);
    await run(560, (t) => { stand(ex + ux * 560 * t * t, ey + uy * 560 * t * t, f); fadeOut(t); });
    mini.className = "mini";
  };

  // gag 2 and 4: he runs in underneath, lifts it overhead and sprints off with it
  const carry = async (finale) => {
    const r = rect(), w = r.width, h = r.height, cx = r.left + w / 2, cy = r.top + h / 2;
    let dx = 0, dy = 0;
    if (!finale) {
      const clampTo = dest({ l: 16, r: 16, t: 90, b: 92 });
      let vx = cx - px, vy = cy - py;
      const len = Math.hypot(vx, vy) || 1;
      vx /= len; vy /= len;
      [dx, dy] = clampTo(x + vx * rand(220, 330), y + vy * 60 + rand(-50, 50));
      if (Math.hypot(dx - x, dy - y) < 110) [dx, dy] = clampTo(x + (cx < innerWidth / 2 ? 1 : -1) * rand(240, 320), y + rand(-60, 60));
    }
    const vx = dx - x, vy = dy - y;
    const f = Math.abs(vx) < 20 ? (cx < innerWidth / 2 ? 1 : -1) : (vx >= 0 ? 1 : -1);
    const LIFT = 14, FEET = h / 2 + 50;
    mini.style.opacity = "1";
    mini.className = "mini on is-run";
    const sx0 = cx - f * 400;
    await run(520, (t) => stand(sx0 + (cx - sx0) * easeOut(t), cy + FEET, f));
    mini.classList.remove("is-run");
    mini.classList.add("is-lift");
    say(lines[n]);
    await run(260, (t) => { const k = easeOut(t); put(x, y - LIFT * k, 0, 0.14 * Math.sin(Math.PI * k)); stand(cx, cy + FEET, f); });
    mini.classList.add("is-run");
    await run(1000, (t) => {
      const k = easeIO(t);
      put(x + vx * k, y + vy * k - LIFT, Math.sin(t * 24) * 4.2);
      stand(cx + vx * k, cy + vy * k + FEET, f);
    });
    mini.classList.remove("is-run");
    await run(260, (t) => { const k = easeOut(t); put(dx, dy - LIFT * (1 - k), 0, 0.16 * Math.sin(Math.PI * k)); stand(cx + vx, cy + vy + FEET, f); });
    x = dx; y = dy; put(x, y, 0, 0);
    mini.classList.remove("is-lift");
    if (finale) {
      mini.classList.add("is-wave");
      await wait(900);
      mini.classList.remove("is-wave");
    }
    mini.classList.add("is-run");
    await run(560, (t) => { stand(cx + vx + f * 560 * t * t, cy + vy + FEET, f); fadeOut(t); });
    mini.className = "mini";
  };

  const settle = () => {
    settled = true;
    removeEventListener("pointermove", onMove);
    x = y = 0;
    btn.style.transition = T;
    btn.style.transform = "translate(0, 0) rotate(0deg)";
    btn.textContent = "Fine. Register";
    setTimeout(() => { mini.remove(); ropeLayer.remove(); }, 400);
    setTimeout(() => bubble.remove(), 1800);
  };
  const stop = () => {
    aborted = true;
    mini.className = "mini";
    ropeLayer.classList.remove("on");
    bubble.classList.remove("show");
  };
  const gag = async () => {
    busy = true; aborted = false;
    btn.style.transition = "none";
    try {
      if (n === 0 || n === 2) await pull();
      else await carry(n === MAX - 1);
      n += 1;
    } catch (e) {
      if (e !== ABORT) throw e;
      return;
    } finally {
      if (!aborted) {
        btn.style.transition = T;
        setTimeout(() => { busy = false; }, 450);
      }
    }
    if (n >= MAX) setTimeout(settle, 250);
  };

  function onMove(e) {
    px = e.clientX; py = e.clientY;
    if (settled || busy || btn.disabled || n >= MAX) return;
    const r = rect();
    const near = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    const reach = Math.max(r.width, r.height) / 2 + 55;
    if (near < reach && performance.now() - last > 500) {
      last = performance.now();
      gag();
    }
  }
  addEventListener("pointermove", onMove, { passive: true });

  // anyone who presses it, and every keyboard user, is never blocked
  const giveUp = (home) => {
    if (settled) return;
    settled = true;
    removeEventListener("pointermove", onMove);
    if (busy) stop();
    mini.remove(); ropeLayer.remove();
    setTimeout(() => bubble.remove(), 400);
    btn.style.transition = T;
    if (home) { x = y = 0; btn.style.transform = ""; btn.textContent = label; return; }
    put(lx, ly, 0, 0);
    setTimeout(() => { btn.style.transform = "translate(0, 0) rotate(0deg)"; }, 900);
  };
  btn.addEventListener("focus", () => { if (btn.matches(":focus-visible")) giveUp(true); });
  btn.addEventListener("pointerdown", () => giveUp(false));
  setTimeout(() => { if (!settled && n > 0 && !busy) settle(); }, 40000);
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
