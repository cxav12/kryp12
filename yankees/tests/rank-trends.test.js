const test = require("node:test");
const assert = require("node:assert/strict");
const { cutoff, ranks, change } = require("../assets/js/rank-trends.js");

test("rank movement uses ranking position rather than cumulative stat growth", () => {
  assert.equal(change(8, 10), "up");
  assert.equal(change(12, 10), "down");
  assert.equal(change(10, 10), "same");
  assert.equal(change(10, undefined), "unavailable");
});
test("ties share competition ranks and missing values are excluded", () => {
  const entries = [{ teamId: 1, value: 10 }, { teamId: 2, value: 10 }, { teamId: 3, value: 8 }, { teamId: 4, value: null }];
  assert.deepEqual([...ranks(entries, "desc")], [[1, 1], [2, 1], [3, 3]]);
  assert.deepEqual([...ranks(entries, "asc")], [[3, 1], [1, 2], [2, 2]]);
});
const games = Array.from({ length: 12 }, (_, i) => ({ officialDate: `2026-08-${String(i + 1).padStart(2, "0")}`, gameType: "R", status: { abstractGameState: "Final" } }));
test("cutoff counts completed regular-season games, not calendar days", () => {
  const pending = { officialDate: "2026-08-13", gameType: "R", status: { abstractGameState: "Preview" } };
  assert.deepEqual(cutoff([...games, pending]), { date: "2026-08-02", expectedGames: 2 });
  assert.equal(cutoff(games.slice(0, 10)), null);
});
test("a split doubleheader boundary is unavailable rather than the wrong window", () => {
  const doubleheader = games.map((game) => ({ ...game }));
  doubleheader[2].officialDate = doubleheader[1].officialDate;
  assert.equal(cutoff(doubleheader), null);
});

test("rescheduled duplicates and future-dated entries do not count as extra completed games", () => {
  const numbered = games.map((game, i) => ({ ...game, gamePk: i + 1 }));
  const future = { ...numbered[0], gamePk: 20, officialDate: "2026-09-20" };
  assert.deepEqual(cutoff([...numbered, numbered[11], future], "2026-08-31"), { date: "2026-08-02", expectedGames: 2 });
});
