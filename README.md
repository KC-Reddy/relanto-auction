# Relanto Auction

Cricket player auction for the office. Players register, two captains bid with fictional rupees, and players get picked into two teams.

## Run locally

Serve the folder over http (VS Code Live Server on `index.html`, or `python3 -m http.server`). Opening files by double click does not work because the site uses ES modules.

With no setup the site runs in demo mode: data stays in your browser and syncs between tabs. Open admin.html and use "Load 25 sample players", then open auction.html in two more tabs as the captains.

## Pages

- `index.html` landing, `register.html` player form
- `admin.html` organizer console, `auction.html` captain room
- `screen.html` projector board, `results.html` squads and CSV

## Folders

- `js/engine.js` all auction rules, shared by demo and Firebase
- `js/validators.js` field validation, `js/config.js` the one file to edit to go live
- `css/` styles, `tests/` run with `npm test`
- `apps-script/` email service, `firestore.rules` database rules

See `docs/SETUP.md` to go live.
