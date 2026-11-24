# Going live

The site works as a demo with no setup (data stays in each browser). To run the real auction you need a Firebase project for shared data and, if you want emails, an Apps Script. Both are free.

## 1. Firebase (shared data and sign-in)

1. Go to console.firebase.google.com and create a project. Skip Analytics.
2. Build > Firestore Database > Create database. Pick a region near you (asia-south1 Mumbai). Start in production mode.
3. Build > Authentication > Get started > Google > enable. Set a support email.
4. Authentication > Settings > Authorized domains > add `kc-reddy.github.io` (your GitHub Pages domain).
5. Project settings > Your apps > Web app (</>) > register. Copy the `firebaseConfig` object.
6. Open `js/config.js`:
   - set `FIREBASE_CONFIG` to that object
   - set `ADMIN_EMAILS` to the organizer Google account(s)
7. Open `firestore.rules`, replace `REPLACE-ME@gmail.com` with the same account(s), and paste the file into Firestore > Rules > Publish.
8. Open admin.html, sign in with Google, then Setup: enter both captains' Gmail addresses and save.

Photos are stored inside the player records (about 320px JPEG), so no paid Storage plan is needed.

## 2. Emails (Apps Script)

1. Go to script.google.com > New project. Name it Relanto Auction Mail.
2. Paste `apps-script/Code.gs` into Code.gs. Add a file named Templates and paste `apps-script/Templates.gs`.
3. Project settings > Script properties > add `ADMIN_KEY` with a long random value.
4. Run `testSendToMe` once and approve the permissions. You get one test email.
5. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Copy the web app URL.
6. In `js/config.js` set `MAIL_ENDPOINT` to that URL and `SITE_URL` to `https://kc-reddy.github.io/relanto-auction`.
7. In the admin page, Emails panel, type the same ADMIN_KEY. It stays in that tab only.

Mail comes from the Gmail account that owns the script, shown as "Relanto Auction". A free Gmail account can send about 100 mails a day, enough for 25 players. To use a company mailbox later, deploy the script from that account.

Preview the emails without sending: `npm run preview-emails`, then open `email-preview/`.

## 3. Publish on GitHub Pages

The repo has to be public on a free plan. Nothing secret is in it: Firebase web config is meant to be public, and the rules protect the data.

```
git init
git add .
git commit -m "Relanto Auction"
git branch -M main
git remote add origin https://github.com/KC-Reddy/relanto-auction.git
git push -u origin main
```

Create the empty repo `relanto-auction` on GitHub first. Then Settings > Pages > Deploy from branch > main > / (root).

## Before the event

- Run `npm test` (needs Node 18+).
- Do a dry run: register two test players, approve, run a lot with both captains, then reset from the admin page.
- Open screen.html on the projector and press the full-screen button.
