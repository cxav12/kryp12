(function(){
  const esc=value=>DiabloSite.escapeHtml(value);
  const familyBases=[40,120,200,0,240,280,80];
  const frameOffsets={blue:[36,37],green:[28,29],teal:[7,8],red:[12,13],gold:[1,2],orange:[23,24],brown:[5,5],purple:[17,18],neutral:[3,4],root:[3,4]};
  const preloadCache=new Map();
  function nodeAsset(planNumber,id,type,selected){const diamond=['teal','purple'].includes(type)&&id!=='r',shape=diamond?'diamond':'circle',frame=familyBases[planNumber-1]+frameOffsets[type][selected?0:1];return `/diablo/assets/game/warplans/war-plan-${planNumber}-${shape}-frame-${frame}.png`}
  function planAssets(plan){const planNumber=Number(plan.id.replace('plan-',''));return [...new Set(plan.nodes.map(([id,,,type,selected])=>nodeAsset(planNumber,id,type,selected)))]}
  function preloadAsset(url){if(!preloadCache.has(url)){preloadCache.set(url,new Promise(resolve=>{const image=new Image();image.onload=()=>{const decoded=image.decode?image.decode().catch(()=>{}):Promise.resolve();decoded.finally(resolve)};image.onerror=resolve;image.src=url}))}return preloadCache.get(url)}
  function preloadPlan(plan){return Promise.all(planAssets(plan).map(preloadAsset))}
  function sectionMarkup(data){return `<div class="war-plan-viewer" data-war-plan-viewer><div class="war-plan-tabs" role="tablist" aria-label="Whirlwind War Plans">${data.plans.map((plan,index)=>`<button type="button" role="tab" data-war-plan="${esc(plan.id)}" aria-selected="${index===0}" aria-label="${esc(plan.label)}"><img src="/diablo/assets/game/warplans/war-plan-${index+1}-tab.png" alt="" aria-hidden="true"></button>`).join('')}</div><div class="war-plan-heading"><h3 data-war-plan-title></h3><p>Red highlights and connections show the recommended allocation.</p></div><div class="war-plan-canvas" data-war-plan-canvas>${data.plans.map((plan,index)=>renderSvg(plan,index===0)).join('')}</div><div class="war-plan-key"><span class="is-selected">Recommended</span><span>Available branch</span></div></div>`}
  function renderSvg(plan,selected=false){
    const lookup=new Map(plan.nodes.map(node=>[node[0],node]));
    const edges=plan.edges.map(([fromId,toId,selected])=>{const from=lookup.get(fromId),to=lookup.get(toId);return `<line class="war-plan-edge${selected?' selected':''}" x1="${from[1]*5}" y1="${from[2]*4.5}" x2="${to[1]*5}" y2="${to[2]*4.5}"/>`}).join('');
    const planNumber=Number(plan.id.replace('plan-',''));
    const nodes=plan.nodes.map(([id,x,y,type,selected])=>{const px=x*5,py=y*4.5,root=type==='root',size=root?58:50;return `<g class="war-plan-node ${esc(type)}${selected?' selected':''}" transform="translate(${px} ${py})"><image href="${nodeAsset(planNumber,id,type,selected)}" x="${-size/2}" y="${-size/2}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/><title>${selected?'Recommended ':'Available '}${type} node</title></g>`}).join('');
    return `<svg class="war-plan-diagram${selected?' is-active':''}" data-war-plan-diagram="${esc(plan.id)}" viewBox="0 0 500 470" role="img" aria-hidden="${!selected}" aria-label="${esc(plan.label)} recommended allocation">${edges}${nodes}</svg>`;
  }
  function mount(host,data){
    if(!host)return;
    const title=host.querySelector('[data-war-plan-title]');
    const render=plan=>{title.textContent=plan.label;host.querySelectorAll('[data-war-plan-diagram]').forEach(diagram=>{const active=diagram.dataset.warPlanDiagram===plan.id;diagram.classList.toggle('is-active',active);diagram.setAttribute('aria-hidden',String(!active))});host.querySelectorAll('[data-war-plan]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.warPlan===plan.id)))};
    let requestedPlan=data.plans[0].id;
    host.querySelectorAll('[data-war-plan]').forEach(button=>button.addEventListener('click',async()=>{const plan=data.plans.find(item=>item.id===button.dataset.warPlan);if(!plan||plan.id===requestedPlan)return;requestedPlan=plan.id;host.classList.add('is-loading-plan');await preloadPlan(plan);if(requestedPlan!==plan.id)return;render(plan);host.classList.remove('is-loading-plan')}));
    render(data.plans[0]);
    const warmCache=()=>data.plans.forEach(preloadPlan);
    if('requestIdleCallback'in window)requestIdleCallback(warmCache,{timeout:1000});else setTimeout(warmCache,0);
  }
  window.WarPlansUI={sectionMarkup,mount};
})();
