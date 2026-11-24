// Renders every email template to email-preview/*.html. Nothing is sent.
import fs from "node:fs";
import vm from "node:vm";
const src = fs.readFileSync(new URL("../apps-script/Templates.gs", import.meta.url), "utf8");
const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
const samples = [
  { type: "registration", name: "Sameer Khan", empId: "4821" },
  { type: "approved", name: "Sameer Khan", auctionDate: "Fri 12 Dec, 4:00 pm", siteUrl: "https://kc-reddy.github.io/relanto-auction" },
  { type: "sold", name: "Sameer Khan", team: "Team 1", price: "₹5,50,000" },
  { type: "unsold", name: "Sameer Khan" },
];
fs.mkdirSync(new URL("../email-preview/", import.meta.url), { recursive: true });
for (const s of samples) {
  const m = ctx.buildEmail_(s);
  fs.writeFileSync(new URL(`../email-preview/${s.type}.html`, import.meta.url), m.html);
  console.log(s.type.padEnd(13), m.subject);
}
