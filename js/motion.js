/* Shared motion layer.
   GSAP, ScrollTrigger, SplitText, Flip and Lenis are loaded from js/vendor on demand.
   If they fail to load, or the visitor asks for reduced motion, every helper does nothing
   and the pages stay fully usable. */

export const motionOn = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

const BASE = new URL("./vendor/", import.meta.url).href;
function loadScript(file) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = BASE + file;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load " + file));
    document.head.append(s);
  });
}

let libsPromise = null;
export function loadMotion() {
  if (!motionOn) return Promise.resolve(null);
  if (!libsPromise) {
    libsPromise = (async () => {
      await loadScript("gsap.min.js");
      await Promise.all(["ScrollTrigger", "SplitText", "Flip", "lenis"].map((n) => loadScript(`${n}.min.js`)));
      const { gsap, ScrollTrigger, SplitText, Flip, Lenis } = window;
      gsap.registerPlugin(ScrollTrigger, SplitText, Flip);
      window.__motionReady = true;
      return { gsap, ScrollTrigger, SplitText, Flip, Lenis };
    })().catch((err) => {
      console.warn("Motion switched off:", err);
      document.documentElement.classList.remove("motion");
      return null;
    });
  }
  return libsPromise;
}

/* ---------- smooth scroll (landing and results only) ---------- */
export function smoothScroll({ gsap, ScrollTrigger, Lenis }) {
  if (!Lenis) return null;
  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.querySelector(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -64, duration: 1.2 });
  });
  return lenis;
}

/* ---------- header: tightens once you scroll ---------- */
export function headerMotion() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/* ---------- magnetic buttons: lean a few pixels toward the pointer ---------- */
export function magnetic(selector, strength = 0.28) {
  const g = window.gsap;
  if (!g || !canHover) return;
  document.querySelectorAll(selector).forEach((el) => {
    el.classList.add("is-magnetic");
    const x = g.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const y = g.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * strength);
      y((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener("pointerleave", () => { x(0); y(0); });
  });
}

/* ---------- headline reveal: characters rise out of a mask ---------- */
export function splitReveal(el, vars = {}) {
  const { gsap, SplitText } = window;
  if (!gsap || !SplitText || !el) return null;
  return SplitText.create(el, {
    type: "words,chars",
    mask: "chars",
    autoSplit: true,
    onSplit(self) {
      return gsap.from(self.chars, {
        yPercent: 115,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.03,
        ...vars,
      });
    },
  });
}

/* ---------- rolling number: counts up to a value, formatted for India ---------- */
export function countUp(el, to, { duration = 1.4, prefix = "", delay = 0, trigger } = {}) {
  const { gsap } = window;
  const fmt = (n) => prefix + Math.round(n).toLocaleString("en-IN");
  if (!gsap) { el.textContent = fmt(to); return; }
  const o = { v: 0 };
  el.textContent = fmt(0);
  gsap.to(o, {
    v: to, duration, delay, ease: "power3.out",
    onUpdate: () => { el.textContent = fmt(o.v); },
    scrollTrigger: trigger ? { trigger, start: "top 85%", once: true } : undefined,
  });
}

/* ---------- small feedback animations (Web Animations API, no library needed) ---------- */
const run = (el, frames, opts) => {
  if (!motionOn || !el || !el.animate) return null;
  return el.animate(frames, { easing: EASE_OUT, ...opts });
};
export const fx = {
  /* quick scale bump, for a number that just changed */
  pulse(el, scale = 1.06) {
    return run(el, [{ transform: "scale(1)" }, { transform: `scale(${scale})`, offset: 0.35 }, { transform: "scale(1)" }], { duration: 320 });
  },
  /* sideways shake, for a refused action */
  shake(el) {
    return run(el, [
      { transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(6px)" },
      { transform: "translateX(-4px)" }, { transform: "translateX(2px)" }, { transform: "translateX(0)" },
    ], { duration: 380, easing: "ease-out" });
  },
  /* appears from slightly small, never from nothing */
  pop(el, delay = 0) {
    return run(el, [{ opacity: 0, transform: "scale(0.9)" }, { opacity: 1, transform: "scale(1)" }], { duration: 320, delay, fill: "backwards" });
  },
  slideUp(el, delay = 0, distance = 14) {
    return run(el, [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: "translateY(0)" }], { duration: 420, delay, fill: "backwards" });
  },
  /* slides in from a side and settles, for the leading team banner */
  slideIn(el, from = "left") {
    const x = from === "left" ? -28 : 28;
    return run(el, [{ opacity: 0, transform: `translateX(${x}px)` }, { opacity: 1, transform: "translateX(0)" }], { duration: 380 });
  },
  /* a colour wash across an element, for a new bid */
  flash(el, color = "rgba(240,176,58,0.35)") {
    return run(el, [{ boxShadow: `inset 0 0 0 999px ${color}` }, { boxShadow: "inset 0 0 0 999px rgba(0,0,0,0)" }], { duration: 700, easing: "ease-out" });
  },
  /* heavy stamp landing: big and rotated, snaps into place */
  slam(el) {
    return run(el, [
      { opacity: 0, transform: "scale(2.2) rotate(-12deg)" },
      { opacity: 1, transform: "scale(0.94) rotate(-4deg)", offset: 0.6 },
      { opacity: 1, transform: "scale(1) rotate(-4deg)" },
    ], { duration: 480 });
  },
  /* the whole stage thumps once */
  thump(el) {
    return run(el, [
      { transform: "translate(0,0)" }, { transform: "translate(-6px,4px)" }, { transform: "translate(5px,-5px)" },
      { transform: "translate(-3px,3px)" }, { transform: "translate(0,0)" },
    ], { duration: 360, easing: "linear" });
  },
};

/* ---------- confetti: coloured paper from a point ---------- */
const COLORS = ["#c1272d", "#f0b03a", "#e8ece4", "#f0b03a", "#ff6b6b"];
export function confetti({ x = window.innerWidth / 2, y = window.innerHeight / 3, count = 90, spread = 1, power = 1 } = {}) {
  if (!motionOn) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const bits = Array.from({ length: count }, () => {
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * spread;
    const speed = (6 + Math.random() * 9) * power;
    return {
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 7, h: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 0,
    };
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(32, now - last) / 16.67;
    last = now;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = 0;
    for (const b of bits) {
      b.life += dt;
      b.vy += 0.32 * dt;
      b.vx *= 0.992;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      const fade = Math.max(0, 1 - b.life / 110);
      if (fade > 0 && b.y < window.innerHeight + 20) alive += 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (alive > 0) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
