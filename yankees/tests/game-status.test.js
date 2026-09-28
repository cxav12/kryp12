const test = require("node:test");
const assert = require("node:assert/strict");
const { classify, isCanceled, isUpcoming } = require("../assets/js/game-status.js");

const canceledFinal = {
  gamePk: 823490,
  status: { abstractGameState: "Final", codedGameState: "C", detailedState: "Cancelled", statusCode: "CR", reason: "Rain" },
};

test("recognizes an MLB canceled game even when its abstract state is Final", () => {
  assert.equal(isCanceled(canceledFinal), true);
  assert.equal(classify(canceledFinal).kind, "canceled");
  assert.equal(isUpcoming(canceledFinal), false);
});

test("adds the confirmed no-reschedule details for the 2026 finale", () => {
  const status = classify(canceledFinal);
  assert.equal(status.reason, "Sustained inclement weather");
  assert.equal(status.rescheduled, false);
  assert.match(status.note, /will not be rescheduled/i);
  assert.match(status.seasonNote, /161 games/i);
});

test("keeps ordinary postponements distinct from cancellations", () => {
  const status = classify({ status: { abstractGameState: "Preview", detailedState: "Postponed", reason: "Rain" } });
  assert.equal(status.kind, "postponed");
  assert.equal(status.reason, "Rain");
});
