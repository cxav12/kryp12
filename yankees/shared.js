const yankeesBrandCopies = document.querySelectorAll(".brand-lockup > div");

function standingsOrdinal(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return "";
  const remainder100 = number % 100;
  const suffix = remainder100 >= 11 && remainder100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th");
  return `${number}${suffix}`;
}

async function renderYankeesBrandRecord() {
  if (!yankeesBrandCopies.length) return;
  const recordLines = [...yankeesBrandCopies].map((brandCopy) => {
    brandCopy.classList.add("brand-copy");
    const newYork = brandCopy.querySelector(".brand-kicker");
    const yankees = brandCopy.querySelector(".brand-title");
    if (newYork && yankees) {
      newYork.textContent = `${newYork.textContent.trim()} ${yankees.textContent.trim()}`;
      newYork.classList.add("brand-wordmark");
      yankees.remove();
    }
    const line = document.createElement("p");
    line.className = "brand-record mb-0";
    line.setAttribute("aria-live", "polite");
    line.hidden = true;
    brandCopy.append(line);
    return line;
  });

  try {
    const season = new Date().getFullYear();
    const url = new URL("https://statsapi.mlb.com/api/v1/standings");
    url.searchParams.set("leagueId", "103");
    url.searchParams.set("season", season);
    url.searchParams.set("standingsTypes", "regularSeason");
    url.searchParams.set("hydrate", "team,division");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`MLB standings returned ${response.status}`);
    const data = await response.json();
    const match = (data.records || []).flatMap((record) =>
      (record.teamRecords || []).map((teamRecord) => ({ record, teamRecord }))
    ).find(({ teamRecord }) => Number(teamRecord.team?.id) === 147);
    if (!match) throw new Error("Yankees standings unavailable");

    const { record, teamRecord } = match;
    const position = standingsOrdinal(teamRecord.divisionRank);
    const division = record.division?.name || "American League East";
    const label = `${position ? `${position} in ` : ""}${division} (${teamRecord.wins} - ${teamRecord.losses})`;
    recordLines.forEach((line) => {
      line.textContent = label;
      line.hidden = false;
    });
  } catch (error) {
    recordLines.forEach((line) => line.remove());
  }
}

renderYankeesBrandRecord();
