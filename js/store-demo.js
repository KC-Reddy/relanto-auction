/* Demo store: the whole database lives in this browser (IndexedDB) and syncs between tabs,
   so you can run a full auction with no Firebase account. Open several tabs to play several people.

   Every change runs inside a cross-tab lock (Web Locks) and reads and writes IndexedDB, which is
   consistent between tabs. (localStorage is not: other tabs can read stale values for a moment.)

   Same small interface as store-firebase.js:
   get(path), list(collection), create(path, data), run(async tx => ...),
   watchDoc(path, cb), watchCollection(name, cb), serverTime(), skewMs(), auth, mode
*/

const USER_KEY = "relanto-demo-user";
const DB_NAME = "relanto-demo";
const STORE = "kv";
const KEY = "docs";

export const DEMO_USERS = {
  admin: "admin@demo.local",
  team1: "captain1@demo.local",
  team2: "captain2@demo.local",
};

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/* ---------- storage backends ---------- */
function memoryBackend() {
  let data = {};
  let chain = Promise.resolve();
  return {
    async load() { return clone(data); },
    async save(docs) { data = clone(docs); },
    async clear() { data = {}; },
    lock(fn) {
      const job = chain.then(fn);
      chain = job.catch(() => {});
      return job;
    },
  };
}

function idbBackend() {
  let dbPromise = null;
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const db = () => dbPromise || (dbPromise = open());
  const tx = async (mode, work) => {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      let out;
      work(t.objectStore(STORE), (v) => { out = v; });
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  };
  const hasLocks = typeof navigator !== "undefined" && navigator.locks;
  let chain = Promise.resolve();
  return {
    load: () => tx("readonly", (s, set) => { s.get(KEY).onsuccess = (e) => set(e.target.result || {}); }),
    save: (docs) => tx("readwrite", (s) => { s.put(docs, KEY); }),
    clear: () => tx("readwrite", (s) => { s.delete(KEY); }),
    lock(fn) {
      if (hasLocks) return navigator.locks.request("relanto-demo-lock", fn);
      const job = chain.then(fn);
      chain = job.catch(() => {});
      return job;
    },
  };
}

function seedDocs(docs) {
  const cfg = {
    purse: 3000000, minSquad: 11, maxSquad: 13, lotSeconds: 30, registrationOpen: true,
    teamNames: { team1: "Team 1", team2: "Team 2" },
    captains: { team1: DEMO_USERS.team1, team2: DEMO_USERS.team2 },
    auctionDate: "",
  };
  docs["config/auction"] = cfg;
  for (const k of ["team1", "team2"]) docs[`teams/${k}`] = { name: cfg.teamNames[k], purseLeft: cfg.purse, squad: [] };
  docs["auction/live"] = { status: "idle", playerId: "", baseBid: 0, currentBid: 0, currentTeam: "", bidCount: 0, lastBidAt: Date.now(), pausedLeftMs: 0 };
}

export async function createDemoStore({ backend, sessionStorageLike } = {}) {
  const inBrowser = typeof window !== "undefined";
  const store_ = backend ?? (inBrowser && typeof indexedDB !== "undefined" ? idbBackend() : memoryBackend());
  const ss = sessionStorageLike ?? (inBrowser ? window.sessionStorage : null);
  const mem = { user: null };
  const channel = inBrowser && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("relanto-demo") : null;
  const announce = () => { if (channel) channel.postMessage("changed"); };

  let docs = await store_.load();

  /* ---- watchers ---- */
  const docWatchers = new Map();
  const collWatchers = new Map();
  const listFrom = (name) =>
    Object.keys(docs).filter((p) => p.startsWith(name + "/")).map((p) => ({ id: p.slice(name.length + 1), ...clone(docs[p]) }));
  const notify = () => {
    for (const [path, set] of docWatchers) set.forEach((cb) => cb(clone(docs[path] ?? null)));
    for (const [name, set] of collWatchers) set.forEach((cb) => cb(listFrom(name)));
  };
  if (channel) {
    channel.onmessage = async () => { docs = await store_.load(); notify(); };
  }

  /* ---- first run: seed defaults ---- */
  if (!docs["config/auction"]) {
    await store_.lock(async () => {
      const current = await store_.load();
      if (!current["config/auction"]) { seedDocs(current); await store_.save(current); }
      docs = current;
    });
    announce();
  }

  const store = {
    mode: "demo",
    serverTime: () => Date.now(),
    skewMs: () => 0,

    async get(path) { return clone(docs[path] ?? null); },
    async list(name) { return listFrom(name); },

    async create(path, data) {
      await store_.lock(async () => {
        const current = await store_.load();
        if (current[path]) { const e = new Error("exists"); e.code = "exists"; throw e; }
        current[path] = clone(data);
        await store_.save(current);
        docs = current;
      });
      notify(); announce();
    },

    run(fn) {
      return store_.lock(async () => {
        const base = await store_.load();
        const draft = clone(base);
        const tx = {
          get: async (p) => clone(draft[p] ?? null),
          set: (p, d) => { draft[p] = clone(d); },
          update: (p, d) => {
            if (!draft[p]) { const e = new Error("missing " + p); e.code = "not-found"; throw e; }
            draft[p] = { ...draft[p], ...clone(d) };
          },
          serverTime: () => Date.now(),
        };
        const result = await fn(tx);
        await store_.save(draft);
        docs = draft;
        notify(); announce();
        return result;
      });
    },

    watchDoc(path, cb) {
      if (!docWatchers.has(path)) docWatchers.set(path, new Set());
      docWatchers.get(path).add(cb);
      cb(clone(docs[path] ?? null));
      return () => docWatchers.get(path).delete(cb);
    },
    watchCollection(name, cb) {
      if (!collWatchers.has(name)) collWatchers.set(name, new Set());
      collWatchers.get(name).add(cb);
      cb(listFrom(name));
      return () => collWatchers.get(name).delete(cb);
    },

    /* Wipe everything and start over (demo only). */
    async wipe() {
      await store_.lock(async () => {
        await store_.clear();
        const fresh = {};
        seedDocs(fresh);
        await store_.save(fresh);
        docs = fresh;
      });
      notify(); announce();
    },
  };

  /* ---- demo sign-in: pick a role, no passwords. The choice lives in this tab only. ---- */
  const listeners = new Set();
  const readUser = () => {
    try {
      const raw = ss ? ss.getItem(USER_KEY) : mem.user;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  store.auth = {
    get user() { return readUser(); },
    onChange(cb) { listeners.add(cb); cb(readUser()); return () => listeners.delete(cb); },
    async signIn(hint) {
      const email = DEMO_USERS[hint];
      if (!email) throw new Error("Unknown demo role");
      const raw = JSON.stringify({ email });
      if (ss) ss.setItem(USER_KEY, raw); else mem.user = raw;
      listeners.forEach((cb) => cb({ email }));
    },
    async signOut() {
      if (ss) ss.removeItem(USER_KEY); else mem.user = null;
      listeners.forEach((cb) => cb(null));
    },
  };
  return store;
}
