/* Motion for the form and data pages (register, results, organizer).
   Every effect here is optional: if the libraries do not load, the pages work unchanged. */

import { loadMotion, headerMotion, smoothScroll, fx, confetti, magnetic, motionOn } from "./motion.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export async function enhance({ lenis = false } = {}) {
  const libs = await loadMotion();
  if (!libs) return;
  try {
    const { gsap } = libs;
    headerMotion();
    if (lenis) smoothScroll(libs);
    if ($("#form")) registerForm(gsap);
    if ($("#teams")) resultsPage();
    magnetic(".form-actions .btn-primary", 0.2);
  } catch (err) {
    console.warn("Page motion failed:", err);
    document.documentElement.classList.remove("motion");
  }
}

/* ---------- register ---------- */
function registerForm(gsap) {
  const rise = (els, delay = 0, stagger = 0.06) =>
    gsap.fromTo(els, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, delay, stagger, ease: "expo.out", clearProps: "transform" });

  rise([$(".page-narrow > h1"), $(".page-narrow > .lede")], 0.05, 0.1);
  rise($$(".form .fieldset > legend, .form .field, .form .form-actions"), 0.3, 0.05);

  const form = $("#form");

  /* an error appears: slide it in and shake the field it belongs to */
  const seen = new WeakMap();
  const watch = new MutationObserver((records) => {
    for (const r of records) {
      const err = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (!err || !err.classList.contains("field-error")) continue;
      const text = err.textContent;
      if (text && seen.get(err) !== text) {
        fx.slideUp(err, 0, 8);
        const field = err.closest(".field");
        const ctl = field && (field.querySelector(".input, .select, .textarea, .skill, .check"));
        if (ctl && document.activeElement !== ctl) fx.shake(ctl);
      }
      seen.set(err, text);
    }
  });
  $$(".field-error").forEach((el) => watch.observe(el, { childList: true, characterData: true, subtree: true }));

  /* a refused submit shakes the button and every field that needs fixing */
  form.addEventListener("submit", () => {
    requestAnimationFrame(() => {
      const bad = $$('[aria-invalid="true"]', form);
      if (bad.length) { fx.shake($("#submit")); bad.forEach((el) => fx.shake(el)); }
    });
  });

  /* skill tiles light up from 1 up to the chosen number */
  const labels = $$(".skill label");
  $$('.skill input[name="skill"]').forEach((r, i) =>
    r.addEventListener("change", () => labels.forEach((l, n) => l.classList.toggle("is-lit", n < i))));

  /* the photo preview pops in when a photo is chosen */
  const preview = $("#photo-preview");
  new MutationObserver(() => { if (preview.classList.contains("has-photo")) fx.pop(preview); })
    .observe(preview, { attributes: true, attributeFilter: ["class"] });

  /* success: confetti from the heading */
  const done = $("#done");
  new MutationObserver(() => {
    if (done.hidden) return;
    const h2 = $("h2", done).getBoundingClientRect();
    confetti({ x: h2.left + 90, y: h2.top + 10, count: 120, spread: 1.4, power: 1.1 });
  }).observe(done, { attributes: true, attributeFilter: ["hidden"] });
}

/* ---------- results: rows file in the first time they appear ---------- */
function resultsPage() {
  const grid = $("#teams");
  let played = false;
  const go = () => {
    if (played || !grid.children.length) return;
    played = true;
    $$(".results-grid > section").forEach((sec, i) => {
      fx.slideUp(sec, i * 140, 22);
      $$(".squad li", sec).forEach((li, n) => fx.slideUp(li, 260 + i * 140 + n * 45, 12));
    });
    $$("#unsold li").forEach((li, n) => fx.slideUp(li, 500 + n * 40, 10));
  };
  new MutationObserver(go).observe(grid, { childList: true });
  go();
}
