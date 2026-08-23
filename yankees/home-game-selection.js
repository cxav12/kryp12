(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HomeGameSelection = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const UPCOMING_WINDOW_MS = 3 * 60 * 60 * 1000;

  function isLive(game) {
    return game?.status?.abstractGameState === "Live";
  }

  function isWithinUpcomingWindow(game, now = new Date()) {
    if (!game || ["Final", "Live"].includes(game.status?.abstractGameState)) return false;
    const startTime = new Date(game.gameDate).getTime();
    const currentTime = new Date(now).getTime();
    return Number.isFinite(startTime)
      && Number.isFinite(currentTime)
      && currentTime >= startTime - UPCOMING_WINDOW_MS;
  }

  function featuredGame({ todayGame, recentGames = [], upcomingGames = [], now = new Date() }) {
    const liveGame = isLive(todayGame) ? todayGame : null;
    const todayIsScheduled = todayGame && !["Final", "Live"].includes(todayGame.status?.abstractGameState);
    const upcomingGame = upcomingGames[0] || (todayIsScheduled ? todayGame : null);
    return liveGame
      || (isWithinUpcomingWindow(upcomingGame, now) ? upcomingGame : null)
      || recentGames[0]
      || upcomingGame
      || todayGame
      || null;
  }

  return { UPCOMING_WINDOW_MS, featuredGame, isWithinUpcomingWindow };
}));
