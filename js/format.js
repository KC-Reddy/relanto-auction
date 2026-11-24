/* Indian number grouping: 3000000 becomes ₹30,00,000 */
export function inr(n) {
  const v = Math.round(Number(n) || 0);
  return "₹" + v.toLocaleString("en-IN");
}

/* Short form for tight spaces: ₹30L, ₹2.5L, ₹25k */
export function inrShort(n) {
  const v = Number(n) || 0;
  if (v >= 100000) return "₹" + +(v / 100000).toFixed(2) + "L";
  if (v >= 1000) return "₹" + +(v / 1000).toFixed(1) + "k";
  return "₹" + v;
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
}
