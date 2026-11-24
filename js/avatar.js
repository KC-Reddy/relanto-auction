/* Initials avatars for demo players, drawn on a canvas and returned as a small JPEG data URL. */

const PALETTE = ["#1f6f54", "#2a5d8f", "#8a4f2a", "#6a3d7c", "#a63a3a", "#3f7a8c", "#7a6a1f", "#2f6f3a"];

export function makeAvatar(name) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 240;
  const ctx = canvas.getContext("2d");
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  ctx.fillStyle = PALETTE[hash % PALETTE.length];
  ctx.fillRect(0, 0, 240, 240);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 240; i += 48) ctx.fillRect(i, 0, 24, 240);
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  ctx.fillStyle = "#e8ece4";
  ctx.font = "800 110px 'Big Shoulders Display', Arial Narrow, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, 120, 128);
  return canvas.toDataURL("image/jpeg", 0.8);
}
