(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HomeAlerts = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const IMPORTANT_TRANSACTION_PATTERN = /injured|injury|\bIL\b|10-day|15-day|60-day|recalled?|optioned?|selected.*contract|contract.*selected|activated?|reinstated?|designated|released?|acquired?|traded?/i;
  const URGENT_GAME_PATTERN = /postpon|delay|suspend|cancel|resched/i;
  const SEVERE_WEATHER_PATTERN = /rain|thunder|storm|snow|sleet|hail/i;
  const WEATHER_WINDOW_MS = 12 * 60 * 60 * 1000;
  const ALERT_LIFETIME_DAYS = 2;

  function isFresh(alert, now) {
    if (!alert.date) return true;
    const alertDate = new Date(`${alert.date}T00:00:00`);
    const currentDate = new Date(now);
    if (Number.isNaN(alertDate.getTime()) || Number.isNaN(currentDate.getTime())) return true;
    const expires = new Date(alertDate);
    expires.setDate(expires.getDate() + ALERT_LIFETIME_DAYS);
    return currentDate < expires;
  }

  function transactionKind(text) {
    if (/activated?|reinstated?/i.test(text)) return { key: "activated", label: "Activated", priority: 90 };
    if (/recalled?/i.test(text)) return { key: "recalled", label: "Recalled", priority: 85 };
    if (/injured|injury|\bIL\b|10-day|15-day|60-day/i.test(text)) return { key: "il", label: "Injured List", priority: 80 };
    if (/optioned?/i.test(text)) return { key: "optioned", label: "Optioned", priority: 70 };
    if (/selected.*contract|contract.*selected/i.test(text)) return { key: "activated", label: "Selected", priority: 75 };
    return { key: "team-news", label: "Team News", priority: 60 };
  }

  function transactionAlert(item) {
    const text = String(item?.description || item?.note || item?.typeDesc || "").trim();
    if (!text || !IMPORTANT_TRANSACTION_PATTERN.test(text)) return null;
    const kind = transactionKind(text);
    return {
      id: `transaction-${item.id || item.transactionId || `${item.date || item.effectiveDate}-${text}`}`,
      kind: kind.key,
      label: kind.label,
      text,
      date: item.effectiveDate || item.date || "",
      priority: kind.priority,
    };
  }

  function gameStatusAlert(game) {
    const detail = String(game?.status?.detailedState || game?.status?.abstractGameState || "").trim();
    const reason = String(game?.status?.reason || "").trim();
    const text = [detail, reason && !detail.toLowerCase().includes(reason.toLowerCase()) ? reason : ""]
      .filter(Boolean)
      .join(" — ");
    if (!URGENT_GAME_PATTERN.test(text)) return null;
    return {
      id: `game-${game.gamePk}-${text}`,
      kind: "game",
      label: "Game Alert",
      text,
      date: game.officialDate || "",
      priority: 100,
    };
  }

  function weatherAlert(game, feed, now = new Date()) {
    const startTime = new Date(game?.gameDate).getTime();
    const currentTime = new Date(now).getTime();
    const timeUntilStart = startTime - currentTime;
    const condition = String(feed?.gameData?.weather?.condition || "").trim();
    if (!condition
      || !SEVERE_WEATHER_PATTERN.test(condition)
      || !Number.isFinite(timeUntilStart)
      || timeUntilStart < 0
      || timeUntilStart > WEATHER_WINDOW_MS) return null;
    const venue = feed?.gameData?.venue?.name || game?.venue?.name || "the ballpark";
    return {
      id: `weather-${game.gamePk}-${condition}`,
      kind: "weather",
      label: "Weather Watch",
      text: `${condition} is listed for the upcoming game at ${venue}. Check the game status closer to first pitch.`,
      date: game.officialDate || "",
      priority: 50,
    };
  }

  function build({ games = [], transactions = [], weatherGame = null, weatherFeed = null, now = new Date() }) {
    const alerts = [
      ...games.map(gameStatusAlert),
      ...transactions.map(transactionAlert),
      weatherAlert(weatherGame, weatherFeed, now),
    ].filter(Boolean).filter((alert) => isFresh(alert, now));
    return [...new Map(alerts.map((alert) => [alert.id, alert])).values()]
      .sort((a, b) => b.priority - a.priority || String(b.date).localeCompare(String(a.date)))
      .slice(0, 3);
  }

  return { ALERT_LIFETIME_DAYS, build, gameStatusAlert, transactionAlert, weatherAlert };
}));
