/**
 * Loaded before every test (`npm test`). Tests run in plain Node, so:
 * - the time zone is pinned for deterministic DST cases,
 * - native Expo modules the data layer imports are replaced with Node equivalents.
 */
process.env.TZ = "Asia/Jerusalem";

const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "expo-crypto") return { randomUUID: () => require("crypto").randomUUID() };
  return originalLoad.call(this, request, ...rest);
};
