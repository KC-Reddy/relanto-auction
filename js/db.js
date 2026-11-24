/* One entry point for every page: connect() returns { store, engine, session helpers }. */

import { FIREBASE_CONFIG, ADMIN_EMAILS } from "./config.js";
import { createEngine } from "./engine.js";
import { DEMO_USERS } from "./store-demo.js";

let cached = null;

export function connect() {
  if (cached) return cached;
  cached = (async () => {
    let store;
    let adminEmails;
    if (FIREBASE_CONFIG) {
      const { createFirebaseStore } = await import("./store-firebase.js");
      store = await createFirebaseStore(FIREBASE_CONFIG);
      adminEmails = ADMIN_EMAILS;
    } else {
      const { createDemoStore } = await import("./store-demo.js");
      store = await createDemoStore();
      adminEmails = [DEMO_USERS.admin];
    }
    const engine = createEngine(store, { adminEmails });
    return { store, engine, adminEmails, demo: store.mode === "demo" };
  })();
  return cached;
}

/* Who is this user in the auction? */
export function roleOf(user, cfg, adminEmails) {
  const email = user && user.email ? user.email.toLowerCase() : "";
  if (!email) return { signedIn: false, isAdmin: false, team: null };
  const isAdmin = adminEmails.map((e) => e.toLowerCase()).includes(email);
  const team = ["team1", "team2"].find((k) => (cfg.captains[k] || "").toLowerCase() === email) || null;
  return { signedIn: true, isAdmin, team, email };
}
