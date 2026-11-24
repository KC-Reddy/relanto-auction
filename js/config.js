/* The only file you edit to go live.
   Leave FIREBASE_CONFIG as null to run in demo mode (data stays in your browser). */

/* Paste the web app config from Firebase console > Project settings > Your apps.
   These values are not secrets. The Firestore rules protect the data. Example shape:
   {
     apiKey: "...", authDomain: "your-project.firebaseapp.com", projectId: "your-project",
     storageBucket: "...", messagingSenderId: "...", appId: "..."
   }
*/
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAFoQwthNVRyv8w3qvyd13kKPrSV206OA8",
  authDomain: "relanto-auction.firebaseapp.com",
  projectId: "relanto-auction",
  storageBucket: "relanto-auction.firebasestorage.app",
  messagingSenderId: "731619272181",
  appId: "1:731619272181:web:001624cedf0f9a2d6e2cbc",
};

/* Gmail address(es) of the organizer(s). Must match firestore.rules.
   This list only decides which buttons the page shows; the rules decide who may write. */
export const ADMIN_EMAILS = [];

/* The Apps Script web app URL that sends the emails (see docs/SETUP.md). Empty = demo outbox only. */
export const MAIL_ENDPOINT = "";

/* Public address of the site, used for links inside emails. */
export const SITE_URL = "https://kc-reddy.github.io/relanto-auction";
