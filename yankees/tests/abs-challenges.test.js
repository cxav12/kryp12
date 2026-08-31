const test = require("node:test");
const assert = require("node:assert/strict");
const { events } = require("../assets/js/abs-challenges.js");

function feedFor(player) {
  return {
    gameData: { teams: { away: { abbreviation: "TOR" }, home: { abbreviation: "NYY" } } },
    liveData: {
      boxscore: {
        teams: {
          away: { team: { abbreviation: "TOR" }, players: { ID1: { person: { fullName: "Alejandro Kirk" } } } },
          home: { team: { abbreviation: "NYY" }, players: {} },
        },
      },
      plays: { allPlays: [{
        about: { inning: 8, halfInning: "top" },
        playEvents: [{
          details: { description: "Called strike" },
          reviewDetails: { reviewType: "MJ", inProgress: false, isOverturned: false, player },
        }],
      }] },
    },
  };
}

test("resolved ABS challenges produce a display row", () => {
  const result = events(feedFor({ fullName: "Alejandro Kirk" }));
  assert.equal(result.length, 1);
  assert.equal(result[0].display, "Kirk (TOR): ✕ strike call upheld · Top 8th");
});

test("ABS challenges without a player remain stored but have no display row", () => {
  const rawEvent = feedFor(undefined).liveData.plays.allPlays[0].playEvents[0];
  const result = events(feedFor(undefined));
  assert.equal(result.length, 1);
  assert.equal(result[0].display, null);
  assert.equal(result[0].raw.reviewDetails.reviewType, rawEvent.reviewDetails.reviewType);
});

test("ABS challenges without a resolved team remain stored but have no display row", () => {
  const feed = feedFor({ fullName: "Unknown Player" });
  const result = events(feed);
  assert.equal(result.length, 1);
  assert.equal(result[0].player, null);
  assert.equal(result[0].display, null);
});

test("a later refresh restores a previously unresolved challenge", () => {
  assert.equal(events(feedFor(undefined))[0].display, null);
  assert.match(events(feedFor({ fullName: "Alejandro Kirk" }))[0].display, /^Kirk \(TOR\):/);
});
