import { summary } from "./harness.mjs";

await import("./core.test.mjs");
try { await import("./engine.test.mjs"); } catch (e) { if (e.code !== "ERR_MODULE_NOT_FOUND") throw e; }

/* the test files register tests as they load; give async ones a tick to finish */
await new Promise((r) => setTimeout(r, 50));
summary();
