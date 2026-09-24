import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const diabloRoot=path.resolve(here,'../..');
const args=process.argv.slice(2);
const value=name=>{const index=args.indexOf(name);return index<0?null:args[index+1]};
const sourceArg=value('--source');
const sourceRoot=sourceArg?path.resolve(sourceArg):null;
const dryRun=args.includes('--dry-run');
const force=args.includes('--force');
const slug=input=>String(input||'').normalize('NFKD').replace(/[’']/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const imageExtensions=new Set(['.png','.webp','.svg','.jpg','.jpeg']);
const productionExtension=source=>path.extname(source).toLowerCase();

async function walk(root){
  const files=[];
  async function visit(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const full=path.join(directory,entry.name);if(entry.isDirectory())await visit(full);else files.push(full)}}
  await visit(root);return files;
}

const builds=JSON.parse(await fs.readFile(path.join(diabloRoot,'data/builds.json'),'utf8'));
const existingManifest=await fs.readFile(path.join(diabloRoot,'data/assets.json'),'utf8').then(JSON.parse).catch(()=>({assets:{}}));
const requirements=new Map();
function add(id,name,kind,extra={}){if(!id)return;const existing=requirements.get(id)||{id,name,kind,...extra};requirements.set(id,{...existing,...extra,name:existing.name||name})}
for(const name of builds.classes)add(`class:${slug(name)}`,name,'class',{status:'missing'});
for(const build of builds.builds){
  add(build.classAssetId,build.class,'class',{status:'missing'});
  const setup=build.mercenarySetup;
  add(setup?.mercenary.assetId,setup?.mercenary.name,'mercenary',{status:'missing'});
  for(const selection of setup?.mercenary.selections||[])add(selection.assetId,selection.name,'mercenary-skill',{status:'missing'});
  add(setup?.reinforcement.assetId,setup?.reinforcement.name,'mercenary',{status:'missing'});
  add(setup?.reinforcement.skillAssetId,setup?.reinforcement.skill,'mercenary-skill',{status:'missing'});
  for(const variant of Object.values(build.variants)){
    for(const item of variant.equipment||[])add(item.assetId,item.rarity==='Legendary'&&item.aspect?item.aspect:item.name,item.assetId?.split(':')[0],{rarity:item.rarity,status:'missing'});
    for(const item of variant.talismans||[])add(item.assetId,item.name,'talisman',{status:'missing'});
    for(const item of variant.talismans||[])for(const member of item.members||[])add(`talisman:${slug(member)}`,member,'talisman',{status:'missing',set:item.name});
    for(const skill of variant.skills||[]){add(skill.skillId,skill.name,'skill',{class:slug(build.class),status:'missing'});for(const modifier of skill.modifiers||[])if(typeof modifier==='object')add(modifier.assetId,modifier.name,'skill-modifier',{class:slug(build.class),status:'missing'})}
    for(const glyph of variant.glyphs||[])add(glyph.assetId,glyph.name,'glyph',{class:slug(build.class),status:'missing'});
    for(const item of variant.expertise||[])add(item.assetId,item.name,'class-mechanic',{class:slug(build.class),status:'missing'});
    for(const pair of variant.runePairs||[]){add(pair.trigger.assetId,pair.trigger.name,'rune',{status:'missing'});add(pair.invoke.assetId,pair.invoke.name,'rune',{status:'missing'})}
    for(const system of variant.seasonalSystems||[])add(system.assetId,system.name,'seasonal',{status:'missing'});
  }
}
for(const [id,name] of [['event:world-boss','World Boss'],['event:helltide','Helltide'],['event:legion','Legion']])add(id,name,'event',{status:'missing'});
for(const set of ["Sescheron's Fury",'the Crucible'])for(const member of ['Phoba','Mlor','Linta','Fer','Berú'])add(`talisman:${slug(`${member} of ${set}`)}`,`${member} of ${set}`,'talisman',{status:'missing',set});

const legacyMap=new Map();
for(const record of requirements.values()){
  const key=record.id.split(':')[1];
  const candidates=[];
  if(record.kind==='item')candidates.push(path.join(diabloRoot,'assets/equipment',`${key}.webp`),path.join(diabloRoot,'assets/gear',`${key}.webp`));
  if(record.kind==='talisman')candidates.push(path.join(diabloRoot,'assets/talismans',`${key}.webp`),path.join(diabloRoot,'assets/gear',`${key}.webp`));
  legacyMap.set(record.id,candidates);
}
const sourceFiles=sourceRoot&&await fs.stat(sourceRoot).then(stat=>stat.isDirectory()).catch(()=>false)?await walk(sourceRoot):[];
const sourceImages=sourceFiles.filter(file=>imageExtensions.has(path.extname(file).toLowerCase()));
const byStem=new Map();
for(const file of sourceImages){const key=slug(path.basename(file,path.extname(file)));if(!byStem.has(key))byStem.set(key,[]);byStem.get(key).push(file)}
const imported=[],reused=[],missing=[],unmatched=[],duplicates=[];
const kindFolders={'class':'classes','skill':'skills','skill-modifier':'skills','item':'items/unique','aspect':'aspects','talisman':'talismans','glyph':'glyphs','class-mechanic':'classes','mercenary':'mercenaries','mercenary-skill':'mercenary-skills','rune':'runes','seasonal':'seasonal','event':'events'};
for(const record of requirements.values()){
  const entitySlug=record.id.split(':')[1];
  const exact=byStem.get(entitySlug)||[];
  if(exact.length>1)duplicates.push({id:record.id,candidates:exact.map(file=>path.relative(sourceRoot,file))});
  let chosen=exact.length===1?exact[0]:null,provenance=null;
  if(chosen)provenance={provider:'DiabloTools/d4data or D4Analyzer export',sourcePath:path.relative(sourceRoot,chosen).replaceAll('\\','/'),copyright:'Blizzard Entertainment or respective owners'};
  if(!chosen){
    const existing=existingManifest.assets?.[record.id];
    const existingPath=existing?.image?.startsWith('/diablo/')?path.join(diabloRoot,...existing.image.slice('/diablo/'.length).split('/')):null;
    const existingBytes=existingPath?await fs.readFile(existingPath).catch(()=>null):null;
    if(existingBytes&&(['verified','canonical','legacy','review'].includes(existing.status)||existing.displayOverride)){
      Object.assign(record,existing,{sha256:hash(existingBytes)});
      reused.push(record.id);
      continue;
    }
  }
  if(!chosen){for(const candidate of legacyMap.get(record.id)||[])if(await fs.stat(candidate).then(stat=>stat.isFile()).catch(()=>false)){chosen=candidate;provenance={provider:'Approved legacy asset',sourcePath:path.relative(diabloRoot,candidate).replaceAll('\\','/'),copyright:'Blizzard Entertainment or respective owners',replacementPending:'DiabloTools/D4Analyzer'};break}}
  if(!chosen){
    record.image=null;record.status='missing';record.requires='D4Analyzer export or verified DiabloTools texture';missing.push(record.id);continue
  }
  const extension=productionExtension(chosen),folder=kindFolders[record.kind]||record.kind;
  const relative=`assets/game/${folder}/${entitySlug}${extension}`.replaceAll('\\','/');
  const destination=path.join(diabloRoot,...relative.split('/'));
  const bytes=await fs.readFile(chosen),digest=hash(bytes);
  const current=await fs.readFile(destination).catch(()=>null);
  if(current&&hash(current)===digest)reused.push(record.id);
  else if(current&&!force){record.image=`/${path.relative(path.dirname(diabloRoot),destination).replaceAll('\\','/')}`;record.status='review';record.provenance=provenance;unmatched.push({id:record.id,reason:'Destination exists with different content; use --force only after review'});continue}
  else if(!dryRun){await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(chosen,destination);imported.push(record.id)}
  record.image=`/diablo/${relative}`;record.status=provenance.provider==='Approved legacy asset'?'legacy':'canonical';record.provenance=provenance;record.sha256=digest;
}
for(const file of sourceImages)if(![...byStem.keys()].some(key=>requirements.has(`item:${key}`)||requirements.has(`skill:${key}`)||requirements.has(`glyph:${key}`)))unmatched.push({sourcePath:path.relative(sourceRoot,file).replaceAll('\\','/'),reason:'No exact requested entity ID match'});
const placeholder={id:'ui:image-unavailable',name:'Image unavailable',kind:'ui',image:'/diablo/assets/ui/placeholder/image-unavailable.svg',status:'site-owned',provenance:{provider:'kryp12 UI',copyright:'Site-owned interface artwork'}};
const aspectFallback=existingManifest.assets?.['ui:aspect-fallback'];
const assets=Object.fromEntries([[placeholder.id,placeholder],...(aspectFallback?[[aspectFallback.id,aspectFallback]]:[]),...[...requirements.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(record=>[record.id,record])]);
const manifest={schemaVersion:1,generatedAt:new Date().toISOString(),sourcePolicy:{primary:'DiabloTools/d4data',exportFallback:'DiabloTools/Diablo4Tools-Releases D4Analyzer',copyright:'Diablo IV game assets remain property of Blizzard Entertainment or their respective owners.',thirdPartyCdn:false},fallbackAssetId:placeholder.id,assets};
const categoryCounts=Object.values(assets).reduce((counts,asset)=>({...counts,[asset.kind]:(counts[asset.kind]||0)+1}),{});
const report={generatedAt:manifest.generatedAt,sourceRoot,categoryCounts,imported,reused,missing,duplicates,unmatched:unmatched.slice(0,500),notes:['Exact normalized filename matches only; low-confidence matches are never fabricated.','Legacy images remain provisional and retain their original provenance.']};
if(!dryRun){await fs.writeFile(path.join(diabloRoot,'data/assets.json'),`${JSON.stringify(manifest,null,2)}\n`);await fs.writeFile(path.join(diabloRoot,'data/asset-import-report.json'),`${JSON.stringify(report,null,2)}\n`);const lines=['# Diablo asset import report','',`Generated: ${report.generatedAt}`,'',`- Imported: ${imported.length}`,`- Reused: ${reused.length}`,`- Missing: ${missing.length}`,`- Duplicate match groups: ${duplicates.length}`,`- Unmatched source files: ${unmatched.length}`,'','## Missing assets','',...missing.map(id=>`- ${id}`),'','## Review notes','','Canonical art was matched only by exact normalized entity ID. Missing entries require a verified DiabloTools texture or D4Analyzer export.'];await fs.writeFile(path.join(diabloRoot,'data/asset-import-report.md'),`${lines.join('\n')}\n`)}
console.log(JSON.stringify({categoryCounts,imported:imported.length,reused:reused.length,missing:missing.length,duplicates:duplicates.length,unmatched:unmatched.length,dryRun},null,2));
