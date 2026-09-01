(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RankTrends = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function cutoff(games, today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())) {
    const eligible = games.filter((game) => game.gameType === "R" && game.status?.abstractGameState === "Final" && game.officialDate <= today);
    const completed = [...new Map(eligible.map((game, index) => [game.gamePk ?? `row-${index}`, game])).values()]
      .sort((a, b) => String(b.officialDate).localeCompare(String(a.officialDate)) || (b.gameNumber || 1) - (a.gameNumber || 1));
    if (completed.length <= 10) return null;
    const firstDate = completed[9].officialDate;
    // Date-based MLB snapshots cannot split a doubleheader. Never silently
    // substitute an 11-game window or compare against the wrong baseline.
    if (!firstDate || completed[10].officialDate === firstDate) return null;
    const date = new Date(`${firstDate}T12:00:00Z`);
    if (!Number.isFinite(date.getTime())) return null;
    date.setUTCDate(date.getUTCDate() - 1);
    return { date: date.toISOString().slice(0, 10), expectedGames: completed.length - 10 };
  }

  function ranks(entries, direction) {
    const sorted = entries.filter((entry) => Number.isFinite(entry.value))
      .sort((a, b) => direction === "asc" ? a.value - b.value : b.value - a.value);
    const result = new Map();
    let rank = 0;
    sorted.forEach((entry, index) => {
      if (!index || entry.value !== sorted[index - 1].value) rank = index + 1;
      result.set(entry.teamId, rank);
    });
    return result;
  }

  function change(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return "unavailable";
    return current < previous ? "up" : current > previous ? "down" : "same";
  }
  return { cutoff, ranks, change };
}));
