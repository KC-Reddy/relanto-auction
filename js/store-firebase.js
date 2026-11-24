/* Firebase store: same interface as store-demo.js, backed by Firestore and Google sign-in.
   Loaded only when FIREBASE_CONFIG is filled in js/config.js. */

const VERSION = "10.14.1";
const CDN = `https://www.gstatic.com/firebasejs/${VERSION}/`;

/* Firestore Timestamps become plain milliseconds so the rest of the code never sees them. */
function plain(x) {
  if (x && typeof x.toMillis === "function") return x.toMillis();
  if (Array.isArray(x)) return x.map(plain);
  if (x && typeof x === "object") {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, plain(v)]));
  }
  return x;
}

export async function createFirebaseStore(config) {
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(CDN + "firebase-app.js"),
    import(CDN + "firebase-firestore.js"),
    import(CDN + "firebase-auth.js"),
  ]);

  const app = initializeApp(config);
  const db = fs.getFirestore(app);
  const authSdk = au.getAuth(app);
  const ref = (path) => fs.doc(db, ...path.split("/"));
  const snapData = (snap) => (snap.exists() ? plain(snap.data({ serverTimestamps: "estimate" })) : null);

  /* The browser clock can differ from the server clock. We learn the difference
     from the server timestamp on the live auction document and use it for the countdown.
     The rules on the server are the real referee; this only keeps the display honest. */
  let skew = 0;
  let lastSeenBidAt = null;
  const learnSkew = (snap, data) => {
    if (!data || snap.metadata.hasPendingWrites || data.lastBidAt === lastSeenBidAt) return;
    lastSeenBidAt = data.lastBidAt;
    const sample = data.lastBidAt - Date.now();
    if (Math.abs(sample) < 6 * 60 * 60 * 1000) skew = sample;
  };

  const store = {
    mode: "firebase",
    serverTime: () => fs.serverTimestamp(),
    skewMs: () => skew,

    async get(path) {
      return snapData(await fs.getDoc(ref(path)));
    },

    async list(name) {
      const snap = await fs.getDocs(fs.collection(db, name));
      return snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));
    },

    /* Fails if the document already exists (the rules allow create only). */
    async create(path, data) {
      try {
        await fs.setDoc(ref(path), data);
      } catch (err) {
        if (err.code === "permission-denied") { const e = new Error("denied"); e.code = "permission-denied"; throw e; }
        throw err;
      }
    },

    run(fn) {
      return fs.runTransaction(db, async (t) => {
        const tx = {
          get: async (p) => snapData(await t.get(ref(p))),
          set: (p, d) => t.set(ref(p), d),
          update: (p, d) => t.update(ref(p), d),
          serverTime: () => fs.serverTimestamp(),
        };
        return fn(tx);
      });
    },

    watchDoc(path, cb) {
      return fs.onSnapshot(ref(path), { includeMetadataChanges: true }, (snap) => {
        const data = snapData(snap);
        if (path === "auction/live") learnSkew(snap, data);
        cb(data);
      }, (err) => console.error("watch failed", path, err));
    },

    watchCollection(name, cb) {
      return fs.onSnapshot(fs.collection(db, name), (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...plain(d.data({ serverTimestamps: "estimate" })) })));
      }, (err) => console.error("watch failed", name, err));
    },
  };

  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const shape = (u) => (u ? { email: u.email, name: u.displayName } : null);
  store.auth = {
    get user() { return shape(authSdk.currentUser); },
    onChange(cb) { return au.onAuthStateChanged(authSdk, (u) => cb(shape(u))); },
    async signIn() { await au.signInWithPopup(authSdk, provider); },
    async signOut() { await au.signOut(authSdk); },
  };
  return store;
}
