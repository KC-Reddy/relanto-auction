/* Email sending. Real emails go through the Apps Script web app (apps-script/Code.gs).
   In demo mode nothing leaves the browser: messages land in an outbox you can read in the admin page. */

import { MAIL_ENDPOINT, SITE_URL } from "./config.js";

const OUTBOX_KEY = "relanto-demo-outbox";
const ADMIN_KEY_STORE = "relanto-admin-key";

export const mailIsLive = () => Boolean(MAIL_ENDPOINT);

/* The admin key lives only in this tab's session storage. It is never saved in the repo. */
export function getAdminKey() {
  try { return sessionStorage.getItem(ADMIN_KEY_STORE) || ""; } catch { return ""; }
}
export function setAdminKey(key) {
  try { sessionStorage.setItem(ADMIN_KEY_STORE, key); } catch { /* private mode */ }
}

export function readOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]"); } catch { return []; }
}
export function clearOutbox() {
  try { localStorage.removeItem(OUTBOX_KEY); } catch { /* ignore */ }
}

/* payload: { type, to, name, ... } where type is registration | approved | sold | unsold */
export async function sendMail(payload) {
  const body = { ...payload, siteUrl: SITE_URL };

  if (!MAIL_ENDPOINT) {
    const box = readOutbox();
    box.unshift({ at: new Date().toISOString(), ...body });
    try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(box.slice(0, 60))); } catch { /* ignore */ }
    return { ok: true, demo: true };
  }

  const isPublic = payload.type === "registration";
  if (!isPublic) body.adminKey = getAdminKey();

  try {
    const res = await fetch(MAIL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // keeps it a simple request, no CORS preflight
      body: JSON.stringify(body),
    });
    const out = await res.json();
    return out && out.ok ? { ok: true } : { ok: false, error: (out && out.error) || "The mail service refused the request." };
  } catch (err) {
    return { ok: false, error: "Could not reach the mail service." };
  }
}
