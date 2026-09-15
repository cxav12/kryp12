const test = require("node:test");
const assert = require("node:assert/strict");
const { chooseFeatured } = require("../game-selection.js");

const now = new Date("2026-09-20T17:00:00Z");
const game = (id, state, date) => ({ id, date, status: { type: { state } } });
const completed = game("previous", "post", "2026-09-13T17:00:00Z");

test("keeps the completed game featured more than 12 hours before kickoff", () => {
  const upcoming = game("next", "pre", "2026-09-21T05:00:01Z");
  assert.equal(chooseFeatured([completed, upcoming], now), completed);
});

test("features the upcoming game starting 12 hours before kickoff", () => {
  const upcoming = game("next", "pre", "2026-09-21T05:00:00Z");
  assert.equal(chooseFeatured([completed, upcoming], now), upcoming);
});

test("always gives a live game priority", () => {
  const live = game("live", "in", "2026-09-20T16:00:00Z");
  const upcoming = game("next", "pre", "2026-09-27T17:00:00Z");
  assert.equal(chooseFeatured([completed, live, upcoming], now), live);
});

test("shows the upcoming game when no completed game exists", () => {
  const upcoming = game("opener", "pre", "2026-09-27T17:00:00Z");
  assert.equal(chooseFeatured([upcoming], now), upcoming);
});
