(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YankeesGameStatus = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CONFIRMED_EXCEPTIONS = {
    823490: {
      reason: "Sustained inclement weather",
      rescheduled: false,
      note: "This game will not be rescheduled.",
      seasonNote: "The Yankees finish the 2026 regular season with 161 games played.",
      sourceUrl: "https://www.mlb.com/press-release/today-s-yankees-orioles-game-sunday-september-27-will-not-be-played",
    },
  };

  function classify(game = {}) {
    const status = game.status || {};
    const detail = String(status.detailedState || status.abstractGameState || "").trim();
    const normalized = detail.toLowerCase();
    const known = CONFIRMED_EXCEPTIONS[Number(game.gamePk)] || {};
    let kind = "scheduled";
    if (status.codedGameState === "C" || status.statusCode === "CR" || /cancelled|canceled/.test(normalized)) kind = "canceled";
    else if (/postponed/.test(normalized)) kind = "postponed";
    else if (/suspended/.test(normalized)) kind = "suspended";
    else if (/delayed/.test(normalized)) kind = "delayed";
    else if (status.abstractGameState === "Final") kind = "final";
    else if (status.abstractGameState === "Live") kind = "live";
    return {
      kind,
      label: kind === "canceled" ? "Canceled" : detail || "Scheduled",
      reason: known.reason || String(status.reason || "").trim(),
      rescheduled: known.rescheduled,
      note: known.note || "",
      seasonNote: known.seasonNote || "",
      sourceUrl: known.sourceUrl || "",
      terminal: kind === "canceled" || kind === "final",
    };
  }

  function isCanceled(game) { return classify(game).kind === "canceled"; }
  function isUpcoming(game) { return !["canceled", "final", "live"].includes(classify(game).kind); }

  return { classify, isCanceled, isUpcoming };
}));
