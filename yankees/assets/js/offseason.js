(() => {
  'use strict';
  const API = 'https://statsapi.mlb.com/api/v1';
  const now = new Date();
  const year = Number(new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric'}).format(now));
  const month = Number(new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', month: 'numeric'}).format(now));
  const season = month < 3 ? year - 1 : year;
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now);
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const dateOnly = value => String(value || '').slice(0, 10);
  const niceDate = value => {
    const date = new Date(`${dateOnly(value)}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', timeZone: 'America/New_York'}).format(date);
  };
  async function get(path, params = {}) {
    const url = new URL(API + path);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Unable to load MLB data');
    return response.json();
  }
  const empty = (target, message) => { el(target).innerHTML = `<p class="offseason-empty">${escape(message)}</p>`; };
  async function moves() {
    let start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 45);
    let startDate = start.toISOString().slice(0, 10);
    el('moves-title').textContent = 'Recent moves';
    try {
      const schedule = await get('/schedule', {sportId: 1, teamId: 147, season, gameTypes: 'R,F,D,L,W'});
      const finals = (schedule.dates || []).flatMap(day => day.games || []).filter(game =>
        game.status?.abstractGameState === 'Final' && !/cancel|postpon/i.test(game.status?.detailedState || '') && game.officialDate);
      const last = finals.map(game => game.officialDate).sort().at(-1);
      if (last) {
        const next = new Date(`${last}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        startDate = next.toISOString().slice(0, 10);
        el('moves-title').textContent = 'Offseason moves';
      }
    } catch { /* Use a labeled recent window if the schedule is unavailable. */ }
    el('moves-window').textContent = `${niceDate(startDate)} – ${niceDate(today)}`;
    if (startDate > today) { empty('offseason-moves', 'No offseason moves yet.'); return; }
    const data = await get('/transactions', {teamId: 147, startDate, endDate: today});
    const seen = new Set();
    const items = (data.transactions || []).filter(item => {
      const key = item.id || `${item.date}:${item.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(item.description || item.note);
    }).sort((a, b) => dateOnly(b.effectiveDate || b.date).localeCompare(dateOnly(a.effectiveDate || a.date)) || Number(b.id || 0) - Number(a.id || 0)).slice(0, 6);
    if (!items.length) { empty('offseason-moves', 'No roster moves reported in this window.'); return; }
    el('offseason-moves').innerHTML = `<ol class="offseason-move-list">${items.map(item => {
      const date = dateOnly(item.effectiveDate || item.date);
      return `<li class="offseason-move"><time datetime="${escape(date)}">${escape(niceDate(date))}</time><div><h3>${escape(item.person?.fullName || 'Yankees roster')}<span class="offseason-type">${escape(item.typeDesc || '')}</span></h3><p>${escape(item.description || item.note)}</p></div></li>`;
    }).join('')}</ol>`;
  }
  async function roster() {
    const data = await get('/teams/147/roster', {rosterType: '40Man', hydrate: 'person'});
    const players = data.roster || [];
    if (!players.length) { empty('offseason-roster', 'The current roster is not available yet.'); return; }
    el('roster-outlook-label').textContent = `${players.length} players listed · Current 40-man roster, including injured-list entries`;
    const groups = [['Catchers', 'catcher'], ['Infield & DH', 'infield'], ['Outfield', 'outfield'], ['Pitching', 'pitcher']];
    const groupFor = entry => {
      const pos = entry.position || entry.person?.primaryPosition || {};
      if (pos.type === 'Pitcher' || pos.abbreviation === 'P') return 'pitcher';
      if (pos.abbreviation === 'C') return 'catcher';
      if (pos.type === 'Outfielder' || ['OF', 'LF', 'CF', 'RF'].includes(pos.abbreviation)) return 'outfield';
      return 'infield';
    };
    el('offseason-roster').innerHTML = groups.map(([title, key]) => {
      const entries = players.filter(entry => groupFor(entry) === key).sort((a,b) => String(a.person?.fullName).localeCompare(String(b.person?.fullName)));
      return `<section class="offseason-roster-group"><h3>${title}<span>${entries.length}</span></h3>${entries.length ? `<ul>${entries.map(entry => {
        const id = Number(entry.person?.id);
        const name = escape(entry.person?.fullName || 'Player');
        const position = entry.position?.abbreviation || entry.person?.primaryPosition?.abbreviation || '';
        const status = entry.status?.description;
        const detail = [position, status && status !== 'Active' ? status : ''].filter(Boolean).join(' · ');
        return `<li>${Number.isInteger(id) && id > 0 ? `<a href="./player-profile/?player=${id}">${name}</a>` : name}<small>${escape(detail)}</small></li>`;
      }).join('')}</ul>` : '<p class="offseason-empty">No players listed.</p>'}</section>`;
    }).join('');
  }
  async function review() {
    el('season-review-label').textContent = `${season} regular season`;
    const [standings, stats] = await Promise.allSettled([
      get('/standings', {leagueId: 103, season, standingsTypes: 'regularSeason'}),
      get('/teams/147/stats', {stats: 'season', group: 'hitting,pitching', season, gameType: 'R', sportIds: 1}),
    ]);
    const record = standings.status === 'fulfilled' ? (standings.value.records || []).flatMap(item => item.teamRecords || []).find(item => item.team?.id === 147) : null;
    const blocks = stats.status === 'fulfilled' ? stats.value.stats || [] : [];
    const hitting = blocks.find(item => item.group?.displayName === 'hitting')?.splits?.[0]?.stat;
    const pitching = blocks.find(item => item.group?.displayName === 'pitching')?.splits?.[0]?.stat;
    if (!record && !hitting && !pitching) throw new Error('No season data');
    const totals = [['Runs', hitting?.runs], ['Home runs', hitting?.homeRuns], ['Team ERA', pitching?.era], ['Run differential', hitting?.runs != null && pitching?.runs != null ? `${hitting.runs - pitching.runs >= 0 ? '+' : ''}${hitting.runs - pitching.runs}` : null]];
    el('offseason-review').innerHTML = `${record ? `<div class="offseason-record">${escape(record.leagueRecord?.wins ?? record.wins)}–${escape(record.leagueRecord?.losses ?? record.losses)}</div><p class="offseason-record-label">Win–loss record${record.divisionRank ? ` · AL East rank ${escape(record.divisionRank)}` : ''}</p>` : '<p class="offseason-empty">Season record unavailable.</p>'}<dl class="offseason-stats">${totals.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(value ?? '—')}</dd></div>`).join('')}</dl>`;
    if (standings.status === 'rejected' || stats.status === 'rejected') throw new Error('Partial season data');
  }
  Promise.allSettled([
    moves().catch(error => {empty('offseason-moves', 'Transactions are unavailable right now. Please try again later.'); throw error;}),
    roster().catch(error => {empty('offseason-roster', 'Roster updates are unavailable right now. Please try again later.'); throw error;}),
    review().catch(error => {if (!el('offseason-review').querySelector('.offseason-stats')) empty('offseason-review', 'Season totals are unavailable right now. Please try again later.'); throw error;}),
  ]).then(results => {
    const stamp = new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZone:'America/New_York', timeZoneName:'short'}).format(new Date());
    el('offseason-updated').textContent = results.some(result => result.status === 'rejected') ? 'Some updates are unavailable. Refresh to try again.' : `Updated ${stamp}`;
  });
})();
