import { renderChrome } from "./layout.js";
import { connect } from "./db.js";
import { sendMail } from "./mail.js";
import {
  validateRegistration, checkPhotoFile, tidy,
} from "./validators.js";

renderChrome("register.html");

const $ = (id) => document.getElementById(id);
const form = $("form");
const status = $("status");
const openedAt = Date.now();

const FIELDS = ["name", "email", "phone", "empId", "role", "batting", "bowling", "skill", "bio", "photo", "consent"];
const touched = new Set();
let photoData = "";
let photoFileError = "";
let submitting = false;

/* ---------- read and show ---------- */
function values() {
  const skill = form.querySelector('input[name="skill"]:checked');
  return {
    name: $("f-name").value,
    email: $("f-email").value,
    phone: $("f-phone").value,
    empId: $("f-empId").value,
    role: $("f-role").value,
    batting: $("f-batting").value,
    bowling: $("f-bowling").value,
    skill: skill ? skill.value : "",
    bio: $("f-bio").value,
    photo: photoData,
    consent: $("f-consent").checked,
  };
}

const controlFor = (field) => (field === "skill" ? $("f-skill") : $(`f-${field}`));

function showErrors(errors) {
  for (const field of FIELDS) {
    const msg = touched.has(field) ? (field === "photo" && photoFileError ? photoFileError : errors[field] || "") : "";
    $(`err-${field}`).textContent = msg;
    const ctl = controlFor(field);
    if (ctl && field !== "skill") ctl.setAttribute("aria-invalid", msg ? "true" : "false");
  }
}

function refresh() {
  const { errors } = validateRegistration(values());
  showErrors(errors);
  return errors;
}

/* ---------- live behaviour ---------- */
for (const field of FIELDS) {
  if (field === "photo" || field === "skill") continue;
  const el = controlFor(field);
  el.addEventListener("blur", () => { touched.add(field); refresh(); });
  el.addEventListener("input", () => { if (touched.has(field)) refresh(); });
  el.addEventListener("change", () => { touched.add(field); refresh(); });
}
form.querySelectorAll('input[name="skill"]').forEach((r) =>
  r.addEventListener("change", () => { touched.add("skill"); refresh(); }));

/* employee id: digits only as you type */
$("f-empId").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });

$("f-bio").addEventListener("input", () => {
  const n = tidy($("f-bio").value).length;
  const c = $("bio-count");
  c.textContent = `${n} / 140`;
  c.classList.toggle("over", n > 140);
});

/* ---------- photo: crop to a square and shrink to a small JPEG ---------- */
async function loadBitmap(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}

async function shrink(file) {
  const bmp = await loadBitmap(file);
  const w = bmp.width || bmp.naturalWidth;
  const h = bmp.height || bmp.naturalHeight;
  const side = Math.min(w, h);
  for (const [size, quality] of [[320, 0.82], [320, 0.7], [256, 0.65], [200, 0.6]]) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bmp, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
    const data = canvas.toDataURL("image/jpeg", quality);
    if (data.length <= 120000) return data;
  }
  throw new Error("too large");
}

$("f-photo").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  touched.add("photo");
  photoData = "";
  photoFileError = checkPhotoFile(file);
  $("photo-preview").style.backgroundImage = "";
  $("photo-preview").classList.remove("has-photo");
  if (!photoFileError) {
    try {
      photoData = await shrink(file);
      $("photo-preview").style.backgroundImage = `url(${photoData})`;
      $("photo-preview").classList.add("has-photo");
    } catch {
      photoFileError = "The photo could not be read. Try another image.";
    }
  }
  refresh();
});

/* ---------- submit ---------- */
function say(text, kind = "") {
  status.textContent = text;
  status.className = "form-status " + kind;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitting) return;

  FIELDS.forEach((f) => touched.add(f));
  const result = validateRegistration(values());
  showErrors(result.errors);
  if (!result.ok) {
    const first = FIELDS.find((f) => result.errors[f]);
    const count = Object.keys(result.errors).length;
    say(count === 1 ? "One field needs fixing." : `${count} fields need fixing.`, "bad");
    const ctl = controlFor(first);
    (first === "skill" ? form.querySelector('input[name="skill"]') : ctl).focus();
    return;
  }

  /* bots: a filled trap field, or a form sent within 3 seconds of loading */
  if ($("f-website").value) { finish(result.clean, true); return; }
  if (Date.now() - openedAt < 3000) { say("Please check your details and press Register again.", "bad"); return; }

  submitting = true;
  $("submit").disabled = true;
  say("Registering...");
  try {
    const { engine, demo } = await connect();
    await engine.submitRegistration(result.clean);
    const mail = await sendMail({ type: "registration", to: result.clean.email, name: result.clean.name, empId: result.clean.empId });
    finish(result.clean, false, demo, mail);
  } catch (err) {
    submitting = false;
    $("submit").disabled = false;
    if (err.code === "duplicate") {
      touched.add("empId");
      $("err-empId").textContent = "This employee ID is already registered. If it is yours, wait for the approval email.";
      $("f-empId").setAttribute("aria-invalid", "true");
      $("f-empId").focus();
      say("This employee ID is already registered.", "bad");
    } else if (err.code === "closed") {
      showClosed();
    } else {
      say("Something went wrong and your entry was not saved. Check your connection and try again.", "bad");
      console.error(err);
    }
  }
});

function finish(clean, silent, demo = false, mail = null) {
  form.hidden = true;
  const noMail = !mail || mail.demo;
  $("done-text").textContent = silent
    ? "Thanks."
    : noMail
      ? `Thanks ${clean.name.split(" ")[0]}. Your employee ID ${clean.empId} is on the list.`
      : `Thanks ${clean.name.split(" ")[0]}. Your employee ID ${clean.empId} is on the list and a confirmation is on its way to ${clean.email}.`;
  if (!silent && mail && !mail.ok) {
    $("done-demo").hidden = false;
    $("done-demo").textContent = "Your entry is saved, but the confirmation email could not be sent. The organizers can resend it.";
  } else if (demo) {
    $("done-demo").hidden = false;
    $("done-demo").textContent = "Demo mode: the email was added to the demo outbox in the organizer page.";
  } else if (mail && mail.demo) {
    $("done-demo").hidden = false;
    $("done-demo").textContent = "Email is not switched on yet, so no confirmation was sent. The organizers will contact you when you are approved.";
  }
  $("done").hidden = false;
  $("done").querySelector("h2").setAttribute("tabindex", "-1");
  $("done").querySelector("h2").focus();
}

function showClosed() {
  form.hidden = true;
  $("closed").hidden = false;
}

/* ---------- on load ---------- */
(async () => {
  try {
    const { engine, demo } = await connect();
    if (demo) $("demo-banner").hidden = false;
    const cfg = await engine.getConfig();
    if (!cfg.registrationOpen) showClosed();
  } catch (err) {
    console.error(err);
    say("Could not connect to the auction. Reload the page to try again.", "bad");
  }
})();

import("./page-motion.js").then((m) => m.enhance()).catch(() => {});
