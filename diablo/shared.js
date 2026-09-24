(function(){
  const root='/diablo/';
  const page=location.pathname;
  const links=[['Builds',root],['Events',root+'events/'],['Affix Categories',root+'affix-categories/'],['Runeword Uniques',root+'runeword-uniques/']];
  const current=page.includes('/events/')?'Events':page.includes('/affix-categories/')?'Affix Categories':page.includes('/runeword-uniques/')?'Runeword Uniques':'Builds';
  const cacheKey='diablo-event-state-v1';
  let assetManifestPromise,assetManifest;
  document.querySelectorAll('[data-site-header]').forEach(header=>{
    header.innerHTML=`<div class="nav-shell"><a class="brand" href="${root}" aria-label="Diablo IV home">DIABLO <span>IV</span></a><nav class="main-nav" aria-label="Primary">${links.map(([label,url])=>`<a href="${url}"${current===label?' aria-current="page"':''}>${label}</a>`).join('')}</nav><div class="event-chips"><a class="boss-chip" href="${root}events/" aria-label="World Boss event status"><span class="boss-dot"></span><span class="boss-label">World Boss</span><span class="boss-value" data-boss-status>Loading…</span></a><a class="boss-chip helltide-chip" href="${root}events/" aria-label="Helltide event status"><span class="boss-dot"></span><span class="boss-label" data-helltide-label>Helltide</span><span class="boss-value" data-helltide-status>Loading…</span></a></div></div>`;
  });
  async function loadJson(path){const response=await fetch(root+path,{cache:'no-store'});if(!response.ok)throw new Error(`Unable to load ${path}`);return response.json()}
  async function loadAssets(){assetManifestPromise||=(loadJson('data/assets.json').then(data=>(assetManifest=data)));return assetManifestPromise}
  function getAsset(kindOrId,id){if(!assetManifest)throw new Error('Asset manifest must be loaded before resolving assets');const key=id===undefined?kindOrId:`${kindOrId}:${id}`;return assetManifest.assets[key]||assetManifest.assets[assetManifest.fallbackAssetId]}
  function assetMarkup(kindOrId,idOrOptions,maybeOptions){const hasSeparateId=typeof idOrOptions==='string',asset=getAsset(kindOrId,hasSeparateId?idOrOptions:undefined),options=(hasSeparateId?maybeOptions:idOrOptions)||{},alt=options.alt??'',className=options.className?` ${escapeHtml(options.className)}`:'',hasDisplayOverride=asset.status==='missing'&&Boolean(asset.image),fallbackImage=asset.kind==='aspect'?getAsset('ui:aspect-fallback').image:getAsset(assetManifest.fallbackAssetId).image;return `<img class="diablo-asset${className}" src="${escapeHtml(asset.image||fallbackImage)}" alt="${escapeHtml(alt)}" loading="${options.eager?'eager':'lazy'}" decoding="async" data-asset-id="${escapeHtml(asset.id)}"${asset.kind==='aspect'?` data-fallback-src="${escapeHtml(fallbackImage)}"`:''}${asset.status==='missing'&&!hasDisplayOverride?' data-asset-missing="true"':''}${hasDisplayOverride?' data-display-override="true"':''}>`}
  document.addEventListener('error',event=>{const image=event.target;if(!(image instanceof HTMLImageElement)||!image.matches('.diablo-asset[data-fallback-src]'))return;const fallback=image.dataset.fallbackSrc;image.removeAttribute('data-fallback-src');image.src=fallback},true);
  async function eventState(){
    try{
      const [config,module]=await Promise.all([loadJson('data/event-schedule.json'),import(root+'data/event-adapter.js')]);
      const state=await new module.ProjectedScheduleAdapter(config).fetchState();
      if(!module.validateEventState(state))throw new Error('Invalid normalized event state');
      try{localStorage.setItem(cacheKey,JSON.stringify(state))}catch{}
      return state;
    }catch(error){
      try{const cached=JSON.parse(localStorage.getItem(cacheKey));if(cached?.worldBoss)return {...cached,freshness:'stale',error:error.message}}catch{}
      try{return {...await loadJson('data/events-fallback.json'),error:error.message}}catch{return{schemaVersion:1,freshness:'unavailable',worldBoss:null,helltide:null,upcoming:[],lastSuccessfulUpdate:null,error:error.message}}
    }
  }
  function formatLocal(iso,options={dateStyle:'medium',timeStyle:'short'}){if(!iso)return 'Unavailable';return new Intl.DateTimeFormat(undefined,options).format(new Date(iso))}
  function duration(target,now=new Date()){
    const seconds=Math.max(0,Math.floor((new Date(target)-now)/1000));
    const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60),remainder=seconds%60;
    return hours?`${hours}h ${String(minutes).padStart(2,'0')}m ${String(remainder).padStart(2,'0')}s`:`${minutes}m ${String(remainder).padStart(2,'0')}s`;
  }
  function startHeaderTimer(state){
    let interval;
    const update=()=>{
      let boundaryReached=false;
      document.querySelectorAll('[data-boss-status]').forEach(el=>{
        if(!state.worldBoss){el.textContent='Schedule unavailable';return}
        const target=state.worldBoss.active?state.worldBoss.end:state.worldBoss.start;
        if(new Date(target)<=new Date()){boundaryReached=true;return}
        el.textContent=`${state.worldBoss.active?'Active':'In'} ${duration(target)}`;
      });
      document.querySelectorAll('[data-helltide-status]').forEach(el=>{
        const label=el.closest('.helltide-chip')?.querySelector('[data-helltide-label]');
        if(!state.helltide){el.textContent='Schedule unavailable';if(label)label.textContent='Helltide';return}
        const target=state.helltide.active?state.helltide.end:state.helltide.start;
        if(label)label.textContent=`Helltide ${state.helltide.active?'Active':'Inactive'}`;
        if(new Date(target)<=new Date()){boundaryReached=true;return}
        el.textContent=`${state.helltide.active?'Ends':'Starts'} in ${duration(target)}`;
      });
      if(boundaryReached){clearInterval(interval);setTimeout(()=>eventState().then(startHeaderTimer),250)}
    };
    interval=setInterval(update,1000);update();return interval;
  }
  eventState().then(startHeaderTimer);
  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  window.DiabloSite={root,loadJson,loadAssets,getAsset,assetMarkup,eventState,formatLocal,duration,escapeHtml};
})();
