(function gameContextModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RavensGameContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGameContextApi() {
  const BROADCASTS = {
    "2026-09-27|BAL-DAL": "CBS / Paramount+",
  };
  const VENUES = {
    "maracana stadium": { latitude: -22.9121, longitude: -43.2302, timezone: "America/Sao_Paulo" },
    "maracana": { latitude: -22.9121, longitude: -43.2302, timezone: "America/Sao_Paulo" },
  };
  const WEATHER_LABELS = new Map([
    [0, "Clear"], [1, "Mostly clear"], [2, "Partly cloudy"], [3, "Cloudy"],
    [45, "Fog"], [48, "Freezing fog"], [51, "Light drizzle"], [53, "Drizzle"], [55, "Heavy drizzle"],
    [56, "Freezing drizzle"], [57, "Heavy freezing drizzle"], [61, "Light rain"], [63, "Rain"], [65, "Heavy rain"],
    [66, "Freezing rain"], [67, "Heavy freezing rain"], [71, "Light snow"], [73, "Snow"], [75, "Heavy snow"],
    [77, "Snow grains"], [80, "Light showers"], [81, "Showers"], [82, "Heavy showers"],
    [85, "Light snow showers"], [86, "Heavy snow showers"], [95, "Thunderstorms"],
    [96, "Thunderstorms with hail"], [99, "Severe thunderstorms with hail"],
  ]);

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  }

  function competition(event) { return event?.competitions?.[0] || {}; }

  function broadcastFor(event) {
    const abbreviations = (competition(event).competitors || []).map((entry) => entry.team?.abbreviation).filter(Boolean).sort().join("-");
    const date = String(event?.date || "").slice(0, 10);
    return BROADCASTS[`${date}|${abbreviations}`] || "";
  }

  function venueFor(event) {
    const venue = competition(event).venue || {};
    return VENUES[normalize(venue.fullName)] || null;
  }

  function weatherUrl(venue) {
    const params = new URLSearchParams({
      latitude: String(venue.latitude), longitude: String(venue.longitude),
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
      temperature_unit: "fahrenheit", wind_speed_unit: "mph", timezone: venue.timezone,
    });
    return `https://api.open-meteo.com/v1/forecast?${params}`;
  }

  function formatConditions(payload) {
    const current = payload?.current;
    if (!current || !Number.isFinite(Number(current.temperature_2m))) return "";
    const temperature = Math.round(Number(current.temperature_2m));
    const feelsLike = Math.round(Number(current.apparent_temperature));
    const label = WEATHER_LABELS.get(Number(current.weather_code)) || "Current conditions";
    const feels = Number.isFinite(feelsLike) && feelsLike !== temperature ? ` · Feels ${feelsLike}°F` : "";
    return `${temperature}°F · ${label}${feels}`;
  }

  async function fetchContext(event, fetchImpl = fetch) {
    const context = { broadcast: broadcastFor(event), conditions: "", updatedAt: Date.now() };
    const venue = venueFor(event);
    if (!venue) return context;
    const response = await fetchImpl(weatherUrl(venue));
    if (!response.ok) throw new Error(`Weather request returned ${response.status}`);
    context.conditions = formatConditions(await response.json());
    return context;
  }

  return { broadcastFor, venueFor, weatherUrl, formatConditions, fetchContext };
});
