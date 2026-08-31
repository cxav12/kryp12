(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AbsChallenges = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TEAM_ABBREVIATIONS = {
    "arizona diamondbacks": "AZ", "atlanta braves": "ATL", "baltimore orioles": "BAL",
    "boston red sox": "BOS", "chicago cubs": "CHC", "chicago white sox": "CWS",
    "cincinnati reds": "CIN", "cleveland guardians": "CLE", "colorado rockies": "COL",
    "detroit tigers": "DET", "houston astros": "HOU", "kansas city royals": "KC",
    "los angeles angels": "LAA", "los angeles dodgers": "LAD", "miami marlins": "MIA",
    "milwaukee brewers": "MIL", "minnesota twins": "MIN", "new york mets": "NYM",
    "new york yankees": "NYY", "athletics": "ATH", "oakland athletics": "OAK",
    "philadelphia phillies": "PHI", "pittsburgh pirates": "PIT", "san diego padres": "SD",
    "san francisco giants": "SF", "seattle mariners": "SEA", "st. louis cardinals": "STL",
    "tampa bay rays": "TB", "texas rangers": "TEX", "toronto blue jays": "TOR",
    "washington nationals": "WSH",
  };

  function teamAbbreviation(team) {
    if (!team) return "";
    if (typeof team === "string") {
      const name = team.trim();
      return TEAM_ABBREVIATIONS[name.toLowerCase()] || name;
    }
    return team.abbreviation
      || TEAM_ABBREVIATIONS[String(team.teamName || team.name || "").trim().toLowerCase()]
      || team.teamName
      || team.name
      || "";
  }

  function lastName(name) {
    const suffixes = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "";
    const suffix = suffixes.has(parts[parts.length - 1].toLowerCase()) ? parts.pop() : "";
    const familyName = parts[parts.length - 1] || "";
    return suffix && familyName ? `${familyName} ${suffix}` : familyName;
  }

  function boxscorePlayerByName(feed, name) {
    const target = String(name || "").trim().toLowerCase();
    if (!target) return null;
    const teams = feed.liveData?.boxscore?.teams || {};
    return ["away", "home"]
      .flatMap((side) => Object.values(teams[side]?.players || {}).map((player) => ({ ...player, side })))
      .find((player) => String(player.person?.fullName || "").trim().toLowerCase() === target) || null;
  }

  function resolveChallenger(feed, challenger) {
    const rawName = challenger?.fullName || challenger?.person?.fullName || challenger;
    const [name, suppliedTeam] = String(rawName || "").split(",").map((part) => part.trim());
    if (!name || /^challenge(?:r)?$/i.test(name)) return null;
    const player = boxscorePlayerByName(feed, name);
    const team = player
      ? teamAbbreviation(feed.liveData?.boxscore?.teams?.[player.side]?.team || feed.gameData?.teams?.[player.side])
      : teamAbbreviation(suppliedTeam);
    if (!team) return null;
    return { name, team, label: `${lastName(name)} (${team})` };
  }

  function ordinal(value) {
    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
    return `${value}${({ 1: "st", 2: "nd", 3: "rd" })[value % 10] || "th"}`;
  }

  function playEvents(feed) {
    const events = [];
    (feed.liveData?.plays?.allPlays || []).forEach((play) => {
      (play.playEvents || []).forEach((event) => {
        const review = event.reviewDetails;
        if (!review || review.reviewType !== "MJ" || review.inProgress) return;
        const description = String(event.details?.description || "").toLowerCase();
        const finalCall = description.includes("strike") ? "strike" : description.includes("ball") ? "ball" : "call";
        const inning = Number(play.about?.inning);
        const half = String(play.about?.halfInning || "");
        const inningLabel = Number.isFinite(inning)
          ? `${half ? `${half[0].toUpperCase()}${half.slice(1)}` : "Inning"} ${ordinal(inning)}`
          : "Inning unavailable";
        const player = resolveChallenger(feed, review.player);
        const outcome = review.isOverturned
          ? `✓ ${finalCall === "strike" ? "ball" : finalCall === "ball" ? "strike" : "original"} call overturned to ${finalCall}`
          : `✕ ${finalCall} call upheld`;
        events.push({ source: "play", raw: event, player, display: player ? `${player.label}: ${outcome} · ${inningLabel}` : null });
      });
    });
    return events;
  }

  function boxscoreEvents(feed) {
    const note = (feed.liveData?.boxscore?.info || []).find((item) => String(item.label || "").toLowerCase() === "abs challenge");
    if (!note?.value) return [];
    return String(note.value)
      .split(/(?<=\))\.\s*|;\s*|(?<=\)),\s*(?=[^,]+,\s*[A-Z]\s*\()/)
      .map((raw) => raw.trim().replace(/[.;]+$/, ""))
      .filter(Boolean)
      .map((raw) => {
        const match = raw.match(/^(.*?)\s*\((ball|strike)-(confirmed|overturned)\)$/i);
        if (!match) return { source: "boxscore", raw, player: null, display: null };
        const [, challenger, call, ruling] = match;
        const player = resolveChallenger(feed, challenger);
        const outcome = ruling.toLowerCase() === "overturned"
          ? `✓ ${call.toLowerCase()} call overturned`
          : `✕ ${call.toLowerCase()} call upheld`;
        return { source: "boxscore", raw, player, display: player ? `${player.label}: ${outcome}` : null };
      });
  }

  function events(feed) {
    const fromPlays = playEvents(feed);
    return fromPlays.length ? fromPlays : boxscoreEvents(feed);
  }

  return { events, resolveChallenger };
}));
