const test = require("node:test");
const assert = require("node:assert/strict");
const { broadcastFor, venueFor, formatConditions, fetchContext } = require("../game-context.js");

const event = {
  date: "2026-09-27T20:25:00Z",
  competitions: [{
    venue: { fullName: "Maracanã Stadium" },
    competitors: [{ team: { abbreviation: "DAL" } }, { team: { abbreviation: "BAL" } }],
  }],
};

test("supplies the official broadcast when ESPN omits it", () => {
  assert.equal(broadcastFor(event), "CBS / Paramount+");
});

test("recognizes Maracanã despite the accented name", () => {
  assert.deepEqual(venueFor(event), { latitude: -22.9121, longitude: -43.2302, timezone: "America/Sao_Paulo" });
});

test("formats current weather into a compact conditions label", () => {
  assert.equal(formatConditions({ current: { temperature_2m: 78.2, apparent_temperature: 81.1, weather_code: 1 } }), "78°F · Mostly clear · Feels 81°F");
});

test("loads live conditions while retaining the broadcast fallback", async () => {
  const context = await fetchContext(event, async () => ({
    ok: true,
    json: async () => ({ current: { temperature_2m: 77.6, apparent_temperature: 79, weather_code: 2 } }),
  }));
  assert.equal(context.broadcast, "CBS / Paramount+");
  assert.equal(context.conditions, "78°F · Partly cloudy · Feels 79°F");
});
