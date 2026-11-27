/* Shared header and footer for the app pages. */

const LINKS = [
  ["index.html", "Home"],
  ["register.html", "Register"],
  ["screen.html", "Live board"],
  ["results.html", "Results"],
];

const BALL = `<img class="brand-mark" src="assets/rcl-logo.webp" alt="" width="40" height="50">`;

export function renderChrome(active) {
  const header = document.getElementById("site-header");
  if (header) {
    header.className = "site-header";
    header.innerHTML = `
      <div class="wrap">
        <a class="brand" href="index.html">${BALL}Relanto Cricket League</a>
        <nav class="nav" aria-label="Main">
          ${LINKS.map(([href, label]) => `<a href="${href}"${href === active ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
        </nav>
      </div>`;
  }
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="wrap footer-row">
        <p class="footer-brand"><strong>Relanto</strong> Cricket League. An internal cricket event for the people of Relanto. All amounts shown are fictional.</p>
        <p class="footer-links"><a href="index.html">Home</a> <a href="auction.html">Captain room</a> <a href="admin.html">Organizer</a> <a href="https://www.relanto.ai" target="_blank" rel="noopener noreferrer">relanto.ai</a></p>
      </div>`;
  }
}

/* A tiny helper for building DOM safely: text goes in through textContent, never innerHTML. */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
