/* Field validation for the registration form.
   Pure functions with no DOM, so the browser and the tests use the same code.
   The Firestore rules repeat the important checks, because browser checks can be bypassed. */

export const ROLES = ["Batter", "Bowler", "All-rounder", "Wicketkeeper"];
export const BATTING = ["Right hand", "Left hand"];
export const BOWLING = ["Does not bowl", "Right-arm pace", "Left-arm pace", "Right-arm spin", "Left-arm spin"];

export const PHOTO_MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const PHOTO_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_DATA_CHARS = 150000;

/* Collapse whitespace and strip control characters. */
export function tidy(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---- Name ---- */
export function checkName(value) {
  const s = tidy(value);
  if (!s) return "Enter your full name.";
  if (s.length < 2) return "Your name needs at least 2 characters.";
  if (s.length > 60) return "Your name can be at most 60 characters.";
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(s)) return "Use letters, spaces, dots, apostrophes and hyphens only.";
  return "";
}

/* ---- Email ---- */
export function normEmail(value) {
  return tidy(value).toLowerCase();
}
export function checkEmail(value) {
  const s = normEmail(value);
  if (!s) return "Enter your email address.";
  if (s.length > 100) return "That email is too long.";
  if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(s) || s.includes("..")) {
    return "Enter a valid email such as name@example.com.";
  }
  const [local, domain] = s.split("@");
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".")) return "Enter a valid email such as name@example.com.";
  if (domain.split(".").some((p) => p.startsWith("-") || p.endsWith("-"))) return "Enter a valid email such as name@example.com.";
  return "";
}

/* ---- Phone: Indian mobile, 10 digits starting 6 to 9 ---- */
export function normPhone(value) {
  let d = String(value ?? "").replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}
export function checkPhone(value) {
  const d = normPhone(value);
  if (!d) return "Enter your mobile number.";
  if (!/^\d+$/.test(d)) return "Use digits only. You can start with +91.";
  if (!/^[6-9]\d{9}$/.test(d)) return "Enter a 10 digit mobile number starting with 6, 7, 8 or 9.";
  return "";
}

/* ---- Employee ID: exactly 4 digits ---- */
export function normEmpId(value) {
  return String(value ?? "").replace(/\s/g, "");
}
export function checkEmpId(value) {
  const s = normEmpId(value);
  if (!s) return "Enter your employee ID.";
  if (!/^\d+$/.test(s)) return "Employee ID has digits only.";
  if (s.length !== 4) return "Employee ID must be exactly 4 digits.";
  return "";
}

/* ---- Choices ---- */
function checkChoice(value, list, message) {
  return list.includes(value) ? "" : message;
}
export const checkRole = (v) => checkChoice(v, ROLES, "Choose your playing role.");
export const checkBatting = (v) => checkChoice(v, BATTING, "Choose your batting hand.");
export const checkBowling = (v) => checkChoice(v, BOWLING, "Choose your bowling style.");

export function checkSkill(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return "Rate your skill from 1 to 5.";
  return "";
}

export function checkBio(value) {
  const s = tidy(value);
  if (s.length > 140) return "Keep your note to 140 characters or fewer.";
  return "";
}

export function checkConsent(value) {
  return value === true ? "" : "Tick the box to confirm.";
}

/* ---- Photo ---- */
export function checkPhotoFile(file) {
  if (!file) return "Add a photo of yourself.";
  if (!PHOTO_ALLOWED_TYPES.includes(file.type)) return "Use a JPG, PNG or WebP image.";
  if (file.size > PHOTO_MAX_INPUT_BYTES) return "That image is over 5 MB. Choose a smaller one.";
  return "";
}
export function checkPhotoData(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl) return "Add a photo of yourself.";
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return "The photo could not be read. Try another image.";
  if (dataUrl.length > PHOTO_MAX_DATA_CHARS) return "The photo is too large after resizing. Try another image.";
  return "";
}

/* ---- Whole form ----
   raw: the values as typed. Returns { ok, errors, clean }.
   clean holds the normalised values that are safe to store. */
export function validateRegistration(raw) {
  const errors = {};
  const set = (field, msg) => { if (msg) errors[field] = msg; };

  set("name", checkName(raw.name));
  set("email", checkEmail(raw.email));
  set("phone", checkPhone(raw.phone));
  set("empId", checkEmpId(raw.empId));
  set("role", checkRole(raw.role));
  set("batting", checkBatting(raw.batting));
  set("bowling", checkBowling(raw.bowling));
  set("skill", checkSkill(raw.skill));
  set("bio", checkBio(raw.bio));
  set("photo", checkPhotoData(raw.photo));
  set("consent", checkConsent(raw.consent));

  const clean = {
    name: tidy(raw.name),
    email: normEmail(raw.email),
    phone: normPhone(raw.phone),
    empId: normEmpId(raw.empId),
    role: raw.role,
    batting: raw.batting,
    bowling: raw.bowling,
    skill: Number(raw.skill),
    bio: tidy(raw.bio),
    photo: raw.photo,
  };
  return { ok: Object.keys(errors).length === 0, errors, clean };
}
