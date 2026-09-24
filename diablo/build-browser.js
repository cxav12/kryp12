(async function(){
  const grid=document.querySelector('#build-grid');
  let data;
  try{[data]=await Promise.all([DiabloSite.loadJson('data/builds.json'),DiabloSite.loadAssets()])}catch(error){grid.innerHTML=`<p class="empty-state">${error.message}</p>`;return}
  const builds=data.builds;
  grid.innerHTML=builds.length?builds.map(b=>`<a class="build-card" href="${b.route}"><div class="build-card-heading"><span class="class-mark" aria-hidden="true">${DiabloSite.assetMarkup(b.classAssetId,{alt:''})}</span><div><h3>${b.name}</h3><p class="meta">${b.class} · ${b.patchLabel}</p></div></div></a>`).join(''):'<p class="empty-state">No local builds are available yet.</p>';
})();
