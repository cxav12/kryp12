(function(){
  const esc=value=>DiabloSite.escapeHtml(value);
  const size=600,pad=38,step=26,center=size/2;
  const selectorMarkup=board=>`<button class="paragon-selector" type="button" role="tab" data-board-slug="${esc(board.slug)}" aria-selected="false"><span class="paragon-glyph-icon">${DiabloSite.assetMarkup(board.glyphAssetId,{alt:''})}</span><strong>${esc(board.glyph)}</strong><small>${esc(board.name)}</small></button>`;
  const controlsMarkup=expand=>`<div class="paragon-controls"><button type="button" data-paragon-reset aria-label="Reset Paragon board view" title="Reset view">↺</button>${expand?'<button type="button" data-paragon-expand aria-label="Expand Paragon board" title="Expand board">⛶</button>':''}</div>`;
  function sectionMarkup(data,variantLabel='',isReference=false){return `<div class="paragon-board-section" data-paragon-section>${isReference?`<p class="paragon-reference-note"><strong>Uniques allocation shown as a reference.</strong> The exact ${esc(variantLabel)} allocation has not been captured yet.</p>`:''}<div class="paragon-selectors" role="tablist" aria-label="Paragon boards">${data.boards.map(selectorMarkup).join('')}</div><div class="paragon-heading"><div><h3 data-paragon-name></h3><p><span data-paragon-glyph></span> <span aria-hidden="true">•</span> Level <span data-paragon-level></span> <span aria-hidden="true">•</span> <span data-paragon-count></span> allocated nodes</p></div>${controlsMarkup(true)}</div><div class="paragon-viewport" data-paragon-viewport></div><div class="paragon-legend" aria-label="Paragon node legend"><span data-node="normal">Normal</span><span data-node="magic">Magic</span><span data-node="rare">Rare</span><span data-node="legendary">Legendary</span><span data-node="socket">Glyph socket</span><span class="selected">Allocated path</span></div><dialog class="paragon-modal" data-paragon-modal aria-labelledby="expanded-paragon-title"><div class="paragon-modal-header"><div><h3 id="expanded-paragon-title" data-expanded-name></h3><p><span data-expanded-glyph></span> <span aria-hidden="true">•</span> Level <span data-expanded-level></span></p></div><div class="paragon-modal-actions">${controlsMarkup(false)}<button type="button" data-paragon-close aria-label="Close expanded Paragon board">×</button></div></div><div class="paragon-viewport paragon-viewport-expanded" data-expanded-viewport></div></dialog></div>`}
  function connections(board){
    const lookup=new Map(board.nodes.map(node=>[node.id,node]));
    return (board.edges||[]).map(edge=>{const from=lookup.get(edge.from),to=lookup.get(edge.to);return from&&to?`<line class="paragon-edge${edge.selected?' selected':''}" x1="${pad+from.x*step}" y1="${pad+from.y*step}" x2="${pad+to.x*step}" y2="${pad+to.y*step}"/>`:''}).join('');
  }
  function nodeMarkup(node){
    const x=pad+node.x*step,y=pad+node.y*step,label=`${node.type} node${node.selected?', selected':''}`;
    if(node.type==='gate')return `<rect class="paragon-node gate${node.selected?' selected':''}" x="${x-6}" y="${y-6}" width="12" height="12"><title>${label}</title></rect>`;
    if(node.type==='legendary')return `<rect class="paragon-node legendary${node.selected?' selected':''}" x="${x-7}" y="${y-7}" width="14" height="14" transform="rotate(45 ${x} ${y})"><title>${label}</title></rect>`;
    return `<circle class="paragon-node ${node.type}${node.selected?' selected':''}" cx="${x}" cy="${y}" r="${node.type==='socket'?8:node.type==='rare'?6:node.type==='magic'?5:4}"><title>${label}</title></circle>`;
  }
  function svgMarkup(board){return `<svg class="paragon-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(board.name)} Paragon allocation, rotated ${board.rotation} degrees"><g data-board-stage><g transform="rotate(${board.rotation} ${center} ${center})">${connections(board)}${board.nodes.map(nodeMarkup).join('')}</g></g></svg>`}
  function attachViewport(viewport,board){
    viewport.innerHTML=svgMarkup(board);
    const svg=viewport.querySelector('svg'),stage=svg.querySelector('[data-board-stage]');
    let scale=1,panX=0,panY=0,drag=null;
    const apply=()=>stage.setAttribute('transform',`translate(${panX} ${panY}) scale(${scale})`);
    viewport._reset=()=>{scale=1;panX=0;panY=0;apply()};
    svg.addEventListener('wheel',event=>{event.preventDefault();const next=Math.min(2.8,Math.max(.7,scale*(event.deltaY<0?1.12:.89))),rect=svg.getBoundingClientRect(),x=(event.clientX-rect.left)*size/rect.width,y=(event.clientY-rect.top)*size/rect.height;panX=x-(x-panX)*next/scale;panY=y-(y-panY)*next/scale;scale=next;apply()},{passive:false});
    svg.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,panX,panY};svg.setPointerCapture(event.pointerId);svg.classList.add('is-dragging')});
    svg.addEventListener('pointermove',event=>{if(!drag)return;const ratio=size/svg.getBoundingClientRect().width;panX=drag.panX+(event.clientX-drag.x)*ratio;panY=drag.panY+(event.clientY-drag.y)*ratio;apply()});
    const stop=()=>{drag=null;svg.classList.remove('is-dragging')};svg.addEventListener('pointerup',stop);svg.addEventListener('pointercancel',stop);
  }
  function mount(section,data){
    if(!section)return;
    const modal=section.querySelector('[data-paragon-modal]'),normal=section.querySelector('[data-paragon-viewport]'),expanded=section.querySelector('[data-expanded-viewport]');
    let current=data.boards[0];
    const renderBoard=board=>{current=board;section.querySelectorAll('[data-board-slug]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.boardSlug===board.slug)));section.querySelector('[data-paragon-name]').textContent=board.name;section.querySelector('[data-paragon-glyph]').textContent=board.glyph;section.querySelector('[data-paragon-level]').textContent=board.glyphLevel;section.querySelector('[data-paragon-count]').textContent=board.selectedNodeCount;attachViewport(normal,board);if(modal.open){section.querySelector('[data-expanded-name]').textContent=board.name;section.querySelector('[data-expanded-glyph]').textContent=board.glyph;section.querySelector('[data-expanded-level]').textContent=board.glyphLevel;attachViewport(expanded,board)}};
    section.querySelectorAll('[data-board-slug]').forEach(button=>button.addEventListener('click',()=>renderBoard(data.boards.find(board=>board.slug===button.dataset.boardSlug))));
    section.querySelector('[data-paragon-expand]').addEventListener('click',()=>{section.querySelector('[data-expanded-name]').textContent=current.name;section.querySelector('[data-expanded-glyph]').textContent=current.glyph;section.querySelector('[data-expanded-level]').textContent=current.glyphLevel;attachViewport(expanded,current);modal.showModal()});
    section.querySelector('[data-paragon-close]').addEventListener('click',()=>modal.close());
    modal.addEventListener('click',event=>{if(event.target===modal)modal.close()});
    section.querySelectorAll('[data-paragon-reset]').forEach((button,index)=>button.addEventListener('click',()=>index?expanded._reset?.():normal._reset?.()));
    renderBoard(current);
  }
  window.ParagonBoardUI={sectionMarkup,mount};
})();
