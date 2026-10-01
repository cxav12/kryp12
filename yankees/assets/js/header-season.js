(function exposeYankeesHeaderSeason(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.YankeesHeaderSeason = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const YANKEES_ID = 147;
  const POSTSEASON_ROUNDS = {
    F: { order: 1, short: "WILD CARD", full: "American League Wild Card Series", bestOf: 3 },
    D: { order: 2, short: "ALDS", full: "American League Division Series", bestOf: 5 },
    L: { order: 3, short: "ALCS", full: "American League Championship Series", bestOf: 7 },
    W: { order: 4, short: "WORLD SERIES", full: "World Series", bestOf: 7 },
  };

  function gameType(game) {
    return typeof game?.gameType === "string" ? game.gameType : game?.gameType?.id || "";
  }

  function gameTime(game) {
    const value = new Date(game?.gameDate || "").getTime();
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  }

  function isFinal(game) {
    const status = game?.status || {};
    return String(status.abstractGameState || "").toLowerCase() === "final"
      || status.codedGameState === "F"
      || String(status.detailedState || "").toLowerCase().includes("final");
  }

  function isUnavailable(game) {
    return /cancel|postpon/.test(String(game?.status?.detailedState || "").toLowerCase());
  }

  function isPreview(game) {
    return String(game?.status?.abstractGameState || "").toLowerCase() === "preview"
      && !isUnavailable(game);
  }

  function opponentFor(game) {
    const away = game?.teams?.away?.team;
    const home = game?.teams?.home?.team;
    if (Number(away?.id) === YANKEES_ID) return { ...home, yankeesAreAway: true };
    if (Number(home?.id) === YANKEES_ID) return { ...away, yankeesAreAway: false };
    return null;
  }

  function yankeesWon(game) {
    const side = Number(game?.teams?.away?.team?.id) === YANKEES_ID ? "away" : "home";
    return game?.teams?.[side]?.isWinner === true;
  }

  function standingFromData(data) {
    const match = (data?.records || []).flatMap((record) =>
      (record.teamRecords || []).map((teamRecord) => ({ record, teamRecord })))
      .find(({ teamRecord }) => Number(teamRecord.team?.id) === YANKEES_ID);
    if (!match) return null;
    const { record, teamRecord } = match;
    return {
      wins: Number(teamRecord.wins),
      losses: Number(teamRecord.losses),
      divisionRank: Number(teamRecord.divisionRank),
      divisionName: record.division?.name || "American League East",
      gamesBack: teamRecord.divisionGamesBack ?? teamRecord.gamesBack,
      streak: teamRecord.streak?.streakCode || "—",
    };
  }

  function ordinal(value) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return "—";
    const remainder100 = number % 100;
    const suffix = remainder100 >= 11 && remainder100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th");
    return `${number}${suffix}`;
  }

  function abbreviation(team) {
    return team?.abbreviation || team?.teamCode?.toUpperCase() || team?.fileCode?.toUpperCase() || "TBD";
  }

  function regularSubtitle(standing) {
    if (!standing) return "";
    const position = ordinal(standing.divisionRank);
    const gamesBack = Number.parseFloat(standing.gamesBack);
    const showGamesBack = standing.divisionRank > 1 && Number.isFinite(gamesBack) && gamesBack >= 0;
    return `${position !== "—" ? `${position} in ` : ""}${standing.divisionName}${showGamesBack ? ` · ${gamesBack} GB` : ""}`;
  }

  function nextGame(games) {
    return [...games].filter(isPreview).sort((a, b) => gameTime(a) - gameTime(b))[0] || null;
  }

  function groupPostseasonGames(games) {
    const groups = new Map();
    games.filter((game) => POSTSEASON_ROUNDS[gameType(game)] && opponentFor(game)).forEach((game) => {
      const opponent = opponentFor(game);
      const code = gameType(game);
      const key = `${code}-${opponent.id}`;
      if (!groups.has(key)) groups.set(key, { code, opponent, games: [] });
      groups.get(key).games.push(game);
    });
    return [...groups.values()].map((group) => ({
      ...group,
      games: group.games.sort((a, b) => gameTime(a) - gameTime(b)),
      firstGame: Math.min(...group.games.map(gameTime)),
    })).sort((a, b) => POSTSEASON_ROUNDS[a.code].order - POSTSEASON_ROUNDS[b.code].order
      || a.firstGame - b.firstGame);
  }

  function seriesState(group) {
    const round = POSTSEASON_ROUNDS[group.code];
    const bestOfFromApi = Math.max(...group.games.map((game) => Number(game.gamesInSeries) || 0));
    const bestOf = bestOfFromApi > 0 ? bestOfFromApi : round.bestOf;
    const winsNeeded = Math.floor(bestOf / 2) + 1;
    let yankeesWins = 0;
    let opponentWins = 0;
    group.games.filter(isFinal).forEach((game) => {
      if (yankeesWon(game)) yankeesWins += 1;
      else opponentWins += 1;
    });
    const complete = yankeesWins >= winsNeeded || opponentWins >= winsNeeded;
    return { bestOf, winsNeeded, yankeesWins, opponentWins, complete };
  }

  function seriesLabel(series, opponentAbbreviation) {
    const score = `${series.yankeesWins}–${series.opponentWins}`;
    if (series.complete) return series.yankeesWins > series.opponentWins
      ? `NYY WINS ${score}`
      : `${opponentAbbreviation} WINS ${series.opponentWins}–${series.yankeesWins}`;
    if (series.yankeesWins === 0 && series.opponentWins === 0) return "0–0";
    if (series.yankeesWins === series.opponentWins) return `TIED ${score}`;
    return series.yankeesWins > series.opponentWins
      ? `NYY LEADS ${score}`
      : `${opponentAbbreviation} LEADS ${series.opponentWins}–${series.yankeesWins}`;
  }

  function buildHeaderState({ season, standings, games = [] }) {
    const standing = standingFromData(standings);
    const postseasonGroups = groupPostseasonGames(games);
    if (postseasonGroups.length) {
      const group = postseasonGroups.at(-1);
      const round = POSTSEASON_ROUNDS[group.code];
      const series = seriesState(group);
      const opponentAbbreviation = abbreviation(group.opponent);
      if (series.complete && (series.opponentWins >= series.winsNeeded || group.code === "W")) {
        const yankeesWonSeries = series.yankeesWins > series.opponentWins;
        return {
          mode: "postseason-complete",
          subtitle: `${season} Postseason Complete`,
          cards: [
            ["Postseason", round.short],
            ["Result", `${yankeesWonSeries ? "Won" : "Lost"} ${yankeesWonSeries ? `${series.yankeesWins}–${series.opponentWins}` : `${series.opponentWins}–${series.yankeesWins}`}`],
            ["Season", "Complete"],
          ],
        };
      }
      const upcoming = nextGame(group.games);
      return {
        mode: "postseason",
        subtitle: `${round.full} · Best of ${series.bestOf} vs ${group.opponent.name}`,
        cards: [
          ["Round", round.short],
          ["Series", seriesLabel(series, opponentAbbreviation)],
          ["Next", upcoming ? { game: upcoming, opponent: group.opponent } : "TBD"],
        ],
      };
    }

    const regularGames = games.filter((game) => gameType(game) === "R");
    const scheduledRegularGames = regularGames.filter((game) => !isUnavailable(game));
    const regularSeasonComplete = scheduledRegularGames.length > 0
      && scheduledRegularGames.every(isFinal);
    if (regularSeasonComplete && standing) {
      return {
        mode: "season-complete",
        subtitle: `${season} Season Complete`,
        cards: [
          ["Final Record", `${standing.wins}–${standing.losses}`],
          ["AL East", ordinal(standing.divisionRank)],
          ["Status", "Eliminated"],
        ],
      };
    }

    const upcoming = nextGame(regularGames);
    const streak = standing?.streak || "—";
    return {
      mode: "regular",
      subtitle: regularSubtitle(standing),
      cards: [
        ["Record", standing ? `${standing.wins}–${standing.losses}` : "—"],
        ["Streak", streak, streak.toUpperCase().startsWith("W") ? "win" : streak.toUpperCase().startsWith("L") ? "loss" : ""],
        ["Next", upcoming ? { game: upcoming, opponent: opponentFor(upcoming) } : "—"],
      ],
    };
  }

  return { buildHeaderState, gameType, isFinal, opponentFor, seriesLabel, seriesState };
}));
