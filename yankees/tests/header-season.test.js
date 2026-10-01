const test = require("node:test");
const assert = require("node:assert/strict");
const { buildHeaderState } = require("../assets/js/header-season.js");

const YANKEES = { id: 147, name: "New York Yankees", abbreviation: "NYY" };
const RED_SOX = { id: 111, name: "Boston Red Sox", abbreviation: "BOS" };
const BLUE_JAYS = { id: 141, name: "Toronto Blue Jays", abbreviation: "TOR" };

function standings(wins = 90, losses = 72, rank = 2) {
  return {
    records: [{
      division: { name: "American League East" },
      teamRecords: [{
        team: YANKEES,
        wins,
        losses,
        divisionRank: String(rank),
        divisionGamesBack: rank === 1 ? "-" : "3.0",
        streak: { streakCode: "W2" },
      }],
    }],
  };
}

function game({ type = "R", opponent = RED_SOX, date = "2027-07-01T23:05:00Z", state = "Preview", winner = null, gamesInSeries = 0 }) {
  return {
    gameType: type,
    gameDate: date,
    gamesInSeries,
    status: { abstractGameState: state, detailedState: state, codedGameState: state === "Final" ? "F" : "S" },
    teams: {
      away: { team: YANKEES, isWinner: winner === "NYY" },
      home: { team: opponent, isWinner: winner === "OPP" },
    },
  };
}

test("keeps the regular-season header during an active season", () => {
  const state = buildHeaderState({ season: 2027, standings: standings(), games: [game({})] });
  assert.equal(state.mode, "regular");
  assert.equal(state.cards[0][0], "Record");
  assert.equal(state.cards[1][0], "Streak");
});

test("keeps regular mode while the final regular-season game is not final", () => {
  const state = buildHeaderState({ season: 2027, standings: standings(), games: [game({ state: "Live" })] });
  assert.equal(state.mode, "regular");
});

test("shows a known postseason matchup before its first game", () => {
  const state = buildHeaderState({
    season: 2027,
    standings: standings(),
    games: [game({ type: "F", gamesInSeries: 3 })],
  });
  assert.equal(state.mode, "postseason");
  assert.match(state.subtitle, /American League Wild Card Series · Best of 3 vs Boston Red Sox/);
  assert.deepEqual(state.cards[0], ["Round", "WILD CARD"]);
  assert.deepEqual(state.cards[1], ["Series", "0–0"]);
});

test("describes series leads, ties, and deficits", () => {
  const base = { type: "D", gamesInSeries: 5 };
  const lead = buildHeaderState({ season: 2027, standings: standings(), games: [
    game({ ...base, state: "Final", winner: "NYY" }),
    game({ ...base, date: "2027-10-02T23:05:00Z" }),
  ] });
  assert.equal(lead.cards[1][1], "NYY LEADS 1–0");

  const tied = buildHeaderState({ season: 2027, standings: standings(), games: [
    game({ ...base, state: "Final", winner: "NYY" }),
    game({ ...base, date: "2027-10-02T23:05:00Z", state: "Final", winner: "OPP" }),
    game({ ...base, date: "2027-10-03T23:05:00Z" }),
  ] });
  assert.equal(tied.cards[1][1], "TIED 1–1");

  const trail = buildHeaderState({ season: 2027, standings: standings(), games: [
    game({ ...base, state: "Final", winner: "OPP" }),
    game({ ...base, date: "2027-10-02T23:05:00Z" }),
  ] });
  assert.equal(trail.cards[1][1], "BOS LEADS 1–0");
});

test("advances to the latest known postseason round and opponent", () => {
  const games = [
    game({ type: "F", gamesInSeries: 3, state: "Final", winner: "NYY" }),
    game({ type: "F", gamesInSeries: 3, date: "2027-10-02T23:05:00Z", state: "Final", winner: "NYY" }),
    game({ type: "D", opponent: BLUE_JAYS, gamesInSeries: 5, date: "2027-10-05T23:05:00Z" }),
  ];
  const state = buildHeaderState({ season: 2027, standings: standings(), games });
  assert.equal(state.cards[0][1], "ALDS");
  assert.match(state.subtitle, /vs Toronto Blue Jays/);
});

test("shows a completed postseason after elimination", () => {
  const games = [1, 2, 3].map((day) => game({
    type: "D",
    gamesInSeries: 5,
    date: `2027-10-0${day}T23:05:00Z`,
    state: "Final",
    winner: "OPP",
  }));
  const state = buildHeaderState({ season: 2027, standings: standings(), games });
  assert.equal(state.mode, "postseason-complete");
  assert.deepEqual(state.cards[1], ["Result", "Lost 3–0"]);
});

test("shows a completed regular season when the Yankees miss the postseason", () => {
  const state = buildHeaderState({
    season: 2027,
    standings: standings(86, 76, 3),
    games: [game({ state: "Final", winner: "NYY" })],
  });
  assert.equal(state.mode, "season-complete");
  assert.deepEqual(state.cards, [["Final Record", "86–76"], ["AL East", "3rd"], ["Status", "Eliminated"]]);
});

test("falls back safely when MLB data is unavailable", () => {
  const state = buildHeaderState({ season: 2027, standings: null, games: [] });
  assert.equal(state.mode, "regular");
  assert.deepEqual(state.cards.map((card) => card[1]), ["—", "—", "—"]);
});
