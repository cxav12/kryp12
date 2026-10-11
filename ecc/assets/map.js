(() => {
  const viewport = document.querySelector('#map-viewport');
  if (!viewport) return;
  const svg = viewport.querySelector('svg');
  const sections = JSON.parse(document.querySelector('#station-map-data').textContent);
  const byNumber = new Map(sections.map(s => [s.heading.split(' ')[1], s]));
  const battalion = document.querySelector('#map-battalion');
  const stationSelect = document.querySelector('#map-station');
  let scale = 1, x = 0, y = 0;
  const draw = () => {
    const w = 900 / scale, h = 760 / scale;
    x = Math.max(0, Math.min(900 - w, x)); y = Math.max(0, Math.min(760 - h, y));
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    document.querySelector('#map-in').disabled = scale >= 5;
    document.querySelector('#map-out').disabled = scale <= 1;
  };
  function zoom(factor) {
    const next = Math.max(1, Math.min(5, scale * factor));
    x += 450 / scale - 450 / next; y += 380 / scale - 380 / next;
    scale = next; draw();
  }
  document.querySelector('#map-in').addEventListener('click', () => zoom(1.5));
  document.querySelector('#map-out').addEventListener('click', () => zoom(1 / 1.5));
  document.querySelector('#map-reset').addEventListener('click', () => { scale = 1; x = y = 0; draw(); });
  const panel = viewport.closest('section');
  const expand = document.querySelector('#map-full');
  function toggleExpanded() {
    const expanded = panel.classList.toggle('map-expanded');
    expand.textContent = expanded ? 'Close' : 'Expand';
    expand.setAttribute('aria-label', expanded ? 'Close expanded map' : 'Expand map');
    document.body.classList.toggle('map-open', expanded);
  }
  expand.addEventListener('click', toggleExpanded);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && panel.classList.contains('map-expanded')) toggleExpanded(); });
  function selectStation(number) {
    const station = byNumber.get(String(number)); if (!station) return;
    if (battalion.value && battalion.value !== station.battalion) { battalion.value = ''; filter(); }
    stationSelect.value = number;
    svg.querySelectorAll('.station-marker').forEach(marker => marker.classList.toggle('selected', marker.dataset.station === String(number)));
    const box = document.querySelector('#map-selection'); box.replaceChildren();
    const title = document.createElement('strong'); title.textContent = station.heading;
    const community = document.createElement('span'); community.textContent = station.items.find(i => i.label === 'Community').text;
    box.append(title, community);
    if (!svg.querySelector(`[data-station="${number}"]`)) {
      const note = document.createElement('span'); note.textContent = 'Location not shown on the supplied map.'; box.append(note);
    }
  }
  svg.querySelectorAll('.station-marker').forEach(marker => {
    marker.addEventListener('click', () => { if (!dragged) selectStation(marker.dataset.station); });
    marker.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectStation(marker.dataset.station); } });
  });
  stationSelect.addEventListener('change', () => selectStation(stationSelect.value));
  function filter() {
    const value = battalion.value;
    svg.querySelectorAll('[data-battalion]').forEach(item => {
      const dim = value && item.dataset.battalion !== value;
      item.classList.toggle('map-dim', Boolean(dim));
      if (item.classList.contains('station-marker')) item.setAttribute('tabindex', dim ? '-1' : '0');
    });
    stationSelect.querySelectorAll('[data-battalion]').forEach(option => option.hidden = Boolean(value && option.dataset.battalion !== value));
    stationSelect.value = '';
    svg.querySelectorAll('.selected').forEach(marker => marker.classList.remove('selected'));
    const box = document.querySelector('#map-selection'); box.replaceChildren();
    const title = document.createElement('strong'); title.textContent = value || 'Select a station';
    const text = document.createElement('span');
    text.textContent = value ? `${sections.filter(s => s.battalion === value).length} stations · Tap a marker or choose below.` : 'Tap a marker or choose a station below.';
    box.append(title, text);
  }
  battalion.addEventListener('change', filter);
  let dragged = false, previous = null;
  const pointers = new Map();
  const gesture = () => {
    const points = [...pointers.values()];
    return {cx: points.reduce((n,p) => n+p.x,0)/points.length, cy: points.reduce((n,p) => n+p.y,0)/points.length, distance: points.length > 1 ? Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y) : 0};
  };
  viewport.addEventListener('pointerdown', event => {
    pointers.set(event.pointerId, {x:event.clientX,y:event.clientY}); previous = gesture(); dragged = false;
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); const next = gesture();
    if (Math.abs(next.cx-previous.cx)+Math.abs(next.cy-previous.cy)>2 || next.distance !== previous.distance) dragged = true;
    if (dragged) {
      viewport.setPointerCapture(event.pointerId);
      if (previous.distance && next.distance) zoom(next.distance / previous.distance);
      const rect = viewport.getBoundingClientRect();
      const ratio = Math.min(rect.width/900, rect.height/760)*scale;
      x -= (next.cx-previous.cx)/ratio; y -= (next.cy-previous.cy)/ratio; draw();
    }
    previous = next;
  });
  const release = event => { pointers.delete(event.pointerId); previous = pointers.size ? gesture() : null; };
  viewport.addEventListener('pointerup', release); viewport.addEventListener('pointercancel', release);
  draw();
})();
