/* Sample players for trying the auction in demo mode and for the tests. */

import { ROLES, BATTING, BOWLING } from "./validators.js";

const NAMES = [
  "Aarav Menon", "Vihaan Rao", "Ishaan Gupta", "Kabir Nair", "Reyansh Iyer", "Arjun Reddy", "Dhruv Sharma",
  "Rohan Das", "Siddharth Jain", "Karthik Subramanian", "Aditya Verma", "Nikhil Bhat", "Rahul Chauhan",
  "Manish Pillai", "Varun Kulkarni", "Harsh Patel", "Tanmay Joshi", "Yash Malhotra", "Pranav Kapoor",
  "Sameer Khan", "Abhishek Roy", "Gautam Bose", "Mohit Saxena", "Naveen Kumar", "Utkarsh Singh",
];

/* A tiny valid JPEG, used when no canvas is available (tests). */
export const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

/* The same player data every time, so test results are repeatable. */
export function sampleRegistrations(count = 25, makePhoto = () => TINY_JPEG) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const name = NAMES[i % NAMES.length];
    list.push({
      name,
      email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
      phone: String(9000000000 + i * 1111111).slice(0, 10),
      empId: String(1001 + i),
      role: ROLES[i % ROLES.length],
      batting: BATTING[i % BATTING.length],
      bowling: BOWLING[i % BOWLING.length],
      skill: (i % 5) + 1,
      bio: i % 3 === 0 ? "Plays every Sunday." : "",
      photo: makePhoto(name),
    });
  }
  return list;
}

/* Category by skill: 5 stars marquee, 4 A, 3 B, otherwise C. */
export function categoryForSkill(skill) {
  return skill >= 5 ? "marquee" : skill === 4 ? "A" : skill === 3 ? "B" : "C";
}

/* Register and approve every sample player through the real engine (admin must be signed in). */
export async function loadSamples(engine, count = 25, makePhoto) {
  const regs = sampleRegistrations(count, makePhoto);
  for (const r of regs) {
    try { await engine.submitRegistration(r); } catch (e) { if (e.code !== "duplicate") throw e; }
    try { await engine.approve(r.empId, categoryForSkill(r.skill)); } catch (e) { if (e.code !== "invalid") throw e; }
  }
  return regs.length;
}
