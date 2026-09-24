import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const library=process.argv[2]||'C:\\Gaming\\Diablo IV Exports\\Organized Assets';
const d4data=path.join(library,'mapping-work','d4data','json','base','meta');
const configPath=path.join(root,'data','paragon','whirlwind-variant-6.json');
const outputPath=path.join(root,'data','paragon','whirlwind-board-geometry.json');
const config=JSON.parse(await fs.readFile(configPath,'utf8'));

const definitions={
  'barbarian-starter-board':{name:'Starter Board',file:'Paragon_Barb_00.pbd.json'},
  'barbarian-warbringer':{name:'Warbringer',file:'Paragon_Barb_07.pbd.json'},
  'barbarian-blood-rage':{name:'Blood Rage',file:'Paragon_Barb_02.pbd.json'},
  'barbarian-carnage':{name:'Carnage',file:'Paragon_Barb_03.pbd.json'},
  'barbarian-flawless-technique':{name:'Flawless Technique',file:'Paragon_Barb_06.pbd.json'}
};
const glyphNames={
  'barbarian-challenger':'Challenger','barbarian-wrath':'Wrath','barbarian-twister':'Twister',
  'barbarian-marshal':'Marshal','barbarian-exploit':'Exploit'
};

const selectedByBoard=new Map();
for(const entry of config.nodes){
  const match=entry.slug.match(/^(barbarian-(?:starter-board|warbringer|blood-rage|carnage|flawless-technique))-x(\d+)-y(\d+)$/);
  if(!match)continue;
  const list=selectedByBoard.get(match[1])||[];
  // Mobalytics coordinates are one-based relative to d4data's 21x21 arrays.
  list.push({id:entry.slug,x:Number(match[2])-1,y:Number(match[3])-1});
  selectedByBoard.set(match[1],list);
}

const nodeCache=new Map();
async function nodeDefinition(name){
  if(!nodeCache.has(name))nodeCache.set(name,JSON.parse(await fs.readFile(path.join(d4data,'ParagonNode',`${name}.pgn.json`),'utf8')));
  return nodeCache.get(name);
}
function nodeType(name,definition){
  if(definition.bHasSocket)return 'socket';
  if(definition.bIsGate)return 'gate';
  if(name.startsWith('StartNode'))return 'start';
  return ({2:'magic',3:'rare',4:'legendary'})[definition.eRarityOverride]||'normal';
}
function boardEdges(nodes){
  const lookup=new Map(nodes.map(node=>[`${node.x},${node.y}`,node]));
  const directions=[[1,0],[0,1],[1,1],[-1,1]],edges=[];
  for(const node of nodes)for(const [dx,dy] of directions){
    for(let distance=1;distance<=2;distance++){
      const next=lookup.get(`${node.x+dx*distance},${node.y+dy*distance}`);
      if(!next)continue;
      edges.push({from:node.id,to:next.id,distance,selected:false});
      break;
    }
  }
  return edges;
}
function markSelectedPath(nodes,edges){
  const selectedNodes=nodes.filter(node=>node.selected),selectedIds=new Set(selectedNodes.map(node=>node.id));
  const parent=new Map(selectedNodes.map(node=>[node.id,node.id]));
  const find=id=>{while(parent.get(id)!==id){parent.set(id,parent.get(parent.get(id)));id=parent.get(id)}return id};
  for(const edge of edges.filter(edge=>selectedIds.has(edge.from)&&selectedIds.has(edge.to)).sort((a,b)=>a.distance-b.distance||a.from.localeCompare(b.from)||a.to.localeCompare(b.to))){
    const fromRoot=find(edge.from),toRoot=find(edge.to);
    if(fromRoot===toRoot)continue;
    parent.set(fromRoot,toRoot);
    edge.selected=true;
  }
}

const boards=[];
for(const source of config.boards){
  const slug=source.board.slug,meta=definitions[slug];
  if(!meta)throw new Error(`No local board definition mapping for ${slug}`);
  const board=JSON.parse(await fs.readFile(path.join(d4data,'ParagonBoard',meta.file),'utf8'));
  const allocations=selectedByBoard.get(slug)||[];
  const selected=new Map(allocations.map(node=>[`${node.x},${node.y}`,node]));
  const nodes=[];
  for(let index=0;index<board.arEntries.length;index++){
    const entry=board.arEntries[index];
    if(!entry)continue;
    const x=index%board.nWidth,y=Math.floor(index/board.nWidth),definition=await nodeDefinition(entry.name),allocation=selected.get(`${x},${y}`);
    const type=nodeType(entry.name,definition);
    nodes.push({id:allocation?.id||`${slug}-local-x${x}-y${y}`,x,y,type,selected:Boolean(allocation)||type==='socket',glyphAssigned:type==='socket',internalName:entry.name});
  }
  const matched=new Set(nodes.filter(node=>selected.has(`${node.x},${node.y}`)).map(node=>node.id));
  if(matched.size!==allocations.length)throw new Error(`${meta.name}: matched ${matched.size} of ${allocations.length} Mobalytics allocations`);
  const edges=boardEdges(nodes);markSelectedPath(nodes,edges);
  const selectedEdges=edges.filter(edge=>edge.selected),adjacency=new Map(nodes.filter(node=>node.selected).map(node=>[node.id,[]]));
  for(const edge of selectedEdges){adjacency.get(edge.from)?.push(edge.to);adjacency.get(edge.to)?.push(edge.from)}
  const reachable=new Set(),stack=[allocations[0]?.id];
  while(stack.length){const id=stack.pop();if(!id||reachable.has(id))continue;reachable.add(id);stack.push(...(adjacency.get(id)||[]))}
  const unreachable=allocations.filter(node=>!reachable.has(node.id));
  if(unreachable.length)throw new Error(`${meta.name}: ${unreachable.length} selected nodes are disconnected`);
  boards.push({slug,name:meta.name,glyph:glyphNames[source.glyph.slug],glyphSlug:source.glyph.slug,glyphAssetId:`glyph:${source.glyph.slug.replace('barbarian-','')}`,glyphLevel:source.glyphLevel,rotation:source.rotation,width:board.nWidth,height:Math.ceil(board.arEntries.length/board.nWidth),boardSNO:board.__snoID__,sourceFile:board.__fileName__,selectedNodeCount:allocations.length,nodes,edges:edges.map(({distance,...edge})=>edge)});
}

const output={
  schemaVersion:3,
  variantKey:'uniques',
  sourceVariantId:config.source.capturedVariantId,
  sourceConfig:'data/paragon/whirlwind-variant-6.json',
  geometrySource:path.relative(library,path.join(d4data,'ParagonBoard')).replaceAll('\\','/'),
  nodeSource:path.relative(library,path.join(d4data,'ParagonNode')).replaceAll('\\','/'),
  coordinateTransform:'Mobalytics x/y minus 1 equals d4data board x/y',
  selectedNodeCount:config.nodes.length,
  priorityList:config.priorityList,
  boards
};
await fs.writeFile(outputPath,`${JSON.stringify(output,null,2)}\n`);
console.log(`Wrote ${boards.length} typed boards with ${boards.reduce((sum,board)=>sum+board.selectedNodeCount,0)} connected allocations to ${outputPath}`);
