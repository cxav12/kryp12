const test = require("node:test");
const assert = require("node:assert/strict");
const { build, gameStatusAlert, transactionAlert, weatherAlert } = require("./home-alerts.js");

test("creates alerts for important roster moves", () => {
  assert.equal(transactionAlert({ date: "2026-08-23", description: "Placed Aaron Judge on the 10-day injured list." }).label, "Injured List");
  assert.equal(transactionAlert({ date: "2026-08-23", description: "Recalled Player One from Triple-A." }).label, "Recalled");
  assert.equal(transactionAlert({ date: "2026-08-23", description: "Optioned Player Two to Triple-A." }).label, "Optioned");
  assert.equal(transactionAlert({ date: "2026-08-23", description: "Activated Player Three from the injured list." }).label, "Activated");
});

test("ignores routine transactions", () => {
  assert.equal(transactionAlert({ description: "Changed Player One's uniform number." }), null);
});

test("creates an alert for a delayed or postponed game", () => {
  const alert = gameStatusAlert({ gamePk: 1, status: { detailedState: "Postponed", reason: "Rain" } });
  assert.equal(alert.label, "Game Alert");
  assert.match(alert.text, /Postponed/);
});

test("shows severe weather only within twelve hours of first pitch", () => {
  const game = { gamePk: 1, gameDate: "2026-08-23T23:00:00Z", officialDate: "2026-08-23" };
  const feed = { gameData: { weather: { condition: "Rain" }, venue: { name: "Yankee Stadium" } } };
  assert.ok(weatherAlert(game, feed, new Date("2026-08-23T17:00:00Z")));
  assert.equal(weatherAlert(game, feed, new Date("2026-08-22T08:00:00Z")), null);
});

test("hides the feature when no important alerts exist", () => {
  assert.deepEqual(build({ transactions: [{ description: "Changed a uniform number." }] }), []);
});

test("removes an alert after its second calendar day", () => {
  const transaction = { date: "2026-08-21", description: "Recalled Player One from Triple-A." };
  assert.equal(build({ transactions: [transaction], now: new Date("2026-08-22T23:59:59") }).length, 1);
  assert.equal(build({ transactions: [transaction], now: new Date("2026-08-23T00:00:00") }).length, 0);
});
