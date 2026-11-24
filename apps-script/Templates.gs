/* Email templates. Pure functions: (data) -> {subject, text, html}. No Apps Script APIs in here,
   so tools/preview-emails.mjs can load this file in Node and render the emails to HTML. */

var BRAND = { name: "Relanto Auction", ink: "#0a1613", grass: "#14382e", ball: "#e5383b", bulb: "#ffb703", chalk: "#f3efe2" };

function esc_(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function shell_(title, lead, rows, footer) {
  var rowHtml = (rows || []).map(function (r) {
    return '<tr><td style="padding:6px 16px 6px 0;color:#9bb5ab;font-size:13px">' + esc_(r[0]) +
      '</td><td style="padding:6px 0;color:' + BRAND.chalk + ';font-size:15px;font-weight:600">' + esc_(r[1]) + "</td></tr>";
  }).join("");
  return '<!doctype html><html><body style="margin:0;background:' + BRAND.ink + ';padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:' + BRAND.grass + ';border-radius:12px;overflow:hidden">' +
    '<tr><td style="height:6px;background:' + BRAND.ball + '"></td></tr>' +
    '<tr><td style="padding:28px 28px 8px;color:' + BRAND.bulb + ';font-size:13px;font-weight:700;letter-spacing:.04em">' + esc_(BRAND.name) + "</td></tr>" +
    '<tr><td style="padding:0 28px 8px;color:' + BRAND.chalk + ';font-size:24px;font-weight:800;line-height:1.2">' + esc_(title) + "</td></tr>" +
    '<tr><td style="padding:8px 28px 16px;color:' + BRAND.chalk + ';font-size:15px;line-height:1.55">' + lead + "</td></tr>" +
    (rowHtml ? '<tr><td style="padding:0 28px 16px"><table role="presentation" cellpadding="0" cellspacing="0">' + rowHtml + "</table></td></tr>" : "") +
    '<tr><td style="padding:12px 28px 28px;color:#9bb5ab;font-size:12px;line-height:1.5">' + footer + "</td></tr>" +
    "</table></body></html>";
}

var FOOT_ = "You are getting this because you registered for the Relanto Auction. This is a friendly office event and the money is not real.";

function tplRegistration(d) {
  var n = esc_(d.name);
  return {
    subject: "You are registered for the Relanto Auction",
    text: "Hi " + d.name + ",\n\nYour registration is in (Employee ID " + d.empId + "). The organizers will review it and email you when you are approved.\n\nNothing else to do for now.\n\nRelanto Auction",
    html: shell_("You are registered", "Hi " + n + ", your registration is in. The organizers will review it and email you once you are approved.", [["Employee ID", d.empId]], FOOT_),
  };
}

function tplApproved(d) {
  var rows = d.auctionDate ? [["Auction", d.auctionDate]] : [];
  var link = d.siteUrl ? '<br><br><a href="' + esc_(d.siteUrl) + '/screen.html" style="color:' + BRAND.bulb + '">Watch the live board</a>' : "";
  return {
    subject: "You are in the player pool",
    text: "Hi " + d.name + ",\n\nYou are approved and in the player pool." + (d.auctionDate ? "\nAuction: " + d.auctionDate : "") + "\n\nThe two captains will bid for players on the day. You will get another email when you are picked.\n\nRelanto Auction",
    html: shell_("You are in the player pool", "Hi " + esc_(d.name) + ", you are approved. The two captains will bid for players on the day, and you will get another email when you are picked." + link, rows, FOOT_),
  };
}

function tplSold(d) {
  return {
    subject: "You are going to " + d.team,
    text: "Hi " + d.name + ",\n\nGood news. " + d.team + " picked you for " + d.price + ".\n\nSee you on the field.\n\nRelanto Auction",
    html: shell_("You are going to " + d.team, "Hi " + esc_(d.name) + ", " + esc_(d.team) + " picked you in the auction.", [["Team", d.team], ["Winning bid", d.price]], FOOT_),
  };
}

function tplUnsold(d) {
  return {
    subject: "The auction update for you",
    text: "Hi " + d.name + ",\n\nNo captain picked you in the first round. You go back into the pool, and the organizers will tell you if a second round picks you up.\n\nRelanto Auction",
    html: shell_("No pick yet", "Hi " + esc_(d.name) + ", no captain picked you in the first round. You go back into the pool, and the organizers will tell you if a second round picks you up.", [], FOOT_),
  };
}

function buildEmail_(d) {
  switch (d.type) {
    case "registration": return tplRegistration(d);
    case "approved": return tplApproved(d);
    case "sold": return tplSold(d);
    case "unsold": return tplUnsold(d);
    default: return null;
  }
}
