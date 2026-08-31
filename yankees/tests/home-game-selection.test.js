const test = require("node:test");
const assert = require("node:assert/strict");
const { featuredGame } = require("../assets/js/home-game-selection.js");

const now = new Date("2026-08-23T17:00:00Z");
const game = (gamePk, abstractGameState, gameDate) => ({
  gamePk,
  gameDate,
  status: { abstractGameState },
});
const previous = game(1, "Final", "2026-08-22T23:00:00Z");

test("keeps the previous game featured more than three hours before first pitch", () => {
  const upcoming = game(2, "Preview", "2026-08-23T21:00:01Z");
  assert.equal(featuredGame({ recentGames: [previous], upcomingGames: [upcoming], now }), previous);
});

test("features the upcoming game starting three hours before first pitch", () => {
  const upcoming = game(2, "Preview", "2026-08-23T20:00:00Z");
  assert.equal(featuredGame({ recentGames: [previous], upcomingGames: [upcoming], now }), upcoming);
});

test("always gives a live game priority", () => {
  const live = game(3, "Live", "2026-08-23T16:00:00Z");
  const upcoming = game(2, "Preview", "2026-08-24T20:00:00Z");
  assert.equal(featuredGame({ todayGame: live, recentGames: [previous], upcomingGames: [upcoming], now }), live);
});
