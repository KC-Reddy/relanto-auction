let passed = 0;
let failed = 0;
const failures = [];

export async function test(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (err) {
    failed += 1;
    failures.push(`${name}\n    ${err && err.message ? err.message : err}`);
  }
}

export function eq(actual, expected, label = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label} expected ${e} but got ${a}`);
}

export function truthy(v, label = "") {
  if (!v) throw new Error(`${label} expected a truthy value, got ${JSON.stringify(v)}`);
}

export function summary() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(" - " + f));
    process.exitCode = 1;
  }
}
