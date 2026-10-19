(() => {
  'use strict';
  const API = 'https://statsapi.mlb.com/api/v1';
  const now = new Date();
  const year = Number(new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric'}).format(now));
  const month = Number(new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', month: 'numeric'}).format(now));
  const season = Number(document.getElementById('home-view')?.dataset.reviewSeason) || (month < 3 ? year - 1 : year);
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
  async function importantDates() {
    const nextSeason = season + 1;
    const data = await get('/schedule', {sportId: 1, teamId: 147, season: nextSeason, gameTypes: 'S,R'});
    const games = (data.dates || []).flatMap(day => day.games || []).filter(game =>
      game.officialDate && !/cancel|postpon/i.test(game.status?.detailedState || '')).sort((a,b) => a.officialDate.localeCompare(b.officialDate));
    const entries = [
      ['Spring opener', games.find(game => game.gameType === 'S')],
      ['Opening Day', games.find(game => game.gameType === 'R')],
      ['Home opener', games.find(game => game.gameType === 'R' && game.teams?.home?.team?.id === 147)],
    ];
    el('offseason-dates').innerHTML = entries.filter(([, game]) => !game || game.officialDate >= today).map(([title, game]) => {
      const opponent = game ? (game.teams?.home?.team?.id === 147 ? game.teams?.away?.team : game.teams?.home?.team) : null;
      const date = game?.officialDate;
      return `<article class="offseason-date"><h3>${title}</h3>${date ? `<time datetime="${escape(date)}">${escape(niceDate(date))}, ${nextSeason}</time>` : '<strong>To be announced</strong>'}<p>${game ? `${game.teams?.home?.team?.id === 147 ? 'vs' : 'at'} ${escape(opponent?.name || 'Opponent TBD')}` : 'Awaiting the official schedule'}</p></article>`;
    }).join('');
  }
  async function news() {
    const response = await fetch('./api/news.php', {signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('News unavailable');
    const data = await response.json();
    const safe = (data.items || []).filter(item => {
      try { const url = new URL(item.url); return url.protocol === 'https:' && ['www.mlb.com', 'mlb.com'].includes(url.hostname); } catch {return false;}
    }).slice(0,4);
    if (!safe.length) {empty('offseason-news', 'No headlines are available right now.'); return;}
    el('offseason-news').innerHTML = `<ul class="offseason-news-list">${safe.map(item => `<li><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.title)} <span aria-hidden="true">↗</span></a><span class="offseason-news-date">MLB.com${item.date ? ` · ${escape(niceDate(item.date))}` : ''}</span></li>`).join('')}</ul>`;
    el('news-source').textContent = data.stale ? 'MLB.com · Latest saved headlines' : 'MLB.com';
  }
  async function prospectSpotlight() {
    const response = await fetch('./team-overview/', {signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Prospect list unavailable');
    const documentSource = new DOMParser().parseFromString(await response.text(), 'text/html');
    const candidates = [...documentSource.querySelectorAll('.prospect-card')].map(card => ({
      id: Number(new URL(card.getAttribute('href'), new URL('./team-overview/', location.href)).searchParams.get('player')),
      name: card.querySelector('.prospect-name')?.textContent.trim(),
      position: card.querySelector('[data-label="Position"]')?.textContent.trim() || '',
      level: card.querySelector('[data-label="Level"]')?.textContent.trim() || '',
      eta: card.querySelector('[data-label="ETA"]')?.textContent.trim() || '',
    })).filter(player => player.id > 0 && player.name && player.level !== 'MLB');
    if (!candidates.length) {empty('offseason-prospect', 'No minor-league prospects are listed right now.'); return;}
    let index = Math.floor(Date.parse(`${today}T12:00:00Z`) / 86400000) % candidates.length;
    let request = 0;
    async function show() {
      const token = ++request;
      const player = candidates[index];
      const pitcher = /HP|^P$/.test(player.position);
      el('offseason-prospect').innerHTML = `<div class="offseason-prospect-person"><img src="https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${player.id}/headshot/silo/current" alt="" width="90" height="90" loading="lazy"><div><h3><a href="./player-profile/?player=${player.id}">${escape(player.name)}</a></h3><p>${escape([player.position, player.level, player.eta ? `ETA ${player.eta}` : ''].filter(Boolean).join(' · '))}</p></div></div><div id="prospect-performance"><p class="offseason-empty">Loading minor-league stats…</p></div>`;
      el('offseason-prospect').querySelector('img').addEventListener('error', event => {event.target.hidden = true;});
      const button = el('next-prospect');
      button.hidden = candidates.length < 2;
      button.disabled = true;
      try {
        const data = await get(`/people/${player.id}/stats`, {stats: 'yearByYear', group: pitcher ? 'pitching' : 'hitting', leagueListId: 'milb_all'});
        if (token !== request) return;
        const splits = (data.stats || []).flatMap(block => block.splits || []).filter(split => Number(split.season) === season && split.stat);
        const split = splits.find(item => item.sport?.id === 21 && !item.team)
          || splits.find(item => !item.team) || splits.sort((a,b) => Number(b.stat.gamesPlayed || 0) - Number(a.stat.gamesPlayed || 0))[0];
        if (!split) {empty('prospect-performance', `${season} minor-league stats are not available.`); return;}
        const stats = split.stat;
        const values = pitcher ? [['ERA',stats.era],['IP',stats.inningsPitched],['K',stats.strikeOuts],['WHIP',stats.whip]] : [['AVG',stats.avg],['HR',stats.homeRuns],['RBI',stats.rbi],['OPS',stats.ops]];
        el('prospect-performance').innerHTML = `<p class="offseason-prospect-season">${season} · ${escape(split.team?.name || 'Minor-league totals')}</p><dl class="offseason-stats">${values.map(([label,value]) => `<div><dt>${label}</dt><dd>${escape(value ?? '—')}</dd></div>`).join('')}</dl>`;
      } catch {
        if (token === request) empty('prospect-performance', 'Minor-league stats are unavailable right now.');
      } finally {
        if (token === request) button.disabled = false;
      }
    }
    el('next-prospect').addEventListener('click', () => {index = (index + 1) % candidates.length; show();});
    await show();
  }

  Promise.allSettled([
    importantDates().catch(error => {empty('offseason-dates', 'Schedule dates are unavailable right now.'); throw error;}),
    news().catch(error => {empty('offseason-news', 'Headlines are unavailable right now. Use All news for the latest Yankees coverage.'); throw error;}),
    prospectSpotlight().catch(error => {empty('offseason-prospect', 'The prospect spotlight is unavailable right now.'); throw error;}),
    moves().catch(error => {empty('offseason-moves', 'Transactions are unavailable right now. Please try again later.'); throw error;}),
    roster().catch(error => {empty('offseason-roster', 'Roster updates are unavailable right now. Please try again later.'); throw error;}),
    review().catch(error => {if (!el('offseason-review').querySelector('.offseason-stats')) empty('offseason-review', 'Season totals are unavailable right now. Please try again later.'); throw error;}),
  ]).then(results => {
    const stamp = new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZone:'America/New_York', timeZoneName:'short'}).format(new Date());
    el('offseason-updated').textContent = results.some(result => result.status === 'rejected') ? 'Some updates are unavailable. Refresh to try again.' : `Updated ${stamp}`;
  });
})();
