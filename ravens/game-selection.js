(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RavensGameSelection = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const UPCOMING_WINDOW_MS = 12 * 60 * 60 * 1000;

  function eventState(event) {
    return event?.competitions?.[0]?.status?.type?.state || event?.status?.type?.state || "pre";
  }

  function isWithinUpcomingWindow(event, now = new Date()) {
    if (!event || eventState(event) !== "pre") return false;
    const kickoff = new Date(event.date).getTime();
    const currentTime = new Date(now).getTime();
    return Number.isFinite(kickoff)
      && Number.isFinite(currentTime)
      && currentTime >= kickoff - UPCOMING_WINDOW_MS;
  }

  function chooseFeatured(events, now = new Date()) {
    const live = events.find((event) => eventState(event) === "in");
    const upcoming = events.find((event) => eventState(event) === "pre");
    const finals = events.filter((event) => eventState(event) === "post");
    return live
      || (isWithinUpcomingWindow(upcoming, now) ? upcoming : null)
      || finals.at(-1)
      || upcoming
      || events[0];
  }

  return { UPCOMING_WINDOW_MS, chooseFeatured, isWithinUpcomingWindow };
}));
