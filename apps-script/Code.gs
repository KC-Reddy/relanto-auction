/* Relanto Auction mail service. Deploy as a web app (Execute as: Me, Access: Anyone).
   Script Properties to set: ADMIN_KEY (a long random string you also type into the admin page).
   Public type: registration. Admin types (need ADMIN_KEY): approved, sold, unsold. */

var SENDER_NAME = "Relanto Auction";
var ADMIN_TYPES = { approved: 1, sold: 1, unsold: 1 };
var EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/;

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() { return json_({ ok: true, service: "relanto-auction-mail" }); }

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "Bad request." }); }
  if (!d || typeof d !== "object") return json_({ ok: false, error: "Bad request." });

  var type = String(d.type || "");
  var isAdmin = !!ADMIN_TYPES[type];
  if (type !== "registration" && !isAdmin) return json_({ ok: false, error: "Unknown type." });

  var props = PropertiesService.getScriptProperties();
  if (isAdmin) {
    var key = props.getProperty("ADMIN_KEY");
    if (!key || String(d.adminKey || "") !== key) return json_({ ok: false, error: "Wrong admin key." });
  }

  var to = String(d.to || "").trim();
  if (!EMAIL_RE.test(to) || to.length > 120) return json_({ ok: false, error: "Bad email address." });
  d.name = String(d.name || "").slice(0, 60);
  if (!d.name) return json_({ ok: false, error: "Name missing." });
  ["team", "price", "auctionDate", "empId", "siteUrl"].forEach(function (k) { if (d[k] != null) d[k] = String(d[k]).slice(0, 120); });
  if (type === "sold" && (!d.team || !d.price)) return json_({ ok: false, error: "Team and price are required." });
  if (type === "registration" && !/^\d{4}$/.test(d.empId || "")) return json_({ ok: false, error: "Bad employee ID." });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (type === "registration") {
      var guard = checkRegistrationLimits_(props, d.empId);
      if (guard) return json_({ ok: false, error: guard });
    }
    var mail = buildEmail_(d);
    if (MailApp.getRemainingDailyQuota() < 1) return json_({ ok: false, error: "Daily mail quota used up." });
    MailApp.sendEmail({ to: to, subject: mail.subject, body: mail.text, htmlBody: mail.html, name: SENDER_NAME });
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/* One registration mail per employee ID, and at most 60 per hour overall. */
function checkRegistrationLimits_(props, empId) {
  var sentKey = "sent_" + empId;
  if (props.getProperty(sentKey)) return "A confirmation was already sent for this ID.";
  var now = Date.now();
  var hour = Math.floor(now / 3600000);
  var counterKey = "count_" + hour;
  var count = Number(props.getProperty(counterKey) || 0);
  if (count >= 60) return "Too many requests. Try again later.";
  props.setProperty(counterKey, String(count + 1));
  props.setProperty(sentKey, String(now));
  return "";
}

/* Run once from the editor to approve the permissions. Sends one test email to you. */
function testSendToMe() {
  var me = Session.getActiveUser().getEmail();
  var m = buildEmail_({ type: "sold", name: "Test Player", team: "Team 1", price: "₹5,50,000" });
  MailApp.sendEmail({ to: me, subject: m.subject, body: m.text, htmlBody: m.html, name: SENDER_NAME });
}
