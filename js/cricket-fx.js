/* Cricket moments that replace the paper confetti: a ball flicked off a button, a six over the roof, a bowled stumps.
   Plain DOM and Web Animations, no libraries. Every function does nothing for reduced motion. */

import { motionOn } from "./motion.js";

const NS = "http://www.w3.org/2000/svg";
const rand = (a, b) => a + Math.random() * (b - a);

const BALL = (px) =>
  `<svg viewBox="0 0 32 32" width="${px}" height="${px}" style="display:block;max-width:none;max-height:none"><circle cx="16" cy="16" r="14" fill="#c1272d"/><circle cx="11.5" cy="10.5" r="6" fill="#e5575d" opacity="0.45"/><path d="M5 9c7 4 7 10 0 14M27 9c-7 4-7 10 0 14" fill="none" stroke="#f1efe6" stroke-width="1.7" stroke-dasharray="2 2.4" stroke-linecap="round"/></svg>`;

function layer() {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "position:fixed;inset:0;z-index:210;pointer-events:none;overflow:hidden";
  document.body.append(el);
  return el;
}
function ballEl(parent, px) {
  const b = document.createElement("span");
  b.innerHTML = BALL(px);
  b.style.cssText = `position:absolute;left:0;top:0;width:${px}px;height:${px}px;margin:${-px / 2}px 0 0 ${-px / 2}px;will-change:transform,opacity;filter:drop-shadow(0 4px 4px rgba(0,0,0,.4))`;
  parent.append(b);
  return b;
}
/* positions along a parabola as WAAPI keyframes */
function arc(x0, y0, vx, vy, g, ms, spin, steps = 14) {
  const frames = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, s = (t * ms) / 1000;
    frames.push({
      transform: `translate(${x0 + vx * s}px, ${y0 + vy * s + 0.5 * g * s * s}px) rotate(${spin * t}deg)`,
      opacity: t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1,
      offset: t,
    });
  }
  return frames;
}

/* a ball flicked away from a pressed button */
export function flick({ x, y }) {
  if (!motionOn) return;
  const L = layer();
  const b = ballEl(L, 16);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const ms = 620;
  const a = b.animate(arc(x, y, dir * rand(150, 260), -rand(300, 420), 1500, ms, dir * rand(540, 900)), { duration: ms, easing: "linear", fill: "forwards" });
  a.onfinish = () => L.remove();
}

/* the registration is in: a ball is hit high over the roof, SIX slams in, cameras flash */
export function six() {
  if (!motionOn) return;
  const L = layer();
  const W = innerWidth, H = innerHeight;
  const ms = 950;
  const x0 = W * 0.16, y0 = H * 0.78;
  const vx = (W * 1.0) / (ms / 1000), vy = -(H * 1.5) / (ms / 1000), g = H * 1.7;
  for (let i = 0; i < 7; i++) {
    const t = ballEl(L, i === 0 ? 30 : 30 - i * 3);
    t.style.opacity = i === 0 ? "1" : String(0.5 - i * 0.06);
    const frames = arc(x0, y0, vx, vy, g, ms, 900);
    if (i) frames.forEach((f) => { f.opacity = Math.min(f.opacity, 0.5 - i * 0.06); });
    t.animate(frames, { duration: ms, delay: i * 38, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" });
  }
  const word = document.createElement("div");
  word.textContent = "SIX!";
  word.style.cssText = "position:absolute;left:50%;top:44%;font:800 clamp(90px,19vw,230px)/0.9 'Bebas Neue','Anton',Impact,sans-serif;letter-spacing:.04em;color:#ffb703;text-shadow:0 6px 0 #8f1a20,0 18px 50px rgba(0,0,0,.55);will-change:transform,opacity";
  L.append(word);
  word.animate(
    [
      { transform: "translate(-50%,-50%) scale(2.6) rotate(-9deg)", opacity: 0, offset: 0 },
      { transform: "translate(-50%,-50%) scale(0.92) rotate(-4deg)", opacity: 1, offset: 0.18 },
      { transform: "translate(-50%,-50%) scale(1) rotate(-4deg)", opacity: 1, offset: 0.26 },
      { transform: "translate(-50%,-50%) scale(1.04) rotate(-4deg)", opacity: 1, offset: 0.8 },
      { transform: "translate(-50%,-60%) scale(1.1) rotate(-4deg)", opacity: 0, offset: 1 },
    ],
    { duration: 1500, delay: 380, easing: "ease-out", fill: "both" },
  );
  for (let i = 0; i < 16; i++) {
    const f = document.createElement("i");
    const s = rand(5, 11);
    f.style.cssText = `position:absolute;left:${rand(4, 96)}%;top:${rand(3, 46)}%;width:${s}px;height:${s}px;border-radius:50%;background:#fff;box-shadow:0 0 ${s * 3}px ${s}px rgba(255,244,200,.85);opacity:0`;
    L.append(f);
    f.animate([{ opacity: 0, transform: "scale(.3)" }, { opacity: 1, transform: "scale(1.4)", offset: 0.35 }, { opacity: 0, transform: "scale(.5)" }], { duration: 260, delay: rand(300, 1250), easing: "ease-out", fill: "both" });
  }
  setTimeout(() => L.remove(), 2000);
}

/* a lot is sold: a ball cracks into the stumps and the bails fly */
export function bowled() {
  if (!motionOn) return;
  const L = layer();
  const W = innerWidth, H = innerHeight;
  const cx = W / 2, base = H * 0.72, sh = 130, gap = 26;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "-80 -150 160 160");
  svg.setAttribute("width", "260");
  svg.setAttribute("height", "260");
  svg.style.cssText = `position:absolute;left:${cx - 130}px;top:${base - 240}px;max-width:none;overflow:visible`;
  const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  const stumps = [-gap, 0, gap].map((dx) => {
    const g = mk("g", {});
    g.append(mk("rect", { x: dx - 4, y: -sh, width: 8, height: sh, rx: 3, fill: "#e9c88f" }), mk("rect", { x: dx - 4, y: -sh, width: 3, height: sh, rx: 1.5, fill: "#fbe6b8" }));
    svg.append(g);
    return g;
  });
  const bails = [-gap / 2, gap / 2].map((dx) => {
    const g = mk("g", {});
    g.append(mk("rect", { x: dx - 13, y: -sh - 6, width: 26, height: 5, rx: 2.5, fill: "#f4d9a2" }));
    svg.append(g);
    return g;
  });
  L.append(svg);
  svg.animate([{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }], { duration: 160, fill: "both", easing: "ease-out" });
  const ball = ballEl(L, 26);
  const hitX = cx - gap - 12, hitY = base - sh * 0.55;
  const run = ball.animate(
    [
      { transform: `translate(${-40}px, ${hitY + 40}px) rotate(0deg)` },
      { transform: `translate(${hitX}px, ${hitY}px) rotate(900deg)` },
    ],
    { duration: 380, delay: 120, easing: "cubic-bezier(.5,0,.9,.6)", fill: "both" },
  );
  run.onfinish = () => {
    ball.animate(arc(hitX, hitY, 360, -220, 1700, 700, 700), { duration: 700, easing: "linear", fill: "forwards" });
    const ring = document.createElement("i");
    ring.style.cssText = `position:absolute;left:${hitX}px;top:${hitY}px;width:20px;height:20px;margin:-10px;border-radius:50%;border:4px solid #ffb703`;
    L.append(ring);
    ring.animate([{ transform: "scale(.4)", opacity: 1 }, { transform: "scale(7)", opacity: 0 }], { duration: 480, easing: "ease-out", fill: "both" });
    stumps.forEach((g, i) => {
      const dir = i - 1 || (Math.random() < 0.5 ? -1 : 1);
      g.style.transformBox = "fill-box";
      g.style.transformOrigin = "50% 100%";
      g.animate([{ transform: "none" }, { transform: `translate(${dir * rand(40, 90)}px, ${rand(-10, 6)}px) rotate(${dir * rand(28, 62)}deg)` }], { duration: 520, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" });
    });
    bails.forEach((g, i) => {
      const dir = i ? 1 : -1;
      g.animate(
        [{ transform: "none" }, { transform: `translate(${dir * 70}px, -110px) rotate(${dir * 420}deg)`, offset: 0.45 }, { transform: `translate(${dir * 130}px, 40px) rotate(${dir * 760}deg)` }],
        { duration: 780, easing: "ease-out", fill: "forwards" },
      );
    });
    const word = document.createElement("div");
    word.textContent = "HOWZAT!";
    word.style.cssText = "position:absolute;left:50%;top:26%;font:800 clamp(70px,13vw,170px)/0.9 'Bebas Neue','Anton',Impact,sans-serif;letter-spacing:.05em;color:#fff7e0;text-shadow:0 6px 0 #8f1a20,0 16px 44px rgba(0,0,0,.55)";
    L.append(word);
    word.animate(
      [
        { transform: "translate(-50%,-50%) scale(2.2) rotate(7deg)", opacity: 0, offset: 0 },
        { transform: "translate(-50%,-50%) scale(1) rotate(3deg)", opacity: 1, offset: 0.2 },
        { transform: "translate(-50%,-50%) scale(1.04) rotate(3deg)", opacity: 1, offset: 0.78 },
        { transform: "translate(-50%,-58%) scale(1.08) rotate(3deg)", opacity: 0, offset: 1 },
      ],
      { duration: 1200, easing: "ease-out", fill: "both" },
    );
    setTimeout(() => L.remove(), 1500);
  };
}
