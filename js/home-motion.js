/* Landing page motion.
   The one big idea is the over: scrolling the "four steps" section rolls a ball down the
   pitch, one delivery per step. Everything else supports it. */

import { loadMotion, smoothScroll, headerMotion, magnetic, splitReveal, countUp } from "./motion.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const libs = await loadMotion();
if (libs) {
  try {
    await document.fonts.ready;
    start(libs);
  } catch (err) {
    console.warn("Landing motion failed, showing the static page:", err);
    document.documentElement.classList.remove("motion");
  }
}

function start(libs) {
  const { gsap, ScrollTrigger } = libs;
  ScrollTrigger.config({ ignoreMobileResize: true });
  smoothScroll(libs);
  headerMotion();
  hero(gsap);
  ticker();
  over(gsap);
  teams(gsap);
  rules(gsap);
  band(gsap);
  magnetic(".hero .btn, .register-band .btn, .site-header .btn");
  ScrollTrigger.refresh();
}

/* ---------- hero: headline rises, board drops in, light follows the pointer ---------- */
function hero(gsap) {
  const root = $(".hero");
  const board = $(".board");

  // a big seamed ball sits behind everything and turns as you scroll away
  const ball = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ball.setAttribute("viewBox", "0 0 32 32");
  ball.setAttribute("class", "hero-ball");
  ball.setAttribute("aria-hidden", "true");
  ball.innerHTML = '<circle cx="16" cy="16" r="14" fill="#c1272d"/><path d="M5 9c7 4 7 10 0 14M27 9c-7 4-7 10 0 14" fill="none" stroke="#e8ece4" stroke-width="0.7" stroke-dasharray="1.1 1.3" stroke-linecap="round"/>';
  root.append(ball);
  gsap.to(ball, {
    rotation: 200, yPercent: -18, ease: "none",
    scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: true },
  });

  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  splitReveal($(".hero h1"), { delay: 0.1 });
  tl.fromTo(".hero .lede", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8 }, 0.45)
    .fromTo(".hero-actions", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8 }, 0.6)
    .fromTo("#when", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7 }, 0.72)
    .fromTo(board, { opacity: 0, y: 40, rotationX: 14, transformPerspective: 900, transformOrigin: "50% 100%" },
      { opacity: 1, y: 0, rotationX: 0, duration: 1.1 }, 0.3)
    .from(".board-row", { opacity: 0, x: 24, duration: 0.6, stagger: 0.12 }, 0.7);

  // light and tilt follow the pointer (mouse only)
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const rx = gsap.quickTo(board, "rotationX", { duration: 0.7, ease: "power3.out" });
    const ry = gsap.quickTo(board, "rotationY", { duration: 0.7, ease: "power3.out" });
    gsap.set(board, { transformPerspective: 900 });
    root.addEventListener("pointermove", (e) => {
      const r = root.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      gsap.to(root, { "--mx": x + "px", "--my": y + "px", duration: 0.7, ease: "power3.out", overwrite: "auto" });
      ry((x / r.width - 0.5) * 7);
      rx(-(y / r.height - 0.5) * 5);
    });
    root.addEventListener("pointerleave", () => { rx(0); ry(0); });
  }
}

/* ---------- ticker: duplicate the strip so the loop never shows a gap ---------- */
function ticker() {
  const track = $("#ticker-track");
  if (!track) return;
  const copy = [...track.children].map((n) => {
    const c = n.cloneNode(true);
    c.setAttribute("aria-hidden", "true");
    return c;
  });
  track.append(...copy);
}

/* ---------- the over: four deliveries, four steps ---------- */
function over(gsap) {
  const section = $("#how");
  const track = $(".steps", section);
  const viewport = $(".over-viewport", section);
  const lane = $(".over-lane", section);
  const ball = $(".over-ball", section);
  const trail = $(".over-trail", section);
  const cards = $$(".steps li", section);
  const stops = $$(".over-stop", section);
  if (!section || !track || !lane || !ball) return;

  section.classList.add("over-live");
  stops.forEach((el, i) => { el.style.left = `calc(1.375rem + (100% - 2.75rem) * ${i} / 3)`; });

  const dist = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
  const laneRun = () => lane.clientWidth - ball.clientWidth;
  let lastOn = -1;
  const setOn = (i) => {
    if (i === lastOn) return;
    lastOn = i;
    cards.forEach((c, n) => c.classList.toggle("is-on", n === i));
    stops.forEach((s, n) => s.classList.toggle("is-on", n <= i));
  };
  setOn(0);

  const state = { p: 0 };
  gsap.to(state, {
    p: 1,
    ease: "none",
    onUpdate() {
      const p = state.p;
      gsap.set(track, { x: -dist() * p });
      gsap.set(ball, { x: laneRun() * p, y: -Math.abs(Math.sin(p * Math.PI * 3)) * 22, rotation: p * 1260 });
      gsap.set(trail, { scaleX: p });
      setOn(Math.min(cards.length - 1, Math.floor(p * cards.length)));
    },
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: () => "+=" + (dist() + window.innerHeight * 0.7),
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
}

/* ---------- teams: each half wipes in from its own side ---------- */
function teams(gsap) {
  const one = $(".team-one");
  const two = $(".team-two");
  if (!one || !two) return;
  const st = { trigger: ".teams", start: "top 75%", once: true };
  gsap.from(one, { clipPath: "inset(0 100% 0 0)", duration: 1.1, ease: "expo.out", scrollTrigger: st });
  gsap.from(two, { clipPath: "inset(0 0 0 100%)", duration: 1.1, ease: "expo.out", scrollTrigger: st });
  $$(".team h2").forEach((h) => splitReveal(h, { scrollTrigger: { trigger: ".teams", start: "top 70%", once: true }, delay: 0.25 }));
  $$(".team dl > div").forEach((row, i) => {
    gsap.from(row, { opacity: 0, y: 18, duration: 0.7, delay: 0.5 + i * 0.08, ease: "expo.out", scrollTrigger: st });
  });
  $$("[data-count]").forEach((el) => countUp(el, Number(el.dataset.count), { prefix: "₹", trigger: ".teams", delay: 0.6 }));
}

/* ---------- rules: tables and notes arrive in sequence ---------- */
function rules(gsap) {
  const st = (trigger) => ({ trigger, start: "top 82%", once: true });
  gsap.from("#rules .section-head", { opacity: 0, y: 24, duration: 0.8, ease: "expo.out", scrollTrigger: st("#rules") });
  $$("#rules .rate-table").forEach((t) => {
    gsap.from($$("caption, tbody tr", t), {
      opacity: 0, x: -22, duration: 0.7, stagger: 0.09, ease: "expo.out", scrollTrigger: st(t),
    });
  });
  $$("#rules .rule-list li").forEach((li, i) => {
    gsap.from(li, { opacity: 0, x: 24, duration: 0.7, delay: i * 0.08, ease: "expo.out", scrollTrigger: st(".rule-list") });
    gsap.fromTo(li, { "--bar": 0 }, { "--bar": 1, duration: 0.9, delay: i * 0.08, ease: "expo.out", scrollTrigger: st(".rule-list") });
  });
}

/* ---------- final call to action ---------- */
function band(gsap) {
  const band = $(".register-band");
  if (!band) return;
  splitReveal($("h2", band), { scrollTrigger: { trigger: band, start: "top 85%", once: true } });
  gsap.from($$("p, .btn", band), {
    opacity: 0, y: 18, duration: 0.8, stagger: 0.1, delay: 0.3, ease: "expo.out",
    scrollTrigger: { trigger: band, start: "top 85%", once: true },
  });
}
