(async function(){
  const host=document.querySelector('#event-state');
  await DiabloSite.loadAssets();
  const state=await DiabloSite.eventState();
  const esc=DiabloSite.escapeHtml;
  const types=['world-boss','helltide','legion'];
  const labels={'world-boss':'World Boss',helltide:'Helltide',legion:'Legion'};
  let enabled=new Set(types);

  const timer=(event)=>{
    if(!event)return '<p class="empty-state">Schedule unavailable</p>';
    const target=event.active?event.end:event.start;
    return `<p class="event-countdown" data-countdown="${esc(target)}">${DiabloSite.duration(target)}</p><p class="event-state-label">${event.active?'Active now · ends':'Next start'} ${esc(DiabloSite.formatLocal(target))}</p>`;
  };

  host.innerHTML=`
    <div class="section-heading"><div><p class="eyebrow">Projected schedule</p><h2>Sanctuary status</h2></div><span class="status-pill" data-freshness="${esc(state.freshness)}">${state.projection?'Projected':esc(state.freshness)}</span></div>
    <div class="event-grid event-feature-grid">
      <article class="event-card event-card-featured"><div class="event-card-title"><span class="event-feature-icon" data-event-icon="world-boss" aria-hidden="true">♛</span><div><p class="eyebrow">World Boss</p><h3>${esc(state.worldBoss?.name||'Next World Boss')}</h3></div></div>${timer(state.worldBoss)}<p class="event-detail">${state.worldBoss?.location?esc(state.worldBoss.location):'Boss and location appear on the in-game map when announced.'}</p></article>
      <article class="event-card event-card-featured"><div class="event-card-title"><span class="event-feature-icon" data-event-icon="helltide" aria-hidden="true">♨</span><div><p class="eyebrow">Helltide</p><h3>${state.helltide?.active?'Active':'Inactive'}</h3></div></div>${timer(state.helltide)}<p class="event-detail">Runs for approximately 55 minutes at the top of each hour.</p></article>
    </div>
    <div class="upcoming-header"><div><p class="eyebrow">Next 7 hours</p><h2>Upcoming events</h2></div><div class="event-filters" aria-label="Event filters">${types.map(type=>`<button type="button" class="filter-button" data-event-filter="${type}" aria-pressed="true">${labels[type]}</button>`).join('')}</div></div>
    <div class="upcoming-list" data-upcoming></div>`;

  const renderUpcoming=()=>{
    const list=host.querySelector('[data-upcoming]');
    const events=state.upcoming.filter(event=>enabled.has(event.type));
    list.innerHTML=events.length?events.map(event=>`<article class="upcoming-event"><span class="event-type-mark" data-event-type="${esc(event.type)}">${esc(labels[event.type]||event.label)}</span><div><strong>${esc(event.label)}</strong><span>${esc(DiabloSite.formatLocal(event.start,{weekday:'short',hour:'numeric',minute:'2-digit'}))}</span></div><span class="upcoming-countdown" data-countdown="${esc(event.start)}">${DiabloSite.duration(event.start)}</span></article>`).join(''):'<p class="empty-state">No events match the selected filters.</p>';
  };
  host.querySelectorAll('[data-event-filter]').forEach(button=>button.addEventListener('click',()=>{
    const type=button.dataset.eventFilter;
    enabled.has(type)?enabled.delete(type):enabled.add(type);
    button.setAttribute('aria-pressed',String(enabled.has(type)));
    renderUpcoming();
  }));
  renderUpcoming();
  const updateCountdowns=()=>host.querySelectorAll('[data-countdown]').forEach(el=>{el.textContent=DiabloSite.duration(el.dataset.countdown)});
  updateCountdowns();setInterval(updateCountdowns,1000);
  const nextBoundary=[state.worldBoss?.active?state.worldBoss.end:state.worldBoss?.start,state.helltide?.active?state.helltide.end:state.helltide?.start].filter(Boolean).map(value=>new Date(value)-new Date()).filter(value=>value>0).sort((a,b)=>a-b)[0];
  if(nextBoundary)setTimeout(()=>location.reload(),Math.min(nextBoundary+1000,2147483647));
})();
